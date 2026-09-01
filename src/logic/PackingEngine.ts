export type PersonType = 'ADULT' | 'TEEN' | 'CHILD' | 'TODDLER';

export interface Person {
    id: string;
    name: string;
    type: PersonType;
    inventory: Item[];
    currentLoad: number; // in grams
    maxLoad: number; // in grams (derived from transport limit)
}

export type Category = 'clothing' | 'hygiene' | 'electronics' | 'misc' | 'shared';

export interface Item {
    id: string;
    name: string;
    weight: number; // in grams (per unit)
    category: Category;
    tags: string[]; // e.g., 'rain', 'hiking'
    quantity: number; // Default 1
}

import { WeatherTriggers } from '../services/WeatherService';
import { getItemsForActivities } from './activityCatalog';

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
}

export class PackingEngine {
    private communityBox: Item[] = [];

    constructor() { }

    public generateList(request: PackingRequest): { people: Person[]; communityBox: Item[] } {
        // 1. Proposal Phase (Generate Items based on weather/activity)
        const neededItems = this.generateProposedItems(request);

        // 2. Identify Shared vs Personal
        const sharedItems = neededItems.filter(i => i.category === 'shared');
        const personalItems = neededItems.filter(i => i.category !== 'shared');

        // 3. Distribute Personal Items (Individual copies for everyone)
        this.distributePersonalItems(request.people, personalItems);

        // 4. Distribute Shared Items based on Mode
        if (request.mode === 'SHARED') {
            this.distributeSharedItems(request.people, sharedItems, request.transportLimit, request.days);
        } else {
            // Independent Mode: Shared items go to Community Box
            this.calculateAndAddToCommunityBox(sharedItems, request.people.length, request.days);
        }

        return {
            people: request.people,
            communityBox: this.communityBox
        };
    }

    private generateProposedItems(request: PackingRequest): Item[] {
        const items: Item[] = [];
        const { days, weatherCondition, weatherTriggers, activities } = request;

        // Base Clothing Rule: Days + 1 sets of basic clothes
        // const clothesCount = days + 1; // Deprecated logic, now per item

        // Quantities
        const underwearCount = days;
        const socksCount = days;
        const tShirtCount = days;
        const pantsCount = Math.max(1, Math.ceil(days / 3));
        const sweaterCount = Math.max(1, Math.ceil(days / 4));

        // Add Base Items
        items.push(
            { id: 'underwear', name: 'Underwear', weight: 50, category: 'clothing', tags: ['base'], quantity: underwearCount },
            { id: 'socks', name: 'Socks', weight: 50, category: 'clothing', tags: ['base'], quantity: socksCount },
            { id: 'jeans', name: 'Pants/Jeans', weight: 600, category: 'clothing', tags: ['base'], quantity: pantsCount },
            { id: 'tshirt', name: 'T-Shirt', weight: 200, category: 'clothing', tags: ['base'], quantity: tShirtCount },
            { id: 'hoodie', name: 'Hoodie/Sweater', weight: 500, category: 'clothing', tags: ['base'], quantity: sweaterCount },
            { id: 'shoes', name: 'Shoes', weight: 800, category: 'clothing', tags: ['base'], quantity: 1 },
            { id: 'jacket', name: 'Jacket', weight: 800, category: 'clothing', tags: ['base'], quantity: 1 }
        );

        // Weather Logic (Phase 4: Support Triggers)
        let isRainy = false;
        let isCold = false;

        // Priority to Triggers if available
        if (weatherTriggers) {
            isRainy = weatherTriggers.isRainy;
            isCold = weatherTriggers.isCold;
        } else if (weatherCondition) {
            // Fallback to legacy calc
            isRainy = weatherCondition.rainProbability > 30;
            isCold = weatherCondition.minTemp < 10;
        }

        if (isRainy) {
            items.push({ id: 'raincoat', name: 'Rain Coat', weight: 400, category: 'clothing', tags: ['rain'], quantity: 1 });
        }
        if (isCold) {
            items.push({ id: 'thermals', name: 'Thermal Underwear', weight: 300, category: 'clothing', tags: ['cold'], quantity: 1 });
        }

        // Activity Logic from Activity Catalog (Phase 5 Extension)
        if (activities && activities.length > 0) {
            const activityItems = getItemsForActivities(activities);
            activityItems.forEach(actItem => {
                // Prevent duplicate item IDs
                if (!items.some(i => i.id === actItem.id)) {
                    items.push(actItem);
                }
            });
        }

        // Shared Items (Definitions)
        items.push(
            { id: 'toothpaste', name: 'Toothpaste', weight: 150, category: 'shared', tags: ['hygiene'], quantity: 1 },
            { id: 'shampoo', name: 'Shampoo', weight: 300, category: 'shared', tags: ['hygiene'], quantity: 1 },
            { id: 'sunscreen', name: 'Sunscreen', weight: 250, category: 'shared', tags: ['hygiene'], quantity: 1 },
            { id: 'powerbank', name: 'Powerbank', weight: 400, category: 'shared', tags: ['electronics'], quantity: 1 }
        );

        return items;
    }

