import type { PlanInput, ScenarioModifiers } from "@/modules/plan/types";
import { monthlyEquivalent } from "@/modules/plan/frequency";
import type { ScenarioRule, RuleBranch, RuleAction } from "./rule.types";
import { isActionBranch, isNestedBranch } from "./rule.types";

export interface RuleEvalContext {
  planInput: PlanInput;
  monthlyExpenses: number;
  monthlyIncome: number;
  liquidAssetsValue: number;
}

export function buildRuleContext(planInput: PlanInput): RuleEvalContext {
  const monthlyIncome = planInput.incomes.reduce(
    (s, i) => s + monthlyEquivalent(i.amount, i.frequency) * (1 - i.taxRatePct / 100),
    0,
  );

  const monthlyExpenses = planInput.expenses.reduce(
    (s, e) => s + monthlyEquivalent(e.amount, e.frequency),
    0,
  );

  const liquidAssetsValue = planInput.assets
    .filter((a) => a.liquidityDays <= 30)
    .reduce((s, a) => s + a.currentValue, 0);

  return {
    planInput,
    monthlyExpenses,
    monthlyIncome,
    liquidAssetsValue,
  };
}

function evaluateCondition(
  rule: ScenarioRule,
  ctx: RuleEvalContext,
): boolean {
  const { condition } = rule;
  const p = condition.params ?? {};

  switch (condition.type) {
    case "always":
      return true;
    case "market_shock":
      return true;
    case "no_emergency_fund": {
      const months = Number(p.months ?? 6);
      if (ctx.monthlyExpenses <= 0) return false;
      const coverage = ctx.liquidAssetsValue / ctx.monthlyExpenses;
      return coverage < months;
    }
    case "job_loss":
    case "sell_asset_on_date":
      return true;
    case "expenses_exceed_income":
      return ctx.monthlyExpenses > ctx.monthlyIncome;
    case "portfolio_overweight": {
      const assetType = p.assetType as string;
      const targetPct = Number(p.targetPct ?? 60);
      const delta = Number(p.deltaPct ?? 5);
      const total = ctx.planInput.assets.reduce((s, a) => s + a.currentValue, 0);
      if (total <= 0) return false;
      const typed = ctx.planInput.assets
        .filter((a) => a.type === assetType)
        .reduce((s, a) => s + a.currentValue, 0);
      const pct = (typed / total) * 100;
      return pct > targetPct + delta;
    }
    default:
      return false;
  }
}

function applyAction(
  action: RuleAction,
  mods: ScenarioModifiers,
  ctx: RuleEvalContext,
): ScenarioModifiers {
  const p = action.params ?? {};
  const next = { ...mods };

  switch (action.type) {
    case "reduce_returns":
      next.returnMultiplier = (next.returnMultiplier ?? 1) * (1 - Number(p.pct ?? 20) / 100);
      break;
    case "increase_volatility":
      break;
    case "cut_expenses":
      next.expenseCutPct = Math.max(next.expenseCutPct ?? 0, Number(p.pct ?? 15));
      break;
    case "income_zero":
      next.incomeLossMonths = Math.max(next.incomeLossMonths ?? 0, Number(p.months ?? 6));
      break;
    case "sell_liquid_assets": {
      const months = 6;
      const coverage =
        ctx.monthlyExpenses > 0
          ? ctx.liquidAssetsValue / ctx.monthlyExpenses
          : 999;
      if (coverage < months) {
        next.assetShockPct = (next.assetShockPct ?? 0) - 5;
      }
      break;
    }
    case "use_emergency_fund":
      break;
    case "sell_asset": {
      const assetId = p.assetId as string;
      const asset = ctx.planInput.assets.find((a) => a.id === assetId);
      if (asset) {
        const tax = Number(p.taxPct ?? 13) / 100;
        const fee = Number(p.feePct ?? 1) / 100;
        const penalty = asset.liquidityDays > 30 ? 0.05 : 0;
        const proceeds = asset.currentValue * (1 - tax - fee) * (1 - penalty);
        const sale = {
          assetId,
          monthIndex: Number(p.monthIndex ?? 0),
          proceeds,
        };
        next.assetSale = sale;
        next.assetSales = [...(next.assetSales ?? []), sale];
      }
      break;
    }
    case "buy_asset": {
      const amount = Number(p.amount ?? 0);
      if (amount > 0) {
        next.assetPurchases = [
          ...(next.assetPurchases ?? []),
          {
            monthIndex: Number(p.monthIndex ?? 0),
            amount,
            name: String(p.name ?? "Новый актив"),
            expectedReturnPct: Number(p.expectedReturnPct ?? 7),
            dividendIncomeMonthly: Number(p.dividendIncomeMonthly ?? 0),
          },
        ];
      }
      break;
    }
    case "change_inflation": {
      const mode = String(p.mode ?? "delta");
      if (mode === "multiply") {
        next.inflationMultiplier =
          (next.inflationMultiplier ?? 1) * Number(p.factor ?? 1.25);
      } else {
        next.inflationDeltaPct =
          (next.inflationDeltaPct ?? 0) + Number(p.deltaPct ?? 2);
      }
      break;
    }
    case "boost_returns":
      next.returnMultiplier =
        (next.returnMultiplier ?? 1) * (1 + Number(p.pct ?? 10) / 100);
      break;
    case "change_dividends":
      next.dividendMultiplier =
        (next.dividendMultiplier ?? 1) * (1 + Number(p.pct ?? -50) / 100);
      break;
    case "rebalance":
      next.returnMultiplier = (next.returnMultiplier ?? 1) * 0.98;
      break;
    case "noop":
    default:
      break;
  }

  if (action.type === "reduce_returns" && ctx.planInput) {
    const condMonths = Number(p.months ?? 12);
    void condMonths;
  }

  return next;
}

function applyBranch(
  branch: RuleBranch,
  mods: ScenarioModifiers,
  ctx: RuleEvalContext,
): ScenarioModifiers {
  if (isNestedBranch(branch)) {
    return applyRulesToModifiers(branch.rules, ctx, mods);
  }
  if (isActionBranch(branch)) {
    return applyAction(branch, mods, ctx);
  }
  return mods;
}

function applyRule(
  rule: ScenarioRule,
  ctx: RuleEvalContext,
  mods: ScenarioModifiers,
): ScenarioModifiers {
  if (!rule.enabled) return mods;

  if (rule.condition.type === "market_shock") {
    const p = rule.condition.params ?? {};
    mods.assetShockPct = (mods.assetShockPct ?? 0) + Number(p.severityPct ?? -30);
  }

  if (rule.condition.type === "job_loss") {
    const p = rule.condition.params ?? {};
    mods.incomeLossMonths = Math.max(mods.incomeLossMonths ?? 0, Number(p.months ?? 6));
  }

  const condMet = evaluateCondition(rule, ctx);
  const branch = condMet ? rule.then : rule.else ?? { type: "noop" as const };
  return applyBranch(branch, mods, ctx);
}

export function applyRulesToModifiers(
  rules: ScenarioRule[],
  ctx: RuleEvalContext,
  base: ScenarioModifiers = {},
): ScenarioModifiers {
  let mods = { ...base };
  for (const rule of rules) {
    mods = applyRule(rule, ctx, mods);
  }
  return mods;
}

export function parseRulesFromJson(raw: unknown): ScenarioRule[] {
  if (!Array.isArray(raw)) return [];
  return raw as ScenarioRule[];
}
