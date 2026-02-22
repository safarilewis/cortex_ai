import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import "../styles.css";
import { propSchema, computeConnectionsClient } from "./types";
import type {
  Note,
  Connection,
  KnowledgeGraphProps,
  AddNoteResponse,
  DeleteNoteResponse,
} from "./types";
import { GraphView } from "./components/GraphView";
import { NotesList } from "./components/NotesList";
import { NoteDetail } from "./components/NoteDetail";
import { AddNoteForm } from "./components/AddNoteForm";

// ─── Widget metadata ───────────────────────────────────────────────────────────

export const widgetMetadata: WidgetMetadata = {
  description: "Interactive knowledge graph for your notes",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading knowledge graph…",
    invoked: "Knowledge graph ready",
    csp: { resourceDomains: [] },
  },
};

type SidebarPanel = "detail" | "add" | null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cleanTags(raw: string[]): string[] {
  return raw.map((t) => t.toLowerCase().replace(/^#/, "").trim()).filter(Boolean);
}

/** Safely extract structured content from a tool response, falling back to
 *  parsing the raw text content as JSON when structuredContent is absent. */
function extractContent<T>(data: { structuredContent?: unknown; content?: unknown } | null | undefined): T | null {
  if (!data) return null;
  if (data.structuredContent && typeof data.structuredContent === "object") {
    return data.structuredContent as T;
  }
  // Fallback: try to parse content[0].text as JSON
  try {
    const arr = data.content as Array<{ type: string; text: string }> | undefined;
    if (Array.isArray(arr) && arr[0]?.type === "text") {
      return JSON.parse(arr[0].text) as T;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const KnowledgeGraphWidget: React.FC = () => {
  const { props, isPending, displayMode, requestDisplayMode } =
    useWidget<KnowledgeGraphProps>();

  const { callTool: callAddNote, data: addNoteData, isPending: isAddingNote } =
    useCallTool("add-note");
  const { callTool: callDeleteNote, data: deleteNoteData, isPending: isDeletingNote } =
    useCallTool("delete-note");

  // ── Core data state ────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [highlightNoteId, setHighlightNoteId] = useState<string | undefined>();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Initialise from widget props ───────────────────────────────────────────
  useEffect(() => {
    if (!props) return;
    setNotes(props.notes ?? []);
    setConnections(props.connections ?? []);
    if (props.highlightNoteId) {
      setHighlightNoteId(props.highlightNoteId);
      setSelectedNoteId(props.highlightNoteId);
      setSidebarPanel("detail");
    }
  }, [props]);

  // ── Handle add-note server response ───────────────────────────────────────
  // This replaces the optimistic note with the authoritative server version.
  useEffect(() => {
    const res = extractContent<AddNoteResponse>(addNoteData as any);
    if (!res?.notes) return;
    setNotes(res.notes);
    // Prefer server-computed connections; if empty fall back to client compute
    const serverConns = res.connections ?? [];
    setConnections(serverConns.length > 0 ? serverConns : computeConnectionsClient(res.notes));
    setHighlightNoteId(res.note.id);
    setSelectedNoteId(res.note.id);
    setSidebarPanel("detail");
  }, [addNoteData]);

  // ── Handle delete-note server response ─────────────────────────────────────
  useEffect(() => {
    const res = extractContent<DeleteNoteResponse>(deleteNoteData as any);
    if (!res || res.notes === undefined) return;
    setNotes(res.notes);
    const serverConns = res.connections ?? [];
    setConnections(serverConns.length > 0 ? serverConns : computeConnectionsClient(res.notes));
    setSelectedNoteId(null);
    setSidebarPanel(null);
  }, [deleteNoteData]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSelectNote = useCallback((id: string) => {
    setSelectedNoteId(id);
    setSidebarPanel("detail");
  }, []);

  const handleAddNote = useCallback(
    (title: string, content: string, tags: string[]) => {
      const cleanedTags = cleanTags(tags);

      // ── Optimistic update — show the note immediately ────────────────────
      // Uses a temporary ID; the server response will overwrite with the real one.
      const tempId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `temp-${Date.now()}`;

      const optimisticNote: Note = {
        id: tempId,
        title,
        content,
        tags: cleanedTags,
        createdAt: new Date().toISOString(),
      };

      setNotes((prev) => {
        const updated = [...prev, optimisticNote];
        setConnections(computeConnectionsClient(updated));
        return updated;
      });
      setHighlightNoteId(tempId);
      setSelectedNoteId(tempId);
      setSidebarPanel("detail");

      // ── Persist on the server (Supabase) ─────────────────────────────────
      callAddNote({ title, content, tags: cleanedTags });
    },
    [callAddNote]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      // Optimistic delete
      setNotes((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        setConnections(computeConnectionsClient(updated));
        return updated;
      });
      setSelectedNoteId(null);
      setSidebarPanel(null);
      callDeleteNote({ id });
    },
    [callDeleteNote]
  );

  const handleCloseSidebar = useCallback(() => {
    setSidebarPanel(null);
    setSelectedNoteId(null);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  // Notes visible in graph/list (filtered by search)
  const visibleNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q))
    );
  }, [notes, searchQuery]);

  // Only show connections where BOTH endpoints are in the visible set
  const visibleIds = useMemo(() => new Set(visibleNotes.map((n) => n.id)), [visibleNotes]);
  const visibleConnections = useMemo(
    () => connections.filter((c) => visibleIds.has(c.source) && visibleIds.has(c.target)),
    [connections, visibleIds]
  );

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const isFullscreen = displayMode === "fullscreen";
  const isPip = displayMode === "pip";
  const showSidebar = sidebarPanel !== null;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isPending) {
    return (
      <McpUseProvider>
        <div className="kg-root" style={{ minHeight: 400 }}>
          <div className="kg-toolbar">
            <div style={{ height: 28, width: 160, borderRadius: 8, background: "rgba(255,255,255,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ flex: 1 }} />
            <div style={{ height: 28, width: 80, borderRadius: 8, background: "rgba(255,255,255,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
          <div className="kg-body">
            <div className="kg-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading…</div>
            </div>
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider>
      <div className="kg-root">
        {/* ── Toolbar ────────────────────────────────────────────────────────── */}
        <div className="kg-toolbar">
          <button
            className={`kg-tab${viewMode === "graph" ? " active" : ""}`}
            onClick={() => setViewMode("graph")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" />
              <circle cx="4" cy="18" r="2" /><line x1="12" y1="9" x2="5" y2="7" />
              <line x1="12" y1="9" x2="19" y2="7" /><line x1="12" y1="15" x2="5" y2="17" />
            </svg>
            Graph
          </button>
          <button
            className={`kg-tab${viewMode === "list" ? " active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Notes
          </button>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />

          <input
            className="kg-search"
            type="text"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ flex: 1 }} />

          {/* Connection badge */}
          {connections.length > 0 && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
              {connections.length} link{connections.length !== 1 ? "s" : ""}
            </span>
          )}

          {!isFullscreen && !isPip && (
            <>
              <button className="kg-tab" onClick={() => requestDisplayMode("pip")} title="Picture in picture">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <rect x="11" y="10" width="10" height="6" rx="1" fill="currentColor" opacity="0.4" />
                </svg>
              </button>
              <button className="kg-tab" onClick={() => requestDisplayMode("fullscreen")} title="Fullscreen">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15,3 21,3 21,9" /><polyline points="9,21 3,21 3,15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </>
          )}
          {(isFullscreen || isPip) && (
            <button className="kg-tab" onClick={() => requestDisplayMode("inline")} title="Exit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <button className="kg-add-btn" onClick={() => { setSidebarPanel("add"); setSelectedNoteId(null); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Note
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="kg-body">
          <div className="kg-main">
            {viewMode === "graph" ? (
              <GraphView
                notes={visibleNotes}
                connections={visibleConnections}
                selectedNoteId={selectedNoteId}
                highlightNoteId={highlightNoteId}
                onSelectNote={handleSelectNote}
              />
            ) : (
              <NotesList
                notes={notes}
                connections={connections}
                selectedNoteId={selectedNoteId}
                searchQuery={searchQuery}
                onSelectNote={handleSelectNote}
              />
            )}
          </div>

          {showSidebar && (
            <div className="kg-sidebar">
              {sidebarPanel === "add" && (
                <AddNoteForm
                  onSubmit={handleAddNote}
                  onCancel={handleCloseSidebar}
                  isLoading={isAddingNote}
                />
              )}
              {sidebarPanel === "detail" && selectedNote && (
                <NoteDetail
                  note={selectedNote}
                  allNotes={notes}
                  connections={connections}
                  onClose={handleCloseSidebar}
                  onSelectNote={handleSelectNote}
                  onDeleteNote={handleDeleteNote}
                  isDeleting={isDeletingNote}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </McpUseProvider>
  );
};

export default KnowledgeGraphWidget;
