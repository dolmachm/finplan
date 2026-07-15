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
        CF = доходы после налогов + инвестиционные доходы − расходы (с
        индексацией) − платежи по долгам − содержание активов
      </p>

      <h2 className="mt-8 text-lg font-medium sm:text-xl">Инфляция целей</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
        Целевая сумма на дату T: S<sub>T</sub> = S<sub>0</sub> × (1 +
        π)<sup>лет</sup>, где π — ваша годовая инфляция.
      </p>

      <h2 className="mt-8 text-lg font-medium sm:text-xl">Monte Carlo</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
        Для каждого из N прогонов генерируются случайные отклонения доходности
        (коррелированные нормальные шоки). Вероятность цели = доля прогонов,
        где накопления ≥ инфляционно скорректированной суммы.
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
