import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import axios from 'axios';
import { calculateAISuperTrend } from './ta';

const ChartComponent = ({ symbol = 'BTCUSDT', interval = '5m' }) => {
    const chartContainerRef = useRef();
    const chartRef = useRef();
    const candleSeriesRef = useRef();
    const amaSeriesRef = useRef();
    const stopLossSeriesRef = useRef();

    const [stats, setStats] = useState(null);

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ 
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 500,
            layout: {
                background: { type: 'solid', color: '#0b0e14' },
                textColor: '#d1d4dc',
            },
            localization: {
                timeFormatter: (time) => {
                    if (typeof time === 'string') return time;
                    const date = new Date(time * 1000);
                    return new Intl.DateTimeFormat('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    }).format(date);
                }
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                tickMarkFormatter: (time, tickMarkType, locale) => {
                    const date = new Date(time * 1000);
                    return new Intl.DateTimeFormat('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        hour: '2-digit', minute: '2-digit',
                        day: '2-digit', month: 'short'
                    }).format(date);
                }
            },
        });
        
        chartRef.current = chart;

        const candleSeries = chart.addCandlestickSeries({
            borderVisible: false,
            wickVisible: true,
        });
        candleSeriesRef.current = candleSeries;

        const stopLossSeries = chart.addLineSeries({
            color: '#ff9800',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            title: 'Dynamic SL (Cluster Best)'
        });
        stopLossSeriesRef.current = stopLossSeries;

        const amaSeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            title: 'Trailing AMA'
        });
        amaSeriesRef.current = amaSeries;

        window.addEventListener('resize', handleResize);

        const fetchData = async () => {
            try {
                // Fetch Klines from Binance
                const res = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`);
                
                // Determine if we need to pass a string or unix timestamp to lightweight-charts
                // for 1d interval, lightweight charts expects a specific time format or 00:00 UTC timestamp.
                // We will just use unix timestamps for everything and let our KST formatter handle it.
                const klines = res.data.map(d => ({
                    time: d[0] / 1000,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4])
                }));

                // Calculate AI SuperTrend
                const aiResult = calculateAISuperTrend(klines);
                const { data: aiData, ama } = aiResult;
                
                const formattedCandles = [];
                const formattedAMA = [];
                const formattedSL = [];
                const markers = [];
                
                let currentTrend = 0;
                let confSum = 0;
                let validPoints = 0;

                for (let i = 0; i < klines.length; i++) {
                    const candle = klines[i];
                    const aiInfo = aiData[i];
                    
                    // Base Colors
                    let color = candle.close >= candle.open ? '#26a69a' : '#ef5350';
                    let wickColor = color;
                    
                    if (aiInfo) {
                        const { trend, confidence, isSignal, value } = aiInfo;
                        
                        // Gradient colors based on confidence (0-10)
                        // Bullish (trend == 1): green to dark green
                        // Bearish (trend == -1): red to dark red
                        const alpha = Math.max(0.2, confidence / 10);
                        color = trend === 1 
                            ? `rgba(38, 166, 154, ${alpha})` 
                            : `rgba(239, 83, 80, ${alpha})`;
                            
                        wickColor = trend === 1 ? '#26a69a' : '#ef5350';
                        
                        // Signal Markers
                        if (isSignal && trend !== currentTrend) {
                            markers.push({
                                time: candle.time,
                                position: trend === 1 ? 'belowBar' : 'aboveBar',
                                color: trend === 1 ? '#26a69a' : '#ef5350',
                                shape: trend === 1 ? 'arrowUp' : 'arrowDown',
                                text: `Signal [${confidence}/10]`
                            });
                            currentTrend = trend;
                        }
                        
                        formattedSL.push({ time: candle.time, value: value });
                        
                        confSum += confidence;
                        validPoints++;
                    }

                    formattedCandles.push({
                        time: candle.time,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        color,
                        wickColor
                    });
                    
                    if (ama[i]) {
                        formattedAMA.push({ time: candle.time, value: ama[i] });
                    }
                }

                candleSeries.setData(formattedCandles);
                amaSeries.setData(formattedAMA);
                stopLossSeries.setData(formattedSL);
                candleSeries.setMarkers(markers);
                
                setStats({
                    avgConfidence: validPoints > 0 ? (confSum / validPoints).toFixed(1) : 0,
                    totalSignals: markers.length
                });

            } catch (err) {
                console.error("Error fetching or processing data:", err);
            }
        };

        fetchData();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol, interval]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div ref={chartContainerRef} style={{ flex: 1, minHeight: '600px' }} />
            {stats && (
                <div style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    zIndex: 10,
                    background: 'rgba(19, 23, 34, 0.8)',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    backdropFilter: 'blur(4px)'
                }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#2962FF' }}>AI Cluster Stats</h3>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div>Avg Confidence: <strong style={{color: stats.avgConfidence > 5 ? '#26a69a' : '#ef5350'}}>{stats.avgConfidence} / 10</strong></div>
                        <div>Total Signals: <strong>{stats.totalSignals}</strong></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartComponent;
