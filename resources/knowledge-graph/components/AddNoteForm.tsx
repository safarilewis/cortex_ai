import React, { useState, useRef, useCallback } from "react";
import { tagColor } from "../types";

interface AddNoteFormProps {
  onSubmit: (title: string, content: string, tags: string[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const AddNoteForm: React.FC<AddNoteFormProps> = ({
  onSubmit,
  onCancel,
  isLoading,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback((raw: string) => {
    const cleaned = raw.toLowerCase().replace(/^#/, "").trim();
    if (cleaned && !tags.includes(cleaned)) {
      setTags((prev) => [...prev, cleaned]);
    }
    setTagInput("");
  }, [tags]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim()) {
      setError("Content is required");
      return;
    }
    setError("");
    onSubmit(title.trim(), content.trim(), tags);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
          Add Note
        </h3>
        <button
          type="button"
          onClick={onCancel}
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
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* Title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Title
        </label>
        <input
          className="kg-input"
          type="text"
          placeholder="Note title…"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(""); }}
          autoFocus
          disabled={isLoading}
        />
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Content
        </label>
        <textarea
          className="kg-input"
          placeholder="Write your note here…"
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(""); }}
          rows={5}
          disabled={isLoading}
          style={{ resize: "vertical", minHeight: 100 }}
        />
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Tags
        </label>
        {/* Tag chips + input */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            cursor: "text",
            minHeight: 40,
            alignItems: "center",
          }}
          onClick={() => tagInputRef.current?.focus()}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 500,
                background: tagColor(tag) + "33",
                color: tagColor(tag),
                border: `1px solid ${tagColor(tag)}55`,
              }}
            >
              #{tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1, opacity: 0.7 }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            placeholder={tags.length === 0 ? "Add tags (press Enter or ,)" : ""}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            disabled={isLoading}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 13,
              minWidth: 80,
              flex: 1,
            }}
          />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          Tags help the system find connections between notes
        </p>
      </div>

      {/* Error */}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "9px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            flex: 2,
            padding: "9px",
            borderRadius: 8,
            background: isLoading ? "rgba(255,255,255,0.2)" : "#fff",
            border: "none",
            color: isLoading ? "rgba(0,0,0,0.4)" : "#0d1117",
            fontSize: 13,
            fontWeight: 700,
            cursor: isLoading ? "default" : "pointer",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {isLoading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                <path d="M21 12a9 9 0 00-9-9" />
              </svg>
              Saving…
            </>
          ) : (
            "Add Note"
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
};
