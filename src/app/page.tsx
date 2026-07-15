import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Disclaimer } from "@/components/Disclaimer";

const features = [
  {
    title: "Личный финансовый план",
    text: "Прогноз чистых активов по месяцам: доходы, расходы, долги и цели в одной картине.",
    icon: "◈",
  },
  {
    title: "Быстрый старт",
    text: "Заполните баланс и денежный поток — получите рекомендации и следующий шаг без лишней теории.",
    icon: "⚡",
  },
  {
    title: "Финансовые цели",
    text: "Квартира, подушка, учёба: срок, сумма и достижимость с учётом инфляции и взносов.",
    icon: "◎",
  },
  {
    title: "Персональный кабинет",
    text: "Данные только вашего аккаунта. Сценарии «что если», инвест-план и экспорт отчёта.",
    icon: "◇",
  },
] as const;

const portfolioPoints = [
  {
    title: "Точная аналитика",
    text: "Активы, пассивы, профицит и конверт бюджета — цифры для решений, а не «средний по рынку».",
  },
  {
    title: "Прозрачный расчёт",
    text: "Доходность, взносы и горизонт видимы. Формулы и допущения — на странице «Как это считается».",
  },
  {
    title: "Monte Carlo",
    text: "Тысячи случайных сценариев рынка: вероятность цели, медиана и коридор исходов.",
  },
  {
    title: "Сценарии и план",
    text: "IF/THEN-шаблоны, сравнение вариантов и годовой инвест-план без двойного учёта.",
  },
] as const;

const useCases = [
  {
    title: "Кредиты и долги",
    text: "Учёт пассивов, платёж и стратегии погашения рядом с cash-flow — чтобы видеть реальный остаток.",
  },
  {
    title: "Планирование бюджета",
    text: "Доходы, расходы и конверты категорий: сколько можно откладывать без «дыры» в месяце.",
  },
  {
    title: "Контроль финансов",
    text: "Баланс, цели и прогноз на одной оси времени — меньше хаоса в таблицах и больше ясности.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-full bg-card text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <BrandLogo />
          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/how-it-works"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              Как считаем
            </Link>
            <Link
              href="/faq"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-light hover:text-foreground"
            >
              FAQ
            </Link>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-light px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white"
          >
            Войти
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(ellipse_70%_80%_at_85%_20%,#e8faf1_0%,transparent_50%),linear-gradient(180deg,#fff_0%,#f4f7f9_100%)]">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-12 lg:py-24">
            <div>
              <h1 className="max-w-xl text-3xl font-bold tracking-tight text-brand sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                Взгляните на личные финансы{" "}
                <span className="text-accent">по-новому</span> вместе с нами
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
                Научитесь распределять бюджет и получите инструменты: прогноз,
                цели и вероятность успеха без сложной терминологии.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex justify-center rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  Начать бесплатно
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex justify-center rounded-xl border border-brand/25 bg-card px-6 py-3.5 text-sm font-medium text-brand transition-colors hover:bg-brand-light"
                >
                  Как это считается
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
              <div className="absolute -right-4 top-6 h-48 w-48 rounded-full bg-accent/15 blur-2xl sm:h-56 sm:w-56" />
              <div className="relative space-y-4">
                <div className="ml-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:ml-10">
                  <p className="text-xs font-medium text-muted">Чистые активы</p>
                  <p className="mt-1 text-xl font-bold text-brand">4 280 000 ₽</p>
                  <div className="mt-4 flex h-16 items-end gap-1">
                    {[40, 55, 48, 62, 70, 68, 82, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-brand/20"
                        style={{ height: `${h}%` }}
                      >
                        <div
                          className="w-full rounded-t bg-accent"
                          style={{ height: `${Math.max(20, h - 25)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mr-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:mr-10">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-brand">Цель: квартира</p>
                    <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold text-accent-hover">
                      72%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-muted">
                    <div className="h-full w-[72%] rounded-full bg-accent" />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Вероятность по Monte Carlo · взнос 45 000 ₽/мес
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-border bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-brand sm:text-3xl">
              Функционал платформы
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted sm:text-base">
              Всё для персонального плана: от точки «ноль» до сценариев и PDF-отчёта.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <article
                  key={f.title}
                  className="rounded-[var(--radius-card)] border border-border bg-background p-5 shadow-[var(--shadow-card)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-lg text-brand">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-brand">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-b border-border bg-background py-14 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
            <div className="flex flex-col rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-8">
              <h3 className="text-xl font-semibold">Персональный финансовый план</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/80">
                Соберите активы, cash-flow и цели — сервис покажет рекомендуемый взнос,
                график капитала и узкие места бюджета.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex justify-center rounded-xl bg-card px-5 py-3 text-sm font-semibold text-brand transition-opacity hover:opacity-90"
              >
                Собрать свой план
              </Link>
            </div>
            <div className="flex flex-col rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-8">
              <h3 className="text-xl font-semibold">Симуляции и сценарии</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/80">
                Запустите Monte Carlo, сравните кризисный и базовый сценарии,
                настройте правила «что если» — без таблиц вручную.
              </p>
              <Link
                href="/faq"
                className="mt-6 inline-flex justify-center rounded-xl bg-card px-5 py-3 text-sm font-semibold text-brand transition-opacity hover:opacity-90"
              >
                Узнать подробнее
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-b border-border bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-brand sm:text-3xl">
              Почему Финкон
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted sm:text-base">
              Инструмент планирования под ваши цифры — не универсальный «совет за 15%».
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {portfolioPoints.map((p) => (
                <article
                  key={p.title}
                  className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6"
                >
                  <h3 className="text-base font-semibold text-brand">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="border-b border-border bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-brand sm:text-3xl">
              Что можно решить в сервисе
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {useCases.map((u) => (
                <article
                  key={u.title}
                  className="rounded-[var(--radius-card)] border border-border border-b-4 border-b-accent bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <h3 className="font-semibold text-brand">{u.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{u.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link
                href="/register"
                className="inline-flex rounded-xl bg-brand px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Перейти в кабинет
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-light/60 py-12 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div>
              <BrandLogo />
              <p className="mt-3 max-w-xs text-sm text-muted">
                Откройте для себя спокойный способ управлять деньгами —{" "}
                <span className="font-medium text-accent-hover">план, цели, вероятность</span>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:gap-16">
              <div>
                <p className="font-semibold text-brand">Сервис</p>
                <ul className="mt-3 space-y-2 text-muted">
                  <li>
                    <Link href="/register" className="hover:text-foreground">
                      Регистрация
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-foreground">
                      Вход
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="hover:text-foreground">
                      FAQ
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-brand">О расчётах</p>
                <ul className="mt-3 space-y-2 text-muted">
                  <li>
                    <Link href="/how-it-works" className="hover:text-foreground">
                      Как это считается
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="hover:text-foreground">
                      Monte Carlo
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <Disclaimer className="mt-10 border-t border-border pt-6" />
        </div>
      </footer>
    </div>
  );
}
