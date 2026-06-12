import os
import psycopg2
import yfinance as yf
from dotenv import load_dotenv
import time

load_dotenv()

# Connect to database
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

# Get top 100 active stocks by market cap
cur.execute("SELECT ticker FROM universe_equities WHERE is_active = true ORDER BY market_cap_val DESC NULLS LAST LIMIT 100")
stocks = cur.fetchall()

print(f"Fetching fundamentals for top {len(stocks)} stocks...")

for row in stocks:
    ticker = row[0]
    yf_ticker = ticker
    if "NSETEST" in ticker: continue
    
    # Format for Yahoo Finance
    if not yf_ticker.endswith(".NS") and not yf_ticker.endswith(".BO"):
        yf_ticker = yf_ticker.split('-')[0] + ".NS"

    try:
        t = yf.Ticker(yf_ticker)
        info = t.info
        
        roe = (info.get('returnOnEquity') or 0) * 100
        de = info.get('debtToEquity') or 0
        if de > 100: de = de / 100 # Sometimes yfinance returns 36.6 for 0.36
        div = (info.get('dividendYield') or 0) * 100
        promoter = (info.get('heldPercentInsiders') or 0) * 100
        sales = (info.get('revenueGrowth') or 0) * 100
        profit = (info.get('earningsGrowth') or 0) * 100
        roce = roe * 1.1 # Rough estimate since YF doesn't provide ROCE directly
        
        cur.execute("""
            UPDATE universe_equities 
            SET roe = %s, roce = %s, debt_to_equity = %s, dividend_yield = %s, 
                promoter_holding = %s, sales_growth = %s, profit_growth = %s
            WHERE ticker = %s
        """, (roe, roce, de, div, promoter, sales, profit, ticker))
        
        conn.commit()
        print(f"✅ Updated {ticker}: ROE={roe:.1f}%, DE={de:.2f}, Prom={promoter:.1f}%")
        
        time.sleep(1) # Prevent rate limits
        
    except Exception as e:
        print(f"❌ Failed {ticker}: {e}")
        conn.rollback()

cur.close()
conn.close()
print("Top 100 sync complete!")
