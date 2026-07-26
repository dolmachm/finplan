import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PwaInstallProvider } from "@/components/pwa/PwaInstall";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ФИНКОН — персональное финансовое планирование",
  description:
    "Доходы и расходы, чистые активы, цели и прогноз риска. Информационный сервис, не индивидуальная инвестиционная рекомендация.",
  applicationName: "ФИНКОН",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ФИНКОН",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3b5d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>
          <ToastProvider>
            <PwaInstallProvider>{children}</PwaInstallProvider>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
