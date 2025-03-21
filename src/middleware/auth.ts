import { auth } from "@/app/lib/firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export async function verifySession(
  request: Request | NextRequest
): Promise<DecodedIdToken> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid authorization header");
  }

  const sessionToken = authHeader.split("Bearer ")[1];
  try {
    return await auth.verifyIdToken(sessionToken);
  } catch (error) {
    throw new AuthError("Invalid session token");
  }
}
