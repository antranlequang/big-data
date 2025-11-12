#!/bin/bash
# -----------------------------------------------
# Crypto Dashboard - Run Python Services Script
# -----------------------------------------------

# 1️⃣ Set variables
VENV_DIR=".venv_ml"
LOG_DIR="./logs"

mkdir -p $LOG_DIR

echo "🚀 Starting all Python services..."

# 2️⃣ Activate virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv $VENV_DIR
fi
source $VENV_DIR/bin/activate

# 3️⃣ Install dependencies (optional, first run)
pip install --upgrade pip
pip install -r requirements.txt

# 4️⃣ Function to start a service in background
start_service() {
    local name=$1
    local script=$2
    local logfile=$3

    echo "Starting $name..."
    nohup python $script > $LOG_DIR/$logfile 2>&1 &
    echo "$name started, logging to $LOG_DIR/$logfile"
}

# 5️⃣ Start all services
start_service "Data Pipeline" "lib/data_pipeline.py" "data_pipeline.log"
start_service "ML Training" "lib/continuous-training.py" "ml_training.log"
start_service "Forecasting" "lib/real-time-forecasting.py" "forecasting.log"
start_service "Candle Service" "start_candle_service.py" "candle_service.log"

# 6️⃣ Done
echo "✅ All Python services started in background."
echo "Use 'ps aux | grep python' to check running processes."
echo "Logs are in $LOG_DIR/"