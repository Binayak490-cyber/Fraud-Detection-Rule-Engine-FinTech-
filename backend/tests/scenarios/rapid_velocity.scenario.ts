// Scenario: Rapid Velocity Transactions
// A user makes 10 transactions within the last 1 hour — highly suspicious pattern.
// Expected: velocity rules trigger → BLOCK decision

jest.mock('../../src/db/client', () => ({ query: jest.fn() }));
jest.mock('../../src/engine/velocityChecker');

import { getVelocityData } from '../../src/engine/velocityChecker';
import { runEvaluation } from '../../src/engine/decisionEngine';
import { FraudRule } from '../../src/types/rule.types';
import { Transaction } from '../../src/types/transaction.types';
import { VelocityData } from '../../src/engine/ruleEvaluator';
import pool from '../../src/db/client';

const mockGetVelocity = getVelocityData as jest.MockedFunction<typeof getVelocityData>;
const mockPool        = pool as jest.Mocked<typeof pool>;

// ─── Scenario Setup ───────────────────────────────────────────────────────────

// Transaction from a user who has been very active in the last hour
const rapidTransaction: Transaction = {
  tx_id:            'scenario-rapid-001',
  user_id:          'user-003',
  amount:           2000,
  location:         'IN',
  device_id:        'device-003',
  transaction_time: new Date('2026-04-12T14:00:00Z'),
  is_simulation:    false,
  created_at:       new Date(),
};

const scenarioRules: FraudRule[] = [
  {
    rule_id:         'rule-001',
    rule_name:       'High Transaction Frequency 1h',
    rule_type:       'velocity',
    field_name:      'tx_count_1h',
    operator:        'gt',
    threshold_value: '5',
    weight:          50,
    priority:        1,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
  {
    rule_id:         'rule-002',
    rule_name:       'High Spend 1h',
    rule_type:       'velocity',
    field_name:      'tx_amount_1h',
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
    rule_name:       'High Transaction Frequency 24h',
    rule_type:       'velocity',
    field_name:      'tx_count_24h',
    operator:        'gt',
    threshold_value: '15',
    weight:          20,
    priority:        3,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
];

// Suspicious velocity: 10 transactions in 1 hour
const highVelocity: VelocityData = {
  tx_count_1h:   10,
  tx_count_24h:  20,
  tx_amount_1h:  20000,
  tx_amount_24h: 40000,
};

// Normal velocity: 2 transactions in 1 hour
const normalVelocity: VelocityData = {
  tx_count_1h:   2,
  tx_count_24h:  5,
  tx_amount_1h:  4000,
  tx_amount_24h: 10000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);
  mockGetVelocity.mockResolvedValue(highVelocity);
});

// ─── Scenario Tests ───────────────────────────────────────────────────────────

describe('Scenario: Rapid Velocity Transactions', () => {

  test('decision is BLOCK when user has 10 transactions in last 1 hour', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    expect(result.decision).toBe('BLOCK');
  });

  test('risk score is >= 70 (BLOCK threshold)', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    expect(result.risk_score).toBeGreaterThanOrEqual(70);
  });

  test('all 3 velocity rules trigger with high velocity data', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    expect(result.triggered_rules).toHaveLength(3);
  });

  test('frequency 1h rule triggers (10 > 5)', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-001');
  });

  test('spend 1h rule triggers (20000 > 10000)', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-002');
  });

  test('frequency 24h rule triggers (20 > 15)', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-003');
  });

  test('is_alert_generated is true', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    expect(result.is_alert_generated).toBe(true);
  });

  test('score_breakdown weights sum equals risk_score', async () => {
    const result = await runEvaluation(rapidTransaction, scenarioRules);
    const total = result.score_breakdown.reduce((sum, r) => sum + r.weight, 0);
    expect(total).toBe(result.risk_score);
  });

  test('normal velocity → ALLOW (no velocity rules trigger)', async () => {
    mockGetVelocity.mockResolvedValueOnce(normalVelocity);
    const safeTx = { ...rapidTransaction, tx_id: 'scenario-safe-001' };
    const result = await runEvaluation(safeTx, scenarioRules);
    expect(result.decision).toBe('ALLOW');
    expect(result.triggered_rules).toHaveLength(0);
  });

  test('borderline velocity (exactly 5 tx_count_1h) does NOT trigger frequency rule', async () => {
    mockGetVelocity.mockResolvedValueOnce({ ...normalVelocity, tx_count_1h: 5 });
    const borderTx = { ...rapidTransaction, tx_id: 'scenario-border-001' };
    const result = await runEvaluation(borderTx, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).not.toContain('rule-001'); // gt 5, not gte — exactly 5 should not trigger
  });
});
