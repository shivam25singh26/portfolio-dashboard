#!/bin/bash
# Start the AI Message Queue processor in the background
python mq.py &

# Start the Telegram Bot in the background
python telegram_bot.py &

# Start a dummy web server so Render's health checks pass (Web Services require binding to $PORT)
echo "Starting dummy web server on port $PORT"
python -m http.server $PORT
