import { NextResponse } from 'next/server';
import { NseIndia } from 'stock-nse-india';

const nse = new NseIndia();
const cache: { timestamp: number, data: string[] } = { timestamp: 0, data: [] };
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  if (cache.data.length > 0 && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json({ symbols: cache.data });
  }

  try {
    const data = await nse.getEquityStockIndices('SECURITIES IN F&O');
    if (data?.data) {
      const symbols = data.data.map((d: any) => d.symbol);
      cache.data = symbols;
      cache.timestamp = Date.now();
      return NextResponse.json({ symbols });
    }
    return NextResponse.json({ symbols: [] });
  } catch (err: any) {
    console.error('Failed to fetch FO symbols:', err.message);
    return NextResponse.json({ error: 'Failed to fetch FO symbols' }, { status: 500 });
  }
}
