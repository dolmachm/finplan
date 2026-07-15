import Link from "next/link";

export function BrandLogo({
  href = "/",
  variant = "default",
  className = "",
}: {
  href?: string;
  variant?: "default" | "light";
  className?: string;
}) {
  const text = variant === "light" ? "text-white" : "text-foreground";
  const mark =
    variant === "light"
      ? "bg-white text-brand"
      : "bg-brand text-white";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 ${text} ${className}`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${mark}`}
      >
        Ф
      </span>
      <span className="text-lg font-bold tracking-tight">ФИНКОН</span>
    </Link>
  );
}
