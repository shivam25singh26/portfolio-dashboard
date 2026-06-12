import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries } from 'lightweight-charts';

export default function ChartComponent({ data, type = 'candlestick', color, isMini }: { data: any, type?: 'candlestick' | 'area', color?: string, isMini?: boolean }) {
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

    // Formatting data for series
    const chartData = [];
    
    // Support Finnhub format: { c: [...], h: [...], l: [...], o: [...], t: [...] }
    if (data && data.t && Array.isArray(data.t)) {
      for (let i = 0; i < data.t.length; i++) {
        if (typeof data.c[i] === 'number') {
          chartData.push({
            time: data.t[i],
            value: type === 'area' ? data.c[i] : undefined,
            open: type === 'candlestick' ? data.o[i] : undefined,
            high: type === 'candlestick' ? data.h[i] : undefined,
            low: type === 'candlestick' ? data.l[i] : undefined,
            close: type === 'candlestick' ? data.c[i] : undefined,
          });
        }
      }
    } 
    // Support Array format: [{t, o, h, l, c, value}]
    else if (Array.isArray(data)) {
      data.forEach(d => {
        chartData.push({
          time: d.t || d.time,
          value: type === 'area' ? (d.value || d.c) : undefined,
          open: type === 'candlestick' ? d.o : undefined,
          high: type === 'candlestick' ? d.h : undefined,
          low: type === 'candlestick' ? d.l : undefined,
          close: type === 'candlestick' ? d.c : undefined,
        });
      });
    }

    let series: any;
    if (type === 'area') {
      series = chart.addSeries(AreaSeries, {
        lineColor: color || '#2962FF',
        topColor: color ? `${color}40` : '#2962FF40',
        bottomColor: color ? `${color}00` : '#2962FF00',
        lineWidth: 2,
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    }

    series.setData(chartData);
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
