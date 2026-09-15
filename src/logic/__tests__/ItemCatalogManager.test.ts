import { ItemCatalogManager } from '../ItemCatalogManager';
import { StorageService } from '../../services/StorageService';
import { DEFAULT_CATALOG_ITEMS } from '../defaultCatalog';

describe('ItemCatalogManager', () => {
    let storageMock: Record<string, string> = {};

    beforeEach(() => {
        storageMock = {};
        jest.spyOn(StorageService, 'loadCatalog').mockImplementation(() => {
            const raw = storageMock['reisepacker_catalog_items_v1'];
            return raw ? JSON.parse(raw) : null;
        });
        jest.spyOn(StorageService, 'saveCatalog').mockImplementation((items) => {
            storageMock['reisepacker_catalog_items_v1'] = JSON.stringify(items);
        });
        jest.spyOn(StorageService, 'clearCatalog').mockImplementation(() => {
            delete storageMock['reisepacker_catalog_items_v1'];
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should initialize with default items when storage is empty', () => {
        const manager = new ItemCatalogManager();
        const allItems = manager.getAll();

        expect(allItems.length).toBe(DEFAULT_CATALOG_ITEMS.length);
        expect(allItems[0].id).toBe(DEFAULT_CATALOG_ITEMS[0].id);
        expect(manager.getEnabled().length).toBe(DEFAULT_CATALOG_ITEMS.length);
    });

    test('should add a custom item and make ID unique', () => {
        const manager = new ItemCatalogManager();
        const initialCount = manager.getAll().length;

        const newItem = manager.addItem({
            name: 'Kamera-Stativ',
            weight: 450,
            category: 'electronics',
            tags: ['photo'],
            ruleType: 'FIXED',
            ruleValue: 1,
            defaultQuantity: 1,
            enabled: true
        });

        expect(newItem.id).toBeDefined();
        expect(newItem.isDefault).toBe(false);
        expect(manager.getAll().length).toBe(initialCount + 1);
        expect(manager.getById(newItem.id)?.name).toBe('Kamera-Stativ');

        // Add with duplicate ID
        const dupItem = manager.addItem({
            id: newItem.id,
            name: 'Zweites Stativ',
            weight: 500,
            category: 'electronics',
            tags: [],
            ruleType: 'FIXED',
            ruleValue: 1,
            defaultQuantity: 1,
            enabled: true
        });
        expect(dupItem.id).not.toBe(newItem.id);
        expect(dupItem.id.startsWith(newItem.id)).toBe(true);
    });

    test('should update existing item properties', () => {
        const manager = new ItemCatalogManager();
        const first = manager.getAll()[0];

        const updated = manager.updateItem(first.id, {
            name: 'Super Unterwäsche',
            weight: 75
        });

        expect(updated).toBe(true);
        expect(manager.getById(first.id)?.name).toBe('Super Unterwäsche');
        expect(manager.getById(first.id)?.weight).toBe(75);

        // Update non-existing item
        expect(manager.updateItem('non_existing_id', { name: 'Foo' })).toBe(false);
    });

    test('should delete an item', () => {
        const manager = new ItemCatalogManager();
        const custom = manager.addItem({
            name: 'Schnorchel',
            weight: 300,
            category: 'misc',
            tags: ['beach'],
            ruleType: 'FIXED',
            ruleValue: 1,
            defaultQuantity: 1,
            enabled: true
        });

        expect(manager.getById(custom.id)).toBeDefined();
        const deleted = manager.deleteItem(custom.id);
        expect(deleted).toBe(true);
        expect(manager.getById(custom.id)).toBeUndefined();

        // Delete non-existent item
        expect(manager.deleteItem('unknown_id')).toBe(false);
    });

    test('should toggle item enabled state', () => {
        const manager = new ItemCatalogManager();
        const first = manager.getAll()[0];
        expect(first.enabled).toBe(true);

        manager.toggleEnabled(first.id);
        expect(manager.getById(first.id)?.enabled).toBe(false);
        expect(manager.getEnabled().some(i => i.id === first.id)).toBe(false);

        manager.toggleEnabled(first.id);
        expect(manager.getById(first.id)?.enabled).toBe(true);

        expect(manager.toggleEnabled('unknown_id')).toBe(false);
    });

    test('should reset to default items', () => {
        const manager = new ItemCatalogManager();
        manager.addItem({
            name: 'Extra Item',
            weight: 100,
            category: 'misc',
            tags: [],
            ruleType: 'FIXED',
            ruleValue: 1,
            defaultQuantity: 1,
            enabled: true
        });

        expect(manager.getAll().length).toBeGreaterThan(DEFAULT_CATALOG_ITEMS.length);
        manager.resetToDefaults();
        expect(manager.getAll().length).toBe(DEFAULT_CATALOG_ITEMS.length);
    });

    test('should export catalog to valid JSON', () => {
        const manager = new ItemCatalogManager();
        const json = manager.exportCatalog();

        expect(typeof json).toBe('string');
        const parsed = JSON.parse(json);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(DEFAULT_CATALOG_ITEMS.length);
    });

    test('should import catalog from valid JSON', () => {
        const manager = new ItemCatalogManager();
        const importPayload = [
            {
                id: 'custom_1',
                name: 'Drohne',
                weight: 850,
                category: 'electronics',
                tags: ['photo'],
                ruleType: 'FIXED',
                ruleValue: 1,
                defaultQuantity: 1,
                isDefault: false,
                enabled: true
            }
        ];

        const res = manager.importCatalog(JSON.stringify(importPayload));
        expect(res.success).toBe(true);
        expect(res.count).toBe(1);
        expect(manager.getAll().length).toBe(1);
        expect(manager.getById('custom_1')?.name).toBe('Drohne');
    });

    test('should handle invalid JSON on import gracefully', () => {
        const manager = new ItemCatalogManager();
        const initialCount = manager.getAll().length;

        // Malformed JSON
        const res1 = manager.importCatalog('{ not valid json');
        expect(res1.success).toBe(false);
        expect(res1.error).toContain('Ungültiges JSON-Format');

        // Not an array
        const res2 = manager.importCatalog('{"foo": "bar"}');
        expect(res2.success).toBe(false);
        expect(res2.error).toContain('Array');

        // Missing id or name
        const res3 = manager.importCatalog('[{"weight": 100}]');
        expect(res3.success).toBe(false);

        expect(manager.getAll().length).toBe(initialCount);
    });
});
