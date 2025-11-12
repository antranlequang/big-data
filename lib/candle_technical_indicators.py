#!/usr/bin/env python3
"""
Technical Indicators Calculator for Candle Charts
Implements common technical indicators using PySpark for processing
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.window import Window
import json
from typing import Dict, List, Optional
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CandleTechnicalIndicators:
    def __init__(self):
        """Initialize Spark session for technical indicators calculation"""
        self.spark = SparkSession.builder \
            .appName("CandleTechnicalIndicators") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        
        self.spark.sparkContext.setLogLevel("WARN")
        logger.info("Technical Indicators Calculator initialized")

    def prepare_candle_dataframe(self, candle_data: List[Dict]):
        """Convert candle data to Spark DataFrame"""
        try:
            # Define schema for candle data
            candle_schema = StructType([
                StructField("timestamp", LongType(), True),
                StructField("date", StringType(), True),
                StructField("open", DoubleType(), True),
                StructField("high", DoubleType(), True),
                StructField("low", DoubleType(), True),
                StructField("close", DoubleType(), True),
                StructField("volume", DoubleType(), True),
                StructField("coin_id", StringType(), True)
            ])
            
            # Create DataFrame
            df = self.spark.createDataFrame(candle_data, candle_schema)
            
            # Sort by timestamp for time series analysis
            df = df.orderBy("timestamp")
            
            logger.info(f"Prepared DataFrame with {df.count()} candle records")
            return df
            
        except Exception as e:
            logger.error(f"Error preparing DataFrame: {e}")
            return None

    def calculate_moving_averages(self, df):
        """Calculate various moving averages"""
        logger.info("Calculating moving averages...")
        
        # Define window specifications for different periods
        ma7_window = Window.orderBy("timestamp").rowsBetween(-6, 0)
        ma20_window = Window.orderBy("timestamp").rowsBetween(-19, 0)
        ma50_window = Window.orderBy("timestamp").rowsBetween(-49, 0)
        ma200_window = Window.orderBy("timestamp").rowsBetween(-199, 0)
        
        # Simple Moving Averages (SMA)
        df = df.withColumn("sma_7", avg("close").over(ma7_window))
        df = df.withColumn("sma_20", avg("close").over(ma20_window))
        df = df.withColumn("sma_50", avg("close").over(ma50_window))
        df = df.withColumn("sma_200", avg("close").over(ma200_window))
        
        # Exponential Moving Averages (EMA) - approximation
        # True EMA requires iterative calculation, this is a simplified version
        df = df.withColumn("ema_12", avg("close").over(Window.orderBy("timestamp").rowsBetween(-11, 0)))
        df = df.withColumn("ema_26", avg("close").over(Window.orderBy("timestamp").rowsBetween(-25, 0)))
        
        # Volume Moving Average
        df = df.withColumn("volume_ma_20", avg("volume").over(ma20_window))
        
        logger.info("Moving averages calculated")
        return df

    def calculate_rsi(self, df, period=14):
        """Calculate Relative Strength Index (RSI)"""
        logger.info(f"Calculating RSI (period={period})...")
        
        # Calculate price changes
        window_spec = Window.orderBy("timestamp")
        df = df.withColumn("price_change", col("close") - lag("close").over(window_spec))
        
        # Separate gains and losses
        df = df.withColumn("gain", when(col("price_change") > 0, col("price_change")).otherwise(0))
        df = df.withColumn("loss", when(col("price_change") < 0, -col("price_change")).otherwise(0))
        
        # Calculate average gains and losses
        rsi_window = Window.orderBy("timestamp").rowsBetween(-(period-1), 0)
        df = df.withColumn("avg_gain", avg("gain").over(rsi_window))
        df = df.withColumn("avg_loss", avg("loss").over(rsi_window))
        
        # Calculate RSI
        df = df.withColumn("rs", col("avg_gain") / when(col("avg_loss") == 0, 0.001).otherwise(col("avg_loss")))
        df = df.withColumn("rsi", 100 - (100 / (1 + col("rs"))))
        
        # RSI signals
        df = df.withColumn("rsi_oversold", when(col("rsi") < 30, 1).otherwise(0))
        df = df.withColumn("rsi_overbought", when(col("rsi") > 70, 1).otherwise(0))
        
        logger.info("RSI calculated")
        return df

    def calculate_macd(self, df):
        """Calculate MACD (Moving Average Convergence Divergence)"""
        logger.info("Calculating MACD...")
        
        # Calculate EMAs for MACD (simplified version)
        ema12_window = Window.orderBy("timestamp").rowsBetween(-11, 0)
        ema26_window = Window.orderBy("timestamp").rowsBetween(-25, 0)
        signal_window = Window.orderBy("timestamp").rowsBetween(-8, 0)  # 9-period signal line
        
        # MACD Line = EMA(12) - EMA(26)
        df = df.withColumn("macd_line", col("ema_12") - col("ema_26"))
        
        # Signal Line = EMA(9) of MACD Line
        df = df.withColumn("macd_signal", avg("macd_line").over(signal_window))
        
        # MACD Histogram = MACD Line - Signal Line
        df = df.withColumn("macd_histogram", col("macd_line") - col("macd_signal"))
        
        # MACD signals
        df = df.withColumn("macd_bullish", when(col("macd_line") > col("macd_signal"), 1).otherwise(0))
        df = df.withColumn("macd_bearish", when(col("macd_line") < col("macd_signal"), 1).otherwise(0))
        
        logger.info("MACD calculated")
        return df

    def calculate_bollinger_bands(self, df, period=20, std_dev=2):
        """Calculate Bollinger Bands"""
        logger.info(f"Calculating Bollinger Bands (period={period}, std_dev={std_dev})...")
        
        # Window for Bollinger Bands calculation
        bb_window = Window.orderBy("timestamp").rowsBetween(-(period-1), 0)
        
        # Middle Band (SMA)
        df = df.withColumn("bb_middle", avg("close").over(bb_window))
        
        # Standard deviation
        df = df.withColumn("bb_std", stddev("close").over(bb_window))
        
        # Upper and Lower Bands
        df = df.withColumn("bb_upper", col("bb_middle") + (col("bb_std") * std_dev))
        df = df.withColumn("bb_lower", col("bb_middle") - (col("bb_std") * std_dev))
        
        # Bollinger Band signals
        df = df.withColumn("bb_squeeze", when(col("bb_upper") - col("bb_lower") < col("bb_middle") * 0.1, 1).otherwise(0))
        df = df.withColumn("bb_breakout_upper", when(col("close") > col("bb_upper"), 1).otherwise(0))
        df = df.withColumn("bb_breakout_lower", when(col("close") < col("bb_lower"), 1).otherwise(0))
        
        logger.info("Bollinger Bands calculated")
        return df

    def calculate_stochastic_oscillator(self, df, k_period=14, d_period=3):
        """Calculate Stochastic Oscillator"""
        logger.info(f"Calculating Stochastic Oscillator (K={k_period}, D={d_period})...")
        
        # Window for highest high and lowest low
        stoch_window = Window.orderBy("timestamp").rowsBetween(-(k_period-1), 0)
        
        # Calculate %K
        df = df.withColumn("highest_high", max("high").over(stoch_window))
        df = df.withColumn("lowest_low", min("low").over(stoch_window))
        
        df = df.withColumn("stoch_k", 
                          when(col("highest_high") - col("lowest_low") != 0,
                               (col("close") - col("lowest_low")) / (col("highest_high") - col("lowest_low")) * 100)
                          .otherwise(50))
        
        # Calculate %D (moving average of %K)
        d_window = Window.orderBy("timestamp").rowsBetween(-(d_period-1), 0)
        df = df.withColumn("stoch_d", avg("stoch_k").over(d_window))
        
        # Stochastic signals
        df = df.withColumn("stoch_oversold", when((col("stoch_k") < 20) & (col("stoch_d") < 20), 1).otherwise(0))
        df = df.withColumn("stoch_overbought", when((col("stoch_k") > 80) & (col("stoch_d") > 80), 1).otherwise(0))
        
        logger.info("Stochastic Oscillator calculated")
        return df

    def calculate_volume_indicators(self, df):
        """Calculate volume-based indicators"""
        logger.info("Calculating volume indicators...")
        
        # Volume Rate of Change
        lag_window = Window.orderBy("timestamp")
        df = df.withColumn("prev_volume", lag("volume").over(lag_window))
        df = df.withColumn("volume_roc", 
                          when(col("prev_volume") != 0,
                               (col("volume") - col("prev_volume")) / col("prev_volume") * 100)
                          .otherwise(0))
        
        # On-Balance Volume (OBV) - simplified
        df = df.withColumn("price_direction", 
                          when(col("close") > lag("close").over(lag_window), 1)
                          .when(col("close") < lag("close").over(lag_window), -1)
                          .otherwise(0))
        df = df.withColumn("obv_change", col("volume") * col("price_direction"))
        
        # Cumulative OBV (approximation)
        obv_window = Window.orderBy("timestamp").rowsBetween(Window.unboundedPreceding, 0)
        df = df.withColumn("obv", sum("obv_change").over(obv_window))
        
        # Volume signals
        df = df.withColumn("high_volume", when(col("volume") > col("volume_ma_20") * 1.5, 1).otherwise(0))
        df = df.withColumn("low_volume", when(col("volume") < col("volume_ma_20") * 0.5, 1).otherwise(0))
        
        logger.info("Volume indicators calculated")
        return df

    def calculate_support_resistance(self, df, lookback=5):
        """Calculate basic support and resistance levels"""
        logger.info(f"Calculating support/resistance levels (lookback={lookback})...")
        
        # Windows for local extremes
        window_before = Window.orderBy("timestamp").rowsBetween(-(lookback), -1)
        window_after = Window.orderBy("timestamp").rowsBetween(1, lookback)
        window_current = Window.orderBy("timestamp").rowsBetween(-(lookback), lookback)
        
        # Find local highs (resistance)
        df = df.withColumn("max_before", max("high").over(window_before))
        df = df.withColumn("max_after", max("high").over(window_after))
        df = df.withColumn("is_resistance", 
                          when((col("high") >= coalesce(col("max_before"), lit(0))) & 
                               (col("high") >= coalesce(col("max_after"), lit(0))), 1)
                          .otherwise(0))
        
        # Find local lows (support)
        df = df.withColumn("min_before", min("low").over(window_before))
        df = df.withColumn("min_after", min("low").over(window_after))
        df = df.withColumn("is_support", 
                          when((col("low") <= coalesce(col("min_before"), lit(float('inf')))) & 
                               (col("low") <= coalesce(col("min_after"), lit(float('inf')))), 1)
                          .otherwise(0))
        
        logger.info("Support/resistance levels calculated")
        return df

    def calculate_all_indicators(self, candle_data: List[Dict]) -> Optional[List[Dict]]:
        """Calculate all technical indicators for candle data"""
        logger.info("Starting comprehensive technical analysis...")
        
        try:
            # Prepare DataFrame
            df = self.prepare_candle_dataframe(candle_data)
            if df is None:
                return None
            
            # Calculate all indicators
            df = self.calculate_moving_averages(df)
            df = self.calculate_rsi(df)
            df = self.calculate_macd(df)
            df = self.calculate_bollinger_bands(df)
            df = self.calculate_stochastic_oscillator(df)
            df = self.calculate_volume_indicators(df)
            df = self.calculate_support_resistance(df)
            
            # Convert back to list of dictionaries
            result_data = df.collect()
            
            processed_data = []
            for row in result_data:
                record = row.asDict()
                # Convert any NaN values to None for JSON serialization
                for key, value in record.items():
                    if value is not None and str(value).lower() == 'nan':
                        record[key] = None
                processed_data.append(record)
            
            logger.info(f"Technical analysis completed for {len(processed_data)} records")
            return processed_data
            
        except Exception as e:
            logger.error(f"Error calculating technical indicators: {e}")
            return None

    def generate_trading_signals(self, processed_data: List[Dict]) -> Dict:
        """Generate trading signals based on technical indicators"""
        logger.info("Generating trading signals...")
        
        try:
            if not processed_data:
                return {}
            
            latest_data = processed_data[-1]  # Most recent data point
            
            signals = {
                'timestamp': latest_data.get('timestamp'),
                'price': latest_data.get('close'),
                'signals': {
                    'trend': self._analyze_trend(latest_data),
                    'momentum': self._analyze_momentum(latest_data),
                    'volume': self._analyze_volume(latest_data),
                    'support_resistance': self._analyze_support_resistance(latest_data),
                    'overall_sentiment': 'neutral'
                }
            }
            
            # Calculate overall sentiment
            signal_scores = []
            for category, signal in signals['signals'].items():
                if category != 'overall_sentiment' and isinstance(signal, dict):
                    if signal.get('signal') == 'bullish':
                        signal_scores.append(1)
                    elif signal.get('signal') == 'bearish':
                        signal_scores.append(-1)
                    else:
                        signal_scores.append(0)
            
            if signal_scores:
                avg_score = sum(signal_scores) / len(signal_scores)
                if avg_score > 0.3:
                    signals['signals']['overall_sentiment'] = 'bullish'
                elif avg_score < -0.3:
                    signals['signals']['overall_sentiment'] = 'bearish'
                else:
                    signals['signals']['overall_sentiment'] = 'neutral'
            
            logger.info("Trading signals generated")
            return signals
            
        except Exception as e:
            logger.error(f"Error generating trading signals: {e}")
            return {}

    def _analyze_trend(self, data: Dict) -> Dict:
        """Analyze trend signals"""
        sma_20 = data.get('sma_20')
        sma_50 = data.get('sma_50')
        close = data.get('close')
        
        if not all([sma_20, sma_50, close]):
            return {'signal': 'neutral', 'strength': 0, 'description': 'Insufficient data'}
        
        if close > sma_20 > sma_50:
            return {'signal': 'bullish', 'strength': 0.8, 'description': 'Price above both SMAs, uptrend'}
        elif close < sma_20 < sma_50:
            return {'signal': 'bearish', 'strength': 0.8, 'description': 'Price below both SMAs, downtrend'}
        else:
            return {'signal': 'neutral', 'strength': 0.3, 'description': 'Mixed trend signals'}

    def _analyze_momentum(self, data: Dict) -> Dict:
        """Analyze momentum signals"""
        rsi = data.get('rsi')
        macd_line = data.get('macd_line')
        macd_signal = data.get('macd_signal')
        
        signals = []
        
        if rsi is not None:
            if rsi < 30:
                signals.append('oversold')
            elif rsi > 70:
                signals.append('overbought')
        
        if macd_line is not None and macd_signal is not None:
            if macd_line > macd_signal:
                signals.append('macd_bullish')
            else:
                signals.append('macd_bearish')
        
        if 'oversold' in signals:
            return {'signal': 'bullish', 'strength': 0.7, 'description': 'RSI oversold, potential bounce'}
        elif 'overbought' in signals:
            return {'signal': 'bearish', 'strength': 0.7, 'description': 'RSI overbought, potential pullback'}
        elif 'macd_bullish' in signals:
            return {'signal': 'bullish', 'strength': 0.6, 'description': 'MACD bullish crossover'}
        elif 'macd_bearish' in signals:
            return {'signal': 'bearish', 'strength': 0.6, 'description': 'MACD bearish crossover'}
        else:
            return {'signal': 'neutral', 'strength': 0.3, 'description': 'Mixed momentum signals'}

    def _analyze_volume(self, data: Dict) -> Dict:
        """Analyze volume signals"""
        high_volume = data.get('high_volume', 0)
        low_volume = data.get('low_volume', 0)
        volume_roc = data.get('volume_roc', 0)
        
        if high_volume and volume_roc > 50:
            return {'signal': 'bullish', 'strength': 0.6, 'description': 'High volume with strong increase'}
        elif low_volume:
            return {'signal': 'bearish', 'strength': 0.4, 'description': 'Low volume, weak conviction'}
        else:
            return {'signal': 'neutral', 'strength': 0.3, 'description': 'Normal volume activity'}

    def _analyze_support_resistance(self, data: Dict) -> Dict:
        """Analyze support/resistance signals"""
        is_support = data.get('is_support', 0)
        is_resistance = data.get('is_resistance', 0)
        close = data.get('close')
        bb_upper = data.get('bb_upper')
        bb_lower = data.get('bb_lower')
        
        if is_support:
            return {'signal': 'bullish', 'strength': 0.7, 'description': 'Price at support level'}
        elif is_resistance:
            return {'signal': 'bearish', 'strength': 0.7, 'description': 'Price at resistance level'}
        elif close and bb_lower and close < bb_lower:
            return {'signal': 'bullish', 'strength': 0.6, 'description': 'Price below Bollinger lower band'}
        elif close and bb_upper and close > bb_upper:
            return {'signal': 'bearish', 'strength': 0.6, 'description': 'Price above Bollinger upper band'}
        else:
            return {'signal': 'neutral', 'strength': 0.3, 'description': 'No clear S/R signals'}

    def close(self):
        """Clean up Spark session"""
        self.spark.stop()
        logger.info("Technical Indicators Spark session closed")

# Only print JSON output if needed; remove all other print statements (done above).