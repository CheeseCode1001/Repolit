import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Maximize2, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'monospace',
});

interface MermaidProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgCode, setSvgCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!chart || !containerRef.current) return;
      setIsLoading(true);
      setError(null);
      
      try {
        const id = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;
        const { svg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvgCode(svg);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Mermaid rendering failed', err);
        if (isMounted) {
          setError(err.message || 'Failed to render diagram');
          setIsLoading(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleReset = () => setScale(1);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-destructive font-mono text-sm mb-2">Failed to render architecture diagram</p>
        <pre className="text-xs text-destructive/80 bg-background/50 p-4 rounded w-full overflow-auto max-h-[200px]">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div className="relative border border-border rounded-md bg-card/50 overflow-hidden flex flex-col h-full min-h-[500px]">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur p-1 rounded-md border border-border shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono w-12 text-center text-muted-foreground">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleReset}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto cursor-move p-8 relative flex items-center justify-center min-h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-card to-background">
        {isLoading ? (
          <Skeleton className="w-[80%] h-[400px] opacity-20" />
        ) : (
          <div 
            ref={containerRef}
            className="transition-transform duration-200 ease-out origin-center"
            style={{ transform: `scale(${scale})` }}
            dangerouslySetInnerHTML={{ __html: svgCode }} 
          />
        )}
      </div>
    </div>
  );
}
