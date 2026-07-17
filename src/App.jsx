import React, { useState, useRef } from 'react';
import ChartComponent from './ChartComponent';
import './index.css';

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeInterval, setTimeInterval] = useState('5m');
  const symbolInputRef = useRef(null);
  
  const handleSymbolSubmit = (e) => {
      e.preventDefault();
      if (symbolInputRef.current && symbolInputRef.current.value) {
          setSymbol(symbolInputRef.current.value.toUpperCase().trim());
      }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🤖 SuperTrend AI Clustering</h1>
          <p>Machine Learning Market Optimization</p>
        </div>
        <div className="controls">
          <form onSubmit={handleSymbolSubmit} style={{ display: 'inline-block' }}>
            <input 
              type="text" 
              defaultValue={symbol}
              ref={symbolInputRef}
              className="modern-select"
              placeholder="코인 심볼 (예: BTCUSDT)"
              style={{ width: '150px' }}
            />
            <button type="submit" className="modern-button" style={{ marginLeft: '5px' }}>검색</button>
          </form>
          <select 
            value={timeInterval} 
            onChange={(e) => setTimeInterval(e.target.value)}
            className="modern-select"
            style={{ marginLeft: '10px' }}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d (일봉)</option>
          </select>
        </div>
      </header>
      
      <main className="main-content">
        <div className="chart-wrapper">
          <ChartComponent key={symbol + timeInterval} symbol={symbol} interval={timeInterval} />
        </div>
        <div className="sidebar">
          <div className="panel">
            <h3>🧠 How it Works</h3>
            <ul className="rules-list">
              <li><strong>K-Means Clustering</strong>: Tests multiple SuperTrend configurations simultaneously and groups them to find the optimal 'Centroid'.</li>
              <li><strong>Confidence Score (0-10)</strong>: <br/><span className="badge high">7+ High</span> <span className="badge med">4-6 Med</span> <span className="badge low">0-3 Low</span></li>
              <li><strong>Dynamic Stop-Loss</strong>: The dashed orange line represents the most optimal trailing stop derived from the clusters.</li>
              <li><strong>Adaptive Moving Average (AMA)</strong>: The solid blue line. It reacts instantly during high confidence trends and flattens out during low confidence (chop).</li>
              <li><strong>Gradient Candles</strong>: Brighter colors indicate stronger cluster momentum; faded colors warn of exhaustion or chop.</li>
            </ul>
            
            <div className="alert-box">
              <strong>⚠️ Trading Rule:</strong> Do not blindly follow low-confidence (0-3) signals. Wait for structural breakouts if the score is low!
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
