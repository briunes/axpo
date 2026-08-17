from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "output/user-manuals"
QA_DIR = ROOT / "tmp/manual-pdf-qa"
QA_DIR.mkdir(parents=True, exist_ok=True)

for pdf_path in sorted(PDF_DIR.glob("*.pdf")):
    out = QA_DIR / pdf_path.stem
    out.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / f"page-{index + 1:02d}.png")
    print(f"{pdf_path.name}: {len(doc)} pages")
