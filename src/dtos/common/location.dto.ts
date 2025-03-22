import { z } from "zod";

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type LocationDto = z.infer<typeof locationSchema>;

export const locationStringSchema = z
  .string()
  .regex(
    /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/,
    'Location must be in format "latitude,longitude"'
  );
