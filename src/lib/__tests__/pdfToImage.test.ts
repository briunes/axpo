const encodeMock = jest.fn();
const fillRectMock = jest.fn();
const renderMock = jest.fn();

jest.mock("@napi-rs/canvas", () => ({
  createCanvas: jest.fn(() => ({
    encode: (...args: unknown[]) => encodeMock(...args),
    getContext: jest.fn(() => ({
      fillRect: (...args: unknown[]) => fillRectMock(...args),
      fillStyle: "",
    })),
  })),
}));

jest.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: {},
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      numPages: 4,
      getPage: jest.fn(async () => ({
        getViewport: jest.fn(() => ({ width: 1785, height: 2526 })),
        render: jest.fn(() => ({
          promise: renderMock(),
        })),
      })),
    }),
  })),
}));

import {
  convertAllPdfPagesToImages,
  convertPdfToImages,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_IMAGE_QUALITY,
} from "../pdfToImage";

describe("convertPdfToImages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    encodeMock.mockResolvedValue(Buffer.from("compressed-image"));
    renderMock.mockResolvedValue(undefined);
  });

  it("renders all supported pages as compressed WebP images", async () => {
    const images = await convertPdfToImages(
      Buffer.from("pdf"),
      OCR_MAX_PDF_PAGES,
    );

    const expectedPageCount = Math.min(4, OCR_MAX_PDF_PAGES);

    expect(images).toHaveLength(expectedPageCount);
    expect(images.map((image) => image.pageNumber)).toEqual(
      Array.from({ length: expectedPageCount }, (_, index) => index + 1),
    );
    expect(images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mimeType: "image/webp",
          fileExtension: "webp",
        }),
      ]),
    );
    expect(encodeMock).toHaveBeenCalledTimes(expectedPageCount);
    expect(encodeMock).toHaveBeenCalledWith(
      "webp",
      OCR_PDF_IMAGE_QUALITY,
    );
    expect(fillRectMock).toHaveBeenCalledTimes(expectedPageCount);
  });

  it("can render every page without applying the invoice page cap", async () => {
    const images = await convertAllPdfPagesToImages(Buffer.from("pdf"));

    expect(images.map((image) => image.pageNumber)).toEqual([1, 2, 3, 4]);
  });
});
