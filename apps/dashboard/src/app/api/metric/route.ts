import { NextResponse } from 'next/server';

const cache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function isNonUSTicker(symbol: string): boolean {
  const parts = symbol.split('.');
  if (parts.length < 2) return false;
  const suffix = parts[parts.length - 1];
  return ['NS', 'BO', 'DE', 'PA', 'L', 'AS', 'SW', 'MI', 'MC', 'CO', 'BR'].includes(suffix);
}

async function fetchYahooMetric(symbol: string) {
  // Yahoo Finance doesn't have a direct "metric" endpoint like Finnhub,
  // but we can extract key stats from the chart metadata + summary endpoint.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const json = await res.json();
  
  const result = json?.chart?.result?.[0];
  if (!result) return { metric: {} };

  const closes = result.indicators?.quote?.[0]?.close?.filter((v: any) => v !== null) || [];
  const high52 = closes.length > 0 ? Math.max(...closes) : null;
  const low52 = closes.length > 0 ? Math.min(...closes) : null;
  const marketCap = result.meta?.marketCap || null;

  return {
    metric: {
      '52WeekHigh': high52,
      '52WeekLow': low52,
      marketCapitalization: marketCap ? marketCap / 1000000 : null, // Convert to millions to match Finnhub
    }
  };
}

async function fetchFinnhubMetric(symbol: string) {
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'd8dk13hr01qhm4afced0d8dk13hr01qhm4afcedg';
  const res = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_KEY}`);
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
      ? await fetchYahooMetric(symbol)
      : await fetchFinnhubMetric(symbol);
    
    cache.set(symbol, { timestamp: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch metric" }, { status: 500 });
  }
}
