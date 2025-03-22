import { AuthError, verifySession } from "@/middleware/auth";
import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase-admin";

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch recipient" },
      { status: 500 }
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to update recipient" },
      { status: 500 }
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete recipient" },
      { status: 500 }
    );
  }
}
