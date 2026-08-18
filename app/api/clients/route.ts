import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const clients = db
      .prepare(`
        SELECT
          id,
          name,
          created_at,
          updated_at
        FROM clients
        ORDER BY name ASC
      `)
      .all();

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error) {
    console.error("ERREUR GET CLIENTS :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les clients",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Le nom du client est obligatoire",
        },
        { status: 400 }
      );
    }

    const result = db
      .prepare(`
        INSERT INTO clients (name)
        VALUES (?)
      `)
      .run(name);

    const client = db
      .prepare(`
        SELECT
          id,
          name,
          created_at,
          updated_at
        FROM clients
        WHERE id = ?
      `)
      .get(result.lastInsertRowid);

    return NextResponse.json(
      {
        success: true,
        client,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERREUR POST CLIENT :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de créer le client",
      },
      { status: 500 }
    );
  }
}
