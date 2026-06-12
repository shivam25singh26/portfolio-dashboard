import pika
import json

credentials = pika.PlainCredentials('admin', 'password')
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost', credentials=credentials))
channel = connection.channel()

# 1. Truncate DB (just in case)
channel.basic_publish(
    exchange='',
    routing_key='telegram_broadcast',
    body=json.dumps({"type": "truncate_db"})
)

# 2. Send 2 test trades to Telegram to bypass the LLM API limit
test_trades = [
    {
        "symbol": "SBIN-EQ",
        "action": "LONG",
        "target": 895.00,
        "stop_loss": 830.00,
        "conviction_score": 92,
        "reasoning": "Strong breakout above key moving averages with high volume. Sector momentum is highly bullish.",
        "cap": "Large",
        "ltp": 850.50
    },
    {
        "symbol": "HDFCBANK-EQ",
        "action": "SHORT",
        "target": 1610.00,
        "stop_loss": 1720.50,
        "conviction_score": 88,
        "reasoning": "Fundamentals remaining strong despite minor pullback. RSI indicates oversold conditions.",
        "cap": "Large",
        "ltp": 1650.20
    }
]

channel.basic_publish(
    exchange='',
    routing_key='telegram_broadcast',
    body=json.dumps({"type": "telegram_batch", "trades": test_trades})
)

# 3. Send the individual trades to the Go backend queue
# First, wipe the old trades
channel.basic_publish(
    exchange='',
    routing_key='trade_proposals',
    body=json.dumps({"type": "truncate_db"})
)

for trade in test_trades:
    payload_dict = {
        "type": "stage1_result", 
        "symbol": trade["symbol"],
        "action": trade["action"],
        "target": trade["target"],
        "stop_loss": trade["stop_loss"],
        "reasoning": trade["reasoning"],
        "conviction_score": str(trade["conviction_score"]),
        "ltp": trade["ltp"], 
        "cap": trade["cap"]
    }
    channel.basic_publish(
        exchange='',
        routing_key='trade_proposals',
        body=json.dumps(payload_dict)
    )

print("Test batch sent to Telegram! Check your phone.")
connection.close()
