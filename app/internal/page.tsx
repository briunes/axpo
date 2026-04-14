"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Column, Text } from "@once-ui-system/core";
import { loadSession } from "./lib/authSession";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadSession();
    router.replace(session ? "/internal/simulations" : "/internal/login");
  }, [router]);

  return (
    <Column fillWidth horizontal="center" padding="24">
      <Card fillWidth maxWidth={720} padding="16" border="neutral-alpha-weak" background="surface">
        <Text onBackground="neutral-weak">Redirecting to internal route...</Text>
      </Card>
    </Column>
  );
}
