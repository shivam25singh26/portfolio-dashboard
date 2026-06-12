import urllib.request
import csv
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def fetch_index(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        response = urllib.request.urlopen(req)
        lines = [l.decode('utf-8') for l in response.readlines()]
        reader = csv.DictReader(lines)
        return [row['Symbol'] for row in reader if 'Symbol' in row]
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return []

def apply_caps():
    print("Downloading Official NSE Indices...")
    large_caps = fetch_index("https://niftyindices.com/IndexConstituent/ind_nifty100list.csv")
    mid_caps = fetch_index("https://niftyindices.com/IndexConstituent/ind_niftymidcap150list.csv")
    small_caps = fetch_index("https://niftyindices.com/IndexConstituent/ind_niftysmallcap250list.csv")
    
    print(f"Applying caps: {len(large_caps)} Large, {len(mid_caps)} Mid, {len(small_caps)} Small")
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Reset everything to Micro Cap (by SEBI definition, anything outside Top 500 is Micro Cap)
    cur.execute("UPDATE universe_equities SET cap = 'Micro'")
    
    # 2. Update Small Caps (Top 251-500)
    if small_caps:
        cur.execute("UPDATE universe_equities SET cap = 'Small' WHERE ticker = ANY(%s)", (small_caps,))
        
    # 3. Update Mid Caps (Top 101-250)
    if mid_caps:
        cur.execute("UPDATE universe_equities SET cap = 'Mid' WHERE ticker = ANY(%s)", (mid_caps,))
        
    # 4. Update Large Caps (Top 1-100)
    if large_caps:
        cur.execute("UPDATE universe_equities SET cap = 'Large' WHERE ticker = ANY(%s)", (large_caps,))
        
    conn.commit()
    cur.close()
    conn.close()
    print("Successfully synchronized entire database with official NSE classifications!")

if __name__ == "__main__":
    apply_caps()
