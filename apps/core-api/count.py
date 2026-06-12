import os, psycopg2
from dotenv import load_dotenv

load_dotenv()
conn=psycopg2.connect(os.getenv('DATABASE_URL'))
cur=conn.cursor()
cur.execute('SELECT COUNT(*) FROM universe_equities WHERE roe != 0')
print(cur.fetchone()[0])
