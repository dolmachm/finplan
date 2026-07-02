import { NextResponse } from "next/server";
import { registerSchema, registerUser } from "@/modules/auth/auth.service";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";
import { isZodError, validationErrorResponse } from "@/shared/api-validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    await seedPredefinedScenarios(user.id);
    return NextResponse.json({ ok: true, user });
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
              fix: "Войдите в аккаунт или укажите другой email",
            },
          ],
        },
        { status: 409 },
      );
    }
    console.error("register failed", e);
    return NextResponse.json(
      {
        error: "Не удалось создать аккаунт",
        fix: "Проверьте подключение к БД и попробуйте позже",
      },
      { status: 500 },
    );
  }
}
