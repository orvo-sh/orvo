import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconChartBar,
  IconFlame,
  IconLayoutGrid,
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
): NavigationGroup[] => {
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
        }
      ],
    },
    {
      label: "Monitoring",
      items: [
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
