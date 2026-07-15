import type {
  User, MacroSettings, Asset, Liability, Income, Expense, Goal,
  BudgetCategory, Scenario, PlanSnapshot, SimulationJob, SimulationResult, JsonValue,
} from "@/shared/types";
import type { InvestmentPlan } from "@/modules/iplan/types";
import {
  newId, now, getJson, setJson, getManyByUser, findFirstByUser, findFirstGlobal,
  findManyGlobal, countByUser, countAll, createEntity, updateEntity, deleteEntity,
  matchesWhere, sortBy, addToUserIndex, applySelect,
} from "@/shared/db/helpers";
import { redis } from "@/shared/redis";

type Where = Record<string, unknown>;
type OrderBy = Record<string, "asc" | "desc">;

interface EntityRepo<T extends { id: string; userId: string }> {
  findMany(args: { where: Where; orderBy?: OrderBy }): Promise<T[]>;
  findFirst(args: { where: Where; orderBy?: OrderBy }): Promise<T | null>;
  create(args: { data: { userId: string } & Partial<T> }): Promise<T>;
  update(args: { where: { id: string }; data: Partial<T> }): Promise<T>;
  delete(args: { where: { id: string } }): Promise<void>;
  count(args: { where: Where }): Promise<number>;
}

function makeCrud<T extends { id: string; userId: string }>(entity: string): EntityRepo<T> {
  return {
    async findMany(args: { where: Where; orderBy?: OrderBy }): Promise<T[]> {
      const rows = await getManyByUser<T>(entity, args.where.userId as string);
      const filtered = rows.filter((r) => matchesWhere(r, args.where));
      return args.orderBy ? sortBy(filtered, args.orderBy) : filtered;
    },
    async findFirst(args: { where: Where; orderBy?: OrderBy }): Promise<T | null> {
      return findFirstByUser<T>(entity, args.where, { orderBy: args.orderBy });
    },
    async create(args: { data: { userId: string } & Partial<T> }): Promise<T> {
      return createEntity<T>(entity, args.data as T);
    },
    async update(args: { where: { id: string }; data: Partial<T> }): Promise<T> {
      return updateEntity<T>(entity, args.where.id, args.data);
    },
    async delete(args: { where: { id: string } }): Promise<void> {
      const row = await getJson<T>(`${entity}:${args.where.id}`);
      if (row) await deleteEntity(entity, args.where.id, row.userId);
    },
    async count(args: { where: Where }): Promise<number> {
      return countByUser<T>(entity, args.where.userId as string, args.where);
    },
  };
}

type SelectShape = Record<string, boolean | { select: Record<string, boolean> }>;

