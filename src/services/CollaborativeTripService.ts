import {
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import { Person, Item } from '../logic/PackingEngine';
import { WeatherData, WeatherTriggers } from '../services/WeatherService';

export interface CollaborativeTripData {
    id: string;
    shareCode: string;
    destination: string;
    date: string;
    days: number;
    mode: 'SHARED' | 'INDEPENDENT';
    maxWeight: number;
    activities: string[];
    people: Person[];
    communityBox: Item[];
    packedMap: Record<string, boolean>; // key: ownerId___itemId -> boolean
    weatherInfo?: {
        data: WeatherData;
        triggers: WeatherTriggers;
        location: string;
        date: string;
    } | null;
    lastUpdatedBy: string;
    updatedAt: string;
    createdAt?: string;
}

// Generate an easy-to-read, memorable 6-character share code (like ALPEN6, MALLE3)
export function generateShareCode(destination: string = ''): string {
    const cleanDest = destination
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4);
    const prefix = cleanDest.length >= 3 ? cleanDest : 'TRIP';
    const rand = Math.floor(100 + Math.random() * 900); // 3 digits
    return `${prefix}${rand}`;
}

export class CollaborativeTripService {
    /**
     * Saves or updates a trip in Firestore in real time.
     */
    public static async saveTrip(
        trip: CollaborativeTripData,
        authorName: string = 'Ich'
    ): Promise<string> {
        const tripId = trip.id || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const shareCode = trip.shareCode || generateShareCode(trip.destination);
        const docRef = doc(db, 'trips', tripId);

        const payload = {
            id: tripId,
            shareCode: shareCode.toUpperCase(),
            destination: trip.destination,
            date: trip.date,
            days: trip.days,
            mode: trip.mode,
            maxWeight: trip.maxWeight,
            activities: JSON.stringify(trip.activities || []),
            people: JSON.stringify(trip.people || []),
            communityBox: JSON.stringify(trip.communityBox || []),
            packedMap: JSON.stringify(trip.packedMap || {}),
            weatherInfo: trip.weatherInfo ? JSON.stringify(trip.weatherInfo) : '',
            lastUpdatedBy: authorName,
            updatedAt: new Date().toISOString(),
            createdAt: trip.createdAt || new Date().toISOString()
        };

        await setDoc(docRef, payload, { merge: true });
        return tripId;
    }

    /**
     * Quick toggle for a single item packed state to make checking ultra-fast and real-time.
     */
    public static async updateItemPackedState(
        tripId: string,
        itemKey: string,
        isPacked: boolean,
        authorName: string
    ): Promise<void> {
        if (!tripId) return;
        const docRef = doc(db, 'trips', tripId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        let packedMap: Record<string, boolean> = {};
        try {
            packedMap = data.packedMap ? JSON.parse(data.packedMap) : {};
        } catch {
            packedMap = {};
        }

        packedMap[itemKey] = isPacked;

        await setDoc(docRef, {
            packedMap: JSON.stringify(packedMap),
            lastUpdatedBy: authorName,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    /**
     * Subscribes to real-time changes of a trip document (Live-Sync wie bei Google Notizen).
     */
    public static subscribeToTrip(
        tripId: string,
        onUpdate: (trip: CollaborativeTripData) => void,
        onError?: (err: any) => void
    ): () => void {
        const docRef = doc(db, 'trips', tripId);
        return onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const raw = snap.data();
                try {
                    const trip: CollaborativeTripData = {
                        id: snap.id,
                        shareCode: raw.shareCode || snap.id,
                        destination: raw.destination || '',
                        date: raw.date || '',
                        days: raw.days || 3,
                        mode: raw.mode || 'SHARED',
                        maxWeight: raw.maxWeight || 23000,
                        activities: raw.activities ? JSON.parse(raw.activities) : [],
                        people: raw.people ? JSON.parse(raw.people) : [],
                        communityBox: raw.communityBox ? JSON.parse(raw.communityBox) : [],
                        packedMap: raw.packedMap ? JSON.parse(raw.packedMap) : {},
                        weatherInfo: raw.weatherInfo ? JSON.parse(raw.weatherInfo) : null,
                        lastUpdatedBy: raw.lastUpdatedBy || 'Jemand',
                        updatedAt: raw.updatedAt || new Date().toISOString(),
                        createdAt: raw.createdAt
                    };
                    onUpdate(trip);
                } catch (e) {
                    console.error('Error parsing synced trip data:', e);
                }
            }
        }, onError);
    }

    /**
     * Finds a trip either by exact ID or by friendly share code (e.g. "MALLORCA123").
     */
    public static async loadTripByCodeOrId(codeOrId: string): Promise<CollaborativeTripData | null> {
        const clean = codeOrId.trim();
        if (!clean) return null;

        // 1. Try direct ID lookup
        const directRef = doc(db, 'trips', clean);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
            return this.parseDoc(directSnap.id, directSnap.data());
        }

        // 2. Query by shareCode (case-insensitive uppercase match)
        const tripsCol = collection(db, 'trips');
        const q = query(tripsCol, orderBy('updatedAt', 'desc'), limit(50));
        const querySnap = await getDocs(q);
        const targetCode = clean.toUpperCase();

        for (const docSnap of querySnap.docs) {
            const data = docSnap.data();
            if (data.shareCode && data.shareCode.toUpperCase() === targetCode) {
                return this.parseDoc(docSnap.id, data);
            }
        }

        return null;
    }

    /**
     * Lists recent trips for the current device/user.
     */
    public static async listRecentTrips(limitCount: number = 10): Promise<CollaborativeTripData[]> {
        try {
            const tripsCol = collection(db, 'trips');
            const q = query(tripsCol, orderBy('updatedAt', 'desc'), limit(limitCount));
            const querySnap = await getDocs(q);
            return querySnap.docs.map(d => this.parseDoc(d.id, d.data()));
        } catch (e) {
            console.error('Failed to list recent trips:', e);
            return [];
        }
    }

    private static parseDoc(id: string, raw: any): CollaborativeTripData {
        return {
            id,
            shareCode: raw.shareCode || id,
            destination: raw.destination || '',
            date: raw.date || '',
            days: raw.days || 3,
            mode: raw.mode || 'SHARED',
            maxWeight: raw.maxWeight || 23000,
            activities: raw.activities ? JSON.parse(raw.activities) : [],
            people: raw.people ? JSON.parse(raw.people) : [],
            communityBox: raw.communityBox ? JSON.parse(raw.communityBox) : [],
            packedMap: raw.packedMap ? JSON.parse(raw.packedMap) : {},
            weatherInfo: raw.weatherInfo ? JSON.parse(raw.weatherInfo) : null,
            lastUpdatedBy: raw.lastUpdatedBy || '',
            updatedAt: raw.updatedAt || new Date().toISOString(),
            createdAt: raw.createdAt
        };
    }
}
