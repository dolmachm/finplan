import { newId } from "@/shared/db/helpers";
import type { Goal } from "@/shared/types";
import { normalizeVariant } from "./iplan.engine";
import type { IPlanStream, IPlanVariant } from "./types";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function yearOf(d: Date | string): number {
  return new Date(d).getFullYear();
}

type DesiredGoalStream = {
  linkedEntityId: string;
  name: string;
  amount: number;
  year: number;
};

function desiredGoalStreams(goals: Goal[]): DesiredGoalStream[] {
  const out: DesiredGoalStream[] = [];
  for (const g of goals) {
    const stages = g.stages ?? [];
    if (stages.length > 0) {
      for (const st of stages) {
        out.push({
          linkedEntityId: `${g.id}:${st.id}`,
          name: `${g.name}: ${st.label}`,
          amount: st.amount,
          year: yearOf(st.targetDate),
        });
      }
    } else {
      out.push({
        linkedEntityId: g.id,
        name: g.name,
        amount: g.targetAmountNominal,
        year: yearOf(g.targetDate),
      });
    }
  }
  return out.slice(0, 9);
}

function isLinkedGoalId(id: string | null, goals: Goal[]): boolean {
  if (!id || id === "__surplus__") return false;
  return goals.some((g) => id === g.id || id.startsWith(`${g.id}:`));
}

/** Цели вкладки «Данные» → списания инвест-плана (сумма и год не копируются вручную). */
export function syncLinkedGoalStreams(
  variant: IPlanVariant,
  goals: Goal[],
): IPlanVariant {
  const v = normalizeVariant(variant);
  const desired = desiredGoalStreams(goals);
  const byLink = new Map(
    v.goals
      .filter((s) => s.linkedEntityId)
      .map((s) => [s.linkedEntityId as string, s]),
  );
  const synced: IPlanStream[] = desired.map((d) => {
    const existing = byLink.get(d.linkedEntityId);
    return {
      id: existing?.id ?? newId(),
      name: d.name,
      amount: Math.max(0, Math.round(d.amount)),
      frequency: "YEARLY",
      startYear: d.year,
      endYear: d.year,
      enabled: existing?.enabled ?? true,
      linkedEntityId: d.linkedEntityId,
    };
  });
  const manuals = v.goals.filter(
    (s) => !s.linkedEntityId || !isLinkedGoalId(s.linkedEntityId, goals),
  );
  return { ...v, goals: [...synced, ...manuals].slice(0, 9) };
}

export function syncHorizonFromMacro(
  variant: IPlanVariant,
  horizonYears: number,
): IPlanVariant {
  const v = normalizeVariant(variant);
  const hz = Math.min(100, Math.max(1, horizonYears));
  if (v.horizonCustom) return v;
  if (v.horizonCustom === undefined && v.horizonYears !== hz) {
    return { ...v, horizonCustom: true };
  }
  return { ...v, horizonYears: hz, horizonCustom: false };
}

export function syncReturnScheduleFromAssets(
  variant: IPlanVariant,
  weightedReturnPct: number,
  weightedVolatilityPct: number,
): IPlanVariant {
  const v = normalizeVariant(variant);
  if (v.returnScheduleCustom) return v;
  const suggestedRate = round1(weightedReturnPct) || 6;
  const suggestedVol = round1(weightedVolatilityPct) || 15;
  const sched = v.returnSchedule ?? [];
  if (sched.length !== 1) {
    return { ...v, returnScheduleCustom: true };
  }
  const step = sched[0]!;
  if (v.returnScheduleCustom === undefined) {
    const rateDiff = Math.abs((step.ratePct ?? 0) - suggestedRate) > 0.15;
    const volDiff = Math.abs((step.volatilityPct ?? 15) - suggestedVol) > 0.15;
    if (rateDiff || volDiff || step.fromYear != null) {
      return { ...v, returnScheduleCustom: true };
    }
  }
  return {
    ...v,
    returnScheduleCustom: false,
    returnSchedule: [
      { fromYear: null, ratePct: suggestedRate, volatilityPct: suggestedVol },
    ],
  };
}

export function applyFinanceToVariant(
  variant: IPlanVariant,
  params: {
    surplusMonthly: number;
    goals: Goal[];
    horizonYears: number;
    weightedReturnPct: number;
    weightedVolatilityPct: number;
    syncSurplus: (v: IPlanVariant, surplus: number) => IPlanVariant;
  },
): IPlanVariant {
  let next = params.syncSurplus(variant, params.surplusMonthly);
  next = syncLinkedGoalStreams(next, params.goals);
  next = syncHorizonFromMacro(next, params.horizonYears);
  next = syncReturnScheduleFromAssets(
    next,
    params.weightedReturnPct,
    params.weightedVolatilityPct,
  );
  return next;
}
