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

// Parse threshold_value string into a number or array of values
function parseThreshold(value: string): number | string[] {
  if (value.includes(',')) {
    return value.split(',').map((v) => v.trim());
  }
  return parseFloat(value);
}

// Apply operator between a field value and a threshold
function applyOperator(
  fieldValue: number | string,
  operator: Operator,
  threshold: number | string[]
): boolean {
  // Set operations: in / not_in — works for both strings and numbers
  if (operator === 'in' || operator === 'not_in') {
    const set = (threshold as string[]).map((v) => v.toLowerCase());
    const val = String(fieldValue).toLowerCase();
    return operator === 'in' ? set.includes(val) : !set.includes(val);
  }

  // Range operation: threshold_value format is "min-max" e.g. "100-5000"
  if (operator === 'range') {
    const parts = String(threshold).split('-');
    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    const num = Number(fieldValue);
    return num >= min && num <= max;
  }

  // Regex match for string fields e.g. location
  if (operator === 'regex') {
    return new RegExp(String(threshold)).test(String(fieldValue));
  }

  // Numeric comparisons
  const numValue = Number(fieldValue);
  const numThreshold = Number(threshold);

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
      // Direct transaction fields
      if (rule.field_name === 'amount')    return tx.amount;
      if (rule.field_name === 'location')  return tx.location;
      if (rule.field_name === 'device_id') return tx.device_id;
      return null;

    case 'temporal':
      // Time-based fields derived from transaction_time
      if (rule.field_name === 'hour_of_day')  return new Date(tx.transaction_time).getHours();
      if (rule.field_name === 'day_of_week')  return new Date(tx.transaction_time).getDay();
      return null;

    case 'velocity':
      // Velocity fields come from velocityChecker — already computed
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

  const threshold = parseThreshold(rule.threshold_value);
  const triggered = applyOperator(fieldValue, rule.operator, threshold);

  const reason = triggered
    ? `${rule.field_name} (${fieldValue}) ${rule.operator} ${rule.threshold_value}`
    : '';

  return { triggered, reason };
}
