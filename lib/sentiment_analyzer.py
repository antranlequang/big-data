#!/usr/bin/env python3
"""
Multilingual Sentiment Analysis Service
Based on the logic from get_news.ipynb
Uses nlptown/bert-base-multilingual-uncased-sentiment model
"""

import sys
import json
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

# Try to import transformers, fall back to simple analysis if not available
try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("Warning: transformers not available, using simple sentiment analysis", file=sys.stderr)
    TRANSFORMERS_AVAILABLE = False

class SentimentAnalyzer:
    def __init__(self):
        """Initialize the sentiment analysis pipeline using transformers"""
        self.sentiment_pipeline = None
        
        if TRANSFORMERS_AVAILABLE:
            try:
                # Initialize the sentiment analysis pipeline with the same model from the notebook
                self.sentiment_pipeline = pipeline(
                    "sentiment-analysis", 
                    model="nlptown/bert-base-multilingual-uncased-sentiment",
                    return_all_scores=False
                )
                print(f"Sentiment analysis pipeline initialized with model: nlptown/bert-base-multilingual-uncased-sentiment", 
                      file=sys.stderr)
            except Exception as e:
                print(f"Error initializing sentiment pipeline: {e}", file=sys.stderr)
                self.sentiment_pipeline = None
        
        if not self.sentiment_pipeline:
            print("Using fallback keyword-based sentiment analysis", file=sys.stderr)

    def _simple_sentiment_analysis(self, text):
        """Fallback keyword-based sentiment analysis"""
        positive_words = [
            'rise', 'surge', 'gain', 'bull', 'rally', 'increase', 'growth', 'adoption', 
            'breakthrough', 'success', 'positive', 'optimistic', 'bullish', 'soar', 
            'moon', 'profit', 'upgrade', 'milestone', 'partnership', 'investment'
        ]
        
        negative_words = [
            'fall', 'crash', 'bear', 'decline', 'drop', 'plunge', 'loss', 'negative', 
            'pessimistic', 'bearish', 'dump', 'sell-off', 'hack', 'breach', 'scam', 
            'fraud', 'regulation', 'ban', 'concern', 'warning', 'risk'
        ]

        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        total_words = positive_count + negative_count
        if total_words == 0:
            return {'label': '3 stars', 'score': 0.5}
        
        positive_ratio = positive_count / total_words
        if positive_ratio > 0.6:
            score = min(0.7 + (positive_ratio * 0.3), 0.95)
            label = '5 stars' if positive_ratio > 0.8 else '4 stars'
        elif positive_ratio < 0.4:
            score = max(0.3 - (positive_ratio * 0.3), 0.1)
            label = '1 star' if positive_ratio < 0.2 else '2 stars'
        else:
            score = 0.45 + (0.1 * (positive_ratio - 0.4) / 0.2)
            label = '3 stars'
            
        return {'label': label, 'score': score}

    def analyze_article(self, article_content):
        """
        Analyze sentiment of a single article
        Following the exact logic from get_news.ipynb
        """
        try:
            # Use transformers pipeline if available, otherwise fall back to simple analysis
            if self.sentiment_pipeline:
                # Perform sentiment analysis - limit to 512 tokens as in the notebook
                analysis = self.sentiment_pipeline(article_content[:512])
                result = analysis[0] if isinstance(analysis, list) else analysis
                sentiment_label = result['label']
                sentiment_score = result['score']
            else:
                # Use fallback simple sentiment analysis
                result = self._simple_sentiment_analysis(article_content)
                sentiment_label = result['label']
                sentiment_score = result['score']

            # Map numerical labels to descriptive sentiment categories
            # The nlptown model labels are '1 star' to '5 stars'. Map them exactly as in notebook.
            if sentiment_label == '1 star' or sentiment_label == '2 stars':
                sentiment_category = 'negative'
            elif sentiment_label == '3 stars':
                sentiment_category = 'neutral'
            elif sentiment_label == '4 stars' or sentiment_label == '5 stars':
                sentiment_category = 'positive'
            else:
                sentiment_category = 'neutral'  # Default fallback

            return {
                'sentiment_label': sentiment_label,
                'sentiment_category': sentiment_category,
                'sentiment_score': float(sentiment_score),
                'error': None
            }

        except Exception as e:
            print(f"Error analyzing sentiment: {e}", file=sys.stderr)
            return {
                'sentiment_label': '3 stars',
                'sentiment_category': 'neutral',
                'sentiment_score': 0.5,
                'error': str(e)
            }

    def analyze_articles_batch(self, articles):
        """
        Analyze sentiment for multiple articles
        Following the batch processing logic from get_news.ipynb
        """
        sentiment_results = []
        articles_analyzed_count = 0

        for article in articles:
            if article.get('content') and article['content'].strip():
                try:
                    # Analyze sentiment for this article
                    sentiment_result = self.analyze_article(article['content'])
                    
                    # Add sentiment data to article
                    article['sentiment_label'] = sentiment_result['sentiment_label']
                    article['sentiment_category'] = sentiment_result['sentiment_category'] 
                    article['sentiment_score'] = sentiment_result['sentiment_score']
                    
                    sentiment_results.append(article)
                    articles_analyzed_count += 1
                    
                    print(f"Analyzed: {article['title'][:50]}... -> {sentiment_result['sentiment_category']} ({sentiment_result['sentiment_score']:.4f})", 
                          file=sys.stderr)
                    
                except Exception as e:
                    print(f"Error analyzing sentiment for '{article['title']}': {e}", file=sys.stderr)
                    # Mark as neutral on error
                    article['sentiment_label'] = '3 stars'
                    article['sentiment_category'] = 'neutral'
                    article['sentiment_score'] = 0.5
                    sentiment_results.append(article)
            else:
                # Mark articles without content as 'N/A' for sentiment
                article['sentiment_label'] = 'N/A'
                article['sentiment_category'] = 'neutral'
                article['sentiment_score'] = 0.0
                sentiment_results.append(article)

        print(f"Summary: Sentiment analysis performed for {articles_analyzed_count} articles.", 
              file=sys.stderr)

        # Group by sentiment category for easy consumption by the API
        positive_articles = [a for a in sentiment_results if a['sentiment_category'] == 'positive']
        neutral_articles = [a for a in sentiment_results if a['sentiment_category'] == 'neutral']
        negative_articles = [a for a in sentiment_results if a['sentiment_category'] == 'negative']

        return {
            'positive': positive_articles,
            'neutral': neutral_articles, 
            'negative': negative_articles,
            'total': len(sentiment_results),
            'summary': {
                'positive_count': len(positive_articles),
                'neutral_count': len(neutral_articles),
                'negative_count': len(negative_articles),
                'analyzed_count': articles_analyzed_count
            }
        }


def main():
    """Main function to handle command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python sentiment_analyzer.py <json_file_or_json_string>", file=sys.stderr)
        sys.exit(1)

    # Initialize analyzer
    analyzer = SentimentAnalyzer()
    
    try:
        # Try to parse input as JSON
        input_data = sys.argv[1]
        
        # Check if it's a file path or JSON string
        if input_data.startswith('[') or input_data.startswith('{'):
            # Direct JSON string
            articles = json.loads(input_data)
        else:
            # File path
            with open(input_data, 'r', encoding='utf-8') as f:
                articles = json.load(f)
        
        # Analyze articles
        results = analyzer.analyze_articles_batch(articles)
        
        # Output results as JSON
        print(json.dumps(results, ensure_ascii=False, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'positive': [],
            'neutral': [],
            'negative': [],
            'total': 0,
            'summary': {
                'positive_count': 0,
                'neutral_count': 0,
                'negative_count': 0,
                'analyzed_count': 0
            }
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()