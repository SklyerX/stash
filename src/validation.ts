import z from "zod";

const SaveSchema = z.object({
  id: z.number(),
  collection_id: z.number(),
  url: z.string().url(),
  alias: z.string().nullable(),
  tags: z.string().nullable(),
  downloaded_filepath: z.string().nullable(),
  created_at: z.number(),
});

const CollectionDataSchema = z.object({
  created_at: z.number(),
  saves: z.array(SaveSchema),
});

export const ExportSchema = z.array(
  z.tuple([z.string(), CollectionDataSchema]),
);
