import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";

type Props = {
  mermaidCode: string;
};

function parseMermaidToFlow(mermaidCode: string): { nodes: Node[]; edges: Edge[] } {
  const lines = mermaidCode.split("\n").map(l => l.trim()).filter(Boolean);
  const nodeMap = new Map<string, string>();
  const edges: Edge[] = [];
  const edgeRegex = /^([A-Za-z0-9_]+)(\[.*?\])?\s*(-->|->|---)\s*\|?([^|]*?)\|?\s*([A-Za-z0-9_]+)(\[.*?\])?$/;
  const nodeDefRegex = /^([A-Za-z0-9_]+)\[(.*?)\]$/;

  for (const line of lines) {
    // Skip header lines
    if (/^(graph|flowchart|sequenceDiagram)/i.test(line)) continue;

    const edgeMatch = edgeRegex.exec(line);
    if (edgeMatch) {
      const srcId = edgeMatch[1];
      const srcLabel = edgeMatch[2] ? edgeMatch[2].replace(/[\[\]]/g, "") : srcId.replace(/_/g, " ");
      const edgeLabel = edgeMatch[4]?.trim() || "";
      const tgtId = edgeMatch[5];
      const tgtLabel = edgeMatch[6] ? edgeMatch[6].replace(/[\[\]]/g, "") : tgtId.replace(/_/g, " ");

      if (!nodeMap.has(srcId)) nodeMap.set(srcId, srcLabel);
      if (!nodeMap.has(tgtId)) nodeMap.set(tgtId, tgtLabel);

      edges.push({
        id: `e-${srcId}-${tgtId}-${edges.length}`,
        source: srcId,
        target: tgtId,
        label: edgeLabel || undefined,
        style: { strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fontFamily: "monospace" },
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.8 },
      });
      continue;
    }

    const nodeMatch = nodeDefRegex.exec(line);
    if (nodeMatch) {
      nodeMap.set(nodeMatch[1], nodeMatch[2]);
    }
  }

  // Layout nodes in a grid
  const nodeIds = Array.from(nodeMap.keys());
  const cols = Math.ceil(Math.sqrt(nodeIds.length));
  const nodes: Node[] = nodeIds.map((id, i) => ({
    id,
    data: { label: nodeMap.get(id) ?? id },
    position: {
      x: (i % cols) * 180,
      y: Math.floor(i / cols) * 100,
    },
    style: {
      background: "var(--card)",
      color: "var(--foreground)",
      border: "1px solid var(--border)",
      borderRadius: 0,
      fontSize: 12,
      fontFamily: "monospace",
      padding: "8px 12px",
      minWidth: 120,
    },
  }));

  return { nodes, edges };
}

export function ReactFlowArchitecture({ mermaidCode }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => parseMermaidToFlow(mermaidCode),
    [mermaidCode]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback(() => {}, []);

  if (nodes.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-border/50 text-muted-foreground font-mono text-sm">
        No nodes parsed from diagram.
      </div>
    );
  }

  return (
    <div className="h-[500px] sm:h-[600px] w-full border border-border/60 bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        colorMode={isDark ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 0,
          }}
        />
        <MiniMap
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDark ? "#333" : "#ddd"}
        />
      </ReactFlow>
    </div>
  );
}
