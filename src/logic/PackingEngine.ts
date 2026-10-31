export type PersonType = 'ADULT' | 'TEEN' | 'CHILD' | 'TODDLER';

export type HealthConditionType =
    | 'daily_meds'
    | 'allergies'
    | 'asthma'
    | 'diabetes'
    | 'motion_sickness'
    | 'contact_lenses';

export interface Person {
    id: string;
    name: string;
    type: PersonType;
    inventory: Item[];
    currentLoad: number; // in grams
    maxLoad: number; // in grams (derived from transport limit)
    healthConditions?: HealthConditionType[];
}

export type Category = 'clothing' | 'hygiene' | 'electronics' | 'misc' | 'shared' | 'documents' | 'health';

export interface Item {
    id: string;
    name: string;
    weight: number; // in grams (per unit)
    category: Category;
    tags: string[]; // e.g., 'rain', 'hiking', 'health'
    quantity: number; // Default 1
}

import { WeatherTriggers } from '../services/WeatherService';
import { getItemsForActivities } from './activityCatalog';
import { CatalogItem, calculateCatalogItemQuantity } from './defaultCatalog';

export interface PackingRequest {
    destination: string;
    days: number;
    people: Person[];
    activities: string[]; // e.g., 'hiking', 'ski'
    weatherCondition?: {
        rainProbability: number; // 0-100
        minTemp: number; // Celsius
    };
    weatherTriggers?: WeatherTriggers; // Phase 4 Extension
    transportLimit: number; // in grams per person (e.g. 23000)
    mode: 'SHARED' | 'INDEPENDENT';
    customCatalog?: CatalogItem[];
}

export const HEALTH_ITEM_CATALOG: Record<HealthConditionType, { name: string; weight: number; quantity: number }> = {
    daily_meds: { name: 'Persönliche Dauermedikation (+3 Tage Puffer)', weight: 100, quantity: 1 },
    allergies: { name: 'Allergie-Medikamente (Antihistaminika / Notfallset)', weight: 80, quantity: 1 },
    asthma: { name: 'Asthma-Inhalator & Notfallspray', weight: 120, quantity: 1 },
    diabetes: { name: 'Diabetes-Bedarf (Insulin, Messgerät, Traubenzucker)', weight: 300, quantity: 1 },
    motion_sickness: { name: 'Reisekrankheits-Tabletten / Kaugummis', weight: 50, quantity: 1 },
    contact_lenses: { name: 'Kontaktlinsen-Pflegemittel & Ersatzbrille', weight: 200, quantity: 1 }
};

export class PackingEngine {
    private communityBox: Item[] = [];

    constructor() { }

    public generateList(request: PackingRequest): { people: Person[]; communityBox: Item[] } {
        // Reset community box for fresh calculation
        this.communityBox = [];

        // Ensure safe people array
        const safePeople = Array.isArray(request.people) ? request.people : [];

        // 1. Proposal Phase (Generate Items based on weather/activity/base/health)
        const neededItems = this.generateProposedItems(request);

        // 2. Identify Shared vs Personal
        const sharedItems = neededItems.filter(i => i.category === 'shared');
        const personalItems = neededItems.filter(i => i.category !== 'shared');

        // 3. Distribute Personal Items (Individual copies for everyone + individual health items)
        this.distributePersonalItems(safePeople, personalItems);

        // 4. Distribute Shared Items based on Mode
        if (request.mode === 'SHARED') {
            this.distributeSharedItems(safePeople, sharedItems, request.transportLimit || 23000, request.days || 3);
        } else {
            // Independent Mode: Shared items go to Community Box
            this.calculateAndAddToCommunityBox(sharedItems, safePeople.length, request.days || 3);
        }

        return {
            people: safePeople,
            communityBox: this.communityBox
        };
    }

