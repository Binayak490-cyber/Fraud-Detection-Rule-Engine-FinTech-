import pool from '../db/client';

// GET all active rules
export const getActiveRules = async () => {
  const result = await pool.query(
    `SELECT * FROM fraud_rules WHERE is_active = true ORDER BY created_at DESC`
  );
  return result.rows;
};

// CREATE a new rule
export const createRule = async (rule: {
  name: string;
  description: string;
  type: string;
  field: string;
  operator: string;
  value: number;
  weight: number;
}) => {
  const result = await pool.query(
    `INSERT INTO fraud_rules (name, description, type, field, operator, value, weight)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [rule.name, rule.description, rule.type, rule.field, rule.operator, rule.value, rule.weight]
  );
  return result.rows[0];
};
