import { Decision, TriggeredRule } from '../types/decision.types';

// Score thresholds — determines final fraud decision
export const SCORE_THRESHOLDS = {
  REVIEW: 30, // score >= 30 → REVIEW
  BLOCK:  70, // score >= 70 → BLOCK
};

// Sum up the weights of all triggered rules to get the final risk score
export function aggregateScore(triggeredRules: TriggeredRule[]): number {
  return triggeredRules.reduce((total, rule) => total + rule.weight_applied, 0);
}

// Map risk score to a fraud decision
export function makeDecision(score: number): Decision {
  if (score >= SCORE_THRESHOLDS.BLOCK)  return 'BLOCK';
  if (score >= SCORE_THRESHOLDS.REVIEW) return 'REVIEW';
  return 'ALLOW';
}
