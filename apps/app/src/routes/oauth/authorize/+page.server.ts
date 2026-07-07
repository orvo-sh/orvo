import { error, fail, redirect, type RequestEvent } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

const hasSignedOauthQuery = (value: string) =>
  value.includes("sig=") && value.includes("exp=");

const getFailedSelectionState = (formData: FormData) => ({
  organizationId: String(formData.get("organization_id") ?? ""),
  selectedAppIds: formData
    .getAll("allowed_app_id")
    .map((value) => String(value))
    .filter(Boolean),
});

const getOauthQueryFromRequest = (event: RequestEvent) => {
  const requestQuery = event.url.searchParams.toString();

  if (hasSignedOauthQuery(requestQuery)) {
    return requestQuery;
  }

  const referer = event.request.headers.get("referer");

  if (referer) {
    try {
      const refererQuery = new URL(referer).searchParams.toString();

      if (hasSignedOauthQuery(refererQuery)) {
        return refererQuery;
      }
    } catch {
      // Ignore invalid referrers and fall back to the submitted form value.
    }
  }

  return "";
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

  if (!oauthQuery || !clientId) {
    throw error(400, "Missing OAuth consent details.");
  }

  const consentPageData =
    await event.locals.container.mcpOauthGrantService.getConsentPageData(
      {
        clientId,
      },
      {
        userId: auth.user.id,
      },
    );

  if (!consentPageData.success) {
    throw error(404, consentPageData.error);
  }

  const organizations =
    await event.locals.container.authService.api.listOrganizations({
      headers: event.request.headers,
    });

  if (organizations.length === 0) {
    throw redirect(302, "/organizations/new");
  }

  const appsByOrganizationEntries = await Promise.all(
    organizations.map(async (organization) => {
      const result = await event.locals.container.appService.listApps({
        organizationId: organization.id,
      });

      return [
        organization.id,
        result.success
          ? result.data.apps.map((app) => ({
              id: app.id,
              name: app.name,
            }))
          : [],
      ] as const;
    }),
  );

  const appsByOrganization = Object.fromEntries(appsByOrganizationEntries);
  const requestedOrganizationId = event.url.searchParams.get("organization_id");
  const selectedOrganizationId =
    requestedOrganizationId &&
    organizations.some(
      (organization) => organization.id === requestedOrganizationId,
    )
      ? requestedOrganizationId
      : consentPageData.data.grant?.organizationId ||
        auth.session.activeOrganizationId ||
        organizations[0]?.id ||
        "";

  return {
    error: "",
    clientId,
    oauthQuery,
    client: consentPageData.data.client,
    scopes: (event.url.searchParams.get("scope") ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean),
    organizations: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })),
    appsByOrganization,
    selectedOrganizationId,
    selectedAppIds: consentPageData.data.grant?.allowedAppIds ?? [],
  };
}) satisfies PageServerLoad;

const actions = {
  default: async (event) => {
    const formData = await event.request.formData();
    const decision = formData.get("decision");
    const auth = event.locals.auth;
    const callback = `${event.url.pathname}${event.url.search}`;

    if (!auth) {
      throw redirect(302, `/sign-in?callback=${encodeURIComponent(callback)}`);
    }

    const clientId = String(formData.get("client_id") ?? "");
    const oauthQuery =
      getOauthQueryFromRequest(event) ||
      String(formData.get("oauth_query") ?? "");

    if (!oauthQuery || !clientId) {
      return fail(400, {
        error: "Missing OAuth consent details.",
      });
    }

    if (decision === "approve") {
      const organizationId = String(formData.get("organization_id") ?? "");
      const allowedAppIds = formData
        .getAll("allowed_app_id")
        .map((value) => String(value))
        .filter(Boolean);

      const result =
        await event.locals.container.mcpOauthGrantService.upsertGrant(
          {
            clientId,
            organizationId,
            allowedAppIds,
          },
          {
            userId: auth.user.id,
          },
        );

      if (!result.success) {
        return fail(400, {
          error: result.error,
          organizationId,
          selectedAppIds: allowedAppIds,
        });
      }
    }

    const consentResponse = await event.fetch("/api/auth/oauth2/consent", {
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
    const consentResult = await consentResponse
      .json()
      .catch(() => null as Record<string, unknown> | null);

    if (!consentResponse.ok) {
      return fail(consentResponse.status, {
        error:
          (typeof consentResult?.error_description === "string" &&
            consentResult.error_description) ||
          (typeof consentResult?.message === "string" &&
            consentResult.message) ||
          "Failed to complete the OAuth consent flow.",
        ...getFailedSelectionState(formData),
      });
    }

    const redirectUrl =
      (typeof consentResult?.url === "string" && consentResult.url) ||
      (typeof consentResult?.redirect_uri === "string" &&
        consentResult.redirect_uri) ||
      null;

    if (!redirectUrl) {
      return fail(400, {
        error: "Failed to complete the OAuth consent flow.",
        ...getFailedSelectionState(formData),
      });
    }

    throw redirect(302, redirectUrl);
  },
} satisfies Actions;

export { actions, load };
