import { NextResponse } from "next/server";
import {
  changePassword,
  changePasswordSchema,
} from "@/modules/account/account.service";
import {
  isZodError,
  notFoundResponse,
  parseJsonBody,
  validationErrorResponse,
} from "@/shared/api-validation";
import { isErrorResponse, requireUserId } from "@/shared/session";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (isErrorResponse(userId)) return userId;

  const parsed = parseJsonBody(changePasswordSchema, await req.json());
  if (!parsed.ok) return parsed.response;

  try {
    await changePassword(userId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isZodError(e)) {
      return validationErrorResponse(e.issues);
    }
    if (e instanceof Error && e.message === "INVALID_PASSWORD") {
      return NextResponse.json(
        {
          error: "Неверный текущий пароль",
          issues: [
            {
              field: "currentPassword",
              message: "Неверный текущий пароль",
              fix: "Проверьте пароль и попробуйте снова",
            },
          ],
        },
        { status: 400 },
      );
    }
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return notFoundResponse();
    }
    console.error("change password failed", e);
    return NextResponse.json(
      { error: "Не удалось сменить пароль" },
      { status: 500 },
    );
  }
}
