import { loanPayment } from "@/modules/plan/goal-paths";

export type AmortizeInput = {
  principal: number;
  annualRatePct: number;
  months: number;
  /** Доп. платёж сверх аннуитета, ₽/мес */
  extraMonthly?: number;
};

export type AmortizeResult = {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  actualMonths: number;
};

const MAX_MONTHS = 600;

/** Аннуитетная амортизация с опциональным досрочным погашением. */
export function amortizeLoan(input: AmortizeInput): AmortizeResult {
  const principal = Math.max(0, input.principal);
  const months = Math.max(1, Math.floor(input.months));
  const extra = Math.max(0, input.extraMonthly ?? 0);
  const base = loanPayment(principal, input.annualRatePct, months);

  if (principal <= 0) {
    return { monthlyPayment: 0, totalPaid: 0, totalInterest: 0, actualMonths: 0 };
  }

  const r = input.annualRatePct / 100 / 12;
  let balance = principal;
  let totalPaid = 0;
  let actualMonths = 0;

  while (balance > 0.01 && actualMonths < MAX_MONTHS) {
    actualMonths += 1;
    const interest = r > 0 ? balance * r : 0;
    const due = base + extra;
    const payment = Math.min(due, balance + interest);
    balance = balance + interest - payment;
    totalPaid += payment;
    if (balance < 0) balance = 0;
  }

  return {
    monthlyPayment: base,
    totalPaid,
    totalInterest: Math.max(0, totalPaid - principal),
    actualMonths,
  };
}

export type DebtInput = {
  id: string;
  name: string;
  remainingBalance: number;
  interestRatePct: number;
  monthlyPayment: number;
};

export type PayoffStrategyKind = "minimum" | "avalanche" | "snowball";

export type StrategyResult = {
  kind: PayoffStrategyKind;
  label: string;
  months: number;
  totalInterest: number;
  /** Экономия процентов vs baseline (minimum); для minimum = 0 */
  interestSaved: number;
  /** Порядок закрытия долгов (имена) */
  payoffOrder: string[];
};

export type StrategyComparison = {
  strategies: StrategyResult[];
  recommendedKind: PayoffStrategyKind;
};

type SimDebt = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
};

function cloneDebts(debts: DebtInput[]): SimDebt[] {
  return debts
    .filter((d) => d.remainingBalance > 0 && d.monthlyPayment > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: d.remainingBalance,
      rate: d.interestRatePct / 100 / 12,
      minPayment: d.monthlyPayment,
    }));
}

function pickTarget(
  active: SimDebt[],
  kind: PayoffStrategyKind,
): SimDebt | null {
  if (active.length === 0) return null;
  if (kind === "avalanche") {
    return active.reduce((best, d) => (d.rate > best.rate ? d : best));
  }
  if (kind === "snowball") {
    return active.reduce((best, d) => (d.balance < best.balance ? d : best));
  }
  return null;
}

function simulateStrategy(
  debts: DebtInput[],
  kind: PayoffStrategyKind,
  extraMonthly: number,
): Omit<StrategyResult, "interestSaved"> {
  const label =
    kind === "minimum"
      ? "Минимум"
      : kind === "avalanche"
        ? "Лавина"
        : "Снежный ком";

  const sim = cloneDebts(debts);
  if (sim.length === 0) {
    return { kind, label, months: 0, totalInterest: 0, payoffOrder: [] };
  }

  let totalInterest = 0;
  let months = 0;
  const payoffOrder: string[] = [];
  const extra = Math.max(0, extraMonthly);

  while (sim.some((d) => d.balance > 0.01) && months < MAX_MONTHS) {
    months += 1;
    const active = sim.filter((d) => d.balance > 0.01);

    for (const d of active) {
      const interest = d.rate > 0 ? d.balance * d.rate : 0;
      totalInterest += interest;
      d.balance += interest;
    }

    let pool = 0;
    for (const d of active) {
      const pay = Math.min(d.minPayment, d.balance);
      d.balance -= pay;
      pool += Math.max(0, d.minPayment - pay);
    }

    const extraPool = kind === "minimum" ? pool : pool + extra;
    let remaining = extraPool;

    while (remaining > 0.01) {
      const still = sim.filter((d) => d.balance > 0.01);
      if (still.length === 0) break;
      const target =
        kind === "minimum"
          ? still[0]!
          : (pickTarget(still, kind) ?? still[0]!);
      const pay = Math.min(remaining, target.balance);
      target.balance -= pay;
      remaining -= pay;
    }

    for (const d of sim) {
      if (d.balance <= 0.01 && !payoffOrder.includes(d.name)) {
        d.balance = 0;
        payoffOrder.push(d.name);
      }
    }
  }

  return { kind, label, months, totalInterest, payoffOrder };
}

/** Сравнение baseline / avalanche / snowball по текущим пассивам. */
export function compareRepaymentStrategies(
  debts: DebtInput[],
  extraMonthly: number,
): StrategyComparison {
  const extra = Math.max(0, extraMonthly);
  const minimum = simulateStrategy(debts, "minimum", 0);
  const avalanche = simulateStrategy(debts, "avalanche", extra);
  const snowball = simulateStrategy(debts, "snowball", extra);

  const strategies: StrategyResult[] = [
    { ...minimum, interestSaved: 0 },
    {
      ...avalanche,
      interestSaved: Math.max(0, minimum.totalInterest - avalanche.totalInterest),
    },
    {
      ...snowball,
      interestSaved: Math.max(0, minimum.totalInterest - snowball.totalInterest),
    },
  ];

  const recommendedKind: PayoffStrategyKind =
    avalanche.totalInterest <= snowball.totalInterest ? "avalanche" : "snowball";

  return { strategies, recommendedKind };
}

export { loanPayment };
