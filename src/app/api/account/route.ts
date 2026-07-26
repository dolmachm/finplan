import { NextResponse } from "next/server";
import {
  getAccount,
  softDeleteAccount,
  updateProfile,
  updateProfileSchema,
} from "@/modules/account/account.service";
import {
  isZodError,
  notFoundResponse,
  parseJsonBody,
  validationErrorResponse,
} from "@/shared/api-validation";
import { isErrorResponse, requireUserId } from "@/shared/session";

export async function GET() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const account = await getAccount(userId);
  if (!account) return notFoundResponse();
  return NextResponse.json(account);
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const parsed = parseJsonBody(updateProfileSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  try {
    const account = await updateProfile(userId, parsed.data);
    return NextResponse.json(account);
  } catch (e) {
    if (isZodError(e)) {
      return validationErrorResponse(e.issues);
    }
    if (e instanceof Error && e.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        {
          error: "Email уже зарегистрирован",
          issues: [
            {
              field: "email",
              message: "Этот email уже используется",
              fix: "Укажите другой email",
            },
          ],
        },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return notFoundResponse();
    }
    console.error("update profile failed", e);
    return NextResponse.json(
      { error: "Не удалось обновить профиль" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  try {
    await softDeleteAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return notFoundResponse();
    }
    console.error("delete account failed", e);
    return NextResponse.json(
      { error: "Не удалось удалить профиль" },
      { status: 500 },
    );
  }
}
