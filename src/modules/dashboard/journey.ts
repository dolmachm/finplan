/**
 * Клиентский путь CFP: educate → gather → analyze.
 * Состояние выводится из уже существующих step1/2/3.
 */

import { useCallback, useSyncExternalStore } from "react";

export type DataSub = "balance" | "cashflow" | "goals";

export type JourneySteps = {
  step1: boolean;
  step2: boolean;
  step3: boolean;
  completenessPct: number;
};

export type JourneyPhase = "welcome" | "gather" | "ready";

export type JourneyNext = {
  dataSub: DataSub;
  label: string;
  hint: string;
  cta: string;
};

const ONBOARDING_KEY = "finplan-onboarding-v1";
const ONBOARDING_EVENT = "finplan-onboarding";

export function readOnboardingDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
    window.dispatchEvent(new Event(ONBOARDING_EVENT));
  } catch {
    /* private mode */
  }
}

function subscribeOnboarding(onStoreChange: () => void) {
  window.addEventListener(ONBOARDING_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(ONBOARDING_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** SSR: не показываем welcome (избегаем hydration mismatch). */
export function useOnboardingDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    subscribeOnboarding,
    readOnboardingDismissed,
    () => true,
  );
  const dismiss = useCallback(() => {
    dismissOnboarding();
  }, []);
  return [dismissed, dismiss];
}

export function resolveJourneyPhase(
  steps: JourneySteps,
  onboardingDismissed: boolean,
): JourneyPhase {
  if (steps.completenessPct >= 100) return "ready";
  if (steps.completenessPct === 0 && !onboardingDismissed) return "welcome";
  return "gather";
}

export function nextIncompleteStep(steps: JourneySteps): JourneyNext {
  if (!steps.step1) {
    return {
      dataSub: "balance",
      label: "Точка 0",
      hint: "Зафиксируйте активы и/или пассивы — от них считается баланс.",
      cta: "Начать с баланса",
    };
  }
  if (!steps.step2) {
    return {
      dataSub: "cashflow",
      label: "Денежный поток",
      hint: "Добавьте хотя бы один доход и один расход.",
      cta: "Продолжить: поток",
    };
  }
  if (!steps.step3) {
    return {
      dataSub: "goals",
      label: "Цели",
      hint: "Задайте цель и горизонт — без них план пустой.",
      cta: "Продолжить: цели",
    };
  }
  return {
    dataSub: "goals",
    label: "План",
    hint: "Данные готовы — смотрите прогноз и риски.",
    cta: "Открыть план",
  };
}

export function stepDoneForSub(
  sub: DataSub,
  steps: Pick<JourneySteps, "step1" | "step2" | "step3">,
): boolean {
  if (sub === "balance") return steps.step1;
  if (sub === "cashflow") return steps.step2;
  return steps.step3;
}

/** Следующий подшаг после текущего (для sticky CTA). */
export function continueAfterSub(
  current: DataSub,
  steps: Pick<JourneySteps, "step1" | "step2" | "step3">,
): {
  kind: "data" | "plan";
  dataSub?: DataSub;
  title: string;
  body: string;
  cta: string;
  /** Следующий шаг ещё пуст — first-time / in-progress. */
  nextEmpty: boolean;
} | null {
  if (current === "balance" && steps.step1) {
    if (!steps.step2) {
      return {
        kind: "data",
        dataSub: "cashflow",
        title: "Точка 0 готова",
        body: "Дальше — доходы и расходы. Это займёт пару минут.",
        cta: "Далее: денежный поток",
        nextEmpty: true,
      };
    }
    return {
      kind: "data",
      dataSub: "cashflow",
      title: "Точка 0 обновлена",
      body: "Поток уже заполнен — можете проверить или перейти дальше.",
      cta: "К денежному потоку",
      nextEmpty: false,
    };
  }

  if (current === "cashflow" && steps.step2) {
    if (!steps.step3) {
      return {
        kind: "data",
        dataSub: "goals",
        title: "Поток готов",
        body: "Осталось задать цели — и можно смотреть план.",
        cta: "Далее: цели",
        nextEmpty: true,
      };
    }
    return {
      kind: "data",
      dataSub: "goals",
      title: "Поток обновлён",
      body: "Цели уже есть — откройте их или сразу план.",
      cta: "К целям",
      nextEmpty: false,
    };
  }

  if (current === "goals" && steps.step3) {
    return {
      kind: "plan",
      title: steps.step1 && steps.step2 ? "Профиль заполнен" : "Цели сохранены",
      body:
        steps.step1 && steps.step2
          ? "Можно смотреть прогноз, риски и сценарии."
          : "Дозаполните баланс и поток — прогноз станет точнее.",
      cta: "Открыть план",
      nextEmpty: !(steps.step1 && steps.step2 && steps.step3),
    };
  }

  return null;
}
