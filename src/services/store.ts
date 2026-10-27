import { 
  Family, 
  Device, 
  LocationRecord, 
  Geofence, 
  DailyUsage, 
  CommandItem, 
  AlertItem, 
  PairingCode, 
  PermId, 
  PermissionState,
  ConnectionStatus,
  CommandType,
  LiveSession,
  LiveSessionType,
  LiveSessionStatus
} from '../types/aman';

// Hysteresis distance helper in meters using Haversine formula (from functions/src/index.ts)
const toRad = (x: number) => (x * Math.PI) / 180;
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function getConnectionStatus(lastSeen?: number): ConnectionStatus {
  if (!lastSeen) return 'UNKNOWN';
  const diff = Date.now() - lastSeen;
  const fifteenMinutes = 15 * 60 * 1000;
  const fortyFiveMinutes = 45 * 60 * 1000;

  if (diff < fifteenMinutes) return 'ONLINE';
  if (diff < fortyFiveMinutes) return 'STALE';
  return 'OFFLINE';
}

const STORAGE_KEY = 'amanguard_state_v1';

// Preset locations for quick testing (in Riyadh, Saudi Arabia as sample high-tech Arab city)
export const PRESET_LOCATIONS = [
  { nameAr: "المنزل (حي الياسمين)", nameEn: "Home (Al Yasmin)", lat: 24.8142, lng: 46.6508 },
  { nameAr: "مدرسة الأجيال الأهلية", nameEn: "Al Ajyal School", lat: 24.8256, lng: 46.6612 },
  { nameAr: "حديقة الحي العامة", nameEn: "Public Community Park", lat: 24.8091, lng: 46.6430 },
  { nameAr: "النادي الرياضي والفروسية", nameEn: "Sports Club", lat: 24.8320, lng: 46.6380 },
  { nameAr: "الرياض بارك مول", nameEn: "Riyadh Park Mall", lat: 24.7570, lng: 46.6300 },
];

import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  deleteDoc,
  User 
} from './firebase';

export interface AmanState {
  family: Family;
  devices: Device[];
  locations: Record<string, LocationRecord[]>; // deviceId -> LocationRecord[]
  geofences: Geofence[];
  geofenceState: Record<string, boolean>; // geofenceId -> isInside
  usage: Record<string, DailyUsage[]>; // deviceId -> DailyUsage[]
  commands: CommandItem[];
  alerts: AlertItem[];
  pairingCodes: PairingCode[];
  activeChildDeviceId: string | null;
  liveSessions: LiveSession[];
  isLiveCloud: boolean;
  cloudSyncStatus: 'idle' | 'connecting' | 'connected' | 'error';
  cloudUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null;
  cloudFamilyId?: string | null;
}

