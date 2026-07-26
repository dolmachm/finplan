import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PwaInstallButton } from "@/components/pwa/PwaInstall";

export function PageShell({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="min-h-full bg-card">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <BrandLogo />
          <div className="flex items-center gap-2 sm:gap-3">
            <PwaInstallButton compact />
            <Link
              href="/login"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Войти
            </Link>
          </div>
        </div>
      </header>
      <div
        className={
          narrow
            ? "mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
            : "mx-auto max-w-5xl"
        }
      >
        {children}
      </div>
    </div>
  );
}
