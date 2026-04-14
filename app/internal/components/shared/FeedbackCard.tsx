"use client";

import { Card, Text } from "@once-ui-system/core";

type FeedbackTone = "success" | "danger" | "info" | "warning";

const toneColor: Record<FeedbackTone, string> = {
  success: "success-strong",
  danger: "danger-strong",
  info: "info-strong",
  warning: "warning-strong",
};

export function FeedbackCard({ tone, text }: { tone: FeedbackTone; text: string }) {
  return (
    <Card fillWidth padding="12" border="neutral-alpha-weak" background="surface">
      <Text onBackground={toneColor[tone] as Parameters<typeof Text>[0]["onBackground"]}>{text}</Text>
    </Card>
  );
}
