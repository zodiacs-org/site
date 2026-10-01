import type { SetupPlan } from './types';
export type RiskInput = SetupPlan['risk'];
export interface RiskEstimate { budget: number; units: number; notionalUSD: number; fundingUSD: number; stopLossUSD: number; costsAtStopUSD: number; rewardUSD: number | null; rewardRisk: number | null; equityCapped: boolean }
/** Long USD spot, fully cash funded; fees and adverse slippage on both fills. */
export function estimateRisk(input: RiskInput): RiskEstimate {
  if (!input || !['percent', 'usd'].includes(input.riskMode)) throw new Error('Choose percent or USD risk.');
  const positive = [input.equity, input.riskValue, input.entry, input.stop];
  if (positive.some(n => !Number.isFinite(n) || n <= 0 || n > 1e12)) throw new Error('Equity, risk and prices must be positive finite numbers.');
  if (input.stop >= input.entry) throw new Error('For long spot, the stop must be below entry.');
  if (input.target !== undefined && (!Number.isFinite(input.target) || input.target <= input.entry || input.target > 1e12)) throw new Error('The optional target must be above entry.');
  if ([input.feeBps, input.slippageBps].some(n => !Number.isFinite(n) || n < 0 || n > 1000)) throw new Error('Fees and slippage must each be between 0 and 1,000 basis points per side.');
  const budget = input.riskMode === 'percent' ? input.equity * input.riskValue / 100 : input.riskValue;
  if (budget > input.equity) throw new Error('Risk cannot exceed cash equity.');
  const fee = input.feeBps / 10000, slip = input.slippageBps / 10000;
  const entryFill = input.entry * (1 + slip), stopFill = input.stop * (1 - slip);
  const perUnitLoss = entryFill * (1 + fee) - stopFill * (1 - fee);
  const riskUnits = budget / perUnitLoss, cashUnits = input.equity / (entryFill * (1 + fee));
  const units = Math.min(riskUnits, cashUnits);
  const stopLossUSD = units * perUnitLoss;
  const rewardUSD = input.target === undefined ? null : units * (input.target * (1 - slip) * (1 - fee) - entryFill * (1 + fee));
  return { budget, units, notionalUSD: units * input.entry, fundingUSD: units * entryFill * (1 + fee), stopLossUSD, costsAtStopUSD: stopLossUSD - units * (input.entry - input.stop), rewardUSD, rewardRisk: rewardUSD === null ? null : rewardUSD / stopLossUSD, equityCapped: cashUnits < riskUnits };
}