const userRepo = {
  async findUnique(args: { where: { id?: string; email?: string }; select?: SelectShape }) {
    let user: User | null = null;
    if (args.where.id) {
      user = await getJson<User>(`user:${args.where.id}`);
    } else if (args.where.email) {
      const id = await redis.get<string>(`idx:user:email:${args.where.email}`);
      if (id) user = await getJson<User>(`user:${id}`);
    }
    if (!user) return null;
    if (!args.select) return user;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(args.select)) {
      if (key === "macroSettings" || key === "_count") continue;
      if (args.select[key] === true) result[key] = user[key as keyof User];
    }
    if (args.select.macroSettings) {
      const macro = await getJson<MacroSettings>(`macro:${user.id}`);
      const macroSelect = args.select.macroSettings;
      if (macro && typeof macroSelect === "object" && "select" in macroSelect) {
        const picked: Record<string, unknown> = {};
        for (const k of Object.keys(macroSelect.select)) {
          if (macroSelect.select[k]) picked[k] = macro[k as keyof MacroSettings];
        }
        result.macroSettings = picked;
      } else {
        result.macroSettings = macro;
      }
    }
    if (args.select._count) {
      const countSelect = args.select._count as unknown as { select: Record<string, boolean> };
      const counts: Record<string, number> = {};
      const entities = ["asset", "liability", "income", "expense", "goal", "scenario"] as const;
      for (const e of entities) {
        if (countSelect.select[`${e}s`] || countSelect.select[e]) {
          const key = e === "asset" ? "assets" : `${e}s`;
          counts[key] = await countByUser(e, user.id);
        }
      }
      result._count = counts;
    }
    return result;
  },

  async findMany(args: { orderBy?: OrderBy; select?: SelectShape }) {
    const ids = (await redis.smembers("idx:users")) ?? [];
    const users: User[] = [];
    for (const id of ids) {
      const u = await getJson<User>(`user:${id}`);
      if (u) users.push(u);
    }
    const sorted = args.orderBy ? sortBy(users, args.orderBy) : users;
    if (!args.select) return sorted;
    return sorted.map((u) => {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(args.select!)) {
        if (args.select![key] === true) result[key] = u[key as keyof User];
      }
      return result;
    });
  },

  async create(args: {
    data: Partial<User> & { email: string; macroSettings?: { create: Partial<MacroSettings> } };
  }) {
    const ts = now();
    const id = newId();
    const user: User = {
      id,
      email: args.data.email,
      passwordHash: args.data.passwordHash ?? null,
      name: args.data.name ?? null,
      role: args.data.role ?? "USER",
      accountStatus: args.data.accountStatus ?? "ACTIVE",
      balance: args.data.balance ?? 0,
      emailVerified: args.data.emailVerified ?? null,
      image: args.data.image ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await setJson(`user:${id}`, user);
    await redis.set(`idx:user:email:${user.email}`, id);
    await redis.sadd("idx:users", id);

    if (args.data.macroSettings?.create) {
      const macro: MacroSettings = {
        id: newId(),
        userId: id,
        baseCurrency: "RUB",
        baseInflationPct: 4,
        incomeTaxPct: 13,
        planHorizonYears: 30,
        discountRatePct: null,
        createdAt: ts,
        updatedAt: ts,
        ...args.data.macroSettings.create,
      };
      await setJson(`macro:${id}`, macro);
    }
    return user;
  },

  async update(args: {
    where: { id: string };
    data: Omit<Partial<User>, "balance"> & { balance?: number | { increment: number } };
    select?: Record<string, boolean>;
  }) {
    const existing = await getJson<User>(`user:${args.where.id}`);
    if (!existing) throw new Error("User not found");
    let balance = existing.balance;
    const bal = args.data.balance;
    if (bal && typeof bal === "object" && "increment" in bal) {
      balance += bal.increment;
    } else if (typeof bal === "number") {
      balance = bal;
    }
    const { balance: _b, ...rest } = args.data;
    const updated: User = { ...existing, ...rest, balance, updatedAt: now() };
    if (rest.email && rest.email !== existing.email) {
      await redis.del(`idx:user:email:${existing.email}`);
      await redis.set(`idx:user:email:${rest.email}`, updated.id);
    }
    await setJson(`user:${updated.id}`, updated);
    if (!args.select) return updated;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(args.select)) {
      if (args.select[key]) result[key] = updated[key as keyof User];
    }
    return result;
  },
};

const macroRepo = {
  async findUnique(args: { where: { userId: string } }) {
    return getJson<MacroSettings>(`macro:${args.where.userId}`);
  },
  async upsert(args: { where: { userId: string }; create: Partial<MacroSettings> & { userId: string }; update: Partial<MacroSettings> }) {
    const existing = await getJson<MacroSettings>(`macro:${args.where.userId}`);
    if (existing) {
      const updated = { ...existing, ...args.update, updatedAt: now() };
      await setJson(`macro:${args.where.userId}`, updated);
      return updated;
    }
    const ts = now();
    const macro: MacroSettings = {
      id: newId(),
      baseCurrency: "RUB",
      baseInflationPct: 4,
      incomeTaxPct: 13,
      planHorizonYears: 30,
      discountRatePct: null,
      createdAt: ts,
      updatedAt: ts,
      ...args.create,
      userId: args.where.userId,
    };
    await setJson(`macro:${args.where.userId}`, macro);
    return macro;
  },
};

