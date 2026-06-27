import { z } from "zod";

const ingestionKeyKindSchema = z.enum(["public", "private"]);

const getIngestionKeyInputSchema = z.object({
  kind: ingestionKeyKindSchema,
});

const createIngestionKeyInputSchema = z.object({
  kind: ingestionKeyKindSchema,
});

const rotateIngestionKeyInputSchema = z.object({
  kind: ingestionKeyKindSchema,
});

export {
  createIngestionKeyInputSchema,
  getIngestionKeyInputSchema,
  ingestionKeyKindSchema,
  rotateIngestionKeyInputSchema,
};
