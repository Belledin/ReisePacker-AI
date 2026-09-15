import { CatalogItem, DEFAULT_CATALOG_ITEMS } from './defaultCatalog';
import { StorageService } from '../services/StorageService';

export class ItemCatalogManager {
    private items: CatalogItem[] = [];

    constructor(initialItems?: CatalogItem[]) {
        if (initialItems) {
            this.items = [...initialItems];
        } else {
            this.load();
        }
    }

    public load(): void {
        const stored = StorageService.loadCatalog();
        if (stored && stored.length > 0) {
            this.items = stored;
        } else {
            this.resetToDefaults();
        }
    }

    public save(): void {
        StorageService.saveCatalog(this.items);
    }

    public getAll(): CatalogItem[] {
        return [...this.items];
    }

    public getEnabled(): CatalogItem[] {
        return this.items.filter(i => i.enabled);
    }

    public getById(id: string): CatalogItem | undefined {
        return this.items.find(i => i.id === id);
    }

    public addItem(itemData: Omit<CatalogItem, 'id' | 'isDefault'> & { id?: string }): CatalogItem {
        const id = itemData.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // If ID exists, make unique
        let finalId = id;
        let counter = 1;
        while (this.items.some(i => i.id === finalId)) {
            finalId = `${id}_${counter++}`;
        }

        const newItem: CatalogItem = {
            ...itemData,
            id: finalId,
            isDefault: false,
            enabled: itemData.enabled !== undefined ? itemData.enabled : true,
            ruleType: itemData.ruleType || 'FIXED',
            ruleValue: itemData.ruleValue || 1,
            defaultQuantity: itemData.defaultQuantity || 1,
            tags: itemData.tags || []
        };

        this.items.push(newItem);
        this.save();
        return newItem;
    }

    public updateItem(id: string, updates: Partial<Omit<CatalogItem, 'id'>>): boolean {
        const index = this.items.findIndex(i => i.id === id);
        if (index === -1) return false;

        this.items[index] = {
            ...this.items[index],
            ...updates
        };
        this.save();
        return true;
    }

    public deleteItem(id: string): boolean {
        const initialLen = this.items.length;
        this.items = this.items.filter(i => i.id !== id);
        if (this.items.length !== initialLen) {
            this.save();
            return true;
        }
        return false;
    }

    public toggleEnabled(id: string): boolean {
        const item = this.items.find(i => i.id === id);
        if (!item) return false;
        item.enabled = !item.enabled;
        this.save();
        return true;
    }

    public resetToDefaults(): void {
        this.items = DEFAULT_CATALOG_ITEMS.map(i => ({ ...i }));
        this.save();
    }

    public exportCatalog(): string {
        return StorageService.exportCatalogJson(this.items);
    }

    public importCatalog(jsonString: string): { success: boolean; count: number; error?: string } {
        try {
            const imported = StorageService.importCatalogJson(jsonString);
            this.items = imported;
            this.save();
            return { success: true, count: imported.length };
        } catch (e: any) {
            return { success: false, count: 0, error: e.message || 'Import fehlgeschlagen' };
        }
    }
}
