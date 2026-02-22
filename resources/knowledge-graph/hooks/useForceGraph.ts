import { useRef, useEffect, useState, useCallback } from "react";

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SimEdge {
  source: string;
  target: string;
  strength: number;
}

interface UseForceGraphOptions {
  nodeIds: string[];
  edges: SimEdge[];
  width: number;
  height: number;
}

interface UseForceGraphReturn {
  positions: Map<string, { x: number; y: number }>;
  pinNode: (id: string | null) => void;
  moveNode: (id: string, x: number, y: number) => void;
  restart: () => void;
}

const REPULSION = 4500;
const SPRING_LENGTH = 160;
const SPRING_K = 0.04;
const CENTER_GRAVITY = 0.015;
const DAMPING = 0.72;
const MAX_ALPHA = 300; // ticks at full heat

export function useForceGraph({
  nodeIds,
  edges,
  width,
  height,
}: UseForceGraphOptions): UseForceGraphReturn {
  const nodesRef = useRef<SimNode[]>([]);
  const pinnedRef = useRef<string | null>(null);
  const alphaRef = useRef(MAX_ALPHA);
  const rafRef = useRef<number | null>(null);

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );

  // Initialise or update nodes when the set changes
  useEffect(() => {
    if (width === 0 || height === 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = nodeIds.map((id, i) => {
      if (existing.has(id)) return existing.get(id)!;
      // Place new nodes around the centre on a small circle
      const angle = (i / Math.max(nodeIds.length, 1)) * 2 * Math.PI;
      const r = Math.min(width, height) * 0.25;
      return {
        id,
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      };
    });

    alphaRef.current = MAX_ALPHA; // reheat
  }, [nodeIds.join(","), width, height]);

  // Simulation loop
  useEffect(() => {
    if (width === 0 || height === 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const PAD = 48;

    const tick = () => {
      const sim = nodesRef.current;
      if (sim.length === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const alpha = alphaRef.current > 0 ? 1 : 0;

      if (alphaRef.current > 0) {
        // Repulsion between all pairs
        for (let i = 0; i < sim.length; i++) {
          for (let j = i + 1; j < sim.length; j++) {
            const a = sim[i];
            const b = sim[j];
            const dx = b.x - a.x || 0.01;
            const dy = b.y - a.y || 0.01;
            const dist2 = dx * dx + dy * dy;
            const dist = Math.sqrt(dist2) || 0.01;
            const force = REPULSION / dist2;
            const fx = (force * dx) / dist;
            const fy = (force * dy) / dist;
            if (a.id !== pinnedRef.current) { a.vx -= fx; a.vy -= fy; }
            if (b.id !== pinnedRef.current) { b.vx += fx; b.vy += fy; }
          }
        }

        // Spring attraction for edges
        for (const edge of edges) {
          const src = sim.find((n) => n.id === edge.source);
          const tgt = sim.find((n) => n.id === edge.target);
          if (!src || !tgt) continue;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const displacement = dist - SPRING_LENGTH;
          const spring = SPRING_K * displacement * edge.strength;
          const fx = (spring * dx) / dist;
          const fy = (spring * dy) / dist;
          if (src.id !== pinnedRef.current) { src.vx += fx; src.vy += fy; }
          if (tgt.id !== pinnedRef.current) { tgt.vx -= fx; tgt.vy -= fy; }
        }

        // Centre gravity
        for (const node of sim) {
          if (node.id === pinnedRef.current) continue;
          node.vx += (cx - node.x) * CENTER_GRAVITY;
          node.vy += (cy - node.y) * CENTER_GRAVITY;
        }

        // Integrate + damp + clamp
        for (const node of sim) {
          if (node.id === pinnedRef.current) continue;
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(PAD, Math.min(width - PAD, node.x));
          node.y = Math.max(PAD, Math.min(height - PAD, node.y));
        }

        alphaRef.current = Math.max(0, alphaRef.current - 1);
      }

      // Publish positions every frame so React can re-render
      const map = new Map<string, { x: number; y: number }>();
      for (const n of sim) map.set(n.id, { x: n.x, y: n.y });
      setPositions(map);

      rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [nodeIds.join(","), edges.map((e) => `${e.source}>${e.target}`).join(","), width, height]);

  const pinNode = useCallback((id: string | null) => {
    pinnedRef.current = id;
    if (id === null) alphaRef.current = 60; // small reheat on release
  }, []);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    node.x = x;
    node.y = y;
    node.vx = 0;
    node.vy = 0;
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(id, { x, y });
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    alphaRef.current = MAX_ALPHA;
  }, []);

  return { positions, pinNode, moveNode, restart };
}
