import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';

export const ChartComponent = ({ data, signal, colors = {} }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  const sma20SeriesRef = useRef();
  const sma200SeriesRef = useRef();
  const rsiSeriesRef = useRef();
  const macdLineRef = useRef();
  const macdSignalRef = useRef();
  const macdHistRef = useRef();
  const priceLinesRef = useRef([]);

  // Overlay Refs for Trade Zones
  const overlayRef = useRef();
  const greenZoneRef = useRef();
  const redZoneRef = useRef();
  const tp1ZoneRef = useRef();
  const tp2ZoneRef = useRef();
  const tp3ZoneRef = useRef();

  const {
    backgroundColor = 'transparent',
    lineColor = '#2962FF',
    textColor = '#94a3b8',
    upColor = '#10b981',
    downColor = '#ef4444',
  } = colors;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: 'ko-KR',
        timeFormatter: (businessDayOrTimestamp) => {
          return new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).format(new Date(businessDayOrTimestamp * 1000));
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0, bottom: 0.35 }, // Candlesticks use top 65%
      },
    });

    chartRef.current = chart;

    // Determine dynamic price precision based on the asset's price
    const samplePrice = data && data.length > 0 ? data[data.length - 1].close : 1000;
    let precision = 2;
    let minMove = 0.01;
    
    if (samplePrice < 0.001) {
      precision = 6;
      minMove = 0.000001;
    } else if (samplePrice < 1) {
      precision = 5;
      minMove = 0.00001;
    } else if (samplePrice < 100) {
      precision = 4;
      minMove = 0.0001;
    } else if (samplePrice > 10000) {
      precision = 0;
      minMove = 1;
    }

    const priceFormatConfig = {
      type: 'price',
      precision: precision,
      minMove: minMove,
    };

    // Main Candlestick
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: upColor,
      downColor: downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceFormat: priceFormatConfig,
    });
    seriesRef.current = candlestickSeries;

    // EMA 20
    const sma20Series = chart.addLineSeries({
      color: '#fcd535', // Yellow
      lineWidth: 1,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      title: 'EMA(20)',
      priceFormat: priceFormatConfig,
    });
    sma20SeriesRef.current = sma20Series;

    // EMA 200
    const sma200Series = chart.addLineSeries({
      color: '#ef4444', // Red
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      title: 'EMA(200)',
      priceFormat: priceFormatConfig,
    });
    sma200SeriesRef.current = sma200Series;

    // RSI (Pane 2)
    const rsiSeries = chart.addLineSeries({
      color: '#a855f7', // Purple
      lineWidth: 1.5,
      priceScaleId: 'rsi',
      title: 'RSI(14)',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.65, bottom: 0.2 },
    });
    rsiSeriesRef.current = rsiSeries;

    // Draw RSI 70/30 bands
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(16, 185, 129, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted });

    // MACD (Pane 3)
    const macdHist = chart.addHistogramSeries({
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    const macdLine = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      priceScaleId: 'macd',
      title: 'MACD',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    const macdSignal = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 1,
      priceScaleId: 'macd',
      title: 'Signal',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    macdHistRef.current = macdHist;
    macdLineRef.current = macdLine;
    macdSignalRef.current = macdSignal;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [backgroundColor, lineColor, textColor, upColor, downColor]);

  // Handle Main Candlestick Data Updates
  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      seriesRef.current.setData(data);

      // Re-evaluate precision when switching assets
      const samplePrice = data[data.length - 1].close;
      let precision = 2;
      let minMove = 0.01;
      
      if (samplePrice < 0.001) {
        precision = 6;
        minMove = 0.000001;
      } else if (samplePrice < 1) {
        precision = 5;
        minMove = 0.00001;
      } else if (samplePrice < 100) {
        precision = 4;
        minMove = 0.0001;
      } else if (samplePrice > 10000) {
        precision = 0;
        minMove = 1;
      }

      const priceFormatConfig = { type: 'price', precision, minMove };

      seriesRef.current.applyOptions({ priceFormat: priceFormatConfig });
      if (sma20SeriesRef.current) sma20SeriesRef.current.applyOptions({ priceFormat: priceFormatConfig });
      if (sma200SeriesRef.current) sma200SeriesRef.current.applyOptions({ priceFormat: priceFormatConfig });
    }
  }, [data]);

  // Handle Signal Data Updates (Indicators & SR Lines)
  useEffect(() => {
    if (!seriesRef.current || !signal) return;

    if (signal.sma20Data && signal.sma20Data.length > 0 && sma20SeriesRef.current) {
      sma20SeriesRef.current.setData(signal.sma20Data);
    }
    if (signal.sma200Data && signal.sma200Data.length > 0 && sma200SeriesRef.current) {
      sma200SeriesRef.current.setData(signal.sma200Data);
    }
    if (signal.rsiData && signal.rsiData.length > 0 && rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(signal.rsiData);
    }
    if (signal.macdHistData && signal.macdHistData.length > 0 && macdHistRef.current) {
      macdHistRef.current.setData(signal.macdHistData);
    }
    if (signal.macdLineData && signal.macdLineData.length > 0 && macdLineRef.current) {
      macdLineRef.current.setData(signal.macdLineData);
    }
    if (signal.macdSignalData && signal.macdSignalData.length > 0 && macdSignalRef.current) {
      macdSignalRef.current.setData(signal.macdSignalData);
    }

    // Clear old price lines
    priceLinesRef.current.forEach(line => {
      try { seriesRef.current.removePriceLine(line); } catch(e){}
    });
    priceLinesRef.current = [];

    // Draw new SL and Entry lines across the chart
    if (signal.type !== 'NEUTRAL' && signal.tradePlan) {
      try {
        const entryLine = seriesRef.current.createPriceLine({
          price: signal.entry,
          color: '#3b82f6', // Blue
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry',
        });
        priceLinesRef.current.push(entryLine);

        const slLine = seriesRef.current.createPriceLine({
          price: signal.stopLoss,
          color: '#ef4444', // Red
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'SL',
        });
        priceLinesRef.current.push(slLine);
      } catch (err) {
        console.error("Failed to draw price lines", err);
      }
    }

    // Always draw current price if available in signal
    if (signal.currentPrice) {
      try {
        const currentPriceLine = seriesRef.current.createPriceLine({
          price: signal.currentPrice,
          color: '#ffffff', // White
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Current',
        });
        priceLinesRef.current.push(currentPriceLine);
      } catch (err) {}
    }

  }, [signal, data]);

  // Handle Trade Zone Overlay (Shaded Red/Green Boxes)
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !overlayRef.current || !greenZoneRef.current || !redZoneRef.current) return;

    if (!signal || signal.type === 'NEUTRAL' || !data || data.length === 0) {
      overlayRef.current.style.display = 'none';
      return;
    }

    const updateZones = () => {
      try {
        const entryY = seriesRef.current.priceToCoordinate(signal.entry);
        const slY = seriesRef.current.priceToCoordinate(signal.stopLoss);
        
        // We use TP3 (or max available TP) for the main green box
        const maxTpPrice = signal.tradePlan && signal.tradePlan.tp3 
          ? parseFloat(signal.tradePlan.tp3) 
          : signal.takeProfit;
        const tpY = seriesRef.current.priceToCoordinate(maxTpPrice);

        const tp1Y = seriesRef.current.priceToCoordinate(signal.takeProfit);
        const tp2Y = signal.tradePlan && signal.tradePlan.tp2 ? seriesRef.current.priceToCoordinate(parseFloat(signal.tradePlan.tp2)) : null;
        const tp3Y = signal.tradePlan && signal.tradePlan.tp3 ? seriesRef.current.priceToCoordinate(parseFloat(signal.tradePlan.tp3)) : null;
        
        const lastTime = data[data.length - 1].time;
        const startX = chartRef.current.timeScale().timeToCoordinate(lastTime);
        
        if (startX === null || entryY === null || slY === null || tpY === null) {
          overlayRef.current.style.display = 'none';
          return;
        }
        
        overlayRef.current.style.display = 'block';

        // Calculate width of 10 candles
        let candleWidth = 10;
        if (data.length >= 2) {
          const x1 = chartRef.current.timeScale().timeToCoordinate(data[data.length - 2].time);
          const x2 = chartRef.current.timeScale().timeToCoordinate(data[data.length - 1].time);
          if (x1 !== null && x2 !== null) {
            candleWidth = Math.max(2, x2 - x1);
          }
        }
        const boxWidth = candleWidth * 10;

        greenZoneRef.current.style.left = `${startX}px`;
        greenZoneRef.current.style.top = `${Math.min(entryY, tpY)}px`;
        greenZoneRef.current.style.width = `${boxWidth}px`;
        greenZoneRef.current.style.height = `${Math.abs(entryY - tpY)}px`;

        redZoneRef.current.style.left = `${startX}px`;
        redZoneRef.current.style.top = `${Math.min(entryY, slY)}px`;
        redZoneRef.current.style.width = `${boxWidth}px`;
        redZoneRef.current.style.height = `${Math.abs(entryY - slY)}px`;

        if (tp1ZoneRef.current) {
          if (tp1Y !== null) {
            tp1ZoneRef.current.style.display = 'block';
            tp1ZoneRef.current.style.left = `${startX}px`;
            tp1ZoneRef.current.style.top = `${tp1Y}px`;
            tp1ZoneRef.current.style.width = `${boxWidth}px`;
          } else tp1ZoneRef.current.style.display = 'none';
        }

        if (tp2ZoneRef.current) {
          if (tp2Y !== null) {
            tp2ZoneRef.current.style.display = 'block';
            tp2ZoneRef.current.style.left = `${startX}px`;
            tp2ZoneRef.current.style.top = `${tp2Y}px`;
            tp2ZoneRef.current.style.width = `${boxWidth}px`;
          } else tp2ZoneRef.current.style.display = 'none';
        }

        if (tp3ZoneRef.current) {
          if (tp3Y !== null) {
            tp3ZoneRef.current.style.display = 'block';
            tp3ZoneRef.current.style.left = `${startX}px`;
            tp3ZoneRef.current.style.top = `${tp3Y}px`;
            tp3ZoneRef.current.style.width = `${boxWidth}px`;
          } else tp3ZoneRef.current.style.display = 'none';
        }
      } catch (e) {
        // Ignore errors if coordinates aren't ready
      }
    };

    updateZones();
    // Re-run updateZones after a short delay to handle initial layout rendering
    const timer1 = setTimeout(updateZones, 50);
    const timer2 = setTimeout(updateZones, 200);
    const timer3 = setTimeout(updateZones, 500);

    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleTimeRangeChange(updateZones);
    timeScale.subscribeSizeChange(updateZones);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      timeScale.unsubscribeVisibleTimeRangeChange(updateZones);
      timeScale.unsubscribeSizeChange(updateZones);
    };
  }, [signal, data]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />
      <div ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'none', zIndex: 10 }}>
        <div ref={greenZoneRef} style={{ position: 'absolute', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.5)', borderLeft: 'none' }} />
        <div ref={redZoneRef} style={{ position: 'absolute', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderLeft: 'none' }} />
        
        {/* TP Lines inside the box */}
        <div ref={tp1ZoneRef} style={{ position: 'absolute', height: '1px', borderTop: '1px dashed rgba(16, 185, 129, 0.8)' }}>
          <span style={{ position: 'absolute', right: '-24px', top: '-7px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>TP1</span>
        </div>
        <div ref={tp2ZoneRef} style={{ position: 'absolute', height: '1px', borderTop: '1px dashed rgba(16, 185, 129, 0.8)' }}>
          <span style={{ position: 'absolute', right: '-24px', top: '-7px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>TP2</span>
        </div>
        <div ref={tp3ZoneRef} style={{ position: 'absolute', height: '1px', borderTop: '1px dashed rgba(16, 185, 129, 0.8)' }}>
          <span style={{ position: 'absolute', right: '-24px', top: '-7px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>TP3</span>
        </div>
      </div>
    </div>
  );
};
