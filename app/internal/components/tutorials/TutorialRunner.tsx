"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Joyride, ACTIONS, EVENTS, STATUS, type EventData } from "react-joyride";
import { useI18n } from "@/lib/i18n-context";
import { loadSession } from "../../lib/authSession";
import { usePermissions } from "../../lib/permissionsContext";
import { canAccessTutorial, TUTORIALS } from "./tutorialCatalog";

export function TutorialRunner() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = loadSession()?.user.role;
  const { canDo } = usePermissions();
  const tutorialId = searchParams.get("tutorial");
  const tutorial = useMemo(() => {
    const match = TUTORIALS.find((item) => item.id === tutorialId);
    if (!match || !role || !canAccessTutorial(match, role, canDo)) return undefined;
    return match;
  }, [canDo, role, tutorialId]);
  const isContinuation = Boolean(tutorial?.continuationPrefix && pathname.startsWith(tutorial.continuationPrefix) && pathname !== tutorial.route);
  const sourceSteps = isContinuation && tutorial?.completionSteps ? tutorial.completionSteps : tutorial?.steps;
  const activeSteps = useMemo(() => sourceSteps?.map((step) => ({
    ...step,
    content: typeof step.content === "string" ? t("tutorials", step.content) : step.content,
    locale: step.locale
      ? Object.fromEntries(Object.entries(step.locale).map(([key, value]) => [
        key,
        typeof value === "string" ? t("tutorials", value) : value,
      ]))
      : undefined,
  })), [sourceSteps, t]);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const isAllowedPath = pathname === tutorial?.route || Boolean(tutorial?.continuationPrefix && pathname.startsWith(tutorial.continuationPrefix));
    if (!tutorial || !isAllowedPath) {
      setRun(false);
      return;
    }

    // Detail pages render their tour targets only after their data has loaded.
    // Keep Joyride stopped until the first target exists so navigation between
    // the list and detail phases cannot leave a blank overlay on screen.
    setRun(false);
    setStepIndex(0);
    const firstTarget = activeSteps?.[0]?.target;
    const selector = typeof firstTarget === "string" ? firstTarget : null;
    let timer: number | undefined;
    let observer: MutationObserver | null = null;

    const startWhenReady = () => {
      if (selector && !document.querySelector(selector)) return false;
      timer = window.setTimeout(() => setRun(true), 150);
      observer?.disconnect();
      return true;
    };

    if (!startWhenReady() && selector) {
      observer = new MutationObserver(startWhenReady);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [activeSteps, pathname, tutorial]);

  useEffect(() => {
    if (!run || !activeSteps) return;
    const stepData = activeSteps[stepIndex]?.data;
    const appearSelector = stepData?.advanceWhenTargetAppears;
    const disappearSelector = stepData?.advanceWhenTargetDisappears;
    const optionalSelector = stepData?.skipUnlessTargetExists;
    if (typeof optionalSelector === "string" && !document.querySelector(optionalSelector)) {
      setStepIndex(current => current + 1);
      return;
    }
    if (typeof appearSelector !== "string" && typeof disappearSelector !== "string") return;

    let advanced = false;
    let observer: MutationObserver | null = null;
    const advanceIfReady = () => {
      const appeared = typeof appearSelector === "string" && Boolean(document.querySelector(appearSelector));
      const disappeared = typeof disappearSelector === "string" && !document.querySelector(disappearSelector);
      if (!advanced && (appeared || disappeared)) {
        advanced = true;
        observer?.disconnect();
        setStepIndex(current => current + 1);
      }
    };
    advanceIfReady();
    observer = new MutationObserver(advanceIfReady);
    if (!advanced) observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeSteps, run, stepIndex]);

  const finish = () => {
    setRun(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tutorial");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  const handleEvent = (data: EventData) => {
    // Route changes between the list and detail phases emit a transient
    // completion event when the required-navigation target disappears. A
    // multi-page tutorial can only genuinely finish in its continuation phase.
    const isInitialMultiPagePhase = Boolean(tutorial?.completionSteps && !isContinuation);
    if (data.status === STATUS.SKIPPED && data.action === ACTIONS.SKIP) finish();
    if (
      data.status === STATUS.FINISHED &&
      data.action === ACTIONS.NEXT &&
      !isInitialMultiPagePhase
    ) finish();
    if (data.type === EVENTS.STEP_AFTER) {
      if (data.action === ACTIONS.NEXT) {
        const dismissSelector = activeSteps?.[data.index]?.data?.dismissTargetOnNext;
        if (typeof dismissSelector === "string") {
          document.querySelector<HTMLElement>(dismissSelector)?.click();
        }
        const skipNextStep = Boolean(activeSteps?.[data.index]?.data?.skipNextStepOnNext);
        const eventOnNext = activeSteps?.[data.index]?.data?.dispatchEventOnNext;
        if (typeof eventOnNext === "string") {
          window.dispatchEvent(new CustomEvent(eventOnNext));
        }
        setStepIndex(data.index + (skipNextStep ? 2 : 1));
      }
      if (data.action === ACTIONS.PREV) setStepIndex(Math.max(0, data.index - 1));
    }
  };

  if (!tutorial || !activeSteps) return null;

  return (
    <Joyride
      run={run}
      stepIndex={stepIndex}
      key={`${tutorial.id}-${isContinuation ? "completion" : "main"}`}
      steps={activeSteps}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{
        back: t("tutorials", "controlBack"),
        close: t("tutorials", "controlClose"),
        last: t("tutorials", "controlFinish"),
        next: t("tutorials", "controlNext"),
        nextWithProgress: t("tutorials", "controlNextWithProgress"),
        open: t("tutorials", "controlOpen"),
        skip: t("tutorials", "controlSkip"),
      }}
      options={{
        buttons: ["back", "skip", "primary"],
        overlayClickAction: false,
        primaryColor: "#e51b3e",
        showProgress: true,
        skipBeacon: true,
        targetWaitTimeout: 300000,
        zIndex: 1600,
      }}
      floatingOptions={{
        strategy: "fixed",
        flipOptions: { padding: 16 },
        shiftOptions: { padding: 16 },
      }}
      styles={{
        floater: { maxWidth: "calc(100vw - 32px)" },
        tooltip: {
          borderRadius: 10,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
        },
      }}
    />
  );
}
