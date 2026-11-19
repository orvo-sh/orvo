import { createAuth } from "$lib/server/auth";
import { getDb, getDbClient, eq, type DB } from "@repo/db";
import { verification } from "@repo/db/schema";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
} from "../../helpers/postgres";
import { createTestLogger } from "../../helpers/logger";

// HTTP requests below exercise Better Auth outside a running SvelteKit request.
vi.mock("$app/server", () => ({
  getRequestEvent: () => {
    throw new Error("No request event");
  },
}));

describe("password reset", () => {
  let container: Awaited<ReturnType<typeof startPostgresContainer>>;
  let db: DB;
  let auth: ReturnType<typeof createAuth>;
  const sendEmail = vi.fn().mockResolvedValue("email-id");
  const origin = "http://localhost:5173";
  const email = "reset@example.com";
  const oldPassword = "original-password-123";
  const newPassword = "replacement-password-456";

  const post = async (path: string, body: Record<string, string>) =>
    auth.handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      }),
    );

  const requestReset = () =>
    post("request-password-reset", {
      email,
      redirectTo: `${origin}/reset-password`,
    });
  const getResetUrl = () =>
    new URL(
      sendEmail.mock.calls.at(-1)![0].props.resetUrl.replaceAll("&amp;", "&"),
    );

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = getDb(container.getConnectionUri());
    await applyPostgresMigrations(db);
    auth = createAuth(
      db,
      createTestLogger() as never,
      { sendEmail } as never,
      null,
      {
        secret: "password-reset-test-secret-at-least-32-characters",
        baseUrl: origin,
      },
    );
    const response = await post("sign-up/email", {
      email,
      password: oldPassword,
      name: "Reset test",
    });
    expect(response.status).toBe(200);
    sendEmail.mockClear();
  });

  afterAll(async () => {
    if (container) {
      await getDbClient(container.getConnectionUri()).end();
      await stopPostgresContainer(container);
    }
  });

  test("delivers a link, changes the password, revokes sessions, and consumes the token", async () => {
    const login = await post("sign-in/email", { email, password: oldPassword });
    const sessionToken = (await login.json()).token;
    expect(login.status).toBe(200);
    const response = await requestReset();
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledOnce());
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({
      to: email,
      template: "reset-password",
    });
    const link = getResetUrl();
    const follow = await auth.handler(new Request(link));
    expect(follow.status).toBe(302);
    const token = new URL(follow.headers.get("location")!).searchParams.get(
      "token",
    )!;
    expect(token).toBeTruthy();
    expect((await post("reset-password", { token, newPassword })).status).toBe(
      200,
    );
    expect(
      (await post("sign-in/email", { email, password: oldPassword })).status,
    ).toBe(401);
    expect(
      (await post("sign-in/email", { email, password: newPassword })).status,
    ).toBe(200);
    expect(
      await db.query.session.findFirst({
        where: (session, { eq }) => eq(session.token, sessionToken),
      }),
    ).toBeUndefined();
    expect(
      (await post("reset-password", { token, newPassword: oldPassword }))
        .status,
    ).toBe(400);
  });

  test("returns the same confirmation for an unknown email without sending mail", async () => {
    sendEmail.mockClear();
    const known = await requestReset();
    const expected = await known.json();
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledOnce());
    sendEmail.mockClear();
    const unknown = await post("request-password-reset", {
      email: "unknown@example.com",
      redirectTo: `${origin}/reset-password`,
    });
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(expected);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("rejects an expired token", async () => {
    sendEmail.mockClear();
    expect((await requestReset()).status).toBe(200);
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledOnce());
    const link = getResetUrl();
    const token = link.pathname.split("/").at(-1)!;
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(verification.identifier, `reset-password:${token}`));
    const follow = await auth.handler(new Request(link));
    expect(
      new URL(follow.headers.get("location")!).searchParams.get("error"),
    ).toBe("INVALID_TOKEN");
    expect(
      (await post("reset-password", { token, newPassword: oldPassword }))
        .status,
    ).toBe(400);
  });
});
