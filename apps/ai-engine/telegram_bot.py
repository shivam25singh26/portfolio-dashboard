import os
import json
import logging
import asyncio
import aio_pika
import subprocess
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ForceReply
from telegram.ext import ApplicationBuilder, Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from groq import Groq
from llm import get_stage1_llm

load_dotenv()

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_USER_ID = os.getenv("TELEGRAM_USER_ID")

if not TELEGRAM_TOKEN or not TELEGRAM_USER_ID:
    logger.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_USER_ID in .env")
    exit(1)

TELEGRAM_USER_ID = int(TELEGRAM_USER_ID)

# State to prevent spamming
seen_symbols = set()

# Initialize Groq client for Whisper
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_json_from_llm(text: str) -> dict:
    """Helper to parse Llama output into JSON safely, avoiding arbitrary python dictionaries."""
    try:
        # If it parses directly, check if it has 'action'
        parsed = json.loads(text.strip())
        if isinstance(parsed, dict) and "action" in parsed:
            return parsed
    except Exception:
        pass
        
    import re
    # Find all possible JSON-like blocks
    matches = re.finditer(r'\{[^{}]*"action"[^{}]*\}', text, re.IGNORECASE)
    for match in matches:
        try:
            return json.loads(match.group(0))
        except:
            continue
            
    # Fallback to standard bracket matching but ensure we skip python dicts
    start = text.find('{"action"')
    if start == -1:
        start = text.find('{\n  "action"')
        
    if start != -1:
        stack = 0
        end = -1
        for i in range(start, len(text)):
            if text[i] == '{':
                stack += 1
            elif text[i] == '}':
                stack -= 1
                if stack == 0:
                    end = i + 1
                    break
        if end != -1:
            try:
                return json.loads(text[start:end])
            except Exception as e:
                logger.error(f"Failed to parse LLM JSON: {e}")
                
    return {}


async def rabbitmq_consumer(app):
    """Background task to consume from RabbitMQ and broadcast to Telegram"""
    # Connect to RabbitMQ using environment variable or fallback
    amqp_url = os.environ.get("AMQP_URL", "amqp://admin:password@localhost:5672/")
    connection = await aio_pika.connect_robust(amqp_url)
    channel = await connection.channel()
    
    # Listen for broadcasts
    queue = await channel.declare_queue('telegram_broadcast', durable=True)
    
    # We also need to be able to publish order_requests
    publish_channel = await connection.channel()
    await publish_channel.declare_queue('order_requests', durable=True)
    
    # Store publish channel in app bot_data so handlers can use it
    app.bot_data['mq_channel'] = publish_channel

    logger.info("Telegram Bot is listening to RabbitMQ 'telegram_broadcast' queue...")

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                try:
                    payload = json.loads(message.body.decode())
                    msg_type = payload.get("type")

                    if msg_type == "truncate_db":
                        # A new hourly batch has arrived, clear the cache so we can broadcast new trades
                        # for symbols that were traded in the past
                        seen_symbols.clear()
                        continue

                    elif msg_type == "telegram_batch":
                        trades = payload.get("trades", [])
                        new_trades = []
                        
                        for trade in trades:
                            symbol = trade.get("symbol")
                            if symbol and symbol not in seen_symbols:
                                new_trades.append(trade)
                                seen_symbols.add(symbol)
                                
                        if new_trades:
                            # We have new trades to broadcast!
                            text = "🚨 **New AI Trade Proposals** 🚨\n\n"
                            buttons = []
                            
                            for t in new_trades:
                                sym = t.get("symbol")
                                cap = t.get("cap")
                                ltp = t.get("ltp")
                                action = t.get("action", "LONG")
                                target = t.get("target", "N/A")
                                sl = t.get("stop_loss", "N/A")
                                reason = t.get("reasoning", "")
                                conviction = t.get("conviction_score", "N/A")
                                
                                emoji = "🟢" if action == "LONG" else "🔴"
                                text += f"{emoji} **{action} {sym}** ({cap})\n"
                                text += f"💰 LTP: ₹{ltp}\n"
                                text += f"🎯 Target: ₹{target} | 🛑 SL: ₹{sl}\n"
                                text += f"📊 Conviction: {conviction}/100\n"
                                text += f"📝 {reason}\n\n"
                                
                                # Add buy/short button based on action
                                action_btn = "Buy" if action == "LONG" else "Short"
                                buttons.append([InlineKeyboardButton(f"✅ {action_btn} {sym}", callback_data=f"execute_{sym}")])
                                
                            reply_markup = InlineKeyboardMarkup(buttons)
                            await app.bot.send_message(
                                chat_id=TELEGRAM_USER_ID, 
                                text=text, 
                                parse_mode='Markdown',
                                reply_markup=reply_markup
                            )
                        else:
                            # The AI Engine intentionally dropped all trades because they didn't meet the 85% conviction bar
                            await app.bot.send_message(
                                chat_id=TELEGRAM_USER_ID,
                                text="🤖 *Market Scan Complete*\n\nNo high conviction setups (>85%) found at this time. Staying flat.",
                                parse_mode="Markdown"
                            )

                    elif msg_type == "notification":
                        await app.bot.send_message(
                            chat_id=TELEGRAM_USER_ID,
                            text=payload.get("message", "Notification received"),
                            parse_mode="Markdown"
                        )
                except Exception as e:
                    logger.error(f"Error processing broadcast message: {e}")


