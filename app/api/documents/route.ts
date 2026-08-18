import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const documents = db
      .prepare(
        `
        SELECT
          d.id,
          d.file_name,
          d.original_name,
          d.file_size,
          d.mime_type,
          d.status,
          d.page_count,
          d.created_at,
          d.updated_at,
          d.dossier_id,
          dos.name AS dossier_name,
          dos.fiscal_year,
          c.id AS client_id,
          c.name AS client_name
        FROM documents d
        LEFT JOIN dossiers dos
          ON dos.id = d.dossier_id
        LEFT JOIN clients c
          ON c.id = dos.client_id
        ORDER BY d.created_at DESC
        `
      )
      .all() as {
        id: number;
        file_name: string;
        original_name: string;
        file_size: number;
        mime_type: string;
        status: string;
        page_count: number;
        created_at: string;
        updated_at: string;
        dossier_id: number;
        dossier_name: string | null;
        fiscal_year: number | null;
        client_id: number | null;
        client_name: string | null;
      }[];

    return NextResponse.json({
      success: true,
      documents: documents.map((document) => ({
        id: document.id,
        fileName: document.file_name,
        name: document.original_name,
        fileSize: document.file_size,
        mimeType: document.mime_type,
        status: document.status,
        pageCount: document.page_count,
        dossierId: document.dossier_id,
        dossierName: document.dossier_name,
        fiscalYear: document.fiscal_year,
        clientId: document.client_id,
        clientName: document.client_name,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      })),
    });
  } catch (error) {
    console.error("ERREUR DOCUMENTS :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les documents",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
