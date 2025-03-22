import { ACTIVE_MOTION_STATUSES, ACTIVITY_CONFIG } from "@/config/constants";
import { ActivityDto, CreateActivityDto } from "@/dtos/activity/activity.dto";
import { LocationDto } from "@/dtos/common/location.dto";
import { Firestore, Timestamp } from "firebase-admin/firestore";

export class ActivityService {
  constructor(private readonly db: Firestore) {}

  private parseLocation(locationString: string): LocationDto {
    const [lat, lng] = locationString.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error("Invalid location format");
    }
    return { lat, lng };
  }

  async createActivity(
    userId: string,
    data: CreateActivityDto
  ): Promise<ActivityDto> {
    const coordinates = this.parseLocation(data.location);

    const newActivity: ActivityDto = {
      location: coordinates,
      motionStatus: data.motionStatus,
      timestamp: Timestamp.now(),
    };

    const activityRef = this.db.collection("userActivity").doc(userId);
    const activityDoc = await activityRef.get();

    let activities = activityDoc.exists
      ? activityDoc.data()?.activities || []
      : [];
    activities = [newActivity, ...activities].slice(
      0,
      ACTIVITY_CONFIG.MAX_ACTIVITIES
    );

    const updateData: any = { activities };

    const isActiveMotion = ACTIVE_MOTION_STATUSES.includes(
      data.motionStatus as (typeof ACTIVE_MOTION_STATUSES)[number]
    );
    if (isActiveMotion) {
      updateData.lastActiveState = newActivity;
    }

    await activityRef.set(updateData, { merge: true });

    return newActivity;
  }

  async getActivities(userId: string): Promise<ActivityDto[]> {
    const activityDoc = await this.db
      .collection("userActivity")
      .doc(userId)
      .get();

    return activityDoc.exists ? activityDoc.data()?.activities || [] : [];
  }
}
