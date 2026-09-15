import { StorageService, SimpleStorageProvider } from '../StorageService';
import { CatalogItem } from '../../logic/defaultCatalog';

class MockStorage implements SimpleStorageProvider {
    private store: Record<string, string> = {};

    getItem(key: string): string | null {
        return this.store[key] || null;
    }

    setItem(key: string, value: string): void {
        this.store[key] = value;
    }

    removeItem(key: string): void {
        delete this.store[key];
    }
}

describe('StorageService', () => {
    let mockStorage: MockStorage;

    beforeEach(() => {
        mockStorage = new MockStorage();
        StorageService.setStorageProvider(mockStorage);
    });

    afterEach(() => {
        StorageService.setStorageProvider(null);
    });

    const sampleItems: CatalogItem[] = [
        {
            id: 'item_1',
            name: 'Sonnenbrille',
            weight: 50,
            category: 'misc',
            tags: ['beach'],
            ruleType: 'FIXED',
            ruleValue: 1,
            defaultQuantity: 1,
            isDefault: false,
            enabled: true
        }
    ];

    test('should save and load catalog from storage', () => {
        StorageService.saveCatalog(sampleItems);
        const loaded = StorageService.loadCatalog();

        expect(loaded).toBeDefined();
        expect(loaded?.length).toBe(1);
        expect(loaded?.[0].name).toBe('Sonnenbrille');
    });

    test('should return null when loading empty storage or invalid JSON', () => {
        expect(StorageService.loadCatalog()).toBeNull();

        mockStorage.setItem('reisepacker_catalog_items_v1', 'not valid json');
        expect(StorageService.loadCatalog()).toBeNull();

        mockStorage.setItem('reisepacker_catalog_items_v1', JSON.stringify({ not: 'an array' }));
        expect(StorageService.loadCatalog()).toBeNull();
    });

    test('should clear catalog from storage', () => {
        StorageService.saveCatalog(sampleItems);
        expect(StorageService.loadCatalog()).not.toBeNull();

        StorageService.clearCatalog();
        expect(StorageService.loadCatalog()).toBeNull();
    });

    test('should export catalog to formatted JSON', () => {
        const json = StorageService.exportCatalogJson(sampleItems);
        expect(typeof json).toBe('string');
        const parsed = JSON.parse(json);
        expect(parsed[0].id).toBe('item_1');
    });

    test('should import valid catalog JSON', () => {
        const json = JSON.stringify([
            {
                id: 'imported_1',
                name: 'Taschenlampe',
                weight: 120,
                category: 'electronics',
                tags: ['camping'],
                ruleType: 'FIXED',
                ruleValue: 1,
                defaultQuantity: 1
            }
        ]);

        const imported = StorageService.importCatalogJson(json);
        expect(imported.length).toBe(1);
        expect(imported[0].name).toBe('Taschenlampe');
        expect(imported[0].weight).toBe(120);
        expect(imported[0].enabled).toBe(true);
    });

    test('should throw on invalid JSON or missing required fields during import', () => {
        expect(() => StorageService.importCatalogJson('{ broken json')).toThrow('Ungültiges JSON-Format');
        expect(() => StorageService.importCatalogJson('{}')).toThrow('Liste (Array)');
        expect(() => StorageService.importCatalogJson('[{"weight": 50}]')).toThrow('gültigen Namen oder ID');
    });
});
