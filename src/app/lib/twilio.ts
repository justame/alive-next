import { Timestamp } from "firebase-admin/firestore";
import twilio from "twilio";

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error("Missing Twilio credentials");
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export function formatInactivityMessage(
  userName: string,
  timestamp: Timestamp | null,
  location: any | null,
  recipientName: string
): string {
  const timeString = timestamp
    ? new Date(timestamp.toMillis()).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    : "unknown time";

  const locationString = location
    ? `Last location: ${location.lat}, ${location.lng}`
    : "";

  return `${recipientName}: ${userName} inactive for 24+ hrs. Last seen ${timeString}. ${locationString} Please check on them. -Alive System`;
}
