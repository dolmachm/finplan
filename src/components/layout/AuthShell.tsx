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
    <div className="flex min-h-full flex-col items-center justify-center bg-[linear-gradient(180deg,#eff6ff_0%,var(--background)_45%)] px-6 py-16">
      <div className="mb-8">
        <BrandLogo />
      </div>
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        )}
        {children}
      </Card>
    </div>
  );
}
