import type { PlanInput, ScenarioModifiers } from "@/modules/plan/types";
import { PREDEFINED_SCENARIOS } from "./scenario.templates";
import {
  applyRulesToModifiers,
  buildRuleContext,
  parseRulesFromJson,
} from "./rule-engine";
import type { ScenarioRule } from "./rule.types";

export function resolveScenarioModifiers(
  params: Record<string, unknown>,
  rulesRaw: unknown,
  planInput: PlanInput,
): ScenarioModifiers {
  const key = params.templateKey as string | undefined;
  const template = PREDEFINED_SCENARIOS.find((t) => t.key === key);

  let mods: ScenarioModifiers = {
    ...template?.modifiers,
    ...(params.modifiers as ScenarioModifiers | undefined),
  };

  const parsed = parseRulesFromJson(rulesRaw);
  const rules: ScenarioRule[] =
    parsed.length > 0
      ? parsed
      : ((template?.rules ?? []) as ScenarioRule[]);

  if (rules.length > 0) {
    const ctx = buildRuleContext(planInput);
    mods = applyRulesToModifiers(rules, ctx, mods);
  }

  return mods;
}
