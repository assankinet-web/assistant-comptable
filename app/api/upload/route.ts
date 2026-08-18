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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "uploads");

    await mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    let dossierId: number;

    if (dossierIdValue) {
      dossierId = Number(dossierIdValue);

      if (!Number.isInteger(dossierId) || dossierId <= 0) {
        return NextResponse.json(
          { error: "dossier_id invalide" },
          { status: 400 }
        );
      }

      const dossier = db
        .prepare(`
          SELECT id
          FROM dossiers
          WHERE id = ?
        `)
        .get(dossierId);

      if (!dossier) {
        return NextResponse.json(
          { error: "Dossier introuvable" },
          { status: 404 }
        );
      }
    } else {
      // Compatibilité temporaire avec l'ancien MVP.
      let client = db
        .prepare(`
          SELECT id
          FROM clients
          WHERE name = ?
          LIMIT 1
        `)
        .get("Entreprise Exemple") as { id: number } | undefined;

      if (!client) {
        const result = db
          .prepare(`
            INSERT INTO clients (name)
            VALUES (?)
          `)
          .run("Entreprise Exemple");

        client = {
          id: Number(result.lastInsertRowid),
        };
      }

      let dossier = db
        .prepare(`
          SELECT id
          FROM dossiers
          WHERE client_id = ?
          AND fiscal_year = ?
          LIMIT 1
        `)
        .get(client.id, 2026) as { id: number } | undefined;

      if (!dossier) {
        const result = db
          .prepare(`
            INSERT INTO dossiers (
              client_id,
              name,
              fiscal_year
            )
            VALUES (?, ?, ?)
          `)
          .run(
            client.id,
            "Exercice 2026",
            2026
          );

        dossier = {
          id: Number(result.lastInsertRowid),
        };
      }

      dossierId = dossier.id;
    }

    const documentResult = db
      .prepare(`
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
      `)
      .run(
        dossierId,
        fileName,
        file.name,
        filePath,
        file.type,
        buffer.length,
        "uploaded"
      );

    return NextResponse.json({
      success: true,
      fileName,
      documentId: Number(documentResult.lastInsertRowid),
      dossierId,
    });
  } catch (error) {
    console.error("ERREUR UPLOAD :", error);

    return NextResponse.json(
      {
        error: "Erreur lors de l'upload",
      },
      { status: 500 }
    );
  }
}
