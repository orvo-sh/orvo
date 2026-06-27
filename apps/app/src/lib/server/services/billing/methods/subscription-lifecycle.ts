const createOnSubscriptonChanged = () => async (_context: {
  organizationId: string;
}) => {
  // TODO: get from stripe what the new subscription is and change whatever needs to change
  // reset limits
};

const createOnTrialExpired = () => async (_context: { organizationId: string }) => {
  // TODO: send an email to the owners telling them to bill. Change plan-status over to overdue too
};

const createOnSubscriptionDeleted = () => async (_context: {
  organizationId: string;
}) => {
  // TODO: do the things
};

export {
  createOnSubscriptionDeleted,
  createOnSubscriptonChanged,
  createOnTrialExpired,
};
