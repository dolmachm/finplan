import Link from "next/link";

export function BrandLogo({
  href = "/",
  variant = "default",
}: {
  href?: string;
  variant?: "default" | "light";
}) {
  const text = variant === "light" ? "text-white" : "text-sidebar";
  const mark = variant === "light" ? "bg-white text-brand" : "bg-brand text-white";

  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 ${text}`}>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${mark}`}
      >
        Ф
      </span>
      <span className="text-lg font-semibold tracking-tight">ФИНКОН</span>
    </Link>
  );
}
