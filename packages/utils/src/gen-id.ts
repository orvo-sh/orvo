import { ulid } from 'ulid';

const genId = (prefix: string) => {
  const id = ulid().toLowerCase();
  return prefix ? `${prefix.toLowerCase()}_${id}` : id;
};

export { genId };
