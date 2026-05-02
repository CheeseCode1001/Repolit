import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';
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
  return raw
    .replace(/^```(?:mermaid)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
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
        const { svg } = await mermaid.render(id, cleaned);
        if (isMounted) {
          setSvgCode(svg);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to render diagram');
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
      <div className="flex flex-col gap-3 p-6 bg-destructive/10 border border-destructive/20 h-full">
        <p className="text-destructive font-mono text-sm">Failed to render architecture diagram</p>
        <pre className="text-xs text-destructive/70 bg-background/50 p-4 w-full overflow-auto max-h-[200px] font-mono">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div className="relative border border-border bg-card/50 overflow-hidden flex flex-col h-full">
      {/* Controls */}
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

      {/* Diagram area */}
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
