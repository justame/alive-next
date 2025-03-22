import { MotionStatus } from "@/config/constants";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { locationSchema, locationStringSchema } from "../common/location.dto";

export const createActivitySchema = z.object({
  location: locationStringSchema,
  motionStatus: z.nativeEnum(MotionStatus),
});

export const activitySchema = z.object({
  location: locationSchema.nullable(),
  motionStatus: z.nativeEnum(MotionStatus),
  timestamp: z.instanceof(Timestamp),
});

export type CreateActivityDto = z.infer<typeof createActivitySchema>;
export type ActivityDto = z.infer<typeof activitySchema>;
