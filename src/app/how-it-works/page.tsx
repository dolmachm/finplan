import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-zinc">
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        ← На главную
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Как это считается</h1>

      <h2 className="text-xl font-medium mt-8">Денежный поток (месяц)</h2>
      <p className="text-zinc-600">
        CF = доходы после налогов + инвестиционные доходы − расходы (с
        индексацией) − платежи по долгам − содержание активов
      </p>

      <h2 className="text-xl font-medium mt-8">Инфляция целей</h2>
      <p className="text-zinc-600">
        Целевая сумма на дату T: S<sub>T</sub> = S<sub>0</sub> × (1 +
        π)<sup>лет</sup>, где π — ваша годовая инфляция.
      </p>

      <h2 className="text-xl font-medium mt-8">Monte Carlo</h2>
      <p className="text-zinc-600">
        Для каждого из N прогонов генерируются случайные отклонения доходности
        (коррелированные нормальные шоки). Вероятность цели = доля прогонов,
        где накопления ≥ инфляционно скорректированной суммы.
      </p>

      <p className="mt-8 text-sm text-zinc-500 border-t pt-6">
        Есть вопросы по использованию? См.{" "}
        <Link href="/faq" className="font-medium text-brand hover:underline">
          FAQ
        </Link>
        . Результаты носят информационный характер и не являются индивидуальной
        инвестиционной рекомендацией.
      </p>
    </main>
  );
}
