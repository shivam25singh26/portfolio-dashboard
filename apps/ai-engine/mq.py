import pika
import json
import logging
import os
from llm import run_stage1_screening, run_stage2_filter, run_stage3_validator

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def get_rabbitmq_connection():
    amqp_url = os.environ.get("AMQP_URL", "amqp://admin:password@localhost:5672/")
    parameters = pika.URLParameters(amqp_url)
    return pika.BlockingConnection(parameters)

def start_consuming():
    connection = get_rabbitmq_connection()
    channel = connection.channel()

    # Ensure queues exist
    channel.queue_declare(queue='market_scans', durable=True)
    channel.queue_declare(queue='trade_proposals', durable=True)

    def callback(ch, method, properties, body):
        logger.info(f"Received message on {method.routing_key}")
        data = json.loads(body)

        if method.routing_key == 'market_scans':
            try:
                # Determine if this is a crypto batch or NSE batch
                is_crypto = False
                if isinstance(data, dict) and data.get("type") == "crypto_scan_batch":
                    data = data.get("data", [])
                    is_crypto = True

                if not isinstance(data, list):
                    logger.error("Expected a list of stocks but got something else.")
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return

                symbol_map = {item.get("symbol"): item for item in data if item.get("symbol")}
                
                safe_batch = [item for item in data if item.get("cap") == "Large" or item.get("cap") == "Crypto"]
                risky_batch = [item for item in data if item.get("cap") != "Large" and item.get("cap") != "Crypto"]
                
                # Minify to save massive amounts of Groq TPM (Tokens Per Minute)
                safe_min = [{"s": x.get("symbol"), "p": x.get("ltp")} for x in safe_batch]
                risky_min = [{"s": x.get("symbol"), "p": x.get("ltp")} for x in risky_batch]
                
                def clean_json(text):
                    start = text.find('[')
                    end = text.rfind(']')
                    if start != -1 and end != -1 and end > start:
                        return text[start:end+1]
                    return text

                logger.info(f"Starting Stage 1: Screener (Llama 8B) - is_crypto: {is_crypto}")
                context_safe = "Crypto 15m/1h / High Volatility" if is_crypto else "Large Cap / Safe"
                safe_proposals_json = run_stage1_screening(safe_min, context_safe, 10)
                
                risky_proposals_json = "[]"
                if len(risky_min) > 0:
                    risky_proposals_json = run_stage1_screening(risky_min, "Mid & Small Cap / Risky", 10)
                
                try:
                    safe_list = json.loads(clean_json(safe_proposals_json))
                except Exception as e:
                    logger.error(f"Safe parse failed: {e}. Raw: {safe_proposals_json}")
                    safe_list = []
                try:
                    risky_list = json.loads(clean_json(risky_proposals_json))
                except Exception as e:
                    logger.error(f"Risky parse failed: {e}. Raw: {risky_proposals_json}")
                    risky_list = []

                logger.info("Starting Stage 2: Filter (Qwen 32B)")
                try:
                    safe_filtered_json = run_stage2_filter(json.dumps(safe_list), count=2)
                    safe_filtered_list = json.loads(clean_json(safe_filtered_json))
                except Exception:
                    safe_filtered_list = safe_list[:2]
                    
                try:
                    risky_filtered_json = run_stage2_filter(json.dumps(risky_list), count=3)
                    risky_filtered_list = json.loads(clean_json(risky_filtered_json))
                except Exception:
                    risky_filtered_list = risky_list[:3]

                all_filtered_proposals = json.dumps(safe_filtered_list + risky_filtered_list)
                
                logger.info("Starting Stage 3: Validator (Llama 70B)")
                final_trades_json = run_stage3_validator(all_filtered_proposals)
                
                logger.info("AI Pipeline Complete! Publishing final trades...")
                
                # Publish the truncate_db event to clear the Postgres table before inserting new batch
                ch.basic_publish(
                    exchange='',
                    routing_key='trade_proposals',
                    body=json.dumps({"type": "truncate_db"})
                )
                
                ch.basic_publish(
                    exchange='',
                    routing_key='telegram_broadcast',
                    body=json.dumps({"type": "truncate_db"})
                )

                try:
                    final_trades = json.loads(clean_json(final_trades_json))
                except Exception as e:
                    logger.error(f"Failed to parse final JSON from LLM: {e}")
                    final_trades = []

                telegram_trades = []
                for trade in final_trades:
                    sym = trade.get("symbol")
                    if not sym:
                        continue
                        
                    matched_sym = None
                    for k in symbol_map.keys():
                        if sym in k:
                            matched_sym = k
                            break
                            
                    if matched_sym:
                        payload_dict = {
                            "type": "stage1_result", 
                            "symbol": matched_sym,
                            "action": trade.get("action", "LONG"),
                            "target": trade.get("target", 0.0),
                            "stop_loss": trade.get("stop_loss", 0.0),
                            "reasoning": trade.get("reasoning", ""),
                            "conviction_score": str(trade.get("conviction_score", "")),
                            "ltp": symbol_map[matched_sym].get("ltp", 0.0), 
                            "cap": symbol_map[matched_sym].get("cap", "Unknown"),
                            "exchange": "BINANCE" if is_crypto else "NSE"
                        }
                        
                        ch.basic_publish(
                            exchange='',
                            routing_key='trade_proposals',
                            body=json.dumps(payload_dict)
                        )
                        telegram_trades.append(payload_dict)
                        logger.info(f"Published Stage 1 proposal for {matched_sym} to DB queue")
                
                # Send the entire batch to the telegram_broadcast queue
                ch.basic_publish(
                    exchange='',
                    routing_key='telegram_broadcast',
                    body=json.dumps({"type": "telegram_batch", "trades": telegram_trades})
                )
            except Exception as e:
                logger.error(f"LLM API Error during Stage 1 Batch Screening: {e}")

        elif method.routing_key == 'trade_proposals':
            # In a real scenario, this would be listening for Stage 2 triggers from the Go webhook
            # For now, this is a placeholder
            pass

        ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(queue='market_scans', on_message_callback=callback)
    
    logger.info("Python AI Engine is now listening to RabbitMQ...")
    channel.start_consuming()

if __name__ == "__main__":
    start_consuming()
