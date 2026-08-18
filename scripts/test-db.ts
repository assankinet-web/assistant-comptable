import db from "../lib/db";

const client = db
  .prepare(`
    INSERT INTO clients (name)
    VALUES (?)
    RETURNING *
  `)
  .get("Entreprise Exemple") as {
    id: number;
    name: string;
  };

const dossier = db
  .prepare(`
    INSERT INTO dossiers (
      client_id,
      name,
      fiscal_year
    )
    VALUES (?, ?, ?)
    RETURNING *
  `)
  .get(
    client.id,
    "Exercice 2025",
    2025
  ) as {
    id: number;
    client_id: number;
    name: string;
    fiscal_year: number;
  };

console.log("CLIENT CRÉÉ :");
console.log(client);

console.log("\nDOSSIER CRÉÉ :");
console.log(dossier);

const result = db
  .prepare(`
    SELECT
      clients.id AS client_id,
      clients.name AS client_name,
      dossiers.id AS dossier_id,
      dossiers.name AS dossier_name,
      dossiers.fiscal_year
    FROM clients
    JOIN dossiers
      ON dossiers.client_id = clients.id
    WHERE clients.id = ?
  `)
  .get(client.id);

console.log("\nRELATION CLIENT → DOSSIER :");
console.log(result);
