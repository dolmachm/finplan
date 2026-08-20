import type { Goal } from "@/shared/types";
import { normalizeVariant } from "./iplan.engine";
import type { IPlanStream, IPlanVariant } from "./types";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function yearOf(d: Date | string): number {
  return new Date(d).getFullYear();
}

type LiveGoalSlice = {
  linkedEntityId: string;
  name: string;
  amount: number;
  year: number;
};

function liveGoalSlices(goals: Goal[]): LiveGoalSlice[] {
  const out: LiveGoalSlice[] = [];
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

/**
 * Подставляет суммы/сроки из живых строк goal / macro / assets / профицита.
 * Для linked-потоков сохранённый amount не источник истины.
 */
export function hydrateIPlanVariant(
  variant: IPlanVariant,
  live: {
    goals: Goal[];
    surplusMonthly: number;
    horizonYears: number;
    weightedReturnPct: number;
    weightedVolatilityPct: number;
  },
): IPlanVariant {
  const v = normalizeVariant(variant);
  const y = v.startYear;
  const hz = Math.min(100, Math.max(1, live.horizonYears));
  const endDefault = y + Math.max(0, (v.horizonCustom ? v.horizonYears : hz) - 1);

  const surplusExisting = v.contributions.find(
    (c) => c.linkedEntityId === "__surplus__",
  );
  const otherContrib = v.contributions.filter(
    (c) => c.linkedEntityId !== "__surplus__",
  );
  const surplusStream: IPlanStream = {
    id: surplusExisting?.id ?? "__surplus__",
    name: "Взнос = доходы − расходы",
    amount: Math.max(0, Math.round(live.surplusMonthly)),
    frequency: "MONTHLY",
    startYear: surplusExisting?.startYear ?? y,
    endYear: surplusExisting?.endYear ?? endDefault,
    enabled: surplusExisting?.enabled ?? live.surplusMonthly > 0,
    linkedEntityId: "__surplus__",
  };

  const slices = liveGoalSlices(live.goals);
  const byLink = new Map(
    v.goals
      .filter((s) => s.linkedEntityId)
      .map((s) => [s.linkedEntityId as string, s]),
  );
  const goalStreams: IPlanStream[] = slices.map((d) => {
    const existing = byLink.get(d.linkedEntityId);
    return {
      id: existing?.id ?? `goal:${d.linkedEntityId}`,
      name: d.name,
      amount: Math.max(0, Math.round(d.amount)),
      frequency: "YEARLY",
      startYear: d.year,
      endYear: d.year,
      enabled: existing?.enabled ?? true,
      linkedEntityId: d.linkedEntityId,
    };
  });
  const manuals = v.goals.filter((s) => !s.linkedEntityId);

  let next: IPlanVariant = {
    ...v,
    contributions: [surplusStream, ...otherContrib],
    goals: [...goalStreams, ...manuals].slice(0, 9),
  };

  if (next.horizonCustom) {
    /* overlay: свой горизонт варианта */
  } else if (next.horizonCustom === undefined && next.horizonYears !== hz) {
    next = { ...next, horizonCustom: true };
  } else {
    next = { ...next, horizonYears: hz, horizonCustom: false };
  }

  if (next.returnScheduleCustom) {
    return next;
  }
  const suggestedRate = round1(live.weightedReturnPct) || 6;
  const suggestedVol = round1(live.weightedVolatilityPct) || 15;
  const sched = next.returnSchedule ?? [];
  if (sched.length !== 1) {
    return { ...next, returnScheduleCustom: true };
  }
  const step = sched[0]!;
  if (next.returnScheduleCustom === undefined) {
    const rateDiff = Math.abs((step.ratePct ?? 0) - suggestedRate) > 0.15;
    const volDiff = Math.abs((step.volatilityPct ?? 15) - suggestedVol) > 0.15;
    if (rateDiff || volDiff || step.fromYear != null) {
      return { ...next, returnScheduleCustom: true };
    }
  }
  return {
    ...next,
    returnScheduleCustom: false,
    returnSchedule: [
      { fromYear: null, ratePct: suggestedRate, volatilityPct: suggestedVol },
    ],
  };
}

/** В Redis храним только оверлей: суммы linked-потоков всегда из живых строк. */
export function toIPlanOverlay(variant: IPlanVariant): IPlanVariant {
  return {
    ...variant,
    contributions: variant.contributions.map((s) =>
      s.linkedEntityId === "__surplus__" ? { ...s, amount: 0 } : s,
    ),
    goals: variant.goals.map((s) =>
      s.linkedEntityId ? { ...s, amount: 0 } : s,
    ),
  };
}
