"use client";

import { useEffect, useState } from "react";

type Dossier = {
  id: number;
  client_id: number;
  name: string;
  fiscal_year: number | null;
  client_name: string;
};

type UploadedFile = {
  name: string;
  size: number;
};

export default function DocumentsPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [selectedDossierId, setSelectedDossierId] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loadingDossiers, setLoadingDossiers] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDossiers = async () => {
      try {
        const response = await fetch("/api/dossiers");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Impossible de récupérer les dossiers."
          );
        }

        setDossiers(data.dossiers || []);
      } catch (error) {
        console.error(error);
        setError("Impossible de charger les dossiers.");
      } finally {
        setLoadingDossiers(false);
      }
    };

    loadDossiers();
  }, []);

  const handleFiles = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    if (!selectedDossierId) {
      setError("Sélectionnez d'abord un dossier.");
      event.target.value = "";
      return;
    }

    const selectedFiles = Array.from(event.target.files);

    setUploading(true);
    setError("");

    for (const file of selectedFiles) {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("dossier_id", selectedDossierId);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erreur lors de l'upload.");
          continue;
        }

        setFiles((current) => [
          ...current,
          {
            name: file.name,
            size: file.size,
          },
        ]);
      } catch {
        setError("Impossible de contacter le serveur.");
      }
    }

    setUploading(false);
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Mes documents
          </h1>

          <p className="mt-2 text-gray-500">
            Ajoutez les documents à un dossier comptable.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border bg-white p-6">
          <label
            htmlFor="dossier"
            className="block text-sm font-medium text-gray-700"
          >
            Dossier
          </label>

          <select
            id="dossier"
            value={selectedDossierId}
            onChange={(event) => setSelectedDossierId(event.target.value)}
            disabled={loadingDossiers || uploading}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-black"
          >
            <option value="">
              {loadingDossiers
                ? "Chargement des dossiers..."
                : "Sélectionnez un dossier"}
            </option>

            {dossiers.map((dossier) => (
              <option key={dossier.id} value={dossier.id}>
                {dossier.client_name} — {dossier.name}
                {dossier.fiscal_year
                  ? ` (${dossier.fiscal_year})`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mb-4 text-5xl">📄</div>

          <h2 className="text-xl font-semibold">
            Ajouter des documents
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Pour commencer, seuls les fichiers PDF sont acceptés.
          </p>

          <label
            className={`mt-6 inline-block rounded-xl px-6 py-3 text-sm font-medium text-white ${
              !selectedDossierId || uploading
                ? "cursor-not-allowed bg-gray-400"
                : "cursor-pointer bg-black hover:bg-gray-800"
            }`}
          >
            {uploading
              ? "Envoi en cours..."
              : "+ Choisir des fichiers"}

            <input
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={handleFiles}
              disabled={!selectedDossierId || uploading}
              className="hidden"
            />
          </label>

          {!selectedDossierId && !loadingDossiers && (
            <p className="mt-3 text-sm text-gray-500">
              Sélectionnez un dossier avant d'ajouter un document.
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">
            Documents ajoutés pendant cette session
          </h2>

          {files.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
              Aucun document ajouté pendant cette session.
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>

                    <div>
                      <p className="font-medium text-gray-900">
                        {file.name}
                      </p>

                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} Mo
                      </p>
                    </div>
                  </div>

                  <span className="text-sm text-green-600">
                    ✓ Enregistré
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
