import { NextResponse } from "next/server";
import { auth } from "../../../lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    // Create a custom token that expires in 1 year
    const customToken = await auth.createCustomToken(decodedToken.uid, {
      expiresIn: "1y",
      claims: {
        email: decodedToken.email,
      },
    });

    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
