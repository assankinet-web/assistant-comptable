import db from "../lib/db";

const documentId = Number(process.argv[2]);

if (!documentId) {
  console.error("Usage : npx tsx scripts/chunk_document.ts <document_id>");
  process.exit(1);
}

const pages = db
  .prepare(
    `
    SELECT id, page_number, text
    FROM document_pages
    WHERE document_id = ?
    ORDER BY page_number
    `
  )
  .all(documentId) as {
    id: number;
    page_number: number;
    text: string;
  }[];

if (pages.length === 0) {
  console.error(`Aucune page trouvée pour le document ${documentId}.`);
  process.exit(1);
}

const CHUNK_SIZE = 1000;

const transaction = db.transaction(() => {
  db.prepare(
    `
    DELETE FROM document_chunks
    WHERE page_id IN (
      SELECT id
      FROM document_pages
      WHERE document_id = ?
    )
    `
  ).run(documentId);

  const insertChunk = db.prepare(
    `
    INSERT INTO document_chunks (
      page_id,
      chunk_index,
      text
    )
    VALUES (?, ?, ?)
    `
  );

  let totalChunks = 0;

  for (const page of pages) {
    const text = page.text.trim();

    if (!text) {
      continue;
    }

    let chunkIndex = 0;

    for (let start = 0; start < text.length; start += CHUNK_SIZE) {
      const chunk = text.slice(start, start + CHUNK_SIZE).trim();

      if (!chunk) {
        continue;
      }

      insertChunk.run(
        page.id,
        chunkIndex,
        chunk
      );

      chunkIndex++;
      totalChunks++;
    }
  }

  return totalChunks;
});

const totalChunks = transaction();

console.log(
  `Document ${documentId} : ${pages.length} pages traitées, ${totalChunks} chunks créés.`
);
