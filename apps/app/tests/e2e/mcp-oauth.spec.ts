import { expect, test } from "@playwright/test";
import { getDb } from "@repo/db";
import { app } from "@repo/db/schema";
import { genId } from "@repo/utils";
import { createHash } from "node:crypto";

const TEST_APP_ORIGIN = "http://127.0.0.1:42173";

test.use({ storageState: "tests/.auth/full-user.json" });

test("issues an MCP access token through OAuth", async ({ page, request }) => {
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
    name: `OAuth test app ${appId}`,
    createdBy: testUser!.id,
    updatedBy: testUser!.id,
  });

  const redirectUri = `${TEST_APP_ORIGIN}/oauth/test-callback`;
  const registrationResponse = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: "OAuth end-to-end test",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope:
        "openid profile email offline_access app:read logs:read traces:read metrics:read incidents:read heartbeats:read alerts:read",
    },
  });

  expect(registrationResponse.status()).toBe(201);
  const registration = await registrationResponse.json();
  const verifier =
    "orvo-oauth-e2e-verifier-0123456789abcdefghijklmnopqrstuvwxyz";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL(
    "/api/auth/oauth2/authorize",
    TEST_APP_ORIGIN,
  );
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: registration.client_id,
    redirect_uri: redirectUri,
    state: "oauth-e2e-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  await page.goto(authorizationUrl.toString());
  await page.waitForURL(/\/oauth\/authorize\?/);
  await page.waitForLoadState("networkidle");
  await page
    .locator(`input[name="allowed_app_id"][value="${appId}"]`)
    .evaluate((input: HTMLInputElement) => {
      input.disabled = false;
    });
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
  expect(token.access_token).toEqual(expect.any(String));

  const mcpResponse = await fetch(`${TEST_APP_ORIGIN}/api/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: {
          name: "OAuth end-to-end test",
          version: "1.0.0",
        },
      },
    }),
  });
  const mcpText = await mcpResponse.text();

  expect(mcpResponse.ok, mcpText).toBeTruthy();
  const mcpData = mcpText
    .split("\n")
    .find((line) => line.startsWith("data: {"))
    ?.slice("data: ".length);

  expect(mcpData, mcpText).toBeTruthy();
  expect(JSON.parse(mcpData!).result.serverInfo.name).toBe("orvo");
});

test("rejects cross-site form posts outside OAuth machine endpoints", async () => {
  const response = await fetch(`${TEST_APP_ORIGIN}/oauth/authorize`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://oauth-client.example",
    },
    body: new URLSearchParams({ appId: "app_test" }),
  });

  expect(response.status).toBe(403);
  expect(await response.text()).toBe(
    "Cross-site POST form submissions are forbidden",
  );
});
