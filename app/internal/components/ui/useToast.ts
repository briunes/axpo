"use client";

import { useCallback, useState } from "react";
import type { ToastMessage, ToastTone } from "./Toast";

let idCounter = 0;

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: ToastTone = "info") => {
    const id = ++idCounter;
    setMessages((prev) => [...prev, { id, text, tone }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const showSuccess = useCallback((text: string) => showToast(text, "success"), [showToast]);
  const showError = useCallback((text: string) => showToast(text, "error"), [showToast]);

  return { messages, dismissToast, showToast, showSuccess, showError };
}
