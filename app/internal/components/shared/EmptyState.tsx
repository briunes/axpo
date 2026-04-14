"use client";

import { Card, Column, Text } from "@once-ui-system/core";

export function EmptyState({ message }: { message: string }) {
  return (
    <Card fillWidth padding="24" border="neutral-alpha-weak" background="surface">
      <Column horizontal="center" gap="8">
        <Text onBackground="neutral-weak">{message}</Text>
      </Column>
    </Card>
  );
}
