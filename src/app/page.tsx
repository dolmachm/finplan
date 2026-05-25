import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-sm font-medium text-emerald-700">FinPlan</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
        Персональный финансовый план с Monte Carlo
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Прозрачный cash-flow, прогноз чистых активов и вероятность достижения
        целей с учётом неопределённости. Non-custodial: ваши данные изолированы
        по аккаунту.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white hover:bg-emerald-800"
        >
          Начать бесплатно
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 hover:bg-zinc-50"
        >
          Войти
        </Link>
      </div>
      <ul className="mt-12 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
        <li>Активы, обязательства, доходы и расходы</li>
        <li>Цели с инфляцией и детерминированный прогноз</li>
        <li>Сценарии: базовый, консервативный, кризис</li>
        <li>Monte Carlo 1k–10k в фоновой очереди</li>
        <li>IF/ELSE шаблоны сценариев (MVP)</li>
        <li>PDF и CSV экспорт</li>
      </ul>
      <Disclaimer className="mt-16" />
    </main>
  );
}
