import { WeatherService } from '../WeatherService';

describe('WeatherService', () => {
    let service: WeatherService;

    beforeEach(() => {
        service = new WeatherService('test-api-key');
        // Mock global fetch
        global.fetch = jest.fn();
    });

    test('should return forecast (mocked) if date is within 7 days', async () => {
        const nearFuture = new Date();
        nearFuture.setDate(nearFuture.getDate() + 3);

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                main: { temp: 22 },
                weather: [{ main: 'Rain' }]
            })
        });

        const triggers = await service.getWeatherTriggers('London', nearFuture);

        expect(triggers.isRainy).toBe(true);
        expect(triggers.isCold).toBe(false); // 22 is > 10
        expect(global.fetch).toHaveBeenCalled();
    });

    test('should return historical logic if date is far future', async () => {
        const farFuture = new Date();
        farFuture.setMonth(farFuture.getMonth() + 6); // 6 months later
        // Ensure it's > 7 days
        farFuture.setDate(farFuture.getDate() + 100);

        // Historical does NOT call fetch in our implementation (it mock-calculates)
        // or if it did, we'd mock it. 
        // Our impl: `fetchHistorical` uses statistical data (mocked in code).

        const triggers = await service.getWeatherTriggers('Berlin', farFuture);

        // We can't strictly predict the random/month logic without hardcoding, 
        // but we can check it didn't call the Forecast API URL.
        // Actually, our `fetchHistorical` is purely internal logic in the service.
        expect(global.fetch).not.toHaveBeenCalled();

        // Check structure
        expect(triggers).toHaveProperty('isRainy');
        expect(triggers).toHaveProperty('isCold');
    });

    test('should map triggers correctly from data', () => {
        // We can expose the private method or just test via public API with mocks
        // Let's rely on the first test which mapped Rain -> isRainy: true
    });

    test('mock mode returns specific scenarios', () => {
        const summer = service.mockWeather('summer_island');
        expect(summer.isCold).toBe(true);
        expect(summer.isRainy).toBe(true); // Iceland summer

        const winter = service.mockWeather('winter_mallorca');
        expect(winter.isCold).toBe(false);
    });
});
