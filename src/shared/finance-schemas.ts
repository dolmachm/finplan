import { z } from "zod";
import { FREQUENCY_VALUES } from "@/modules/plan/frequency";

export const assetTypeEnum = z.enum([
  "CASH",
  "BANK_ACCOUNT",
  "DEPOSIT",
  "BROKERAGE",
  "IIS",
  "MUTUAL_FUND",
  "CRYPTO",
  "REAL_ESTATE",
  "VEHICLE",
  "COLLECTIBLE",
  "CROWDFUNDING",
  "RENTAL_REAL_ESTATE",
  "RENTAL_VEHICLE",
  "OTHER",
]);

export const assetSchema = z.object({
  name: z.string().min(1),
  type: assetTypeEnum,
  assetClass: z.enum(["PERSONAL", "INVESTMENT"]).optional(),
  currentValue: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  expectedReturnPct: z.number().default(0),
  volatilityPct: z.number().default(0),
  liquidityDays: z.number().int().default(0),
  maintenanceCostMonthly: z.number().default(0),
  dividendIncomeMonthly: z.number().default(0),
  taxEffectPct: z.number().default(0),
});

export const incomeSchema = z.object({
  name: z.string().min(1),
  source: z.enum(["SALARY", "FREELANCE", "PASSIVE", "BUSINESS", "OTHER"]),
  amount: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  frequency: z.enum(FREQUENCY_VALUES).default("MONTHLY"),
  isEssential: z.boolean().default(true),
  taxRatePct: z.number().default(13),
  growthRatePct: z.number().default(0),
});

export const expenseSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().default("RUB"),
  frequency: z.enum(FREQUENCY_VALUES).default("MONTHLY"),
  isEssential: z.boolean().default(true),
  growthRatePct: z.number().default(0),
});

export const budgetCategorySchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["expense", "income"]).default("expense"),
  monthlyLimit: z.number().nonnegative().nullable().default(null),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const goalStageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  amount: z.number().positive(),
  targetDate: z.string().datetime(),
});

export const goalBaseSchema = z.object({
  name: z.string().min(1),
  goalType: z
    .enum([
      "RETIREMENT",
      "EDUCATION",
      "HOME",
      "EMERGENCY",
      "MAJOR_PURCHASE",
      "WEALTH",
      "LEGACY",
      "OTHER",
    ])
    .default("OTHER"),
  targetAmountNominal: z.number().positive(),
  targetDate: z.string().datetime(),
  minAmount: z.number().positive().nullable().optional(),
  maxAmount: z.number().positive().nullable().optional(),
  stages: z.array(goalStageSchema).max(12).optional().default([]),
  currency: z.string().default("RUB"),
  priority: z.number().int().min(1).max(99).default(1),
  allowPartialFunding: z.boolean().default(true),
  strategy: z.enum(["SYSTEMATIC", "LUMP_SUM", "BALANCED"]).default("SYSTEMATIC"),
  linkedAssetId: z.string().nullable().optional(),
  pathSettings: z
    .object({
      preferredKind: z
        .enum(["SAVE", "LOAN", "HYBRID", "CAPITAL"])
        .nullable()
        .default(null),
      loanRatePct: z.number().min(0).max(50).default(14),
      loanTermMonths: z.number().int().min(1).max(360).default(60),
      downPaymentPct: z.number().min(0).max(90).default(30),
    })
    .nullable()
    .optional(),
});

function refineGoalAmounts(
  data: {
    targetAmountNominal?: number;
    minAmount?: number | null;
    maxAmount?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.minAmount != null &&
    data.targetAmountNominal != null &&
    data.minAmount > data.targetAmountNominal
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Минимум не может быть больше желаемой суммы",
      path: ["minAmount"],
    });
  }
  if (
    data.maxAmount != null &&
    data.targetAmountNominal != null &&
    data.maxAmount < data.targetAmountNominal
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Максимум не может быть меньше желаемой суммы",
      path: ["maxAmount"],
    });
  }
}

export const goalSchema = goalBaseSchema.superRefine(refineGoalAmounts);

/** Partial update — without refinements on the base object (Zod 4) */
export const goalPatchSchema = goalBaseSchema.partial().superRefine(refineGoalAmounts);

export const liabilityTypeEnum = z.enum([
  "MORTGAGE",
  "CONSUMER_LOAN",
  "CREDIT_CARD",
  "AUTO_LOAN",
  "STUDENT_LOAN",
  "OTHER",
]);

export const liabilitySchema = z.object({
  name: z.string().min(1),
  type: liabilityTypeEnum,
  remainingBalance: z.number().nonnegative(),
  interestRatePct: z.number(),
  monthlyPayment: z.number().nonnegative(),
  endDate: z.string().datetime().optional(),
  currency: z.string().default("RUB"),
});

export const liabilityPatchSchema = z
  .object({
    name: z.string().min(1),
    type: liabilityTypeEnum,
    remainingBalance: z.number().nonnegative(),
    interestRatePct: z.number(),
    monthlyPayment: z.number().nonnegative(),
    endDate: z.string().datetime().nullable().optional(),
    currency: z.string(),
  })
  .partial();
