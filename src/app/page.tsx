import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Disclaimer } from "@/components/Disclaimer";

export default function HomePage() {
  return (
    <div className="min-h-full bg-card">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <Link
            href="/login"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Войти
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-10%,#fff7ed_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_80%,#f0f3f7_0%,transparent_50%)]"
          aria-hidden
        />
        <section className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-5xl flex-col justify-center px-6 py-20 lg:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Финкон
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.15]">
            Финансовый план.{" "}
            <span className="text-accent">Цели без хаоса.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Введите доходы и цели — получите прогноз и вероятность успеха.
            Без лишних полей и сложной терминологии.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover"
            >
              Начать
            </Link>
          </div>
          <p className="mt-8 text-sm text-muted">
            <Link href="/how-it-works" className="hover:text-foreground hover:underline">
              Как это считается
            </Link>
            <span className="mx-2 text-border">·</span>
            <Link href="/faq" className="hover:text-foreground hover:underline">
              FAQ
            </Link>
          </p>
          <Disclaimer className="mt-16 max-w-xl" />
        </section>
      </main>
    </div>
  );
}
