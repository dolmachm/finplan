import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";

export default function HowItWorksPage() {
  return (
    <PageShell narrow>
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        ← На главную
      </Link>
      <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">Как это считается</h1>

      <h2 className="mt-8 text-lg font-medium sm:text-xl">Денежный поток (месяц)</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
        Деньги, которые остаются за месяц: доходы после налогов и доход от
        инвестиций минус расходы, платежи по долгам и содержание активов.
      </p>

      <h2 className="mt-8 text-lg font-medium sm:text-xl">Инфляция целей</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
        Сервис учитывает, что из-за инфляции нужная сумма со временем растёт:
        целевая сумма на дату T: S<sub>T</sub> = S<sub>0</sub> × (1 +
        π)<sup>лет</sup>, где π — ваша годовая инфляция.
      </p>

      <h2 className="mt-8 text-lg font-medium sm:text-xl">Прогноз риска</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
        Сервис рассчитывает много возможных вариантов доходности (метод Monte
        Carlo) и показывает, как часто получится накопить нужную сумму к сроку —
        с учётом инфляции.
      </p>

      <p className="mt-8 border-t border-border pt-6 text-sm text-muted sm:mt-10">
        Есть вопросы по использованию? См.{" "}
        <Link href="/faq" className="font-medium text-brand hover:underline">
          FAQ
        </Link>
        . Результаты носят информационный характер и не являются индивидуальной
        инвестиционной рекомендацией.
      </p>
    </PageShell>
  );
}
