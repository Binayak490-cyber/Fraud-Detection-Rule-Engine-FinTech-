import pool from '../db/client';
import { VelocityData } from './ruleEvaluator';

// Query historical transactions for a user within time windows
// transactionTime is the current transaction's time — used as reference point
export async function getVelocityData(
  userId: string,
  transactionTime: Date
): Promise<VelocityData> {
  const oneHourAgo       = new Date(transactionTime.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(transactionTime.getTime() - 24 * 60 * 60 * 1000);

  // Query for last 1 hour
  const result1h = await pool.query<{ count: string; total: string }>(
    `SELECT
       COUNT(*)                    AS count,
       COALESCE(SUM(amount), 0)   AS total
     FROM transactions
     WHERE user_id          = $1
       AND transaction_time >= $2
       AND transaction_time <  $3
       AND is_simulation    = false`,
    [userId, oneHourAgo, transactionTime]
  );

  // Query for last 24 hours
  const result24h = await pool.query<{ count: string; total: string }>(
    `SELECT
       COUNT(*)                    AS count,
       COALESCE(SUM(amount), 0)   AS total
     FROM transactions
     WHERE user_id          = $1
       AND transaction_time >= $2
       AND transaction_time <  $3
       AND is_simulation    = false`,
    [userId, twentyFourHoursAgo, transactionTime]
  );

  return {
    tx_count_1h:   parseInt(result1h.rows[0].count,  10),
    tx_amount_1h:  parseFloat(result1h.rows[0].total),
    tx_count_24h:  parseInt(result24h.rows[0].count, 10),
    tx_amount_24h: parseFloat(result24h.rows[0].total),
  };
}
