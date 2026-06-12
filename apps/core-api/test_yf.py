import yfinance as yf

ticker = yf.Ticker("RELIANCE.NS")
info = ticker.info

print("ROE:", info.get('returnOnEquity'))
print("Debt to Equity:", info.get('debtToEquity'))
print("Dividend Yield:", info.get('dividendYield'))
print("Promoter Holding:", info.get('heldPercentInsiders'))
print("Sales Growth:", info.get('revenueGrowth'))
print("Profit Growth:", info.get('earningsGrowth'))
