const organizationActivationState = $state({
  organizationId: "",
  activation: null as {
    hasCreatedFirstApp: boolean;
    hasSentFirstSignals: boolean;
    hasViewedTelemetry: boolean;
    hasCreatedFirstAlert: boolean;
    hasInvitedTeammate: boolean;
    completedCount: number;
    totalCount: number;
  } | null,
});

const cloneActivation = (
  activation: NonNullable<typeof organizationActivationState.activation>,
) => ({
  ...activation,
});

const recalculateActivation = (
  activation: NonNullable<typeof organizationActivationState.activation>,
) => ({
  ...activation,
  completedCount: [
    activation.hasCreatedFirstApp,
    activation.hasSentFirstSignals,
    activation.hasViewedTelemetry,
    activation.hasCreatedFirstAlert,
    activation.hasInvitedTeammate,
  ].filter(Boolean).length,
});

const seedOrganizationActivation = (
  organizationId: string,
  activation: typeof organizationActivationState.activation,
) => {
  organizationActivationState.organizationId = organizationId;
  organizationActivationState.activation = activation
    ? recalculateActivation(cloneActivation(activation))
    : null;
};

const completeOrganizationActivationStep = (
  step:
    | "hasCreatedFirstApp"
    | "hasSentFirstSignals"
    | "hasViewedTelemetry"
    | "hasCreatedFirstAlert"
    | "hasInvitedTeammate",
) => {
  if (!organizationActivationState.activation) {
    return null;
  }

  const previousActivation = cloneActivation(
    organizationActivationState.activation,
  );
  if (previousActivation[step]) {
    return null;
  }

  organizationActivationState.activation = recalculateActivation({
    ...organizationActivationState.activation,
    [step]: true,
  });

  return previousActivation;
};

const restoreOrganizationActivation = (
  organizationId: string,
  activation: NonNullable<typeof organizationActivationState.activation> | null,
) => {
  if (organizationActivationState.organizationId !== organizationId) {
    return;
  }

  organizationActivationState.activation = activation
    ? recalculateActivation(cloneActivation(activation))
    : null;
};

export {
  completeOrganizationActivationStep,
  organizationActivationState,
  restoreOrganizationActivation,
  seedOrganizationActivation,
};
