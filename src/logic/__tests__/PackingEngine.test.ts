import { PackingEngine, PackingRequest, Person } from '../PackingEngine';

describe('PackingEngine', () => {
    let engine: PackingEngine;

    // Helper to create people
    const createPerson = (id: string, type: any): Person => ({
        id, name: id, type, inventory: [], currentLoad: 0, maxLoad: 23000
    });

    beforeEach(() => {
        engine = new PackingEngine();
    });

    test('Proposal Phase: Weather & Activity', () => {
        const request: PackingRequest = {
            destination: 'Berlin',
            days: 3,
            people: [createPerson('p1', 'ADULT')],
            activities: ['hiking'],
            weatherCondition: { rainProbability: 50, minTemp: 5 },
            transportLimit: 23000,
            mode: 'SHARED'
        };

        const { people } = engine.generateList(request);
        const inventory = people[0].inventory;

        // Check Weather Items
        expect(inventory.some(i => i.id === 'raincoat')).toBe(true);
        expect(inventory.some(i => i.id === 'thermals')).toBe(true);

        // Check Activity Items
        expect(inventory.some(i => i.id === 'hiking_boots')).toBe(true);

        // Check Base Items (Clothes)
        expect(inventory.some(i => i.id === 'jeans')).toBe(true);
    });

    test('Shared Mode: Distribution to Adults', () => {
        const p1 = createPerson('Dad', 'ADULT');
        const p2 = createPerson('Kid', 'CHILD');

        const request: PackingRequest = {
            destination: 'Resort',
            days: 7,
            people: [p1, p2],
            activities: [],
            transportLimit: 23000,
            mode: 'SHARED'
        };

        engine.generateList(request);

        // Shared items like Toothpaste should go to the Adult
        const toothpaste = p1.inventory.find(i => i.name === 'Toothpaste');
        expect(toothpaste).toBeDefined();

        const kidToothpaste = p2.inventory.find(i => i.name === 'Toothpaste');
        expect(kidToothpaste).toBeUndefined();
    });

    test('Shared Mode: Weight Limit Check (Overload)', () => {
        const p1 = createPerson('Dad', 'ADULT');
        p1.currentLoad = 22900; // Almost full, only 100g left

        // Toothpaste is 150g -> fits? No, 22900+150 = 23050 > 23000
        // Should find another person or force assign if no one else.

        const request: PackingRequest = {
            destination: 'Resort',
            days: 7,
            people: [p1],
            activities: [],
            transportLimit: 23000,
            mode: 'SHARED'
        };

        engine.generateList(request);

        // Since Dad is the only one, it effectively "Force Assigned" or handled as overflow.
        // In my logic: "Force assign to first adult" if no one fits to ensure item isn't lost.
        // Let's verify he has it.
        expect(p1.inventory.some(i => i.name === 'Toothpaste')).toBe(true);
        expect(p1.currentLoad).toBeGreaterThan(23000);
    });

    test('Independent Mode: Community Box', () => {
        const p1 = createPerson('Alice', 'ADULT');
        const p2 = createPerson('Bob', 'ADULT');

        const request: PackingRequest = {
            destination: 'Camp',
            days: 3,
            people: [p1, p2],
            activities: [],
            transportLimit: 23000,
            mode: 'INDEPENDENT'
        };

        const result = engine.generateList(request);

        // Personal items distributed
        expect(p1.inventory.length).toBeGreaterThan(0);

        // Shared items in Community Box
        const box = result.communityBox;
        expect(box.length).toBeGreaterThan(0);
        expect(box.some(i => i.name === 'Toothpaste')).toBe(true);

        // Verify NO shared items in personal inventory
        expect(p1.inventory.some(i => i.category === 'shared')).toBe(false);
    });

    test('Shared Mode: Distribution Balance (Multiple Adults)', () => {
        const p1 = createPerson('A1', 'ADULT');
        const p2 = createPerson('A2', 'ADULT');
        // A1 has more load initially
        p1.currentLoad = 5000;
        p2.currentLoad = 1000;

        const request: PackingRequest = {
            destination: 'Trip',
            days: 7,
            people: [p1, p2],
            activities: [],
            transportLimit: 23000,
            mode: 'SHARED'
        };

        // We expect shared items to go to A2 first because they have lower load
        engine.generateList(request);

        // Check who got the first shared item (e.g. Toothpaste)
        // Implementation sorts candidates by load. A2 (1000) < A1 (5000).
        // A2 should get the first item.

        // Simply check that A2 has more shared items or at least some
        const a2Shared = p2.inventory.filter(i => i.category === 'shared');
        expect(a2Shared.length).toBeGreaterThan(0);
    });

    describe('Activity Catalog & Multi-Activity Packing', () => {
        test('should generate items for various activities (beach, ski, business, cycling, camping, fitness)', () => {
            const request: PackingRequest = {
                destination: 'Alps & Sea',
                days: 5,
                people: [createPerson('Traveler', 'ADULT')],
                activities: ['beach', 'ski', 'business', 'cycling', 'camping', 'fitness'],
                transportLimit: 50000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            const inventory = people[0].inventory;

            // Personal activity clothing & misc items
            expect(inventory.some(i => i.id === 'swimsuit')).toBe(true);
            expect(inventory.some(i => i.id === 'ski_jacket')).toBe(true);
            expect(inventory.some(i => i.id === 'dress_shirt')).toBe(true);
            expect(inventory.some(i => i.id === 'cycling_jersey')).toBe(true);
            expect(inventory.some(i => i.id === 'sleeping_bag')).toBe(true);
            expect(inventory.some(i => i.id === 'sport_outfit')).toBe(true);
        });

        test('should deduplicate items across overlapping activities (e.g. daypack in hiking & sightseeing)', () => {
            const request: PackingRequest = {
                destination: 'Munich',
                days: 4,
                people: [createPerson('Hiker', 'ADULT')],
                activities: ['hiking', 'sightseeing'],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            const daypackItems = people[0].inventory.filter(i => i.id === 'daypack');

            // Should be deduplicated to exactly 1 item
            expect(daypackItems.length).toBe(1);
        });

        test('should scale clothing items from activities according to person type (Child 0.6, Toddler 0.3)', () => {
            const adult = createPerson('Adult', 'ADULT');
            const child = createPerson('Child', 'CHILD');
            const toddler = createPerson('Toddler', 'TODDLER');

            const request: PackingRequest = {
                destination: 'Beach Resort',
                days: 3,
                people: [adult, child, toddler],
                activities: ['beach'],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);

            const adultSwimsuit = people.find(p => p.id === 'Adult')!.inventory.find(i => i.id === 'swimsuit')!;
            const childSwimsuit = people.find(p => p.id === 'Child')!.inventory.find(i => i.id === 'swimsuit')!;
            const toddlerSwimsuit = people.find(p => p.id === 'Toddler')!.inventory.find(i => i.id === 'swimsuit')!;

            expect(adultSwimsuit.weight).toBe(150);
            expect(childSwimsuit.weight).toBe(Math.round(150 * 0.6)); // 90g
            expect(toddlerSwimsuit.weight).toBe(Math.round(150 * 0.3)); // 45g
        });

        test('should distribute activity shared items into Community Box in Independent Mode', () => {
            const p1 = createPerson('Alice', 'ADULT');
            const p2 = createPerson('Bob', 'ADULT');

            const request: PackingRequest = {
                destination: 'Wild Camping',
                days: 3,
                people: [p1, p2],
                activities: ['camping', 'hiking'],
                transportLimit: 23000,
                mode: 'INDEPENDENT'
            };

            const { communityBox } = engine.generateList(request);

            // Activity shared items in Community Box
            expect(communityBox.some(i => i.id.startsWith('camping_stove'))).toBe(true);
            expect(communityBox.some(i => i.id.startsWith('mosquito_spray'))).toBe(true);
            expect(communityBox.some(i => i.id.startsWith('first_aid_hiking'))).toBe(true);
        });

        test('should handle unknown or empty activities gracefully', () => {
            const request: PackingRequest = {
                destination: 'Nowhere',
                days: 2,
                people: [createPerson('Solo', 'ADULT')],
                activities: ['unknown_activity', 'another_invalid' as any],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            // Should still have base items
            expect(people[0].inventory.some(i => i.id === 'underwear')).toBe(true);
            expect(people[0].inventory.some(i => i.id === 'tshirt')).toBe(true);
        });
    });
});
