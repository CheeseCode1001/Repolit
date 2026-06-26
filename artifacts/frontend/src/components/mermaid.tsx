import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'JetBrains Mono, monospace',
  darkMode: true,
});

function cleanChart(raw: string): string {
  let result = raw
    .replace(/^```(?:mermaid)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  result = result.replace(/<br\s*\/?>/gi, ' ');

  result = result.replace(/\[([^\]]*)\]/g, (_match, inner) => {
    const sanitized = inner
      .replace(/[()]/g, '')
      .replace(/[<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `[${sanitized}]`;
  });

  result = result.replace(/["'`]/g, (c) => {
    if (c === '"') return "'";
    return c;
  });

  return result;
}

interface MermaidProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidProps) {
  const [svgCode, setSvgCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      const cleaned = cleanChart(chart);
      if (!cleaned) return;

      setIsLoading(true);
      setError(null);

      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        document.querySelectorAll(`[id^="mermaid-"]`).forEach((el) => {
          if (el.parentElement === document.body) el.remove();
        });

        const { svg } = await mermaid.render(id, cleaned);

        document.querySelectorAll(`[id^="mermaid-"]`).forEach((el) => {
          if (el.parentElement === document.body) el.remove();
        });

        if (isMounted) {
          setSvgCode(svg);
          setIsLoading(false);
        }
      } catch (err: any) {
        document.querySelectorAll(`[id^="mermaid-"]`).forEach((el) => {
          if (el.parentElement === document.body) el.remove();
        });

        if (isMounted) {
          const msg = err.message || 'Failed to render diagram';
          const cleanMsg = msg.replace(/mermaid version [\d.]+/gi, '').trim();
          setError(cleanMsg || 'Diagram syntax error');
          setIsLoading(false);
        }
      }
    };

    renderChart();
    return () => { isMounted = false; };
  }, [chart]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.3));
  const handleReset = () => setScale(1);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 h-full min-h-[300px] bg-muted/10 border border-border/40">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertTriangle className="w-5 h-5 text-yellow-500/70" />
          <span className="font-mono text-sm font-medium">Diagram could not be rendered</span>
        </div>
        <p className="text-xs font-mono text-muted-foreground/60 max-w-md text-center">
          The AI generated a diagram with syntax issues. The analysis data is still available in the other tabs.
        </p>
        <details className="w-full max-w-md">
          <summary className="text-[10px] font-mono text-muted-foreground/40 cursor-pointer hover:text-muted-foreground/60 text-center">
            show error details
          </summary>
          <pre className="mt-2 text-[10px] text-muted-foreground/50 bg-background/50 p-3 overflow-auto max-h-[120px] font-mono border border-border/20">
            {error}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="relative border border-border bg-card/50 overflow-hidden flex flex-col h-full">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-background/90 backdrop-blur p-1 border border-border shadow">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] font-mono w-10 text-center text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleReset}>
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex items-center justify-center min-h-[300px]">
        {isLoading ? (
          <Skeleton className="w-[70%] h-[300px] opacity-20" />
        ) : (
          <div
            className="transition-transform duration-200 ease-out origin-center"
            style={{ transform: `scale(${scale})` }}
            dangerouslySetInnerHTML={{ __html: svgCode }}
          />
        )}
      </div>
    </div>
  );
}
