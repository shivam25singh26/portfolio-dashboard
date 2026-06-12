#!/bin/bash

# Define the absolute root of the project
ROOT_DIR="/Users/shivamsingh/Desktop/Shivam/PortfolioDashboard"
CF_URL="http://192.168.0.251:3000"

echo "Starting mobile-friendly backend services..."
echo "Android app should connect to: $CF_URL"

# Local IP mode
npx concurrently -k -n "GO,AI,BOT,NEXT" -c "cyan,blue,yellow,magenta" \
  "cd $ROOT_DIR/apps/core-api && go run cmd/api/main.go" \
  "cd $ROOT_DIR/apps/ai-engine && source venv/bin/activate && python mq.py" \
  "cd $ROOT_DIR/apps/ai-engine && source venv/bin/activate && python telegram_bot.py" \
  "cd $ROOT_DIR/apps/dashboard && npm run build && NEXTAUTH_URL=$CF_URL NEXTAUTH_URL_INTERNAL=http://127.0.0.1:3000 npm run start -- -p 3000 -H 0.0.0.0"
