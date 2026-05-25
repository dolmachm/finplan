/** Узел действия или вложенная цепочка IF/ELSE */
export type RuleBranch =
  | RuleAction
  | { type: "nested"; rules: ScenarioRule[] };

export interface RuleAction {
  type: string;
  params?: Record<string, unknown>;
}

export interface RuleCondition {
  type: string;
  params?: Record<string, unknown>;
}

export interface ScenarioRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  then: RuleBranch;
  else?: RuleBranch;
}

export function isNestedBranch(branch: RuleBranch): branch is { type: "nested"; rules: ScenarioRule[] } {
  return typeof branch === "object" && branch !== null && "type" in branch && branch.type === "nested";
}

export function isActionBranch(branch: RuleBranch): branch is RuleAction {
  return !isNestedBranch(branch);
}

export function newRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyRule(name = "Новое правило"): ScenarioRule {
  return {
    id: newRuleId(),
    name,
    enabled: true,
    condition: { type: "always", params: {} },
    then: { type: "noop", params: {} },
    else: { type: "noop", params: {} },
  };
}
