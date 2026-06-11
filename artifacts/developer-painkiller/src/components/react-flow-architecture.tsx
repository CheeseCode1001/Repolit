import { useMemo, useCallback } from "react";
import {
  ReactFlow,
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

// Colorful palette — works in both dark and light mode
const NODE_COLORS = [
  { bg: "#4ade80", border: "#22c55e", text: "#052e16" },
  { bg: "#60a5fa", border: "#3b82f6", text: "#172554" },
  { bg: "#f472b6", border: "#ec4899", text: "#500724" },
  { bg: "#fb923c", border: "#f97316", text: "#431407" },
  { bg: "#a78bfa", border: "#8b5cf6", text: "#2e1065" },
  { bg: "#34d399", border: "#10b981", text: "#022c22" },
  { bg: "#fbbf24", border: "#f59e0b", text: "#451a03" },
  { bg: "#f87171", border: "#ef4444", text: "#450a0a" },
  { bg: "#38bdf8", border: "#0ea5e9", text: "#082f49" },
  { bg: "#c084fc", border: "#a855f7", text: "#3b0764" },
];

function parseMermaidToFlow(mermaidCode: string): { nodes: Node[]; edges: Edge[] } {
  const lines = mermaidCode.split("\n").map(l => l.trim()).filter(Boolean);
  const nodeMap = new Map<string, string>();
  const edges: Edge[] = [];
  const edgeRegex = /^([A-Za-z0-9_]+)(\[.*?\])?\s*(-->|->|---)\s*\|?([^|]*?)\|?\s*([A-Za-z0-9_]+)(\[.*?\])?$/;
  const nodeDefRegex = /^([A-Za-z0-9_]+)\[(.*?)\]$/;

  for (const line of lines) {
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
        animated: true,
        style: { strokeWidth: 2, stroke: "#6ee7b7" },
        labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#fff" },
        labelBgStyle: { fill: "#1a1a2e", fillOpacity: 0.85 },
      });
      continue;
    }

    const nodeMatch = nodeDefRegex.exec(line);
    if (nodeMatch) {
      nodeMap.set(nodeMatch[1], nodeMatch[2]);
    }
  }

  const nodeIds = Array.from(nodeMap.keys());
  const cols = Math.max(3, Math.ceil(Math.sqrt(nodeIds.length)));
  const nodes: Node[] = nodeIds.map((id, i) => {
    const color = NODE_COLORS[i % NODE_COLORS.length];
    return {
      id,
      data: { label: nodeMap.get(id) ?? id },
      position: {
        x: (i % cols) * 200,
        y: Math.floor(i / cols) * 110,
      },
      style: {
        background: color.bg,
        color: color.text,
        border: `2px solid ${color.border}`,
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "monospace",
        fontWeight: 600,
        padding: "8px 14px",
        minWidth: 120,
        boxShadow: `0 2px 8px ${color.bg}55`,
      },
    };
  });

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
    <div className="h-[500px] sm:h-[600px] w-full border border-border/60 bg-background rounded-sm overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode={isDark ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color={isDark ? "#2a2a3a" : "#e2e8f0"}
        />
      </ReactFlow>
    </div>
  );
}
