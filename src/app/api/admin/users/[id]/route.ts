import { notFoundResponse } from "@/shared/api-validation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAction } from "@/modules/admin/admin-log";
import {
  getUser,
  updateUser,
  adjustBalance,
  setAccountStatus,
} from "@/modules/admin/admin.service";
import { requireAdmin } from "@/shared/admin-auth";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  STAKING: "Стейкинг",
  LISTING: "Листинг",
};

const updateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().nullable().optional(),
  role: z.enum(["USER", "CONSULTANT", "ADMIN"]).optional(),
  accountStatus: z.enum(["ACTIVE", "STAKING", "LISTING"]).optional(),
  balance: z.number().optional(),
  baseCurrency: z.string().min(1).optional(),
});

const balanceSchema = z.object({
  amount: z.number().positive(),
  operation: z.enum(["add", "subtract"]),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "STAKING", "LISTING"]),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id } = await params;
  const user = await getUser(id);
  if (!user) return notFoundResponse();
  return NextResponse.json({ user });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const before = await getUser(id);
    const user = await updateUser(id, parsed.data);
    void recordAdminAction({
      targetUserId: id,
      action: "USER_UPDATE",
      label: `Профиль обновлён: ${user.email}`,
      detail: { before, after: parsed.data },
    }).catch(() => {});
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (auth !== true) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action as string | undefined;

  if (action === "balance") {
    const parsed = balanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const delta =
      parsed.data.operation === "add" ? parsed.data.amount : -parsed.data.amount;
    const user = await adjustBalance(id, delta);
    const verb = parsed.data.operation === "add" ? "Начислено" : "Списано";
    void recordAdminAction({
      targetUserId: id,
      action: "BALANCE",
      label: `${verb} ${parsed.data.amount.toLocaleString("ru-RU")} ₽ (баланс: ${user.balance})`,
      detail: { operation: parsed.data.operation, amount: parsed.data.amount, balance: user.balance },
    }).catch(() => {});
    return NextResponse.json({ user });
  }

  if (action === "status") {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const user = await setAccountStatus(id, parsed.data.status);
    void recordAdminAction({
      targetUserId: id,
      action: "STATUS",
      label: `Статус → ${STATUS_LABELS[parsed.data.status] ?? parsed.data.status}`,
      detail: { status: parsed.data.status },
    }).catch(() => {});
    return NextResponse.json({ user });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
