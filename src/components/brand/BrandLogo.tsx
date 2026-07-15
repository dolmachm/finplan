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
  const text = variant === "light" ? "text-white" : "text-brand";

  return (
    <Link
      href={href}
      className={`inline-flex items-center ${text} ${className}`}
    >
      <span className="text-lg font-bold tracking-[0.04em] uppercase">
        Финкон
      </span>
    </Link>
  );
}
