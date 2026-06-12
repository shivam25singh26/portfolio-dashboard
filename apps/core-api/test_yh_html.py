import requests
import re

url = "https://finance.yahoo.com/quote/HDFCBANK.NS"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
res = requests.get(url, headers=headers)

match = re.search(r'"marketCap":{"raw":([0-9.]+)', res.text)
if match:
    print("Market Cap:", match.group(1))
else:
    print("Failed to find in HTML")
