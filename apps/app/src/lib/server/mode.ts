import { env } from "$env/dynamic/private";

const mode = env.ORVO_MODE === "local" ? "local" : "cloud";

export { mode };
