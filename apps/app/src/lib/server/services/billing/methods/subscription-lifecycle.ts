const createOnSubscriptionDeleted =
  ({
    reconcileSubscriptions,
  }: {
    reconcileSubscriptions: (context: {
      organizationId: string;
    }) => Promise<void>;
  }) =>
  async (context: { organizationId: string }) => {
    // An old cancellation must not overwrite a new active subscription.
    await reconcileSubscriptions(context);
  };

export { createOnSubscriptionDeleted };
