import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomInt, createHash } from "crypto";

initializeApp();
const db: Firestore = getFirestore();
const opts = { enforceAppCheck: process.env.ENFORCE_APPCHECK === "true", region: "us-central1" };

// ---------- helpers ----------
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alike chars
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const SUPPORTED_COMMANDS = ["location.refresh", "permissions.check", "sync.now", "rules.sync"]; // = CommandTypes.kt
const PAIR_TTL_MS = 10 * 60_000;

function uid(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  return req.auth.uid;
}
async function requireMember(familyId: string, u: string) {
  const f = await db.doc(`families/${familyId}`).get();
  if (!f.exists || !(f.data()!.members as string[]).includes(u)) throw new HttpsError("permission-denied", "Not a family member");
  return f.data()!;
}
async function rateLimit(key: string, max: number, windowMs: number) {
  const ref = db.doc(`rateLimits/${key}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const now = Date.now();
    const d = s.data();
    if (d && now - d.start < windowMs) {
      if (d.count >= max) throw new HttpsError("resource-exhausted", "Too many attempts, try later");
      t.update(ref, { count: d.count + 1 });
    } else t.set(ref, { start: now, count: 1 });
  });
}
async function audit(familyId: string, type: string, by: string, extra: object = {}) {
  await db.collection(`families/${familyId}/auditEvents`).add({ type, by, at: FieldValue.serverTimestamp(), ...extra });
}
/** Creates the alert once per dedupeKey (prevents notification storms). */
async function raiseAlert(familyId: string, deviceId: string, type: string, title: string, body: string, dedupeKey: string) {
  const ref = db.doc(`families/${familyId}/alerts/${sha(dedupeKey).slice(0, 32)}`);
  try {
    await ref.create({ deviceId, type, title, body, read: false, createdAt: FieldValue.serverTimestamp() });
  } catch (e: any) { if (e.code !== 6 /* ALREADY_EXISTS */) throw e; }
}

// ---------- family & pairing ----------
export const ensureFamily = onCall(opts, async (req) => {
  const u = uid(req);
  const userRef = db.doc(`users/${u}`);
  const us = await userRef.get();
  if (us.exists && us.data()!.familyId) return { familyId: us.data()!.familyId };
  const famRef = db.collection("families").doc();
  await famRef.set({ name: (req.data?.name as string)?.slice(0, 60) || "Family", ownerUid: u, members: [u], createdAt: FieldValue.serverTimestamp(), plan: "free", retentionDays: 30 });
  await userRef.set({ familyId: famRef.id, fcmTokens: [], createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(famRef.id, "family.created", u);
  return { familyId: famRef.id };
});

export const createPairingCode = onCall(opts, async (req) => {
  const u = uid(req);
  const familyId = String(req.data?.familyId);
  await requireMember(familyId, u);
  await rateLimit(`pc_${familyId}`, 10, 10 * 60_000);
  const childName = String(req.data?.childName ?? "").trim().slice(0, 40);
  if (!childName) throw new HttpsError("invalid-argument", "childName required");
  const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const expiresAt = Date.now() + PAIR_TTL_MS;
  await db.doc(`pairingCodes/${sha(code)}`).set({ familyId, childName, createdBy: u, expiresAt, used: false });
  await audit(familyId, "pairing.code_created", u);
  return { code, expiresAt };
});

async function loadCode(code: string) {
  const ref = db.doc(`pairingCodes/${sha(String(code).trim().toUpperCase())}`);
  const s = await ref.get();
  const d = s.data();
  if (!d || d.used || d.expiresAt < Date.now()) throw new HttpsError("not-found", "Invalid or expired code");
  return { ref, d };
}
function requireAnon(req: CallableRequest) {
  const u = uid(req);
  if (req.auth!.token.firebase?.sign_in_provider !== "anonymous") throw new HttpsError("permission-denied", "Child devices sign in anonymously");
  return u;
}

export const previewPairingCode = onCall(opts, async (req) => {
  const u = requireAnon(req);
  await rateLimit(`pv_${u}`, 8, 10 * 60_000);
  const { d } = await loadCode(req.data?.code);
  const fam = (await db.doc(`families/${d.familyId}`).get()).data()!;
  return { familyName: fam.name, childName: d.childName };
});

export const redeemPairingCode = onCall(opts, async (req) => {
  const u = requireAnon(req);
  await rateLimit(`rd_${u}`, 5, 10 * 60_000);
  const { ref, d } = await loadCode(req.data?.code);
  const devRef = db.collection(`families/${d.familyId}/devices`).doc();
  const info = req.data ?? {};
  await db.runTransaction(async (t) => {
    const fresh = await t.get(ref);
    if (!fresh.exists || fresh.data()!.used) throw new HttpsError("failed-precondition", "Code already used");
    t.update(ref, { used: true, usedAt: FieldValue.serverTimestamp(), usedBy: u });
    t.set(devRef, {
      deviceUid: u, status: "active", childName: d.childName,
      name: String(info.deviceName ?? "Android").slice(0, 40),
      manufacturer: String(info.manufacturer ?? "").slice(0, 40), model: String(info.model ?? "").slice(0, 40),
      sdk: Number(info.sdk) || 0, appVersion: String(info.appVersion ?? "").slice(0, 20),
      pairedAt: FieldValue.serverTimestamp(), settings: { locationIntervalMin: 15 },
    });
  });
  await audit(d.familyId, "device.paired", u, { deviceId: devRef.id });
  return { familyId: d.familyId, deviceId: devRef.id };
});

export const unlinkDevice = onCall(opts, async (req) => {
  const u = uid(req);
  const { familyId, deviceId } = req.data ?? {};
  const ref = db.doc(`families/${familyId}/devices/${deviceId}`);
  const s = await ref.get();
  if (!s.exists) throw new HttpsError("not-found", "Device not found");
  const isDev = s.data()!.deviceUid === u;
  if (!isDev) await requireMember(familyId, u);
  await ref.update({ status: "unlinked", unlinkedAt: FieldValue.serverTimestamp(), unlinkedBy: isDev ? "device" : "parent", fcmToken: FieldValue.delete() });
  await audit(familyId, "device.unlinked", u, { deviceId, by: isDev ? "device" : "parent" });
  if (isDev) await raiseAlert(familyId, deviceId, "device_unlinked", "Device unlinked", `${s.data()!.childName}'s device was unlinked from the device itself`, `unlink_${deviceId}_${Date.now()}`);
  return { ok: true };
});

