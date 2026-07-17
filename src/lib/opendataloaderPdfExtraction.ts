import { mkdtemp, rm, writeFile } from "fs/promises";
import { spawn } from "child_process";
import { tmpdir } from "os";
import path from "path";

const DEFAULT_MAX_CHARS = 12_000;

export interface OpenDataLoaderPdfExtractionResult {
  content: string;
  originalLength: number;
  truncated: boolean;
  skippedReason?: never;
}

export interface OpenDataLoaderPdfExtractionSkippedResult {
  content?: never;
  originalLength?: never;
  truncated?: never;
  skippedReason: string;
}

export type OpenDataLoaderPdfExtraction =
  | OpenDataLoaderPdfExtractionResult
  | OpenDataLoaderPdfExtractionSkippedResult;

let javaAvailability: Promise<boolean> | null = null;

const toPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const safePdfFileName = (fileName: string): string => {
  const basename = path.basename(fileName || "invoice.pdf");
  const withoutUnsafeChars = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return withoutUnsafeChars.toLowerCase().endsWith(".pdf")
    ? withoutUnsafeChars
    : `${withoutUnsafeChars}.pdf`;
};

const compactExtractedMarkdown = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

export const isOpenDataLoaderPdfExtractionEnabled = (): boolean =>
  process.env.OCR_OPENDATALOADER_ENABLED !== "false";

const isJavaAvailable = async (): Promise<boolean> => {
  javaAvailability ??= new Promise((resolve) => {
    const javaProcess = spawn("java", ["-version"]);

    javaProcess.on("error", () => resolve(false));
    javaProcess.on("close", (code) => resolve(code === 0));
  });

  return javaAvailability;
};

export async function extractPdfWithOpenDataLoader(
  pdfBuffer: Buffer,
  fileName: string,
  maxPages: number,
): Promise<OpenDataLoaderPdfExtraction | null> {
  if (!isOpenDataLoaderPdfExtractionEnabled()) return null;
  if (!(await isJavaAvailable())) {
    return {
      skippedReason: "Java runtime is not available",
    };
  }

  const maxChars = toPositiveInteger(
    process.env.OCR_OPENDATALOADER_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );
  const workDir = await mkdtemp(path.join(tmpdir(), "axpo-opendataloader-"));
  const pdfPath = path.join(workDir, safePdfFileName(fileName));

  try {
    await writeFile(pdfPath, pdfBuffer);

    const { convert } = await import("@opendataloader/pdf");
    const output = await convert(pdfPath, {
      format: "markdown",
      toStdout: true,
      quiet: true,
      tableMethod: "cluster",
      readingOrder: "xycut",
      imageOutput: "off",
      pages: `1-${maxPages}`,
    });

    const compacted = compactExtractedMarkdown(output);
    if (compacted.length <= 50) return null;

    return {
      content:
        compacted.length > maxChars
          ? `${compacted.slice(0, maxChars)}\n\n[OpenDataLoader output truncated at ${maxChars} characters]`
          : compacted,
      originalLength: compacted.length,
      truncated: compacted.length > maxChars,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
