import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-card px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,#fff7ed_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="relative mb-8">
        <BrandLogo />
      </div>
      <Card className="relative w-full max-w-md border-border/80 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        {children}
      </Card>
    </div>
  );
}
