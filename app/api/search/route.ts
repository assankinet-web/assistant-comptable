import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q")?.trim() || "";
    const documentId = Number(searchParams.get("documentId"));

    if (!query) {
      return NextResponse.json(
        { error: "Paramètre q manquant" },
        { status: 400 }
      );
    }

    if (!documentId || !Number.isInteger(documentId)) {
      return NextResponse.json(
        { error: "Paramètre documentId invalide" },
        { status: 400 }
      );
    }

    const document = db
      .prepare(
        `
        SELECT
          id,
          dossier_id,
          original_name,
          file_name,
          status,
          page_count
        FROM documents
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(documentId) as
      | {
          id: number;
          dossier_id: number;
          original_name: string;
          file_name: string;
          status: string;
          page_count: number;
        }
      | undefined;

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 }
      );
    }

    const words = query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2);

    if (words.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        documentId,
        results: [],
      });
    }

    const conditions = words
      .map(() => "LOWER(dc.text) LIKE ?")
      .join(" AND ");

    const parameters = words.map(
      (word) => `%${word}%`
    );

    const results = db
      .prepare(
        `
        SELECT
          dc.id AS chunk_id,
          dc.text AS text,
          dc.chunk_index,
          dp.id AS page_id,
          dp.page_number,
          d.id AS document_id,
          d.original_name,
          d.file_name
        FROM document_chunks dc
        JOIN document_pages dp
          ON dp.id = dc.page_id
        JOIN documents d
          ON d.id = dp.document_id
        WHERE d.id = ?
          AND ${conditions}
        ORDER BY dp.page_number, dc.chunk_index
        LIMIT 10
        `
      )
      .all(documentId, ...parameters);

    return NextResponse.json({
      success: true,
      query,
      documentId,
      document: {
        id: document.id,
        name: document.original_name,
        status: document.status,
        pageCount: document.page_count,
      },
      results,
    });
  } catch (error) {
    console.error("ERREUR SEARCH :", error);

    return NextResponse.json(
      {
        error: "Erreur lors de la recherche",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
