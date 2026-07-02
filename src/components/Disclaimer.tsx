import Link from "next/link";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 ${className}`}>
      Результаты носят информационный характер и не являются индивидуальной
      инвестиционной рекомендацией.{" "}
      <Link href="/how-it-works" className="text-brand hover:underline">
        Как это считается
      </Link>
    </p>
  );
}
