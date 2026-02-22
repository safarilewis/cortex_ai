import React, { useRef, useState, useEffect, useCallback } from "react";
import type { Note, Connection } from "../types";
import { noteColor } from "../types";
import { useForceGraph } from "../hooks/useForceGraph";

interface GraphViewProps {
  notes: Note[];
  connections: Connection[];
  selectedNoteId: string | null;
  highlightNoteId?: string;
  onSelectNote: (id: string) => void;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export const GraphView: React.FC<GraphViewProps> = ({
  notes,
  connections,
  selectedNoteId,
  highlightNoteId,
  onSelectNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 600, height: 420 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [panStart, setPanStart] = useState<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);

  // Watch for newly highlighted note to trigger glow animation
  useEffect(() => {
    if (highlightNoteId) {
      setNewNoteId(highlightNoteId);
      const t = setTimeout(() => setNewNoteId(null), 5000);
      return () => clearTimeout(t);
    }
  }, [highlightNoteId]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const simEdges = connections.map((c) => ({
    source: c.source,
    target: c.target,
    strength: c.strength,
  }));

  const { positions, pinNode, moveNode, restart } = useForceGraph({
    nodeIds: notes.map((n) => n.id),
    edges: simEdges,
    width: size.width,
    height: size.height,
  });

  // Reheat when notes change
  useEffect(() => {
    restart();
  }, [notes.length, restart]);

  // Convert client coords → SVG space
  const toSVG = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - transform.x) / transform.scale,
        y: (clientY - rect.top - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // Wheel zoom centred on cursor
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const delta = e.deltaY < 0 ? 1.1 : 0.91;
      setTransform((t) => {
        const newScale = Math.max(0.25, Math.min(4, t.scale * delta));
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        return {
          scale: newScale,
          x: mx - ((mx - t.x) * newScale) / t.scale,
          y: my - ((my - t.y) * newScale) / t.scale,
        };
      });
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pointer events on SVG background (pan) vs node (drag)
  const handleSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if ((e.target as SVGElement).closest(".kg-node")) return; // handled by node
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanStart({ px: e.clientX, py: e.clientY, ox: transform.x, oy: transform.y });
    },
    [transform]
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (draggingNode) {
        const pos = toSVG(e.clientX, e.clientY);
        moveNode(draggingNode, pos.x, pos.y);
        return;
      }
      if (panStart) {
        setTransform((t) => ({
          ...t,
          x: panStart.ox + e.clientX - panStart.px,
          y: panStart.oy + e.clientY - panStart.py,
        }));
      }
    },
    [draggingNode, panStart, toSVG, moveNode]
  );

  const handleSvgPointerUp = useCallback(() => {
    if (draggingNode) {
      pinNode(null);
      setDraggingNode(null);
    }
    setPanStart(null);
  }, [draggingNode, pinNode]);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, noteId: string) => {
      e.stopPropagation();
      svgRef.current?.setPointerCapture(e.pointerId);
      pinNode(noteId);
      setDraggingNode(noteId);
    },
    [pinNode]
  );

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, noteId: string) => {
      e.stopPropagation();
      onSelectNote(noteId);
    },
    [onSelectNote]
  );

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  // Neighbour highlight: IDs directly connected to hovered node
  const neighbourIds = hoveredId
    ? new Set(
        connections
          .filter((c) => c.source === hoveredId || c.target === hoveredId)
          .flatMap((c) => [c.source, c.target])
      )
    : null;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {/* Dot-grid background */}
      <div className="kg-graph-bg" />

      <svg
        ref={svgRef}
        className="kg-graph-svg"
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerLeave={handleSvgPointerUp}
        style={{ cursor: panStart ? "grabbing" : draggingNode ? "grabbing" : "grab", touchAction: "none" }}
      >
        <defs>
          <filter id="kg-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="kg-glow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {connections.map((conn) => {
            const sp = positions.get(conn.source);
            const tp = positions.get(conn.target);
            if (!sp || !tp) return null;

            const isActive =
              hoveredId === conn.source || hoveredId === conn.target ||
              selectedNoteId === conn.source || selectedNoteId === conn.target;

            const mx = (sp.x + tp.x) / 2;
            const my = (sp.y + tp.y) / 2;

            return (
              <g key={`e-${conn.source}-${conn.target}`}>
                <line
                  x1={sp.x}
                  y1={sp.y}
                  x2={tp.x}
                  y2={tp.y}
                  stroke={isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isActive ? conn.strength * 2.5 + 1 : conn.strength * 1.5 + 0.5}
                  strokeDasharray={isActive ? undefined : "5 5"}
                  style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                />
                {/* Relation label on active edges */}
                {isActive && (
                  <text
                    x={mx}
                    y={my - 5}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize={9}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {conn.reason.length > 30 ? conn.reason.slice(0, 28) + "…" : conn.reason}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {notes.map((note) => {
            const pos = positions.get(note.id);
            if (!pos) return null;

            const color = noteColor(note);
            const isSelected = selectedNoteId === note.id;
            const isHovered = hoveredId === note.id;
            const isNew = newNoteId === note.id;
            const isDimmed = hoveredId !== null && !neighbourIds?.has(note.id) && hoveredId !== note.id;

            const r = isSelected ? 26 : 20;
            const labelText =
              note.title.length > 16 ? note.title.slice(0, 15) + "…" : note.title;

            return (
              <g
                key={note.id}
                className={`kg-node${isNew ? " kg-node-new" : ""}`}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: draggingNode === note.id ? "grabbing" : "pointer", opacity: isDimmed ? 0.25 : 1, transition: "opacity 0.2s" }}
                onPointerDown={(e) => handleNodePointerDown(e, note.id)}
                onClick={(e) => handleNodeClick(e, note.id)}
                onPointerEnter={() => setHoveredId(note.id)}
                onPointerLeave={() => setHoveredId(null)}
              >
                {/* Outer glow for selected/new */}
                {(isSelected || isNew) && (
                  <circle
                    className={isNew ? "glow-ring" : ""}
                    r={r + 10}
                    fill={color}
                    opacity={isNew ? 0.25 : 0.15}
                    style={isNew ? { animation: "nodeGlow 1.4s ease-in-out 3" } : undefined}
                  />
                )}

                {/* Main circle */}
                <circle
                  r={r}
                  fill={color}
                  opacity={isHovered || isSelected ? 1 : 0.82}
                  stroke={isSelected ? "#fff" : isHovered ? color : "rgba(255,255,255,0.15)"}
                  strokeWidth={isSelected ? 2.5 : 1}
                  filter={isSelected || isHovered || isNew ? "url(#kg-glow-sm)" : undefined}
                  style={{ transition: "r 0.15s, opacity 0.15s" }}
                />

                {/* Initials inside circle */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.9)"
                  fontSize={isSelected ? 13 : 10}
                  fontWeight={700}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {note.title.slice(0, 2).toUpperCase()}
                </text>

                {/* Label below */}
                <text
                  y={r + 13}
                  textAnchor="middle"
                  fill={isSelected || isHovered ? "#fff" : "rgba(255,255,255,0.65)"}
                  fontSize={10}
                  fontWeight={isSelected ? 600 : 400}
                  style={{ pointerEvents: "none", userSelect: "none", transition: "fill 0.15s" }}
                >
                  {labelText}
                </text>

                {/* Tag dots */}
                {note.tags.slice(0, 3).map((tag, i) => (
                  <circle
                    key={tag}
                    cx={r - 4 + i * 7}
                    cy={-r + 4}
                    r={3}
                    fill={color}
                    opacity={0.9}
                    stroke="rgba(13,17,23,0.8)"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="kg-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <circle cx="4" cy="6" r="2" />
            <circle cx="20" cy="6" r="2" />
            <circle cx="4" cy="18" r="2" />
            <circle cx="20" cy="18" r="2" />
            <line x1="12" y1="9" x2="5" y2="7" />
            <line x1="12" y1="9" x2="19" y2="7" />
            <line x1="12" y1="15" x2="5" y2="17" />
            <line x1="12" y1="15" x2="19" y2="17" />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Your knowledge graph is empty
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            Add a note to get started
          </p>
        </div>
      )}

      {/* Zoom controls */}
      <div className="kg-zoom-controls">
        <button
          className="kg-zoom-btn"
          title="Zoom in"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(4, t.scale * 1.25) }))}
        >
          +
        </button>
        <button
          className="kg-zoom-btn"
          title="Zoom out"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.25, t.scale * 0.8) }))}
        >
          −
        </button>
        <button
          className="kg-zoom-btn"
          title="Reset view"
          style={{ fontSize: 12 }}
          onClick={resetView}
        >
          ⊡
        </button>
      </div>

      {/* Node count badge */}
      {notes.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            pointerEvents: "none",
          }}
        >
          {notes.length} note{notes.length !== 1 ? "s" : ""} · {connections.length} connection{connections.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
};
