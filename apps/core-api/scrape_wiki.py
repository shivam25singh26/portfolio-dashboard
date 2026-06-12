import requests
from bs4 import BeautifulSoup
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def scrape_nifty50():
    url = "https://en.wikipedia.org/wiki/NIFTY_50"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # Find the constituents table
    table = soup.find('table', {'id': 'constituents'})
    tickers = []
    
    if table:
        for row in table.find_all('tr')[1:]:
            cols = row.find_all('td')
            if len(cols) > 1:
                ticker = cols[1].text.strip()
                tickers.append(ticker)
                
    return tickers

def scrape_nifty_next_50():
    url = "https://en.wikipedia.org/wiki/NIFTY_Next_50"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    table = soup.find('table', {'id': 'constituents'})
    tickers = []
    if table:
        for row in table.find_all('tr')[1:]:
            cols = row.find_all('td')
            if len(cols) > 2:
                ticker = cols[2].text.strip() # usually the 3rd col is ticker in next 50
                tickers.append(ticker)
                
    return tickers

def update_db():
    nifty50 = scrape_nifty50()
    next50 = scrape_nifty_next_50()
    
    large_caps = set(nifty50 + next50)
    print(f"Found {len(large_caps)} Large Cap stocks from Wikipedia.")
    print("Sample:", list(large_caps)[:5])
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    for ticker in large_caps:
        # Some wikipedia tickers have .NS, some don't. We just use the raw symbol
        clean_ticker = ticker.replace('.NS', '')
        cur.execute("UPDATE universe_equities SET cap = 'Large' WHERE ticker = %s", (clean_ticker,))
        
    conn.commit()
    print("Updated large caps!")
    
update_db()
