import { CatalogItem } from '../logic/defaultCatalog';

const CATALOG_STORAGE_KEY = 'reisepacker_catalog_items_v1';

export interface SimpleStorageProvider {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export class StorageService {
    private static customStorage: SimpleStorageProvider | null = null;

    public static setStorageProvider(provider: SimpleStorageProvider | null): void {
        this.customStorage = provider;
    }

    private static getStorage(): SimpleStorageProvider | null {
        if (this.customStorage) return this.customStorage;
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
        return null;
    }

    public static loadCatalog(): CatalogItem[] | null {
        try {
            const storage = this.getStorage();
            if (!storage) return null;
            const data = storage.getItem(CATALOG_STORAGE_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return parsed as CatalogItem[];
            }
            return null;
        } catch (e) {
            console.warn('StorageService: Failed to load catalog from storage', e);
            return null;
        }
    }

    public static saveCatalog(items: CatalogItem[]): void {
        try {
            const storage = this.getStorage();
            if (storage) {
                storage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(items));
            }
        } catch (e) {
            console.error('StorageService: Failed to save catalog to storage', e);
        }
    }

    public static clearCatalog(): void {
        try {
            const storage = this.getStorage();
            if (storage) {
                storage.removeItem(CATALOG_STORAGE_KEY);
            }
        } catch (e) {
            console.error('StorageService: Failed to clear catalog in storage', e);
        }
    }

    public static exportCatalogJson(items: CatalogItem[]): string {
        return JSON.stringify(items, null, 2);
    }

    public static importCatalogJson(jsonString: string): CatalogItem[] {
        let parsed: any;
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            throw new Error('Ungültiges JSON-Format.');
        }

        if (!Array.isArray(parsed)) {
            throw new Error('Das importierte JSON muss eine Liste (Array) von Gegenständen sein.');
        }

        // Validate items
        const validItems: CatalogItem[] = [];
        for (const item of parsed) {
            if (!item.id || typeof item.name !== 'string' || item.name.trim() === '') {
                throw new Error('Ein oder mehrere Gegenstände im JSON besitzen keinen gültigen Namen oder ID.');
            }
            validItems.push({
                id: String(item.id),
                name: String(item.name).trim(),
                weight: typeof item.weight === 'number' && item.weight >= 0 ? item.weight : 100,
                category: item.category || 'misc',
                tags: Array.isArray(item.tags) ? item.tags : [],
                ruleType: item.ruleType || 'FIXED',
                ruleValue: typeof item.ruleValue === 'number' ? item.ruleValue : 1,
                defaultQuantity: typeof item.defaultQuantity === 'number' ? item.defaultQuantity : 1,
                isDefault: Boolean(item.isDefault),
                enabled: item.enabled !== false // default true
            });
        }

        return validItems;
    }
}
