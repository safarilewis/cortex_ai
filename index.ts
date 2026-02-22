import { MCPServer, object, text, widget } from "mcp-use/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new MCPServer({
  name: "knowledge-graph",
  title: "Knowledge Graph Notes",
  version: "1.0.0",
  description: "A smart note-taking app that builds a knowledge graph from your notes",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com",
  icons: [{ src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] }],
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface Connection {
  source: string;
  target: string;
  strength: number;
  reason: string;
}

// ─── Supabase setup ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service-role or anon key

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  console.log("[Supabase] Connected —", SUPABASE_URL);
} else {
  console.log("[Supabase] Not configured — using in-memory store (notes won't persist across restarts)");
  console.log("[Supabase] Set SUPABASE_URL and SUPABASE_KEY env vars to enable persistence.");
}

// ─── In-memory cache (always kept in sync with Supabase when configured) ──────

let notes: Note[] = [];

// ─── Supabase ↔ Note mapping ──────────────────────────────────────────────────

interface SupabaseNoteRow {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

function rowToNote(row: SupabaseNoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** Load all notes from Supabase (or return in-memory cache). */
async function loadAllNotes(): Promise<Note[]> {
  if (!supabase) return notes;

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Supabase] loadAllNotes error:", error.message);
    return notes; // fall back to cache
  }

  notes = (data as SupabaseNoteRow[]).map(rowToNote);
  return notes;
}

/** Insert a new note into Supabase and the in-memory cache. */
async function insertNote(note: Note): Promise<void> {
  notes.push(note);

  if (!supabase) return;

  const { error } = await supabase.from("notes").insert({
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    created_at: note.createdAt,
  });

  if (error) {
    console.error("[Supabase] insertNote error:", error.message);
  }
}

/** Delete a note from Supabase and the in-memory cache. */
async function removeNote(id: string): Promise<boolean> {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  notes.splice(idx, 1);

  if (!supabase) return true;

  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    console.error("[Supabase] removeNote error:", error.message);
  }
  return true;
}

// ─── Connection detection ─────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "and", "that", "this", "have", "for", "not", "with", "you", "are",
  "from", "they", "will", "your", "what", "about", "which", "when", "there",
  "been", "more", "also", "into", "some", "than", "then", "them", "these",
  "its", "our", "out", "can", "all", "was", "but", "has", "had", "his",
  "her", "she", "him", "were", "said", "each", "how", "their", "would",
]);

