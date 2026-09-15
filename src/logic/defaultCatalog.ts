import { Category } from './PackingEngine';

export type QuantityRuleType = 'FIXED' | 'PER_DAY' | 'PER_X_DAYS' | 'SHARED_PER_PEOPLE';

export interface CatalogItem {
    id: string;
    name: string;
    weight: number; // in grams per unit
    category: Category;
    tags: string[]; // e.g. 'base', 'rain', 'cold', 'hiking', 'health', 'shared'
    ruleType: QuantityRuleType;
    ruleValue: number; // e.g. 1 for FIXED or PER_DAY, 3 for PER_X_DAYS (every 3 days), 4 for SHARED_PER_PEOPLE (1 per 4 people)
    defaultQuantity: number;
    isDefault: boolean;
    enabled: boolean;
}

export const DEFAULT_CATALOG_ITEMS: CatalogItem[] = [
    // Basis-Kleidung
    {
        id: 'underwear',
        name: 'Unterwäsche',
        weight: 50,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'PER_DAY',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'socks',
        name: 'Socken',
        weight: 50,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'PER_DAY',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'jeans',
        name: 'Hosen / Jeans',
        weight: 600,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'PER_X_DAYS',
        ruleValue: 3,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'tshirt',
        name: 'T-Shirts',
        weight: 200,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'PER_DAY',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'hoodie',
        name: 'Pullover / Hoodie',
        weight: 500,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'PER_X_DAYS',
        ruleValue: 4,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'shoes',
        name: 'Schuhe',
        weight: 800,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'jacket',
        name: 'Jacke',
        weight: 800,
        category: 'clothing',
        tags: ['base'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },

    // Dokumente & Elektronik (Persönlich)
    {
        id: 'passport',
        name: 'Personalausweis / Reisepass',
        weight: 50,
        category: 'documents',
        tags: ['base', 'documents'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'insurance_card',
        name: 'Krankenkassenkarte / Auslandsschutz',
        weight: 20,
        category: 'documents',
        tags: ['base', 'documents'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'phone_charger',
        name: 'Ladekabel für Smartphone',
        weight: 80,
        category: 'electronics',
        tags: ['base', 'electronics'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },

    // Wetter-Konditioniert
    {
        id: 'raincoat',
        name: 'Regenjacke',
        weight: 400,
        category: 'clothing',
        tags: ['rain'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'thermals',
        name: 'Thermokleidung / Skiunterwäsche',
        weight: 300,
        category: 'clothing',
        tags: ['cold'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },

    // Geteilte Artikel (Hygiene & Elektronik)
    {
        id: 'toothpaste',
        name: 'Zahnpasta & Zahnbürste',
        weight: 150,
        category: 'shared',
        tags: ['hygiene', 'shared'],
        ruleType: 'SHARED_PER_PEOPLE',
        ruleValue: 4,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'shampoo',
        name: 'Shampoo & Duschgel',
        weight: 300,
        category: 'shared',
        tags: ['hygiene', 'shared'],
        ruleType: 'SHARED_PER_PEOPLE',
        ruleValue: 4,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'sunscreen',
        name: 'Sonnencreme',
        weight: 250,
        category: 'shared',
        tags: ['hygiene', 'shared'],
        ruleType: 'SHARED_PER_PEOPLE',
        ruleValue: 4,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'powerbank',
        name: 'Powerbank',
        weight: 400,
        category: 'shared',
        tags: ['electronics', 'shared'],
        ruleType: 'SHARED_PER_PEOPLE',
        ruleValue: 4,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },

    // Basis-Reiseapotheke (Gemeinschaftlich)
    {
        id: 'first_aid_kit',
        name: 'Reiseapotheke (Schmerzmittel & Wundpflaster)',
        weight: 300,
        category: 'shared',
        tags: ['health', 'shared'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'stomach_meds',
        name: 'Magen-Darm-Präparate & Elektrolyte',
        weight: 150,
        category: 'shared',
        tags: ['health', 'shared'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    },
    {
        id: 'thermometer',
        name: 'Fieberthermometer',
        weight: 50,
        category: 'shared',
        tags: ['health', 'shared'],
        ruleType: 'FIXED',
        ruleValue: 1,
        defaultQuantity: 1,
        isDefault: true,
        enabled: true
    }
];
