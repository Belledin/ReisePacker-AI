import {
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs
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
    ownerUid?: string;
    ownerEmail?: string;
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
        authorName: string = 'Ich',
        ownerUser?: { uid: string; email?: string | null }
    ): Promise<string> {
        const tripId = trip.id || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const shareCode = (trip.shareCode || generateShareCode(trip.destination)).toUpperCase();
        const docRef = doc(db, 'trips', tripId);

        const payload: Record<string, any> = {
            id: tripId,
            shareCode: shareCode,
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
            ownerUid: ownerUser?.uid || trip.ownerUid || null,
            ownerEmail: ownerUser?.email || trip.ownerEmail || null,
            lastUpdatedBy: authorName,
            updatedAt: new Date().toISOString(),
            createdAt: trip.createdAt || new Date().toISOString()
        };

        await setDoc(docRef, payload, { merge: true });

        // Save mapping for instant direct share code lookups
        try {
            const shareRef = doc(db, 'shareCodes', shareCode);
            await setDoc(shareRef, { tripId, updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
            console.warn('Could not update shareCodes mapping:', e);
        }

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
     * Sets up a real-time snapshot listener on a trip document.
     */
    public static subscribeToTrip(
        tripId: string,
        onUpdate: (trip: CollaborativeTripData) => void,
        onError?: (err: Error) => void
    ): () => void {
        const docRef = doc(db, 'trips', tripId);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                try {
                    const parsed = this.parseDoc(docSnap.id, data);
                    onUpdate(parsed);
                } catch (e) {
                    console.error('Failed to parse trip document updates:', e);
                }
            }
        }, onError);
    }

    /**
     * Finds a trip either by exact ID or by friendly share code (e.g. "MALLORCA123" or "BARC588").
     */
    public static async loadTripByCodeOrId(codeOrId: string): Promise<CollaborativeTripData | null> {
        const clean = codeOrId.trim();
        if (!clean) return null;

        // 1. Try direct ID lookup
        try {
            const directRef = doc(db, 'trips', clean);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) {
                return this.parseDoc(directSnap.id, directSnap.data());
            }
        } catch (e) {
            console.warn('Direct trip ID read check:', e);
        }

        const targetCode = clean.toUpperCase();

        // 2. Lookup via /shareCodes/{code}
        try {
            const shareRef = doc(db, 'shareCodes', targetCode);
            const shareSnap = await getDoc(shareRef);
            if (shareSnap.exists()) {
                const mapping = shareSnap.data();
                if (mapping && mapping.tripId) {
                    const resolvedRef = doc(db, 'trips', mapping.tripId);
                    const resolvedSnap = await getDoc(resolvedRef);
                    if (resolvedSnap.exists()) {
                        return this.parseDoc(resolvedSnap.id, resolvedSnap.data());
                    }
                }
            }
        } catch (e) {
            console.warn('Share code mapping lookup error:', e);
        }

        // 3. Fallback: Query directly in /trips by shareCode field
        try {
            const tripsCol = collection(db, 'trips');
            const q = query(tripsCol, where('shareCode', '==', targetCode), limit(1));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                const docSnap = querySnap.docs[0];
                return this.parseDoc(docSnap.id, docSnap.data());
            }
        } catch (e) {
            console.warn('Direct shareCode query check:', e);
        }

        return null;
    }

    /**
     * Lists recent trips for the authenticated user.
     * Also seamlessly includes legacy trips (created before login) and automatically links them to the user.
     */
    public static async listRecentTrips(limitCount: number = 10, userUid?: string | null): Promise<CollaborativeTripData[]> {
        if (!userUid) {
            // Unauthenticated visitors see no trips
            return [];
        }

        try {
            const tripsCol = collection(db, 'trips');
            // Authenticated user can query recent trips
            const q = query(tripsCol, orderBy('updatedAt', 'desc'), limit(30));
            const querySnap = await getDocs(q);

            const results: CollaborativeTripData[] = [];
            for (const d of querySnap.docs) {
                const data = d.data();
                // Include trips owned by this user OR legacy trips without an owner
                if (data.ownerUid === userUid || !data.ownerUid) {
                    const parsed = this.parseDoc(d.id, data);
                    results.push(parsed);

                    // Automatically adopt/claim legacy trip so it gets permanently linked to this user
                    if (!data.ownerUid) {
                        setDoc(doc(db, 'trips', d.id), { ownerUid: userUid }, { merge: true }).catch(console.warn);
                    }
                }
            }

            return results.slice(0, limitCount);
        } catch (e) {
            console.warn('Error in listRecentTrips, trying direct user query fallback:', e);
            // Fallback: Query only where ownerUid == userUid
            try {
                const tripsCol = collection(db, 'trips');
                const q = query(tripsCol, where('ownerUid', '==', userUid), limit(limitCount));
                const querySnap = await getDocs(q);
                return querySnap.docs.map(d => this.parseDoc(d.id, d.data()));
            } catch (err2) {
                console.error('Failed to list user trips in fallback:', err2);
                return [];
            }
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
            ownerUid: raw.ownerUid || undefined,
            ownerEmail: raw.ownerEmail || undefined,
            lastUpdatedBy: raw.lastUpdatedBy || '',
            updatedAt: raw.updatedAt || new Date().toISOString(),
            createdAt: raw.createdAt
        };
    }
}
