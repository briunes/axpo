"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { validateStoredSession } from "./internal/lib/authSession";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    validateStoredSession().then((session) => {
      if (cancelled) return;
      router.replace(session ? "/internal/simulations" : "/internal/login");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
