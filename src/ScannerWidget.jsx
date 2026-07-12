import React, { useState, useEffect, useRef } from 'react';
import { Radar, ExternalLink, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { getTopVolumeSymbols, getScannerData } from './api';
import { analyzeData } from './ta';

export const ScannerWidget = ({ interval = '15m', onSelectSignal }) => {
  const [signals, setSignals] = useState([]);
  const [isScanning, setIsScanning] = useState(true);
  const [currentScan, setCurrentScan] = useState('');
  
  // Ref to hold the current queue to avoid stale closures
  const scanQueueRef = useRef({ binance: [], upbit: [] });
  const isRunningRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    // Clear signals when interval changes to avoid mixing timeframes
    if (mounted) {
      setSignals([]);
    }

    const initScanner = async () => {
      // Fetch top 30 volume symbols from both exchanges
      const bSymbols = await getTopVolumeSymbols('Binance', 30);
      const uSymbols = await getTopVolumeSymbols('Upbit', 30);
      
      if (mounted) {
        scanQueueRef.current = { binance: bSymbols, upbit: uSymbols };
        if (!isRunningRef.current) {
          runScanLoop();
        }
      }
    };

    const runScanLoop = async () => {
      isRunningRef.current = true;
      
      let bIndex = 0;
      let uIndex = 0;

      while (mounted && isScanning) {
        const { binance, upbit } = scanQueueRef.current;
        
        // If we ran out of symbols or didn't fetch them yet, wait and retry
        if (binance.length === 0 && upbit.length === 0) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        // Loop indices
        if (binance.length > 0 && bIndex >= binance.length) bIndex = 0;
        if (upbit.length > 0 && uIndex >= upbit.length) uIndex = 0;

        // Alternate scanning Binance and Upbit
        try {
          // --- Binance Scan ---
          if (binance.length > 0) {
            const bSymbol = binance[bIndex];
            if (mounted) setCurrentScan(`Binance: ${bSymbol}`);
            const bData = await getScannerData('Binance', bSymbol, interval);
            const bAnalysis = analyzeData(bData, 'Binance');
            
            if (bAnalysis && bAnalysis.type !== 'NEUTRAL') {
              bAnalysis.interval = interval;
              addSignal({
                id: `Binance-${bSymbol}-${Date.now()}`,
                exchange: 'Binance',
                symbol: bSymbol,
                type: bAnalysis.type,
                price: bAnalysis.currentPrice,
                reason: bAnalysis.setupReasons[0],
                fullAnalysis: bAnalysis,
                time: new Date()
              });
            }
            
            bIndex++;
            // Wait 1 second before next request to avoid rate limit
            await new Promise(r => setTimeout(r, 1000));
          }
          if (!mounted || !isScanning) break;

          // --- Upbit Scan ---
          if (upbit.length > 0) {
            const uSymbol = upbit[uIndex];
            if (mounted) setCurrentScan(`Upbit: ${uSymbol}`);
            const uData = await getScannerData('Upbit', uSymbol, interval);
            const uAnalysis = analyzeData(uData, 'Upbit');

            if (uAnalysis && uAnalysis.type !== 'NEUTRAL') {
              uAnalysis.interval = interval;
              addSignal({
                id: `Upbit-${uSymbol}-${Date.now()}`,
                exchange: 'Upbit',
                symbol: uSymbol,
                type: uAnalysis.type,
                price: uAnalysis.currentPrice,
                reason: uAnalysis.setupReasons[0],
                fullAnalysis: uAnalysis,
                time: new Date()
              });
            }

            uIndex++;
          }
          
          // Wait 1 second before next cycle
          await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
          console.error("Scanner Loop Error", error);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      isRunningRef.current = false;
    };

    initScanner();
    // Refresh top symbols every 15 minutes
    const refreshInterval = setInterval(initScanner, 15 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(refreshInterval);
    };
  }, [isScanning, interval]);

  const addSignal = (newSignal) => {
    setSignals(prev => {
      // Prevent exact duplicates in a short time frame
      const exists = prev.find(s => s.symbol === newSignal.symbol && s.exchange === newSignal.exchange && (newSignal.time - s.time) < 60000);
      if (exists) return prev;
      
      const updated = [newSignal, ...prev];
      return updated.slice(0, 10); // Keep top 10
    });
  };

  const binanceSignals = signals.filter(s => s.exchange === 'Binance');
  const upbitSignals = signals.filter(s => s.exchange === 'Upbit');

  return (
    <div className="scanner-ticker-bar">
      <div className="ticker-header">
        <Radar className={isScanning ? "radar-spin" : ""} size={20} color="var(--accent-color)" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>AI BuySell</span>
          <span className="scanner-status" style={{ fontSize: '0.65rem' }}>{currentScan || '대기 중...'}</span>
        </div>
        <button className="scanner-toggle" onClick={() => setIsScanning(!isScanning)} style={{ marginLeft: '4px' }}>
          {isScanning ? 'Stop' : 'Start'}
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px', overflow: 'hidden' }}>
        {/* Binance Row */}
        <div className="ticker-items-container">
          <span style={{ fontSize: '0.7rem', color: '#fcd535', fontWeight: 'bold', paddingRight: '8px', minWidth: '60px' }}>BINANCE</span>
          {binanceSignals.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{isScanning ? '스캔 중...' : '-'}</span>
          ) : (
            binanceSignals.map(s => (
              <div key={s.id} className={`ticker-item ${s.type.toLowerCase()}`} onClick={() => onSelectSignal(s)}>
                <span className="ticker-symbol">{s.symbol}</span>
                <span className={`signal-badge ${s.type.toLowerCase()}`} style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {s.type === 'LONG' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {s.type}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Upbit Row */}
        <div className="ticker-items-container">
          <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 'bold', paddingRight: '8px', minWidth: '60px' }}>UPBIT</span>
          {upbitSignals.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{isScanning ? '스캔 중...' : '-'}</span>
          ) : (
            upbitSignals.map(s => (
              <div key={s.id} className={`ticker-item ${s.type.toLowerCase()}`} onClick={() => onSelectSignal(s)}>
                <span className="ticker-symbol">{s.symbol}</span>
                <span className={`signal-badge ${s.type.toLowerCase()}`} style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {s.type === 'LONG' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {s.type}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
