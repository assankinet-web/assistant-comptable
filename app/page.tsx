"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  FolderOpen,
  Users,
  FileStack,
  BarChart3,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

type DocumentItem = {
  id: number;
  fileName: string;
  name: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
  pageCount?: number;
  dossierId?: number;
  dossierName?: string | null;
  fiscalYear?: number | null;
  clientId?: number | null;
  clientName?: string | null;
};

type Dossier = {
  id: number;
  client_id: number;
  name: string;
  fiscal_year: number | null;
  created_at: string;
  updated_at: string;
  client_name: string;
};

type Client = {
  id: number;
  name: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type View = "clients" | "dossiers" | "documents" | "analyses";

const NAV = [
  { id: "clients" as View, icon: Users, label: "Clients" },
  { id: "dossiers" as View, icon: FolderOpen, label: "Dossiers" },
  { id: "documents" as View, icon: FileStack, label: "Documents" },
  { id: "analyses" as View, icon: BarChart3, label: "Analyses" },
];

const SUGGESTIONS = [
  "Quel est le chiffre d'affaires ?",
  "Quels sont les principaux fournisseurs ?",
  "Quelles informations concernent la TVA ?",
  "Résume les principaux éléments comptables.",
];

function formatFileSize(size?: number) {
  if (!size) return "—";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function statusLabel(status?: string) {
  switch (status) {
    case "extracted":
      return "Extrait";
    case "uploaded":
      return "En attente";
    case "error":
      return "Erreur";
    default:
      return status || "Inconnu";
  }
}

export default function DossierClientPage() {
  const [view, setView] = useState<View>("dossiers");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [selectedDoc, setSelectedDoc] = useState("");
  const [selectedDossierId, setSelectedDossierId] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingDossiers, setLoadingDossiers] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoadingDocs(true);

    try {
      const response = await fetch("/api/documents", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Impossible de charger les documents."
        );
      }

      const nextDocuments: DocumentItem[] = Array.isArray(data.documents)
        ? data.documents
        : [];

      setDocuments(nextDocuments);

      setSelectedDoc((current) => {
        if (
          current &&
          nextDocuments.some((doc) => doc.fileName === current)
        ) {
          return current;
        }

        return nextDocuments[0]?.fileName || "";
      });
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les documents.");
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadDossiers = async () => {
    setLoadingDossiers(true);

    try {
      const response = await fetch("/api/dossiers", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Impossible de charger les dossiers."
        );
      }

      const nextDossiers: Dossier[] = Array.isArray(data.dossiers)
        ? data.dossiers
        : [];

      setDossiers(nextDossiers);

      setSelectedDossierId((current) => {
        if (
          current &&
          nextDossiers.some(
            (dossier) => String(dossier.id) === current
          )
        ) {
          return current;
        }

        return nextDossiers[0] ? String(nextDossiers[0].id) : "";
      });
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les dossiers.");
    } finally {
      setLoadingDossiers(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);

    try {
      const response = await fetch("/api/clients", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Impossible de charger les clients."
        );
      }

      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les clients.");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadDossiers();
    loadClients();
  }, []);

  const loadHistory = async (fileName: string) => {
    setLoadingHistory(true);

    try {
      const response = await fetch(
        "/api/history?fileName=" + encodeURIComponent(fileName),
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur historique.");
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      console.error(err);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedDoc) {
      loadHistory(selectedDoc);
    } else {
      setMessages([]);
    }
  }, [selectedDoc]);

  const saveHistory = async (
    fileName: string,
    historyMessages: Message[]
  ) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          messages: historyMessages,
        }),
      });
    } catch (err) {
      console.error("Erreur sauvegarde :", err);
    }
  };

  const extractDocument = async (fileName: string) => {
    setExtracting(true);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Impossible d'extraire le document."
        );
      }

      await loadDocuments();
      return true;
    } catch (err) {
      console.error("ERREUR EXTRACTION :", err);

      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'extraire le document."
      );

      await loadDocuments();
      return false;
    } finally {
      setExtracting(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!selectedDossierId) {
      setError("Sélectionne d'abord un dossier.");
      setView("dossiers");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("dossier_id", selectedDossierId);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'import.");
      }

      if (!data.fileName) {
        throw new Error(
          "Le serveur n'a pas retourné le nom du fichier."
        );
      }

      setSelectedDoc(data.fileName);

      await loadDocuments();

      setView("documents");

      await extractDocument(data.fileName);
    } catch (err) {
      console.error("ERREUR IMPORT :", err);

      setError(
        err instanceof Error ? err.message : "Échec de l'import."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAsk = async (question: string) => {
    const cleanQuestion = question.trim();

    if (!cleanQuestion || !selectedDoc || loadingAnswer) {
      return;
    }

    const selectedDocument = documents.find(
      (doc) => doc.fileName === selectedDoc
    );

    if (!selectedDocument) {
      setError("Document sélectionné introuvable.");
      return;
    }

    if (selectedDocument.status !== "extracted") {
      setError(
        "Ce document n'est pas encore extrait. Lance d'abord son extraction."
      );
      return;
    }

    setLoadingAnswer(true);
    setError("");

    const userMessage: Message = {
      role: "user",
      content: cleanQuestion,
    };

    const messagesWithQuestion = [...messages, userMessage];

    setMessages(messagesWithQuestion);
    setQuery("");

    try {
      const askResponse = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          documentId: selectedDocument.id,
        }),
      });

      const askData = await askResponse.json();

      if (!askResponse.ok || !askData.success) {
        throw new Error(
          askData.details ||
            askData.error ||
            "Erreur lors de l'analyse."
        );
      }

      const assistantMessage: Message = {
        role: "assistant",
        content:
          askData.answer || "Je n'ai pas pu générer de réponse.",
      };

      const finalMessages = [
        ...messagesWithQuestion,
        assistantMessage,
      ];

      setMessages(finalMessages);
      await saveHistory(selectedDoc, finalMessages);
    } catch (err) {
      console.error("ERREUR QUESTION :", err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue.";

      setError(errorMessage);

      const assistantMessage: Message = {
        role: "assistant",
        content: errorMessage,
      };

      const finalMessages = [
        ...messagesWithQuestion,
        assistantMessage,
      ];

      setMessages(finalMessages);
      await saveHistory(selectedDoc, finalMessages);
    } finally {
      setLoadingAnswer(false);
    }
  };

  const currentDocument = documents.find(
    (doc) => doc.fileName === selectedDoc
  );

  const currentDossier = dossiers.find(
    (dossier) => String(dossier.id) === selectedDossierId
  );

  return (
    <div
      className="min-h-screen w-full flex"
      style={{
        background: "#F6F8F6",
        color: "#1B241E",
      }}
    >
      <aside
        className="w-64 shrink-0 flex flex-col min-h-screen"
        style={{ background: "#1F3329" }}
      >
        <div
          className="px-6 py-6 border-b"
          style={{ borderColor: "#2C4A3B" }}
        >
          <div
            className="text-[13px] tracking-[0.18em] font-semibold"
            style={{ color: "#B8D8C1" }}
          >
            LEDGER·AI
          </div>

          <div
            className="text-[10px] mt-1 tracking-[0.08em]"
            style={{ color: "#6F927D" }}
          >
            ASSISTANT COMPTABLE
          </div>
        </div>

        <nav className="px-3 py-4 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] text-left"
                style={{
                  background:
                    view === item.id ? "#243A2E" : "transparent",
                  color:
                    view === item.id ? "#EAF3EC" : "#8FAE9B",
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div
          className="mt-2 px-6 py-3 text-[11px] tracking-[0.12em] font-medium"
          style={{ color: "#5E7C6A" }}
        >
          DOSSIER ACTIF
        </div>

        <div className="px-3">
          <select
            value={selectedDossierId}
            onChange={(event) =>
              setSelectedDossierId(event.target.value)
            }
            disabled={loadingDossiers || dossiers.length === 0}
            className="w-full rounded-md px-3 py-2.5 text-[13px] border outline-none"
            style={{
              background: "#243A2E",
              color: "#EAF3EC",
              borderColor: "#365341",
            }}
          >
            {dossiers.length === 0 && (
              <option value="">Aucun dossier</option>
            )}

            {dossiers.map((dossier) => (
              <option key={dossier.id} value={dossier.id}>
                {dossier.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="mt-5 px-6 py-3 text-[11px] tracking-[0.12em] font-medium"
          style={{ color: "#5E7C6A" }}
        >
          IMPORTER
        </div>

        <div className="px-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                handleUpload(file);
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              uploading || extracting || !selectedDossierId
            }
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px]"
            style={{
              color: "#9DB9A7",
              opacity:
                uploading || extracting || !selectedDossierId
                  ? 0.5
                  : 1,
            }}
          >
            {uploading || extracting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}

            {uploading
              ? "Import en cours..."
              : extracting
                ? "Extraction en cours..."
                : "Importer un PDF"}
          </button>
        </div>

        {currentDossier && (
          <div
            className="mt-auto px-6 py-5 border-t text-[11px]"
            style={{
              borderColor: "#2C4A3B",
              color: "#6F927D",
            }}
          >
            <div className="uppercase tracking-[0.12em] mb-1">
              Dossier
            </div>

            <div
              className="text-[13px]"
              style={{ color: "#B8D8C1" }}
            >
              {currentDossier.name}
            </div>

            <div className="mt-1">
              {currentDossier.client_name}
              {currentDossier.fiscal_year
                ? ` · ${currentDossier.fiscal_year}`
                : ""}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="px-10 py-6 border-b flex items-end justify-between"
          style={{
            borderColor: "#DEE7E0",
            background: "#FFFFFF",
          }}
        >
          <div>
            <div
              className="text-[11px] tracking-[0.14em] font-semibold mb-1"
              style={{ color: "#5E7C6A" }}
            >
              {view.toUpperCase()}
            </div>

            <h1
              className="text-[22px] font-semibold"
              style={{ color: "#152018" }}
            >
              {view === "dossiers"
                ? currentDossier?.name || "Dossiers"
                : view === "documents"
                  ? "Documents"
                  : view === "analyses"
                    ? "Analyses"
                    : "Clients"}
            </h1>
          </div>

          <div
            className="text-[13px]"
            style={{ color: "#5E7C6A" }}
          >
            {documents.length} document
            {documents.length > 1 ? "s" : ""}
          </div>
        </header>

        <div className="flex-1 px-10 py-8 max-w-6xl w-full">
          {error && (
            <div
              className="mb-6 px-4 py-3 rounded-md text-[13.5px] flex items-start gap-3"
              style={{
                background: "#FBEAEA",
                color: "#8A3A3A",
              }}
            >
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <div className="flex-1">{error}</div>

              <button
                type="button"
                onClick={() => setError("")}
                className="text-xs"
              >
                Fermer
              </button>
            </div>
          )}

          {view === "clients" && (
            <section>
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{ color: "#5E7C6A" }}
              >
                CLIENTS
              </div>

              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  borderColor: "#DEE7E0",
                  background: "#FFFFFF",
                }}
              >
                {loadingClients && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Chargement des clients...
                  </div>
                )}

                {!loadingClients && clients.length === 0 && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Aucun client.
                  </div>
                )}

                {clients.map((client) => {
                  const clientDossiers = dossiers.filter(
                    (dossier) =>
                      dossier.client_id === client.id
                  );

                  const clientDocuments = documents.filter(
                    (document) =>
                      document.clientId === client.id
                  );

                  return (
                    <div
                      key={client.id}
                      className="px-5 py-4 border-b last:border-b-0"
                      style={{ borderColor: "#EDF2EE" }}
                    >
                      <div
                        className="font-medium"
                        style={{ color: "#152018" }}
                      >
                        {client.name}
                      </div>

                      <div
                        className="mt-1 text-[12px]"
                        style={{ color: "#7A9686" }}
                      >
                        {clientDossiers.length} dossier
                        {clientDossiers.length > 1 ? "s" : ""}
                        {" · "}
                        {clientDocuments.length} document
                        {clientDocuments.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {view === "dossiers" && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="text-[11px] tracking-[0.14em] font-semibold"
                  style={{ color: "#5E7C6A" }}
                >
                  DOSSIERS
                </div>

                <button
                  type="button"
                  onClick={loadDossiers}
                  className="flex items-center gap-2 text-[12px]"
                  style={{ color: "#5E7C6A" }}
                >
                  <RefreshCw size={14} />
                  Actualiser
                </button>
              </div>

              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  borderColor: "#DEE7E0",
                  background: "#FFFFFF",
                }}
              >
                {loadingDossiers && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Chargement des dossiers...
                  </div>
                )}

                {!loadingDossiers && dossiers.length === 0 && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Aucun dossier disponible.
                  </div>
                )}

                {dossiers.map((dossier) => {
                  const dossierDocuments = documents.filter(
                    (document) =>
                      document.dossierId === dossier.id
                  );

                  const active =
                    String(dossier.id) ===
                    selectedDossierId;

                  return (
                    <button
                      key={dossier.id}
                      type="button"
                      onClick={() =>
                        setSelectedDossierId(
                          String(dossier.id)
                        )
                      }
                      className="w-full text-left px-5 py-4 border-b last:border-b-0"
                      style={{
                        borderColor: "#EDF2EE",
                        background: active
                          ? "#F2F7F3"
                          : "#FFFFFF",
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div
                            className="font-medium"
                            style={{ color: "#152018" }}
                          >
                            {dossier.name}
                          </div>

                          <div
                            className="mt-1 text-[12px]"
                            style={{ color: "#7A9686" }}
                          >
                            {dossier.client_name}
                            {dossier.fiscal_year
                              ? ` · ${dossier.fiscal_year}`
                              : ""}
                          </div>
                        </div>

                        <div
                          className="text-[12px]"
                          style={{ color: "#7A9686" }}
                        >
                          {dossierDocuments.length} document
                          {dossierDocuments.length > 1
                            ? "s"
                            : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {view === "documents" && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="text-[11px] tracking-[0.14em] font-semibold"
                  style={{ color: "#5E7C6A" }}
                >
                  DOCUMENTS DISPONIBLES
                </div>

                <button
                  type="button"
                  onClick={loadDocuments}
                  className="flex items-center gap-2 text-[12px]"
                  style={{ color: "#5E7C6A" }}
                >
                  <RefreshCw size={14} />
                  Actualiser
                </button>
              </div>

              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  borderColor: "#DEE7E0",
                  background: "#FFFFFF",
                }}
              >
                {loadingDocs && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Chargement...
                  </div>
                )}

                {!loadingDocs && documents.length === 0 && (
                  <div
                    className="px-5 py-6"
                    style={{ color: "#7A9686" }}
                  >
                    Aucun document importé.
                  </div>
                )}

                {documents.map((doc) => {
                  const active =
                    doc.fileName === selectedDoc;

                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoc(doc.fileName);

                        setSelectedDossierId(
                          doc.dossierId
                            ? String(doc.dossierId)
                            : selectedDossierId
                        );

                        setView("analyses");
                      }}
                      className="w-full text-left px-5 py-4 border-b last:border-b-0"
                      style={{
                        borderColor: "#EDF2EE",
                        background: active
                          ? "#F2F7F3"
                          : "#FFFFFF",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <FileText
                          size={20}
                          style={{ color: "#5E7C6A" }}
                        />

                        <div className="flex-1 min-w-0">
                          <div
                            className="font-medium truncate"
                            style={{ color: "#152018" }}
                          >
                            {doc.name}
                          </div>

                          <div
                            className="mt-1 text-[12px]"
                            style={{ color: "#7A9686" }}
                          >
                            {doc.clientName ||
                              "Client inconnu"}
                            {" · "}
                            {doc.dossierName ||
                              "Dossier inconnu"}
                            {" · "}
                            {formatFileSize(doc.fileSize)}
                            {doc.pageCount
                              ? ` · ${doc.pageCount} page${
                                  doc.pageCount > 1
                                    ? "s"
                                    : ""
                                }`
                              : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {doc.status === "extracted" && (
                            <CheckCircle2
                              size={16}
                              style={{ color: "#39734D" }}
                            />
                          )}

                          {doc.status === "error" && (
                            <AlertCircle
                              size={16}
                              style={{ color: "#8A3A3A" }}
                            />
                          )}

                          <span
                            className="text-[11px]"
                            style={{
                              color:
                                doc.status ===
                                "extracted"
                                  ? "#39734D"
                                  : doc.status === "error"
                                    ? "#8A3A3A"
                                    : "#7A9686",
                            }}
                          >
                            {statusLabel(doc.status)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {view === "analyses" && (
            <section>
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{ color: "#5E7C6A" }}
              >
                ANALYSE DU DOCUMENT
              </div>

              {!currentDocument && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    borderColor: "#DEE7E0",
                    background: "#FFFFFF",
                  }}
                >
                  <p
                    className="text-[14px]"
                    style={{ color: "#5E7C6A" }}
                  >
                    Sélectionne un document pour commencer
                    une analyse.
                  </p>
                </div>
              )}

              {currentDocument && (
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{
                    borderColor: "#DEE7E0",
                    background: "#FFFFFF",
                  }}
                >
                  <div
                    className="px-6 py-5 border-b"
                    style={{ borderColor: "#EDF2EE" }}
                  >
                    <div
                      className="font-medium"
                      style={{ color: "#152018" }}
                    >
                      {currentDocument.name}
                    </div>

                    <div
                      className="mt-1 text-[12px]"
                      style={{ color: "#7A9686" }}
                    >
                      {currentDocument.clientName}
                      {" · "}
                      {currentDocument.dossierName}
                    </div>
                  </div>

                  <div className="p-6">
                    <div
                      className="text-[13px] leading-6 mb-5"
                      style={{ color: "#3E5A48" }}
                    >
                      Pose une question sur ce document.
                      Les réponses sont générées à partir
                      des extraits extraits du PDF.
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() =>
                            handleAsk(suggestion)
                          }
                          disabled={
                            loadingAnswer ||
                            currentDocument.status !==
                              "extracted"
                          }
                          className="px-3 py-2 rounded-md border text-[12px]"
                          style={{
                            borderColor: "#DEE7E0",
                            color: "#3E5A48",
                            background: "#F6F8F6",
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    <div
                      className="rounded-md border"
                      style={{
                        borderColor: "#DEE7E0",
                      }}
                    >
                      <textarea
                        value={query}
                        onChange={(event) =>
                          setQuery(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();
                            handleAsk(query);
                          }
                        }}
                        placeholder="Pose une question sur le document..."
                        rows={4}
                        className="w-full resize-none border-0 outline-none p-4 text-[14px]"
                        disabled={
                          loadingAnswer ||
                          currentDocument.status !==
                            "extracted"
                        }
                      />

                      <div
                        className="px-4 py-3 border-t flex justify-between items-center"
                        style={{
                          borderColor: "#EDF2EE",
                        }}
                      >
                        <span
                          className="text-[11px]"
                          style={{ color: "#9AAF9F" }}
                        >
                          Entrée pour envoyer · Maj+Entrée
                          pour une nouvelle ligne
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleAsk(query)
                          }
                          disabled={
                            loadingAnswer ||
                            !query.trim() ||
                            currentDocument.status !==
                              "extracted"
                          }
                          className="px-4 py-2 rounded-md text-[12px] font-medium"
                          style={{
                            background: "#1F3329",
                            color: "#FFFFFF",
                            opacity:
                              loadingAnswer ||
                              !query.trim() ||
                              currentDocument.status !==
                                "extracted"
                                ? 0.45
                                : 1,
                          }}
                        >
                          {loadingAnswer
                            ? "Analyse..."
                            : "Analyser"}
                        </button>
                      </div>
                    </div>

                    {loadingHistory && (
                      <div
                        className="mt-5 text-[12px]"
                        style={{ color: "#7A9686" }}
                      >
                        Chargement de l'historique...
                      </div>
                    )}

                    {messages.length > 0 && (
                      <div className="mt-6 space-y-4">
                        {messages.map((message, index) => (
                          <div
                            key={`${index}-${message.role}`}
                            className="rounded-md p-4"
                            style={{
                              background:
                                message.role === "user"
                                  ? "#F2F7F3"
                                  : "#FFFFFF",
                              border:
                                "1px solid #DEE7E0",
                            }}
                          >
                            <div
                              className="text-[10px] tracking-[0.12em] font-semibold mb-2"
                              style={{
                                color:
                                  message.role === "user"
                                    ? "#5E7C6A"
                                    : "#39734D",
                              }}
                            >
                              {message.role === "user"
                                ? "QUESTION"
                                : "LEDGER·AI"}
                            </div>

                            <div
                              className="text-[13.5px] leading-6 whitespace-pre-wrap"
                              style={{
                                color: "#26352C",
                              }}
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
