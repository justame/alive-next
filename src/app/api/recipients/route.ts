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
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: error.message?.includes("auth") ? 401 : 500 }
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
    const requiredFields = ["name", "phoneNumber", "email", "relationship"];
    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const recipientData = {
      ...data,
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
    return NextResponse.json(
      { error: "Failed to create recipient" },
      { status: error.message?.includes("authorization") ? 401 : 500 }
    );
  }
}
