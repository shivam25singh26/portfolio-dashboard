import requests
from bs4 import BeautifulSoup
import re

url = "https://www.google.com/finance/quote/HDFCBANK:NSE"
res = requests.get(url)
soup = BeautifulSoup(res.text, 'html.parser')

mcap_div = soup.find('div', string='Market cap')
if mcap_div:
    val_div = mcap_div.find_next_sibling('div')
    if val_div:
        val = val_div.text.strip()
        print(f"Market Cap string: {val}")
        
        # Convert "12.50T" to float
        multiplier = 1
        if 'T' in val: multiplier = 1000000000000
        elif 'B' in val: multiplier = 1000000000
        elif 'M' in val: multiplier = 1000000
        elif 'Cr' in val: multiplier = 10000000
        elif 'Lakh' in val: multiplier = 100000
        
        num = float(re.sub(r'[^0-9.]', '', val))
        print(f"Market Cap float: {num * multiplier}")
else:
    print("Market cap not found")
