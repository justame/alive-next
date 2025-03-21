import * as admin from "firebase-admin";
import { getApps } from "firebase-admin/app";

const serviceAccount = require("../firebase-credentials.json");

if (!getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
