import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const dossiers = db
      .prepare(`
        SELECT
          dossiers.id,
          dossiers.client_id,
          dossiers.name,
          dossiers.fiscal_year,
          dossiers.created_at,
          dossiers.updated_at,
          clients.name AS client_name
        FROM dossiers
        INNER JOIN clients ON clients.id = dossiers.client_id
        ORDER BY dossiers.created_at DESC
      `)
      .all();

    return NextResponse.json({
      success: true,
      dossiers,
    });
  } catch (error) {
    console.error("ERREUR GET DOSSIERS :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les dossiers",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const clientId = Number(body.client_id);
    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const fiscalYear =
      body.fiscal_year === null ||
      body.fiscal_year === undefined ||
      body.fiscal_year === ""
        ? null
        : Number(body.fiscal_year);

    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "client_id est obligatoire",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Le nom du dossier est obligatoire",
        },
        { status: 400 }
      );
    }

    if (
      fiscalYear !== null &&
      (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 2100)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "fiscal_year doit être une année valide",
        },
        { status: 400 }
      );
    }

    const client = db
      .prepare(`
        SELECT id
        FROM clients
        WHERE id = ?
      `)
      .get(clientId);

    if (!client) {
      return NextResponse.json(
        {
          success: false,
          error: "Client introuvable",
        },
        { status: 404 }
      );
    }

    const result = db
      .prepare(`
        INSERT INTO dossiers (
          client_id,
          name,
          fiscal_year
        )
        VALUES (?, ?, ?)
      `)
      .run(clientId, name, fiscalYear);

    const dossier = db
      .prepare(`
        SELECT
          dossiers.id,
          dossiers.client_id,
          dossiers.name,
          dossiers.fiscal_year,
          dossiers.created_at,
          dossiers.updated_at,
          clients.name AS client_name
        FROM dossiers
        INNER JOIN clients ON clients.id = dossiers.client_id
        WHERE dossiers.id = ?
      `)
      .get(result.lastInsertRowid);

    return NextResponse.json(
      {
        success: true,
        dossier,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERREUR POST DOSSIER :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de créer le dossier",
      },
      { status: 500 }
    );
  }
}
