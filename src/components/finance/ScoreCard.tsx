"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import type { DataSub } from "@/modules/dashboard/journey";
import type {
  FinancialScore,
  ScoreBlock,
  ScoreBlockId,
  ScoreGradeId,
} from "@/modules/dashboard/scoring";
import {
  blockCta,
  getScoreBlock,
  scoreIsPending,
} from "@/modules/dashboard/scoring";

const gradeAccent: Record<ScoreGradeId, string> = {
  perfect: "text-emerald-700",
  strong: "text-emerald-700",
  adequate: "text-sky-700",
  developing: "text-amber-700",
  weak: "text-orange-700",
  critical: "text-red-700",
};

function ScoreCta({
  score,
  blockId,
  onNavigate,
}: {
  score: FinancialScore;
  blockId?: ScoreBlockId;
  onNavigate?: (tab: DashboardTab, opts?: { dataSub?: DataSub }) => void;
}) {
  if (score.status === "ready") return null;
  const text = blockId ? blockCta(blockId, score) || score.cta : score.cta;
  if (!text) return null;
  const tone =
    score.status === "empty" || score.status === "incomplete"
      ? "border-amber-200 bg-amber-50/80 text-amber-900"
      : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 ${tone}`}>
      <p className="text-xs">{text}</p>
      {onNavigate && score.ctaLabel && (
        <Button
          type="button"
          className="mt-2 !px-3 !py-1.5 !text-xs"
          onClick={() =>
            onNavigate("assets", {
              dataSub: score.ctaSub ?? "balance",
            })
          }
        >
          {score.ctaLabel}
        </Button>
      )}
    </div>
  );
}

function FactorList({ block }: { block: ScoreBlock }) {
  return (
    <ul className="mt-3 space-y-2 border-t border-border pt-3">
      {block.factors.map((f) => (
        <li key={f.id} className="text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{f.label}</span>
            <span className="tabular-nums text-muted">
              {f.value.toFixed(0)}
              <span className="text-muted/70">
                {" "}
                · {(f.weight * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <p className="mt-0.5 text-muted">{f.explanation}</p>
        </li>
      ))}
    </ul>
  );
}

function BlockMini({
  block,
  active,
  onClick,
  hideValue,
}: {
  block: ScoreBlock;
  active?: boolean;
  onClick?: () => void;
  hideValue?: boolean;
}) {
  const className = `rounded-md border px-3 py-2 text-left transition-colors ${
    active
      ? "border-foreground/30 bg-muted/40"
      : "border-border bg-card hover:bg-muted/30"
  } ${onClick ? "cursor-pointer" : ""}`;

  const value = hideValue ? "0" : block.score.toFixed(0);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-[11px] text-muted">{block.label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="text-[11px] text-muted">{block.label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ScoreCard({
  score,
  mode = "overall",
  blockId = "wealth",
  compact = false,
  onNavigate,
}: {
  score: FinancialScore;
  mode?: "overall" | "block";
  blockId?: ScoreBlockId;
  compact?: boolean;
  onNavigate?: (tab: DashboardTab, opts?: { dataSub?: DataSub }) => void;
}) {
  const pending = scoreIsPending(score);
  const [open, setOpen] = useState(!compact && !pending);
  const [focus, setFocus] = useState<ScoreBlockId>(blockId);
  const block = getScoreBlock(score, mode === "block" ? blockId : focus);
  const accent = score.grade ? gradeAccent[score.grade.id] : "text-muted";

  if (mode === "block") {
    return (
      <Card className={compact ? "p-4 sm:p-4" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Скоринг · {block.label}</p>
            {pending ? (
              <>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-muted">
                  0
                  <span className="ml-2 text-sm font-normal">/ 100</span>
                </p>
                <HelpHint className="mt-1">{block.description}</HelpHint>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {block.score.toFixed(0)}
                  <span className="ml-2 text-sm font-normal text-muted">
                    / 100
                  </span>
                </p>
                <HelpHint className="mt-1">{block.description}</HelpHint>
              </>
            )}
          </div>
          {!pending && (
            <button
              type="button"
              className="text-xs text-muted underline-offset-2 hover:underline"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Скрыть расшифровку" : "Расшифровка"}
            </button>
          )}
        </div>
        <ScoreCta score={score} blockId={blockId} onNavigate={onNavigate} />
        {!pending && open && <FactorList block={block} />}
      </Card>
    );
  }

  return (
    <Card className={compact ? "p-4 sm:p-4" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">
            {pending ? "Скоринг недоступен" : "Финансовый скоринг"}
          </p>
          {pending ? (
            <p className="mt-0.5 text-3xl font-semibold tabular-nums text-muted">
              0
              <span className="ml-2 text-sm font-normal">/ 100</span>
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-3xl font-semibold tabular-nums">
                {score.total.toFixed(0)}
                <span className="ml-2 text-sm font-normal text-muted">
                  / 100
                </span>
              </p>
              {score.grade && (
                <p className={`mt-1 text-sm font-medium ${accent}`}>
                  {score.grade.label}
                  <span className="font-normal text-muted">
                    {" "}
                    · {score.grade.range}
                  </span>
                </p>
              )}
              {score.grade && (
                <HelpHint className="mt-1 max-w-xl">
                  {score.grade.meaning}
                </HelpHint>
              )}
            </>
          )}
          {score.summary && (
            <p className="mt-1 text-[11px] text-muted/80">{score.summary}</p>
          )}
        </div>
        {!pending && (
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Скрыть расшифровку" : "Расшифровка"}
          </button>
        )}
      </div>

      <ScoreCta score={score} onNavigate={onNavigate} />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {score.blocks.map((b) => (
          <BlockMini
            key={b.id}
            block={b}
            hideValue={pending}
            active={!pending && focus === b.id}
            onClick={
              pending
                ? undefined
                : () => {
                    setFocus(b.id);
                    setOpen(true);
                  }
            }
          />
        ))}
      </div>

      {!pending && open && (
        <div className="mt-3">
          <p className="text-xs font-medium">{block.label}</p>
          <HelpHint className="mt-0.5">{block.description}</HelpHint>
          <FactorList block={block} />
        </div>
      )}
    </Card>
  );
}
