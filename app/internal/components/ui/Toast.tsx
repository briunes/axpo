"use client";

import { useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="false">
      {messages.map((msg) => (
        <ToastItem key={msg.id} msg={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 4s
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(msg.id), 300);
    }, 4000);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [msg.id, onDismiss]);

  return (
    <div
      className={`app-toast app-toast--${msg.tone}${visible ? " app-toast--visible" : ""}`}
      role="status"
    >
      <span className="app-toast-icon">
        {msg.tone === "success" ? "✓" : msg.tone === "error" ? "✕" : "ℹ"}
      </span>
      <span className="app-toast-text">{msg.text}</span>
      <button
        className="app-toast-close"
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(msg.id), 300); }}
        aria-label="Dismiss"
        type="button"
      >
        ×
      </button>
    </div>
  );
}