async def auth_check(update: Update) -> bool:
    """Security check to ensure only the owner can interact"""
    user_id = update.effective_user.id
    if user_id != TELEGRAM_USER_ID:
        logger.warning(f"Unauthorized access attempt from User ID: {user_id}")
        return False
    return True


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await auth_check(update): return
    await update.message.reply_text("🤖 Antigravity Voice Trading Bot Online.\nWaiting for AI Signals...")


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await auth_check(update): return
    query = update.callback_query
    await query.answer()

    data = query.data
    if data.startswith("execute_"):
        symbol = data.split("_")[1]
        # Force reply to ask for quantity and price
        await query.message.reply_text(
            f"Reply with Quantity and Limit Price for {symbol} (e.g. '50 1050.25')",
            reply_markup=ForceReply(selective=True)
        )


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await auth_check(update): return
    
    # Check if this is a reply to a ForceReply message
    if update.message.reply_to_message:
        original_text = update.message.reply_to_message.text
        if "Reply with Quantity and Limit Price for" in original_text:
            symbol = original_text.split("for ")[1].split(" (")[0]
            parts = update.message.text.strip().split()
            
            if len(parts) != 2:
                await update.message.reply_text("❌ Please enter exactly two numbers: Quantity and Limit Price (e.g., '50 1050.25')")
                return
                
            try:
                qty = int(parts[0])
                limit_price = float(parts[1])
                
                # Publish to RabbitMQ
                mq_channel = context.bot_data.get('mq_channel')
                if mq_channel:
                    payload = json.dumps({"symbol": symbol, "quantity": qty, "price": limit_price, "action": "BUY"})
                    await mq_channel.default_exchange.publish(
                        aio_pika.Message(body=payload.encode()),
                        routing_key='order_requests'
                    )
                    await update.message.reply_text(f"✅ Order Request sent to Go Gateway:\n**BUY {qty} {symbol} @ ₹{limit_price}**", parse_mode="Markdown")
                else:
                    await update.message.reply_text("❌ Internal Error: MQ Channel not found.")
            except ValueError:
                await update.message.reply_text("❌ Invalid format. Please enter numbers like '50 1050.25'.")


