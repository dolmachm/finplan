import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser, updateUser, adjustBalance, setAccountStatus } from "@/modules/admin/admin.service";
import { requireAdmin } from "@/shared/admin-auth";

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
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
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
    const user = await updateUser(id, parsed.data);
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
    return NextResponse.json({ user });
  }

  if (action === "status") {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const user = await setAccountStatus(id, parsed.data.status);
    return NextResponse.json({ user });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
