import { describe, expect, it } from "vitest";

import { isAppNameConflict } from "$lib/server/services/app/methods/shared";

describe("isAppNameConflict", () => {
  it("recognizes the structured PostgreSQL constraint error", () => {
    expect(
      isAppNameConflict({
        code: "23505",
        constraint_name: "app_org_name_uidx",
      }),
    ).toBe(true);
  });

  it("recognizes the nested Drizzle error shape", () => {
    expect(
      isAppNameConflict(
        new Error("Failed query", {
          cause: {
            code: "23505",
            constraint_name: "app_org_name_uidx",
          },
        }),
      ),
    ).toBe(true);
  });

  it("recognizes the error message emitted in application logs", () => {
    expect(
      isAppNameConflict(
        new Error(
          'duplicate key value violates unique constraint "app_org_name_uidx"',
        ),
      ),
    ).toBe(true);
  });

  it("does not treat other unique constraints as app name conflicts", () => {
    expect(
      isAppNameConflict({
        code: "23505",
        constraint_name: "app_pkey",
      }),
    ).toBe(false);
  });
});
