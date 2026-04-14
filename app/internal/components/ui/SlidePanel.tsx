"use client";

import { useEffect, useRef } from "react";

export interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sp-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        ref={panelRef}
        className="sp-panel"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header-text">
            <div className="sp-title">{title}</div>
            {subtitle && <div className="sp-subtitle">{subtitle}</div>}
          </div>
          <button className="sp-close-btn" onClick={onClose} aria-label="Close panel" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="sp-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="sp-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
