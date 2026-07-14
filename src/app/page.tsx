import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Disclaimer } from "@/components/Disclaimer";

const features = [
  "Активы, обязательства, доходы и расходы",
  "Цели с инфляцией и детерминированный прогноз",
  "Сценарии: базовый, консервативный, кризис",
  "Monte Carlo 1k–10k в фоновой очереди",
  "IF/ELSE шаблоны сценариев (MVP)",
  "PDF и CSV экспорт",
];

export default function HomePage() {
  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo />
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-brand">Персональное планирование</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
              Финансовый план с Monte Carlo
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Прозрачный cash-flow, прогноз чистых активов и вероятность достижения
              целей с учётом неопределённости. Данные изолированы по аккаунту.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-lg bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover"
              >
                Начать бесплатно
              </Link>
              <Link
                href="/faq"
                className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-brand-light"
              >
                FAQ
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-brand-light"
              >
                Как это считается
              </Link>
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {features.slice(0, 4).map((item) => (
                <div
                  key={item}
                  className="rounded-lg bg-brand-light/60 px-4 py-3 text-sm text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 rounded-full bg-brand-muted">
              <div className="h-2 w-2/3 rounded-full bg-brand" />
            </div>
            <p className="mt-4 text-xs text-muted">
              Вероятность достижения цели — на основе симуляций
            </p>
          </div>
        </section>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <li
              key={item}
              className="rounded-[var(--radius-card)] border border-border bg-card px-5 py-4 text-sm text-foreground shadow-[var(--shadow-card)]"
            >
              {item}
            </li>
          ))}
        </ul>
        <Disclaimer className="mt-16" />
      </main>
    </div>
  );
}
