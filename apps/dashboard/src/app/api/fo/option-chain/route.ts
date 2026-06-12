import { NextResponse } from 'next/server';
import { NseIndia } from 'stock-nse-india';

const nse = new NseIndia();
const cache = new Map<string, { timestamp: number; data: any }>();
const CACHE_DURATION_MS = 3 * 60 * 1000; // 3 min cache

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'NIFTY';
  const type = searchParams.get('type') || 'index';

  const cacheKey = `oc-${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const isIndex = type === 'index';
    const rawData: any = isIndex
      ? await nse.getIndexOptionChain(symbol)
      : await nse.getEquityOptionChain(symbol);

    let records: any[] = [];
    let expiryDates: string[] = [];
    let underlyingValue = 0;
    let strikePrices: number[] = [];
    let timestamp = new Date().toISOString();

    if (isIndex && rawData?.records) {
      records = rawData.records.data || [];
      expiryDates = rawData.records.expiryDates || [];
      underlyingValue = rawData.records.underlyingValue || rawData.records.data?.[0]?.PE?.underlyingValue || 0;
      strikePrices = rawData.records.strikePrices || [];
      timestamp = rawData.records.timestamp || timestamp;
      
      records = records.map((r: any) => ({
        strikePrice: r.strikePrice,
        expiryDate: r.expiryDate || r.expiryDates || r.CE?.expiryDate || r.PE?.expiryDate,
        CE: r.CE ? {
          oi: r.CE.openInterest || 0,
          changeInOI: r.CE.changeinOpenInterest || 0,
          volume: r.CE.totalTradedVolume || 0,
          iv: r.CE.impliedVolatility || 0,
          ltp: r.CE.lastPrice || 0,
          change: r.CE.change || 0,
          bidPrice: r.CE.bidprice || 0,
          askPrice: r.CE.askPrice || 0,
        } : null,
        PE: r.PE ? {
          oi: r.PE.openInterest || 0,
          changeInOI: r.PE.changeinOpenInterest || 0,
          volume: r.PE.totalTradedVolume || 0,
          iv: r.PE.impliedVolatility || 0,
          ltp: r.PE.lastPrice || 0,
          change: r.PE.change || 0,
          bidPrice: r.PE.bidprice || 0,
          askPrice: r.PE.askPrice || 0,
        } : null,
      }));
    } else if (!isIndex && rawData?.data) {
      // Equity returns a flat array in data.data
      const flatData = rawData.data;
      timestamp = rawData.timestamp || timestamp;
      
      // Get underlying value from first record
      underlyingValue = flatData.find((d: any) => d.underlyingValue)?.underlyingValue || 0;
      
      // Extract unique expiries
      const expSet = new Set<string>();
      flatData.forEach((d: any) => { if (d.expiryDate) expSet.add(d.expiryDate); });
      expiryDates = Array.from(expSet).sort();
      
      // Group by strike and expiry
      const grouped = new Map<string, any>();
      const strikesSet = new Set<number>();
      
      flatData.filter((d: any) => d.instrumentType?.startsWith('OPT')).forEach((d: any) => {
        const strike = parseFloat(d.strikePrice);
        if (isNaN(strike)) return;
        strikesSet.add(strike);
        
        const key = `${strike}_${d.expiryDate}`;
        if (!grouped.has(key)) {
          grouped.set(key, { strikePrice: strike, expiryDate: d.expiryDate, CE: null, PE: null });
        }
        
        const row = grouped.get(key);
        const optData = {
          oi: d.openInterest || 0,
          changeInOI: d.changeinOpenInterest || 0,
          volume: d.totalTradedVolume || 0,
          iv: d.impliedVolatility || 0,
          ltp: d.lastPrice || 0,
          change: d.change || 0,
          bidPrice: d.buyPrice1 || 0,
          askPrice: d.sellPrice1 || 0,
        };
        
        if (d.optionType === 'CE') row.CE = optData;
        if (d.optionType === 'PE') row.PE = optData;
      });
      
      records = Array.from(grouped.values());
      strikePrices = Array.from(strikesSet).sort((a, b) => a - b);
    }

    const processed = {
      symbol,
      underlyingValue,
      expiryDates,
      strikePrices,
      timestamp,
      data: records,
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: processed });
    return NextResponse.json(processed);
  } catch (err: any) {
    console.error('Option chain fetch error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch option chain from NSE', details: err.message }, { status: 502 });
  }
}
