import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Connect to database
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

columns = [
    "roe",
    "roce",
    "debt_to_equity",
    "dividend_yield",
    "promoter_holding",
    "sales_growth",
    "profit_growth"
]

for col in columns:
    try:
        cur.execute(f"ALTER TABLE universe_equities ADD COLUMN IF NOT EXISTS {col} double precision DEFAULT 0")
        print(f"Added {col}")
    except Exception as e:
        print(f"Error adding {col}: {e}")
        conn.rollback()
    else:
        conn.commit()

cur.close()
conn.close()
print("Done adding columns.")
