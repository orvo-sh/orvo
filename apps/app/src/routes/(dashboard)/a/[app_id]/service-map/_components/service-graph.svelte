<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { IconArrowDownRight } from "@tabler/icons-svelte";
  import { scaleLinear } from "d3-scale";
  import {
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
    forceX,
    forceY,
  } from "d3-force";
  import { onMount } from "svelte";

  type ServiceNode = {
    name: string;
    total: number;
    errors: number;
    errorRate: number;
    p95LatencyMs: number;
  };

  type ServiceEdge = {
    source: string;
    target: string;
    total: number;
    errors: number;
    errorRate: number;
  };

  type GraphData = {
    nodes: ServiceNode[];
    edges: ServiceEdge[];
    startAtUtc: string;
    endAtUtc: string;
  };

  let { graph }: { graph: GraphData } = $props();

  let svgRef = $state<SVGSVGElement | null>(null);
  let containerRef = $state<HTMLDivElement | null>(null);
  let width = $state(800);
  let height = $state(600);
  let selectedNode = $state<string | null>(null);
  let hoveredEdge = $state<string | null>(null);
  let hoveredNode = $state<string | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let isDragging = $state(false);
  let dragNode = $state<string | null>(null);

  const nodeMap = $derived(
    new Map(graph.nodes.map((n, i) => [n.name, { ...n, index: i }])),
  );

  const links = $derived(
    graph.edges.map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
      id: `${e.source}->${e.target}`,
    })),
  );

  const simNodes = $derived(
    graph.nodes.map((n) => ({
      id: n.name,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      fx: undefined as number | undefined,
      fy: undefined as number | undefined,
    })),
  );

  let renderedNodes = $state<
    Array<{
      id: string;
      x: number;
      y: number;
      total: number;
      errors: number;
      errorRate: number;
      p95LatencyMs: number;
    }>
  >([]);
  let renderedLinks = $state<
    Array<{
      id: string;
      source: { x: number; y: number };
      target: { x: number; y: number };
      total: number;
      errors: number;
      errorRate: number;
    }>
  >([]);

  let simulation = $state<ReturnType<typeof forceSimulation> | null>(null);

  const maxTotal = $derived(Math.max(...graph.nodes.map((n) => n.total), 1));
  const maxEdgeTotal = $derived(
    Math.max(...graph.edges.map((e) => e.total), 1),
  );

  const radiusScale = $derived(
    scaleLinear().domain([0, maxTotal]).range([24, 56]).clamp(true),
  );
  const strokeWidthScale = $derived(
    scaleLinear().domain([0, maxEdgeTotal]).range([1, 6]).clamp(true),
  );

  type RenderedNode = {
    id: string;
    x: number;
    y: number;
    total: number;
    errors: number;
    errorRate: number;
    p95LatencyMs: number;
  };

  type RenderedLink = {
    id: string;
    source: { x: number; y: number };
    target: { x: number; y: number };
    total: number;
    errors: number;
    errorRate: number;
  };

  function nodeRadius(node: { total: number }) {
    return radiusScale(node.total);
  }

  function edgeStrokeWidth(edge: { total: number }) {
    return strokeWidthScale(edge.total);
  }

  function nodeColor(node: { errorRate: number }) {
    if (node.errorRate > 0.05) return "hsl(var(--destructive))";
    if (node.errorRate > 0.01) return "hsl(var(--warning))";
    return "hsl(var(--primary))";
  }

  function edgeColor(edge: { errorRate: number }) {
    if (edge.errorRate > 0.05) return "hsl(var(--destructive) / 0.6)";
    if (edge.errorRate > 0.01) return "hsl(var(--warning) / 0.5)";
    return "hsl(var(--muted-foreground) / 0.35)";
  }

  function updateSize() {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }

  onMount(() => {
    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    if (containerRef) ro.observe(containerRef);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (width === 0 || height === 0 || simNodes.length === 0) return;

    const sim = forceSimulation(simNodes as any)
      .force(
        "link",
        forceLink(links as any)
          .id((d: any) => d.id)
          .distance(180)
          .strength(0.6),
      )
      .force("charge", forceManyBody().strength(-400))
      .force(
        "collide",
        forceCollide().radius(
          (d: any) => radiusScale(nodeMap.get(d.id)!.total) + 8,
        ),
      )
      .force("x", forceX(width / 2).strength(0.05))
      .force("y", forceY(height / 2).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    sim.on("tick", () => {
      renderedNodes = simNodes.map((n) => {
        const data = nodeMap.get(n.id);
        return {
          id: n.id,
          x: n.x!,
          y: n.y!,
          total: data?.total ?? 0,
          errors: data?.errors ?? 0,
          errorRate: data?.errorRate ?? 0,
          p95LatencyMs: data?.p95LatencyMs ?? 0,
        };
      });
      renderedLinks = links.map((l) => {
        const s = simNodes.find((n) => n.id === l.source);
        const t = simNodes.find((n) => n.id === l.target);
        return {
          id: l.id,
          source: { x: s?.x ?? 0, y: s?.y ?? 0 },
          target: { x: t?.x ?? 0, y: t?.y ?? 0 },
          total: l.total,
          errors: l.errors,
          errorRate: l.errorRate,
        };
      });
    });

    simulation = sim;

    return () => {
      sim.stop();
    };
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.min(Math.max(transform.k * scaleFactor, 0.2), 4);
    const rect = svgRef!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    transform = {
      x: mouseX - (mouseX - transform.x) * (newK / transform.k),
      y: mouseY - (mouseY - transform.y) * (newK / transform.k),
      k: newK,
    };
  }

  let panStart = { x: 0, y: 0 };
  let panTransformStart = { x: 0, y: 0 };

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as SVGElement;
    if (target.closest("[data-node]")) return;
    panStart = { x: e.clientX, y: e.clientY };
    panTransformStart = { ...transform };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    transform = {
      ...transform,
      x: panTransformStart.x + dx,
      y: panTransformStart.y + dy,
    };
  }

  function handleMouseUp() {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  function handleNodeMouseDown(e: MouseEvent, nodeId: string) {
    e.stopPropagation();
    isDragging = true;
    dragNode = nodeId;
    const simNode = simNodes.find((n) => n.id === nodeId);
    if (simNode && simulation) {
      simNode.fx = simNode.x;
      simNode.fy = simNode.y;
    }
    window.addEventListener("mousemove", handleNodeDrag);
    window.addEventListener("mouseup", handleNodeDragEnd);
  }

  function handleNodeDrag(e: MouseEvent) {
    if (!isDragging || !dragNode || !svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.k;
    const y = (e.clientY - rect.top - transform.y) / transform.k;
    const simNode = simNodes.find((n) => n.id === dragNode);
    if (simNode && simulation) {
      simNode.fx = x;
      simNode.fy = y;
      simulation.alpha(0.3).restart();
    }
  }

  function handleNodeDragEnd() {
    if (dragNode && simulation) {
      const simNode = simNodes.find((n) => n.id === dragNode);
      if (simNode) {
        simNode.fx = undefined;
        simNode.fy = undefined;
      }
    }
    isDragging = false;
    dragNode = null;
    window.removeEventListener("mousemove", handleNodeDrag);
    window.removeEventListener("mouseup", handleNodeDragEnd);
  }

  function nodeConnections(nodeId: string) {
    const outgoing = graph.edges.filter((e) => e.source === nodeId);
    const incoming = graph.edges.filter((e) => e.target === nodeId);
    return { outgoing, incoming };
  }

  const selectedData = $derived(
    selectedNode ? (nodeMap.get(selectedNode) ?? null) : null,
  );

  const selectedConnections = $derived(
    selectedNode
      ? nodeConnections(selectedNode)
      : { outgoing: [] as ServiceEdge[], incoming: [] as ServiceEdge[] },
  );

  function formatNumber(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  }

  function handleResetZoom() {
    transform = { x: 0, y: 0, k: 1 };
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span class="inline-block size-2 rounded-full bg-primary"></span>
        Healthy
        <span class="bg-warning inline-block size-2 rounded-full"></span>
        Warning
        <span class="inline-block size-2 rounded-full bg-destructive"></span>
        Critical
      </div>
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" onclick={handleResetZoom}>
        Reset zoom
      </Button>
    </div>
  </div>

  <div
    bind:this={containerRef}
    class="relative min-h-0 flex-1 rounded-xl border bg-background"
  >
    <svg
      bind:this={svgRef}
      class="h-full w-full cursor-grab active:cursor-grabbing"
      onmousedown={handleMouseDown}
      onwheel={handleWheel}
    >
      <g
        transform="translate({transform.x},{transform.y}) scale({transform.k})"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--muted-foreground) / 0.35)"
            />
          </marker>
          <marker
            id="arrowhead-warning"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--warning) / 0.5)"
            />
          </marker>
          <marker
            id="arrowhead-destructive"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--destructive) / 0.6)"
            />
          </marker>
        </defs>

        {#each renderedLinks as link (link.id)}
          {@const isHighlighted =
            selectedNode != null &&
            (link.id.startsWith(`${selectedNode}->`) ||
              link.id.endsWith(`->${selectedNode}`))}
          {@const isHovered = hoveredEdge === link.id}
          <g
            class="transition-opacity"
            opacity={selectedNode != null && !isHighlighted ? 0.15 : 1}
          >
            <line
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              stroke={edgeColor(link)}
              stroke-width={edgeStrokeWidth(link)}
              marker-end={link.errorRate > 0.05
                ? "url(#arrowhead-destructive)"
                : link.errorRate > 0.01
                  ? "url(#arrowhead-warning)"
                  : "url(#arrowhead)"}
              class="pointer-events-none"
            />
            <!-- Invisible wider line for hover detection -->
            <line
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              stroke="transparent"
              stroke-width={Math.max(12, edgeStrokeWidth(link) + 8)}
              class="cursor-pointer"
              onmouseenter={() => (hoveredEdge = link.id)}
              onmouseleave={() => (hoveredEdge = null)}
            />
          </g>
        {/each}

        {#each renderedNodes as node (node.id)}
          {@const isSelected = selectedNode === node.id}
          {@const isHovered = hoveredNode === node.id}
          {@const radius = nodeRadius(node)}
          {@const dimmed =
            selectedNode != null &&
            selectedNode !== node.id &&
            !selectedConnections.outgoing.some((e) => e.target === node.id) &&
            !selectedConnections.incoming.some((e) => e.source === node.id)}
          <g
            transform="translate({node.x},{node.y})"
            class="cursor-pointer transition-opacity"
            opacity={dimmed ? 0.25 : 1}
            data-node={node.id}
            onmousedown={(e) => handleNodeMouseDown(e, node.id)}
            onmouseenter={() => (hoveredNode = node.id)}
            onmouseleave={() => (hoveredNode = null)}
            onclick={() => {
              selectedNode = isSelected ? null : node.id;
            }}
          >
            <circle
              r={radius}
              fill="hsl(var(--background))"
              stroke={nodeColor(node)}
              stroke-width={isSelected ? 3 : 2}
            />
            <circle r={radius - 4} fill={nodeColor(node)} opacity={0.1} />
            <text
              y={0}
              text-anchor="middle"
              dominant-baseline="central"
              class="pointer-events-none fill-foreground text-[10px] font-medium select-none"
            >
              {node.id.slice(0, 12)}{node.id.length > 12 ? "…" : ""}
            </text>
            <text
              y={radius + 14}
              text-anchor="middle"
              class="pointer-events-none fill-muted-foreground text-[9px] select-none"
            >
              {formatNumber(node.total)} calls
            </text>
          </g>
        {/each}
      </g>
    </svg>

    {#if hoveredEdge}
      {@const edge = graph.edges.find(
        (e) => `${e.source}->${e.target}` === hoveredEdge,
      )}
      {#if edge}
        <div
          class="absolute bottom-3 left-3 rounded-lg border bg-popover px-3 py-2 shadow-md"
        >
          <p class="text-xs font-medium">
            {edge.source}
            <IconArrowDownRight class="inline size-3 text-muted-foreground" />
            {edge.target}
          </p>
          <p class="text-xs text-muted-foreground">
            {formatNumber(edge.total)} calls · {(edge.errorRate * 100).toFixed(
              1,
            )}% errors
          </p>
        </div>
      {/if}
    {/if}
  </div>

  {#if selectedNode && selectedData}
    <div class="shrink-0 rounded-xl border bg-background p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span
            class="size-3 rounded-full"
            style="background-color: {nodeColor(selectedData)}"
          ></span>
          <div>
            <p class="text-sm font-medium">{selectedNode}</p>
            <p class="text-xs text-muted-foreground">
              {formatNumber(selectedData.total)} calls · {(
                selectedData.errorRate * 100
              ).toFixed(1)}% errors · P95 {selectedData.p95LatencyMs > 0
                ? `${Math.round(selectedData.p95LatencyMs)}ms`
                : "—"}
            </p>
          </div>
        </div>
        <button
          class="rounded-md p-1 text-muted-foreground hover:text-foreground"
          onclick={() => (selectedNode = null)}
        >
          ✕
        </button>
      </div>

      {#if selectedConnections.outgoing.length > 0 || selectedConnections.incoming.length > 0}
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          {#if selectedConnections.outgoing.length > 0}
            <div>
              <p class="mb-1 text-xs font-medium text-muted-foreground">
                Calls out
              </p>
              <div class="space-y-1">
                {#each selectedConnections.outgoing as edge}
                  <div class="flex items-center justify-between text-xs">
                    <span class="truncate">{edge.target}</span>
                    <span class="text-muted-foreground tabular-nums"
                      >{formatNumber(edge.total)}</span
                    >
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if selectedConnections.incoming.length > 0}
            <div>
              <p class="mb-1 text-xs font-medium text-muted-foreground">
                Calls in
              </p>
              <div class="space-y-1">
                {#each selectedConnections.incoming as edge}
                  <div class="flex items-center justify-between text-xs">
                    <span class="truncate">{edge.source}</span>
                    <span class="text-muted-foreground tabular-nums"
                      >{formatNumber(edge.total)}</span
                    >
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
