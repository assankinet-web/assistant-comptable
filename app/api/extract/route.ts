import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import db from "@/lib/db";

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
      .prepare(
        `
        SELECT
          id,
          file_name,
          original_name,
          file_path
        FROM documents
        WHERE file_name = ?
        LIMIT 1
        `
      )
      .get(fileName) as
      | {
          id: number;
          file_name: string;
          original_name: string;
          file_path: string;
        }
      | undefined;

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable dans la base de données" },
        { status: 404 }
      );
    }

    const safeName = path.basename(document.file_path);
    const filePath = path.join(
      process.cwd(),
      "uploads",
      safeName
    );

    const pythonPath = "/home/kinetassan/assistant-comptable-python/bin/python";

    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "read_one_pdf.py"
    );

    const result = await new Promise<{
      stdout: string;
      stderr: string;
      code: number | null;
    }>((resolve) => {
      const python = spawn(pythonPath, [
        scriptPath,
        filePath,
      ]);

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      python.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      python.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          code,
        });
      });

      python.on("error", (error) => {
        stderr += error.message;

        resolve({
          stdout,
          stderr,
          code: 1,
        });
      });
    });

    if (result.code !== 0) {
      console.error(
        "ERREUR EXTRACTION PYTHON :",
        result.stderr
      );

      db.prepare(
        `
        UPDATE documents
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `
      ).run("error", document.id);

      return NextResponse.json(
        {
          error: "Impossible de lire le document",
        },
        { status: 500 }
      );
    }

    const extractedText = result.stdout;

    /*
     * Le script Python produit :
     *
     * --- PAGE 1 ---
     * texte...
     *
     * --- PAGE 2 ---
     * texte...
     *
     * On reconstruit ici chaque page pour la stocker
     * individuellement dans document_pages.
     */

    const pageRegex =
      /--- PAGE (\d+) ---([\s\S]*?)(?=--- PAGE \d+ ---|$)/g;

    const pages: {
      pageNumber: number;
      text: string;
    }[] = [];

    let match: RegExpExecArray | null;

    while ((match = pageRegex.exec(extractedText)) !== null) {
      const pageNumber = Number(match[1]);
      const text = match[2].trim();

      pages.push({
        pageNumber,
        text,
      });
    }

    if (pages.length === 0) {
      db.prepare(
        `
        UPDATE documents
        SET status = ?,
            page_count = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `
      ).run("error", document.id);

      return NextResponse.json(
        {
          error:
            "Aucune page exploitable n'a été trouvée dans le document.",
        },
        { status: 422 }
      );
    }

    const transaction = db.transaction(() => {
      /*
       * Si le document a déjà été extrait,
       * on remplace ses anciennes pages.
       */

      db.prepare(
        `
        DELETE FROM document_pages
        WHERE document_id = ?
        `
      ).run(document.id);

      const insertPage = db.prepare(
        `
        INSERT INTO document_pages (
          document_id,
          page_number,
          text
        )
        VALUES (?, ?, ?)
        `
      );

      for (const page of pages) {
        insertPage.run(
          document.id,
          page.pageNumber,
          page.text
        );
      }

      db.prepare(
        `
        UPDATE documents
        SET status = ?,
            page_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `
      ).run(
        "extracted",
        pages.length,
        document.id
      );
    });

    transaction();

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName: document.file_name,
      pageCount: pages.length,
      text: extractedText,
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
      })),
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
