import db from "../lib/db";

const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.log(
    'Utilisation : npx tsx scripts/search_chunks.ts "votre question"'
  );
  process.exit(1);
}

const words = question
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .split(/\s+/)
  .filter((word) => word.length >= 3);

if (words.length === 0) {
  console.log("Aucun mot exploitable dans la question.");
  process.exit(0);
}

const conditions = words.map(
  () => "LOWER(dc.text) LIKE ?"
);

const params = words.map(
  (word) => `%${word}%`
);

const sql = `
  SELECT
    dc.id AS chunk_id,
    dp.document_id,
    dp.page_number,
    dc.text
  FROM document_chunks dc
  JOIN document_pages dp
    ON dp.id = dc.page_id
  WHERE ${conditions.join(" OR ")}
  ORDER BY dc.id
  LIMIT 8
`;

const results = db
  .prepare(sql)
  .all(...params) as {
    chunk_id: number;
    document_id: number;
    page_number: number;
    text: string;
  }[];

console.log(`Question : ${question}`);
console.log(`Résultats : ${results.length}`);

for (const result of results) {
  console.log(
    `--- Chunk ${result.chunk_id} | Page ${result.page_number} ---`
  );

  console.log(
    result.text.slice(0, 1200)
  );

  console.log("");
}
