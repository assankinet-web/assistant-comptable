
"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Search,
  ChevronRight,
  FolderOpen,
  Users,
  FileStack,
  BarChart3,
  Upload,
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
  dossierName?: string;
  fiscalYear?: number;
  clientId?: number;
  clientName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type View =
  | "dossiers"
  | "documents"
  | "analyses"
  | "clients";

const NAV = [
  {
    id: "clients" as View,
    icon: Users,
    label: "Clients",
  },
  {
    id: "dossiers" as View,
    icon: FolderOpen,
    label: "Dossiers",
  },
  {
    id: "documents" as View,
    icon: FileStack,
    label: "Documents",
  },
  {
    id: "analyses" as View,
    icon: BarChart3,
    label: "Analyses",
  },
];

const SUGGESTIONS = [
  "Quel est le chiffre d'affaires ?",
  "Quels sont les principaux fournisseurs ?",
  "Quelles informations concernent la TVA ?",
  "Résume les principaux éléments comptables.",
];

export default function DossierClientPage() {
  const [view, setView] =
    useState<View>("dossiers");

  const [documents, setDocuments] = useState<
    DocumentItem[]
  >([]);

  const [selectedDoc, setSelectedDoc] =
    useState("");

  const [messages, setMessages] = useState<
    Message[]
  >([]);

  const [query, setQuery] = useState("");

  const [loadingDocs, setLoadingDocs] =
    useState(true);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [loadingAnswer, setLoadingAnswer] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    setError("");

    try {
      const response = await fetch(
        "/api/documents"
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de charger les documents."
        );
      }

      const data = await response.json();

      if (
        !data.success ||
        !Array.isArray(data.documents)
      ) {
        throw new Error(
          "Réponse invalide."
        );
      }

      setDocuments(data.documents);

      setSelectedDoc((current) => {
        if (
          current &&
          data.documents.some(
            (doc: DocumentItem) =>
              doc.fileName === current
          )
        ) {
          return current;
        }

        return (
          data.documents[0]?.fileName || ""
        );
      });
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les documents."
      );
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadHistory = async (
    fileName: string
  ) => {
    setLoadingHistory(true);

    try {
      const response = await fetch(
        "/api/history?fileName=" +
          encodeURIComponent(fileName)
      );

      if (!response.ok) {
        throw new Error(
          "Erreur historique."
        );
      }

      const data = await response.json();

      if (
        data.success &&
        Array.isArray(data.messages)
      ) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
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
      console.error(
        "Erreur sauvegarde :",
        err
      );
    }
  };

  const handleUpload = async (
    file: File
  ) => {
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "/api/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Erreur lors de l'import."
        );
      }

      await loadDocuments();

      if (data.fileName) {
        setSelectedDoc(data.fileName);
      }

      setView("documents");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Échec de l'import."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  };

  /*
   * IMPORTANT :
   *
   * On n'appelle PLUS /api/extract ici.
   *
   * Le backend /api/ask reçoit directement
   * documentId et effectue :
   *
   * document
   *    ↓
   * recherche des chunks
   *    ↓
   * contexte pertinent
   *    ↓
   * Gemini
   *    ↓
   * réponse
   *
   * Cela évite de relire les 21 pages
   * du PDF à chaque question.
   */

  const handleAsk = async (
    question: string
  ) => {
    const cleanQuestion =
      question.trim();

    if (
      !cleanQuestion ||
      !selectedDoc ||
      loadingAnswer
    ) {
      return;
    }

    const selectedDocument =
      documents.find(
        (doc) =>
          doc.fileName === selectedDoc
      );

    if (!selectedDocument) {
      setError(
        "Document sélectionné introuvable."
      );
      return;
    }

    setLoadingAnswer(true);
    setError("");

    const userMessage: Message = {
      role: "user",
      content: cleanQuestion,
    };

    const messagesWithQuestion = [
      ...messages,
      userMessage,
    ];

    setMessages(
      messagesWithQuestion
    );

    setQuery("");

    try {
      const askResponse = await fetch(
        "/api/ask",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            question: cleanQuestion,
            documentId:
              selectedDocument.id,
          }),
        }
      );

      const askData =
        await askResponse.json();

      if (
        !askResponse.ok ||
        !askData.success
      ) {
        throw new Error(
          askData.details ||
            askData.error ||
            "Erreur lors de l'analyse."
        );
      }

      const assistantMessage: Message =
        {
          role: "assistant",
          content: askData.answer,
        };

      const finalMessages = [
        ...messagesWithQuestion,
        assistantMessage,
      ];

      setMessages(finalMessages);

      await saveHistory(
        selectedDoc,
        finalMessages
      );
    } catch (err) {
      console.error(
        "ERREUR QUESTION :",
        err
      );

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue.";

      setError(errorMessage);

      const assistantMessage: Message =
        {
          role: "assistant",
          content: errorMessage,
        };

      const finalMessages = [
        ...messagesWithQuestion,
        assistantMessage,
      ];

      setMessages(finalMessages);

      await saveHistory(
        selectedDoc,
        finalMessages
      );
    } finally {
      setLoadingAnswer(false);
    }
  };

  const currentDocument =
    documents.find(
      (doc) =>
        doc.fileName === selectedDoc
    );

  const assistantMessages =
    messages.filter(
      (message) =>
        message.role === "assistant"
    );

  const lastAssistant =
    assistantMessages[
      assistantMessages.length - 1
    ];

  return (
    <div
      className="min-h-screen w-full flex"
      style={{
        background: "#F6F8F6",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#1B241E",
      }}
    >
      <aside
        className="w-64 shrink-0 flex flex-col min-h-screen"
        style={{
          background: "#1F3329",
        }}
      >
        <div
          className="px-6 py-6 border-b"
          style={{
            borderColor: "#2C4A3B",
          }}
        >
          <div
            className="text-[13px] tracking-[0.18em] font-semibold"
            style={{
              color: "#B8D8C1",
            }}
          >
            LEDGER·AI
          </div>

          <div
            className="text-[10px] mt-1 tracking-[0.08em]"
            style={{
              color: "#6F927D",
            }}
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
                onClick={() =>
                  setView(item.id)
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] text-left"
                style={{
                  background:
                    view === item.id
                      ? "#243A2E"
                      : "transparent",
                  color:
                    view === item.id
                      ? "#EAF3EC"
                      : "#8FAE9B",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                />

                {item.label}
              </button>
            );
          })}
        </nav>

        <div
          className="mt-2 px-6 py-3 text-[11px] tracking-[0.12em] font-medium"
          style={{
            color: "#5E7C6A",
          }}
        >
          IMPORTER
        </div>

        <div className="px-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              if (file) {
                handleUpload(file);
              }
            }}
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploading}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px]"
            style={{
              color: "#9DB9A7",
              opacity: uploading
                ? 0.5
                : 1,
            }}
          >
            <Upload size={15} />

            {uploading
              ? "Import en cours..."
              : "Importer un PDF"}
          </button>
        </div>
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
              style={{
                color: "#5E7C6A",
              }}
            >
              {view.toUpperCase()}
            </div>

            <h1
              className="text-[22px] font-semibold"
              style={{
                color: "#152018",
              }}
            >
              {view === "dossiers"
                ? currentDocument?.name ||
                  "Dossier"
                : view === "documents"
                ? "Documents"
                : view === "analyses"
                ? "Analyses"
                : "Clients"}
            </h1>
          </div>

          <div
            className="text-[13px]"
            style={{
              color: "#5E7C6A",
            }}
          >
            {documents.length} document
            {documents.length > 1
              ? "s"
              : ""}
          </div>
        </header>

        <div className="flex-1 px-10 py-8 max-w-5xl w-full">
          {error && (
            <div
              className="mb-6 px-4 py-3 rounded-md text-[13.5px]"
              style={{
                background: "#FBEAEA",
                color: "#8A3A3A",
              }}
            >
              {error}
            </div>
          )}

          {view === "clients" && (
            <div
              className="rounded-lg border p-6"
              style={{
                borderColor: "#DEE7E0",
                background: "#FFFFFF",
              }}
            >
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{
                  color: "#5E7C6A",
                }}
              >
                CLIENTS
              </div>

              <p
                className="text-[14px] leading-6"
                style={{
                  color: "#5E7C6A",
                }}
              >
                La gestion des clients
                n'est pas encore
                configurée dans le backend.
              </p>
            </div>
          )}

          {view === "documents" && (
            <>
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{
                  color: "#5E7C6A",
                }}
              >
                DOCUMENTS DISPONIBLES
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
                    className="px-5 py-6 text-[13.5px]"
                    style={{
                      color: "#7A9686",
                    }}
                  >
                    Chargement...
                  </div>
                )}

                {!loadingDocs &&
                  documents.length ===
                    0 && (
                    <div
                      className="px-5 py-6 text-[13.5px]"
                      style={{
                        color:
                          "#7A9686",
                      }}
                    >
                      Aucun document
                      importé.
                    </div>
                  )}

                {documents.map(
                  (doc, index) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        setSelectedDoc(
                          doc.fileName
                        );
                        setView(
                          "dossiers"
                        );
                      }}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                      style={{
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid #EDF2EE",
                        background:
                          selectedDoc ===
                          doc.fileName
                            ? "#F2F7F3"
                            : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <FileText
                          size={18}
                          color="#2C4A3B"
                        />

                        <div>
                          <div
                            className="text-[14px] font-medium"
                            style={{
                              color:
                                "#152018",
                            }}
                          >
                            {doc.name}
                          </div>

                          <div
                            className="text-[12px]"
                            style={{
                              color:
                                "#7A9686",
                            }}
                          >
                            {doc.clientName ||
                              "Client"}{" "}
                            ·{" "}
                            {doc.dossierName ||
                              "Dossier"}
                            {doc.fiscalYear
                              ? ` · ${doc.fiscalYear}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        size={15}
                        color="#B7C9BE"
                      />
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {view === "analyses" && (
            <>
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{
                  color: "#5E7C6A",
                }}
              >
                HISTORIQUE DES ANALYSES
              </div>

              {!selectedDoc && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    borderColor:
                      "#DEE7E0",
                    background:
                      "#FFFFFF",
                  }}
                >
                  Sélectionnez un
                  document.
                </div>
              )}

              {selectedDoc &&
                loadingHistory && (
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      borderColor:
                        "#DEE7E0",
                      background:
                        "#FFFFFF",
                      color:
                        "#7A9686",
                    }}
                  >
                    Chargement de
                    l'historique...
                  </div>
                )}

              {selectedDoc &&
                !loadingHistory &&
                messages.length ===
                  0 && (
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      borderColor:
                        "#DEE7E0",
                      background:
                        "#FFFFFF",
                      color:
                        "#7A9686",
                    }}
                  >
                    Aucune analyse
                    enregistrée pour ce
                    document.
                  </div>
                )}

              {!loadingHistory &&
                messages.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {messages.map(
                      (
                        message,
                        index
                      ) => (
                        <div
                          key={index}
                          className="rounded-lg border p-5"
                          style={{
                            borderColor:
                              "#DEE7E0",
                            background:
                              "#FFFFFF",
                          }}
                        >
                          <div
                            className="text-[10px] tracking-[0.12em] font-semibold mb-2"
                            style={{
                              color:
                                "#7A9686",
                            }}
                          >
                            {message.role ===
                            "user"
                              ? "QUESTION"
                              : "RÉPONSE"}
                          </div>

                          <div
                            className="text-[14px] leading-6 whitespace-pre-wrap"
                            style={{
                              color:
                                "#3E5A48",
                            }}
                          >
                            {
                              message.content
                            }
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
            </>
          )}

          {view === "dossiers" && (
            <>
              <div
                className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                style={{
                  color: "#5E7C6A",
                }}
              >
                ANALYSE
              </div>

              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg border mb-4"
                style={{
                  borderColor:
                    "#DEE7E0",
                  background:
                    "#FFFFFF",
                }}
              >
                <Search
                  size={16}
                  color="#7A9686"
                />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault();
                      handleAsk(query);
                    }
                  }}
                  disabled={
                    !selectedDoc ||
                    loadingAnswer
                  }
                  placeholder={
                    selectedDoc
                      ? "Rechercher dans le document..."
                      : "Sélectionnez un document..."
                  }
                  className="flex-1 outline-none text-[14px] bg-transparent placeholder:text-[#A9BEB1]"
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                {SUGGESTIONS.map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        handleAsk(
                          suggestion
                        )
                      }
                      disabled={
                        !selectedDoc ||
                        loadingAnswer
                      }
                      className="text-[12.5px] px-3 py-1.5 rounded-full border"
                      style={{
                        borderColor:
                          "#DEE7E0",
                        color:
                          "#3E5A48",
                        background:
                          "#FFFFFF",
                        opacity:
                          !selectedDoc ||
                          loadingAnswer
                            ? 0.5
                            : 1,
                      }}
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>

              {loadingAnswer && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    borderColor:
                      "#DEE7E0",
                    background:
                      "#FFFFFF",
                    color:
                      "#7A9686",
                  }}
                >
                  Analyse des passages
                  pertinents...
                </div>
              )}

              {!loadingAnswer &&
                lastAssistant && (
                  <div
                    className="rounded-lg border overflow-hidden"
                    style={{
                      borderColor:
                        "#DEE7E0",
                      background:
                        "#FFFFFF",
                    }}
                  >
                    <div
                      className="pl-5 pr-6 py-5"
                      style={{
                        borderLeft:
                          "3px solid #B8D8C1",
                      }}
                    >
                      <div
                        className="text-[11px] tracking-[0.14em] font-semibold mb-3"
                        style={{
                          color:
                            "#5E7C6A",
                        }}
                      >
                        RÉSULTAT
                      </div>

                      <div
                        className="text-[14px] leading-7 whitespace-pre-wrap"
                        style={{
                          color:
                            "#3E5A48",
                        }}
                      >
                        {
                          lastAssistant.content
                        }
                      </div>
                    </div>
                  </div>
                )}

              {!loadingAnswer &&
                !lastAssistant &&
                selectedDoc && (
                  <div
                    className="rounded-lg border p-6"
                    style={{
                      borderColor:
                        "#DEE7E0",
                      background:
                        "#FFFFFF",
                    }}
                  >
                    <div
                      className="text-[11px] tracking-[0.14em] font-semibold mb-2"
                      style={{
                        color:
                          "#5E7C6A",
                      }}
                    >
                      PRÊT
                    </div>

                    <p
                      className="text-[14px]"
                      style={{
                        color:
                          "#7A9686",
                      }}
                    >
                      Posez une question
                      concernant le
                      document sélectionné.
                    </p>
                  </div>
                )}

              {!selectedDoc && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    borderColor:
                      "#DEE7E0",
                    background:
                      "#FFFFFF",
                    color:
                      "#7A9686",
                  }}
                >
                  Aucun document
                  sélectionné.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
