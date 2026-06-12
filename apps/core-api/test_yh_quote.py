import requests
import json

url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=HDFCBANK.NS,TCS.NS"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

res = requests.get(url, headers=headers)
data = res.json()

if 'quoteResponse' in data and 'result' in data['quoteResponse']:
    for q in data['quoteResponse']['result']:
        print(f"{q.get('symbol')}: {q.get('marketCap')}")
else:
    print("Failed")
