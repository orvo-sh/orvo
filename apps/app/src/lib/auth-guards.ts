import { getActiveOrganizationId } from "$lib/server/request-context";
import { mode } from "$lib/server/mode";
import { redirect, type RequestEvent } from "@sveltejs/kit";

const requireUser = (
  event: RequestEvent,
  options: {
    redirectTo?: string;
  } = {},
) => {
  const auth = event.locals.auth;

  if (!auth) {
    throw redirect(302, options.redirectTo ?? "/sign-in");
  }

  return auth;
};

const requireAnonymous = (
  event: RequestEvent,
  options: {
    redirectTo?: string;
  } = {},
) => {
  if (event.locals.auth) {
    throw redirect(302, options.redirectTo ?? "/");
  }
};

const requireVerifiedUser = (
  event: RequestEvent,
  options: {
    signInRedirectTo?: string;
    verifyRedirectTo?: string;
  } = {},
) => {
  const auth = requireUser(event, {
    redirectTo: options.signInRedirectTo,
  });

  if (!auth.user.emailVerified) {
    throw redirect(
      302,
      `${options.verifyRedirectTo ?? "/verify-email"}?email=${encodeURIComponent(auth.user.email)}`,
    );
  }

  return auth;
};

const requireOrganization = async (
  event: RequestEvent,
  options: {
    signInRedirectTo?: string;
    verifyRedirectTo?: string;
    noOrganizationsRedirectTo?: string;
    invalidOrganizationRedirectTo?: string;
  } = {},
) => {
  const auth =
    mode === "cloud"
      ? requireVerifiedUser(event, {
          signInRedirectTo: options.signInRedirectTo,
          verifyRedirectTo: options.verifyRedirectTo,
        })
      : requireUser(event, { redirectTo: options.signInRedirectTo });

  const organizations =
    await event.locals.container.authService.api.listOrganizations({
      headers: event.request.headers,
    });

  if (organizations.length === 0) {
    throw redirect(
      302,
      options.noOrganizationsRedirectTo ?? "/organizations/new",
    );
  }

  const activeOrganizationId = getActiveOrganizationId(event);
  if (
    !activeOrganizationId ||
    !organizations.some(
      (organization) => organization.id === activeOrganizationId,
    )
  ) {
    throw redirect(
      302,
      options.invalidOrganizationRedirectTo ?? "/organizations",
    );
  }

  return {
    auth,
    organizations,
    activeOrganizationId,
  };
};

const ensureOrganizationHasBillingPlan = async (
  event: RequestEvent,
  options: {
    signInRedirectTo?: string;
    verifyRedirectTo?: string;
    noOrganizationsRedirectTo?: string;
    invalidOrganizationRedirectTo?: string;
    missingBillingServiceRedirectTo?: string;
    missingPlanRedirectTo?: string;
  } = {},
) => {
  const organizationContext = await requireOrganization(event, {
    signInRedirectTo: options.signInRedirectTo,
    verifyRedirectTo: options.verifyRedirectTo,
    noOrganizationsRedirectTo: options.noOrganizationsRedirectTo,
    invalidOrganizationRedirectTo: options.invalidOrganizationRedirectTo,
  });

  if (!event.locals.container.billingService) {
    throw redirect(302, options.missingBillingServiceRedirectTo ?? "/");
  }

  const billingState =
    await event.locals.container.billingService.getBillingState({
      organizationId: organizationContext.activeOrganizationId,
    });

  if (!billingState.success || !billingState.data.billingPlan) {
    throw redirect(302, options.missingPlanRedirectTo ?? "/organizations/plan");
  }

  return {
    ...organizationContext,
    billingPlan: billingState.data.billingPlan,
    billingStatus: billingState.data.billingStatus,
  };
};

export {
  ensureOrganizationHasBillingPlan,
  requireAnonymous,
  requireOrganization,
  requireUser,
  requireVerifiedUser,
};