const INITIAL_STATE: AmanState = {
  family: {
    id: "fam_riyadh_101",
    name: "عائلة المنصور",
    ownerUid: "parent_usr_01",
    members: ["parent_usr_01", "parent_usr_02"],
    retentionDays: 30,
    createdAt: Date.now() - 30 * 24 * 3600 * 1000,
  },
  devices: [
    {
      id: "dev_ahmed_s23",
      familyId: "fam_riyadh_101",
      childName: "أحمد",
      name: "Samsung Galaxy S23 (أحمد)",
      avatarColor: "emerald",
      status: "active",
      deviceUid: "child_uid_ahmed",
      fcmToken: "fcm_token_ahmed_sample_xyz",
      createdAt: Date.now() - 14 * 24 * 3600 * 1000,
      settings: { locationIntervalMin: 15 },
      deviceStatus: {
        lastSeen: Date.now() - 4 * 60 * 1000, // 4 mins ago (ONLINE)
        battery: 84,
        isCharging: false,
        networkType: "Cellular 5G",
        appVersion: "1.2.0",
        osVersion: "Android 14 (API 34)",
        deviceModel: "SM-S911B",
        manufacturer: "Samsung",
      },
      currentPermissions: {
        location_fine: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        location_background: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        location_services: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        notifications: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        usage_access: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        battery_opt: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        camera: { state: "GRANTED", checkedAt: Date.now() - 10000 },
        microphone: { state: "GRANTED", checkedAt: Date.now() - 10000 },
      },
      lastLocation: {
        id: "loc_ahmed_01",
        lat: 24.8256,
        lng: 46.6612,
        accuracy: 12,
        provider: "fused",
        source: "periodic",
        deviceTime: Date.now() - 4 * 60 * 1000,
        serverTime: Date.now() - 4 * 60 * 1000,
        addressLabel: "مدرسة الأجيال الأهلية، حي الياسمين",
      }
    },
    {
      id: "dev_sara_redmi",
      familyId: "fam_riyadh_101",
      childName: "سارة",
      name: "Xiaomi Redmi Note 12 (سارة)",
      avatarColor: "sky",
      status: "active",
      deviceUid: "child_uid_sara",
      fcmToken: "fcm_token_sara_sample_abc",
      createdAt: Date.now() - 7 * 24 * 3600 * 1000,
      settings: { locationIntervalMin: 15 },
      deviceStatus: {
        lastSeen: Date.now() - 25 * 60 * 1000, // 25 mins ago (STALE)
        battery: 42,
        isCharging: true,
        networkType: "WiFi",
        appVersion: "1.2.0",
        osVersion: "Android 13 (API 33)",
        deviceModel: "Redmi Note 12",
        manufacturer: "Xiaomi",
      },
      currentPermissions: {
        location_fine: { state: "GRANTED", checkedAt: Date.now() - 3600000 },
        location_background: { state: "GRANTED", checkedAt: Date.now() - 3600000 },
        location_services: { state: "GRANTED", checkedAt: Date.now() - 3600000 },
        notifications: { state: "GRANTED", checkedAt: Date.now() - 3600000 },
        usage_access: { state: "NEEDS_MANUAL", checkedAt: Date.now() - 3600000 },
        battery_opt: { state: "GRANTED", checkedAt: Date.now() - 3600000 },
        camera: { state: "NEEDS_MANUAL", checkedAt: Date.now() - 3600000 },
        microphone: { state: "DENIED", checkedAt: Date.now() - 3600000 },
      },
      lastLocation: {
        id: "loc_sara_01",
        lat: 24.8142,
        lng: 46.6508,
        accuracy: 18,
        provider: "fused",
        source: "periodic",
        deviceTime: Date.now() - 25 * 60 * 1000,
        serverTime: Date.now() - 25 * 60 * 1000,
        addressLabel: "المنزل، شارع أنس بن مالك",
      }
    }
  ],
  locations: {
    dev_ahmed_s23: [
      {
        id: "loc_ahmed_01",
        lat: 24.8256,
        lng: 46.6612,
        accuracy: 12,
        provider: "fused",
        source: "periodic",
        deviceTime: Date.now() - 4 * 60 * 1000,
        serverTime: Date.now() - 4 * 60 * 1000,
        addressLabel: "مدرسة الأجيال الأهلية"
      },
      {
        id: "loc_ahmed_02",
        lat: 24.8210,
        lng: 46.6580,
        accuracy: 15,
        provider: "gps",
        source: "periodic",
        deviceTime: Date.now() - 25 * 60 * 1000,
        serverTime: Date.now() - 25 * 60 * 1000,
        addressLabel: "طريق الملك عبد العزيز الفرعي"
      },
      {
        id: "loc_ahmed_03",
        lat: 24.8142,
        lng: 46.6508,
        accuracy: 10,
        provider: "fused",
        source: "periodic",
        deviceTime: Date.now() - 50 * 60 * 1000,
        serverTime: Date.now() - 50 * 60 * 1000,
        addressLabel: "المنزل (حي الياسمين)"
      }
    ],
    dev_sara_redmi: [
      {
        id: "loc_sara_01",
        lat: 24.8142,
        lng: 46.6508,
        accuracy: 18,
        provider: "fused",
        source: "periodic",
        deviceTime: Date.now() - 25 * 60 * 1000,
        serverTime: Date.now() - 25 * 60 * 1000,
        addressLabel: "المنزل"
      }
    ]
  },
  geofences: [
    {
      id: "geo_home",
      deviceId: "dev_ahmed_s23",
      name: "المنزل (حي الياسمين)",
      lat: 24.8142,
      lng: 46.6508,
      radius: 180,
      enabled: true,
      notifyEnter: true,
      notifyExit: true,
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: "geo_school",
      deviceId: "dev_ahmed_s23",
      name: "مدرسة الأجيال الأهلية",
      lat: 24.8256,
      lng: 46.6612,
      radius: 220,
      enabled: true,
      notifyEnter: true,
      notifyExit: true,
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: "geo_sara_home",
      deviceId: "dev_sara_redmi",
      name: "المنزل",
      lat: 24.8142,
      lng: 46.6508,
      radius: 180,
      enabled: true,
      notifyEnter: true,
      notifyExit: true,
      createdAt: Date.now() - 5 * 86400000,
    }
  ],
  geofenceState: {
    geo_home: false,
    geo_school: true,
    geo_sara_home: true,
  },
  usage: {
    dev_ahmed_s23: [
      {
        date: new Date().toISOString().split('T')[0],
        totalSeconds: 168 * 60, // 2h 48m
        apps: [
          { pkg: "com.google.android.youtube", name: "YouTube Kids", category: "entertainment", seconds: 65 * 60 },
          { pkg: "com.roblox.client", name: "Roblox", category: "games", seconds: 52 * 60 },
          { pkg: "com.duolingo", name: "Duolingo", category: "education", seconds: 24 * 60 },
          { pkg: "com.whatsapp", name: "WhatsApp", category: "social", seconds: 17 * 60 },
          { pkg: "com.google.android.apps.books", name: "Google Play Books", category: "education", seconds: 10 * 60 },
        ]
      }
    ],
    dev_sara_redmi: [
      {
        date: new Date().toISOString().split('T')[0],
        totalSeconds: 95 * 60, // 1h 35m
        apps: [
          { pkg: "com.duolingo", name: "Duolingo", category: "education", seconds: 40 * 60 },
          { pkg: "com.google.android.youtube", name: "YouTube Kids", category: "entertainment", seconds: 35 * 60 },
          { pkg: "com.scratch.jr", name: "ScratchJr", category: "education", seconds: 20 * 60 },
        ]
      }
    ]
  },
  commands: [
    {
      id: "cmd_sample_01",
      familyId: "fam_riyadh_101",
      deviceId: "dev_ahmed_s23",
      type: "location.refresh",
      status: "applied",
      result: "تم تحديث الموقع بدقة 12 متر",
      createdBy: "parent_usr_01",
      createdAt: Date.now() - 4 * 60 * 1000,
      updatedAt: Date.now() - 4 * 60 * 1000 + 1200,
    },
    {
      id: "cmd_sample_02",
      familyId: "fam_riyadh_101",
      deviceId: "dev_ahmed_s23",
      type: "permissions.check",
      status: "applied",
      result: "6 من 6 صلاحيات نشطة",
      createdBy: "parent_usr_01",
      createdAt: Date.now() - 25 * 60 * 1000,
      updatedAt: Date.now() - 25 * 60 * 1000 + 800,
    }
  ],
  alerts: [
    {
      id: "alt_geo_school_in",
      familyId: "fam_riyadh_101",
      deviceId: "dev_ahmed_s23",
      childName: "أحمد",
      type: "geofence_enter",
      title: "وصول إلى المنطقة الآمنة",
      body: "أحمد وصل الآن إلى: مدرسة الأجيال الأهلية",
      read: false,
      createdAt: Date.now() - 15 * 60 * 1000,
    },
    {
      id: "alt_geo_home_out",
      familyId: "fam_riyadh_101",
      deviceId: "dev_ahmed_s23",
      childName: "أحمد",
      type: "geofence_exit",
      title: "مغادرة المنطقة الآمنة",
      body: "أحمد غادر منطقة: المنزل (حي الياسمين)",
      read: true,
      createdAt: Date.now() - 45 * 60 * 1000,
    }
  ],
  pairingCodes: [
    {
      code: "AMAN7842",
      familyId: "fam_riyadh_101",
      familyName: "عائلة المنصور",
      childName: "عمر",
      createdAt: Date.now() - 2 * 60 * 1000,
      expiresAt: Date.now() + 8 * 60 * 1000,
      used: false,
    }
  ],
  activeChildDeviceId: "dev_ahmed_s23",
  liveSessions: [
    {
      id: "live_session_init_01",
      familyId: "fam_riyadh_101",
      deviceId: "dev_ahmed_s23",
      parentId: "parent_usr_01",
      childId: "child_uid_ahmed",
      type: "screen",
      status: "ended",
      createdAt: Date.now() - 3600 * 1000,
      startedAt: Date.now() - 3590 * 1000,
      endedAt: Date.now() - 3400 * 1000,
      requestedBy: "ولي الأمر",
      quality: "720p @ 30fps",
      endReason: "stopped_by_parent"
    }
  ],
  isLiveCloud: false,
  cloudSyncStatus: 'idle',
  cloudUser: null,
  cloudFamilyId: null,
};

