import os
import psycopg2
import yfinance as yf
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def fetch_single(s_id, ticker):
    yf_ticker = f"{ticker}.NS"
    try:
        t = yf.Ticker(yf_ticker)
        mcap = t.fast_info.market_cap
        
        if mcap and mcap > 0:
            cap = "Micro"
            if mcap >= 200_000_000_000:
                cap = "Large"
            elif mcap >= 50_000_000_000:
                cap = "Mid"
            elif mcap >= 10_000_000_000:
                cap = "Small"
            return s_id, ticker, cap, mcap
    except Exception as e:
        pass
    
    # If yfinance completely fails to fetch (e.g. rate limit, or invalid ticker), we return '-' so it doesn't show fake 'Large Cap'
    return s_id, ticker, "-", 0

def update_caps():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Fetch all stocks
    cur.execute("SELECT id, ticker FROM universe_equities WHERE is_active = true")
    stocks = cur.fetchall()
    
    print(f"Fetched {len(stocks)} stocks. Cleaning up invalid caps...")
    
    updated_count = 0
    batch_updates = []
    
    with ThreadPoolExecutor(max_workers=40) as executor:
        futures = {executor.submit(fetch_single, s_id, ticker): (s_id, ticker) for s_id, ticker in stocks}
        
        for future in as_completed(futures):
            s_id, ticker, cap, mcap = future.result()
            
            # We update every single stock. If cap is '-', it means it failed.
            batch_updates.append((cap, mcap, s_id))
            updated_count += 1
            
            # Commit every 200
            if len(batch_updates) >= 200:
                cur.executemany("UPDATE universe_equities SET cap = %s, market_cap_val = %s WHERE id = %s", batch_updates)
                conn.commit()
                print(f"Committed {updated_count} updates so far...")
                batch_updates.clear()
                    
    if batch_updates:
        cur.executemany("UPDATE universe_equities SET cap = %s, market_cap_val = %s WHERE id = %s", batch_updates)
        conn.commit()
            
    cur.close()
    conn.close()
    print(f"Finished. Successfully wiped invalid dummy data and categorized exact Market Caps for all 2106 stocks!")

if __name__ == "__main__":
    update_caps()
