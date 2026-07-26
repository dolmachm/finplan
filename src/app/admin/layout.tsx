export const dynamic = "force-dynamic";

/**
 * Admin UI uses cookie auth (`admin_session`) separate from NextAuth.
 * Hard authorization lives in `/api/admin/*` via `requireAdmin()`.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