export const updateRules = onCall(opts, async (req) => {
  const u = uid(req);
  const { familyId, deviceId, rules } = req.data ?? {};
  await requireMember(familyId, u);
  const devRef = db.doc(`families/${familyId}/devices/${deviceId}`);
  const dev = (await devRef.get()).data();
  if (!dev || dev.status !== "active") throw new HttpsError("not-found", "Device not active");

  const rulesRef = db.doc(`families/${familyId}/devices/${deviceId}/rules/current`);
  await rulesRef.set({
    blockedPackages: rules?.blockedPackages ?? [],
    bedtimeStart: rules?.bedtimeStart ?? null,
    bedtimeEnd: rules?.bedtimeEnd ?? null,
    dailyLimitMin: rules?.dailyLimitMin ?? 0,
    appLimits: rules?.appLimits ?? {},
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: u,
  }, { merge: true });

  await audit(familyId, "rules.updated", u, { deviceId, blockedCount: (rules?.blockedPackages ?? []).length });
  return { ok: true };
});

// ---------- live monitoring sessions ----------
const SUPPORTED_LIVE_TYPES = ["screen", "camera_front", "camera_back", "mic"];

export const requestLiveSession = onCall(opts, async (req) => {
  const u = uid(req);
  const { familyId, deviceId, type } = req.data ?? {};
  await requireMember(familyId, u);
  if (!SUPPORTED_LIVE_TYPES.includes(type)) throw new HttpsError("invalid-argument", `Unsupported live session type: ${type}`);

  const devRef = db.doc(`families/${familyId}/devices/${deviceId}`);
  const dev = (await devRef.get()).data();
  if (!dev || dev.status !== "active") throw new HttpsError("not-found", "Device not active");

  // Check device status: if last seen > 15 mins, warn parent
  const statusDoc = (await devRef.collection("status").doc("current").get()).data();
  const lastSeenMs = (statusDoc?.lastSeen as Timestamp | undefined)?.toMillis() || 0;
  const isOffline = Date.now() - lastSeenMs > 15 * 60_000;
  if (isOffline) {
    throw new HttpsError("unavailable", "Device is currently offline or disconnected. Live sessions require an active connection.");
  }

  // Create session doc
  const sessionRef = devRef.collection("liveSessions").doc();
  await sessionRef.set({
    type,
    status: "requested",
    requestedBy: u,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit(familyId, "live_session.requested", u, { deviceId, sessionId: sessionRef.id, type });

  // Send push notification to child device
  if (dev.fcmToken) {
    try {
      await getMessaging().send({
        token: dev.fcmToken,
        android: { priority: "high" },
        data: {
          kind: "live_session_request",
          familyId,
          deviceId,
          sessionId: sessionRef.id,
          type,
        },
      });
    } catch (e: any) {
      await sessionRef.update({
        status: "failed",
        failureReason: `Push notification failed: ${e.message}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError("internal", `Could not reach child device: ${e.message}`);
    }
  } else {
    await sessionRef.update({
      status: "failed",
      failureReason: "Device has no active push token",
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw new HttpsError("failed-precondition", "Child device has no active push token registered");
  }

  return { sessionId: sessionRef.id, type, status: "requested" };
});

export const stopLiveSession = onCall(opts, async (req) => {
  const u = uid(req);
  const { familyId, deviceId, sessionId, reason } = req.data ?? {};
  const devRef = db.doc(`families/${familyId}/devices/${deviceId}`);
  const devSnap = await devRef.get();
  if (!devSnap.exists) throw new HttpsError("not-found", "Device not found");
  const isDev = devSnap.data()!.deviceUid === u;
  if (!isDev) await requireMember(familyId, u);

  const sessionRef = devRef.collection("liveSessions").doc(sessionId);
  const sessSnap = await sessionRef.get();
  if (!sessSnap.exists) throw new HttpsError("not-found", "Session not found");

  await sessionRef.update({
    status: "stopped",
    endedAt: FieldValue.serverTimestamp(),
    failureReason: reason || (isDev ? "Stopped by child" : "Stopped by parent"),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await audit(familyId, "live_session.stopped", u, { deviceId, sessionId, by: isDev ? "child" : "parent" });

  // Send stop push to child device if stopped by parent
  if (!isDev && devSnap.data()?.fcmToken) {
    try {
      await getMessaging().send({
        token: devSnap.data()!.fcmToken,
        android: { priority: "high" },
        data: {
          kind: "live_session_stop",
          familyId,
          deviceId,
          sessionId,
        },
      });
    } catch (_) {}
  }

  return { ok: true };
});

// ---------- commands ----------
export const sendCommand = onCall(opts, async (req) => {
  const u = uid(req);
  const { familyId, deviceId, type, payload } = req.data ?? {};
  await requireMember(familyId, u);                                              // 1-2: identity + membership
  if (!SUPPORTED_COMMANDS.includes(type)) throw new HttpsError("failed-precondition", `Command not supported: ${type}`); // 3-4
  const devRef = db.doc(`families/${familyId}/devices/${deviceId}`);
  const dev = (await devRef.get()).data();
  if (!dev || dev.status !== "active") throw new HttpsError("not-found", "Device not active");
  // dedupe: same pending command within 30s
  const recent = await db.collection(`${devRef.path}/commands`).where("type", "==", type).where("createdAt", ">", Timestamp.fromMillis(Date.now() - 30_000)).limit(1).get();
  if (!recent.empty) return { commandId: recent.docs[0].id, deduped: true };
  const cmdRef = db.collection(`${devRef.path}/commands`).doc();
  await cmdRef.set({ type, payload: payload ?? {}, status: "sent", createdBy: u, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await audit(familyId, "command.sent", u, { deviceId, type });
  if (!dev.fcmToken) {
    await cmdRef.update({ status: "failed", result: "Device has no push token yet (open the child app once)", updatedAt: FieldValue.serverTimestamp() });
    return { commandId: cmdRef.id, status: "failed" };
  }
  try {
    await getMessaging().send({ token: dev.fcmToken, android: { priority: "high" }, data: { kind: "command", familyId, deviceId, commandId: cmdRef.id } });
  } catch (e: any) {
    await cmdRef.update({ status: "failed", result: `Push failed: ${e.code ?? e.message}`, updatedAt: FieldValue.serverTimestamp() });
    if (String(e.code).includes("registration-token-not-registered")) await devRef.update({ fcmToken: FieldValue.delete() });
  }
  return { commandId: cmdRef.id };
});

// ---------- alerts -> parent push ----------
export const onAlertCreated = onDocumentCreated({ document: "families/{fid}/alerts/{aid}", region: opts.region }, async (ev) => {
  const a = ev.data?.data(); if (!a) return;
  const fam = (await db.doc(`families/${ev.params.fid}`).get()).data(); if (!fam) return;
  for (const memberUid of fam.members as string[]) {
    const ref = db.doc(`users/${memberUid}`);
    const tokens: string[] = ((await ref.get()).data()?.fcmTokens) ?? [];
    for (const token of tokens) {
      try {
        await getMessaging().send({ token, android: { priority: "high" }, data: { kind: "alert", title: String(a.title), body: String(a.body), alertId: ev.params.aid } });
      } catch (e: any) {
        if (String(e.code).includes("registration-token-not-registered") || String(e.code).includes("invalid-argument"))
          await ref.update({ fcmTokens: FieldValue.arrayRemove(token) });
      }
    }
  }
});

// ---------- permission revoked ----------
export const onPermissionsWritten = onDocumentWritten({ document: "families/{fid}/devices/{did}/permissions/current", region: opts.region }, async (ev) => {
  const before = ev.data?.before.data()?.items ?? {}; const after = ev.data?.after.data()?.items;
  if (!after) return;
  const dev = (await db.doc(`families/${ev.params.fid}/devices/${ev.params.did}`).get()).data();
  for (const k of Object.keys(after)) {
    const was = before[k]?.state, now = after[k].state;
    if (was === "GRANTED" && now !== "GRANTED")
      await raiseAlert(ev.params.fid, ev.params.did, "permission_revoked", "Permission lost", `${dev?.childName ?? "Child"}: ${k} is no longer enabled`, `perm_${ev.params.did}_${k}_${Math.floor(Date.now() / 3_600_000)}`);
  }
});

// ---------- geofences (server-side, with hysteresis) ----------
const toRad = (x: number) => (x * Math.PI) / 180;
function distM(a: number, b: number, c: number, d: number) {
  const R = 6371000, dLat = toRad(c - a), dLng = toRad(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const onLocationCreated = onDocumentCreated({ document: "families/{fid}/devices/{did}/locations/{id}", region: opts.region }, async (ev) => {
  const loc = ev.data?.data(); if (!loc) return;
  if ((loc.accuracy ?? 9999) > 150) return;                        // too imprecise to decide
  const { fid, did } = ev.params;
  const geos = await db.collection(`families/${fid}/geofences`).where("deviceId", "==", did).get();
  const dev = (await db.doc(`families/${fid}/devices/${did}`).get()).data();
  for (const g of geos.docs) {
    const gd = g.data(); if (gd.enabled === false) continue;
    const dist = distM(loc.lat, loc.lng, gd.lat, gd.lng);
    const stRef = db.doc(`families/${fid}/geofenceState/${g.id}`);
    const prev = (await stRef.get()).data()?.inside as boolean | undefined;
    let inside = prev;
    if (dist <= gd.radius) inside = true; else if (dist > gd.radius + 40) inside = false; // 40 m hysteresis buffer vs GPS jitter
    if (inside === undefined || inside === prev) { if (prev === undefined && inside !== undefined) await stRef.set({ inside }); continue; }
    await stRef.set({ inside, at: FieldValue.serverTimestamp() });
    if (prev === undefined) continue;                              // first fix: record only
    const wantsEnter = gd.notifyEnter !== false, wantsExit = gd.notifyExit !== false;
    if (inside && wantsEnter) await raiseAlert(fid, did, "geofence_enter", gd.name, `${dev?.childName ?? "Child"} arrived at ${gd.name}`, `geo_${g.id}_in_${Math.floor(Date.now() / 600_000)}`);
    if (!inside && wantsExit) await raiseAlert(fid, did, "geofence_exit", gd.name, `${dev?.childName ?? "Child"} left ${gd.name}`, `geo_${g.id}_out_${Math.floor(Date.now() / 600_000)}`);
  }
});

// ---------- scheduled: offline detection & retention ----------
export const checkOfflineDevices = onSchedule({ schedule: "every 15 minutes", region: opts.region }, async () => {
  const cutoff = Date.now() - 45 * 60_000;
  const devs = await db.collectionGroup("devices").where("status", "==", "active").get();
  for (const d of devs.docs) {
    const st = (await d.ref.collection("status").doc("current").get()).data();
    const seen = (st?.lastSeen as Timestamp | undefined)?.toMillis();
    if (seen && seen < cutoff) {
      const fid = d.ref.parent.parent!.id;
      await raiseAlert(fid, d.id, "device_offline", "Device offline", `${d.data().childName}'s device has not connected since ${new Date(seen).toISOString()}`, `off_${d.id}_${seen}`);
    }
  }
});

export const retentionCleanup = onSchedule({ schedule: "every day 03:00", region: opts.region }, async () => {
  const fams = await db.collection("families").get();
  for (const f of fams.docs) {
    const days = f.data().retentionDays ?? 30;
    const cutoff = Timestamp.fromMillis(Date.now() - days * 86_400_000);
    const devs = await db.collection(`families/${f.id}/devices`).get();
    for (const d of devs.docs) {
      for (;;) {
        const old = await d.ref.collection("locations").where("serverTime", "<", cutoff).limit(400).get();
        if (old.empty) break;
        const b = db.batch(); old.docs.forEach((x) => b.delete(x.ref)); await b.commit();
      }
    }
  }
});
