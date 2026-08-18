"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { LearningStageId } from "@/content/help";
import { STAGE_LEARNING } from "@/content/help";

const HOW_IT_WORKS_TARGET: Partial<Record<LearningStageId, string>> = {
  cashflow: "/how-it-works#cashflow",
  goals: "/how-it-works#goals",
  plan: "/how-it-works#risk",
};

export function StageLearningCard({
  stage,
  compact = false,
  bare = false,
}: {
  stage: LearningStageId;
  compact?: boolean;
  bare?: boolean;
}) {
  const content = STAGE_LEARNING[stage];
  const faqHref = `/faq#stage-${stage}`;
  const howItWorksHref = HOW_IT_WORKS_TARGET[stage] ?? "/how-it-works";

  const inner = (
    <>
      {!bare && (
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          {content.eyebrow}
        </p>
      )}
      <h3 className={bare ? "font-medium text-foreground" : "mt-1 font-medium text-foreground"}>
        {content.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{content.summary}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h4 className="text-sm font-medium text-foreground">Что важно на этом этапе</h4>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
            {content.learn.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-medium text-brand" aria-hidden>
                  {index + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="text-sm font-medium text-foreground">FAQ</h4>
          <div className="mt-2 space-y-3">
            {content.faq.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-border bg-background/60 p-3"
              >
                <p className="text-sm font-medium text-foreground">{item.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {content.footnotes?.length ? (
        <section className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Сноски
          </p>
          <ol className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
            {content.footnotes.map((note, index) => (
              <li key={note}>
                [{index + 1}] {note}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <Link href={faqHref} className="font-medium text-brand hover:underline">
          FAQ по этому этапу
        </Link>
        <Link
          href={howItWorksHref}
          className="font-medium text-brand hover:underline"
        >
          Как это считается
        </Link>
      </div>
    </>
  );

  if (bare) return inner;
  return <Card className={compact ? "!p-4" : ""}>{inner}</Card>;
}

/** Полный блок сверху только на первом проходе; иначе — свёрнутый раздел внизу. */
export function StageHelp({
  stage,
  prominent,
}: {
  stage: LearningStageId;
  prominent: boolean;
}) {
  if (prominent) return <StageLearningCard stage={stage} compact />;

  return (
    <CollapsibleSection
      title="Обучение и FAQ"
      subtitle="Подсказки по этапу, частые вопросы и сноски"
      defaultOpen={false}
    >
      <StageLearningCard stage={stage} bare />
    </CollapsibleSection>
  );
}
