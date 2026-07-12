import { RSI, MACD, SMA, EMA, BollingerBands, CCI } from 'technicalindicators';

export const analyzeData = (data, exchange = 'Binance') => {
  if (!data || data.length < 60) return null;

  const formatPrice = (p) => {
    if (p < 0.001) return p.toFixed(6);
    if (p < 1) return p.toFixed(5);
    if (p < 100) return p.toFixed(4);
    if (p < 1000) return p.toFixed(2);
    return p.toFixed(0);
  };

  // Extract closes and highs/lows
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  // Calculate Indicators safely
  let rsiResult = [];
  try { rsiResult = RSI.calculate({ values: closes, period: 14 }); } catch(e){}
  
  let macdResult = [];
  try {
    macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
  } catch(e){}

  const currentPrice = closes[closes.length - 1];
  const currentRsi = rsiResult.length > 0 ? rsiResult[rsiResult.length - 1] : 50;
  const prevRsi = rsiResult.length > 1 ? rsiResult[rsiResult.length - 2] : 50;
  const currentMacd = macdResult.length > 0 ? macdResult[macdResult.length - 1] : { histogram: 0, MACD: 0, signal: 0 };
  const prevMacd = macdResult.length > 1 ? macdResult[macdResult.length - 2] : { histogram: 0, MACD: 0, signal: 0 };

  // Pivot Points (Classic)
  const prevHigh = highs[highs.length - 2] || currentPrice;
  const prevLow = lows[lows.length - 2] || currentPrice;
  const prevClose = closes[closes.length - 2] || currentPrice;
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const r1 = (2 * pivot) - prevLow;
  const r2 = pivot + (prevHigh - prevLow);
  const s1 = (2 * pivot) - prevHigh;
  const s2 = pivot - (prevHigh - prevLow);

  // Divergence Detection (Look back 20 candles)
  const recentCloses = closes.slice(-21, -1);
  const recentRsis = rsiResult.slice(-21, -1);
  
  const lowestRecentClose = Math.min(...recentCloses);
  const lowestRecentCloseIdx = recentCloses.indexOf(lowestRecentClose);
  const rsiAtLowestClose = recentRsis[lowestRecentCloseIdx] || 50;

  const highestRecentClose = Math.max(...recentCloses);
  const highestRecentCloseIdx = recentCloses.indexOf(highestRecentClose);
  const rsiAtHighestClose = recentRsis[highestRecentCloseIdx] || 50;

  const bullishDivergence = currentPrice <= lowestRecentClose * 1.0005 && currentRsi > rsiAtLowestClose + 2 && currentRsi < 45;
  const bearishDivergence = currentPrice >= highestRecentClose * 0.9995 && currentRsi < rsiAtHighestClose - 2 && currentRsi > 55;

  let ema20Result = [];
  try { ema20Result = EMA.calculate({ values: closes, period: 20 }); } catch(e){}

  let ema200Result = [];
  try { ema200Result = EMA.calculate({ values: closes, period: 200 }); } catch(e){}

  let bbResult = [];
  try { bbResult = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 }); } catch(e){}

  let cciResult = [];
  try { cciResult = CCI.calculate({ high: highs, low: lows, close: closes, period: 20 }); } catch(e){}

  // Calculate volume SMA for volume spike detection
  const volumes = data.map(d => d.volume || 0);
  let volSmaResult = [];
  try { volSmaResult = SMA.calculate({ values: volumes, period: 20 }); } catch(e){}

  const currentEma20 = ema20Result.length > 0 ? ema20Result[ema20Result.length - 1] : currentPrice;
  const currentEma200 = ema200Result.length > 0 ? ema200Result[ema200Result.length - 1] : currentPrice;
  const currentBB = bbResult.length > 0 ? bbResult[bbResult.length - 1] : { lower: currentPrice, upper: currentPrice, middle: currentPrice };
  const currentCci = cciResult.length > 0 ? cciResult[cciResult.length - 1] : 0;
  
  const currentVol = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
  const currentVolSma = volSmaResult.length > 0 ? volSmaResult[volSmaResult.length - 1] : 0;
  const volSpike = currentVol > currentVolSma * 1.5;

  // MACD Crosses
  const macdBullCross = prevMacd.histogram <= 0 && currentMacd.histogram > 0;
  const macdBearCross = prevMacd.histogram >= 0 && currentMacd.histogram < 0;

  let longCount = 0;
  let shortCount = 0;
  const longReasons = [];
  const shortReasons = [];

  // 1. RSI Divergence
  if (bullishDivergence) {
    longCount++;
    longReasons.push(`[RSI 다이버전스] 가격 신저점 불구 RSI 저점 상승 (상승 반전 신호)`);
  }
  if (bearishDivergence) {
    shortCount++;
    shortReasons.push(`[RSI 다이버전스] 가격 신고점 불구 RSI 고점 하락 (하락 반전 신호)`);
  }

  // 2. MACD Cross
  if (macdBullCross) {
    longCount++;
    longReasons.push(`[MACD] 히스토그램 양수 전환 (단기 매수 모멘텀 발생)`);
  }
  if (macdBearCross) {
    shortCount++;
    shortReasons.push(`[MACD] 히스토그램 음수 전환 (단기 매도 모멘텀 발생)`);
  }

  // 3. EMA (20, 200)
  if (currentEma20 > currentEma200 && currentPrice > currentEma20) {
    longCount++;
    longReasons.push(`[EMA] 20선이 200선 위에 위치하며 가격이 20선 지지 (정배열 상승세)`);
  }
  if (currentEma20 < currentEma200 && currentPrice < currentEma20) {
    shortCount++;
    shortReasons.push(`[EMA] 20선이 200선 아래에 위치하며 가격이 20선 저항 (역배열 하락세)`);
  }

  // 4. Bollinger Bands
  if (currentPrice <= currentBB.lower * 1.002) {
    longCount++;
    longReasons.push(`[볼린저 밴드] 가격이 하단 밴드에 근접하거나 이탈 (과매도/반등 가능성)`);
  }
  if (currentPrice >= currentBB.upper * 0.998) {
    shortCount++;
    shortReasons.push(`[볼린저 밴드] 가격이 상단 밴드에 근접하거나 돌파 (과매수/하락 가능성)`);
  }

  // 5. CCI
  if (currentCci < -100) {
    longCount++;
    longReasons.push(`[CCI] -100 미만으로 과매도 구간 진입`);
  }
  if (currentCci > 100) {
    shortCount++;
    shortReasons.push(`[CCI] 100 초과로 과매수 구간 진입`);
  }

  // 6. RSI Absolute
  if (currentRsi < 30) {
    longCount++;
    longReasons.push(`[RSI] 수치가 30 미만으로 과매도 구간`);
  }
  if (currentRsi > 70) {
    shortCount++;
    shortReasons.push(`[RSI] 수치가 70 초과로 과매수 구간`);
  }

  // Volume 가산점
  if (longCount > 0 && volSpike) {
    longCount += 0.5;
    longReasons.push(`[Volume] 평균 대비 1.5배 이상의 강한 매수 거래량 동반`);
  }
  if (shortCount > 0 && volSpike) {
    shortCount += 0.5;
    shortReasons.push(`[Volume] 평균 대비 1.5배 이상의 강한 매도 거래량 동반`);
  }

  let tempType = 'NEUTRAL';
  if (longCount >= 2) {
    tempType = 'LONG';
  } else if (shortCount >= 2) {
    if (exchange === 'Upbit') {
      tempType = 'NEUTRAL'; // Force neutral for Upbit short signals
    } else {
      tempType = 'SHORT';
    }
  }

  // Calculate Entry, TP, SL based on Recent Swing High/Low
  let entry = currentPrice;
  let takeProfit, stopLoss, tp1, tp2, tp3;
  const entrySpread = 0.001; // 0.1% entry range

  // Find 20-candle swing high/low for dynamic SL placement
  const lookback = 20;
  // Filter out glitch candles (where body is virtually zero, typical of 0-volume anomalies on stablecoins)
  let recentDataForSl = data.slice(-lookback).filter(d => Math.abs(d.close - d.open) / currentPrice > 0.00001);
  if (recentDataForSl.length === 0) recentDataForSl = data.slice(-lookback);

  const swingLow = Math.min(...recentDataForSl.map(d => d.low));
  const swingHigh = Math.max(...recentDataForSl.map(d => d.high));
  const range = swingHigh - swingLow;
  
  // Padding is 20% of the 20-candle range (or a very small fallback if range is 0)
  const padding = range > 0 ? range * 0.2 : currentPrice * 0.001;

  if (tempType === 'LONG') {
    // SL: Recent 20-candle low minus padding
    stopLoss = swingLow - padding;
    
    // Risk is simply the distance from Entry to SL
    let risk = entry - stopLoss;
    if (risk <= 0) risk = currentPrice * 0.001; // Fallback
    
    tp1 = entry + risk * 1.5; // 1:1.5 RR
    tp2 = entry + risk * 2.5; // 1:2.5 RR
    tp3 = entry + risk * 4.0; // 1:4.0 RR
  } else if (tempType === 'SHORT') {
    // SL: Recent 20-candle high plus padding
    stopLoss = swingHigh + padding;
    
    let risk = stopLoss - entry;
    if (risk <= 0) risk = currentPrice * 0.001; // Fallback
    
    tp1 = entry - risk * 1.5;
    tp2 = entry - risk * 2.5;
    tp3 = entry - risk * 4.0;
  } else {
    entry = currentPrice;
    tp1 = currentPrice;
    tp2 = currentPrice;
    tp3 = currentPrice;
    stopLoss = currentPrice;
  }
  
  takeProfit = tp1;

  let type = tempType;
  let setupReasons = [];
  let indicatorsList = [];

  // Generate Strings using the properly clamped TP/SL values
  if (type === 'LONG') {
    setupReasons = [...longReasons];
    setupReasons.push(`진입가 ${formatPrice(currentPrice)}에서 TP1(${formatPrice(tp1)}) 도달 시 수익 실현을 권장합니다.`);
    indicatorsList = [`RSI: ${currentRsi.toFixed(1)}`, `CCI: ${currentCci.toFixed(0)}`, `Score: ${Math.floor(longCount)}`];
  } else if (type === 'SHORT') {
    setupReasons = [...shortReasons];
    setupReasons.push(`진입가 ${formatPrice(currentPrice)}에서 TP1(${formatPrice(tp1)}) 도달 시 수익 실현을 권장합니다.`);
    indicatorsList = [`RSI: ${currentRsi.toFixed(1)}`, `CCI: ${currentCci.toFixed(0)}`, `Score: ${Math.floor(shortCount)}`];
  } else {
    if (shortCount >= 2 && exchange === 'Upbit') {
      setupReasons = [
        ...shortReasons,
        `⚠️ 하락(SHORT) 시그널 조건이 충족되었으나, 업비트는 현물 거래(Spot)만 지원하므로 공매도가 불가능합니다.`,
        `신규 진입을 피하고 관망을 권장합니다.`
      ];
      indicatorsList = [`RSI: ${currentRsi.toFixed(1)}`, `CCI: ${currentCci.toFixed(0)}`, `Score: ${Math.floor(shortCount)}`];
    } else {
      setupReasons = [
        `현재 상승/하락을 지지하는 지표가 2개 미만입니다. (현재 LONG 점수: ${Math.floor(longCount)}, SHORT 점수: ${Math.floor(shortCount)})`,
        `방향성이 뚜렷하지 않은 횡보 구간이므로 관망을 권장합니다.`
      ];
      indicatorsList = [`RSI: ${currentRsi.toFixed(1)}`, 'Neutral'];
    }
  }

  let tradePlan = null;
  if (type !== 'NEUTRAL') {
    tradePlan = {
      entryRange: `${formatPrice(entry * (1 - entrySpread))} – ${formatPrice(entry * (1 + entrySpread))}`,
      sl: formatPrice(stopLoss),
      tp1: formatPrice(tp1),
      tp2: formatPrice(tp2),
      tp3: formatPrice(tp3)
    };
  }

  // Align data for charting
  const alignData = (resultArr) => {
    if (!resultArr || resultArr.length === 0) return [];
    return data.slice(data.length - resultArr.length).map((d, i) => ({
      time: d.time,
      value: resultArr[i]
    }));
  };

  const sma20Data = alignData(ema20Result);
  const sma200Data = alignData(ema200Result);
  
  const rsiData = alignData(rsiResult);

  // For MACD, we need an object: { time, macd, signal, histogram }
  // lightweight-charts handles single value per series. We must split them.
  const macdAligned = rsiResult.length > 0 ? data.slice(data.length - macdResult.length) : [];
  const macdLineData = [];
  const macdSignalData = [];
  const macdHistData = [];
  
  macdResult.forEach((m, i) => {
    if (m.MACD !== undefined) {
      macdLineData.push({ time: macdAligned[i].time, value: m.MACD });
      macdSignalData.push({ time: macdAligned[i].time, value: m.signal });
      macdHistData.push({ 
        time: macdAligned[i].time, 
        value: m.histogram,
        color: m.histogram >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
      });
    }
  });

  return {
    type,
    entry,
    takeProfit,
    stopLoss,
    currentPrice,
    indicators: indicatorsList,
    setupReasons,
    tradePlan,
    support: [s1, s2],
    resistance: [r1, r2],
    sma20Data,
    sma200Data,
    rsiData,
    macdLineData,
    macdSignalData,
    macdHistData
  };
};
