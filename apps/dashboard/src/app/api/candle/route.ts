import { NextResponse } from 'next/server';

const cache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function isNonUSTicker(symbol: string): boolean {
  const parts = symbol.split('.');
  if (parts.length < 2) return false;
  const suffix = parts[parts.length - 1];
  return ['NS', 'BO', 'DE', 'PA', 'L', 'AS', 'SW', 'MI', 'MC', 'CO', 'BR'].includes(suffix);
}

async function fetchYahooCandle(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const json = await res.json();

  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) return { s: 'no_data' };

  const q = result.indicators?.quote?.[0];
  if (!q) return { s: 'no_data' };

  return {
    s: 'ok',
    t: result.timestamp,
    o: q.open,
    h: q.high,
    l: q.low,
    c: q.close,
    v: q.volume,
  };
}

async function fetchFinnhubCandle(symbol: string) {
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'd8dk13hr01qhm4afced0d8dk13hr01qhm4afcedg';
  const to = Math.floor(Date.now() / 1000);
  const from = to - (180 * 24 * 60 * 60); // 6 months
  const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
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
      ? await fetchYahooCandle(symbol)
      : await fetchFinnhubCandle(symbol);
    
    cache.set(symbol, { timestamp: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch candle" }, { status: 500 });
  }
}
