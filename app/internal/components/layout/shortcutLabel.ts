"use client";

export function getCommandShortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl K";

  const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘K" : "Ctrl K";
}
