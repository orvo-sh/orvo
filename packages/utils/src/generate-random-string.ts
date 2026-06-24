const generateRandomString = (length: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += chars[bytes[index] % chars.length];
  }

  return result;
};

export { generateRandomString };
