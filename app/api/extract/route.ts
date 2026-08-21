import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { access } from "fs/promises";
import db from "@/lib/db";

const PYTHON_PATH =
  "/home/kinetassan/assistant-comptable-python/bin/python";

const MAX_EXTRACTION_TIME = 120_000;

type DocumentRow = {
  id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  status: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const documentId = Number(body.documentId);

    if (
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "documentId invalide",
        },
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
          file_path,
          status
        FROM documents
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(documentId) as
      | DocumentRow
      | undefined;

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: "Document introuvable",
        },
        { status: 404 }
      );
    }

    /*
     * Le chemin est reconstruit depuis le nom enregistré
     * en base afin d'éviter toute tentative d'accès
     * à un fichier arbitraire.
     */

    const safeName = path.basename(
      document.file_name
    );

    const filePath = path.join(
      process.cwd(),
      "uploads",
      safeName
    );

    if (safeName !== document.file_name) {
      return NextResponse.json(
        {
          success: false,
          error: "Nom de fichier invalide",
        },
        { status: 400 }
      );
    }

    try {
      await access(filePath);
    } catch {
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
          success: false,
          error: "Fichier PDF introuvable sur le serveur",
        },
        { status: 404 }
      );
    }

    /*
     * Si le document est déjà extrait, on peut
     * refaire l'extraction volontairement.
     * Les anciennes pages/chunks seront remplacées.
     */

    db.prepare(
      `
      UPDATE documents
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).run("extracting", document.id);

    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "read_one_pdf.py"
    );

    const result = await new Promise<{
      stdout: string;
      stderr: string;
      code: number | null;
      timedOut: boolean;
    }>((resolve) => {
      const python = spawn(
        PYTHON_PATH,
        [scriptPath, filePath],
        {
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) return;

        finished = true;

        python.kill("SIGKILL");

        resolve({
          stdout,
          stderr,
          code: null,
          timedOut: true,
        });
      }, MAX_EXTRACTION_TIME);

      python.stdout.on(
        "data",
        (data) => {
          stdout += data.toString();
        }
      );

      python.stderr.on(
        "data",
        (data) => {
          stderr += data.toString();
        }
      );

      python.on(
        "close",
        (code) => {
          if (finished) return;

          finished = true;
          clearTimeout(timer);

          resolve({
            stdout,
            stderr,
            code,
            timedOut: false,
          });
        }
      );

      python.on(
        "error",
        (error) => {
          if (finished) return;

          finished = true;
          clearTimeout(timer);

          stderr += error.message;

          resolve({
            stdout,
            stderr,
            code: 1,
            timedOut: false,
          });
        }
      );
    });

    if (result.timedOut) {
      console.error(
        "TIMEOUT EXTRACTION :",
        document.original_name
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
          success: false,
          error:
            "L'extraction a dépassé le temps maximum autorisé",
        },
        { status: 504 }
      );
    }

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
          success: false,
          error:
            "Impossible de lire le document PDF",
        },
        { status: 500 }
      );
    }

    const extractedText =
      result.stdout.trim();

    /*
     * Le script Python doit produire :
     *
     * --- PAGE 1 ---
     * texte
     *
     * --- PAGE 2 ---
     * texte
     */

    const pageRegex =
      /--- PAGE (\d+) ---([\s\S]*?)(?=--- PAGE \d+ ---|$)/g;

    const pages: {
      pageNumber: number;
      text: string;
    }[] = [];

    let match: RegExpExecArray | null;

    while (
      (match = pageRegex.exec(extractedText)) !== null
    ) {
      const pageNumber = Number(match[1]);
      const text = match[2].trim();

      if (
        Number.isInteger(pageNumber) &&
        pageNumber > 0 &&
        text.length > 0
      ) {
        pages.push({
          pageNumber,
          text,
        });
      }
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
          success: false,
          error:
            "Aucune page exploitable n'a été trouvée dans le PDF",
        },
        { status: 422 }
      );
    }

    /*
     * Sécurité supplémentaire :
     * pas de doublons de pages.
     */

    const pageNumbers = pages.map(
      (page) => page.pageNumber
    );

    if (
      new Set(pageNumbers).size !==
      pageNumbers.length
    ) {
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
          success: false,
          error:
            "L'extraction PDF contient des pages dupliquées",
        },
        { status: 422 }
      );
    }

    pages.sort(
      (a, b) =>
        a.pageNumber - b.pageNumber
    );

    /*
     * On remplace les anciennes pages.
     *
     * Les chunks sont supprimés automatiquement
     * grâce aux clés étrangères et à la suppression
     * explicite des pages.
     */

    const transaction = db.transaction(() => {
      db.prepare(
        `
        DELETE FROM document_chunks
        WHERE page_id IN (
          SELECT id
          FROM document_pages
          WHERE document_id = ?
        )
        `
      ).run(document.id);

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
      status: "extracted",
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
        success: false,
        error: "Erreur lors de l'extraction",
      },
      { status: 500 }
    );
  }
}
