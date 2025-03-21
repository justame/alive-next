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

    const activityData = {
      userId: decodedToken.uid,
      location: coordinates,
      motionStatus: data.motionStatus,
      timestamp: new Date().toISOString(),
    };

    // Update user's activity in Firestore
    await db.collection("userActivity").doc(decodedToken.uid).set(activityData);

    return NextResponse.json(activityData);
  } catch (error: any) {
    console.error("Update activity error:", error);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: error.message?.includes("authorization") ? 401 : 500 }
    );
  }
}
