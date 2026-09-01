import { ChecklistManager, StorageProvider } from '../ChecklistManager';

// Key feature: Mock Storage to verify "offline" persistency
class MockStorage implements StorageProvider {
    private store: Record<string, string> = {};

    getItem(key: string): string | null {
        return this.store[key] || null;
    }

    setItem(key: string, value: string): void {
        this.store[key] = value;
    }

    clear() {
        this.store = {};
    }
}

describe('ChecklistManager', () => {
    let mockStorage: MockStorage;
    let manager: ChecklistManager;
    const tripId = 'trip-123';

    beforeEach(() => {
        mockStorage = new MockStorage();
        manager = new ChecklistManager(tripId, mockStorage);
    });

    test('should start empty', () => {
        expect(manager.isPacked('item-1')).toBe(false);
    });

    test('should toggle item state and persist to storage', () => {
        const result = manager.toggleItem('item-1');
        expect(result).toBe(true);
        expect(manager.isPacked('item-1')).toBe(true);

        // Verify storage
        const stored = mockStorage.getItem(`trip_checklist_${tripId}`);
        expect(stored).toContain('"id":"item-1","isPacked":true');
    });

    test('should load state from storage', () => {
        // Pre-populate storage
        mockStorage.setItem(`trip_checklist_${tripId}`, JSON.stringify([
            { id: 'item-old', isPacked: true }
        ]));

        // New manager instance
        const newManager = new ChecklistManager(tripId, mockStorage);
        newManager.load();

        expect(newManager.isPacked('item-old')).toBe(true);
        expect(newManager.isPacked('item-new')).toBe(false);
    });

    test('should calculate progress correctly', () => {
        const itemIds = ['a', 'b', 'c', 'd'];

        manager.setItemState('a', true);
        manager.setItemState('b', true);

        // 2 out of 4 packed
        expect(manager.getProgress(itemIds)).toBe(50);

        manager.toggleItem('c');
        // 3 out of 4
        expect(manager.getProgress(itemIds)).toBe(75);
    });
});
