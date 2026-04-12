import { FraudRule, Operator } from '../types/rule.types';
import { Transaction } from '../types/transaction.types';

export interface RuleEvaluationResult {
  triggered: boolean;
  reason: string;
}

// Velocity data passed in from velocityChecker — no DB call here
export interface VelocityData {
  tx_count_1h: number;
  tx_count_24h: number;
  tx_amount_1h: number;
  tx_amount_24h: number;
  [key: string]: number; // allows dynamic field access by rule.field_name
}

// Apply operator between a field value and the raw threshold string from the DB
function applyOperator(
  fieldValue: number | string,
  operator: Operator,
  thresholdRaw: string
): boolean {
  // Set operations: in / not_in — comma-separated values e.g. "US,UK,CA"
  if (operator === 'in' || operator === 'not_in') {
    const set = thresholdRaw.split(',').map((v) => v.trim().toLowerCase());
    const val = String(fieldValue).toLowerCase();
    return operator === 'in' ? set.includes(val) : !set.includes(val);
  }

  // Range operation: "min-max" format e.g. "10000-50000"
  if (operator === 'range') {
    const parts = thresholdRaw.split('-');
    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    return Number(fieldValue) >= min && Number(fieldValue) <= max;
  }

  // Regex match for string fields e.g. location
  if (operator === 'regex') {
    return new RegExp(thresholdRaw).test(String(fieldValue));
  }

  // Numeric comparisons
  const numValue = Number(fieldValue);
  const numThreshold = parseFloat(thresholdRaw);

  switch (operator) {
    case 'gt':  return numValue > numThreshold;
    case 'lt':  return numValue < numThreshold;
    case 'gte': return numValue >= numThreshold;
    case 'lte': return numValue <= numThreshold;
    case 'eq':  return numValue === numThreshold;
    case 'neq': return numValue !== numThreshold;
    default:    return false;
  }
}

// Extract the relevant field value from a transaction based on rule type
function getFieldValue(
  rule: FraudRule,
  tx: Transaction,
  velocityData: VelocityData
): number | string | null {
  switch (rule.rule_type) {
    case 'threshold':
      if (rule.field_name === 'amount')    return tx.amount;
      if (rule.field_name === 'location')  return tx.location;
      if (rule.field_name === 'device_id') return tx.device_id;
      return null;

    case 'temporal':
      // Use UTC hours to ensure timezone-consistent evaluation
      if (rule.field_name === 'hour_of_day') return new Date(tx.transaction_time).getUTCHours();
      if (rule.field_name === 'day_of_week') return new Date(tx.transaction_time).getUTCDay();
      return null;

    case 'velocity':
      return velocityData[rule.field_name] ?? null;

    default:
      return null;
  }
}

// Main export — evaluates one rule against one transaction
export function evaluateRule(
  rule: FraudRule,
  tx: Transaction,
  velocityData: VelocityData
): RuleEvaluationResult {
  const fieldValue = getFieldValue(rule, tx, velocityData);

  if (fieldValue === null) {
    return { triggered: false, reason: `Unknown field: ${rule.field_name}` };
  }

  const triggered = applyOperator(fieldValue, rule.operator, rule.threshold_value);

  const reason = triggered
    ? `${rule.field_name} (${fieldValue}) ${rule.operator} ${rule.threshold_value}`
    : '';

  return { triggered, reason };
}
