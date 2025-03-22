import { auth, db } from "@/app/lib/firebase-admin";
import { formatInactivityMessage, twilioClient } from "@/app/lib/twilio";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

// Types
interface NotificationResult {
  recipientId: string;
  status: "success" | "failed" | "skipped";
  phoneNumber: string;
  error?: string;
}

interface UserNotificationResult {
  userId: string;
  userName: string;
  lastActivity: any | null;
  notifications: NotificationResult[];
  successCount: number;
  totalRecipients: number;
}

interface Activity {
  timestamp: Timestamp;
  location: { lat: number; lng: number };
  motionStatus: string;
}

interface Recipient {
  id: string;
  name: string;
  phoneNumber: string;
  userId: string;
  email: string;
  relationship: string;
}

// Helper functions
/**
 * Determines which users are inactive based on their activity history
 * @param thresholdMs - Time in milliseconds after which a user is considered inactive
 * @returns Array of inactive user documents
 */
async function getInactiveUsers(thresholdMs: number) {
  const now = Timestamp.now();
  const activitySnapshot = await db.collection("userActivity").get();

  // List of motion statuses that indicate user is active
  const ACTIVE_MOTION_STATUSES = ["walking", "running", "moving", "unknown"];

  /**
   * Checks if recent activities show any active motion
   * @param activities - List of recent user activities
   * @returns boolean indicating if user has shown recent active motion
   */
  const hasRecentActiveMotion = (activities: Activity[]) => {
    const recentActivities = activities.slice(0, 3);
    return recentActivities.some((activity: Activity) =>
      ACTIVE_MOTION_STATUSES.includes(activity.motionStatus?.toLowerCase())
    );
  };

  return activitySnapshot.docs.filter((doc) => {
    const data = doc.data();
    const activities = data?.activities || [];
    const lastActiveState = data?.lastActiveState;

    // Case 1: No activity data at all - user is inactive
    if (activities.length === 0 && !lastActiveState) {
      return true;
    }

    // Case 2: Check lastActiveState if available (preferred method)
    if (lastActiveState) {
      const timeSinceLastActive =
        now.toMillis() - lastActiveState.timestamp.toMillis();
      return timeSinceLastActive > thresholdMs;
    }

    // Case 3: Fallback to checking activities array
    const lastActivity = activities[0];
    if (!lastActivity) return true;

    const timeSinceLastActivity =
      now.toMillis() - lastActivity.timestamp.toMillis();

    // If time since last activity exceeds threshold, check recent motion patterns
    if (timeSinceLastActivity > thresholdMs) {
      return !hasRecentActiveMotion(activities);
    }

    return false;
  });
}

async function sendNotification(
  recipient: any,
  message: string,
  lastActivityTimestamp: Timestamp | null
): Promise<NotificationResult> {
  try {
    const recipientRef = db.collection("recipients").doc(recipient.id);
    const recipientDoc = await recipientRef.get();
    const recipientData = recipientDoc.data();

    // Check if already notified for current activity timestamp
    if (
      lastActivityTimestamp &&
      recipientData?.lastNotifiedActivityTimestamp &&
      lastActivityTimestamp.isEqual(recipientData.lastNotifiedActivityTimestamp)
    ) {
      return {
        recipientId: recipient.id,
        status: "skipped",
        phoneNumber: recipient.phoneNumber,
        error: "Already notified for this activity timestamp",
      };
    }

    await twilioClient.messages.create({
      body: message,
      to: recipient.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    // Update the last notified activity timestamp
    await recipientRef.update({
      lastNotifiedActivityTimestamp: lastActivityTimestamp,
    });

    return {
      recipientId: recipient.id,
      status: "success",
      phoneNumber: recipient.phoneNumber,
    };
  } catch (error: any) {
    console.error(`Failed to send SMS to ${recipient.phoneNumber}:`, error);
    return {
      recipientId: recipient.id,
      status: "failed",
      phoneNumber: recipient.phoneNumber,
      error: error.message,
    };
  }
}

async function processInactiveUser(
  activityDoc: any
): Promise<UserNotificationResult> {
  const userId = activityDoc.id;
  const data = activityDoc.data();
  const activities = data?.activities || [];
  const lastActivity = activities[0];
  const lastActiveState = data?.lastActiveState;

  // Fetch user data and recipients in parallel
  const [user, recipientsSnapshot] = await Promise.all([
    auth.getUser(userId),
    db.collection("recipients").where("userId", "==", userId).get(),
  ]);

  const userName = user.displayName || "User";

  if (recipientsSnapshot.empty) {
    return {
      userId,
      userName,
      lastActivity: lastActivity || null,
      notifications: [],
      successCount: 0,
      totalRecipients: 0,
    };
  }

  // Use lastActiveState timestamp if available, otherwise fallback to lastActivity
  const activityToUse = lastActiveState || lastActivity;
  const timestamp = activityToUse?.timestamp || null;
  const location = activityToUse?.location || null;

  const notifications = await Promise.all(
    recipientsSnapshot.docs.map((doc) => {
      const recipientData: Recipient = {
        id: doc.id,
        ...doc.data(),
      } as Recipient;
      const message = formatInactivityMessage(
        userName,
        timestamp,
        location,
        recipientData.name
      );
      return sendNotification(recipientData, message, timestamp);
    })
  );

  return {
    userId,
    userName,
    lastActivity: activityToUse || null,
    notifications,
    successCount: notifications.filter((n) => n.status === "success").length,
    totalRecipients: notifications.length,
  };
}

function calculateTotals(results: UserNotificationResult[]) {
  return results.reduce(
    (acc, result) => ({
      totalNotifications: acc.totalNotifications + result.totalRecipients,
      totalSuccessful: acc.totalSuccessful + result.successCount,
    }),
    { totalNotifications: 0, totalSuccessful: 0 }
  );
}

// Main endpoint handler
export async function GET() {
  try {
    const thresholdHours = Number(process.env.INACTIVITY_THRESHOLD_HOURS) || 4;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    console.log("Threshold hours:", thresholdHours);
    // Get inactive users
    const inactiveUsers = await getInactiveUsers(thresholdMs);

    if (inactiveUsers.length === 0) {
      return NextResponse.json({
        message: "No inactive users found",
        status: "success",
      });
    }

    // Process all inactive users in parallel
    const notificationResults = await Promise.all(
      inactiveUsers.map(processInactiveUser)
    );

    // Calculate totals
    const { totalNotifications, totalSuccessful } =
      calculateTotals(notificationResults);

    return NextResponse.json({
      message: `Processed ${inactiveUsers.length} inactive users. Successfully sent ${totalSuccessful} out of ${totalNotifications} notifications.`,
      results: notificationResults,
    });
  } catch (error: any) {
    console.error("Check activity error:", error);
    return NextResponse.json(
      { error: "Failed to check activity" },
      { status: error.message?.includes("auth") ? 401 : 500 }
    );
  }
}
