#!/usr/bin/env python3
"""
Multivariate LSTM Model for Crypto Risk Prediction
Implements Phase 2: Training Base Model (Offline - Deep Learning)
"""

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, callbacks, optimizers
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import matplotlib.pyplot as plt
import joblib
from datetime import datetime

class CryptoRiskLSTM:
    def __init__(self, sequence_length=24, n_features=15, model_name="crypto_risk_lstm"):
        """
        Initialize LSTM model for crypto risk prediction
        
        Args:
            sequence_length: Number of time steps to look back
            n_features: Number of input features
            model_name: Name for saving the model
        """
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.model_name = model_name
        self.model = None
        self.history = None
        
        # Set random seeds for reproducibility
        tf.random.set_seed(42)
        np.random.seed(42)
        
        print(f"🤖 Initialized LSTM model: {sequence_length} timesteps, {n_features} features")

    def build_model_architecture(self, lstm_units=[64, 32], dropout_rate=0.3, learning_rate=0.001):
        """
        2.1 Building multivariate LSTM model architecture
        Deep learning model with sigmoid output for binary classification
        """
        print("🏗️ Building multivariate LSTM architecture...")
        
        model = Sequential([
            # First LSTM layer with return sequences
            LSTM(lstm_units[0], 
                 return_sequences=True, 
                 input_shape=(self.sequence_length, self.n_features),
                 name='lstm_layer_1'),
            BatchNormalization(name='batch_norm_1'),
            Dropout(dropout_rate, name='dropout_1'),
            
            # Second LSTM layer
            LSTM(lstm_units[1], 
                 return_sequences=False,
                 name='lstm_layer_2'),
            BatchNormalization(name='batch_norm_2'),
            Dropout(dropout_rate, name='dropout_2'),
            
            # Dense layers for risk classification
            Dense(32, activation='relu', name='dense_1'),
            Dropout(dropout_rate, name='dropout_3'),
            
            Dense(16, activation='relu', name='dense_2'),
            Dropout(dropout_rate, name='dropout_4'),
            
            # Output layer with sigmoid for binary classification (risk warning)
            Dense(1, activation='sigmoid', name='risk_output')
        ])
        
        # Compile model with appropriate loss for binary classification
        optimizer = optimizers.Adam(learning_rate=learning_rate)
        model.compile(
            optimizer=optimizer,
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        self.model = model
        
        print("✅ Model architecture built successfully")
        print(f"📊 Model summary:")
        model.summary()
        
        return model

    def prepare_callbacks(self, patience=10, save_best_only=True):
        """Prepare training callbacks for model optimization"""
        callbacks_list = [
            # Early stopping to prevent overfitting
            EarlyStopping(
                monitor='val_loss',
                patience=patience,
                restore_best_weights=True,
                verbose=1,
                name='early_stopping'
            ),
            
            # Save best model
            ModelCheckpoint(
                filepath=f'./models/{self.model_name}_best.h5',
                monitor='val_loss',
                save_best_only=save_best_only,
                save_weights_only=False,
                verbose=1,
                name='model_checkpoint'
            ),
            
            # Reduce learning rate on plateau
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7,
                verbose=1,
                name='reduce_lr'
            )
        ]
        
        return callbacks_list

    def train_base_model(self, X_train, y_train, X_val, y_val, epochs=100, batch_size=32):
        """
        2.2 Train the base model on historical data
        Train on all processed historical data and save as "Base Model"
        """
        print("🚀 Training base model on historical data...")
        
        if self.model is None:
            raise ValueError("Model not built. Call build_model_architecture() first.")
        
        # Ensure output directory exists
        os.makedirs('./models', exist_ok=True)
        
        # Prepare callbacks
        callbacks_list = self.prepare_callbacks()
        
        # Train the model
        start_time = datetime.now()
        
        self.history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks_list,
            verbose=1,
            shuffle=True
        )
        
        training_time = datetime.now() - start_time
        print(f"⏱️ Training completed in {training_time}")
        
        # Save the final model as "Base Model"
        base_model_path = f'./models/{self.model_name}_base_model.h5'
        self.model.save(base_model_path)
        print(f"💾 Base model saved to {base_model_path}")
        
        return self.history

    def evaluate_model(self, X_test, y_test):
        """Evaluate model performance on test data"""
        print("📊 Evaluating model performance...")
        
        if self.model is None:
            raise ValueError("Model not trained. Train the model first.")
        
        # Make predictions
        y_pred_prob = self.model.predict(X_test)
        y_pred = (y_pred_prob > 0.5).astype(int)
        
        # Calculate metrics
        test_loss, test_accuracy, test_precision, test_recall = self.model.evaluate(X_test, y_test, verbose=0)
        
        # Additional metrics
        try:
            auc_score = roc_auc_score(y_test, y_pred_prob)
        except:
            auc_score = 0.0
            
        f1_score = 2 * (test_precision * test_recall) / (test_precision + test_recall) if (test_precision + test_recall) > 0 else 0
        
        print(f"🎯 Test Results:")
        print(f"   Loss: {test_loss:.4f}")
        print(f"   Accuracy: {test_accuracy:.4f}")
        print(f"   Precision: {test_precision:.4f}")
        print(f"   Recall: {test_recall:.4f}")
        print(f"   F1-Score: {f1_score:.4f}")
        print(f"   AUC: {auc_score:.4f}")
        
        # Classification report
        print("\n📋 Classification Report:")
        print(classification_report(y_test, y_pred, target_names=['No Risk', 'Risk']))
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\n🔄 Confusion Matrix:")
        print(f"   [[TN: {cm[0,0]}, FP: {cm[0,1]}]")
        print(f"    [FN: {cm[1,0]}, TP: {cm[1,1]}]]")
        
        return {
            'test_loss': test_loss,
            'test_accuracy': test_accuracy,
            'test_precision': test_precision,
            'test_recall': test_recall,
            'f1_score': f1_score,
            'auc_score': auc_score,
            'predictions_prob': y_pred_prob,
            'predictions': y_pred
        }

    def plot_training_history(self, save_plot=True):
        """Plot training history"""
        if self.history is None:
            print("❌ No training history available")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # Loss
        axes[0,0].plot(self.history.history['loss'], label='Training Loss')
        axes[0,0].plot(self.history.history['val_loss'], label='Validation Loss')
        axes[0,0].set_title('Model Loss')
        axes[0,0].set_xlabel('Epoch')
        axes[0,0].set_ylabel('Loss')
        axes[0,0].legend()
        
        # Accuracy
        axes[0,1].plot(self.history.history['accuracy'], label='Training Accuracy')
        axes[0,1].plot(self.history.history['val_accuracy'], label='Validation Accuracy')
        axes[0,1].set_title('Model Accuracy')
        axes[0,1].set_xlabel('Epoch')
        axes[0,1].set_ylabel('Accuracy')
        axes[0,1].legend()
        
        # Precision
        axes[1,0].plot(self.history.history['precision'], label='Training Precision')
        axes[1,0].plot(self.history.history['val_precision'], label='Validation Precision')
        axes[1,0].set_title('Model Precision')
        axes[1,0].set_xlabel('Epoch')
        axes[1,0].set_ylabel('Precision')
        axes[1,0].legend()
        
        # Recall
        axes[1,1].plot(self.history.history['recall'], label='Training Recall')
        axes[1,1].plot(self.history.history['val_recall'], label='Validation Recall')
        axes[1,1].set_title('Model Recall')
        axes[1,1].set_xlabel('Epoch')
        axes[1,1].set_ylabel('Recall')
        axes[1,1].legend()
        
        plt.tight_layout()
        
        if save_plot:
            plot_path = f'./models/{self.model_name}_training_history.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            print(f"📈 Training history plot saved to {plot_path}")
        
        plt.show()

    def load_base_model(self, model_path=None):
        """Load a saved base model"""
        if model_path is None:
            model_path = f'./models/{self.model_name}_base_model.h5'
        
        try:
            self.model = keras.models.load_model(model_path)
            print(f"✅ Base model loaded from {model_path}")
            return True
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return False

    def save_model_metadata(self, metadata):
        """Save model metadata for continuous training"""
        metadata_path = f'./models/{self.model_name}_metadata.json'
        
        model_info = {
            'model_name': self.model_name,
            'sequence_length': self.sequence_length,
            'n_features': self.n_features,
            'training_date': datetime.now().isoformat(),
            'performance_metrics': metadata
        }
        
        import json
        with open(metadata_path, 'w') as f:
            json.dump(model_info, f, indent=2)
        
        print(f"📋 Model metadata saved to {metadata_path}")

