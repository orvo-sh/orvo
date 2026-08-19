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

const generateAppNavigationGroups = (
  appId: string,
  mode: "cloud" | "local",
): NavigationGroup[] => {
  return [
    {
      label: "",
      items: [
        ...(mode === "cloud"
          ? [
            {
              href: `/a/${appId}/chat`,
              label: "Scout",
              icon: IconSparkle,
            },
          ]
          : []),
        {
          href: `/a/${appId}/overview`,
          label: "Overview",
          icon: IconSphere2,
        },
        {
          href: `/a/${appId}/incidents`,
          label: "Incidents",
          icon: IconFlame,
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
