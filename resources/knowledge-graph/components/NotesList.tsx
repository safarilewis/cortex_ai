import React from "react";
import type { Note, Connection } from "../types";
import { noteColor, tagColor, formatDate } from "../types";

interface NotesListProps {
  notes: Note[];
  connections: Connection[];
  selectedNoteId: string | null;
  searchQuery: string;
  onSelectNote: (id: string) => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  connections,
  selectedNoteId,
  searchQuery,
  onSelectNote,
}) => {
  const filtered = searchQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.tags.some((t) => t.includes(searchQuery.toLowerCase()))
      )
    : notes;

  const connectionCount = (noteId: string) =>
    connections.filter((c) => c.source === noteId || c.target === noteId).length;

  if (notes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          color: "rgba(255,255,255,0.3)",
          textAlign: "center",
          gap: 8,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10,9 9,9 8,9" />
        </svg>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No notes yet</p>
        <p style={{ margin: 0, fontSize: 12 }}>Add your first note to get started</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          color: "rgba(255,255,255,0.3)",
          textAlign: "center",
          gap: 8,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No matches found</p>
        <p style={{ margin: 0, fontSize: 12 }}>Try a different search</p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 10,
        alignContent: "start",
      }}
    >
      {filtered.map((note) => {
        const color = noteColor(note);
        const count = connectionCount(note.id);
        const isSelected = selectedNoteId === note.id;

        // Highlight matching text
        const preview = note.content.slice(0, 80) + (note.content.length > 80 ? "…" : "");

        return (
          <button
            key={note.id}
            className={`kg-note-card${isSelected ? " selected" : ""}`}
            onClick={() => onSelectNote(note.id)}
            style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}
          >
            {/* Colour stripe */}
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: color,
                marginBottom: 10,
              }}
            />

            <h4
              style={{
                margin: "0 0 5px 0",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {note.title}
            </h4>

            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.5,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {preview}
            </p>

            {/* Tags */}
            {note.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: tagColor(tag) + "25",
                      color: tagColor(tag),
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                {formatDate(note.createdAt)}
              </span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: color,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="4" cy="6" r="2" />
                    <line x1="12" y1="9" x2="5" y2="7" />
                  </svg>
                  {count}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
