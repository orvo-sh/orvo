import { formatNumber } from "./format-number.js";

const formatBytes = (bytes: number, unit: "MB" | "GB", decimals = 2) => {
    const d = unit === "GB" ? 1024 ** 3 : 1024 ** 2;
    return `${formatNumber(bytes / d, decimals)} ${unit}`;
}

export { formatBytes };
