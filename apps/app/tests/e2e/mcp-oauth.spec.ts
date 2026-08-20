import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";
import { app } from "@repo/db/schema";
import { genId } from "@repo/utils";
import { createHash } from "node:crypto";

const TEST_APP_ORIGIN = "http://127.0.0.1:42173";

test.use({ storageState: "tests/.auth/full-user.json" });

const parseMcpResponse = (text: string) => {
  const eventData = text
    .split("\n")
    .find((line) => line.startsWith("data: {"))
    ?.slice("data: ".length);
  return JSON.parse(eventData ?? text);
};

test("authorizes one organization and exposes useful MCP tools", async ({
  page,
  request,
}) => {
  const db = getDb(process.env.POSTGRES_URL!);
  const testUser = await db.query.user.findFirst({
    where: ({ email }, { eq }) =>
      eq(email, "setup-full-user@test-accounts.orvo.sh"),
  });
  expect(testUser).toBeTruthy();

  const currentMember = await db.query.member.findFirst({
    where: ({ userId }, { eq }) => eq(userId, testUser!.id),
  });
  expect(currentMember).toBeTruthy();

  const appId = genId("app");
  await db.insert(app).values({
    id: appId,
    organizationId: currentMember!.organizationId,
    name: `MCP test app ${appId}`,
    createdBy: testUser!.id,
    updatedBy: testUser!.id,
  });

  const redirectUri = `${TEST_APP_ORIGIN}/oauth/test-callback`;
  const registrationResponse = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: "MCP end-to-end test",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid offline_access mcp:read",
    },
  });
  expect(registrationResponse.status()).toBe(201);
  const registration = await registrationResponse.json();

  const verifier = "orvo-mcp-e2e-verifier-0123456789abcdefghijklmnopqrstuvwxyz";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL(
    "/api/auth/oauth2/authorize",
    TEST_APP_ORIGIN,
  );
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: registration.client_id,
    redirect_uri: redirectUri,
    state: "mcp-e2e-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  await page.goto(authorizationUrl.toString());
  await page.waitForURL(/\/oauth\/authorize\?/);
  await expect(page.getByLabel("Organization")).toBeVisible();
  await expect(page.getByText("Allowed apps")).toHaveCount(0);

  const tamperedQuery = new URLSearchParams(
    await page.locator('input[name="oauth_query"]').inputValue(),
  );
  tamperedQuery.set("state", "tampered-state");
  const tamperedConsent = await page.request.post("/oauth/authorize", {
    headers: { origin: TEST_APP_ORIGIN },
    form: {
      decision: "approve",
      client_id: registration.client_id,
      oauth_query: tamperedQuery.toString(),
      organization_id: currentMember!.organizationId,
    },
    maxRedirects: 0,
  });
  expect(await tamperedConsent.text()).toContain(
    "Missing OAuth authorization details.",
  );
  expect(
    await db.query.mcpOauthGrant.findFirst({
      where: ({ clientId, userId }, { and, eq }) =>
        and(eq(clientId, registration.client_id), eq(userId, testUser!.id)),
    }),
  ).toBeUndefined();

  await page.getByRole("button", { name: "Allow access" }).click();
  await page.waitForURL(`${redirectUri}**`);

  const callbackUrl = new URL(page.url());
  expect(callbackUrl.searchParams.get("error")).toBeNull();
  const code = callbackUrl.searchParams.get("code");
  expect(code).toBeTruthy();

  const tokenResponse = await fetch(
    `${TEST_APP_ORIGIN}/api/auth/oauth2/token`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://oauth-client.example",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: registration.client_id,
        code: code!,
        code_verifier: verifier,
        redirect_uri: redirectUri,
      }),
    },
  );
  const tokenText = await tokenResponse.text();
  expect(tokenResponse.ok, tokenText).toBeTruthy();
  const token = JSON.parse(tokenText);

  const mcpRequest = async (payload: Record<string, unknown>) => {
    const response = await fetch(`${TEST_APP_ORIGIN}/api/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    expect(response.ok, text).toBeTruthy();
    return parseMcpResponse(text);
  };

  const initialized = await mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "Orvo MCP test", version: "1.0.0" },
    },
  });
  expect(initialized.result.serverInfo.name).toBe("orvo");

  const tools = await mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const toolNames = tools.result.tools.map(
    (tool: { name: string }) => tool.name,
  );
  expect(toolNames).toEqual(
    expect.arrayContaining([
      "list_apps",
      "search_logs",
      "get_trace",
      "query_metrics",
      "list_incidents",
      "list_alert_rules",
    ]),
  );

  const apps = await mcpRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_apps", arguments: {} },
  });
  expect(apps.result.structuredContent.data.apps).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: appId })]),
  );

  await page.goto(`/a/${appId}/settings/integrations/mcp`);
  const connection = page
    .getByTestId("mcp-connection")
    .filter({ hasText: "MCP end-to-end test" });
  await expect(connection).toBeVisible();
  await connection.getByRole("button", { name: "Revoke" }).click();
  await expect(
    page.getByRole("heading", { name: "Revoke MCP end-to-end test?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revoke access" }).click();
  await expect(connection).toHaveCount(0);

  const revokedResponse = await fetch(`${TEST_APP_ORIGIN}/api/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/list",
    }),
  });
  expect(revokedResponse.status).toBe(401);

  expect(
    await db.query.mcpOauthGrant.findFirst({
      where: ({ clientId, userId }, { and, eq }) =>
        and(eq(clientId, registration.client_id), eq(userId, testUser!.id)),
    }),
  ).toBeUndefined();
});

test("keeps OAuth machine posts narrow and rejects other cross-site forms", async () => {
  const response = await fetch(`${TEST_APP_ORIGIN}/oauth/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://oauth-client.example",
    },
    body: new URLSearchParams({ organization_id: "org_test" }),
  });

  expect(response.status).toBe(403);
  expect(await response.text()).toBe(
    "Cross-site POST form submissions are forbidden",
  );
});
