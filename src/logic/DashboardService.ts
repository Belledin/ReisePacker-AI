import { HistoryService } from '../hooks/useHistory';

export interface DashboardViewModel {
    recentTrips: {
        id: string;
        destination: string;
        date: string;
        isTemplate: boolean;
    }[];
}

export class DashboardService {
    private historyService: HistoryService;

    constructor() {
        this.historyService = new HistoryService();
    }

    async loadDashboard(): Promise<DashboardViewModel> {
        const trips = await this.historyService.getRecentTrips();

        return {
            recentTrips: trips.map(t => ({
                id: t.id,
                destination: t.destination,
                date: t.start_date,
                isTemplate: t.is_template
            }))
        };
    }

    async cloneTripAction(tripId: string, newDate: Date) {
        console.log(`Cloning trip ${tripId} for date`, newDate);
        const result = await this.historyService.cloneTrip(tripId, newDate);
        if (result) {
            // In a real app, this would redirect to the Packing List View
            console.log('Clone successful', result);
            return result;
        } else {
            console.error('Clone failed');
            return null;
        }
    }
}
