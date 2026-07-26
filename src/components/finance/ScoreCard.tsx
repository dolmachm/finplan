"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import type {
  FinancialScore,
  ScoreBlock,
  ScoreBlockId,
  ScoreGradeId,
} from "@/modules/dashboard/scoring";
import { getScoreBlock } from "@/modules/dashboard/scoring";

const gradeAccent: Record<ScoreGradeId, string> = {
  perfect: "text-emerald-700",
  strong: "text-emerald-700",
  adequate: "text-sky-700",
  developing: "text-amber-700",
  weak: "text-orange-700",
  critical: "text-red-700",
};

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
}: {
  block: ScoreBlock;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = `rounded-md border px-3 py-2 text-left transition-colors ${
    active
      ? "border-foreground/30 bg-muted/40"
      : "border-border bg-card hover:bg-muted/30"
  } ${onClick ? "cursor-pointer" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-[11px] text-muted">{block.label}</p>
        <p className="text-lg font-semibold tabular-nums">
          {block.score.toFixed(0)}
        </p>
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="text-[11px] text-muted">{block.label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {block.score.toFixed(0)}
      </p>
    </div>
  );
}

export function ScoreCard({
  score,
  mode = "overall",
  blockId = "wealth",
  compact = false,
}: {
  score: FinancialScore;
  mode?: "overall" | "block";
  blockId?: ScoreBlockId;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [focus, setFocus] = useState<ScoreBlockId>(blockId);
  const block = getScoreBlock(score, mode === "block" ? blockId : focus);
  const accent = gradeAccent[score.grade.id];

  if (mode === "block") {
    return (
      <Card className={compact ? "p-4 sm:p-4" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Скоринг · {block.label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              {block.score.toFixed(0)}
              <span className="ml-2 text-sm font-normal text-muted">/ 100</span>
            </p>
            <HelpHint className="mt-1">{block.description}</HelpHint>
          </div>
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Скрыть расшифровку" : "Расшифровка"}
          </button>
        </div>
        {open && <FactorList block={block} />}
      </Card>
    );
  }

  return (
    <Card className={compact ? "p-4 sm:p-4" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Финансовый скоринг</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums">
            {score.total.toFixed(0)}
            <span className="ml-2 text-sm font-normal text-muted">/ 100</span>
          </p>
          <p className={`mt-1 text-sm font-medium ${accent}`}>
            {score.grade.label}
            <span className="font-normal text-muted">
              {" "}
              · {score.grade.range}
            </span>
          </p>
          <HelpHint className="mt-1 max-w-xl">{score.grade.meaning}</HelpHint>
          <p className="mt-1 text-[11px] text-muted/80">{score.summary}</p>
        </div>
        <button
          type="button"
          className="text-xs text-muted underline-offset-2 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Скрыть расшифровку" : "Расшифровка"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {score.blocks.map((b) => (
          <BlockMini
            key={b.id}
            block={b}
            active={focus === b.id}
            onClick={() => {
              setFocus(b.id);
              setOpen(true);
            }}
          />
        ))}
      </div>

      {open && (
        <div className="mt-3">
          <p className="text-xs font-medium">{block.label}</p>
          <HelpHint className="mt-0.5">{block.description}</HelpHint>
          <FactorList block={block} />
        </div>
      )}
    </Card>
  );
}