const investmentPlanRepo = {
  async findUnique(args: { where: { userId: string } }) {
    return getJson<InvestmentPlan>(`iplan:${args.where.userId}`);
  },
  async upsert(args: {
    where: { userId: string };
    create: InvestmentPlan;
    update: Partial<InvestmentPlan>;
  }) {
    const existing = await getJson<InvestmentPlan>(`iplan:${args.where.userId}`);
    if (existing) {
      const updated: InvestmentPlan = {
        ...existing,
        ...args.update,
        userId: args.where.userId,
        updatedAt: now(),
      };
      await setJson(`iplan:${args.where.userId}`, updated);
      return updated;
    }
    const row: InvestmentPlan = {
      ...args.create,
      userId: args.where.userId,
      updatedAt: now(),
    };
    await setJson(`iplan:${args.where.userId}`, row);
    return row;
  },
};

const scenarioRepo = {
  ...makeCrud<Scenario>("scenario"),
  async updateMany(args: { where: Where; data: Partial<Scenario> }) {
    const rows = await getManyByUser<Scenario>("scenario", args.where.userId as string);
    for (const row of rows.filter((r) => matchesWhere(r, args.where))) {
      await updateEntity<Scenario>("scenario", row.id, args.data);
    }
  },
};

const planSnapshotRepo = {
  async create(args: { data: { userId: string; scenarioId?: string | null; deterministic: unknown; cashflowMonthly: unknown; netWorthMonthly: unknown } }) {
    const row: PlanSnapshot = {
      id: newId(),
      computedAt: now(),
      ...args.data,
    } as PlanSnapshot;
    await setJson(`planSnapshot:${row.id}`, row);
    await addToUserIndex("planSnapshot", row.userId, row.id);
    return row;
  },
};

