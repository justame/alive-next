export const ACTIVITY_CONFIG = {
  MAX_ACTIVITIES: 10,
  INACTIVITY_THRESHOLD_HOURS: 24,
} as const;

export enum MotionStatus {
  WALKING = "walking",
  RUNNING = "running",
  MOVING = "moving",
  STATIONARY = "stationary",
  UNKNOWN = "unknown",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export const ACTIVE_MOTION_STATUSES = [
  MotionStatus.WALKING,
  MotionStatus.RUNNING,
  MotionStatus.MOVING,
  MotionStatus.UNKNOWN,
  MotionStatus.ACTIVE,
] as const;
