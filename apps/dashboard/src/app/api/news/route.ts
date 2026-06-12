import { NextResponse } from 'next/server';

const cache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 mins

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'd8dk13hr01qhm4afced0d8dk13hr01qhm4afcedg';
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 14); // get news from past 14 days
    const from = fromDate.toISOString().split('T')[0];

    const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    const data = await res.json();
    
    // Finnhub can return massive arrays, we only need the top 5 recent news for the UI.
    const topNews = Array.isArray(data) ? data.slice(0, 5) : [];

    cache.set(symbol, { timestamp: Date.now(), data: topNews });
    return NextResponse.json(topNews);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
