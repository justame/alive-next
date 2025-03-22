import { NextResponse } from "next/server";
import { auth, db } from "../../../lib/firebase-admin";

// Middleware to verify session token
async function verifySession(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const sessionToken = authHeader.split("Bearer ")[1];
  return await auth.verifyIdToken(sessionToken);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const decodedToken = await verifySession(request);
    const { recipientId } = await params;
    const recipientDoc = await db
      .collection("recipients")
      .doc(recipientId)
      .get();

    if (!recipientDoc.exists) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: recipientDoc.id,
      ...recipientData,
    });
  } catch (error: any) {
    console.error("Get recipient error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipient" },
      { status: error.message?.includes("auth") ? 401 : 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const decodedToken = await verifySession(request);
    const { recipientId } = await params;
    const data = await request.json();
    const recipientRef = db.collection("recipients").doc(recipientId);
    const recipientDoc = await recipientRef.get();

    if (!recipientDoc.exists) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await recipientRef.update(updateData);

    return NextResponse.json({
      id: recipientDoc.id,
      ...recipientData,
      ...updateData,
    });
  } catch (error: any) {
    console.error("Update recipient error:", error);
    return NextResponse.json(
      { error: "Failed to update recipient" },
      { status: error.message?.includes("auth") ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const decodedToken = await verifySession(request);
    const { recipientId } = await params;
    const recipientRef = db.collection("recipients").doc(recipientId);
    const recipientDoc = await recipientRef.get();

    if (!recipientDoc.exists) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    await recipientRef.delete();

    return NextResponse.json({ message: "Recipient deleted successfully" });
  } catch (error: any) {
    console.error("Delete recipient error:", error);
    return NextResponse.json(
      { error: "Failed to delete recipient" },
      { status: error.message?.includes("auth") ? 401 : 500 }
    );
  }
}
