import {moonPhase, ENGINE_VERSION, EPHEMERIS} from '@zodiacs/engine';
import {DAY, mean} from './core.mjs';

export const engineReceipt = {engine: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: EPHEMERIS};
export const TA_NAMES = ['logReturn1', 'logReturn7', 'logReturn30', 'sma20Gap', 'sma50Gap', 'returnStd20', 'rsi14Centered', 'logVolume20'];
export const ASTRO_NAMES = ['lunarSin', 'lunarCos', 'nearNewMoon', 'nearFullMoon'];

export function lunarFeatures(cutoff) {
  const phase = moonPhase(new Date(cutoff * 1000));
  if (!(phase.angle >= 0 && phase.angle < 360)) throw new Error('Invalid pinned-engine lunar phase');
  const radians = phase.angle * Math.PI / 180;
  return {
    lunarSin: Math.sin(radians), lunarCos: Math.cos(radians),
    nearNewMoon: Number(Math.min(phase.angle, 360 - phase.angle) <= 12),
    nearFullMoon: Number(Math.abs(phase.angle - 180) <= 12),
  };
}

/** Feature bar t closes at cutoff, and only bar t+1 contributes to its target. */
export function buildRows(candles, phaseAt = lunarFeatures) {
  const rows = [];
  let segmentStart = 0;
  let averageGain = 0;
  let averageLoss = 0;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];
    if (i === 0 || bar.time !== candles[i - 1].time + DAY) {
      segmentStart = i;
      averageGain = averageLoss = gainSum = lossSum = 0;
    }
    const offset = i - segmentStart;
    if (offset > 0) {
      const change = bar.close - candles[i - 1].close;
      const gain = Math.max(change, 0);
      const loss = Math.max(-change, 0);
      if (offset <= 14) {
        gainSum += gain; lossSum += loss;
        if (offset === 14) { averageGain = gainSum / 14; averageLoss = lossSum / 14; }
      } else {
        averageGain = (averageGain * 13 + gain) / 14;
        averageLoss = (averageLoss * 13 + loss) / 14;
      }
    }
    const next = candles[i + 1];
    if (offset < 60 || !next || next.time !== bar.time + DAY) continue;
    const last20 = candles.slice(i - 19, i + 1);
    const last50 = candles.slice(i - 49, i + 1);
    const returns20 = last20.map((candle, j) => Math.log(candle.close / candles[i - 20 + j].close));
    const returnsMean = mean(returns20);
    const rsi = averageGain === 0 && averageLoss === 0 ? 50 : averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
    const cutoff = bar.time + DAY;
    const features = {
      logReturn1: Math.log(bar.close / candles[i - 1].close),
      logReturn7: Math.log(bar.close / candles[i - 7].close),
      logReturn30: Math.log(bar.close / candles[i - 30].close),
      sma20Gap: bar.close / mean(last20.map((candle) => candle.close)) - 1,
      sma50Gap: bar.close / mean(last50.map((candle) => candle.close)) - 1,
      returnStd20: Math.sqrt(mean(returns20.map((value) => (value - returnsMean) ** 2))),
      rsi14Centered: (rsi - 50) / 50,
      logVolume20: Math.log1p(bar.volume) - Math.log1p(mean(last20.map((candle) => candle.volume))),
      ...phaseAt(cutoff),
    };
    if (Object.values(features).some((value) => !Number.isFinite(value))) throw new Error('Non-finite research feature');
    rows.push({cutoff, targetEnd: cutoff + DAY, target: Number(next.close > bar.close), currentDirection: Number(bar.close > candles[i - 1].close), features});
  }
  return rows;
}
