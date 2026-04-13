// Scenario: Night Time Transaction
// A user sends a transaction at 2 AM — outside normal business hours.
// Expected: temporal rules trigger → REVIEW or BLOCK decision

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

// Transaction at 2:30 AM UTC — suspicious night hour
const nightTransaction: Transaction = {
  tx_id:            'scenario-night-001',
  user_id:          'user-002',
  amount:           8000,
  location:         'US',
  device_id:        'device-002',
  transaction_time: new Date('2026-04-12T02:30:00Z'), // 2:30 AM UTC
  is_simulation:    false,
  created_at:       new Date(),
};

// Same transaction but during daytime
const dayTransaction: Transaction = {
  tx_id:            'scenario-day-001',
  user_id:          'user-002',
  amount:           8000,
  location:         'US',
  device_id:        'device-002',
  transaction_time: new Date('2026-04-12T10:00:00Z'), // 10:00 AM UTC
  is_simulation:    false,
  created_at:       new Date(),
};

const scenarioRules: FraudRule[] = [
  {
    rule_id:         'rule-001',
    rule_name:       'Night Hour Transaction',
    rule_type:       'temporal',
    field_name:      'hour_of_day',
    operator:        'in',
    threshold_value: '0,1,2,3,4,5,22,23',
    weight:          40,
    priority:        1,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
  {
    rule_id:         'rule-002',
    rule_name:       'Medium Amount',
    rule_type:       'threshold',
    field_name:      'amount',
    operator:        'gt',
    threshold_value: '5000',
    weight:          30,
    priority:        2,
    is_active:       true,
    created_by:      null,
    created_at:      new Date(),
    updated_at:      new Date(),
  },
];

const normalVelocity: VelocityData = {
  tx_count_1h:   1,
  tx_count_24h:  2,
  tx_amount_1h:  8000,
  tx_amount_24h: 10000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 } as never);
  mockGetVelocity.mockResolvedValue(normalVelocity);
});

// ─── Scenario Tests ───────────────────────────────────────────────────────────

describe('Scenario: Night Time Transaction', () => {

  test('decision is BLOCK for night transaction with medium amount', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    expect(['REVIEW', 'BLOCK']).toContain(result.decision);
    expect(result.risk_score).toBeGreaterThanOrEqual(30); // at least REVIEW
  });

  test('night hour rule triggers at 2:30 AM', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-001');
  });

  test('amount rule also triggers (8000 > 5000)', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).toContain('rule-002');
  });

  test('combined score is 70 → BLOCK decision', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    expect(result.risk_score).toBe(70);   // weight 40 + 30 = 70
    expect(result.decision).toBe('BLOCK');
  });

  test('daytime transaction does NOT trigger night hour rule', async () => {
    const result = await runEvaluation(dayTransaction, scenarioRules);
    const triggeredIds = result.triggered_rules.map(r => r.rule_id);
    expect(triggeredIds).not.toContain('rule-001');
  });

  test('daytime transaction with same amount → REVIEW (only amount rule triggers)', async () => {
    const result = await runEvaluation(dayTransaction, scenarioRules);
    expect(result.decision).toBe('REVIEW'); // only weight 30 → REVIEW
    expect(result.risk_score).toBe(30);
  });

  test('output includes explanation of why night rule triggered', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    const nightRule = result.triggered_rules.find(r => r.rule_id === 'rule-001');
    expect(nightRule).toBeDefined();
    expect(nightRule?.reason).toContain('hour_of_day');
  });

  test('score_breakdown lists all triggered rules with weights', async () => {
    const result = await runEvaluation(nightTransaction, scenarioRules);
    expect(result.score_breakdown).toHaveLength(2);
    const totalWeight = result.score_breakdown.reduce((sum, r) => sum + r.weight, 0);
    expect(totalWeight).toBe(result.risk_score);
  });
});
