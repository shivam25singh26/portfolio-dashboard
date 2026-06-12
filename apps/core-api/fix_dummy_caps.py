import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def fix_caps():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("UPDATE universe_equities SET cap = 'Large' WHERE market_cap_val >= 200000000000 AND cap = '-'")
    cur.execute("UPDATE universe_equities SET cap = 'Mid' WHERE market_cap_val >= 50000000000 AND market_cap_val < 200000000000 AND cap = '-'")
    cur.execute("UPDATE universe_equities SET cap = 'Small' WHERE market_cap_val >= 10000000000 AND market_cap_val < 50000000000 AND cap = '-'")
    cur.execute("UPDATE universe_equities SET cap = 'Micro' WHERE market_cap_val < 10000000000 AND cap = '-'")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Successfully restored visual dummy caps for remaining stocks!")

if __name__ == "__main__":
    fix_caps()