    private generateProposedItems(request: PackingRequest): Item[] {
        const items: Item[] = [];
        const { days, weatherCondition, weatherTriggers, activities, customCatalog } = request;

        // Weather Logic
        let isRainy = false;
        let isCold = false;

        if (weatherTriggers) {
            isRainy = weatherTriggers.isRainy;
            isCold = weatherTriggers.isCold;
        } else if (weatherCondition) {
            isRainy = weatherCondition.rainProbability > 30;
            isCold = weatherCondition.minTemp < 10;
        }

        if (customCatalog && customCatalog.length > 0) {
            // Dynamic generation from custom catalog
            const enabledItems = customCatalog.filter(c => c.enabled);
            for (const catItem of enabledItems) {
                // Weather conditions
                if (catItem.tags.includes('rain') && !isRainy) continue;
                if (catItem.tags.includes('cold') && !isCold) continue;

                const quantity = calculateCatalogItemQuantity(catItem, days, request.people.length);

                items.push({
                    id: catItem.id,
                    name: catItem.name,
                    weight: catItem.weight,
                    category: catItem.category,
                    tags: [...catItem.tags],
                    quantity
                });
            }
        } else {
            // Default Base Items (100% German)
            const underwearCount = days;
            const socksCount = days;
            const tShirtCount = days;
            const pantsCount = Math.max(1, Math.ceil(days / 3));
            const sweaterCount = Math.max(1, Math.ceil(days / 4));

            items.push(
                { id: 'underwear', name: 'Unterwäsche', weight: 50, category: 'clothing', tags: ['base'], quantity: underwearCount },
                { id: 'socks', name: 'Socken', weight: 50, category: 'clothing', tags: ['base'], quantity: socksCount },
                { id: 'jeans', name: 'Hosen / Jeans', weight: 600, category: 'clothing', tags: ['base'], quantity: pantsCount },
                { id: 'tshirt', name: 'T-Shirts', weight: 200, category: 'clothing', tags: ['base'], quantity: tShirtCount },
                { id: 'hoodie', name: 'Pullover / Hoodie', weight: 500, category: 'clothing', tags: ['base'], quantity: sweaterCount },
                { id: 'shoes', name: 'Schuhe', weight: 800, category: 'clothing', tags: ['base'], quantity: 1 },
                { id: 'jacket', name: 'Jacke', weight: 800, category: 'clothing', tags: ['base'], quantity: 1 }
            );

            if (isRainy) {
                items.push({ id: 'raincoat', name: 'Regenjacke', weight: 400, category: 'clothing', tags: ['rain'], quantity: 1 });
            }
            if (isCold) {
                items.push({ id: 'thermals', name: 'Thermokleidung / Skiunterwäsche', weight: 300, category: 'clothing', tags: ['cold'], quantity: 1 });
            }

            // Shared Items & Basis-Reiseapotheke (German)
            items.push(
                { id: 'toothpaste', name: 'Zahnpasta & Zahnbürste', weight: 150, category: 'shared', tags: ['hygiene'], quantity: 1 },
                { id: 'shampoo', name: 'Shampoo & Duschgel', weight: 300, category: 'shared', tags: ['hygiene'], quantity: 1 },
                { id: 'sunscreen', name: 'Sonnencreme', weight: 250, category: 'shared', tags: ['hygiene'], quantity: 1 },
                { id: 'powerbank', name: 'Powerbank', weight: 400, category: 'shared', tags: ['electronics'], quantity: 1 },
                // Basis-Reiseapotheke (Gemeinschaftlich)
                { id: 'first_aid_kit', name: 'Reiseapotheke (Schmerzmittel & Wundpflaster)', weight: 300, category: 'shared', tags: ['health', 'shared'], quantity: 1 },
                { id: 'stomach_meds', name: 'Magen-Darm-Präparate & Elektrolyte', weight: 150, category: 'shared', tags: ['health', 'shared'], quantity: 1 },
                { id: 'thermometer', name: 'Fieberthermometer', weight: 50, category: 'shared', tags: ['health', 'shared'], quantity: 1 }
            );
        }

        // Activity Logic from Activity Catalog
        if (activities && activities.length > 0) {
            const activityItems = getItemsForActivities(activities);
            activityItems.forEach(actItem => {
                // Prevent duplicate item IDs
                if (!items.some(i => i.id === actItem.id)) {
                    items.push(actItem);
                }
            });
        }

        return items;
    }

