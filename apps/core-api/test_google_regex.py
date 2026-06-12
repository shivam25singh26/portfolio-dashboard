import requests
import re

url = "https://www.google.com/finance/quote/HDFCBANK:NSE"
res = requests.get(url)

# The HTML usually contains a structured data block or a specific div for market cap
match = re.search(r'Market cap</div><div class="[^"]+">([^<]+)</div>', res.text)
if match:
    val = match.group(1)
    print(f"Market Cap string: {val}")
else:
    print("Market cap not found with regex")
