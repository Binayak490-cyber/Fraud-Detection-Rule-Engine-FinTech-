// Scenario: Large Amount Transaction
// A user sends a transaction with a very high amount.
// Expected: engine triggers high-amount rules → BLOCK decision

jest.mock('../../src/db/client', () => ({ query: jest.fn() }));
jest.mock('../../src/engine/velocityChecker');

import { getVelocityData } from '../../src/engine/velocityChecker';
import { runEvaluation, isAlreadyEvaluated } from '../../src/engine/decisionEngine';
import { FraudRule } from '../../src/types/rule.types';
import { Transaction } from '../../src/types/transaction.types';
import { VelocityData } from '../../src/engine/ruleEvaluator';
import pool from '../../src/db/client';

const mockGetVelocity = getVelocityData as jest.MockedFunction<typeof getVelocityData>;
const mockPool        = pool as jest.Mocked<typeof pool>;

// ─── Scenario Setup ───────────────────────────────────────────────────────────

// Transaction: user sends ₹85,000 — well above any safe threshold
const largeAmountTransaction: Transaction = {
  tx_id:            'scenario-large-001',
  user_id:          'user-001',
  amount:           85000,
  location:         'US',
  device_id:        'device-001',
  transaction_time: new Date('2026-04-12T14:00:00Z'), // 2 PM — normal business hours
  is_simulation:    false,
  created_at:       new Date(),
};

// Rules active in this scenario
const scenarioRules: FraudRule[] = [
  {
    rule_id:         'rule-001',
    rule_name:       'High Amount Block',
    rule_type:       'threshold',
    field_name:      'amount',
    operator:        'gt',
    threshold_value: '50000',
    weight:          70,
    priority:        1,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
  {
    rule_id:         'rule-002',
    rule_name:       'Medium Amount Review',
    rule_type:       'threshold',
    field_name:      'amount',
    operator:        'gt',
    threshold_value: '10000',
    weight:          30,
    priority:        2,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
  {
    rule_id:         'rule-003',
    rule_name:       'Safe Amount',
    rule_type:       'threshold',
    field_name:      'amount',
    operator:        'lte',
    threshold_value: '5000',
    weight:          10,
    priority:        3,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
];

// Normal velocity — not suspicious
const normalVelocity: VelocityData = {
  tx_count_1h:   1,
  tx_count_24h:  3,
  tx_amount_1h:  85000,
  tx_amount_24h: 90000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);
  mockGetVelocity.mockResolvedValue(normalVelocity);
});

// ─── Scenario Tests ───────────────────────────────────────────────────────────

describe('Scenario: Large Amount Transaction', () => {

  test('decision is BLOCK for very large amount (₹85,000)', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    expect(result.decision).toBe('BLOCK');
  });

  test('risk score is >= 70 (BLOCK threshold)', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    expect(result.risk_score).toBeGreaterThanOrEqual(70);
  });

  test('both amount rules trigger (rule-001 and rule-002)', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-001');
    expect(triggeredIds).toContain('rule-002');
  });

  test('safe amount rule (lte 5000) does NOT trigger', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).not.toContain('rule-003');
  });

  test('is_alert_generated is true', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    expect(result.is_alert_generated).toBe(true);
  });

  test('output includes score_breakdown with triggered rule names', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    const ruleNames = result.score_breakdown.map(r => r.rule_name);
    expect(ruleNames).toContain('High Amount Block');
    expect(ruleNames).toContain('Medium Amount Review');
  });

  test('output includes human-readable reason for each triggered rule', async () => {
    const result = await runEvaluation(largeAmountTransaction, scenarioRules);
    result.triggered_rules.forEach(rule => {
      expect(rule.reason).toBeTruthy();
      expect(typeof rule.reason).toBe('string');
    });
  });

  test('a safe transaction (₹3,000) results in ALLOW', async () => {
    const safeTx = { ...largeAmountTransaction, tx_id: 'scenario-safe-001', amount: 3000 };
    const result = await runEvaluation(safeTx, scenarioRules);
    expect(result.decision).toBe('ALLOW');
    expect(result.risk_score).toBe(10); // rule-003 (lte 5000, weight 10) triggers for ₹3,000
  });
});
