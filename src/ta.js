import { kmeans } from 'ml-kmeans';

/**
 * SuperTrend AI Clustering Logic
 * Inspired by LuxAlgo
 */

export function calculateATR(klines, period) {
    const atr = [];
    for (let i = 0; i < klines.length; i++) {
        if (i === 0) {
            atr.push(klines[i].high - klines[i].low);
            continue;
        }
        const high = klines[i].high;
        const low = klines[i].low;
        const prevClose = klines[i - 1].close;
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        atr.push((atr[i - 1] * (period - 1) + tr) / period);
    }
    return atr;
}

export function calculateSuperTrend(klines, atrPeriod, multiplier) {
    const atr = calculateATR(klines, atrPeriod);
    const supertrend = [];
    
    let upperBand = 0;
    let lowerBand = 0;
    let trend = 1; // 1 for Uptrend, -1 for Downtrend
    let trendValue = 0;

    for (let i = 0; i < klines.length; i++) {
        const hl2 = (klines[i].high + klines[i].low) / 2;
        const basicUpperBand = hl2 + multiplier * atr[i];
        const basicLowerBand = hl2 - multiplier * atr[i];

        if (i === 0) {
            upperBand = basicUpperBand;
            lowerBand = basicLowerBand;
            trendValue = lowerBand;
            supertrend.push({ value: trendValue, trend });
            continue;
        }

        const prevClose = klines[i - 1].close;
        
        upperBand = (basicUpperBand < upperBand || prevClose > upperBand) ? basicUpperBand : upperBand;
        lowerBand = (basicLowerBand > lowerBand || prevClose < lowerBand) ? basicLowerBand : lowerBand;

        if (trend === 1 && klines[i].close < lowerBand) trend = -1;
        if (trend === -1 && klines[i].close > upperBand) trend = 1;

        trendValue = trend === 1 ? lowerBand : upperBand;
        supertrend.push({ value: trendValue, trend });
    }
    
    return supertrend;
}

export function calculateAISuperTrend(klines, numClusters = 3) {
    // Generate permutations of SuperTrend
    // (A typical LuxAlgo script might test ATRs from 10 to 20 and Factors from 1.0 to 4.0)
    // To keep JS performant, we'll test a representative sample:
    const atrs = [10, 14, 20];
    const factors = [1.5, 2.0, 3.0, 4.0];
    
    const permutations = [];
    
    for (const a of atrs) {
        for (const f of factors) {
            permutations.push(calculateSuperTrend(klines, a, f));
        }
    }
    
    const numPermutations = permutations.length;
    const aiSuperTrend = [];
    
    for (let i = 0; i < klines.length; i++) {
        if (i < 20) {
             // Not enough data for stable clustering
             aiSuperTrend.push(null);
             continue;
        }
        
        // Extract values for this candle across all permutations
        const candleData = [];
        let bullishCount = 0;
        let bearishCount = 0;
        
        for (let p = 0; p < numPermutations; p++) {
            const val = permutations[p][i].value;
            const dir = permutations[p][i].trend;
            candleData.push([val]); // ml-kmeans expects 2D array
            if (dir === 1) bullishCount++;
            else bearishCount++;
        }
        
        try {
            // Apply K-Means
            let result;
            try {
                result = kmeans(candleData, numClusters);
            } catch (kErr) {
                // ml-kmeans can throw if there are fewer unique points than k
                // In this case, just use k=1 or fallback
                result = kmeans(candleData, 1);
            }
            
            // Identify Best, Avg, Worst clusters based on density/variance
            const actualClusters = result.centroids.length;
            const clusterCounts = Array(actualClusters).fill(0);
            result.clusters.forEach(c => clusterCounts[c]++);
            
            let bestClusterIdx = 0;
            let maxCount = -1;
            for (let c = 0; c < actualClusters; c++) {
                if (clusterCounts[c] > maxCount) {
                    maxCount = clusterCounts[c];
                    bestClusterIdx = c;
                }
            }
            
            const bestCentroid = result.centroids[bestClusterIdx];
            const bestCentroidValue = Array.isArray(bestCentroid) ? bestCentroid[0] : bestCentroid.centroid[0];
            
            // Confidence Score (0 to 10)
            const dominantDirection = bullishCount > bearishCount ? 1 : -1;
            const dominantPercentage = Math.max(bullishCount, bearishCount) / numPermutations;
            const confidenceScore = Math.round(dominantPercentage * 10);
            
            aiSuperTrend.push({
                value: bestCentroidValue,
                trend: dominantDirection,
                confidence: confidenceScore,
                isSignal: i > 0 && (permutations[0][i].trend !== permutations[0][i-1].trend) // Simplify signal detection
            });
            
        } catch (err) {
            console.error("AI SuperTrend Error at index", i, err);
            aiSuperTrend.push(null);
        }
    }
    
    // Smooth the confidence for AMA (Adaptive Moving Average)
    let ama = [];
    let currentAMA = klines[0].close;
    
    for (let i = 0; i < klines.length; i++) {
        if (!aiSuperTrend[i]) {
            ama.push(currentAMA);
            continue;
        }
        
        const close = klines[i].close;
        const confidence = aiSuperTrend[i].confidence; // 0 to 10
        
        // Dynamic smoothing: high confidence = fast reaction, low confidence = slow reaction
        const smoothing = Math.max(0.05, (confidence / 10) * 0.3); 
        currentAMA = currentAMA + smoothing * (close - currentAMA);
        ama.push(currentAMA);
    }
    
    return {
        data: aiSuperTrend,
        ama: ama
    };
}
