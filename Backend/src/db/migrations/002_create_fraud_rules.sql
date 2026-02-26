CREATE TABLE IF NOT EXISTS fraud_rules (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  type        VARCHAR(20)   NOT NULL CHECK (type IN ('threshold', 'velocity', 'temporal', 'composite')),
  field       VARCHAR(50)   NOT NULL,
  operator    VARCHAR(10)   NOT NULL CHECK (operator IN ('gt', 'lt', 'eq', 'gte', 'lte', 'in', 'not_in')),
  value       NUMERIC       NOT NULL,
  weight      INTEGER       NOT NULL CHECK (weight BETWEEN 1 AND 100),
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);