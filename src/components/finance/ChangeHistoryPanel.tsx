"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import type { EntityRevision } from "@/shared/types";

export function ChangeHistoryPanel({
  onUnauthorized,
}: {
  onUnauthorized: (res: Response) => boolean;
}) {
  const [items, setItems] = useState<EntityRevision[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/history?limit=30", { cache: "no-store" });
    if (onUnauthorized(res)) return;
    if (!res.ok) return;
    const data = (await res.json()) as { items: EntityRevision[] };
    setItems(data.items ?? []);
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-medium">История изменений</h2>
        <HelpHint>
          Журнал правок активов, целей, макропараметров и инвест-плана (CFP audit trail).
        </HelpHint>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Пока нет записей</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {items.map((r) => (
            <li key={r.id} className="border-b border-border/50 pb-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.label}</span>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(r.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="text-xs text-muted">
                {r.entityType} · {r.action}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
