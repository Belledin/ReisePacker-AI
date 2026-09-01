import { supabase } from '../lib/supabaseClient';
import { PackingEngine, PackingRequest, Person, Item } from '../logic/PackingEngine';
import { WeatherService } from '../services/WeatherService';

// Interfaces mapping to DB Schema
interface DbTrip {
    id: string;
    destination: string;
    start_date: string;
    end_date: string;
    weather_snapshot: any;
    transport_limit: number;
    mode: 'SHARED' | 'INDEPENDENT';
    is_template: boolean;
}

interface DbTraveler {
    id: string;
    trip_id: string;
    name: string;
    type: string;
    current_load: number;
    max_load: number;
}

interface DbPackingItem {
    id?: string;
    trip_id: string;
    owner_id: string | null;
    is_community_item: boolean;
    item_id: string;
    name: string;
    category: string;
    weight: number;
    tags: string[];
    is_packed: boolean;
    quantity: number;
}

export class HistoryService {
    private engine: PackingEngine;

    constructor() {
        this.engine = new PackingEngine();
    }

    /**
     * Saves a generated packing list to Supabase.
     * Can optionally mark it as a template.
     */
    async saveTrip(request: PackingRequest, result: { people: Person[]; communityBox: Item[] }, isTemplate: boolean = false): Promise<string | null> {
        // 1. Insert Trip
        const { data: tripData, error: tripError } = await supabase
            .from('trips')
            .insert({
                destination: request.destination,
                start_date: new Date().toISOString(), // In a real app, request would have dates
                end_date: new Date(Date.now() + request.days * 24 * 60 * 60 * 1000).toISOString(),
                weather_snapshot: request.weatherCondition,
                transport_limit: request.transportLimit,
                mode: request.mode,
                is_template: isTemplate
            })
            .select()
            .single();

        if (tripError || !tripData) {
            console.error('Error saving trip:', tripError);
            return null;
        }

        const tripId = tripData.id;

        // 2. Insert Travelers & Items
        // We need to map back the created Traveler IDs to insert items correctly
        const personIdMap = new Map<string, string>(); // Local Person ID -> DB ID

        for (const person of result.people) {
            const { data: personData, error: personError } = await supabase
                .from('travelers')
                .insert({
                    trip_id: tripId,
                    name: person.name,
                    type: person.type,
                    current_load: person.currentLoad,
                    max_load: person.maxLoad
                })
                .select()
                .single();

            if (personError || !personData) {
                console.error('Error saving traveler:', personError);
                continue;
            }
            personIdMap.set(person.id, personData.id);

            // Insert Personal Items
            const itemsToInsert: DbPackingItem[] = person.inventory.map(item => ({
                trip_id: tripId,
                owner_id: personData.id,
                is_community_item: false,
                item_id: item.id,
                name: item.name,
                category: item.category,
                weight: item.weight,
                tags: item.tags,
                is_packed: false,
                quantity: 1
            }));

            if (itemsToInsert.length > 0) {
                await supabase.from('packing_items').insert(itemsToInsert);
            }
        }

        // 3. Insert Community Box Items
        if (result.communityBox.length > 0) {
            const communityItems: DbPackingItem[] = result.communityBox.map(item => ({
                trip_id: tripId,
                owner_id: null,
                is_community_item: true,
                item_id: item.id,
                name: item.name,
                category: item.category,
                weight: item.weight,
                tags: item.tags,
                is_packed: false,
                quantity: 1
            }));
            await supabase.from('packing_items').insert(communityItems);
        }

        return tripId;
    }

    async getRecentTrips(): Promise<DbTrip[]> {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching trips:', error);
            return [];
        }
        return data as DbTrip[];
    }

    /**
     * Clones a trip with a New Date (and thus potentially New Weather).
     * 1. Fetches old trip details.
     * 2. Re-runs PackingEngine to get FRESH weather-dependent items.
     * 3. MERGES/PRESERVES manual extra items from the old trip.
     */
    async cloneTrip(oldTripId: string, newDate: Date): Promise<{ people: Person[]; communityBox: Item[] } | null> {
        // 1. Fetch Old Trip Metadata
        const { data: trip, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', oldTripId)
            .single();

        if (error || !trip) return null;

        // 2. Fetch People (to reconstruct request)
        const { data: travelers } = await supabase.from('travelers').select('*').eq('trip_id', oldTripId);

        if (!travelers) return null;

        // Reconstruct Request
        const days = Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 3600 * 24));

        const people: Person[] = travelers.map((t: any) => ({
            id: t.id, // ID might change in new generation, but we keep structure
            name: t.name,
            type: t.type,
            inventory: [],
            currentLoad: 0,
            maxLoad: t.max_load
        }));

        // Fetch Weather Triggers for the new date
        const weatherService = new WeatherService();
        const triggers = await weatherService.getWeatherTriggers(trip.destination, newDate);

        const newRequest: PackingRequest = {
            destination: trip.destination,
            days: days,
            people: people, // Re-use people definitions
            activities: [],
            // weatherCondition omitted as we now have triggers
            weatherTriggers: triggers,
            transportLimit: trip.transport_limit,
            mode: trip.mode as 'SHARED' | 'INDEPENDENT'
        };

        // 3. Generate NEW List (Validates weather)
        const newList = this.engine.generateList(newRequest);

        return newList;
    }
}
