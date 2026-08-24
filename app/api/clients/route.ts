import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("ERREUR GET CLIENTS :", error);

      return NextResponse.json(
        {
          success: false,
          error: "Impossible de récupérer les clients",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clients: clients ?? [],
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

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ name })
      .select("id, name, created_at, updated_at")
      .single();

    if (error) {
      console.error("ERREUR POST CLIENT :", error);

      return NextResponse.json(
        {
          success: false,
          error: "Impossible de créer le client",
        },
        { status: 500 }
      );
    }

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
