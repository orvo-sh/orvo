<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { Badge } from "@repo/components/ui/badge";
  import { formatNumber } from "@repo/utils";
  import {
    IconArrowDownRight,
    IconExternalLink,
    IconTopologyStar3,
    IconX,
  } from "@tabler/icons-svelte";
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

  type SimNode = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number;
    fy?: number;
  };

  type RenderedNode = {
    id: string;
    x: number;
    y: number;
    total: number;
    errors: number;
    errorRate: number;
    p95LatencyMs: number;
    width: number;
    height: number;
  };

  type RenderedLink = {
    id: string;
    source: { x: number; y: number };
    target: { x: number; y: number };
    total: number;
    errors: number;
    errorRate: number;
  };

  let {
    graph,
    appId,
    timePreset,
    selectedService = "",
  }: {
    graph: GraphData;
    appId: string;
    timePreset: string;
    selectedService?: string;
  } = $props();

  let svgRef = $state<SVGSVGElement | null>(null);
  let containerRef = $state<HTMLDivElement | null>(null);
  let width = $state(800);
  let height = $state(640);
  let hoveredEdge = $state<string | null>(null);
  let hoveredNode = $state<string | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });
  let isDragging = $state(false);
  let dragNode = $state<string | null>(null);
  let panStart = $state({ x: 0, y: 0 });
  let panTransformStart = $state({ x: 0, y: 0 });

  const getInitialSelectedService = () => {
    return graph.nodes.some((node) => node.name === selectedService)
      ? selectedService
      : null;
  };

  let selectedNode = $state<string | null>(getInitialSelectedService());

  const nodeMap = $derived(
    new Map(graph.nodes.map((node) => [node.name, node])),
  );

  const links = $derived(
    graph.edges.map((edge) => ({
      ...edge,
      id: `${edge.source}->${edge.target}`,
    })),
  );

  const maxTotal = $derived(
    Math.max(...graph.nodes.map((node) => node.total), 1),
  );
  const maxEdgeTotal = $derived(
    Math.max(...graph.edges.map((edge) => edge.total), 1),
  );
  const cardWidthScale = $derived(
    scaleLinear().domain([0, maxTotal]).range([168, 220]).clamp(true),
  );
  const strokeWidthScale = $derived(
    scaleLinear().domain([0, maxEdgeTotal]).range([1.25, 5]).clamp(true),
  );

  const simNodes = $derived(
    graph.nodes.map((node) => ({
      id: node.name,
      x: width / 2 + (Math.random() - 0.5) * 180,
      y: height / 2 + (Math.random() - 0.5) * 180,
      vx: 0,
      vy: 0,
      fx: undefined as number | undefined,
      fy: undefined as number | undefined,
    })),
  );

  let renderedNodes = $state<RenderedNode[]>([]);
  let renderedLinks = $state<RenderedLink[]>([]);
  let simulation = $state<ReturnType<typeof forceSimulation> | null>(null);

  const selectedData = $derived(
    selectedNode ? (nodeMap.get(selectedNode) ?? null) : null,
  );

  const selectedConnections = $derived.by(() => {
    if (!selectedNode) {
      return {
        outgoing: [] as ServiceEdge[],
        incoming: [] as ServiceEdge[],
      };
    }

    return {
      outgoing: graph.edges
        .filter((edge) => edge.source === selectedNode)
        .sort((left, right) => right.total - left.total),
      incoming: graph.edges
        .filter((edge) => edge.target === selectedNode)
        .sort((left, right) => right.total - left.total),
    };
  });

  const totalRequests = $derived(
    graph.nodes.reduce((sum, node) => sum + node.total, 0),
  );

  const formatLatency = (value: number) => {
    if (value <= 0) {
      return "—";
    }

    return `${Math.round(value)} ms`;
  };

  const statusLabel = (errorRate: number, errors: number) => {
    if (errorRate >= 0.05 || errors >= 100) {
      return "Critical";
    }

    if (errorRate >= 0.01 || errors > 0) {
      return "Warning";
    }

    return "Healthy";
  };

  const statusTone = (errorRate: number, errors: number) => {
    if (errorRate >= 0.05 || errors >= 100) {
      return {
        color: "var(--color-destructive)",
        badge: "bg-destructive/10 text-destructive",
        edgeMarker: "url(#arrowhead-destructive)",
      };
    }

    if (errorRate >= 0.01 || errors > 0) {
      return {
        color: "#d97706",
        badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        edgeMarker: "url(#arrowhead-warning)",
      };
    }

    return {
      color: "var(--color-primary)",
      badge: "bg-primary/10 text-primary",
      edgeMarker: "url(#arrowhead-default)",
    };
  };

  const nodeWidth = (node: { total: number }) => {
    return cardWidthScale(node.total);
  };

  const nodeHeight = () => 86;

  const edgeStrokeWidth = (edge: { total: number }) => {
    return strokeWidthScale(edge.total);
  };

  const graphWindowLabel = $derived.by(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return `${formatter.format(new Date(graph.startAtUtc))} - ${formatter.format(new Date(graph.endAtUtc))}`;
  });

  const logsHref = $derived(
    selectedNode
      ? `/a/${appId}/logs?preset=${encodeURIComponent(timePreset)}&service=${encodeURIComponent(selectedNode)}`
      : null,
  );

  const syncSelectedNodeToUrl = (serviceName: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (serviceName) {
      url.searchParams.set("service", serviceName);
    } else {
      url.searchParams.delete("service");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const setSelectedNode = (serviceName: string | null) => {
    selectedNode = serviceName;
    syncSelectedNodeToUrl(serviceName);
  };

  const truncateServiceName = (value: string) => {
    if (value.length <= 22) {
      return value;
    }

    return `${value.slice(0, 20)}…`;
  };

  const updateSize = () => {
    if (!containerRef) {
      return;
    }

    const rect = containerRef.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  };

  onMount(() => {
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    if (containerRef) {
      observer.observe(containerRef);
    }

    return () => observer.disconnect();
  });

  $effect(() => {
    if (width === 0 || height === 0 || simNodes.length === 0) {
      return;
    }

    const sim = forceSimulation(simNodes as SimNode[])
      .force(
        "link",
        forceLink(links as Array<{ source: string; target: string }>)
          .id((datum: { id: string }) => datum.id)
          .distance(190)
          .strength(0.55),
      )
      .force("charge", forceManyBody().strength(-650))
      .force(
        "collide",
        forceCollide().radius((datum: { id: string }) => {
          const node = nodeMap.get(datum.id);
          if (!node) {
            return 80;
          }

          return nodeWidth(node) / 2 + 18;
        }),
      )
      .force("x", forceX(width / 2).strength(0.05))
      .force("y", forceY(height / 2).strength(0.05))
      .alphaDecay(0.03)
      .velocityDecay(0.45);

    sim.on("tick", () => {
      renderedNodes = simNodes.map((node) => {
        const data = nodeMap.get(node.id);
        const widthValue = nodeWidth(data ?? { total: 0 });
        return {
          id: node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          total: data?.total ?? 0,
          errors: data?.errors ?? 0,
          errorRate: data?.errorRate ?? 0,
          p95LatencyMs: data?.p95LatencyMs ?? 0,
          width: widthValue,
          height: nodeHeight(),
        };
      });

      renderedLinks = links.map((link) => {
        const sourceNode = simNodes.find((node) => node.id === link.source);
        const targetNode = simNodes.find((node) => node.id === link.target);

        return {
          id: link.id,
          source: { x: sourceNode?.x ?? 0, y: sourceNode?.y ?? 0 },
          target: { x: targetNode?.x ?? 0, y: targetNode?.y ?? 0 },
          total: link.total,
          errors: link.errors,
          errorRate: link.errorRate,
        };
      });
    });

    simulation = sim;

    return () => {
      sim.stop();
    };
  });

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const scaleFactor = event.deltaY > 0 ? 0.92 : 1.08;
    const nextScale = Math.min(Math.max(transform.k * scaleFactor, 0.35), 2.8);
    const rect = svgRef?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    transform = {
      x: mouseX - (mouseX - transform.x) * (nextScale / transform.k),
      y: mouseY - (mouseY - transform.y) * (nextScale / transform.k),
      k: nextScale,
    };
  };

  const handleMouseDown = (event: MouseEvent) => {
    const target = event.target as SVGElement;
    if (target.closest("[data-node]")) {
      return;
    }

    panStart = { x: event.clientX, y: event.clientY };
    panTransformStart = { x: transform.x, y: transform.y };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    transform = {
      ...transform,
      x: panTransformStart.x + dx,
      y: panTransformStart.y + dy,
    };
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleNodeMouseDown = (event: MouseEvent, nodeId: string) => {
    event.stopPropagation();
    isDragging = true;
    dragNode = nodeId;

    const simNode = simNodes.find((node) => node.id === nodeId);
    if (simNode) {
      simNode.fx = simNode.x;
      simNode.fy = simNode.y;
    }

    window.addEventListener("mousemove", handleNodeDrag);
    window.addEventListener("mouseup", handleNodeDragEnd);
  };

  const handleNodeDrag = (event: MouseEvent) => {
    if (!isDragging || !dragNode || !svgRef) {
      return;
    }

    const rect = svgRef.getBoundingClientRect();
    const x = (event.clientX - rect.left - transform.x) / transform.k;
    const y = (event.clientY - rect.top - transform.y) / transform.k;
    const simNode = simNodes.find((node) => node.id === dragNode);

    if (simNode && simulation) {
      simNode.fx = x;
      simNode.fy = y;
      simulation.alpha(0.25).restart();
    }
  };

  const handleNodeDragEnd = () => {
    if (dragNode) {
      const simNode = simNodes.find((node) => node.id === dragNode);
      if (simNode) {
        simNode.fx = undefined;
        simNode.fy = undefined;
      }
    }

    isDragging = false;
    dragNode = null;
    window.removeEventListener("mousemove", handleNodeDrag);
    window.removeEventListener("mouseup", handleNodeDragEnd);
  };

  const handleResetZoom = () => {
    transform = { x: 0, y: 0, k: 1 };
  };
</script>

<div class="flex h-full min-h-0 gap-3">
  <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs">
          {graph.nodes.length} services
        </Badge>
        <Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs">
          {graph.edges.length} connections
        </Badge>
        <Badge variant="secondary" class="rounded-full px-2.5 py-0.5 text-xs">
          {formatNumber(totalRequests)} calls
        </Badge>
        <span class="text-xs text-muted-foreground">{graphWindowLabel}</span>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="inline-block size-2 rounded-full bg-primary"></span>
          Healthy
          <span class="inline-block size-2 rounded-full bg-amber-500"></span>
          Warning
          <span class="inline-block size-2 rounded-full bg-destructive"></span>
          Critical
        </div>
        <Button variant="outline" size="sm" onclick={handleResetZoom}>
          Reset zoom
        </Button>
      </div>
    </div>

    <div
      bind:this={containerRef}
      class="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-background"
      style="background-image: radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-border) 80%, transparent) 1px, transparent 0); background-size: 24px 24px;"
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <svg
        bind:this={svgRef}
        class="h-full w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Service interaction graph"
        onmousedown={handleMouseDown}
        onwheel={handleWheel}
      >
        <g
          transform="translate({transform.x},{transform.y}) scale({transform.k})"
        >
          <defs>
            <marker
              id="arrowhead-default"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="color-mix(in oklab, var(--color-muted-foreground) 40%, transparent)"
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
              <polygon points="0 0, 10 3.5, 0 7" fill="#d97706" />
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
                fill="var(--color-destructive)"
              />
            </marker>
          </defs>

          {#each renderedLinks as link (link.id)}
            {@const isHighlighted =
              selectedNode != null &&
              (link.id.startsWith(`${selectedNode}->`) ||
                link.id.endsWith(`->${selectedNode}`))}
            {@const tone = statusTone(link.errorRate, link.errors)}
            <g
              class="transition-opacity duration-150"
              opacity={selectedNode != null && !isHighlighted ? 0.12 : 1}
            >
              <line
                x1={link.source.x}
                y1={link.source.y}
                x2={link.target.x}
                y2={link.target.y}
                stroke={tone.color}
                stroke-opacity={link.errorRate > 0 || link.errors > 0
                  ? 0.55
                  : 0.28}
                stroke-width={edgeStrokeWidth(link)}
                marker-end={tone.edgeMarker}
                class="pointer-events-none"
              />
              <line
                x1={link.source.x}
                y1={link.source.y}
                x2={link.target.x}
                y2={link.target.y}
                stroke="transparent"
                stroke-width={Math.max(14, edgeStrokeWidth(link) + 10)}
                class="cursor-pointer"
                role="presentation"
                aria-hidden="true"
                onmouseenter={() => (hoveredEdge = link.id)}
                onmouseleave={() => (hoveredEdge = null)}
              />
            </g>
          {/each}

          {#each renderedNodes as node (node.id)}
            {@const isSelected = selectedNode === node.id}
            {@const status = statusTone(node.errorRate, node.errors)}
            {@const dimmed =
              selectedNode != null &&
              selectedNode !== node.id &&
              !selectedConnections.outgoing.some(
                (edge) => edge.target === node.id,
              ) &&
              !selectedConnections.incoming.some(
                (edge) => edge.source === node.id,
              )}
            <g
              transform="translate({node.x},{node.y})"
              class="cursor-pointer transition-opacity duration-150"
              opacity={dimmed ? 0.22 : 1}
              data-node={node.id}
              role="button"
              tabindex={0}
              aria-pressed={isSelected}
              aria-label={`Open details for ${node.id}`}
              onmousedown={(event) => handleNodeMouseDown(event, node.id)}
              onmouseenter={() => (hoveredNode = node.id)}
              onmouseleave={() => (hoveredNode = null)}
              onclick={() => {
                setSelectedNode(isSelected ? null : node.id);
              }}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedNode(isSelected ? null : node.id);
                }
              }}
            >
              <rect
                x={-node.width / 2}
                y={-node.height / 2}
                width={node.width}
                height={node.height}
                rx="18"
                fill="var(--color-card)"
                stroke={status.color}
                stroke-width={isSelected
                  ? 2.5
                  : hoveredNode === node.id
                    ? 2
                    : 1.5}
              />
              <rect
                x={-node.width / 2 + 10}
                y={-node.height / 2 + 10}
                width="4"
                height={node.height - 20}
                rx="999"
                fill={status.color}
              />
              <circle
                cx={node.width / 2 - 16}
                cy={-node.height / 2 + 16}
                r="4"
                fill={status.color}
              />
              <text
                x={-node.width / 2 + 24}
                y={-10}
                class="pointer-events-none fill-foreground text-[12px] font-semibold select-none"
              >
                {truncateServiceName(node.id)}
              </text>
              <text
                x={-node.width / 2 + 24}
                y={12}
                class="pointer-events-none fill-muted-foreground text-[10px] select-none"
              >
                {formatNumber(node.total)} calls
              </text>
              <text
                x={-node.width / 2 + 24}
                y={32}
                class="pointer-events-none fill-muted-foreground text-[10px] select-none"
              >
                {(node.errorRate * 100).toFixed(1)}% errors · {formatNumber(
                  node.errors,
                )} total
              </text>
              <text
                x={-node.width / 2 + 24}
                y={52}
                class="pointer-events-none fill-muted-foreground text-[10px] select-none"
              >
                P95 {formatLatency(node.p95LatencyMs)}
              </text>
            </g>
          {/each}
        </g>
      </svg>

      {#if hoveredEdge}
        {@const edge = graph.edges.find(
          (candidate) =>
            `${candidate.source}->${candidate.target}` === hoveredEdge,
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
              {formatNumber(edge.total)} calls · {(
                edge.errorRate * 100
              ).toFixed(1)}% errors
            </p>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if selectedNode && selectedData}
    <aside
      class="flex min-h-0 w-[22rem] shrink-0 flex-col overflow-hidden rounded-xl border bg-background"
    >
      <div class="flex items-start justify-between border-b px-4 py-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="truncate text-sm font-semibold text-foreground">
              {selectedNode}
            </h2>
            <Badge
              variant="secondary"
              class={`rounded-full px-2 py-0 text-[11px] ${statusTone(selectedData.errorRate, selectedData.errors).badge}`}
            >
              {statusLabel(selectedData.errorRate, selectedData.errors)}
            </Badge>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {selectedConnections.incoming.length} incoming · {selectedConnections
              .outgoing.length} outgoing connections
          </p>
        </div>

        <button
          class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close service details"
          onclick={() => setSelectedNode(null)}
        >
          <IconX class="size-4" />
        </button>
      </div>

      <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg border bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">Calls</p>
            <p class="mt-1 text-sm font-semibold tabular-nums">
              {formatNumber(selectedData.total)}
            </p>
          </div>
          <div class="rounded-lg border bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">Errors</p>
            <p class="mt-1 text-sm font-semibold text-destructive tabular-nums">
              {formatNumber(selectedData.errors)}
            </p>
          </div>
          <div class="rounded-lg border bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">Error rate</p>
            <p class="mt-1 text-sm font-semibold tabular-nums">
              {(selectedData.errorRate * 100).toFixed(1)}%
            </p>
          </div>
          <div class="rounded-lg border bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">P95 latency</p>
            <p class="mt-1 text-sm font-semibold tabular-nums">
              {formatLatency(selectedData.p95LatencyMs)}
            </p>
          </div>
        </div>

        {#if logsHref}
          <div class="flex gap-2">
            <Button
              href={logsHref}
              variant="outline"
              size="sm"
              class="w-full justify-between"
            >
              View logs
              <IconExternalLink data-slot="button-icon" class="size-3.5" />
            </Button>
          </div>
        {/if}

        <section class="space-y-2">
          <div class="flex items-center gap-2">
            <IconTopologyStar3 class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-medium text-foreground">Calls out</h3>
          </div>

          {#if selectedConnections.outgoing.length === 0}
            <div
              class="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground"
            >
              No downstream services in this time window.
            </div>
          {:else}
            <div class="space-y-2">
              {#each selectedConnections.outgoing as edge}
                <button
                  class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  onclick={() => setSelectedNode(edge.target)}
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">
                      {edge.target}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {formatNumber(edge.total)} calls · {(
                        edge.errorRate * 100
                      ).toFixed(1)}% errors
                    </p>
                  </div>
                  <IconArrowDownRight
                    class="size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              {/each}
            </div>
          {/if}
        </section>

        <section class="space-y-2">
          <div class="flex items-center gap-2">
            <IconTopologyStar3 class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-medium text-foreground">Called by</h3>
          </div>

          {#if selectedConnections.incoming.length === 0}
            <div
              class="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground"
            >
              No upstream services in this time window.
            </div>
          {:else}
            <div class="space-y-2">
              {#each selectedConnections.incoming as edge}
                <button
                  class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  onclick={() => setSelectedNode(edge.source)}
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">
                      {edge.source}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {formatNumber(edge.total)} calls · {(
                        edge.errorRate * 100
                      ).toFixed(1)}% errors
                    </p>
                  </div>
                  <IconArrowDownRight
                    class="size-4 shrink-0 rotate-180 text-muted-foreground"
                  />
                </button>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    </aside>
  {/if}
</div>