    private distributePersonalItems(people: Person[], items: Item[]) {
        people.forEach(person => {
            items.forEach(item => {
                // Clone item to avoid reference issues
                const personalItem = { ...item };

                // Age/Size Weight Adjustment (PRD: Child 0.6, Toddler 0.3)
                let factor = 1.0;
                if (item.category === 'clothing') {
                    if (person.type === 'CHILD') factor = 0.6;
                    if (person.type === 'TODDLER') factor = 0.3;
                }

                personalItem.weight = Math.round(item.weight * factor);

                person.inventory.push(personalItem);

                // Load = Weight * Quantity
                person.currentLoad += (personalItem.weight * personalItem.quantity);
            });
        });
    }

    private distributeSharedItems(people: Person[], items: Item[], limit: number, days: number) {
        // 1. Calculate Total Shared Needs
        const expandedItems = this.calculateSharedNeeds(items, people.length, days);

        // 2. Sort People by Capacity (Adults first)
        const sortedPeople = [...people].sort((a, b) => {
            const priority = { 'ADULT': 0, 'TEEN': 1, 'CHILD': 2, 'TODDLER': 3 };
            return priority[a.type] - priority[b.type];
        });

        // 3. Round Robin Distribution with Weight Check
        for (const item of expandedItems) {
            let assigned = false;
            const eligibleCarriers = sortedPeople.filter(p => ['ADULT', 'TEEN'].includes(p.type));
            const candidates = eligibleCarriers.length > 0 ? eligibleCarriers : sortedPeople;
            candidates.sort((a, b) => a.currentLoad - b.currentLoad);

            for (const person of candidates) {
                // Check Weight Limit (Item Weight * Quantity, which is usually 1 for shared calculated items but lets be safe)
                const totalWx = item.weight * item.quantity;
                if (person.currentLoad + totalWx <= limit) {
                    person.inventory.push(item);
                    person.currentLoad += totalWx;
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                if (sortedPeople.length > 0) {
                    sortedPeople[0].inventory.push(item);
                    sortedPeople[0].currentLoad += (item.weight * item.quantity);
                }
            }
        }
    }

    private calculateAndAddToCommunityBox(items: Item[], personCount: number, days: number) {
        const expandedItems = this.calculateSharedNeeds(items, personCount, days);
        this.communityBox.push(...expandedItems);
    }

    private calculateSharedNeeds(baseItems: Item[], personCount: number, days: number): Item[] {
        const result: Item[] = [];
        const personDays = personCount * days;

        const usageRates: Record<string, number> = {
            'toothpaste': 30, // 1 tube for 30 person-days
            'shampoo': 20,
            'sunscreen': 15,
            'powerbank': 1000
        };

        for (const item of baseItems) {
            let count = 1;
            if (usageRates[item.id]) {
                count = Math.ceil(personDays / usageRates[item.id]);
            } else {
                count = Math.ceil(personCount / 4);
            }

            for (let i = 0; i < count; i++) {
                // Shared items usually are single units in the list, so Qty 1 each
                result.push({ ...item, id: `${item.id}_${i + 1}`, quantity: 1 });
            }
        }
        return result;
    }

}
