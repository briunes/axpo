/**
 * PDF to Image Converter
 * Converts PDF pages to compressed images using pdfjs-dist and node-canvas.
 */

export interface PDFPageImage {
  pageNumber: number;
  base64: string;
  mimeType: string;
  fileExtension: string;
  width: number;
  height: number;
}

/**
 * PDF.js renders at 72 DPI when scale is 1. A 3x render is roughly 216 DPI,
 * which preserves invoice text while avoiding the very large raster payloads
 * produced at 4x.
 */
export const OCR_PDF_RENDER_SCALE = 3;
export const OCR_PROVIDER_DETECTION_PDF_RENDER_SCALE = 3;
export const OCR_MAX_PDF_PAGES = 30;
export const OCR_PDF_IMAGE_QUALITY = 85;

export async function configurePdfJsWorker(pdfjsLib: any): Promise<void> {
  const { createRequire } = await import("module");
  const path = await import("path");
  const { pathToFileURL } = await import("url");
  const resolveFromProject = createRequire(
    path.join(process.cwd(), "package.json"),
  );
  const workerPath = resolveFromProject.resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
}

/**
 * Convert PDF pages to base64-encoded images
 * @param pdfBuffer - PDF file as Buffer
 * @param maxPages - Maximum number of pages to extract (default: 30)
 * @param scale - Rendering scale (default: OCR quality, roughly 216 DPI)
 * @returns Array of page images
 */
export async function convertPdfToImages(
  pdfBuffer: Buffer,
  maxPages: number = OCR_MAX_PDF_PAGES,
  scale: number = OCR_PDF_RENDER_SCALE,
): Promise<PDFPageImage[]> {
  // Dynamically import dependencies to avoid Next.js edge runtime issues
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  await configurePdfJsWorker(pdfjsLib);

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

      // Use an opaque white background. PDFs can otherwise render transparent
      // areas that become dark when encoded by some image consumers.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, viewport.width, viewport.height);

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      };

      await page.render(renderContext).promise;

      // WebP is widely supported by vision providers and is substantially
      // smaller than PNG for scanned invoices.
      const base64 = (
        await canvas.encode("webp", OCR_PDF_IMAGE_QUALITY)
      ).toString("base64");

      images.push({
        pageNumber: pageNum,
        base64,
        mimeType: "image/webp",
        fileExtension: "webp",
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

export async function convertAllPdfPagesToImages(
  pdfBuffer: Buffer,
  scale: number = OCR_PDF_RENDER_SCALE,
): Promise<PDFPageImage[]> {
  return convertPdfToImages(pdfBuffer, Number.POSITIVE_INFINITY, scale);
}

/**
 * Get the first page of a PDF as a base64-encoded image
 * @param pdfBuffer - PDF file as Buffer
 * @param scale - Rendering scale (default: OCR quality)
 * @returns First page image data
 */
export async function getFirstPageAsImage(
  pdfBuffer: Buffer,
  scale: number = OCR_PDF_RENDER_SCALE,
): Promise<PDFPageImage> {
  const images = await convertPdfToImages(pdfBuffer, 1, scale);
  if (images.length === 0) {
    throw new Error("Failed to extract first page from PDF");
  }
  return images[0];
}
