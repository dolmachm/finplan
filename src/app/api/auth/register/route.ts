import { NextResponse } from "next/server";
import { registerSchema, registerUser } from "@/modules/auth/auth.service";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";
import { isZodError, validationErrorResponse } from "@/shared/api-validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = registerSchema.parse(body);
    const user = await registerUser(input);

    try {
      await seedPredefinedScenarios(user.id);
    } catch (seedError) {
      console.error("seed scenarios failed for new user", user.id, seedError);
    }

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
    if (
      e instanceof Error &&
      (e.message.includes("UPSTASH_REDIS") || e.message.includes("must be set"))
    ) {
      return NextResponse.json(
        {
          error: "База данных не настроена",
          fix: "Добавьте UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN в .env",
        },
        { status: 503 },
      );
    }
    console.error("register failed", e);
    return NextResponse.json(
      {
        error: "Не удалось создать аккаунт",
        fix: "Проверьте подключение к Redis и попробуйте позже",
      },
      { status: 500 },
    );
  }
}
