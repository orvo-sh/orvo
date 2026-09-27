const isAppNameConflict = (error: unknown) => {
  let current = error;

  while (current && typeof current === "object") {
    const constraint =
      "constraint_name" in current
        ? current.constraint_name
        : "constraint" in current
          ? current.constraint
          : undefined;

    if (
      "code" in current &&
      current.code === "23505" &&
      constraint === "app_org_name_uidx"
    ) {
      return true;
    }

    if (
      "message" in current &&
      typeof current.message === "string" &&
      current.message.includes(
        "duplicate key value violates unique constraint",
      ) &&
      current.message.includes('"app_org_name_uidx"')
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
};

export { isAppNameConflict };
