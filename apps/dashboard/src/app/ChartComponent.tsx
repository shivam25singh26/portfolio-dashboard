import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

export default function ChartComponent({ data, color, isMini }: { data: any, color?: string, isMini?: boolean }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      timeScale: {
        timeVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
    });

    // Formatting data for candlestick series
    // Finnhub candle data: { c: [...], h: [...], l: [...], o: [...], t: [...] }
    const candleData = [];
    if (data.t && data.t.length > 0) {
      for (let i = 0; i < data.t.length; i++) {
        // Finnhub occasionally returns null values for certain timestamps.
        // lightweight-charts strictly requires valid numbers, so we must filter them out.
        if (
          typeof data.c[i] === 'number' &&
          typeof data.o[i] === 'number' &&
          typeof data.h[i] === 'number' &&
          typeof data.l[i] === 'number'
        ) {
          candleData.push({
            time: data.t[i],
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          });
        }
      }
    }

    // @ts-ignore
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeries.setData(candleData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 0 });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, color]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '200px', marginTop: '16px' }} />;
}
