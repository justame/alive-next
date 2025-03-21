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
  timestamp: string | null,
  location: any | null,
  recipientName: string
): string {
  const timeString = timestamp
    ? new Date(timestamp).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    : "an unknown time";

  const locationString = location
    ? `Their last known location was near ${location.lat}, ${location.lng}.`
    : "";

  return `Dear ${recipientName},

We wanted to inform you that ${userName} hasn't shown any activity in our system for over 24 hours. Their last activity was recorded on ${timeString}. ${locationString}

Please take a moment to check on their well-being. You're receiving this message because you're listed as their emergency contact.

If you've already confirmed their safety, you can disregard this message. If you have any concerns, please reach out to ${userName} directly or contact emergency services if necessary.

This is an automated message from the Alive monitoring system.`;
}
