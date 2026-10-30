const readBillingReturnUrl = (input: {
  appId: string;
  returnPath?: string;
  origin: string;
}) => {
  const url = new URL(
    input.returnPath ?? `/a/${input.appId}/settings/billing`,
    input.origin,
  );
  return url.origin === new URL(input.origin).origin &&
    (url.pathname === `/a/${input.appId}` ||
      url.pathname.startsWith(`/a/${input.appId}/`))
    ? url
    : null;
};

export { readBillingReturnUrl };