    private distributePersonalItems(people: Person[], items: Item[]) {
        if (!Array.isArray(people) || !Array.isArray(items)) return;

        people.forEach(person => {
            if (!person.inventory) person.inventory = [];
            if (typeof person.currentLoad !== 'number' || isNaN(person.currentLoad)) {
                person.currentLoad = 0;
            }

            // 1. Distribute standard personal items
            items.forEach(item => {
                if (!item) return;
                const personalItem = { ...item };

                // Age/Size Weight Adjustment (PRD: Child 0.6, Toddler 0.3)
                let factor = 1.0;
                if (item.category === 'clothing') {
                    if (person.type === 'CHILD') factor = 0.6;
                    if (person.type === 'TODDLER') factor = 0.3;
                }

                personalItem.weight = Math.round((item.weight || 0) * factor);
                personalItem.quantity = Math.max(1, item.quantity || 1);
                person.inventory.push(personalItem);
                person.currentLoad += (personalItem.weight * personalItem.quantity);
            });

            // 2. Distribute individual health/medication items
            if (Array.isArray(person.healthConditions) && person.healthConditions.length > 0) {
                person.healthConditions.forEach(cond => {
                    const def = HEALTH_ITEM_CATALOG[cond];
                    if (def) {
                        const medItem: Item = {
                            id: `med_${cond}_${person.id}`,
                            name: def.name,
                            weight: def.weight || 0,
                            category: 'misc',
                            tags: ['health', cond],
                            quantity: def.quantity || 1
                        };
                        person.inventory.push(medItem);
                        person.currentLoad += (medItem.weight * medItem.quantity);
                    }
                });
            }
        });
    }

    private distributeSharedItems(people: Person[], items: Item[], limit: number, days: number) {
        if (!Array.isArray(items) || items.length === 0) return;
        const safePeople = Array.isArray(people) ? people : [];
        const expandedItems = this.calculateSharedNeeds(items, safePeople.length, days);

        const priority: Record<string, number> = { 'ADULT': 0, 'TEEN': 1, 'CHILD': 2, 'TODDLER': 3 };
        const sortedPeople = [...safePeople].sort((a, b) => {
            const pA = priority[a.type] !== undefined ? priority[a.type] : 99;
            const pB = priority[b.type] !== undefined ? priority[b.type] : 99;
            return pA - pB;
        });

        for (const item of expandedItems) {
            let assigned = false;
            const eligibleCarriers = sortedPeople.filter(p => ['ADULT', 'TEEN'].includes(p.type));
            const candidates = eligibleCarriers.length > 0 ? eligibleCarriers : sortedPeople;
            candidates.sort((a, b) => (a.currentLoad || 0) - (b.currentLoad || 0));

            for (const person of candidates) {
                const totalWx = (item.weight || 0) * (item.quantity || 1);
                const pLimit = person.maxLoad || limit || 23000;
                if ((person.currentLoad || 0) + totalWx <= pLimit) {
                    if (!person.inventory) person.inventory = [];
                    person.inventory.push(item);
                    person.currentLoad = (person.currentLoad || 0) + totalWx;
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                if (sortedPeople.length > 0) {
                    const fallbackPerson = sortedPeople[0];
                    if (!fallbackPerson.inventory) fallbackPerson.inventory = [];
                    fallbackPerson.inventory.push(item);
                    fallbackPerson.currentLoad = (fallbackPerson.currentLoad || 0) + ((item.weight || 0) * (item.quantity || 1));
                } else {
                    this.communityBox.push(item);
                }
            }
        }
    }

    private calculateAndAddToCommunityBox(items: Item[], personCount: number, days: number) {
        if (!Array.isArray(items) || items.length === 0) return;
        const expandedItems = this.calculateSharedNeeds(items, personCount, days);
        this.communityBox.push(...expandedItems);
    }

    private calculateSharedNeeds(baseItems: Item[], personCount: number, days: number): Item[] {
        if (!Array.isArray(baseItems)) return [];
        const result: Item[] = [];
        const safePersonCount = Math.max(1, personCount || 1);
        const safeDays = Math.max(1, days || 1);
        const personDays = safePersonCount * safeDays;

        const usageRates: Record<string, number> = {
            'toothpaste': 30, // 1 tube for 30 person-days
            'shampoo': 20,
            'sunscreen': 15,
            'powerbank': 1000,
            'first_aid_kit': 1000,
            'stomach_meds': 1000,
            'thermometer': 1000
        };

        for (const item of baseItems) {
            if (!item) continue;
            let count = 1;
            if (usageRates[item.id]) {
                count = Math.ceil(personDays / usageRates[item.id]);
            } else {
                count = Math.max(1, Math.ceil(safePersonCount / 4));
            }

            for (let i = 0; i < count; i++) {
                result.push({
                    ...item,
                    id: count > 1 ? `${item.id}_${i + 1}` : item.id,
                    quantity: item.quantity || 1
                });
            }
        }
        return result;
    }
}
