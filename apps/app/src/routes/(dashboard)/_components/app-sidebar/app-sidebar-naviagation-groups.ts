import {
  IconAlertHexagon,
  IconBox,
  IconChartBar,
  IconGauge,
  IconLayoutGrid,
  IconMap,
  IconRocket,
  IconRoute,
  IconTerminal2
} from "@tabler/icons-svelte";

type NavigationGroup = {
  label: string;
  items: {
    href: string;
    label: string;
    icon: typeof IconGauge;
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
          shortcut: "o",
        }
      ],
    },
    {
      label: "Telemetry",
      items: [
        {
          href: `/a/${appId}/logs`,
          label: "Logs",
          icon: IconTerminal2,
          shortcut: "l",
          submenu: logViews.map((view) => ({
            href: `/a/${appId}/logs/${view.slug}`,
            label: view.name,
          })),
        },
        {
          href: `/a/${appId}/metrics`,
          label: "Metrics",
          icon: IconChartBar,
          shortcut: "m",
        },
        {
          href: `/a/${appId}/traces`,
          label: "Traces",
          icon: IconRoute,
          shortcut: "t",
        },
        {
          href: `/a/${appId}/service-map`,
          label: "Service map",
          icon: IconMap,
          shortcut: "g",
        },
      ],
    },
    {
      label: "Monitoring",
      items: [
        {
          href: `/a/${appId}/deployments`,
          label: "Deployments",
          icon: IconRocket,
          shortcut: "d",
        },
        {
          href: `/a/${appId}/alerts`,
          label: "Alerts",
          icon: IconAlertHexagon,
          shortcut: "a",
        },
      ],
    },
  ];
};

const generateOrganizationNavigationGroups = (): NavigationGroup[] => {
  return [
    {
      label: "",
      items: [
        {
          href: `/apps`,
          label: "Apps",
          shortcut: "a",
          icon: IconBox,
        },
      ],
    },
  ];
};

export { generateAppNavigationGroups, generateOrganizationNavigationGroups };
