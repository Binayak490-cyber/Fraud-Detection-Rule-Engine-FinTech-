import { EvaluationResult, TriggeredRule } from '../types/decision.types';

export interface ScoreBreakdownItem {
  rule_name: string;
  weight: number;
  reason: string;
}

export interface ExplainableOutput {
  tx_id: string;
  decision: string;
  risk_score: number;
  triggered_rules: TriggeredRule[];
  score_breakdown: ScoreBreakdownItem[];
  evaluation_time: string;
  is_alert_generated: boolean;
}

// Formats the raw EvaluationResult into a human-readable explainable output
export function generateExplanation(result: EvaluationResult): ExplainableOutput {
  return {
    tx_id:             result.tx_id,
    decision:          result.decision,
    risk_score:        result.risk_score,
    triggered_rules:   result.triggered_rules,
    score_breakdown:   result.triggered_rules.map((rule) => ({
      rule_name: rule.rule_name,
      weight:    rule.weight_applied,
      reason:    rule.reason,
    })),
    evaluation_time:   result.evaluation_time.toISOString(),
    is_alert_generated: result.is_alert_generated,
  };
}
