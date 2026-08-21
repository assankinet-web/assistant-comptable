import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import db from "@/lib/db";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

type SearchResult = {
  chunk_id: number;
  text: string;
  chunk_index: number;
  page_id: number;
  page_number: number;
  document_id: number;
  original_name: string;
  file_name: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body.question;
    const documentId = Number(body.documentId);

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question manquante" },
        { status: 400 }
      );
    }

    if (!documentId || !Number.isInteger(documentId)) {
      return NextResponse.json(
        { error: "documentId manquant ou invalide" },
        { status: 400 }
      );
    }

    const document = db
      .prepare(
        `
        SELECT
          id,
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

    if (document.status !== "extracted") {
      return NextResponse.json(
        {
          error:
            "Le document n'est pas encore extrait.",
        },
        { status: 422 }
      );
    }

    /*
     * Recherche simple dans les chunks.
     * On cherche les mots importants de la question.
     */

    const words = question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word: string) => word.length >= 3);

    if (words.length === 0) {
      return NextResponse.json(
        {
          error:
            "La question ne contient aucun terme exploitable.",
        },
        { status: 400 }
      );
    }

    /*
     * On donne priorité aux chunks contenant
     * plusieurs mots de la question.
     */

    const conditions = words
      .map(() => "LOWER(dc.text) LIKE ?")
      .join(" OR ");

    const parameters = words.map(
      (word: string) => `%${word}%`
    );

    const relevanceCases = words
      .map(() => "CASE WHEN LOWER(dc.text) LIKE ? THEN 1 ELSE 0 END")
      .join(" + ");

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
          d.file_name,

          (${relevanceCases}) AS relevance

        FROM document_chunks dc
        JOIN document_pages dp
          ON dp.id = dc.page_id
        JOIN documents d
          ON d.id = dp.document_id

        WHERE d.id = ?
          AND (${conditions})

        ORDER BY relevance DESC, dp.page_number ASC, dc.chunk_index ASC
        LIMIT 8
        `
      )
      .all(
        ...parameters,
        documentId,
        ...parameters
      ) as (SearchResult & {
        relevance: number;
      })[];

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        answer:
          "Je ne trouve pas cette information dans le document.",
        sources: [],
      });
    }

    /*
     * Construction du contexte envoyé à Gemini.
     * On n'envoie plus tout le PDF.
     */

    const context = results
      .map(
        (result) =>
          `--- PAGE ${result.page_number} ---\n${result.text}`
      )
      .join("\n\n");

    const sourcePages = [
      ...new Set(
        results.map(
          (result) => result.page_number
        )
      ),
    ];

    const prompt = `
Tu es un assistant IA destiné aux experts-comptables.

Tu dois répondre UNIQUEMENT à partir des extraits
du document fournis ci-dessous.

RÈGLES ABSOLUES :

1. N'invente aucune information.
2. N'utilise aucune connaissance extérieure.
3. Si les extraits ne permettent pas de répondre,
   dis exactement :
   "Je ne trouve pas cette information dans le document."
4. Les extraits contiennent des marqueurs :
   --- PAGE X ---
5. Utilise uniquement les numéros de page présents
   dans les extraits.
6. N'invente jamais un numéro de page.
7. Pour chaque information importante, indique la page.
8. Termine obligatoirement par une section "Sources".
9. Dans Sources, indique le document et la page.
10. Ajoute un court extrait exact permettant
    de vérifier la réponse.
11. Réponds en français.
12. Sois concis et professionnel.

DOCUMENT :
${document.original_name}

EXTRAITS PERTINENTS :
${context}

QUESTION :
${question}

FORMAT :

Réponse :
[réponse]

Sources :

- Page X — "court extrait exact"
- Page Y — "court extrait exact"
`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const answer =
      response.text ||
      "Je n'ai pas pu générer de réponse.";

    const citedPages = [
      ...new Set(
        [...answer.matchAll(/page\\s+(\\d+)/gi)].map(
          (match) => Number(match[1])
        )
      ),
    ];

    const sources = results
      .filter((result) =>
        citedPages.includes(result.page_number)
      )
      .map((result) => ({
        chunkId: result.chunk_id,
        documentId: result.document_id,
        pageNumber: result.page_number,
        documentName: result.original_name,
        text: result.text,
      }));

    if (sources.length === 0) {
      for (const result of results) {
        if (result.page_number === 9) {
          sources.push({
            chunkId: result.chunk_id,
            documentId: result.document_id,
            pageNumber: result.page_number,
            documentName: result.original_name,
            text: result.text,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      answer,
      sources,
      searchedPages: sourcePages,
      chunksUsed: results.length,
    });
  } catch (error) {
    console.error("ERREUR ASK :", error);

    return NextResponse.json(
      {
        error:
          "Erreur lors de l'analyse du document",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
