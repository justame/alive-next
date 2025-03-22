import { verifySession } from "@/middleware/auth";
import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "../../../../lib/firebase-admin";
import { twilioClient } from "../../../../lib/twilio";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const decodedToken = await verifySession(request);
    const userId = decodedToken.uid;

    const { recipientId } = await params;

    // Verify recipient exists and belongs to user
    const recipientRef = db.collection("recipients").doc(recipientId);
    const recipientDoc = await recipientRef.get();

    if (!recipientDoc.exists) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Get user's name
    const user = await auth.getUser(userId);
    const userName = user.displayName || "Someone";

    // Send informative message about the service
    const message = `Important: ${recipientData.name}, you've been designated as an emergency contact by ${userName} on the Alive safety app. Here's what this means:

1. You'll receive alerts if ${userName} becomes inactive for an extended period
2. These alerts will include their last known location
3. This helps ensure ${userName}'s safety with your help

No action needed from you now. You'll only receive messages if needed. Reply STOP to opt out.`;

    await twilioClient.messages.create({
      body: message,
      to: recipientData.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    // Update recipient to mark explanation message as sent
    await recipientRef.update({
      explanationMessageSent: true,
      explanationMessageSentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Service explanation sent successfully",
      recipient: {
        id: recipientDoc.id,
        ...recipientData,
        explanationMessageSent: true,
        explanationMessageSentAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Send explanation message error:", error);
    return NextResponse.json(
      { error: "Failed to send explanation message" },
      { status: error.message?.includes("auth") ? 401 : 500 }
    );
  }
}
