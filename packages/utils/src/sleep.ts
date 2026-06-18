const sleep = async (durationMs: number) => {
  await new Promise((res) => setTimeout(res, durationMs));
};

export { sleep };
