import { evaluateRule, VelocityData } from '../../src/engine/ruleEvaluator';
import { FraudRule } from '../../src/types/rule.types';
import { Transaction } from '../../src/types/transaction.types';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockTransaction: Transaction = {
  tx_id:            'tx-001',
  user_id:          'user-001',
  amount:           15000,
  location:         'RU',
  device_id:        'device-001',
  transaction_time: new Date('2026-04-12T02:30:00Z'), // 2:30 AM UTC
  is_simulation:    false,
  created_at:       new Date(),
};

const mockVelocity: VelocityData = {
  tx_count_1h:   8,
  tx_count_24h:  15,
  tx_amount_1h:  20000,
  tx_amount_24h: 50000,
};

// Helper to build a rule with overrides
function makeRule(overrides: Partial<FraudRule>): FraudRule {
  return {
    rule_id:         'rule-001',
    rule_name:       'Test Rule',
    rule_type:       'threshold',
    field_name:      'amount',
    operator:        'gt',
    threshold_value: '10000',
    weight:          50,
    priority:        1,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
    ...overrides,
  };
}

// ─── Threshold Rule — Numeric Operators ──────────────────────────────────────

describe('ruleEvaluator — threshold rules (numeric operators)', () => {

  // gt
  test('gt: triggers when amount > threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'gt', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('gt: does not trigger when amount <= threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'gt', threshold_value: '20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  test('gt: does not trigger when amount equals threshold exactly', () => {
    const result = evaluateRule(makeRule({ operator: 'gt', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // lt
  test('lt: triggers when amount < threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'lt', threshold_value: '20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('lt: does not trigger when amount >= threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'lt', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  test('lt: does not trigger when amount equals threshold exactly', () => {
    const result = evaluateRule(makeRule({ operator: 'lt', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // gte
  test('gte: triggers when amount equals threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'gte', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('gte: triggers when amount is above threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'gte', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('gte: does not trigger when amount is below threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'gte', threshold_value: '20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // lte
  test('lte: triggers when amount equals threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'lte', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('lte: triggers when amount is below threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'lte', threshold_value: '20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('lte: does not trigger when amount is above threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'lte', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // eq
  test('eq: triggers when amount exactly matches threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'eq', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('eq: does not trigger when amount does not match', () => {
    const result = evaluateRule(makeRule({ operator: 'eq', threshold_value: '9999' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // neq
  test('neq: triggers when amount does not match threshold', () => {
    const result = evaluateRule(makeRule({ operator: 'neq', threshold_value: '9999' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('neq: does not trigger when amount matches threshold exactly', () => {
    const result = evaluateRule(makeRule({ operator: 'neq', threshold_value: '15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });
});

// ─── Threshold Rule — Set & Pattern Operators ─────────────────────────────────

describe('ruleEvaluator — threshold rules (set and pattern operators)', () => {

  // in
  test('in: triggers when location is in the blocked set', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'in', threshold_value: 'RU,NG,KP' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('in: does not trigger when location is not in the set', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'in', threshold_value: 'US,UK,CA' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  test('in: is case-insensitive', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'in', threshold_value: 'ru,NG,KP' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  // not_in
  test('not_in: triggers when location is not in the allowed set', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'not_in', threshold_value: 'US,UK,CA' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('not_in: does not trigger when location is in the allowed set', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'not_in', threshold_value: 'RU,NG,KP' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // range
  test('range: triggers when amount is within range', () => {
    const result = evaluateRule(makeRule({ operator: 'range', threshold_value: '10000-20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('range: triggers when amount equals the lower bound', () => {
    const result = evaluateRule(makeRule({ operator: 'range', threshold_value: '15000-20000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('range: triggers when amount equals the upper bound', () => {
    const result = evaluateRule(makeRule({ operator: 'range', threshold_value: '10000-15000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('range: does not trigger when amount is below range', () => {
    const result = evaluateRule(makeRule({ operator: 'range', threshold_value: '20000-50000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  test('range: does not trigger when amount is above range', () => {
    const result = evaluateRule(makeRule({ operator: 'range', threshold_value: '100-1000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  // regex
  test('regex: triggers when location matches pattern', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'regex', threshold_value: '^RU$' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('regex: triggers with partial match pattern', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'regex', threshold_value: 'R' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
  });

  test('regex: does not trigger when location does not match pattern', () => {
    const result = evaluateRule(makeRule({ field_name: 'location', operator: 'regex', threshold_value: '^US$' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });
});

// ─── Temporal Rule Tests ──────────────────────────────────────────────────────

describe('ruleEvaluator — temporal rules', () => {

  // hour_of_day
  test('hour_of_day: triggers when transaction is in night hours (2 AM UTC)', () => {
    const rule = makeRule({ rule_type: 'temporal', field_name: 'hour_of_day', operator: 'in', threshold_value: '0,1,2,3,4,5,22,23' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true);
  });

  test('hour_of_day: does not trigger during business hours (10 AM UTC)', () => {
    const dayTx = { ...mockTransaction, transaction_time: new Date('2026-04-12T10:00:00Z') };
    const rule = makeRule({ rule_type: 'temporal', field_name: 'hour_of_day', operator: 'in', threshold_value: '0,1,2,3,4,5,22,23' });
    expect(evaluateRule(rule, dayTx, mockVelocity).triggered).toBe(false);
  });

  test('hour_of_day: triggers using gt operator (late night)', () => {
    const rule = makeRule({ rule_type: 'temporal', field_name: 'hour_of_day', operator: 'gte', threshold_value: '22' });
    const lateTx = { ...mockTransaction, transaction_time: new Date('2026-04-12T22:30:00Z') };
    expect(evaluateRule(rule, lateTx, mockVelocity).triggered).toBe(true);
  });

  test('hour_of_day: does not trigger during day with late-night rule', () => {
    const rule = makeRule({ rule_type: 'temporal', field_name: 'hour_of_day', operator: 'gte', threshold_value: '22' });
    const dayTx = { ...mockTransaction, transaction_time: new Date('2026-04-12T14:00:00Z') };
    expect(evaluateRule(rule, dayTx, mockVelocity).triggered).toBe(false);
  });

  // day_of_week
  test('day_of_week: triggers when transaction is on a weekend (Sunday = 0)', () => {
    // 2026-04-12 is a Sunday → getUTCDay() = 0
    const rule = makeRule({ rule_type: 'temporal', field_name: 'day_of_week', operator: 'in', threshold_value: '0,6' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true);
  });

  test('day_of_week: does not trigger on a weekday', () => {
    const weekdayTx = { ...mockTransaction, transaction_time: new Date('2026-04-13T10:00:00Z') }; // Monday
    const rule = makeRule({ rule_type: 'temporal', field_name: 'day_of_week', operator: 'in', threshold_value: '0,6' });
    expect(evaluateRule(rule, weekdayTx, mockVelocity).triggered).toBe(false);
  });
});

// ─── Velocity Rule Tests ──────────────────────────────────────────────────────

describe('ruleEvaluator — velocity rules', () => {

  // tx_count_1h
  test('tx_count_1h: triggers when count exceeds threshold', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_count_1h', operator: 'gt', threshold_value: '5' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true); // 8 > 5
  });

  test('tx_count_1h: does not trigger when count is within limit', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_count_1h', operator: 'gt', threshold_value: '10' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(false); // 8 not > 10
  });

  // tx_count_24h
  test('tx_count_24h: triggers when 24h count exceeds threshold', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_count_24h', operator: 'gt', threshold_value: '10' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true); // 15 > 10
  });

  test('tx_count_24h: does not trigger when count is within limit', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_count_24h', operator: 'gt', threshold_value: '20' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(false); // 15 not > 20
  });

  // tx_amount_1h
  test('tx_amount_1h: triggers when hourly amount exceeds threshold', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_amount_1h', operator: 'gt', threshold_value: '15000' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true); // 20000 > 15000
  });

  test('tx_amount_1h: does not trigger when hourly amount is within limit', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_amount_1h', operator: 'gt', threshold_value: '25000' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(false); // 20000 not > 25000
  });

  // tx_amount_24h
  test('tx_amount_24h: triggers when daily amount exceeds threshold', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_amount_24h', operator: 'gt', threshold_value: '40000' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(true); // 50000 > 40000
  });

  test('tx_amount_24h: does not trigger when daily amount is within limit', () => {
    const rule = makeRule({ rule_type: 'velocity', field_name: 'tx_amount_24h', operator: 'gt', threshold_value: '60000' });
    expect(evaluateRule(rule, mockTransaction, mockVelocity).triggered).toBe(false); // 50000 not > 60000
  });
});

// ─── Edge Case Tests ──────────────────────────────────────────────────────────

describe('ruleEvaluator — edge cases', () => {

  test('returns triggered: false for completely unknown field name', () => {
    const result = evaluateRule(makeRule({ field_name: 'unknown_field' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
    expect(result.reason).toContain('Unknown field');
  });

  test('triggered result includes a human-readable reason string', () => {
    const result = evaluateRule(makeRule({ operator: 'gt', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(typeof result.reason).toBe('string');
  });

  test('reason contains field name, value, operator and threshold when triggered', () => {
    const result = evaluateRule(makeRule({ field_name: 'amount', operator: 'gt', threshold_value: '10000' }), mockTransaction, mockVelocity);
    expect(result.reason).toContain('amount');
    expect(result.reason).toContain('gt');
    expect(result.reason).toContain('10000');
  });

  test('non-triggered result has empty reason string', () => {
    const result = evaluateRule(makeRule({ operator: 'gt', threshold_value: '99999' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('');
  });

  test('unknown velocity field returns triggered: false', () => {
    const result = evaluateRule(makeRule({ rule_type: 'velocity', field_name: 'unknown_velocity_field' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });

  test('unknown temporal field returns triggered: false', () => {
    const result = evaluateRule(makeRule({ rule_type: 'temporal', field_name: 'unknown_time_field' }), mockTransaction, mockVelocity);
    expect(result.triggered).toBe(false);
  });
});
