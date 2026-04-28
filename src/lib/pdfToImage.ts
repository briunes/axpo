/**
 * PDF to Image Converter
 * Converts PDF pages to PNG images using pdfjs-dist and node-canvas
 */

export interface PDFPageImage {
  pageNumber: number;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Convert PDF pages to base64-encoded images
 * @param pdfBuffer - PDF file as Buffer
 * @param maxPages - Maximum number of pages to extract (default: 3)
 * @param scale - Rendering scale (default: 2 for high quality)
 * @returns Array of page images
 */
export async function convertPdfToImages(
  pdfBuffer: Buffer,
  maxPages: number = 3,
  scale: number = 2,
): Promise<PDFPageImage[]> {
  // Dynamically import dependencies to avoid Next.js edge runtime issues
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const path = await import("path");

  // Use an absolute file:// URL so that pdfjs loads the worker via Node's
  // native ESM loader rather than Turbopack's bundler (which rewrites dynamic
  // import paths to '[project]' placeholders and breaks resolution). On Vercel
  // the file is present because outputFileTracingIncludes copies it.
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  try {
    // Load PDF document
    const loadingTask = (pdfjsLib as any).getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
    });
    const pdf = await loadingTask.promise;

    const numPages = Math.min(pdf.numPages, maxPages);
    const images: PDFPageImage[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      };

      await page.render(renderContext).promise;

      // Convert canvas to base64 PNG
      const base64 = (await canvas.encode("png")).toString("base64");

      images.push({
        pageNumber: pageNum,
        base64,
        mimeType: "image/png",
        width: viewport.width,
        height: viewport.height,
      });
    }

    return images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw new Error(
      `Failed to convert PDF to images: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get the first page of a PDF as a base64-encoded image
 * @param pdfBuffer - PDF file as Buffer
 * @param scale - Rendering scale (default: 2)
 * @returns First page image data
 */
export async function getFirstPageAsImage(
  pdfBuffer: Buffer,
  scale: number = 2,
): Promise<PDFPageImage> {
  const images = await convertPdfToImages(pdfBuffer, 1, scale);
  if (images.length === 0) {
    throw new Error("Failed to extract first page from PDF");
  }
  return images[0];
}
