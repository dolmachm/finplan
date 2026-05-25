import type { PlanInput } from "@/modules/plan/types";
import type { ScenarioRule, RuleBranch } from "./rule.types";
import { isActionBranch, isNestedBranch } from "./rule.types";
import { getActionEntry, getConditionEntry } from "./rule-catalog";

export interface RuleValidationIssue {
  ruleId: string;
  field?: string;
  level: "error" | "warning";
  message: string;
}

function collectRules(rules: ScenarioRule[], out: ScenarioRule[] = []): ScenarioRule[] {
  for (const r of rules) {
    out.push(r);
    for (const branch of [r.then, r.else]) {
      if (branch && isNestedBranch(branch)) {
        collectRules(branch.rules, out);
      }
    }
  }
  return out;
}

export function validateRules(
  rules: ScenarioRule[],
  planInput?: PlanInput,
): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const all = collectRules(rules);

  for (const rule of all) {
    if (!rule.enabled) continue;

    const cond = getConditionEntry(rule.condition.type);
    if (!cond) {
      issues.push({
        ruleId: rule.id,
        field: "condition",
        level: "error",
        message: `Неизвестное условие: ${rule.condition.type}`,
      });
    }

    const checkBranch = (branch: RuleBranch | undefined, side: string) => {
      if (!branch) return;
      if (isNestedBranch(branch)) {
        issues.push(...validateRules(branch.rules, planInput));
        return;
      }
      if (!isActionBranch(branch)) return;
      const act = getActionEntry(branch.type);
      if (!act) {
        issues.push({
          ruleId: rule.id,
          field: side,
          level: "error",
          message: `Неизвестное действие: ${branch.type}`,
        });
      }

      if (branch.type === "sell_asset" || rule.condition.type === "sell_asset_on_date") {
        const assetId = (branch.params?.assetId ?? rule.condition.params?.assetId) as string | undefined;
        const monthIndex = Number(branch.params?.monthIndex ?? rule.condition.params?.monthIndex ?? 0);
        const maxMonths = Number(branch.params?.maxMonthsToSell ?? 1);

        if (!assetId && planInput) {
          issues.push({
            ruleId: rule.id,
            level: "error",
            message: "Выберите актив для продажи",
          });
        }

        if (assetId && planInput) {
          const asset = planInput.assets.find((a) => a.id === assetId);
          if (!asset) {
            issues.push({
              ruleId: rule.id,
              level: "error",
              message: "Актив не найден в вашем профиле",
            });
          } else if (asset.liquidityDays > maxMonths * 30) {
            issues.push({
              ruleId: rule.id,
              level: "warning",
              message: `«${asset.name}» неликвиден (${asset.liquidityDays} дн.): продажа за ${maxMonths} мес. может быть нереалистична без штрафа`,
            });
          }
        }

        if (monthIndex < 0) {
          issues.push({
            ruleId: rule.id,
            level: "error",
            message: "Месяц продажи не может быть отрицательным",
          });
        }
      }
    };

    checkBranch(rule.then, "then");
    checkBranch(rule.else, "else");
  }

  return issues;
}
