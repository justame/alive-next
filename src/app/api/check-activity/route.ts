import { auth, db } from "@/app/lib/firebase-admin";
import { formatInactivityMessage, twilioClient } from "@/app/lib/twilio";
import { NextResponse } from "next/server";

// Middleware to verify session token
async function verifySession(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const sessionToken = authHeader.split("Bearer ")[1];
  return await auth.verifyIdToken(sessionToken);
}

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

// Helper functions
async function getInactiveUsers(thresholdMs: number) {
  const now = new Date();
  const activitySnapshot = await db.collection("userActivity").get();

  return activitySnapshot.docs.filter((doc) => {
    const activities = doc.data()?.activities || [];
    const lastActivity = activities[0];
    const lastActivityTime = lastActivity
      ? new Date(lastActivity.timestamp)
      : null;

    return (
      !lastActivityTime ||
      now.getTime() - lastActivityTime.getTime() > thresholdMs
    );
  });
}

async function sendNotification(
  recipient: any,
  message: string
): Promise<NotificationResult> {
  try {
    const now = new Date();
    const recipientRef = db.collection("recipients").doc(recipient.id);
    const recipientDoc = await recipientRef.get();
    const recipientData = recipientDoc.data();

    // Check if already notified for current inactivity period
    if (recipientData?.notifiedForCurrentInactivity) {
      return {
        recipientId: recipient.id,
        status: "skipped",
        phoneNumber: recipient.phoneNumber,
        error: "Already notified for this inactivity period",
      };
    }

    await twilioClient.messages.create({
      body: message,
      to: recipient.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    // Mark as notified for this inactivity period
    await recipientRef.update({
      notifiedForCurrentInactivity: true,
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
  const activities = activityDoc.data()?.activities || [];
  const lastActivity = activities[0];

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

  const notifications = await Promise.all(
    recipientsSnapshot.docs.map((doc) => {
      const recipientData = doc.data();
      const message = formatInactivityMessage(
        userName,
        lastActivity?.timestamp || null,
        lastActivity?.location || null,
        recipientData.name
      );
      return sendNotification(recipientData, message);
    })
  );

  return {
    userId,
    userName,
    lastActivity: lastActivity || null,
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
export async function POST(request: Request) {
  try {
    await verifySession(request);

    const thresholdHours = Number(process.env.INACTIVITY_THRESHOLD_HOURS) || 18;
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
      { status: error.message?.includes("authorization") ? 401 : 500 }
    );
  }
}
