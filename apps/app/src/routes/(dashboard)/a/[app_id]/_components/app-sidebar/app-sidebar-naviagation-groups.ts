import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconChartBar,
  IconFlame,
  IconLayoutGrid,
  IconServer,
  IconSparkle,
  IconSphere2,
  IconTelescope,
  IconTerminal2
} from "@tabler/icons-svelte";

type NavigationGroup = {
  label: string;
  items: {
    href: string;
    label: string;
    icon: typeof IconLayoutGrid;
    shortcut?: string;
    submenu?: Array<{
      href: string;
      label: string;
    }>;
  }[];
};

const generateAppNavigationGroups = (appId: string, dashboards: { id: string; name: string; pinned: boolean }[] = []): NavigationGroup[] => {
  return [
    {
      label: "",
      items: [
        {
          href: `/a/${appId}/overview`,
          label: "Overview",
          icon: IconSphere2,
        },
        {
          href: `/a/${appId}/dashboards`,
          label: "Dashboards",
          icon: IconLayoutGrid,
          submenu: dashboards.filter((dashboard) => dashboard.pinned).toSorted((a, b) => a.name.localeCompare(b.name)).map((dashboard) => ({ href: `/a/${appId}/dashboards/${dashboard.id}`, label: dashboard.name })),
        },
        {
          href: `/a/${appId}/incidents`,
          label: "Incidents",
          icon: IconFlame,
        },
        {
          href: `/a/${appId}/chat`,
          label: "Scout",
          icon: IconSparkle,
        },
      ],
    },
    {
      label: "Telemetry",
      items: [
        {
          href: `/a/${appId}/logs`,
          label: "Logs",
          icon: IconTerminal2,
        },
        {
          href: `/a/${appId}/traces`,
          label: "Traces",
          icon: IconTelescope,
        },
        {
          href: `/a/${appId}/metrics`,
          label: "Metrics",
          icon: IconChartBar,
        },
      ],
    },
    {
      label: "Monitoring",
      items: [
        {
          href: `/a/${appId}/hosts`,
          label: "Hosts",
          icon: IconServer,
        },
        {
          href: `/a/${appId}/alerts`,
          label: "Alerts",
          icon: IconAlertTriangle,
        },
        {
          href: `/a/${appId}/heartbeats`,
          label: "Heartbeats",
          icon: IconActivityHeartbeat,
        },
      ],
    },
  ];
};

export { generateAppNavigationGroups };
