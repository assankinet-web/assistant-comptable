from pathlib import Path
from pypdf import PdfReader

UPLOADS_DIR = Path("uploads")


def read_pdf(pdf_path: Path):
    reader = PdfReader(pdf_path)

    text = ""

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""

        text += f"\n--- PAGE {page_number} ---\n"
        text += page_text

    return text


if __name__ == "__main__":
    pdf_files = list(UPLOADS_DIR.glob("*.pdf"))

    if not pdf_files:
        print("Aucun PDF trouvé dans uploads/")
    else:
        for pdf in pdf_files:
            print(f"\nLecture de : {pdf.name}")

            text = read_pdf(pdf)

            print("\n--- TEXTE EXTRAIT ---")
            print(text[:5000])
            print("\n--- FIN ---")
