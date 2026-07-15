import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { PageShell } from "@/components/layout/PageShell";

export default function HomePage() {
  return (
    <PageShell>
      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_-10%,#fff7ed_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_80%,#f0f3f7_0%,transparent_50%)]"
          aria-hidden
        />
        <section className="relative flex min-h-[calc(100vh-4.5rem)] flex-col justify-center px-4 py-16 sm:px-6 sm:py-20 lg:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Финкон
          </p>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[3.25rem] lg:leading-[1.15]">
            Финансовый план.{" "}
            <span className="text-accent">Цели без хаоса.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Введите доходы и цели — получите прогноз и вероятность успеха.
            Без лишних полей и сложной терминологии.
          </p>
          <div className="mt-8 sm:mt-10">
            <Link
              href="/register"
              className="inline-flex w-full justify-center rounded-xl bg-accent px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover sm:w-auto"
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
          <Disclaimer className="mt-12 max-w-xl sm:mt-16" />
        </section>
      </main>
    </PageShell>
  );
}