const simulationJobRepo = {
  async create(args: { data: Partial<SimulationJob> & { userId: string } }) {
    const row = await createEntity<SimulationJob>("simJob", {
      status: "PENDING",
      progressPct: 0,
      numRuns: 5000,
      stepMonths: 1,
      params: {},
      errorMessage: null,
      scenarioId: null,
      startedAt: null,
      completedAt: null,
      ...args.data,
    } as SimulationJob, async (job) => {
      await redis.sadd(`idx:simJob:status:${job.status}`, job.id);
      await redis.rpush(`idx:simJob:pending`, job.id);
    });
    return row;
  },

  async findUnique(args: { where: { id: string }; include?: { scenario?: boolean } }) {
    const job = await getJson<SimulationJob>(`simJob:${args.where.id}`);
    if (!job) return null;
    const result: SimulationJob & { scenario?: Scenario | null } = { ...job };
    if (args.include?.scenario && job.scenarioId) {
      result.scenario = await getJson<Scenario>(`scenario:${job.scenarioId}`);
    }
    return result;
  },

  async findFirst(args: { where: Where; orderBy?: OrderBy; include?: { result?: boolean } }): Promise<(SimulationJob & { result?: SimulationResult | null }) | null> {
    let job: SimulationJob | null;
    if (args.where.status === "PENDING" && !args.where.userId) {
      job = await findFirstGlobal<SimulationJob>("simJob", args.where, { orderBy: args.orderBy });
    } else {
      job = await findFirstByUser<SimulationJob>("simJob", args.where, { orderBy: args.orderBy });
    }
    if (!job) return null;
    if (args.include?.result) {
      const result = await getJson<SimulationResult>(`simResult:${job.id}`);
      return { ...job, result };
    }
    return job;
  },

  async findMany(args: { where?: Where; orderBy?: OrderBy; take?: number; include?: { result?: boolean }; select?: Record<string, boolean> }) {
    let rows: SimulationJob[];
    if (args.where?.userId) {
      rows = await getManyByUser<SimulationJob>("simJob", args.where.userId as string);
      rows = rows.filter((r) => matchesWhere(r, args.where!));
    } else {
      rows = await findManyGlobal<SimulationJob>("simJob", args.where, { orderBy: args.orderBy, take: args.take });
    }
    if (args.where?.userId) {
      if (args.orderBy) rows = sortBy(rows, args.orderBy);
      if (args.take) rows = rows.slice(0, args.take);
    }
    if (args.include?.result) {
      return Promise.all(rows.map(async (job) => {
        const result = await getJson<SimulationResult>(`simResult:${job.id}`);
        return applySelect({ ...job, result }, args.select);
      }));
    }
    if (args.select) return rows.map((r) => applySelect(r, args.select));
    return rows;
  },

  async update(args: { where: { id: string }; data: Partial<SimulationJob> }) {
    const existing = await getJson<SimulationJob>(`simJob:${args.where.id}`);
    if (!existing) throw new Error("Job not found");
    if (args.data.status && args.data.status !== existing.status) {
      await redis.srem(`idx:simJob:status:${existing.status}`, existing.id);
      await redis.sadd(`idx:simJob:status:${args.data.status}`, existing.id);
      if (existing.status === "PENDING") {
        await redis.lrem(`idx:simJob:pending`, 0, existing.id);
      }
    }
    return updateEntity<SimulationJob>("simJob", args.where.id, args.data);
  },

  async count(args: { where: Where }) {
    if (args.where.userId) {
      return countByUser<SimulationJob>("simJob", args.where.userId as string, args.where);
    }
    if (args.where.status) {
      const ids = (await redis.smembers(`idx:simJob:status:${args.where.status}`)) ?? [];
      if (!args.where.createdAt && !args.where.completedAt) return ids.length;
      let count = 0;
      for (const id of ids) {
        const row = await getJson<SimulationJob>(`simJob:${id}`);
        if (row && matchesWhere(row, args.where)) count++;
      }
      return count;
    }
    return countAll<SimulationJob>("simJob", args.where);
  },
};

const simulationResultRepo = {
  async create(args: { data: Omit<SimulationResult, "id" | "createdAt"> & Partial<SimulationResult> }) {
    const row: SimulationResult = {
      id: newId(),
      createdAt: now(),
      ...args.data,
      sensitivity: args.data.sensitivity ?? null,
    } as SimulationResult;
    await setJson(`simResult:${row.jobId}`, row);
    return row;
  },
};

type Database = {
  user: typeof userRepo;
  macroSettings: typeof macroRepo;
  asset: EntityRepo<Asset>;
  liability: EntityRepo<Liability>;
  income: EntityRepo<Income>;
  expense: EntityRepo<Expense>;
  goal: EntityRepo<Goal>;
  budgetCategory: EntityRepo<BudgetCategory>;
  investmentPlan: typeof investmentPlanRepo;
  scenario: typeof scenarioRepo;
  planSnapshot: typeof planSnapshotRepo;
  simulationJob: typeof simulationJobRepo;
  simulationResult: typeof simulationResultRepo;
  $transaction: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
};

export const prisma: Database = {
  user: userRepo,
  macroSettings: macroRepo,
  asset: makeCrud<Asset>("asset"),
  liability: makeCrud<Liability>("liability"),
  income: makeCrud<Income>("income"),
  expense: makeCrud<Expense>("expense"),
  goal: makeCrud<Goal>("goal"),
  budgetCategory: makeCrud<BudgetCategory>("budgetCategory"),
  investmentPlan: investmentPlanRepo,
  scenario: scenarioRepo,
  planSnapshot: planSnapshotRepo,
  simulationJob: simulationJobRepo,
  simulationResult: simulationResultRepo,
  $transaction: <T>(fn: (tx: Database) => Promise<T>) => fn(prisma),
};

export type Db = Database;
export type InputJsonValue = JsonValue;
