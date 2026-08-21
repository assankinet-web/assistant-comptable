import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const dossierIdValue = formData.get("dossier_id");

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier reçu" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Seuls les fichiers PDF sont autorisés" },
        { status: 400 }
      );
    }

    if (!dossierIdValue) {
      return NextResponse.json(
        {
          error:
            "Un dossier doit être sélectionné avant l'envoi du document",
        },
        { status: 400 }
      );
    }

    const dossierId = Number(dossierIdValue);

    if (!Number.isInteger(dossierId) || dossierId <= 0) {
      return NextResponse.json(
        { error: "dossier_id invalide" },
        { status: 400 }
      );
    }

    const dossier = db
      .prepare(
        `
        SELECT
          dossiers.id,
          dossiers.name,
          dossiers.client_id,
          clients.name AS client_name
        FROM dossiers
        INNER JOIN clients
          ON clients.id = dossiers.client_id
        WHERE dossiers.id = ?
        LIMIT 1
        `
      )
      .get(dossierId) as
      | {
          id: number;
          name: string;
          client_id: number;
          client_name: string;
        }
      | undefined;

    if (!dossier) {
      return NextResponse.json(
        { error: "Dossier introuvable" },
        { status: 404 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "uploads");

    await mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    const documentResult = db
      .prepare(
        `
        INSERT INTO documents (
          dossier_id,
          file_name,
          original_name,
          file_path,
          mime_type,
          file_size,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        dossierId,
        fileName,
        file.name,
        filePath,
        file.type,
        buffer.length,
        "uploaded"
      );

    const documentId = Number(
      documentResult.lastInsertRowid
    );

    return NextResponse.json({
      success: true,
      documentId,
      fileName,
      dossierId,
      dossierName: dossier.name,
      clientId: dossier.client_id,
      clientName: dossier.client_name,
      status: "uploaded",
    });
  } catch (error) {
    console.error("ERREUR UPLOAD :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'upload",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
