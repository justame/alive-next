import { createActivitySchema } from "@/dtos/activity/activity.dto";
import { AuthError, verifySession } from "@/middleware/auth";
import { ActivityService } from "@/services/activity.service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const activityService = new ActivityService(db);

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await verifySession(request);
    const activities = await activityService.getActivities(decodedToken.uid);
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Get activities error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifySession(request);
    const data = await request.json();

    const validatedData = createActivitySchema.parse(data);
    const newActivity = await activityService.createActivity(
      decodedToken.uid,
      validatedData
    );

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    console.error("Update activity error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}
