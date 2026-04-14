"use client";

import { Card, Column, Heading, Text } from "@once-ui-system/core";

type MetricTone = "default" | "success" | "warning" | "brand" | "accent";

const toneColor: Record<MetricTone, string> = {
  success: "success-strong",
  warning: "warning-strong",
  brand: "brand-strong",
  accent: "accent-strong",
  default: "neutral-strong",
};

export function Metric({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: MetricTone;
}) {
  return (
    <Card
      className={`panel-card metric-card tone-${tone}`}
      fillWidth
      padding="24"
      border="neutral-alpha-weak"
      background="surface"
    >
      <Column gap="8">
        <Text variant="label-default-s" onBackground="neutral-weak">{title}</Text>
        <Heading
          as="h3"
          variant="display-strong-l"
          onBackground={toneColor[tone] as Parameters<typeof Heading>[0]["onBackground"]}
        >
          {value}
        </Heading>
        {subtitle && (
          <Text variant="body-default-s" onBackground="neutral-weak">{subtitle}</Text>
        )}
      </Column>
    </Card>
  );
}
