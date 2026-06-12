import os
import psycopg2
import yfinance as yf
from dotenv import load_dotenv
import time
import random

load_dotenv()

# Connect to database
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

# Get all 2100 active stocks
# We order by updated_at so we prioritize stocks that haven't been synced recently
cur.execute("SELECT ticker FROM universe_equities WHERE is_active = true ORDER BY market_cap_val DESC NULLS LAST")
stocks = cur.fetchall()

print(f"Starting background sync for all {len(stocks)} stocks...")

for idx, row in enumerate(stocks):
    ticker = row[0]
    yf_ticker = ticker
    
    # Skip test tickers
    if "NSETEST" in ticker: continue
    
    # Format for Yahoo Finance (add .NS for NSE)
    if not yf_ticker.endswith(".NS") and not yf_ticker.endswith(".BO"):
        yf_ticker = yf_ticker.split('-')[0] + ".NS"

    try:
        # Fetch data using yfinance
        t = yf.Ticker(yf_ticker)
        info = t.info
        
        # We only want to update if we actually got data (meaning we didn't get blocked)
        if not info or 'symbol' not in info:
            print(f"[{idx+1}/{len(stocks)}] ⚠️ No data for {ticker}, possibly rate limited. Sleeping...")
            time.sleep(10)
            continue
            
        roe = (info.get('returnOnEquity') or 0) * 100
        de = info.get('debtToEquity') or 0
        if de > 100: de = de / 100 # Adjust formatting bugs from Yahoo
        div = (info.get('dividendYield') or 0) * 100
        promoter = (info.get('heldPercentInsiders') or 0) * 100
        sales = (info.get('revenueGrowth') or 0) * 100
        profit = (info.get('earningsGrowth') or 0) * 100
        roce = roe * 1.1 # Estimate ROCE
        
        pe = info.get('trailingPE') or 0
        eps = info.get('trailingEps') or 0
        mcap = info.get('marketCap') or 0
        
        # Update the database
        cur.execute("""
            UPDATE universe_equities 
            SET roe = %s, roce = %s, debt_to_equity = %s, dividend_yield = %s, 
                promoter_holding = %s, sales_growth = %s, profit_growth = %s,
                trailing_pe = %s, eps = %s, market_cap_val = %s
            WHERE ticker = %s
        """, (roe, roce, de, div, promoter, sales, profit, pe, eps, mcap, ticker))
        
        conn.commit()
        print(f"[{idx+1}/{len(stocks)}] ✅ Synced {ticker}")
        
        # Sleep randomly between 1.5 to 3.5 seconds to avoid Yahoo blocking us
        time.sleep(random.uniform(1.5, 3.5))
        
    except Exception as e:
        print(f"[{idx+1}/{len(stocks)}] ❌ Failed {ticker}: {e}")
        conn.rollback()
        time.sleep(5) # Backoff on error

cur.close()
conn.close()
print("Complete Full Universe Sync!")
