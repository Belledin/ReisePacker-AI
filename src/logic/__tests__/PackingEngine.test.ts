import { PackingEngine, PackingRequest, Person, HealthConditionType, HEALTH_ITEM_CATALOG } from '../PackingEngine';

describe('PackingEngine', () => {
    let engine: PackingEngine;

    // Helper to create people
    const createPerson = (id: string, type: any, healthConditions?: HealthConditionType[]): Person => ({
        id, name: id, type, inventory: [], currentLoad: 0, maxLoad: 23000,
        healthConditions: healthConditions || []
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

    test('German localization: all base items have German names', () => {
        const request: PackingRequest = {
            destination: 'München',
            days: 3,
            people: [createPerson('p1', 'ADULT')],
            activities: [],
            weatherCondition: { rainProbability: 50, minTemp: 5 },
            transportLimit: 23000,
            mode: 'SHARED'
        };

        const { people } = engine.generateList(request);
        const inventory = people[0].inventory;

        // Check German names for base items
        expect(inventory.some(i => i.name === 'Unterwäsche')).toBe(true);
        expect(inventory.some(i => i.name === 'Socken')).toBe(true);
        expect(inventory.some(i => i.name === 'Hosen / Jeans')).toBe(true);
        expect(inventory.some(i => i.name === 'T-Shirts')).toBe(true);
        expect(inventory.some(i => i.name === 'Pullover / Hoodie')).toBe(true);
        expect(inventory.some(i => i.name === 'Schuhe')).toBe(true);
        expect(inventory.some(i => i.name === 'Jacke')).toBe(true);

        // Check German weather items
        expect(inventory.some(i => i.name === 'Regenjacke')).toBe(true);
        expect(inventory.some(i => i.name === 'Thermokleidung / Skiunterwäsche')).toBe(true);
    });

    test('Shared Mode: Distribution to Adults (German names)', () => {
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

        // Shared items like Zahnpasta should go to the Adult
        const toothpaste = p1.inventory.find(i => i.id.startsWith('toothpaste'));
        expect(toothpaste).toBeDefined();
        expect(toothpaste!.name).toBe('Zahnpasta & Zahnbürste');

        const kidToothpaste = p2.inventory.find(i => i.id.startsWith('toothpaste'));
        expect(kidToothpaste).toBeUndefined();
    });

    test('Shared Mode: Weight Limit Check (Overload)', () => {
        const p1 = createPerson('Dad', 'ADULT');
        p1.currentLoad = 22900; // Almost full, only 100g left

        const request: PackingRequest = {
            destination: 'Resort',
            days: 7,
            people: [p1],
            activities: [],
            transportLimit: 23000,
            mode: 'SHARED'
        };

        engine.generateList(request);

        // Since Dad is the only one, it "Force Assigned" as overflow.
        expect(p1.inventory.some(i => i.id.startsWith('toothpaste'))).toBe(true);
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
        expect(box.some(i => i.name === 'Zahnpasta & Zahnbürste')).toBe(true);

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

        engine.generateList(request);

        // A2 should get shared items first (lower load)
        const a2Shared = p2.inventory.filter(i => i.category === 'shared');
        expect(a2Shared.length).toBeGreaterThan(0);
    });

    test('Reiseapotheke: shared medical items in Community Box', () => {
        const request: PackingRequest = {
            destination: 'Mallorca',
            days: 5,
            people: [createPerson('Solo', 'ADULT')],
            activities: [],
            transportLimit: 23000,
            mode: 'INDEPENDENT'
        };

        const { communityBox } = engine.generateList(request);

        // Reiseapotheke items should be present
        expect(communityBox.some(i => i.id.startsWith('first_aid_kit'))).toBe(true);
        expect(communityBox.some(i => i.id.startsWith('stomach_meds'))).toBe(true);
        expect(communityBox.some(i => i.id.startsWith('thermometer'))).toBe(true);

        // Verify German names
        expect(communityBox.some(i => i.name === 'Reiseapotheke (Schmerzmittel & Wundpflaster)')).toBe(true);
        expect(communityBox.some(i => i.name === 'Magen-Darm-Präparate & Elektrolyte')).toBe(true);
        expect(communityBox.some(i => i.name === 'Fieberthermometer')).toBe(true);
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

    describe('Health & Medication Module', () => {
        test('should add personal medication items for a person with healthConditions', () => {
            const alice = createPerson('Alice', 'ADULT', ['daily_meds', 'allergies']);

            const request: PackingRequest = {
                destination: 'Rom',
                days: 5,
                people: [alice],
                activities: [],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            const inventory = people[0].inventory;

            // Should have personal medication items
            expect(inventory.some(i => i.id === 'med_daily_meds')).toBe(true);
            expect(inventory.some(i => i.id === 'med_allergies')).toBe(true);

            // Verify German names from HEALTH_ITEM_CATALOG
            const dailyMed = inventory.find(i => i.id === 'med_daily_meds')!;
            expect(dailyMed.name).toBe(HEALTH_ITEM_CATALOG.daily_meds.name);
            expect(dailyMed.tags).toContain('health');
            expect(dailyMed.tags).toContain('daily_meds');

            const allergyMed = inventory.find(i => i.id === 'med_allergies')!;
            expect(allergyMed.name).toBe(HEALTH_ITEM_CATALOG.allergies.name);
        });

        test('should NOT add health items when person has no healthConditions', () => {
            const bob = createPerson('Bob', 'ADULT');

            const request: PackingRequest = {
                destination: 'Paris',
                days: 3,
                people: [bob],
                activities: [],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            const inventory = people[0].inventory;

            // No med_ prefixed items
            expect(inventory.filter(i => i.id.startsWith('med_')).length).toBe(0);
        });

        test('should add different health items per person correctly', () => {
            const alice = createPerson('Alice', 'ADULT', ['asthma']);
            const bob = createPerson('Bob', 'ADULT', ['diabetes', 'contact_lenses']);

            const request: PackingRequest = {
                destination: 'London',
                days: 4,
                people: [alice, bob],
                activities: [],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);

            // Alice should have asthma item only
            expect(people[0].inventory.some(i => i.id === 'med_asthma')).toBe(true);
            expect(people[0].inventory.some(i => i.id === 'med_diabetes')).toBe(false);

            // Bob should have diabetes and contact_lenses items
            expect(people[1].inventory.some(i => i.id === 'med_diabetes')).toBe(true);
            expect(people[1].inventory.some(i => i.id === 'med_contact_lenses')).toBe(true);
            expect(people[1].inventory.some(i => i.id === 'med_asthma')).toBe(false);
        });

        test('should add health item weight to person currentLoad', () => {
            const alice = createPerson('Alice', 'ADULT', ['diabetes']);

            const request: PackingRequest = {
                destination: 'Wien',
                days: 3,
                people: [alice],
                activities: [],
                transportLimit: 23000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);

            // The person should have increased currentLoad due to med_diabetes (300g)
            const diabetesItem = people[0].inventory.find(i => i.id === 'med_diabetes')!;
            expect(diabetesItem.weight).toBe(HEALTH_ITEM_CATALOG.diabetes.weight);
            expect(people[0].currentLoad).toBeGreaterThan(0);
        });

        test('should include all 6 health condition types correctly', () => {
            const allConditions: HealthConditionType[] = [
                'daily_meds', 'allergies', 'asthma', 'diabetes', 'motion_sickness', 'contact_lenses'
            ];
            const person = createPerson('Max', 'ADULT', allConditions);

            const request: PackingRequest = {
                destination: 'Bangkok',
                days: 10,
                people: [person],
                activities: [],
                transportLimit: 50000,
                mode: 'SHARED'
            };

            const { people } = engine.generateList(request);
            const medItems = people[0].inventory.filter(i => i.id.startsWith('med_'));

            expect(medItems.length).toBe(6);
            allConditions.forEach(cond => {
                expect(medItems.some(i => i.id === `med_${cond}`)).toBe(true);
            });
        });
    });
});
