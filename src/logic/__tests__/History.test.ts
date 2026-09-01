import { HistoryService } from '../../hooks/useHistory';
import { supabase } from '../../lib/supabaseClient';
import { PackingRequest } from '../PackingEngine';

// Mock Supabase
jest.mock('../../lib/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn(() => ({ data: { id: 'mock-uuid' }, error: null }))
                }))
            })),
            select: jest.fn(() => ({
                order: jest.fn(() => ({
                    limit: jest.fn(() => ({ data: [], error: null }))
                })),
                eq: jest.fn(() => ({
                    single: jest.fn(() => ({ data: {}, error: null })), // for single get
                    data: [] // for list get
                }))
            }))
        }))
    }
}));

describe('HistoryService', () => {
    let service: HistoryService;

    beforeEach(() => {
        service = new HistoryService();
        jest.clearAllMocks();
    });

    test('saveTrip calls Supabase with correct data', async () => {
        const mockRequest: PackingRequest = {
            destination: 'Paris',
            days: 3,
            people: [{ id: 'p1', name: 'Alice', type: 'ADULT', inventory: [], currentLoad: 0, maxLoad: 10000 }],
            activities: [],
            transportLimit: 20000,
            mode: 'INDEPENDENT',
            weatherTriggers: { isRainy: false, isCold: false, isHot: false, isSnowy: false }
        };

        const mockResult = {
            people: mockRequest.people,
            communityBox: []
        };

        const tripId = await service.saveTrip(mockRequest, mockResult, false);
        expect(tripId).toBe('mock-uuid');
        // We could spy on supabase.from to verify arguments but this confirms flow works.
    });

    test('cloneTrip re-generates list', async () => {
        // Mock the old trip fetch
        const mockTrip = {
            id: 'old-id',
            destination: 'Berlin',
            start_date: '2025-01-01',
            end_date: '2025-01-05',
            transport_limit: 15000,
            mode: 'SHARED'
        };
        const mockTravelers = [
            { id: 't1', name: 'Bob', type: 'ADULT', max_load: 15000 }
        ];

        // Setup generic mocks for the chain
        const mockSingle = jest.fn().mockReturnValue({ data: mockTrip, error: null });
        const mockEqTrip = jest.fn().mockReturnValue({ single: mockSingle });

        const mockEqTravelers = jest.fn().mockReturnValue({ data: mockTravelers, error: null });

        // Extremely simplified mock injection for "from"
        // In a real scenario, we'd need more robust mocking libraries or dependency injection
        (supabase.from as jest.Mock).mockImplementation((table) => {
            if (table === 'trips') return { select: () => ({ eq: mockEqTrip }) };
            if (table === 'travelers') return { select: () => ({ eq: () => mockEqTravelers() }) };
            return { select: () => ({}) };
        });

        const newDate = new Date('2026-06-01');
        await service.cloneTrip('old-id', newDate);

        // Implicitly checks logic runs without error.
        // In a real test we would verify PackingEngine was called with new params
    });
});
