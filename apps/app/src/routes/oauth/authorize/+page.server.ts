import { env } from "$env/dynamic/private";
import { error, fail, redirect } from "@sveltejs/kit";
import { constantTimeEqual, makeSignature } from "better-auth/crypto";
import type { Actions, PageServerLoad } from "./$types";

const isValidOauthQuery = async (value: string, clientId: string) => {
  const query = new URLSearchParams(value);
  const signatures = query.getAll("sig");
  const expiresAt = Number(query.get("exp"));
  if (
    signatures.length !== 1 ||
    !signatures[0] ||
    !Number.isFinite(expiresAt) ||
    expiresAt * 1_000 < Date.now() ||
    query.get("client_id") !== clientId
  ) {
    return false;
  }

  query.delete("sig");
  const canonical = new URLSearchParams(
    [...query.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
      return 0;
    }),
  );
  const signature = await makeSignature(
    canonical.toString(),
    env.BETTER_AUTH_SECRET || env.ENCRYPTION_SECRET,
  );
  return constantTimeEqual(signatures[0], signature);
};

const load = (async (event) => {
  const callback = `${event.url.pathname}${event.url.search}`;
  const auth = event.locals.auth;

  if (!auth) {
    throw redirect(302, `/sign-in?callback=${encodeURIComponent(callback)}`);
  }
  if (!auth.user.emailVerified) {
    throw redirect(
      302,
      `/verify-email?email=${encodeURIComponent(auth.user.email)}&callback=${encodeURIComponent(callback)}`,
    );
  }

  const clientId = event.url.searchParams.get("client_id") ?? "";
  const oauthQuery = event.url.searchParams.toString();
  if (!clientId || !(await isValidOauthQuery(oauthQuery, clientId))) {
    throw error(400, "Missing OAuth authorization details.");
  }

  const [consent, organizations] = await Promise.all([
    event.locals.container.mcpOauthGrantService.getConsentPageData(
      { clientId },
      { userId: auth.user.id },
    ),
    event.locals.container.authService.api.listOrganizations({
      headers: event.request.headers,
    }),
  ]);
  if (!consent.success) throw error(404, consent.error);
  if (organizations.length === 0) throw redirect(302, "/organizations/new");

  const requestedOrganizationId = event.url.searchParams.get("organization_id");

  return {
    clientId,
    oauthQuery,
    client: consent.data.client,
    organizations: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
    })),
    selectedOrganizationId:
      (requestedOrganizationId &&
      organizations.some(
        (organization) => organization.id === requestedOrganizationId,
      )
        ? requestedOrganizationId
        : null) ??
      consent.data.organizationId ??
      auth.session.activeOrganizationId ??
      organizations[0]!.id,
  };
}) satisfies PageServerLoad;

const actions = {
  default: async (event) => {
    const auth = event.locals.auth;
    if (!auth) throw redirect(302, "/sign-in");

    const formData = await event.request.formData();
    const decision = String(formData.get("decision") ?? "");
    const clientId = String(formData.get("client_id") ?? "");
    const oauthQuery = String(formData.get("oauth_query") ?? "");
    const organizationId = String(formData.get("organization_id") ?? "");

    if (!clientId || !(await isValidOauthQuery(oauthQuery, clientId))) {
      return fail(400, {
        error: "Missing OAuth authorization details.",
        organizationId,
      });
    }

    if (decision === "approve") {
      const result =
        await event.locals.container.mcpOauthGrantService.upsertGrant(
          { clientId, organizationId },
          { userId: auth.user.id },
        );
      if (!result.success)
        return fail(400, { error: result.error, organizationId });
    }

    const response = await event.fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: event.url.origin,
        ...(event.request.headers.get("cookie")
          ? { cookie: event.request.headers.get("cookie")! }
          : {}),
      },
      body: JSON.stringify({
        accept: decision === "approve",
        oauth_query: oauthQuery,
      }),
    });
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      return fail(response.status, {
        error:
          (typeof result?.error_description === "string" &&
            result.error_description) ||
          (typeof result?.message === "string" && result.message) ||
          "Failed to complete authorization.",
        organizationId,
      });
    }

    const redirectUrl =
      (typeof result?.url === "string" && result.url) ||
      (typeof result?.redirect_uri === "string" && result.redirect_uri);
    if (!redirectUrl) {
      return fail(400, {
        error: "Failed to complete authorization.",
        organizationId,
      });
    }

    throw redirect(302, redirectUrl);
  },
} satisfies Actions;

export { actions, load };