async def voice_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await auth_check(update): return
    
    msg = await update.message.reply_text("🎙 Processing voice note...")
    
    try:
        # Download the voice note
        voice_file = await update.message.voice.get_file()
        ogg_path = "voice_note.ogg"
        mp3_path = "voice_note.mp3"
        
        await voice_file.download_to_drive(ogg_path)
        
        # Convert to mp3 using ffmpeg
        subprocess.run(["ffmpeg", "-y", "-i", ogg_path, mp3_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Transcribe with Groq Whisper
        with open(mp3_path, "rb") as file:
            transcription = groq_client.audio.transcriptions.create(
                file=(mp3_path, file.read()),
                model="whisper-large-v3-turbo",
            )
        
        transcript_text = transcription.text.replace("<", "").replace(">", "")
        await msg.edit_text(f"📝 <b>Transcript:</b>\n<i>{transcript_text}</i>\n\n🧠 Parsing intent...", parse_mode="HTML")
        
        # Use Stage 1 LLM to extract JSON intent
        llm = get_stage1_llm()
        prompt = f"""
        You are a trading assistant. Extract the intent from the following voice transcription.
        Available symbols (example): RELIANCE-EQ, AXISBANK-EQ, SBIN-EQ, TATAMOTORS-EQ, etc.
        You must return a JSON object with 'action' (BUY/SELL), 'symbol' (e.g. AXISBANK-EQ), 'quantity' (integer), and 'limit_price' (float).
        If the symbol doesn't end in -EQ but is a stock, add -EQ.
        If no price is explicitly stated, do your best to infer it, or set it to 0.0.
        
        Transcription: "{transcript_text}"
        
        Return ONLY valid JSON. Example: {{"action": "BUY", "symbol": "RELIANCE-EQ", "quantity": 100, "limit_price": 2900.50}}
        """
        result = llm.invoke(prompt)
        logger.info(f"Raw LLM Output: {result.content}")
        intent = extract_json_from_llm(result.content)
        
        if not intent or "symbol" not in intent or "quantity" not in intent or "limit_price" not in intent:
            logger.error(f"Failed to parse or missing keys. Extracted dict: {intent}")
            await msg.edit_text(f"❌ Could not extract valid trade intent from:\n<i>{transcript_text}</i>\n\n(Check Terminal 3 logs for details)", parse_mode="HTML")
            return
            
        symbol = intent["symbol"]
        qty = intent["quantity"]
        limit_price = intent["limit_price"]
        action = intent.get("action", "BUY")
        
        # Publish to RabbitMQ
        mq_channel = context.bot_data.get('mq_channel')
        if mq_channel:
            payload = json.dumps({"symbol": symbol, "quantity": qty, "price": limit_price, "action": action})
            await mq_channel.default_exchange.publish(
                aio_pika.Message(body=payload.encode()),
                routing_key='order_requests'
            )
            await msg.edit_text(f"✅ Voice Order Sent to Go Gateway:\n<b>{action} {qty} {symbol} @ ₹{limit_price}</b>", parse_mode="HTML")
            
    except Exception as e:
        logger.error(f"Voice processing error: {e}")
        await msg.edit_text(f"❌ Failed to process voice note: {str(e)}")


async def post_init(app: Application):
    # Start RabbitMQ consumer in background task
    asyncio.create_task(rabbitmq_consumer(app))


last_scan_time = 0

async def scan_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global last_scan_time
    if not await auth_check(update): return
    
    current_time = asyncio.get_event_loop().time()
    if current_time - last_scan_time < 30:
        await update.message.reply_text("⏳ Please wait 30 seconds between scans.")
        return
        
    last_scan_time = current_time
    await update.message.reply_text("🔎 Triggering Live Market Scan...\n(This will take ~15 seconds to run through the 3-stage AI funnel)")
    import requests
    try:
        requests.get("http://localhost:8080/api/trigger-scan")
    except Exception as e:
        await update.message.reply_text(f"❌ Failed to trigger Go Gateway: {e}")

async def manual_scan_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dedicated /manual_scan command for on-demand market scanning from Telegram."""
    global last_scan_time
    if not await auth_check(update): return
    current_time = asyncio.get_event_loop().time()
    if current_time - last_scan_time < 30:
        await update.message.reply_text("⏳ Please wait 30 seconds between scans.")
        return
    last_scan_time = current_time
    await update.message.reply_text("🔎 Manual scan triggered...\n(This will take ~15 seconds to run through the 3-stage AI funnel)")
    import requests
    try:
        requests.get("http://localhost:8080/api/trigger-scan")
    except Exception as e:
        await update.message.reply_text(f"❌ Failed to trigger Go Gateway: {e}")

if __name__ == '__main__':
    application = ApplicationBuilder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    application.add_handler(CommandHandler('start', start))
    application.add_handler(CommandHandler('scan', scan_handler))
    application.add_handler(CommandHandler('manual_scan', manual_scan_handler))
    application.add_handler(CallbackQueryHandler(button_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    application.add_handler(MessageHandler(filters.VOICE, voice_handler))

    logger.info("Starting Telegram Bot Polling...")
    application.run_polling()
