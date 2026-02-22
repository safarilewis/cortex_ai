import { z } from "zod";

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export const connectionSchema = z.object({
  source: z.string(),
  target: z.string(),
  strength: z.number(),
  reason: z.string(),
});

export const propSchema = z.object({
  notes: z.array(noteSchema),
  connections: z.array(connectionSchema),
  highlightNoteId: z.string().optional(),
});

export type Note = z.infer<typeof noteSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type KnowledgeGraphProps = z.infer<typeof propSchema>;

// Response type from add-note tool
export interface AddNoteResponse {
  note: Note;
  notes: Note[];
  connections: Connection[];
}

// Response type from delete-note tool
export interface DeleteNoteResponse {
  notes: Note[];
  connections: Connection[];
  deleted: boolean;
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#0ea5e9",
];

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export function tagColor(tag: string): string {
  return PALETTE[strHash(tag) % PALETTE.length];
}

export function noteColor(note: Note): string {
  return note.tags.length > 0
    ? tagColor(note.tags[0])
    : PALETTE[strHash(note.id) % PALETTE.length];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Client-side connection computation ──────────────────────────────────────
// Mirrors the server algorithm exactly so the widget can compute connections
// locally for instant optimistic updates.

const STOP_WORDS = new Set([
  "the","and","that","this","have","for","not","with","you","are",
  "from","they","will","your","what","about","which","when","there",
  "been","more","also","into","some","than","then","them","these",
  "its","our","out","can","all","was","but","has","had","his",
  "her","she","him","were","said","each","how","their","would",
]);

function extractKeywords(str: string): Set<string> {
  return new Set(
    str.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

export function computeConnectionsClient(allNotes: Note[]): Connection[] {
  const map = new Map<string, Connection>();

  for (let i = 0; i < allNotes.length; i++) {
    for (let j = i + 1; j < allNotes.length; j++) {
      const a = allNotes[i];
      const b = allNotes[j];
      const key = [a.id, b.id].sort().join("~");
      if (map.has(key)) continue;

      // 1. Shared tags (strongest signal)
      const sharedTags = a.tags.filter((t) => b.tags.includes(t));
      if (sharedTags.length > 0) {
        const union = new Set([...a.tags, ...b.tags]).size;
        map.set(key, {
          source: a.id,
          target: b.id,
          strength: Math.max(sharedTags.length / union, 0.4),
          reason: `Shared tags: ${sharedTags.map((t) => "#" + t).join(", ")}`,
        });
        continue;
      }

      // 2. Tag substring match (e.g. "ml" matches "machine-learning")
      const tagSubMatch = a.tags.find((at) =>
        b.tags.some((bt) => at.includes(bt) || bt.includes(at))
      );
      if (tagSubMatch) {
        map.set(key, {
          source: a.id,
          target: b.id,
          strength: 0.35,
          reason: `Related tags`,
        });
        continue;
      }

      // 3. Keyword overlap (title + content)
      const aWords = extractKeywords(a.title + " " + a.content);
      const bWords = extractKeywords(b.title + " " + b.content);
      const shared = [...aWords].filter((w) => bWords.has(w));

      if (shared.length >= 1) {
        const union = new Set([...aWords, ...bWords]).size || 1;
        const jaccard = shared.length / union;
        // Lower threshold: 0.03 Jaccard, or any title-word match
        const titleWords = extractKeywords(a.title);
        const titleMatch = shared.some((w) => titleWords.has(w) || extractKeywords(b.title).has(w));
        if (jaccard >= 0.03 || (titleMatch && shared.length >= 1)) {
          map.set(key, {
            source: a.id,
            target: b.id,
            strength: Math.min(jaccard * 6, 0.9),
            reason: `Related concepts: ${shared.slice(0, 3).join(", ")}`,
          });
        }
      }
    }
  }

  return [...map.values()];
}
