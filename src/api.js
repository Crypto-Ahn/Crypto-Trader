import axios from 'axios';

export const getBinanceSymbols = async () => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    return response.data.symbols
      .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map(s => s.symbol);
  } catch (error) {
    console.error('Binance Symbols Error:', error);
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
  }
};

export const getUpbitSymbols = async () => {
  try {
    const response = await axios.get('https://api.upbit.com/v1/market/all');
    return response.data
      .filter(m => m.market.startsWith('KRW-'))
      .map(m => {
        // Convert KRW-BTC to BTCKRW
        const parts = m.market.split('-');
        return parts[1] + parts[0];
      });
  } catch (error) {
    console.error('Upbit Symbols Error:', error);
    return ['BTCKRW', 'ETHKRW', 'XRPKRW', 'SOLKRW', 'DOGEKRW'];
  }
};

// Binance API
export const getBinanceData = async (symbol = 'BTCUSDT', interval = '1h', limit = 3000) => {
  try {
    let binanceInterval = interval;
    // Map granular intervals
    if (interval === '1m') binanceInterval = '1m';
    if (interval === '5m') binanceInterval = '5m';
    if (interval === '15m') binanceInterval = '15m';
    if (interval === '30m') binanceInterval = '30m';
    if (interval === '1h') binanceInterval = '1h';
    if (interval === '4h') binanceInterval = '4h';
    if (interval === '1d') binanceInterval = '1d';
    if (interval === '1w') binanceInterval = '1w';

    let allData = [];
    let endTime = null;
    const requestsNeeded = Math.ceil(limit / 1000);

    for (let i = 0; i < requestsNeeded; i++) {
      const params = {
        symbol,
        interval: binanceInterval,
        limit: 1000
      };
      if (endTime) {
        params.endTime = endTime;
      }

      const response = await axios.get('https://api.binance.com/api/v3/klines', { params });
      const klines = response.data;
      if (!klines || klines.length === 0) break;

      allData = klines.concat(allData);
      endTime = klines[0][0] - 1;

      if (i < requestsNeeded - 1) {
        await new Promise(r => setTimeout(r, 100)); // Rate limit safety
      }
    }

    if (allData.length > limit) {
      allData = allData.slice(allData.length - limit);
    }

    return allData.map(d => ({
      time: Math.floor(d[0] / 1000),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));
  } catch (error) {
    console.error("Binance API Error:", error);
    return [];
  }
};

// Upbit API
export const getUpbitData = async (symbol = 'BTCKRW', interval = '60', limit = 1000) => {
  try {
    // Convert user-facing BTCKRW back to Upbit API format KRW-BTC
    let apiSymbol = symbol;
    if (symbol.endsWith('KRW')) {
      apiSymbol = `KRW-${symbol.replace('KRW', '')}`;
    }

    let baseUrl = '';
    if (interval === 'days' || interval === '1d') {
      baseUrl = `https://api.upbit.com/v1/candles/days?market=${apiSymbol}`;
    } else if (interval === 'weeks' || interval === '1w') {
      baseUrl = `https://api.upbit.com/v1/candles/weeks?market=${apiSymbol}`;
    } else {
      baseUrl = `https://api.upbit.com/v1/candles/minutes/${interval}?market=${apiSymbol}`;
    }
    
    let allData = [];
    let to = '';
    const requestsNeeded = Math.ceil(limit / 200);

    for (let i = 0; i < requestsNeeded; i++) {
      let url = `${baseUrl}&count=200`;
      if (to) {
        url += `&to=${to}`;
      }

      const response = await axios.get(url);
      const data = response.data;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);

      const oldestCandle = data[data.length - 1];
      to = oldestCandle.candle_date_time_utc + 'Z';

      if (i < requestsNeeded - 1) {
        await new Promise(r => setTimeout(r, 100)); // Rate limit safety
      }
    }

    allData = allData.slice(0, limit);
    
    // Upbit returns data in reverse chronological order (newest first), so we need to reverse it.
    const formattedData = allData.map(d => ({
      time: Math.floor(new Date(d.candle_date_time_utc + 'Z').getTime() / 1000),
      open: d.opening_price,
      high: d.high_price,
      low: d.low_price,
      close: d.trade_price,
      volume: d.candle_acc_trade_volume
    })).reverse();

    return formattedData;
  } catch (error) {
    console.error('Upbit API Error:', error);
    throw error;
  }
};

// ------------------------------------------
// Scanner Specific APIs
// ------------------------------------------

export const getTopVolumeSymbols = async (exchange, count = 50) => {
  try {
    if (exchange === 'Binance') {
      const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
      const usdtPairs = res.data.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('DOWN') && !t.symbol.includes('UP'));
      usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      return usdtPairs.slice(0, count).map(t => t.symbol);
    } else {
      const symbols = await getUpbitSymbols();
      const markets = symbols.map(s => `KRW-${s.replace('KRW', '')}`).join(',');
      const res = await axios.get(`https://api.upbit.com/v1/ticker?markets=${markets}`);
      res.data.sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h);
      return res.data.slice(0, count).map(t => {
        const parts = t.market.split('-');
        return parts[1] + parts[0]; // BTCKRW
      });
    }
  } catch (error) {
    console.error(`${exchange} Top Symbols Error:`, error);
    return [];
  }
};

// Fast fetcher for scanner (only 200 candles, no pagination)
export const getScannerData = async (exchange, symbol, interval = '1m') => {
  try {
    if (exchange === 'Binance') {
      const res = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit: 200 }
      });
      return res.data.map(d => ({
        time: Math.floor(d[0] / 1000),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));
    } else {
      let apiSymbol = `KRW-${symbol.replace('KRW', '')}`;
      let upbitInterval = '1';
      if (interval === '5m') upbitInterval = '5';
      if (interval === '15m') upbitInterval = '15';
      if (interval === '1h') upbitInterval = '60';
      if (interval === '4h') upbitInterval = '240';
      
      let url = `https://api.upbit.com/v1/candles/minutes/${upbitInterval}?market=${apiSymbol}&count=200`;
      if (interval === '1d') url = `https://api.upbit.com/v1/candles/days?market=${apiSymbol}&count=200`;
      
      const res = await axios.get(url);
      return res.data.map(d => ({
        time: Math.floor(new Date(d.candle_date_time_utc + 'Z').getTime() / 1000),
        open: d.opening_price,
        high: d.high_price,
        low: d.low_price,
        close: d.trade_price,
        volume: d.candle_acc_trade_volume
      })).reverse();
    }
  } catch (error) {
    // Silently fail for scanner to avoid console spam
    return [];
  }
};
