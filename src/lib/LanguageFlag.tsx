import type { CSSProperties } from "react";
import { DEFAULT_LANGUAGE, normalizeLanguageCode } from "./supportedLanguages";

const FLAG_SRC_BY_LANGUAGE: Record<string, string> = {
  en: "/flags/en.svg",
  es: "/flags/es.svg",
};

export function getLanguageFlagSrc(code: string | null | undefined): string {
  const normalized = normalizeLanguageCode(code);
  return FLAG_SRC_BY_LANGUAGE[normalized] ?? FLAG_SRC_BY_LANGUAGE[DEFAULT_LANGUAGE];
}

interface LanguageFlagProps {
  code: string;
  label?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

export function LanguageFlag({
  code,
  label,
  width = 24,
  height = 16,
  className,
  style,
}: LanguageFlagProps) {
  const normalized = normalizeLanguageCode(code);
  const alt = normalized.toUpperCase();

  return (
    <img
      src={getLanguageFlagSrc(normalized)}
      alt={alt}
      title={label ?? alt}
      width={width}
      height={height}
      className={className}
      style={{
        display: "inline-block",
        width,
        height,
        objectFit: "cover",
        borderRadius: 2,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.12)",
        ...style,
      }}
    />
  );
}
