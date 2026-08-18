import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { FAQ_ITEMS, STAGE_LEARNING } from "@/content/help";

export default function FaqPage() {
  return (
    <PageShell narrow>
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        ← На главную
      </Link>
      <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">FAQ — как пользоваться</h1>
      <p className="mt-3 text-muted">
        Простые ответы для новичков: без специальной подготовки по финансам и экономике.
        Здесь же — что значат поля в кабинете и с чего начать.
      </p>
      <section className="mt-6 rounded-[var(--radius-card)] border border-brand/20 bg-brand-light/40 p-4 shadow-[var(--shadow-card)] sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Быстрый старт
        </p>
        <ol className="mt-2 space-y-2 text-sm leading-relaxed text-foreground">
          <li>1. На главной пройдите короткий онбординг и начните с «Точки 0».</li>
          <li>2. Затем заполните «Поток» и «Цели» в таком порядке.</li>
          <li>3. После каждого этапа используйте кнопку «Далее», а потом откройте «План».</li>
          <li>4. Если не хватает данных, берите приблизительные значения и уточняйте позже.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          Если вопрос связан с конкретным этапом, переходите сразу к нужному блоку ниже.
        </p>
      </section>

      <div className="mt-8 space-y-6 sm:mt-10">
        {(["welcome", "balance", "cashflow", "goals", "plan"] as const).map((stage) => {
          const section = STAGE_LEARNING[stage];
          return (
            <section
              key={section.id}
              id={`stage-${section.id}`}
              className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-brand">
                {section.eyebrow}
              </p>
              <h2 className="mt-1 font-medium text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{section.summary}</p>

              <h3 className="mt-4 text-sm font-medium text-foreground">Что делать на этапе</h3>
              <ol className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
                {section.learn.map((item, index) => (
                  <li key={item}>
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>

              <h3 className="mt-4 text-sm font-medium text-foreground">Подробный FAQ</h3>
              <div className="mt-2 space-y-3">
                {section.faq.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-xl border border-border bg-background/60 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">{item.q}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.a}</p>
                  </div>
                ))}
              </div>

              {section.footnotes?.length ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Сноски
                  </p>
                  <ol className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
                    {section.footnotes.map((note, index) => (
                      <li key={note}>
                        [{index + 1}] {note}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="mt-8 space-y-4 sm:mt-10 sm:space-y-6">
        <h2 className="text-lg font-medium sm:text-xl">Общие вопросы</h2>
        {FAQ_ITEMS.map((item) => (
          <section
            key={item.q}
            className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
          >
            <h2 className="font-medium text-foreground">{item.q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted sm:mt-10">
        Подробнее о формулах расчёта — на странице{" "}
        <Link href="/how-it-works" className="font-medium text-brand hover:underline">
          Как это считается
        </Link>
        .
      </p>
    </PageShell>
  );
}
