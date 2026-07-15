export type AccountStatus = "ACTIVE" | "STAKING" | "LISTING";
export type UserRole = "USER" | "CONSULTANT" | "ADMIN";
export type AssetType =
  | "CASH" | "BANK_ACCOUNT" | "DEPOSIT" | "BROKERAGE" | "IIS"
  | "MUTUAL_FUND" | "CRYPTO" | "REAL_ESTATE" | "VEHICLE" | "COLLECTIBLE"
  | "CROWDFUNDING" | "RENTAL_REAL_ESTATE" | "RENTAL_VEHICLE" | "OTHER";
export type LiabilityType =
  | "MORTGAGE" | "CONSUMER_LOAN" | "CREDIT_CARD" | "AUTO_LOAN" | "STUDENT_LOAN" | "OTHER";
export type IncomeSource = "SALARY" | "FREELANCE" | "PASSIVE" | "BUSINESS" | "OTHER";
export type Frequency = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY" | "ONE_TIME";
export type AssetClass = "PERSONAL" | "INVESTMENT";
export type GoalType =
  | "RETIREMENT"
  | "EDUCATION"
  | "HOME"
  | "EMERGENCY"
  | "MAJOR_PURCHASE"
  | "WEALTH"
  | "LEGACY"
  | "OTHER";
export type GoalStrategy = "SYSTEMATIC" | "LUMP_SUM" | "BALANCED";
export type GoalAchievability = "max" | "desired" | "min" | "none";
export type ScenarioKind = "PREDEFINED" | "CUSTOM";
export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

/** Этап выплаты / накопления внутри цели */
export type GoalStage = {
  id: string;
  label: string;
  amount: number;
  targetDate: Date;
};

export type User = {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  balance: number;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MacroSettings = {
  id: string;
  userId: string;
  baseCurrency: string;
  baseInflationPct: number;
  incomeTaxPct: number;
  planHorizonYears: number;
  discountRatePct: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Asset = {
  id: string;
  userId: string;
  name: string;
  type: AssetType;
  assetClass: AssetClass;
  currentValue: number;
  currency: string;
  expectedReturnPct: number;
  volatilityPct: number;
  liquidityDays: number;
  maintenanceCostMonthly: number;
  dividendIncomeMonthly: number;
  taxEffectPct: number;
  isRealReturn: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Liability = {
  id: string;
  userId: string;
  name: string;
  type: LiabilityType;
  remainingBalance: number;
  interestRatePct: number;
  monthlyPayment: number;
  endDate: Date | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Income = {
  id: string;
  userId: string;
  name: string;
  source: IncomeSource;
  amount: number;
  currency: string;
  frequency: Frequency;
  isEssential: boolean;
  taxRatePct: number;
  growthRatePct: number;
  startDate: Date | null;
  endDate: Date | null;
  oneTimeDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Expense = {
  id: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: Frequency;
  isEssential: boolean;
  growthRatePct: number;
  oneTimeDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Optional YNAB-style category envelope; Expense.category stores this id when linked */
export type BudgetCategoryKind = "expense" | "income";

export type BudgetCategory = {
  id: string;
  userId: string;
  name: string;
  kind: BudgetCategoryKind;
  /** Monthly envelope limit; null = no limit */
  monthlyLimit: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Goal = {
  id: string;
  userId: string;
  name: string;
  goalType: GoalType;
  /** Желаемая сумма (legacy + основной ориентир) */
  targetAmountNominal: number;
  targetDate: Date;
  /** Минимально приемлемая сумма; null → 80% желаемой при allowPartialFunding */
  minAmount: number | null;
  /** Максимум / «хотелка сверху»; null → = желаемая */
  maxAmount: number | null;
  /** Несколько выплат с разными датами; пусто → одна выплата на targetDate */
  stages: GoalStage[];
  currency: string;
  priority: number;
  allowPartialFunding: boolean;
  strategy: GoalStrategy;
  linkedAssetId: string | null;
  /** Параметры сравнения путей: накопления / кредит / гибрид */
  pathSettings: {
    preferredKind: "SAVE" | "LOAN" | "HYBRID" | "CAPITAL" | null;
    loanRatePct: number;
    loanTermMonths: number;
    downPaymentPct: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Scenario = {
  id: string;
  userId: string;
  name: string;
  kind: ScenarioKind;
  templateKey: string | null;
  isActive: boolean;
  params: unknown;
  rules: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PlanSnapshot = {
  id: string;
  userId: string;
  scenarioId: string | null;
  deterministic: unknown;
  cashflowMonthly: unknown;
  netWorthMonthly: unknown;
  computedAt: Date;
};

export type SimulationJob = {
  id: string;
  userId: string;
  scenarioId: string | null;
  status: JobStatus;
  progressPct: number;
  numRuns: number;
  stepMonths: number;
  params: unknown;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type SimulationResult = {
  id: string;
  jobId: string;
  goalProbabilities: unknown;
  wealthPercentiles: unknown;
  samplePaths: unknown;
  sensitivity: unknown | null;
  createdAt: Date;
};

/** Audit trail for CFP-style change history */
export type EntityRevision = {
  id: string;
  userId: string;
  entityType: "asset" | "income" | "expense" | "goal" | "liability" | "iplan" | "macro";
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  label: string;
  before: unknown | null;
  after: unknown | null;
  createdAt: Date;
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
