import { NextResponse } from "next/server";
import { registerSchema, registerUser } from "@/modules/auth/auth.service";
import { seedPredefinedScenarios } from "@/modules/simulation/simulation.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    await seedPredefinedScenarios(user.id);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { error: "Email уже зарегистрирован" },
        { status: 409 },
      );
    }
    console.error("register failed", e);
    return NextResponse.json(
      { error: "Не удалось создать аккаунт. Проверьте данные и подключение к БД." },
      { status: 400 },
    );
  }
}