def train_complete_pipeline():
    """
    Complete training pipeline for the base model
    """
    print("🚀 Starting complete LSTM training pipeline...")
    
    # Load processed data from ETL
    try:
        X = np.load('./data/processed/X_sequences.npy')
        y = np.load('./data/processed/y_sequences.npy')
        scaler = joblib.load('./data/processed/feature_scaler.pkl')
        print(f"✅ Loaded processed data: X={X.shape}, y={y.shape}")
    except FileNotFoundError:
        print("❌ Processed data not found. Please run the ETL pipeline first.")
        return None
    
    # Split data into train/validation/test
    total_samples = len(X)
    train_idx = int(0.7 * total_samples)
    val_idx = int(0.85 * total_samples)
    
    X_train, y_train = X[:train_idx], y[:train_idx]
    X_val, y_val = X[train_idx:val_idx], y[train_idx:val_idx]
    X_test, y_test = X[val_idx:], y[val_idx:]
    
    print(f"📊 Data split - Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # Initialize and build model
    lstm_model = CryptoRiskLSTM(
        sequence_length=X.shape[1],
        n_features=X.shape[2],
        model_name="crypto_risk_base_model"
    )
    
    # Build architecture
    lstm_model.build_model_architecture(
        lstm_units=[64, 32],
        dropout_rate=0.3,
        learning_rate=0.001
    )
    
    # Train base model
    history = lstm_model.train_base_model(
        X_train, y_train, 
        X_val, y_val,
        epochs=50,
        batch_size=32
    )
    
    # Evaluate model
    results = lstm_model.evaluate_model(X_test, y_test)
    
    # Save metadata
    lstm_model.save_model_metadata(results)
    
    # Plot training history
    lstm_model.plot_training_history()
    
    print("✅ Base model training pipeline completed!")
    return lstm_model, results

if __name__ == "__main__":
    # Train the complete base model
    model, results = train_complete_pipeline()
    
    if model and results:
        print(f"🎯 Final model performance:")
        print(f"   Accuracy: {results['test_accuracy']:.4f}")
        print(f"   F1-Score: {results['f1_score']:.4f}")
        print(f"   AUC: {results['auc_score']:.4f}")
        print("💾 Base model ready for continuous training!")