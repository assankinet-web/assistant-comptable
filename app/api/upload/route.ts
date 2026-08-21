import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import db from "@/lib/db";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const dossierIdValue = formData.get("dossier_id");

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun fichier reçu",
        },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "Seuls les fichiers PDF sont autorisés",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier est vide",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier dépasse la taille maximale de 25 Mo",
        },
        { status: 413 }
      );
    }

    if (!dossierIdValue) {
      return NextResponse.json(
        {
          success: false,
          error: "Un dossier doit être sélectionné",
        },
        { status: 400 }
      );
    }

    const dossierId = Number(dossierIdValue);

    if (!Number.isInteger(dossierId) || dossierId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "dossier_id invalide",
        },
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
        {
          success: false,
          error: "Dossier introuvable",
        },
        { status: 404 }
      );
    }

    /*
     * Vérification supplémentaire de l'extension.
     * Le MIME envoyé par le navigateur ne suffit pas à lui seul.
     */

    const originalName = file.name.trim();

    if (
      !originalName.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier doit avoir une extension .pdf",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    /*
     * Vérification de la signature PDF.
     * Un vrai PDF commence normalement par %PDF-
     */

    const pdfHeader = buffer
      .subarray(0, 5)
      .toString("ascii");

    if (pdfHeader !== "%PDF-") {
      return NextResponse.json(
        {
          success: false,
          error: "Le fichier fourni n'est pas un PDF valide",
        },
        { status: 400 }
      );
    }

    const uploadDir = path.join(
      process.cwd(),
      "uploads"
    );

    await mkdir(uploadDir, {
      recursive: true,
    });

    const safeName = originalName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(
      uploadDir,
      fileName
    );

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
        originalName,
        filePath,
        "application/pdf",
        buffer.length,
        "uploaded"
      );

    const documentId = Number(
      documentResult.lastInsertRowid
    );

    return NextResponse.json(
      {
        success: true,
        documentId,
        fileName,
        dossierId,
        dossierName: dossier.name,
        clientId: dossier.client_id,
        clientName: dossier.client_name,
        status: "uploaded",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "ERREUR UPLOAD :",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'upload",
      },
      { status: 500 }
    );
  }
}
