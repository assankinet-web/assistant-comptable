import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type HistoryMessage = {
role: "user" | "assistant";
content: string;
};

type Conversations = Record<string, HistoryMessage[]>;

const dataDir = path.join(process.cwd(), "data");
const historyFile = path.join(dataDir, "conversations.json");

async function readHistory(): Promise<Conversations> {
try {
const content = await readFile(historyFile, "utf8");
return JSON.parse(content);
} catch {
return {};
}
}

async function saveHistory(history: Conversations) {
await mkdir(dataDir, { recursive: true });
await writeFile(
historyFile,
JSON.stringify(history, null, 2),
"utf8"
);
}

export async function GET(request: Request) {
try {
const { searchParams } = new URL(request.url);
const fileName = searchParams.get("fileName");


if (!fileName) {
  return NextResponse.json(
    { error: "Nom du document manquant" },
    { status: 400 }
  );
}

const history = await readHistory();

return NextResponse.json({
  success: true,
  messages: history[fileName] || [],
});


} catch (error) {
console.error("ERREUR HISTORIQUE :", error);


return NextResponse.json(
  { error: "Impossible de récupérer l'historique" },
  { status: 500 }
);


}
}

export async function POST(request: Request) {
try {
const body = await request.json();


const fileName = body.fileName;
const messages = body.messages;

if (!fileName || typeof fileName !== "string") {
  return NextResponse.json(
    { error: "Nom du document manquant" },
    { status: 400 }
  );
}

if (!Array.isArray(messages)) {
  return NextResponse.json(
    { error: "Historique invalide" },
    { status: 400 }
  );
}

const history = await readHistory();

history[fileName] = messages;

await saveHistory(history);

return NextResponse.json({
  success: true,
});


} catch (error) {
console.error("ERREUR SAUVEGARDE HISTORIQUE :", error);


return NextResponse.json(
  { error: "Impossible de sauvegarder l'historique" },
  { status: 500 }
);


}
}
