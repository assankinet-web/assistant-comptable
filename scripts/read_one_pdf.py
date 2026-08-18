import sys
from pathlib import Path
from pypdf import PdfReader


def read_pdf(pdf_path: Path):
    reader = PdfReader(pdf_path)

    text = ""

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""

        text += f"\n--- PAGE {page_number} ---\n"
        text += page_text

    return text


if len(sys.argv) != 2:
    print("Erreur : indique le chemin d'un PDF.", file=sys.stderr)
    sys.exit(1)


pdf_path = Path(sys.argv[1])

if not pdf_path.exists():
    print(f"Erreur : fichier introuvable : {pdf_path}", file=sys.stderr)
    sys.exit(1)

try:
    text = read_pdf(pdf_path)
    print(text)
except Exception as error:
    print(f"Erreur lors de la lecture du PDF : {error}", file=sys.stderr)
    sys.exit(1)
