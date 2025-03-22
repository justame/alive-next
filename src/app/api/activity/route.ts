import { NextResponse } from "next/server";
import { auth, db } from "../../lib/firebase-admin";

// Middleware to verify session token
async function verifySession(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const sessionToken = authHeader.split("Bearer ")[1];
  return await auth.verifyIdToken(sessionToken);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Sets duration to 60 seconds

export async function GET(request: Request) {
  try {
    const decodedToken = await verifySession(request);

    const activityDoc = await db
      .collection("userActivity")
      .doc(decodedToken.uid)
      .get();
    const activities = activityDoc.exists
      ? activityDoc.data()?.activities || []
      : [];

    return NextResponse.json(activities);
  } catch (error: any) {
    console.error("Get activities error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: error.message?.includes("authorization") ? 401 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const decodedToken = await verifySession(request);
    const data = await request.json();

    // Validate required fields
    const requiredFields = ["location", "motionStatus"];
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Parse location string to coordinates
    let coordinates;
    try {
      const [lat, lng] = data.location.split(",").map(Number);
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates");
      }
      coordinates = { lat, lng };
    } catch (e) {
      return NextResponse.json(
        {
          error:
            'Invalid location format. Expected format: "latitude,longitude"',
        },
        { status: 400 }
      );
    }

    const newActivity = {
      location: coordinates,
      motionStatus: data.motionStatus,
      timestamp: new Date().toISOString(),
    };

    // Get current activities and add the new one
    const activityRef = db.collection("userActivity").doc(decodedToken.uid);
    const activityDoc = await activityRef.get();

    let activities = activityDoc.exists
      ? activityDoc.data()?.activities || []
      : [];
    activities = [newActivity, ...activities].slice(0, 10); // Keep only last 10 activities

    // Check if this is an active motion status
    const activeStatuses = ["walking", "running", "moving", "unknown"];
    const isActiveMotion = activeStatuses.includes(
      data.motionStatus.toLowerCase()
    );

    // Prepare update data
    const updateData: any = { activities };

    // If this is an active motion, update lastActiveState
    if (isActiveMotion) {
      updateData.lastActiveState = newActivity;
    }

    // Update user's activities in Firestore
    await activityRef.set(updateData, { merge: true });

    return NextResponse.json(newActivity);
  } catch (error: any) {
    console.error("Update activity error:", error);

    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: error.message?.includes("authorization") ? 401 : 500 }
    );
  }
}