class AmanStore {
  private state: AmanState;
  private listeners: Set<(state: AmanState) => void> = new Set();
  private cloudUnsubscribers: (() => void)[] = [];

  constructor() {
    this.state = this.loadState();
    
    // Listen to Firebase Auth state
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.state.cloudUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'ولي الأمر',
        };
        if (this.state.isLiveCloud) {
          this.state.cloudSyncStatus = 'connected';
          this.setupFirestoreListeners(this.state.family.id);
        }
      } else {
        this.state.cloudUser = null;
        if (this.state.isLiveCloud) {
          this.state.cloudSyncStatus = 'idle';
        }
      }
      this.saveState();
    });

    // Start automated timer simulation for connection / simulated device ticks
    setInterval(() => {
      this.checkOfflineTick();
    }, 60000);
  }

  private loadState(): AmanState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.liveSessions) {
          parsed.liveSessions = INITIAL_STATE.liveSessions;
        }
        if (parsed.isLiveCloud === undefined) {
          parsed.isLiveCloud = false;
        }
        parsed.cloudSyncStatus = 'idle';
        return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Storage save failed", e);
    }
    this.notify();
  }

  // --- Cloud Sync Actions ---
  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      this.state.cloudSyncStatus = 'connecting';
      this.notify();
      const res = await signInWithPopup(auth, googleProvider);
      this.state.cloudUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
      };
      this.state.isLiveCloud = true;
      this.state.cloudSyncStatus = 'connected';
      await this.syncCurrentStateToCloud();
      this.setupFirestoreListeners(this.state.family.id);
      this.saveState();
      return { success: true };
    } catch (err: any) {
      console.error("Google sign in failed", err);
      this.state.cloudSyncStatus = 'error';
      this.notify();
      return { success: false, error: err.message || "Failed to sign in" };
    }
  }

  public async signInAsGuestCloud(): Promise<{ success: boolean; error?: string }> {
    try {
      this.state.cloudSyncStatus = 'connecting';
      this.notify();
      const res = await signInAnonymously(auth);
      this.state.cloudUser = {
        uid: res.user.uid,
        email: "حساب سحابي مباشر (Guest)",
        displayName: "ولي الأمر (جلسة حية)",
      };
      this.state.isLiveCloud = true;
      this.state.cloudSyncStatus = 'connected';
      await this.syncCurrentStateToCloud();
      this.setupFirestoreListeners(this.state.family.id);
      this.saveState();
      return { success: true };
    } catch (err: any) {
      console.error("Anonymous sign in failed", err);
      this.state.cloudSyncStatus = 'error';
      this.notify();
      return { success: false, error: err.message || "Failed to start live cloud" };
    }
  }

  public async signOutCloud() {
    try {
      this.clearCloudListeners();
      await signOut(auth);
      this.state.cloudUser = null;
      this.state.isLiveCloud = false;
      this.state.cloudSyncStatus = 'idle';
      this.saveState();
    } catch (err) {
      console.warn("Sign out error", err);
    }
  }

  public toggleCloudMode(enableLive: boolean) {
    this.state.isLiveCloud = enableLive;
    if (enableLive) {
      if (this.state.cloudUser) {
        this.state.cloudSyncStatus = 'connected';
        this.setupFirestoreListeners(this.state.family.id);
      } else {
        // Auto connect anonymously or prompt login
        this.signInAsGuestCloud();
      }
    } else {
      this.clearCloudListeners();
      this.state.cloudSyncStatus = 'idle';
    }
    this.saveState();
  }

  public async startCleanRealFamily(familyName?: string) {
    const uid = this.state.cloudUser?.uid || ("parent_" + Math.random().toString(36).substring(2, 9));
    const fid = "fam_" + Math.random().toString(36).substring(2, 10);
    
    this.clearCloudListeners();

    this.state.family = {
      id: fid,
      name: familyName || "عائلتي (سحابي حقيقي)",
      ownerUid: uid,
      members: [uid],
      retentionDays: 30,
      createdAt: Date.now(),
    };
    this.state.devices = [];
    this.state.locations = {};
    this.state.geofences = [];
    this.state.geofenceState = {};
    this.state.usage = {};
    this.state.commands = [];
    this.state.alerts = [
      {
        id: "alt_welcome_real",
        familyId: fid,
        deviceId: "sys",
        childName: "النظام",
        type: "tamper_warning",
        title: "تم بدء الحساب العائلي السحابي الحقيقي",
        body: "يمكنك الآن إضافة جهاز طفلك وتثبيت تطبيق أمان جارد الفعلي وإدخال رمز الاقتران.",
        read: false,
        createdAt: Date.now(),
      }
    ];
    this.state.pairingCodes = [];
    this.state.activeChildDeviceId = null;
    this.state.liveSessions = [];
    this.state.isLiveCloud = true;

    if (this.state.cloudUser) {
      await this.syncCurrentStateToCloud();
      this.setupFirestoreListeners(fid);
    }

    this.saveState();
  }

  public async syncCurrentStateToCloud() {
    if (!this.state.cloudUser) return;
    try {
      const fid = this.state.family.id;
      // Sync family doc
      await setDoc(doc(db, 'families', fid), {
        id: fid,
        name: this.state.family.name,
        ownerUid: this.state.cloudUser.uid,
        members: [this.state.cloudUser.uid],
        retentionDays: this.state.family.retentionDays || 30,
        createdAt: this.state.family.createdAt || Date.now(),
      }, { merge: true });

      // Sync devices
      for (const dev of this.state.devices) {
        await setDoc(doc(db, 'families', fid, 'devices', dev.id), dev, { merge: true });
        // Sync latest location
        if (dev.lastLocation) {
          await setDoc(doc(db, 'families', fid, 'devices', dev.id, 'locations', dev.lastLocation.id), dev.lastLocation, { merge: true });
        }
      }

      // Sync geofences
      for (const geo of this.state.geofences) {
        await setDoc(doc(db, 'families', fid, 'geofences', geo.id), geo, { merge: true });
      }

      this.state.cloudSyncStatus = 'connected';
      console.log("[AmanGuard] Successfully synced state to Firestore family:", fid);
    } catch (e) {
      console.warn("[AmanGuard] Cloud sync note:", e);
    }
  }

  private clearCloudListeners() {
    this.cloudUnsubscribers.forEach((unsub) => {
      try { unsub(); } catch {}
    });
    this.cloudUnsubscribers = [];
  }

  private setupFirestoreListeners(familyId: string) {
    this.clearCloudListeners();

    try {
      // 1. Listen to devices
      const devicesUnsub = onSnapshot(collection(db, 'families', familyId, 'devices'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const deviceData = change.doc.data() as Device;
          const idx = this.state.devices.findIndex((d) => d.id === deviceData.id);
          if (change.type === 'added') {
            if (idx === -1) {
              this.state.devices.push(deviceData);
            }
          } else if (change.type === 'modified') {
            if (idx !== -1) {
              this.state.devices[idx] = { ...this.state.devices[idx], ...deviceData };
            }
          } else if (change.type === 'removed') {
            if (idx !== -1) {
              this.state.devices.splice(idx, 1);
            }
          }
        });
        this.saveState();
      }, (err) => {
        console.warn("Firestore devices listener:", err);
      });
      this.cloudUnsubscribers.push(devicesUnsub);

      // 2. Listen to geofences
      const geofencesUnsub = onSnapshot(collection(db, 'families', familyId, 'geofences'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const geoData = change.doc.data() as Geofence;
          const idx = this.state.geofences.findIndex((g) => g.id === geoData.id);
          if (change.type === 'added' && idx === -1) {
            this.state.geofences.push(geoData);
          } else if (change.type === 'modified' && idx !== -1) {
            this.state.geofences[idx] = geoData;
          } else if (change.type === 'removed' && idx !== -1) {
            this.state.geofences.splice(idx, 1);
          }
        });
        this.saveState();
      }, (err) => {
        console.warn("Firestore geofences listener:", err);
      });
      this.cloudUnsubscribers.push(geofencesUnsub);

      // 3. Listen to alerts
      const alertsUnsub = onSnapshot(collection(db, 'families', familyId, 'alerts'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const alertData = change.doc.data() as AlertItem;
          const idx = this.state.alerts.findIndex((a) => a.id === alertData.id);
          if (change.type === 'added' && idx === -1) {
            this.state.alerts.unshift(alertData);
          } else if (change.type === 'modified' && idx !== -1) {
            this.state.alerts[idx] = alertData;
          }
        });
        this.saveState();
      }, (err) => {
        console.warn("Firestore alerts listener:", err);
      });
      this.cloudUnsubscribers.push(alertsUnsub);

    } catch (err) {
      console.warn("Error setting up Firestore listeners:", err);
    }
  }

  public subscribe(fn: (state: AmanState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  public getState(): AmanState {
    return this.state;
  }

  public resetToDemo() {
    this.clearCloudListeners();
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
  }

  public setActiveChildDeviceId(id: string | null) {
    this.state.activeChildDeviceId = id;
    this.saveState();
  }

  // --- Parent Actions ---
  public createPairingCode(childName: string): PairingCode {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude easily confused chars (0, O, 1, I)
    let code = "AM";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newCode: PairingCode = {
      code,
      familyId: this.state.family.id,
      familyName: this.state.family.name,
      childName,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
      used: false,
    };

    this.state.pairingCodes.unshift(newCode);
    this.saveState();
    return newCode;
  }

  public previewPairingCode(code: string): PairingCode | null {
    const clean = code.trim().toUpperCase();
    const found = this.state.pairingCodes.find((c) => c.code === clean && !c.used && c.expiresAt > Date.now());
    return found || null;
  }

  public redeemPairingCode(code: string, deviceMeta: { deviceName: string; manufacturer: string; model: string; sdk: number }): Device | null {
    const pair = this.previewPairingCode(code);
    if (!pair) return null;

    pair.used = true;
    const deviceId = `dev_${pair.childName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'child'}_${Date.now().toString(36)}`;
    
    const newDevice: Device = {
      id: deviceId,
      familyId: pair.familyId,
      childName: pair.childName,
      name: `${deviceMeta.manufacturer} ${deviceMeta.model} (${pair.childName})`,
      avatarColor: 'violet',
      status: 'active',
      deviceUid: `uid_${deviceId}`,
      createdAt: Date.now(),
      settings: { locationIntervalMin: 15 },
      deviceStatus: {
        lastSeen: Date.now(),
        battery: 92,
        isCharging: false,
        networkType: 'WiFi',
        appVersion: '1.2.0',
        osVersion: `Android ${deviceMeta.sdk >= 34 ? '14' : '13'} (API ${deviceMeta.sdk})`,
        deviceModel: deviceMeta.model || 'Pixel 7',
        manufacturer: deviceMeta.manufacturer || 'Google',
      },
      currentPermissions: {
        location_fine: { state: 'GRANTED', checkedAt: Date.now() },
        location_background: { state: 'GRANTED', checkedAt: Date.now() },
        location_services: { state: 'GRANTED', checkedAt: Date.now() },
        notifications: { state: 'GRANTED', checkedAt: Date.now() },
        usage_access: { state: 'NEEDS_MANUAL', checkedAt: Date.now() },
        battery_opt: { state: 'GRANTED', checkedAt: Date.now() },
        camera: { state: 'GRANTED', checkedAt: Date.now() },
        microphone: { state: 'GRANTED', checkedAt: Date.now() },
      },
      lastLocation: {
        id: `loc_${Date.now()}`,
        lat: 24.8142,
        lng: 46.6508,
        accuracy: 15,
        provider: 'fused',
        source: 'manual',
        deviceTime: Date.now(),
        serverTime: Date.now(),
        addressLabel: 'الرياض، المملكة العربية السعودية'
      }
    };

    this.state.devices.push(newDevice);
    this.state.locations[deviceId] = [newDevice.lastLocation!];
    this.state.usage[deviceId] = [{
      date: new Date().toISOString().split('T')[0],
      totalSeconds: 30 * 60,
      apps: [
        { pkg: 'com.whatsapp', name: 'WhatsApp', category: 'social', seconds: 15 * 60 },
        { pkg: 'com.google.android.youtube', name: 'YouTube Kids', category: 'entertainment', seconds: 15 * 60 },
      ]
    }];

    this.state.activeChildDeviceId = deviceId;
    this.saveState();
    return newDevice;
  }

  public sendCommand(deviceId: string, type: CommandType, payload: Record<string, unknown> = {}): CommandItem {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) throw new Error("Device not found");

    // Deduplicate commands within 30s as in functions/src/index.ts
    const thirtySecAgo = Date.now() - 30000;
    const recent = this.state.commands.find(
      (c) => c.deviceId === deviceId && c.type === type && c.createdAt > thirtySecAgo && (c.status === 'sent' || c.status === 'received')
    );
    if (recent) {
      return recent;
    }

    const cmd: CommandItem = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      familyId: this.state.family.id,
      deviceId,
      type,
      status: 'sent',
      payload,
      createdBy: this.state.family.ownerUid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.state.commands.unshift(cmd);
    this.saveState();

    // Simulate async device receiving and applying command over push
    setTimeout(() => {
      this.simulateCommandExecution(cmd.id);
    }, 1200);

    return cmd;
  }

  private simulateCommandExecution(cmdId: string) {
    const cmd = this.state.commands.find((c) => c.id === cmdId);
    if (!cmd) return;

    cmd.status = 'received';
    cmd.updatedAt = Date.now();
    this.saveState();

    setTimeout(() => {
      if (cmd.type === 'location.refresh') {
        cmd.status = 'applied';
        cmd.result = 'تم تحديد الموقع بنجاح وإرساله للخادم';
        // Trigger location refresh on the device
        this.simulateChildMovement(cmd.deviceId, undefined, undefined, 'command');
      } else if (cmd.type === 'permissions.check') {
        cmd.status = 'applied';
        const dev = this.state.devices.find((d) => d.id === cmd.deviceId);
        const grantedCount = dev ? Object.values(dev.currentPermissions).filter((p) => p.state === 'GRANTED').length : 0;
        cmd.result = `فحص الصلاحيات: ${grantedCount} من 6 صلاحيات نشطة`;
      } else if (cmd.type === 'sync.now') {
        cmd.status = 'applied';
        cmd.result = 'تمت مزامنة جميع سجلات الاستخدام والنشاط';
        const dev = this.state.devices.find((d) => d.id === cmd.deviceId);
        if (dev) dev.deviceStatus.lastSeen = Date.now();
      } else if (cmd.type === 'rules.sync') {
        // Honest behavior per FEATURE_STATUS_AR.md
        cmd.status = 'unsupported';
        cmd.result = 'فشل: ميزة حظر التطبيقات وقواعد وقت الشاشة لم تُنفَّذ بعد في هذا الإصدار';
      }
      cmd.updatedAt = Date.now();
      this.saveState();
    }, 1500);
  }

  public unlinkDevice(deviceId: string, by: 'parent' | 'device' = 'parent') {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    dev.status = 'unlinked';
    dev.unlinkedAt = Date.now();
    dev.unlinkedBy = by;

    // Create alert
    this.createAlert({
      familyId: this.state.family.id,
      deviceId,
      childName: dev.childName,
      type: 'device_unlinked',
      title: 'إلغاء ربط الجهاز',
      body: by === 'device' 
        ? `قام ${dev.childName} بإلغاء ربط جهازه من داخل تطبيق الطفل.` 
        : `تم إلغاء ربط جهاز ${dev.childName} بنجاح.`,
    });

    if (this.state.activeChildDeviceId === deviceId) {
      this.state.activeChildDeviceId = null;
    }

    this.saveState();
  }

  public deleteLocations(deviceId: string) {
    this.state.locations[deviceId] = [];
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (dev) {
      dev.lastLocation = undefined;
    }
    this.saveState();
  }

  public addGeofence(fence: Omit<Geofence, 'id' | 'createdAt'>): Geofence {
    const newFence: Geofence = {
      ...fence,
      id: `geo_${Date.now()}`,
      createdAt: Date.now(),
    };
    this.state.geofences.push(newFence);

    // Initial check
    const dev = this.state.devices.find((d) => d.id === fence.deviceId);
    if (dev?.lastLocation) {
      const dist = calculateDistanceMeters(dev.lastLocation.lat, dev.lastLocation.lng, fence.lat, fence.lng);
      this.state.geofenceState[newFence.id] = dist <= fence.radius;
    }

    this.saveState();
    return newFence;
  }

  public deleteGeofence(fenceId: string) {
    this.state.geofences = this.state.geofences.filter((g) => g.id !== fenceId);
    delete this.state.geofenceState[fenceId];
    this.saveState();
  }

  public markAlertRead(alertId: string) {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
      this.saveState();
    }
  }

  public markAllAlertsRead() {
    this.state.alerts.forEach((a) => (a.read = true));
    this.saveState();
  }

  public createAlert(alert: Omit<AlertItem, 'id' | 'createdAt' | 'read'>) {
    const newAlert: AlertItem = {
      ...alert,
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      read: false,
      createdAt: Date.now(),
    };
    this.state.alerts.unshift(newAlert);
    this.saveState();
  }

  // --- Child Device Simulation & Server-Side Functions ---
  public simulateChildMovement(
    deviceId: string, 
    customLat?: number, 
    customLng?: number, 
    source: 'periodic' | 'command' | 'manual' = 'manual',
    customLabel?: string
  ) {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev || dev.status !== 'active') return;

    let lat = customLat;
    let lng = customLng;
    let label = customLabel;

    if (lat === undefined || lng === undefined) {
      // Pick random drift or preset
      const current = dev.lastLocation || { lat: 24.8142, lng: 46.6508 };
      lat = current.lat + (Math.random() - 0.5) * 0.003;
      lng = current.lng + (Math.random() - 0.5) * 0.003;
      label = "موقع متنقل في الحي";
    }

    const locRecord: LocationRecord = {
      id: `loc_${Date.now()}`,
      lat,
      lng,
      accuracy: Math.floor(Math.random() * 15) + 8,
      provider: 'fused',
      source,
      deviceTime: Date.now(),
      serverTime: Date.now(),
      addressLabel: label,
    };

    if (!this.state.locations[deviceId]) {
      this.state.locations[deviceId] = [];
    }
    this.state.locations[deviceId].unshift(locRecord);
    // Keep max 100 entries for simulation performance
    if (this.state.locations[deviceId].length > 100) {
      this.state.locations[deviceId].pop();
    }

    dev.lastLocation = locRecord;
    dev.deviceStatus.lastSeen = Date.now();

    // Run Server-side Geofence Evaluation (exactly as functions/src/index.ts)
    this.evaluateGeofencesForLocation(deviceId, lat, lng);

    this.saveState();
  }

  private evaluateGeofencesForLocation(deviceId: string, lat: number, lng: number) {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    const fences = this.state.geofences.filter((g) => g.deviceId === deviceId && g.enabled);

    for (const g of fences) {
      const dist = calculateDistanceMeters(lat, lng, g.lat, g.lng);
      const prev = this.state.geofenceState[g.id];
      let inside = prev;

      // Hysteresis logic from functions/src/index.ts:
      // If inside <= radius: enter
      // If dist > radius + 40m: exit (40m hysteresis buffer vs GPS drift)
      if (dist <= g.radius) {
        inside = true;
      } else if (dist > g.radius + 40) {
        inside = false;
      }

      if (inside === undefined || inside === prev) {
        if (prev === undefined && inside !== undefined) {
          this.state.geofenceState[g.id] = inside;
        }
        continue;
      }

      // State changed!
      this.state.geofenceState[g.id] = inside;

      // Raise appropriate alert
      if (inside && g.notifyEnter) {
        this.createAlert({
          familyId: this.state.family.id,
          deviceId,
          childName: dev.childName,
          type: 'geofence_enter',
          title: `وصول إلى: ${g.name}`,
          body: `${dev.childName} وصل الآن إلى المنطقة الآمنة: ${g.name}`,
        });
      } else if (!inside && g.notifyExit) {
        this.createAlert({
          familyId: this.state.family.id,
          deviceId,
          childName: dev.childName,
          type: 'geofence_exit',
          title: `مغادرة: ${g.name}`,
          body: `${dev.childName} غادر المنطقة الآمنة: ${g.name}`,
        });
      }
    }
  }

  public updatePermission(deviceId: string, permId: PermId, state: PermissionState) {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    const oldState = dev.currentPermissions[permId]?.state;
    dev.currentPermissions[permId] = {
      state,
      checkedAt: Date.now(),
    };

    // If a granted permission was revoked, raise alert (as functions/src/index.ts onPermissionsWritten)
    if (oldState === 'GRANTED' && state !== 'GRANTED') {
      this.createAlert({
        familyId: this.state.family.id,
        deviceId,
        childName: dev.childName,
        type: 'permission_revoked',
        title: 'تنبيه: سحب صلاحية من الجهاز',
        body: `تم إيقاف صلاحية (${permId}) على جهاز ${dev.childName}. قد تتوقف بعض وظائف المراقبة.`,
      });
    }

    dev.deviceStatus.lastSeen = Date.now();
    this.saveState();
  }

  public updateBattery(deviceId: string, battery: number, isCharging?: boolean) {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    dev.deviceStatus.battery = Math.max(1, Math.min(100, battery));
    if (isCharging !== undefined) {
      dev.deviceStatus.isCharging = isCharging;
    }
    dev.deviceStatus.lastSeen = Date.now();
    this.saveState();
  }

  public addAppUsage(deviceId: string, app: { pkg: string; name: string; category: DailyUsage['apps'][0]['category']; minutes: number }) {
    const today = new Date().toISOString().split('T')[0];
    if (!this.state.usage[deviceId]) {
      this.state.usage[deviceId] = [];
    }

    let dayRecord = this.state.usage[deviceId].find((d) => d.date === today);
    if (!dayRecord) {
      dayRecord = { date: today, totalSeconds: 0, apps: [] };
      this.state.usage[deviceId].unshift(dayRecord);
    }

    const seconds = app.minutes * 60;
    dayRecord.totalSeconds += seconds;

    const existingApp = dayRecord.apps.find((a) => a.pkg === app.pkg);
    if (existingApp) {
      existingApp.seconds += seconds;
    } else {
      dayRecord.apps.push({
        pkg: app.pkg,
        name: app.name,
        category: app.category,
        seconds,
      });
    }

    // Sort apps by seconds descending
    dayRecord.apps.sort((a, b) => b.seconds - a.seconds);

    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (dev) dev.deviceStatus.lastSeen = Date.now();

    this.saveState();
  }

  public requestLiveSession(
    deviceId: string,
    type: LiveSessionType,
    cameraFacing?: 'front' | 'back'
  ): { success: boolean; error?: string; sessionId?: string } {
    const dev = this.state.devices.find((d) => d.id === deviceId);
    if (!dev) {
      return { success: false, error: 'الجهاز غير موجود' };
    }

    const conn = getConnectionStatus(dev.deviceStatus.lastSeen);
    if (conn === 'OFFLINE') {
      return {
        success: false,
        error: `الجهاز غير متصل حالياً (آخر ظهور ${new Date(dev.deviceStatus.lastSeen).toLocaleTimeString()}). يجب أن يكون الجهاز متصلاً بالإنترنت لبدء جلسة مباشرة.`,
      };
    }

    // Permission checks
    if (type === 'camera' && dev.currentPermissions?.camera?.state !== 'GRANTED') {
      return {
        success: false,
        error: 'صلاحية الكاميرا غير ممنوحة على جهاز الطفل. يجب تفعيلها أولاً من إعدادات الجهاز.',
      };
    }

    if (type === 'mic' && dev.currentPermissions?.microphone?.state !== 'GRANTED') {
      return {
        success: false,
        error: 'صلاحية الميكروفون غير ممنوحة على جهاز الطفل. يجب تفعيلها أولاً من إعدادات الجهاز.',
      };
    }

    // Check if there is already an active session
    const existingActive = this.state.liveSessions.find(
      (s) => s.deviceId === deviceId && (s.status === 'requested' || s.status === 'connecting' || s.status === 'active')
    );
    if (existingActive) {
      return {
        success: false,
        error: 'توجد جلسة مراقبة جارية بالفعل لهذا الجهاز.',
      };
    }

    const sessionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession: LiveSession = {
      id: sessionId,
      familyId: this.state.family.id,
      deviceId: dev.id,
      parentId: this.state.family.ownerUid,
      childId: dev.deviceUid,
      type,
      cameraFacing: type === 'camera' ? (cameraFacing || 'back') : undefined,
      status: 'requested',
      createdAt: Date.now(),
      requestedBy: 'ولي الأمر',
      quality: type === 'mic' ? '48kHz PCM Audio' : '720p @ 30fps',
    };

    this.state.liveSessions.unshift(newSession);

    // Create command log
    this.sendCommand(deviceId, 'sync.now');

    // Create notification alert
    const typeLabel = type === 'screen' ? 'شاشة الجهاز' : type === 'camera' ? 'كاميرا الجهاز' : 'ميكروفون الجهاز';
    this.createAlert({
      familyId: this.state.family.id,
      deviceId: dev.id,
      childName: dev.childName,
      type: 'tamper_warning',
      title: 'طلب جلسة مراقبة مباشرة',
      body: `بدأ ولي الأمر جلسة استماع / بث مباشر لـ ${typeLabel} على جهاز ${dev.childName}.`,
    });

    this.saveState();
    return { success: true, sessionId };
  }

  public stopLiveSession(sessionId: string, reason: string = 'stopped_by_parent') {
    const session = this.state.liveSessions.find((s) => s.id === sessionId);
    if (session && session.status !== 'ended' && session.status !== 'rejected') {
      session.status = 'ended';
      session.endedAt = Date.now();
      session.endReason = reason;
      this.saveState();
    }
  }

  public respondToLiveSession(sessionId: string, accept: boolean, declineReason?: string) {
    const session = this.state.liveSessions.find((s) => s.id === sessionId);
    if (!session) return;

    if (accept) {
      session.status = 'active';
      session.startedAt = Date.now();
      const dev = this.state.devices.find((d) => d.id === session.deviceId);
      if (dev) {
        dev.deviceStatus.lastSeen = Date.now();
      }
    } else {
      session.status = 'rejected';
      session.endedAt = Date.now();
      session.endReason = declineReason || 'declined_by_child';
    }
    this.saveState();
  }

  public getActiveLiveSession(deviceId: string): LiveSession | undefined {
    return this.state.liveSessions.find(
      (s) => s.deviceId === deviceId && (s.status === 'requested' || s.status === 'connecting' || s.status === 'active')
    );
  }

  public getDeviceLiveSessions(deviceId: string): LiveSession[] {
    return this.state.liveSessions.filter((s) => s.deviceId === deviceId);
  }

  private checkOfflineTick() {
    const cutoff = Date.now() - 45 * 60 * 1000;
    this.state.devices.forEach((dev) => {
      if (dev.status === 'active' && dev.deviceStatus.lastSeen < cutoff) {
        // Device is offline
        const existingOfflineAlert = this.state.alerts.find(
          (a) => a.deviceId === dev.id && a.type === 'device_offline' && Date.now() - a.createdAt < 3600000
        );
        if (!existingOfflineAlert) {
          this.createAlert({
            familyId: this.state.family.id,
            deviceId: dev.id,
            childName: dev.childName,
            type: 'device_offline',
            title: 'انقطاع اتصال الجهاز',
            body: `جهاز ${dev.childName} لم يتصل بالخادم منذ أكثر من 45 دقيقة.`,
          });
        }
      }
    });
  }
}

export const amanStore = new AmanStore();
