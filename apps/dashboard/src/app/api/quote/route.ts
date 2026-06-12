import { NextResponse } from 'next/server';

const cache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 mins

// Detect if a ticker belongs to a non-US exchange (contains a dot like .NS, .DE, .PA, .L)
function isNonUSTicker(symbol: string): boolean {
  // Tickers like RELIANCE.NS, SAP.DE, ASML.AS, BP.L etc.
  const parts = symbol.split('.');
  if (parts.length < 2) return false;
  const suffix = parts[parts.length - 1];
  return ['NS', 'BO', 'DE', 'PA', 'L', 'AS', 'SW', 'MI', 'MC', 'CO', 'BR'].includes(suffix);
}

// Fetch quote from Yahoo Finance (supports all global exchanges)
async function fetchYahooQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const json = await res.json();

  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) return { c: 0, h: 0, l: 0, o: 0, pc: 0, dp: 0, error: true };

  const price = meta.regularMarketPrice || 0;
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change = price - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;

  return {
    c: price,
    h: meta.regularMarketDayHigh || price,
    l: meta.regularMarketDayLow || price,
    o: meta.regularMarketOpen || price,
    pc: prevClose,
    d: parseFloat(change.toFixed(2)),
    dp: parseFloat(changePct.toFixed(2)),
  };
}

// Fetch quote from Finnhub (best for US stocks)
async function fetchFinnhubQuote(symbol: string) {
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'd8dk13hr01qhm4afced0d8dk13hr01qhm4afcedg';
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
  return await res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = isNonUSTicker(symbol)
      ? await fetchYahooQuote(symbol)
      : await fetchFinnhubQuote(symbol);
    
    cache.set(symbol, { timestamp: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}
