import { AuthError, verifySession } from "@/middleware/auth";
import { NextResponse } from "next/server";
import { db } from "../../lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const decodedToken = await verifySession(request);

    const recipientsSnapshot = await db
      .collection("recipients")
      .where("userId", "==", decodedToken.uid)
      .get();

    const recipients = recipientsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(recipients);
  } catch (error: any) {
    console.error("Get recipients error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log("Creating recipient...");
    const decodedToken = await verifySession(request);
    const data = await request.json();
    console.log("Recipient data:", data);

    // Validate required fields
    const requiredFields = ["name", "phoneNumber"];
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const recipientData = {
      ...data,
      email: data.email || "",
      relationship: data.relationship || "",
      userId: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection("recipients").add(recipientData);
    console.log("Recipient created with ID:", docRef.id);

    return NextResponse.json(
      {
        id: docRef.id,
        ...recipientData,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create recipient error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to create recipient" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const decodedToken = await verifySession(request);
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get("id");

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient ID is required" },
        { status: 400 }
      );
    }

    // Verify the recipient belongs to the user before deleting
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

    if (recipientDoc.data()?.userId !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Unauthorized to delete this recipient" },
        { status: 403 }
      );
    }

    await db.collection("recipients").doc(recipientId).delete();

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
