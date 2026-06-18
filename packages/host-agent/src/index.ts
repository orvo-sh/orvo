import { fileURLToPath } from 'node:url';

const collectorVersion = '0.154.0';
const installerPublishPath = 'host-agent/latest/install.sh';
const manifestPublishPath = 'host-agent/latest/manifest.json';
const installerServiceName = 'orvo-host-agent';
const installerUser = 'orvo-host-agent';
const installRoot = '/opt/orvo-host-agent';
const configRoot = '/etc/orvo-host-agent';
const stateRoot = '/var/lib/orvo-host-agent';
const binaryName = 'otelcol-contrib';
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const templatePaths = {
  collectorConfig: fileURLToPath(new URL('../templates/otelcol-config.yaml.tmpl', import.meta.url)),
  systemdUnit: fileURLToPath(new URL('../templates/orvo-host-agent.service.tmpl', import.meta.url)),
  envFile: fileURLToPath(new URL('../templates/orvo-host-agent.env.tmpl', import.meta.url))
};
const assetPaths = {
  installer: fileURLToPath(new URL('../assets/install.sh', import.meta.url))
};

type InstallBundleOptions = {
  appId: string;
  dockerEnabled: boolean;
  otlpEndpoint: string;
  privateIngestionKey: string;
};

const shellQuote = (value: string) => `'${value.replaceAll(`'`, `'\"'\"'`)}'`;

const replaceTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template
  );

const renderCollectorConfig = (template: string, options: InstallBundleOptions) => {
  const dockerReceivers = options.dockerEnabled
    ? `
  dockerstats:
    endpoint: unix:///var/run/docker.sock
    collection_interval: 30s
`
    : '';
  const dockerMetricsPipelineReceiver = options.dockerEnabled ? ', dockerstats' : '';

  return replaceTemplate(template, {
    APP_ID: options.appId,
    DOCKER_RECEIVERS: dockerReceivers.trimEnd(),
    DOCKER_METRICS_PIPELINE_RECEIVER: dockerMetricsPipelineReceiver
  });
};

const renderSystemdUnit = (template: string) =>
  replaceTemplate(template, {
    INSTALL_ROOT: installRoot,
    CONFIG_ROOT: configRoot,
    STATE_ROOT: stateRoot,
    INSTALLER_SERVICE_NAME: installerServiceName,
    INSTALLER_USER: installerUser,
    BINARY_NAME: binaryName
  });

const renderEnvFile = (template: string, options: InstallBundleOptions) =>
  replaceTemplate(template, {
    APP_ID: options.appId,
    OTLP_ENDPOINT: options.otlpEndpoint,
    PRIVATE_INGESTION_KEY: options.privateIngestionKey
  });

const encodeBundlePart = (value: string) => Buffer.from(value, 'utf8').toString('base64');

const renderInstallBundle = (
  templates: {
    collectorConfig: string;
    systemdUnit: string;
    envFile: string;
  },
  options: InstallBundleOptions
) => {
  const collectorConfig = renderCollectorConfig(templates.collectorConfig, options);
  const systemdUnit = renderSystemdUnit(templates.systemdUnit);
  const envFile = renderEnvFile(templates.envFile, options);

  return [
    `ORVO_INSTALL_BUNDLE_VERSION=${shellQuote('2')}`,
    `ORVO_OTELCOL_VERSION=${shellQuote(collectorVersion)}`,
    `ORVO_APP_ID=${shellQuote(options.appId)}`,
    `ORVO_DOCKER_ENABLED=${shellQuote(options.dockerEnabled ? 'true' : 'false')}`,
    `ORVO_INSTALLER_SERVICE_NAME=${shellQuote(installerServiceName)}`,
    `ORVO_INSTALLER_USER=${shellQuote(installerUser)}`,
    `ORVO_INSTALL_ROOT=${shellQuote(installRoot)}`,
    `ORVO_CONFIG_ROOT=${shellQuote(configRoot)}`,
    `ORVO_STATE_ROOT=${shellQuote(stateRoot)}`,
    `ORVO_BINARY_NAME=${shellQuote(binaryName)}`,
    `ORVO_OTELCOL_CONFIG_B64=${shellQuote(encodeBundlePart(collectorConfig))}`,
    `ORVO_SYSTEMD_UNIT_B64=${shellQuote(encodeBundlePart(systemdUnit))}`,
    `ORVO_ENV_FILE_B64=${shellQuote(encodeBundlePart(envFile))}`,
    ''
  ].join('\n');
};

const renderInstaller = (template: string) =>
  replaceTemplate(template, {
    COLLECTOR_VERSION: collectorVersion,
    INSTALLER_SERVICE_NAME: installerServiceName,
    INSTALLER_USER: installerUser,
    INSTALL_ROOT: installRoot,
    CONFIG_ROOT: configRoot,
    STATE_ROOT: stateRoot,
    BINARY_NAME: binaryName
  });

const collectorAssetCandidates = (arch: 'amd64' | 'arm64') => [
  `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${collectorVersion}/otelcol-contrib_${collectorVersion}_linux_${arch}.tar.gz`,
  `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${collectorVersion}/otelcol-contrib_v${collectorVersion}_linux_${arch}.tar.gz`
];

export {
  binaryName,
  collectorAssetCandidates,
  collectorVersion,
  configRoot,
  installRoot,
  installerPublishPath,
  installerServiceName,
  installerUser,
  manifestPublishPath,
  packageRoot,
  renderCollectorConfig,
  renderEnvFile,
  renderInstallBundle,
  renderInstaller,
  renderSystemdUnit,
  stateRoot,
  templatePaths,
  assetPaths
};

export type { InstallBundleOptions };
