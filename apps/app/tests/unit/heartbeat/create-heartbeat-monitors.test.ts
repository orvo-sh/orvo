import { describe, expect, it, vi } from "vitest";

import { createCreateHeartbeatMonitors } from "$lib/server/services/heartbeat/methods/create-heartbeat-monitors";

describe("create heartbeat monitors", () => {
  it("creates a requested batch atomically", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    const transaction = vi.fn((callback) => callback({ insert }));
    const loadDestinations = vi.fn().mockResolvedValue({
      success: true,
      data: { destinations: [] },
    });
    const createHeartbeatMonitors = createCreateHeartbeatMonitors({
      db: { transaction } as never,
      logger: { error: vi.fn() } as never,
      loadDestinations,
      config: { ingestBaseUrl: "https://ingest.example.com" },
    });

    const result = await createHeartbeatMonitors(
      {
        monitors: [
          {
            name: "Billing worker",
            expectedEverySeconds: 300,
            graceSeconds: 60,
            destinationIds: ["dest_one", "dest_one"],
          },
          {
            name: "Email worker",
            expectedEverySeconds: 600,
            graceSeconds: 120,
            destinationIds: ["dest_two"],
          },
        ],
      },
      { appId: "app_test", userId: "user_test" },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(transaction).toHaveBeenCalledOnce();
    expect(loadDestinations).toHaveBeenCalledWith("app_test", [
      "dest_one",
      "dest_two",
    ]);
    expect(values).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ appId: "app_test", name: "Billing worker" }),
        expect.objectContaining({ appId: "app_test", name: "Email worker" }),
      ]),
    );
    expect(values).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ destinationId: "dest_one" }),
        expect.objectContaining({ destinationId: "dest_two" }),
      ]),
    );
    expect(result.data.monitors).toHaveLength(2);
  });
});
