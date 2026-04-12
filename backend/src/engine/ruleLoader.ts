import pool from '../db/client';
import { FraudRule } from '../types/rule.types';

// Load all active fraud rules from DB, sorted by priority (lowest = evaluated first)
export async function loadActiveRules(): Promise<FraudRule[]> {
  const result = await pool.query<FraudRule>(
    `SELECT
       rule_id,
       rule_name,
       rule_type,
       field_name,
       operator,
       threshold_value,
       weight,
       priority,
       is_active,
       created_by,
       created_at,
       updated_at
     FROM fraud_rules
     WHERE is_active = true
     ORDER BY priority ASC`
  );
  return result.rows;
}
