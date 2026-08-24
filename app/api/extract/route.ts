import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import db from "@/lib/db";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fileName = body.fileName;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "Nom de fichier manquant" },
        { status: 400 }
      );
    }

    const document = db
      .prepare(`
        SELECT
          id,
          file_name,
          original_name,
          file_path,
          status
        FROM documents
        WHERE file_name = ?
        LIMIT 1
      `)
      .get(fileName) as
      | {
          id: number;
          file_name: string;
          original_name: string;
          file_path: string;
          status: string;
        }
      | undefined;

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable dans la base de données" },
        { status: 404 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      "uploads",
      path.basename(document.file_path)
    );

    const buffer = await fs.readFile(filePath);

    const parser = new PDFParse({ data: buffer });
const parsed = await parser.getText();
const info = await parser.getInfo();
    const extractedText = parsed.text || "";
const pageCount = info.total || 0;

    const pageRegex =
      /--- PAGE (\d+) ---([\s\S]*?)(?=--- PAGE \d+ ---|$)/g;

    /*
     * pdf-parse ne fournit pas ici les séparateurs de pages
     * comme notre script Python.
     *
     * On reconstruit donc les pages à partir du nombre
     * de pages du PDF et du texte extrait.
     */

    

    if (!extractedText.trim() || pageCount === 0) {
      db.prepare(`
        UPDATE documents
        SET status = ?,
            page_count = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run("error", document.id);

      return NextResponse.json(
        {
          error:
            "Aucune page exploitable n'a été trouvée dans le document.",
        },
        { status: 422 }
      );
    }

    /*
     * Pour cette première version, on conserve tout le texte
     * sur la première page logique.
     *
     * On améliorera ensuite la séparation page par page
     * si les citations doivent être précises.
     */

    const pages = [
      {
        pageNumber: 1,
        text: extractedText.trim(),
      },
    ];

    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM document_pages
        WHERE document_id = ?
      `).run(document.id);

      const insertPage = db.prepare(`
        INSERT INTO document_pages (
          document_id,
          page_number,
          text
        )
        VALUES (?, ?, ?)
      `);

      const insertChunk = db.prepare(`
        INSERT INTO document_chunks (
          page_id,
          chunk_index,
          text
        )
        VALUES (?, ?, ?)
      `);

      for (const page of pages) {
        const pageResult = insertPage.run(
          document.id,
          page.pageNumber,
          page.text
        );

        const pageId = Number(pageResult.lastInsertRowid);

        const chunkSize = 2500;
        const overlap = 300;

        let chunkIndex = 0;
        let start = 0;

        while (start < page.text.length) {
          const end = Math.min(
            start + chunkSize,
            page.text.length
          );

          const chunkText = page.text
            .slice(start, end)
            .trim();

          if (chunkText) {
            insertChunk.run(
              pageId,
              chunkIndex,
              chunkText
            );

            chunkIndex++;
          }

          if (end >= page.text.length) {
            break;
          }

          start = end - overlap;
        }
      }

      db.prepare(`
        UPDATE documents
        SET status = ?,
            page_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        "extracted",
        pageCount,
        document.id
      );
    });

    transaction();

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName: document.file_name,
      pageCount,
      status: "extracted",
    });
  } catch (error) {
    console.error(
      "ERREUR API EXTRACTION :",
      error
    );

    return NextResponse.json(
      {
        error: "Erreur lors de l'extraction",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
