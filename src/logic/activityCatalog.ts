import { Item } from './PackingEngine';

export type ActivityType =
    | 'beach'
    | 'hiking'
    | 'ski'
    | 'business'
    | 'cycling'
    | 'sightseeing'
    | 'camping'
    | 'fitness';

export interface ActivityDefinition {
    id: ActivityType;
    name: string;
    emoji: string;
    description: string;
    items: Item[];
}

export const ACTIVITY_CATALOG: Record<ActivityType, ActivityDefinition> = {
    beach: {
        id: 'beach',
        name: 'Strand & Baden',
        emoji: '🏖️',
        description: 'Badebekleidung, Strandtuch und Sonnenschutz',
        items: [
            { id: 'swimsuit', name: 'Badekleidung', weight: 150, category: 'clothing', tags: ['activity', 'beach'], quantity: 1 },
            { id: 'beach_towel', name: 'Strandtuch', weight: 400, category: 'clothing', tags: ['activity', 'beach'], quantity: 1 },
            { id: 'flip_flops', name: 'Badelatschen / Flip-Flops', weight: 200, category: 'clothing', tags: ['activity', 'beach'], quantity: 1 },
            { id: 'sunglasses', name: 'Sonnenbrille', weight: 50, category: 'misc', tags: ['activity', 'beach'], quantity: 1 },
            { id: 'beach_bag', name: 'Strandtasche', weight: 300, category: 'shared', tags: ['activity', 'beach'], quantity: 1 }
        ]
    },
    hiking: {
        id: 'hiking',
        name: 'Wandern & Outdoor',
        emoji: '🥾',
        description: 'Feste Schuhe, Funktionskleidung und Verpflegung',
        items: [
            { id: 'hiking_boots', name: 'Wanderschuhe', weight: 1200, category: 'clothing', tags: ['activity', 'hiking'], quantity: 1 },
            { id: 'hiking_socks', name: 'Wandersocken', weight: 80, category: 'clothing', tags: ['activity', 'hiking'], quantity: 2 },
            { id: 'water_bottle', name: 'Trinkflasche', weight: 250, category: 'misc', tags: ['activity', 'hiking'], quantity: 1 },
            { id: 'daypack', name: 'Tagesrucksack', weight: 500, category: 'misc', tags: ['activity', 'hiking'], quantity: 1 },
            { id: 'first_aid_hiking', name: 'Erste-Hilfe-Wanderpack & Blasenpflaster', weight: 200, category: 'shared', tags: ['activity', 'hiking'], quantity: 1 }
        ]
    },
    ski: {
        id: 'ski',
        name: 'Ski & Wintersport',
        emoji: '⛷️',
        description: 'Skikleidung, Protektoren und Wintersport-Ausrüstung',
        items: [
            { id: 'ski_jacket', name: 'Skijacke & Skihose', weight: 1800, category: 'clothing', tags: ['activity', 'ski'], quantity: 1 },
            { id: 'ski_goggles', name: 'Skibrille', weight: 150, category: 'misc', tags: ['activity', 'ski'], quantity: 1 },
            { id: 'ski_gloves', name: 'Wintersporthandschuhe', weight: 200, category: 'clothing', tags: ['activity', 'ski'], quantity: 1 },
            { id: 'ski_helmet', name: 'Skihelm', weight: 600, category: 'misc', tags: ['activity', 'ski'], quantity: 1 },
            { id: 'ski_wax_tools', name: 'Skiwachs & Kantenwerkzeug', weight: 350, category: 'shared', tags: ['activity', 'ski'], quantity: 1 }
        ]
    },
    business: {
        id: 'business',
        name: 'Business & Event',
        emoji: '💼',
        description: 'Formelle Kleidung, Business-Schuhe und Präsentationsausrüstung',
        items: [
            { id: 'dress_shirt', name: 'Hemd / Bluse', weight: 250, category: 'clothing', tags: ['activity', 'business'], quantity: 2 },
            { id: 'suit_pants', name: 'Anzughose / Kostüm', weight: 500, category: 'clothing', tags: ['activity', 'business'], quantity: 1 },
            { id: 'dress_shoes', name: 'Business-Schuhe', weight: 800, category: 'clothing', tags: ['activity', 'business'], quantity: 1 },
            { id: 'laptop_charger', name: 'Laptop-Ladegerät & Adapter', weight: 350, category: 'electronics', tags: ['activity', 'business'], quantity: 1 },
            { id: 'travel_steamer', name: 'Reise-Dampfbügeleisen / Steamer', weight: 600, category: 'shared', tags: ['activity', 'business'], quantity: 1 }
        ]
    },
    cycling: {
        id: 'cycling',
        name: 'Radsport & Biking',
        emoji: '🚴',
        description: 'Fahrradbekleidung, Helm und Werkzeug',
        items: [
            { id: 'cycling_jersey', name: 'Radtrikot & Radhose', weight: 300, category: 'clothing', tags: ['activity', 'cycling'], quantity: 1 },
            { id: 'bike_helmet', name: 'Fahrradhelm', weight: 350, category: 'misc', tags: ['activity', 'cycling'], quantity: 1 },
            { id: 'bike_gloves', name: 'Fahrradhandschuhe', weight: 80, category: 'clothing', tags: ['activity', 'cycling'], quantity: 1 },
            { id: 'bike_repair_kit', name: 'Fahrrad-Pumpe & Flickzeug', weight: 450, category: 'shared', tags: ['activity', 'cycling'], quantity: 1 }
        ]
    },
    sightseeing: {
        id: 'sightseeing',
        name: 'Städtetrip & Kultur',
        emoji: '🎭',
        description: 'Bequeme Schuhe, Tagesrucksack und Kultur-Guide',
        items: [
            { id: 'walking_shoes', name: 'Bequeme Walking-Schuhe', weight: 700, category: 'clothing', tags: ['activity', 'sightseeing'], quantity: 1 },
            { id: 'daypack', name: 'Tagesrucksack', weight: 500, category: 'misc', tags: ['activity', 'sightseeing'], quantity: 1 },
            { id: 'city_guide', name: 'Reiseführer / Notizbuch', weight: 250, category: 'shared', tags: ['activity', 'sightseeing'], quantity: 1 }
        ]
    },
    camping: {
        id: 'camping',
        name: 'Camping & Zelten',
        emoji: '🏕️',
        description: 'Schlafsack, Isomatte, Stirnlampe und Camping-Bedarf',
        items: [
            { id: 'sleeping_bag', name: 'Schlafsack', weight: 1200, category: 'misc', tags: ['activity', 'camping'], quantity: 1 },
            { id: 'sleeping_pad', name: 'Isomatte', weight: 500, category: 'misc', tags: ['activity', 'camping'], quantity: 1 },
            { id: 'headlamp', name: 'Stirnlampe', weight: 120, category: 'electronics', tags: ['activity', 'camping'], quantity: 1 },
            { id: 'camping_stove', name: 'Camping-Kocher & Geschirr', weight: 800, category: 'shared', tags: ['activity', 'camping'], quantity: 1 },
            { id: 'mosquito_spray', name: 'Mückenspray', weight: 150, category: 'shared', tags: ['activity', 'camping'], quantity: 1 }
        ]
    },
    fitness: {
        id: 'fitness',
        name: 'Fitness & Sport',
        emoji: '🏋️',
        description: 'Sportkleidung, Trainingsschuhe und Sporthandtuch',
        items: [
            { id: 'sport_outfit', name: 'Sportkleidung (Shirt & Shorts)', weight: 300, category: 'clothing', tags: ['activity', 'fitness'], quantity: 2 },
            { id: 'gym_shoes', name: 'Trainingsschuhe', weight: 700, category: 'clothing', tags: ['activity', 'fitness'], quantity: 1 },
            { id: 'sport_towel', name: 'Mikrofaser-Sporthandtuch', weight: 120, category: 'misc', tags: ['activity', 'fitness'], quantity: 1 },
            { id: 'resistance_bands', name: 'Fitnessbänder-Set', weight: 200, category: 'shared', tags: ['activity', 'fitness'], quantity: 1 }
        ]
    }
};

/**
 * Returns all items for a given list of activity IDs, avoiding duplicate items.
 */
export function getItemsForActivities(activities: string[]): Item[] {
    const itemMap = new Map<string, Item>();

    activities.forEach(actId => {
        const activity = ACTIVITY_CATALOG[actId as ActivityType];
        if (activity) {
            activity.items.forEach(item => {
                if (!itemMap.has(item.id)) {
                    // Clone item so callers cannot mutate the catalog
                    itemMap.set(item.id, { ...item, tags: [...item.tags] });
                }
            });
        }
    });

    return Array.from(itemMap.values());
}
