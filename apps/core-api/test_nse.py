import urllib.request
import csv

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

nifty100 = fetch_index("https://niftyindices.com/IndexConstituent/ind_nifty100list.csv")
print(f"Fetched {len(nifty100)} from Nifty 100")

nifty_midcap150 = fetch_index("https://niftyindices.com/IndexConstituent/ind_niftymidcap150list.csv")
print(f"Fetched {len(nifty_midcap150)} from Nifty Midcap 150")

nifty_smallcap250 = fetch_index("https://niftyindices.com/IndexConstituent/ind_niftysmallcap250list.csv")
print(f"Fetched {len(nifty_smallcap250)} from Nifty Smallcap 250")
