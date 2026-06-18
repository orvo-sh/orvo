import {
  IconAlertHexagon,
  IconChartBar,
  IconCpu2,
  IconHeartbeat,
  IconLayoutGrid,
  IconMap,
  IconTelescope,
  IconTerminal2,
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
  logViews: {
    id: string;
    slug: string;
    name: string;
  }[],
): NavigationGroup[] => {
  return [
    {
      label: "",
      items: [
        {
          href: `/a/${appId}/overview`,
          label: "Overview",
          icon: IconLayoutGrid,
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
          submenu: logViews.map((view) => ({
            href: `/a/${appId}/logs/${view.slug}`,
            label: view.name,
          })),
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
        {
          href: `/a/${appId}/service-map`,
          label: "Service map",
          icon: IconMap,
        },
      ],
    },
    {
      label: "Monitoring",
      items: [
        // {
        //   href: `/a/${appId}/deployments`,
        //   label: "Deployments",
        //   icon: IconRocket,
        //
        // },
        {
          href: `/a/${appId}/hosts`,
          label: "Hosts",
          icon: IconCpu2,
        },
        {
          href: `/a/${appId}/alerts`,
          label: "Alerts",
          icon: IconAlertHexagon,
        },
        {
          href: `/a/${appId}/heartbeats`,
          label: "Heartbeats",
          icon: IconHeartbeat,
        },
      ],
    },
  ];
};

export { generateAppNavigationGroups };
