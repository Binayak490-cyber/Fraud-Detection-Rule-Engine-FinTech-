import { aggregateScore, makeDecision, SCORE_THRESHOLDS } from '../../src/engine/scoreAggregator';
import { TriggeredRule } from '../../src/types/decision.types';

// Helper to build a triggered rule with a given weight
function makeTriggeredRule(weight: number, name = 'Test Rule'): TriggeredRule {
  return {
    rule_id:        'rule-001',
    rule_name:      name,
    rule_type:      'threshold',
    weight_applied: weight,
    reason:         'amount gt 10000',
  };
}

// ─── aggregateScore Tests ─────────────────────────────────────────────────────

describe('aggregateScore', () => {

  test('returns 0 when no rules triggered', () => {
    expect(aggregateScore([])).toBe(0);
  });

  test('returns weight of a single triggered rule', () => {
    expect(aggregateScore([makeTriggeredRule(40)])).toBe(40);
  });

  test('sums weights of two triggered rules', () => {
    expect(aggregateScore([makeTriggeredRule(30), makeTriggeredRule(25)])).toBe(55);
  });

  test('sums weights of three triggered rules', () => {
    const rules = [
      makeTriggeredRule(30, 'High Amount'),
      makeTriggeredRule(25, 'Night Transaction'),
      makeTriggeredRule(20, 'High Velocity'),
    ];
    expect(aggregateScore(rules)).toBe(75);
  });

  test('handles zero weight rule', () => {
    expect(aggregateScore([makeTriggeredRule(0)])).toBe(0);
  });

  test('handles max weight (100) rule', () => {
    expect(aggregateScore([makeTriggeredRule(100)])).toBe(100);
  });

  test('score can exceed 100 if multiple rules are triggered', () => {
    expect(aggregateScore([makeTriggeredRule(80), makeTriggeredRule(80)])).toBe(160);
  });
});

// ─── makeDecision Tests ───────────────────────────────────────────────────────

describe('makeDecision', () => {

  // ALLOW zone: 0 to 29
  test('returns ALLOW when score is 0', () => {
    expect(makeDecision(0)).toBe('ALLOW');
  });

  test('returns ALLOW when score is 29 (boundary — just below REVIEW)', () => {
    expect(makeDecision(29)).toBe('ALLOW');
  });

  // REVIEW zone: 30 to 69
  test('returns REVIEW when score is exactly 30 (REVIEW threshold)', () => {
    expect(makeDecision(30)).toBe('REVIEW');
  });

  test('returns REVIEW when score is 50 (middle of REVIEW zone)', () => {
    expect(makeDecision(50)).toBe('REVIEW');
  });

  test('returns REVIEW when score is 69 (boundary — just below BLOCK)', () => {
    expect(makeDecision(69)).toBe('REVIEW');
  });

  // BLOCK zone: 70+
  test('returns BLOCK when score is exactly 70 (BLOCK threshold)', () => {
    expect(makeDecision(70)).toBe('BLOCK');
  });

  test('returns BLOCK when score is 100', () => {
    expect(makeDecision(100)).toBe('BLOCK');
  });

  test('returns BLOCK when score exceeds 100', () => {
    expect(makeDecision(160)).toBe('BLOCK');
  });

  test('returns BLOCK when score is very high (999)', () => {
    expect(makeDecision(999)).toBe('BLOCK');
  });

  // Threshold constants are correct
  test('REVIEW threshold constant is 30', () => {
    expect(SCORE_THRESHOLDS.REVIEW).toBe(30);
  });

  test('BLOCK threshold constant is 70', () => {
    expect(SCORE_THRESHOLDS.BLOCK).toBe(70);
  });
});

// ─── Combined Flow Tests ──────────────────────────────────────────────────────

describe('aggregateScore + makeDecision — combined flow', () => {

  test('no triggered rules → score 0 → ALLOW', () => {
    const score = aggregateScore([]);
    expect(score).toBe(0);
    expect(makeDecision(score)).toBe('ALLOW');
  });

  test('low weight rules → ALLOW', () => {
    const score = aggregateScore([makeTriggeredRule(10), makeTriggeredRule(10)]);
    expect(makeDecision(score)).toBe('ALLOW');
  });

  test('medium weight rules → REVIEW', () => {
    const score = aggregateScore([makeTriggeredRule(20), makeTriggeredRule(20)]);
    expect(makeDecision(score)).toBe('REVIEW');
  });

  test('high weight rules → BLOCK', () => {
    const score = aggregateScore([makeTriggeredRule(40), makeTriggeredRule(40)]);
    expect(makeDecision(score)).toBe('BLOCK');
  });

  test('single rule at exact REVIEW boundary → REVIEW', () => {
    const score = aggregateScore([makeTriggeredRule(30)]);
    expect(makeDecision(score)).toBe('REVIEW');
  });

  test('single rule at exact BLOCK boundary → BLOCK', () => {
    const score = aggregateScore([makeTriggeredRule(70)]);
    expect(makeDecision(score)).toBe('BLOCK');
  });

  test('rules summing to exactly 29 → ALLOW', () => {
    const score = aggregateScore([makeTriggeredRule(15), makeTriggeredRule(14)]);
    expect(makeDecision(score)).toBe('ALLOW');
  });

  test('rules summing to exactly 69 → REVIEW', () => {
    const score = aggregateScore([makeTriggeredRule(35), makeTriggeredRule(34)]);
    expect(makeDecision(score)).toBe('REVIEW');
  });
});
