const agentVersion = "0.1.3";

const compareAgentVersions = (left: string, right: string) => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  if (
    leftParts.length !== 3 ||
    rightParts.length !== 3 ||
    [...leftParts, ...rightParts].some((part) => !Number.isInteger(part))
  ) {
    return left.localeCompare(right);
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
};

export { agentVersion, compareAgentVersions };
