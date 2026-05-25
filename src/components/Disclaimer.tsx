import Link from "next/link";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 ${className}`}>
      Результаты носят информационный характер и не являются индивидуальной
      инвестиционной рекомендацией.{" "}
      <Link href="/how-it-works" className="underline hover:text-zinc-700">
        Как это считается
      </Link>
    </p>
  );
}
