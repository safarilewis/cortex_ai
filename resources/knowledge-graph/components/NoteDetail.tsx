import React from "react";
import type { Note, Connection } from "../types";
import { noteColor, tagColor, formatDate } from "../types";

interface NoteDetailProps {
  note: Note;
  allNotes: Note[];
  connections: Connection[];
  onClose: () => void;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  isDeleting: boolean;
}

export const NoteDetail: React.FC<NoteDetailProps> = ({
  note,
  allNotes,
  connections,
  onClose,
  onSelectNote,
  onDeleteNote,
  isDeleting,
}) => {
  const color = noteColor(note);

  const relatedConnections = connections.filter(
    (c) => c.source === note.id || c.target === note.id
  );

  const relatedNotes = relatedConnections
    .map((c) => {
      const otherId = c.source === note.id ? c.target : c.source;
      const other = allNotes.find((n) => n.id === otherId);
      return other ? { note: other, reason: c.reason, strength: c.strength } : null;
    })
    .filter(Boolean) as Array<{ note: Note; reason: string; strength: number }>;

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Colour swatch */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: color,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {note.title.slice(0, 2).toUpperCase()}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {note.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: 6,
            color: "rgba(255,255,255,0.6)",
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>

      {/* Meta */}
      <p
        style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}
      >
        {formatDate(note.createdAt)}
      </p>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="kg-tag"
              style={{ background: tagColor(tag) + "33", color: tagColor(tag), border: `1px solid ${tagColor(tag)}55` }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* Content */}
      <div
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.75)",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 160,
          overflowY: "auto",
        }}
      >
        {note.content}
      </div>

      {/* Connections */}
      {relatedNotes.length > 0 && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {relatedNotes.length} Connection{relatedNotes.length !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {relatedNotes.map(({ note: related, reason, strength }) => {
                const relColor = noteColor(related);
                const barWidth = Math.round(strength * 100);
                return (
                  <button
                    key={related.id}
                    className="kg-connection-pill"
                    onClick={() => onSelectNote(related.id)}
                    style={{ textAlign: "left", width: "100%" }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: relColor,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {related.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {related.title}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {reason}
                      </div>
                      {/* Strength bar */}
                      <div style={{ marginTop: 4, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ width: `${barWidth}%`, height: "100%", background: relColor, borderRadius: 1 }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* No connections yet */}
      {relatedNotes.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
          No connections yet. Add more notes with shared topics or tags.
        </p>
      )}

      {/* Delete */}
      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <button
          onClick={() => onDeleteNote(note.id)}
          disabled={isDeleting}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "rgba(239,68,68,0.8)",
            fontSize: 12,
            fontWeight: 500,
            cursor: isDeleting ? "default" : "pointer",
            opacity: isDeleting ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        >
          {isDeleting ? "Deleting…" : "Delete note"}
        </button>
      </div>
    </div>
  );
};
