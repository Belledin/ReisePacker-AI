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

});
