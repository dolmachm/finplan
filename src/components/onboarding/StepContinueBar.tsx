"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  continueAfterSub,
  type DataSub,
  type JourneySteps,
} from "@/modules/dashboard/journey";

export function StepContinueBar({
  current,
  steps,
  onGoSub,
  onGoPlan,
}: {
  current: DataSub;
  steps: Pick<JourneySteps, "step1" | "step2" | "step3">;
  onGoSub: (sub: DataSub) => void;
  onGoPlan: () => void;
}) {
  const next = continueAfterSub(current, steps);
  if (!next) return null;

  return (
    <Card
      className={
        next.nextEmpty
          ? "flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand-light/50"
          : "flex flex-wrap items-center justify-between gap-4"
      }
    >
      <div>
        <p className="text-sm font-medium">{next.title}</p>
        <p className="mt-1 text-sm text-muted">{next.body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {next.kind === "data" && !next.nextEmpty ? (
          <Button type="button" variant="secondary" onClick={onGoPlan}>
            Сразу к плану
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => {
            if (next.kind === "plan") onGoPlan();
            else if (next.dataSub) onGoSub(next.dataSub);
          }}
        >
          {next.cta}
        </Button>
      </div>
    </Card>
  );
}
