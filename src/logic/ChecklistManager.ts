/**
 * Interface definition for LocalStorage to allow mocking in tests and usage in browser.
 */
export interface StorageProvider {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface ChecklistItemState {
    id: string;
    isPacked: boolean;
}

export class ChecklistManager {
    private tripId: string;
    private items: Map<string, boolean>; // ItemID -> isPacked
    private storage: StorageProvider;
    private storageKey: string;

    constructor(tripId: string, storage: StorageProvider = localStorage) {
        this.tripId = tripId;
        this.items = new Map();
        this.storage = storage;
        this.storageKey = `trip_checklist_${tripId}`;
    }

    /**
     * Loads state from LocalStorage. 
     * In a full app, this would also try to fetch from Supabase and merge.
     */
    public load(): void {
        const data = this.storage.getItem(this.storageKey);
        if (data) {
            try {
                const parsed: ChecklistItemState[] = JSON.parse(data);
                parsed.forEach(item => {
                    this.items.set(item.id, item.isPacked);
                });
            } catch (e) {
                console.error('Failed to parse checklist data', e);
            }
        }
    }

    /**
     * Toggles the packed state of an item.
     * returning the new state.
     */
    public toggleItem(itemId: string): boolean {
        const currentState = this.items.get(itemId) || false;
        const newState = !currentState;
        this.items.set(itemId, newState);
        this.save();
        return newState;
    }

    /**
     * specific set method if UI needs to force a state (e.g. "Mark All")
     */
    public setItemState(itemId: string, isPacked: boolean): void {
        this.items.set(itemId, isPacked);
        this.save();
    }

    public isPacked(itemId: string): boolean {
        return this.items.get(itemId) || false;
    }

    /**
     * Returns percent complete (0-100) based on provided total count or internal tracked items.
     * Note: Internal items map only grows as we interact with items. 
     * Ideally, we should initialize with ALL items from the packing list.
     */
    public getProgress(totalItemsIds: string[]): number {
        if (totalItemsIds.length === 0) return 0;
        let packedCount = 0;
        totalItemsIds.forEach(id => {
            if (this.isPacked(id)) packedCount++;
        });
        return Math.round((packedCount / totalItemsIds.length) * 100);
    }

    private save(): void {
        const stateToSave: ChecklistItemState[] = Array.from(this.items.entries()).map(([id, isPacked]) => ({
            id,
            isPacked
        }));
        this.storage.setItem(this.storageKey, JSON.stringify(stateToSave));
        // TODO: Trigger background sync to Supabase
    }
}
