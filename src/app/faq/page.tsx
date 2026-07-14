import Link from "next/link";
import { FAQ_ITEMS } from "@/content/help";

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        ← На главную
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">FAQ — как пользоваться</h1>
      <p className="mt-3 text-muted">
        Простые ответы для новичков: без специальной подготовки по финансам и экономике.
        Здесь же — что значат поля в кабинете и с чего начать.
      </p>

      <div className="mt-10 space-y-6">
        {FAQ_ITEMS.map((item) => (
          <section
            key={item.q}
            className="rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <h2 className="font-medium text-foreground">{item.q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        Подробнее о формулах расчёта — на странице{" "}
        <Link href="/how-it-works" className="font-medium text-brand hover:underline">
          Как это считается
        </Link>
        .
      </p>
    </main>
  );
}
