import React, { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Code2,
  Network,
  Download,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "JetBrains Mono, monospace",
  darkMode: true,
  flowchart: { curve: "basis", padding: 20 },
});

// ── Mermaid source cleaner ───────────────────────────────────────────────────

function cleanChart(raw: string): string {
  let result = raw
    .replace(/^```(?:mermaid)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  result = result.replace(/<br\s*\/?>/gi, " ");

  result = result.replace(/\[([^\]]*)\]/g, (_match, inner) => {
    const sanitized = inner
      .replace(/[()]/g, "")
      .replace(/[<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `[${sanitized}]`;
  });

  return result;
}

// ── Transform state ─────────────────────────────────────────────────────────

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

// ── Component ────────────────────────────────────────────────────────────────

interface ArchitectureViewerProps {
  chart: string;
}

export function ArchitectureViewer({ chart }: ArchitectureViewerProps) {
  const cleaned = cleanChart(chart);

  const [svgCode, setSvgCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [view, setView] = useState<"diagram" | "code">("diagram");
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drag state kept in refs to avoid re-render lag during drag
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const transformAtDragStart = useRef<Transform>(DEFAULT_TRANSFORM);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Render mermaid ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);

    (async () => {
      if (!cleaned) {
        setIsLoading(false);
        return;
      }
      try {
        const id = `arch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, cleaned);
        if (alive) {
          setSvgCode(svg);
          setIsLoading(false);
          // Reset view when diagram changes
          setTransform(DEFAULT_TRANSFORM);
        }
      } catch (err: unknown) {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [chart]);

  // ── Keyboard shortcut: Escape to exit fullscreen ────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // ── Wheel zoom (centered on cursor) ─────────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (view !== "diagram") return;
      e.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      setTransform((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.min(5, Math.max(0.15, prev.scale * factor));

        // Keep the point under the cursor stationary
        const newX = cursorX - (cursorX - prev.x) * (newScale / prev.scale);
        const newY = cursorY - (cursorY - prev.y) * (newScale / prev.scale);

        return { x: newX, y: newY, scale: newScale };
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [view]);

  // ── Mouse drag to pan ───────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    transformAtDragStart.current = transform;
  }, [transform]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTransform({
      ...transformAtDragStart.current,
      x: transformAtDragStart.current.x + dx,
      y: transformAtDragStart.current.y + dy,
    });
  }, []);

  const endDrag = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Touch pan ───────────────────────────────────────────────────────────
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  };

  // ── Fit diagram to viewport ─────────────────────────────────────────────
  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      setTransform(DEFAULT_TRANSFORM);
      return;
    }
    const svgEl = content.querySelector("svg");
    if (!svgEl) {
      setTransform(DEFAULT_TRANSFORM);
      return;
    }

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const sw = svgEl.scrollWidth;
    const sh = svgEl.scrollHeight;

    if (sw === 0 || sh === 0) {
      setTransform(DEFAULT_TRANSFORM);
      return;
    }

    const scaleX = (vw * 0.9) / sw;
    const scaleY = (vh * 0.9) / sh;
    const scale = Math.min(scaleX, scaleY, 2);

    const x = (vw - sw * scale) / 2;
    const y = (vh - sh * scale) / 2;

    setTransform({ x, y, scale });
  }, []);

  // Fit on initial render when SVG is ready
  useEffect(() => {
    if (svgCode && view === "diagram") {
      requestAnimationFrame(() => fitToView());
    }
  }, [svgCode, view, fitToView]);

  // ── Download SVG ────────────────────────────────────────────────────────
  const downloadSvg = () => {
    if (!svgCode) return;
    const blob = new Blob([svgCode], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Controls ────────────────────────────────────────────────────────────
  const zoomIn = () =>
    setTransform((p) => ({ ...p, scale: Math.min(p.scale * 1.2, 5) }));
  const zoomOut = () =>
    setTransform((p) => ({ ...p, scale: Math.max(p.scale / 1.2, 0.15) }));
  const resetView = () => setTransform(DEFAULT_TRANSFORM);

  // ── Render ──────────────────────────────────────────────────────────────
  const outerCls = cn(
    "flex flex-col border border-border bg-card/50",
    isFullscreen
      ? "fixed inset-0 z-[100] bg-card"
      : "h-[480px] sm:h-[580px] md:h-[680px]"
  );

  return (
    <div className={outerCls}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-2 border-b border-border bg-muted/30 shrink-0 gap-2 flex-wrap">
        {/* View toggles */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setView("diagram")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors",
              view === "diagram"
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
            )}
          >
            <Network className="w-3 h-3" />
            <span className="hidden sm:inline">Diagram</span>
          </button>
          <button
            onClick={() => setView("code")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors",
              view === "code"
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
            )}
          >
            <Code2 className="w-3 h-3" />
            <span className="hidden sm:inline">Source</span>
          </button>
        </div>

        {/* Diagram controls */}
        {view === "diagram" && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-center tabular-nums">
              {Math.round(transform.scale * 100)}%
            </span>

            <div className="w-px h-4 bg-border mx-0.5" />

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={zoomOut}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={zoomIn}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={fitToView}
              title="Fit to screen"
            >
              <Move className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={resetView}
              title="Reset view"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>

            <div className="w-px h-4 bg-border mx-0.5" />

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={downloadSvg}
              title="Download SVG"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setIsFullscreen((s) => !s)}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* ── Hint bar ── */}
      {view === "diagram" && !isLoading && !error && svgCode && (
        <div className="px-3 py-1 text-[10px] font-mono text-muted-foreground/50 border-b border-border/30 bg-background/20 shrink-0 flex items-center gap-4">
          <span>Drag to pan</span>
          <span>Scroll to zoom</span>
          <span>Double-click to reset</span>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="flex-1 overflow-hidden relative">
        {view === "diagram" ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="w-64 h-4 opacity-30" />
                  <Skeleton className="w-48 h-4 opacity-20" />
                  <Skeleton className="w-56 h-4 opacity-25" />
                  <p className="text-[10px] font-mono text-muted-foreground/50 mt-2 animate-pulse">
                    Rendering diagram…
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col gap-3 p-6 overflow-auto">
                <p className="text-destructive font-mono text-sm">
                  Failed to render architecture diagram
                </p>
                <pre className="text-xs text-destructive/70 bg-background/50 p-4 w-full overflow-auto max-h-[200px] font-mono">
                  {error}
                </pre>
                <p className="text-[11px] text-muted-foreground font-mono mt-2">
                  Switch to &ldquo;Source&rdquo; view to inspect the raw diagram code.
                </p>
              </div>
            )}

            {!isLoading && !error && svgCode && (
              <div
                ref={viewportRef}
                className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={() => (lastTouch.current = null)}
                onDoubleClick={resetView}
              >
                <div
                  ref={contentRef}
                  style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: "0 0",
                    willChange: "transform",
                  }}
                  dangerouslySetInnerHTML={{ __html: svgCode }}
                />
              </div>
            )}
          </>
        ) : (
          /* ── Source / code view ── */
          <div className="h-full overflow-auto bg-black/40">
            <pre className="p-4 text-[11px] sm:text-xs font-mono text-green-400/80 leading-relaxed whitespace-pre-wrap break-words">
              {cleaned || "(No diagram source available)"}
            </pre>
          </div>
        )}
      </div>

      {/* ── Footer legend ── */}
      {!isLoading && !error && view === "diagram" && (
        <div className="px-3 py-1.5 border-t border-border/30 bg-background/20 shrink-0 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
            AI-generated architecture map
          </span>
        </div>
      )}
    </div>
  );
}
