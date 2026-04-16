"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { InternalWorkspace } from "./components/InternalWorkspace";
import type { AppSection } from "./components/InternalWorkspace";
import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "./axpo-tokens.css";
import "./globals.css";
import "./crud-pages.css";

function InternalLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Determine section from pathname
  const getSection = (): AppSection => {
    if (pathname.startsWith("/internal/simulations")) return "simulations";
    if (pathname.startsWith("/internal/users")) return "users";
    if (pathname.startsWith("/internal/agencies")) return "agencies";
    if (pathname.startsWith("/internal/clients")) return "clients";
    if (pathname.startsWith("/internal/base-values")) return "base-values";
    if (pathname.startsWith("/internal/audit-logs")) return "audit-logs";
    if (pathname.startsWith("/internal/email-logs")) return "email-logs";
    if (pathname.startsWith("/internal/analytics")) return "analytics";
    if (pathname.startsWith("/internal/configurations")) return "configurations";
    return "simulations";
  };

  const section = getSection();

  // Login and setup-password pages should not have the workspace wrapper
  if (
    pathname === "/internal/login" ||
    pathname === "/internal/setup-password" ||
    pathname === "/internal"
  ) {
    return <>{children}</>;
  }

  return <InternalWorkspace section={section}>{children}</InternalWorkspace>;
}

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <InternalLayoutContent>{children}</InternalLayoutContent>
    </Providers>
  );
}
