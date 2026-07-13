import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { registerSchema, registerUser } from "@/modules/auth/auth.service";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";
import { isZodError, validationErrorResponse } from "@/shared/api-validation";

function prismaErrorResponse(e: Prisma.PrismaClientKnownRequestError) {
  if (e.code === "P2021") {
    return NextResponse.json(
      {
        error: "База данных не настроена",
        fix: "Выполните в терминале: npm run db:push",
      },
      { status: 503 },
    );
  }
  if (e.code === "P1001" || e.code === "P1000") {
    return NextResponse.json(
      {
        error: "Нет подключения к базе данных",
        fix: "Проверьте DATABASE_URL в .env и доступность PostgreSQL",
      },
      { status: 503 },
    );
  }
  return null;
}

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
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const response = prismaErrorResponse(e);
      if (response) return response;
    }
    if (e instanceof Error && e.message === "DATABASE_URL is not set") {
      return NextResponse.json(
        {
          error: "База данных не настроена",
          fix: "Добавьте DATABASE_URL в файл .env",
        },
        { status: 503 },
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
