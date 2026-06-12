#!/bin/bash

# Define the absolute root of the project
ROOT_DIR="/Users/shivamsingh/Desktop/Shivam/PortfolioDashboard"

npx concurrently -k -n "GO,AI,BOT,NEXT" -c "cyan,blue,yellow,magenta" \
  "cd $ROOT_DIR/apps/core-api && go run cmd/api/main.go" \
  "cd $ROOT_DIR/apps/ai-engine && source venv/bin/activate && python mq.py" \
  "cd $ROOT_DIR/apps/ai-engine && source venv/bin/activate && python telegram_bot.py" \
  "cd $ROOT_DIR/apps/dashboard && npm run dev"