function extractKeywords(str: string): Set<string> {
  return new Set(
    str.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

/**
 * Compute all pairwise connections between notes.
 *
 * Priority order (first match wins):
 *   1. Shared tags          → Jaccard ratio, min strength 0.4
 *   2. Tag substring match  → strength 0.35
 *   3. Keyword overlap      → Jaccard ≥ 0.03, OR any title word in common
 *
 * Connections are recomputed on every mutation so they always
 * reflect the current state of the note set.
 */
function computeConnections(allNotes: Note[]): Connection[] {
  const connectionMap = new Map<string, Connection>();

  for (let i = 0; i < allNotes.length; i++) {
    for (let j = i + 1; j < allNotes.length; j++) {
      const a = allNotes[i];
      const b = allNotes[j];
      const key = [a.id, b.id].sort().join("~");
      if (connectionMap.has(key)) continue;

      // ── 1. Exact tag overlap ────────────────────────────────────────────────
      const sharedTags = a.tags.filter((t) => b.tags.includes(t));
      if (sharedTags.length > 0) {
        const tagUnion = new Set([...a.tags, ...b.tags]).size;
        connectionMap.set(key, {
          source: a.id,
          target: b.id,
          strength: Math.max(sharedTags.length / tagUnion, 0.4),
          reason: `Shared tags: ${sharedTags.map((t) => "#" + t).join(", ")}`,
        });
        continue;
      }

      // ── 2. Tag substring match ──────────────────────────────────────────────
      const tagSubMatch = a.tags.find((at) =>
        b.tags.some((bt) => at.includes(bt) || bt.includes(at))
      );
      if (tagSubMatch) {
        connectionMap.set(key, {
          source: a.id,
          target: b.id,
          strength: 0.35,
          reason: `Related tags`,
        });
        continue;
      }

      // ── 3. Keyword overlap ─────────────────────────────────────────────────
      const aWords = extractKeywords(a.title + " " + a.content);
      const bWords = extractKeywords(b.title + " " + b.content);
      const shared = [...aWords].filter((w) => bWords.has(w));

      if (shared.length >= 1) {
        const union = new Set([...aWords, ...bWords]).size || 1;
        const jaccard = shared.length / union;
        const titleWords = extractKeywords(a.title);
        const bTitleWords = extractKeywords(b.title);
        const titleMatch = shared.some((w) => titleWords.has(w) || bTitleWords.has(w));

        if (jaccard >= 0.03 || (titleMatch && shared.length >= 1)) {
          connectionMap.set(key, {
            source: a.id,
            target: b.id,
            strength: Math.min(jaccard * 6, 0.9),
            reason: `Related concepts: ${shared.slice(0, 3).join(", ")}`,
          });
        }
      }
    }
  }

  return [...connectionMap.values()];
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const noteZod = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

const connectionZod = z.object({
  source: z.string(),
  target: z.string(),
  strength: z.number(),
  reason: z.string(),
});

// ─── Tool: add-note ───────────────────────────────────────────────────────────

server.tool(
  {
    name: "add-note",
    description:
      "Add a new note to the knowledge base. Connections to existing notes are automatically detected from shared tags and keyword overlap and returned alongside the updated graph.",
    schema: z.object({
      title: z.string().describe("A concise title for the note"),
      content: z.string().describe("The note body text"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to categorise the note (e.g. ['science', 'biology'])"),
    }),
    outputSchema: z.object({
      note: noteZod,
      notes: z.array(noteZod),
      connections: z.array(connectionZod),
    }),
  },
  async ({ title, content, tags = [] }) => {
    // Normalise tags: lowercase, strip leading '#', remove blanks
    const cleanTags = tags
      .map((t) => t.toLowerCase().replace(/^#/, "").trim())
      .filter(Boolean);

    const note: Note = {
      id: randomUUID(),
      title,
      content,
      tags: cleanTags,
      createdAt: new Date().toISOString(),
    };

    // Persist (Supabase or memory)
    await insertNote(note);

    // Recompute all connections over the full (updated) note set
    const connections = computeConnections(notes);

    const noteConns = connections.filter(
      (c) => c.source === note.id || c.target === note.id
    );

    console.log(
      `[add-note] "${title}" — ${noteConns.length} new connection(s) detected`
    );

    return object({ note, notes: [...notes], connections } as any);
  }
);

// ─── Tool: delete-note ────────────────────────────────────────────────────────

server.tool(
  {
    name: "delete-note",
    description: "Delete a note by its ID and return the updated graph.",
    schema: z.object({
      id: z.string().describe("The ID of the note to delete"),
    }),
    outputSchema: z.object({
      notes: z.array(noteZod),
      connections: z.array(connectionZod),
      deleted: z.boolean(),
    }),
  },
  async ({ id }) => {
    const deleted = await removeNote(id);
    const connections = computeConnections(notes);
    return object({ notes: [...notes], connections, deleted });
  }
);

// ─── Tool: search-notes ───────────────────────────────────────────────────────

server.tool(
  {
    name: "search-notes",
    description: "Search notes by keyword or tag.",
    schema: z.object({
      query: z.string().describe("Search query — matches title, content, or tags"),
    }),
    outputSchema: z.object({
      results: z.array(noteZod),
      total: z.number(),
    }),
  },
  async ({ query }) => {
    // Refresh cache from Supabase before searching
    await loadAllNotes();

    const q = query.toLowerCase();
    const results = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q))
    );
    return object({ results, total: results.length });
  }
);

// ─── Tool: view-knowledge-graph ───────────────────────────────────────────────

server.tool(
  {
    name: "view-knowledge-graph",
    description:
      "Open the interactive knowledge graph widget. Shows all notes as nodes with auto-detected connections as edges.",
    schema: z.object({
      highlightNoteId: z
        .string()
        .optional()
        .describe("Optional note ID to highlight when the graph opens"),
    }),
    widget: {
      name: "knowledge-graph",
      invoking: "Loading knowledge graph...",
      invoked: "Knowledge graph ready",
    },
  },
  async ({ highlightNoteId }) => {
    // Always load the latest from Supabase before rendering the widget
    await loadAllNotes();
    const connections = computeConnections(notes);

    return widget({
      props: { notes: [...notes], connections, highlightNoteId },
      output: text(
        `Knowledge graph: ${notes.length} note(s), ${connections.length} connection(s).`
      ),
    });
  }
);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

server.listen().then(async () => {
  console.log("Knowledge Graph MCP server running");
  // Pre-load notes from Supabase so the first tool call is fast
  await loadAllNotes();
  console.log(`[store] ${notes.length} note(s) loaded`);
});
