import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { PackingEngine, PackingRequest, Person, Item, HealthConditionType, Category } from './logic/PackingEngine';
import { WeatherService, WeatherData, WeatherTriggers } from './services/WeatherService';
import { ChecklistManager } from './logic/ChecklistManager';
import { ACTIVITY_CATALOG, ActivityType } from './logic/activityCatalog';
import { ItemCatalogManager } from './logic/ItemCatalogManager';
import { CatalogManagerView } from './components/CatalogManagerView';
import { AddAdHocItemModal } from './components/AddAdHocItemModal';
import { WeatherDashboardSummary } from './components/WeatherDashboardSummary';
import { CollaborationBar } from './components/CollaborationBar';
import { LoadTripModal } from './components/LoadTripModal';
import { CollaborativeTripService, CollaborativeTripData, generateShareCode } from './services/CollaborativeTripService';
import { InstallPromptModal } from './components/InstallPromptModal';

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 9);

type FilterMode = 'ALL' | 'PENDING' | 'PACKED';
type ActiveTab = 'TRIP_PLANNER' | 'CATALOG';

export const HEALTH_CONDITIONS: { id: HealthConditionType; name: string; emoji: string }[] = [
    { id: 'daily_meds', name: 'Dauermedikation', emoji: '💊' },
    { id: 'allergies', name: 'Allergien', emoji: '🤧' },
    { id: 'asthma', name: 'Asthma', emoji: '🫁' },
    { id: 'diabetes', name: 'Diabetes', emoji: '🩸' },
    { id: 'motion_sickness', name: 'Reisekrankheit', emoji: '🚗' },
    { id: 'contact_lenses', name: 'Kontaktlinsen', emoji: '👁️' }
];

function App() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('TRIP_PLANNER');
    const [catalogManager] = useState(() => new ItemCatalogManager());
    const [catalogVersion, setCatalogVersion] = useState<number>(0);

    const [destination, setDestination] = useState('');
    const [days, setDays] = useState(3);
    const [people, setPeople] = useState<Person[]>([]);
    const [activities, setActivities] = useState<string[]>([]);
    const [maxWeight, setMaxWeight] = useState(23000);
    const [mode, setMode] = useState<'SHARED' | 'INDEPENDENT'>('SHARED');

    const [result, setResult] = useState<{ people: Person[]; communityBox: Item[] } | null>(null);
    const [weatherInfo, setWeatherInfo] = useState<{
        data: WeatherData;
        triggers: WeatherTriggers;
        location: string;
        date: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [planError, setPlanError] = useState<string | null>(null);
    const [lastRequest, setLastRequest] = useState<string | null>(null);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Checklist state & filters
    const [checklistManager, setChecklistManager] = useState<ChecklistManager | null>(null);
    const [packedVersion, setPackedVersion] = useState<number>(0);
    const [filter, setFilter] = useState<FilterMode>('ALL');

    // Ad-hoc item modal state
    const [adHocModal, setAdHocModal] = useState<{
        targetType: 'PERSON' | 'COMMUNITY';
        targetId: string;
        targetName: string;
    } | null>(null);

    // Collaboration & Real-time Cloud Sync State (Google Notizen Feel)
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [activeShareCode, setActiveShareCode] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>(() => {
        return localStorage.getItem('trip_collaborator_name') || 'Michael';
    });
    const [isSavingToCloud, setIsSavingToCloud] = useState<boolean>(false);
    const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(false);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState<boolean>(false);
    const [lastSyncAuthor, setLastSyncAuthor] = useState<string>('');
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const handleUpdateUserName = (newName: string) => {
        setUserName(newName);
        localStorage.setItem('trip_collaborator_name', newName);
    };

    const addPerson = () => {
        setPlanError(null);
        setLastRequest(null);
        const newPerson: Person = {
            id: generateId(),
            name: `Person ${people.length + 1}`,
            type: 'ADULT',
            inventory: [],
            currentLoad: 0,
            maxLoad: maxWeight || 23000,
            healthConditions: []
        };
        setPeople([...people, newPerson]);
    };

    const updatePerson = (id: string, field: keyof Person, value: any) => {
        setPlanError(null);
        setLastRequest(null);
        setPeople(people.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const togglePersonHealthCondition = (personId: string, condId: HealthConditionType) => {
        setPlanError(null);
        setLastRequest(null);
        setPeople(people.map(p => {
            if (p.id !== personId) return p;
            const current = Array.isArray(p.healthConditions) ? p.healthConditions : [];
            const updated = current.includes(condId)
                ? current.filter(c => c !== condId)
                : [...current, condId];
            return { ...p, healthConditions: updated };
        }));
    };

    const toggleActivity = (actId: string) => {
        setPlanError(null);
        setLastRequest(null);
        setActivities(prev =>
            prev.includes(actId) ? prev.filter(id => id !== actId) : [...prev, actId]
        );
    };

    const loadTestData = () => {
        setPlanError(null);
        setLastRequest(null);
        setDestination('Reykjavik');
        setDays(7);
        setDate('2025-12-01');
        setActivities(['hiking', 'sightseeing']);

        setPeople([
            { id: generateId(), name: 'Papa', type: 'ADULT', inventory: [], currentLoad: 0, maxLoad: 23000, healthConditions: ['daily_meds', 'allergies'] },
            { id: generateId(), name: 'Mama', type: 'ADULT', inventory: [], currentLoad: 0, maxLoad: 23000, healthConditions: ['contact_lenses'] },
            { id: generateId(), name: 'Teenager', type: 'TEEN', inventory: [], currentLoad: 0, maxLoad: 23000, healthConditions: ['asthma'] },
            { id: generateId(), name: 'Kind', type: 'CHILD', inventory: [], currentLoad: 0, maxLoad: 15000, healthConditions: ['motion_sickness'] }
        ]);
    };

    const handlePlan = async () => {
        setPlanError(null);

        const cleanDest = (destination || '').trim();
        if (!cleanDest) {
            setPlanError('Bitte gib ein Reiseziel an (z. B. „Mallorca“, „Reykjavik“ oder „Paris“).');
            return;
        }

        if (!Array.isArray(people) || people.length === 0) {
            setPlanError('Bitte füge mindestens eine reisende Person hinzu (Klick auf „+ Person hinzufügen“).');
            return;
        }

        if (!days || days <= 0 || isNaN(days)) {
            setPlanError('Bitte gib eine gültige Reisedauer von mindestens 1 Tag an.');
            return;
        }

        const engine = new PackingEngine();
        const weatherService = new WeatherService();

        const currentInputs = {
            destination: cleanDest,
            days,
            people,
            activities,
            maxWeight,
            mode,
            date,
            catalogVersion
        };

        const currentRequestStr = JSON.stringify(currentInputs);

        if (lastRequest === currentRequestStr && result) {
            console.log("Inputs unchanged, skipping plan generation.");
            return;
        }

        setLoading(true);

        try {
            // Fetch weather data and triggers
            const tripDate = new Date(date);
            const weatherResult = await weatherService.getWeatherData(cleanDest, tripDate);
            const triggers = weatherResult.triggers;

            const weatherInfoData = {
                data: weatherResult.data,
                triggers: weatherResult.triggers,
                location: cleanDest,
                date: date
            };
            setWeatherInfo(weatherInfoData);

            // CLONE people safely: preserve ad-hoc custom items if any, but cleanly reset calculated inventory
            const peopleClone: Person[] = people.map(p => {
                const existingCustomItems = Array.isArray(p.inventory)
                    ? p.inventory.filter(item => item && item.id && item.id.startsWith('adhoc_'))
                    : [];
                const initialLoad = existingCustomItems.reduce(
                    (acc, item) => acc + ((item.weight || 0) * (item.quantity || 1)),
                    0
                );

                return {
                    id: p.id || generateId(),
                    name: (p.name || '').trim() || 'Reisende(r)',
                    type: p.type || 'ADULT',
                    inventory: [...existingCustomItems],
                    currentLoad: initialLoad,
                    maxLoad: p.maxLoad || maxWeight || 23000,
                    healthConditions: Array.isArray(p.healthConditions) ? [...p.healthConditions] : []
                };
            });

            const request: PackingRequest = {
                destination: cleanDest,
                days,
                people: peopleClone,
                activities: Array.isArray(activities) ? activities : [],
                weatherTriggers: triggers,
                transportLimit: maxWeight || 23000,
                mode,
                customCatalog: catalogManager.getEnabled()
            };

            const res = engine.generateList(request);
            setResult(res);
            setLastRequest(currentRequestStr);

            // Initialize ChecklistManager with deterministic trip ID or active trip ID
            const tripId = activeTripId || `${cleanDest.toLowerCase().replace(/\s+/g, '_')}_${date}_${days}_${(activities || []).slice().sort().join('-')}`;
            const manager = new ChecklistManager(tripId);
            manager.load();
            setChecklistManager(manager);
            setPackedVersion(v => v + 1);

            // If active trip is in cloud, auto-save updated generation
            if (activeTripId && activeShareCode) {
                CollaborativeTripService.saveTrip({
                    id: activeTripId,
                    shareCode: activeShareCode,
                    destination: cleanDest,
                    date,
                    days,
                    mode,
                    maxWeight,
                    activities,
                    people: res.people,
                    communityBox: res.communityBox,
                    packedMap: manager.getAllStates(),
                    weatherInfo: weatherInfoData,
                    lastUpdatedBy: userName,
                    updatedAt: new Date().toISOString()
                }, userName).catch(err => {
                    console.error("Error auto-updating cloud trip after plan update:", err);
                });
            }
        } catch (error: any) {
            console.error("Error generating packing plan:", error);
            const msg = error?.message || 'Unerwarteter Fehler';
            setPlanError(`Beim Berechnen der Packliste ist ein Fehler aufgetreten: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    // Real-time Cloud Save & Sync Handlers (Google Notizen Collaboration)
    const handleSaveTripToCloud = async () => {
        if (!result) return;
        setIsSavingToCloud(true);
        try {
            const tripIdToUse = activeTripId || `trip_${destination.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
            const shareCodeToUse = activeShareCode || generateShareCode(destination);
            const currentPackedStates = checklistManager ? checklistManager.getAllStates() : {};

            const tripPayload: CollaborativeTripData = {
                id: tripIdToUse,
                shareCode: shareCodeToUse,
                destination,
                date,
                days,
                mode,
                maxWeight,
                activities,
                people: result.people,
                communityBox: result.communityBox,
                packedMap: currentPackedStates,
                weatherInfo,
                lastUpdatedBy: userName,
                updatedAt: new Date().toISOString()
            };

            await CollaborativeTripService.saveTrip(tripPayload, userName);
            setActiveTripId(tripIdToUse);
            setActiveShareCode(shareCodeToUse);
            setIsLiveSyncing(true);

            // Update URL search query without full reload
            if (typeof window !== 'undefined' && window.history) {
                const newUrl = `${window.location.pathname}?trip=${shareCodeToUse}`;
                window.history.replaceState(null, '', newUrl);
            }

            // Start listening for changes made on other devices (e.g. wife's phone/laptop)
            setupRealtimeSubscription(tripIdToUse);
        } catch (error) {
            console.error('Error saving trip to cloud:', error);
        } finally {
            setIsSavingToCloud(false);
        }
    };

    const setupRealtimeSubscription = useCallback((tripId: string) => {
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        const unsub = CollaborativeTripService.subscribeToTrip(
            tripId,
            (syncedTrip) => {
                // If updated by someone else, sync the packed state & people inventory smoothly
                if (syncedTrip.lastUpdatedBy !== userName) {
                    setLastSyncAuthor(syncedTrip.lastUpdatedBy);
                }

                if (checklistManager && syncedTrip.packedMap) {
                    checklistManager.setAllStates(syncedTrip.packedMap);
                    setPackedVersion(v => v + 1);
                }

                // If items were added or modified on another device
                if (syncedTrip.people && syncedTrip.communityBox) {
                    setResult({
                        people: syncedTrip.people,
                        communityBox: syncedTrip.communityBox
                    });
                }
            },
            (err) => console.error('Subscription error:', err)
        );

        unsubscribeRef.current = unsub;
        setIsLiveSyncing(true);
    }, [userName, checklistManager]);

    // Handle loading a trip from cloud (selected by user or URL parameter)
    const handleSelectTripFromCloud = (trip: CollaborativeTripData) => {
        setDestination(trip.destination);
        setDate(trip.date || new Date().toISOString().split('T')[0]);
        setDays(trip.days || 3);
        setMode(trip.mode || 'SHARED');
        setMaxWeight(trip.maxWeight || 23000);
        setActivities(trip.activities || []);
        if (trip.weatherInfo) {
            setWeatherInfo(trip.weatherInfo);
        }

        setPeople(trip.people || []);
        setResult({
            people: trip.people || [],
            communityBox: trip.communityBox || []
        });

        // Initialize checklist manager with synced states
        const manager = new ChecklistManager(trip.id);
        manager.setAllStates(trip.packedMap || {});
        setChecklistManager(manager);
        setPackedVersion(v => v + 1);

        setActiveTripId(trip.id);
        setActiveShareCode(trip.shareCode);
        setIsLiveSyncing(true);

        // Update URL
        if (typeof window !== 'undefined' && window.history && trip.shareCode) {
            const newUrl = `${window.location.pathname}?trip=${trip.shareCode}`;
            window.history.replaceState(null, '', newUrl);
        }

        // Subscribe to live updates
        setupRealtimeSubscription(trip.id);
    };

    // Auto-load trip if "?trip=CODE" is in URL (e.g. when opened via link on phone/second computer)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tripParam = params.get('trip');
            if (tripParam) {
                CollaborativeTripService.loadTripByCodeOrId(tripParam)
                    .then(found => {
                        if (found) {
                            handleSelectTripFromCloud(found);
                        }
                    })
                    .catch(e => console.error('Error loading trip from URL param:', e));
            }
        }

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // Ad-hoc item manipulation
    const handleAddAdHocItem = (
        itemData: { name: string; quantity: number; weight: number; category: Category; tags: string[] },
        saveToCatalog: boolean
    ) => {
        if (!adHocModal || !result) return;

        const newItemId = `adhoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newItem: Item = {
            id: newItemId,
            name: itemData.name,
            weight: itemData.weight,
            category: itemData.category,
            tags: itemData.tags,
            quantity: itemData.quantity
        };

        let updatedPeople = result.people;
        let updatedCommunity = result.communityBox;

        if (adHocModal.targetType === 'PERSON') {
            updatedPeople = result.people.map(p => {
                if (p.id !== adHocModal.targetId) return p;
                const safeInv = Array.isArray(p.inventory) ? p.inventory : [];
                return {
                    ...p,
                    inventory: [...safeInv, newItem],
                    currentLoad: (p.currentLoad || 0) + ((newItem.weight || 0) * (newItem.quantity || 1))
                };
            });
            setResult({ ...result, people: updatedPeople });
        } else {
            const safeCommunity = Array.isArray(result.communityBox) ? result.communityBox : [];
            updatedCommunity = [...safeCommunity, newItem];
            setResult({
                ...result,
                communityBox: updatedCommunity
            });
        }

        // If cloud synced, persist change immediately
        if (activeTripId && activeShareCode) {
            CollaborativeTripService.saveTrip({
                id: activeTripId,
                shareCode: activeShareCode,
                destination,
                date,
                days,
                mode,
                maxWeight,
                activities,
                people: updatedPeople,
                communityBox: updatedCommunity,
                packedMap: checklistManager ? checklistManager.getAllStates() : {},
                weatherInfo,
                lastUpdatedBy: userName,
                updatedAt: new Date().toISOString()
            }, userName).catch(console.error);
        }

        if (saveToCatalog) {
            catalogManager.addItem({
                name: itemData.name,
                weight: itemData.weight,
                category: itemData.category,
                tags: itemData.tags,
                ruleType: 'FIXED',
                ruleValue: 1,
                defaultQuantity: itemData.quantity,
                enabled: true
            });
            setCatalogVersion(v => v + 1);
        }
    };

    const handleRemoveItem = (targetType: 'PERSON' | 'COMMUNITY', targetId: string, itemId: string) => {
        if (!result) return;
        let updatedPeople = result.people;
        let updatedCommunity = result.communityBox;

        if (targetType === 'PERSON') {
            updatedPeople = (result.people || []).map(p => {
                if (p.id !== targetId) return p;
                const safeInv = Array.isArray(p.inventory) ? p.inventory : [];
                const targetItem = safeInv.find(i => i.id === itemId);
                const weightLoss = targetItem ? (targetItem.weight || 0) * (targetItem.quantity || 1) : 0;
                return {
                    ...p,
                    inventory: safeInv.filter(i => i.id !== itemId),
                    currentLoad: Math.max(0, (p.currentLoad || 0) - weightLoss)
                };
            });
            setResult({ ...result, people: updatedPeople });
        } else {
            const safeCommunity = Array.isArray(result.communityBox) ? result.communityBox : [];
            updatedCommunity = safeCommunity.filter(i => i.id !== itemId);
            setResult({
                ...result,
                communityBox: updatedCommunity
            });
        }

        // If cloud synced, update remote
        if (activeTripId && activeShareCode) {
            CollaborativeTripService.saveTrip({
                id: activeTripId,
                shareCode: activeShareCode,
                destination,
                date,
                days,
                mode,
                maxWeight,
                activities,
                people: updatedPeople,
                communityBox: updatedCommunity,
                packedMap: checklistManager ? checklistManager.getAllStates() : {},
                weatherInfo,
                lastUpdatedBy: userName,
                updatedAt: new Date().toISOString()
            }, userName).catch(console.error);
        }
    };

    // Helper to generate a unique key per person/item or community item
    const getItemKey = (ownerId: string, itemId: string) => `${ownerId}___${itemId}`;

    const isItemPacked = (ownerId: string, itemId: string): boolean => {
        if (!checklistManager) return false;
        return checklistManager.isPacked(getItemKey(ownerId, itemId));
    };

    const toggleItem = (ownerId: string, itemId: string) => {
        if (!checklistManager) return;
        const key = getItemKey(ownerId, itemId);
        const newState = checklistManager.toggleItem(key);
        setPackedVersion(v => v + 1);

        // Immediate background sync to Firestore for real-time responsiveness
        if (activeTripId) {
            CollaborativeTripService.updateItemPackedState(activeTripId, key, newState, userName)
                .catch(console.error);
        }
    };

    // Progress calculations
    const stats = useMemo(() => {
        if (!result || !checklistManager) {
            return { total: 0, packed: 0, percent: 0, personStats: {}, community: { total: 0, packed: 0, percent: 0 } };
        }

        let total = 0;
        let packed = 0;
        const personStats: Record<string, { total: number; packed: number; percent: number }> = {};

        const safePeople = Array.isArray(result.people) ? result.people : [];
        safePeople.forEach(p => {
            const safeInv = Array.isArray(p.inventory) ? p.inventory : [];
            let pTotal = safeInv.length;
            let pPacked = 0;
            safeInv.forEach(item => {
                const key = getItemKey(p.id, item.id);
                if (checklistManager.isPacked(key)) {
                    pPacked++;
                }
            });
            total += pTotal;
            packed += pPacked;
            personStats[p.id] = {
                total: pTotal,
                packed: pPacked,
                percent: pTotal > 0 ? Math.round((pPacked / pTotal) * 100) : 0
            };
        });

        const safeCommunity = Array.isArray(result.communityBox) ? result.communityBox : [];
        let cTotal = safeCommunity.length;
        let cPacked = 0;
        safeCommunity.forEach(item => {
            const key = getItemKey('community', item.id);
            if (checklistManager.isPacked(key)) {
                cPacked++;
            }
        });
        total += cTotal;
        packed += cPacked;

        return {
            total,
            packed,
            percent: total > 0 ? Math.round((packed / total) * 100) : 0,
            personStats,
            community: {
                total: cTotal,
                packed: cPacked,
                percent: cTotal > 0 ? Math.round((cPacked / cTotal) * 100) : 0
            }
        };
    }, [result, checklistManager, packedVersion]);

    const markAll = (isPacked: boolean) => {
        if (!result || !checklistManager) return;
        result.people.forEach(p => {
            p.inventory.forEach(item => {
                checklistManager.setItemState(getItemKey(p.id, item.id), isPacked);
            });
        });
        result.communityBox.forEach(item => {
            checklistManager.setItemState(getItemKey('community', item.id), isPacked);
        });
        setPackedVersion(v => v + 1);
    };

    const filterItem = (ownerId: string, itemId: string) => {
        const packed = isItemPacked(ownerId, itemId);
        if (filter === 'PENDING') return !packed;
        if (filter === 'PACKED') return packed;
        return true;
    };

    const getActivityBadge = (tags: string[]) => {
        if (!tags || !tags.includes('activity')) return null;
        const actTag = tags.find(t => t !== 'activity' && t !== 'base' && t !== 'rain' && t !== 'cold' && t !== 'health');
        if (!actTag) return null;
        const def = ACTIVITY_CATALOG[actTag as ActivityType];
        return def ? <span className="activity-indicator" title={def.name}>{def.emoji}</span> : null;
    };

    const getHealthBadge = (tags: string[]) => {
        if (!tags || !tags.includes('health')) return null;
        return <span className="health-indicator" title="Gesundheit / Medikamente">💊</span>;
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                        <img
                            src="/apple-touch-icon.png"
                            alt="ReisePacker Icon"
                            className="w-11 h-11 rounded-xl shadow-md border border-blue-400/20"
                        />
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0 flex items-center gap-2">
                                ReisePacker AI
                            </h1>
                            <p className="subtitle text-xs text-slate-500 dark:text-slate-400 m-0">
                                Smarte Packlisten mit Wetter- & Gewichtsanalyse
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <InstallPromptModal />
                    </div>
                </div>
                <div className="nav-tabs mt-2">
                    <button
                        className={`nav-tab ${activeTab === 'TRIP_PLANNER' ? 'active' : ''}`}
                        onClick={() => setActiveTab('TRIP_PLANNER')}
                    >
                        🎒 Reise planen
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'CATALOG' ? 'active' : ''}`}
                        onClick={() => setActiveTab('CATALOG')}
                    >
                        📦 Gegenstände verwalten
                    </button>
                </div>
            </header>

            {/* Collaboration & Live Sync Bar (Google Notizen Feel) */}
            <CollaborationBar
                trip={result ? {
                    id: activeTripId || '',
                    shareCode: activeShareCode || '',
                    destination,
                    date,
                    days,
                    mode,
                    maxWeight,
                    activities,
                    people: result.people,
                    communityBox: result.communityBox,
                    packedMap: checklistManager ? checklistManager.getAllStates() : {},
                    weatherInfo,
                    lastUpdatedBy: lastSyncAuthor || userName,
                    updatedAt: new Date().toISOString()
                } : null}
                currentUserName={userName}
                onChangeUserName={handleUpdateUserName}
                onSaveToCloud={handleSaveTripToCloud}
                onOpenLoadModal={() => setIsLoadModalOpen(true)}
                isSaving={isSavingToCloud}
                isLiveSyncing={isLiveSyncing}
            />

            {activeTab === 'CATALOG' ? (
                <CatalogManagerView
                    catalogManager={catalogManager}
                    onCatalogUpdated={() => setCatalogVersion(v => v + 1)}
                />
            ) : (
                <>
                    {planError && (
                        <div className="error-banner" role="alert">
                            <div className="error-banner-content">
                                <span className="error-banner-icon">⚠️</span>
                                <div className="error-banner-text">
                                    <strong>Hinweis:</strong> {planError}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="error-banner-close"
                                onClick={() => setPlanError(null)}
                                title="Schließen"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <div className="wizard-container">
                <h2>Reise konfigurieren</h2>

                <div className="form-group">
                    <label>Reiseziel</label>
                    <input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="z. B. Reykjavik, Paris, Rom"
                    />
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Reisedatum</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="form-group flex-1">
                        <label>Dauer (Tage)</label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={days}
                            onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Pack-Modus</label>
                    <div className="mode-toggle">
                        <button
                            type="button"
                            className={`toggle-btn ${mode === 'SHARED' ? 'active' : 'secondary'}`}
                            onClick={() => setMode('SHARED')}
                        >
                            👨‍👩‍👧‍👦 Shared Mode (Gemeinschaftsbox)
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${mode === 'INDEPENDENT' ? 'active' : 'secondary'}`}
                            onClick={() => setMode('INDEPENDENT')}
                        >
                            🎒 Individual Mode
                        </button>
                    </div>
                </div>

                {/* Activity Selector */}
                <div className="form-group">
                    <div className="activities-header">
                        <label>Geplante Aktivitäten ({activities.length} gewählt)</label>
                    </div>
                    <div className="activity-grid">
                        {Object.values(ACTIVITY_CATALOG).map(act => {
                            const isSelected = activities.includes(act.id);
                            return (
                                <button
                                    key={act.id}
                                    type="button"
                                    className={`activity-chip ${isSelected ? 'active' : ''}`}
                                    onClick={() => toggleActivity(act.id)}
                                    title={act.description}
                                >
                                    <span className="activity-chip-emoji">{act.emoji}</span>
                                    <span className="activity-chip-name">{act.name}</span>
                                    {isSelected && <span className="activity-chip-check">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="form-group">
                    <div className="travelers-header">
                        <h3>Reisende ({people.length})</h3>
                        <button className="secondary small-btn" onClick={addPerson}>+ Person hinzufügen</button>
                    </div>

                    {people.length === 0 && (
                        <p className="hint-text">Füge Reisende hinzu oder lade Beispieldaten.</p>
                    )}

                    {people.map(p => (
                        <div key={p.id} className="person-input-card">
                            <div className="person-input-row">
                                <input
                                    value={p.name}
                                    placeholder="Name"
                                    onChange={(e) => updatePerson(p.id, 'name', e.target.value)}
                                />
                                <select value={p.type} onChange={(e) => updatePerson(p.id, 'type', e.target.value)}>
                                    <option value="ADULT">Erwachsen</option>
                                    <option value="TEEN">Jugendlich</option>
                                    <option value="CHILD">Kind</option>
                                    <option value="TODDLER">Kleinkind</option>
                                </select>
                                <button
                                    className="danger-btn small-btn"
                                    onClick={() => setPeople(people.filter(item => item.id !== p.id))}
                                    title="Entfernen"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="health-section">
                                <span className="health-section-label">💊 Gesundheit:</span>
                                <div className="health-chips">
                                    {HEALTH_CONDITIONS.map(cond => {
                                        const isActive = (p.healthConditions || []).includes(cond.id);
                                        return (
                                            <button
                                                key={cond.id}
                                                type="button"
                                                className={`health-chip ${isActive ? 'active' : ''}`}
                                                onClick={() => togglePersonHealthCondition(p.id, cond.id)}
                                                title={cond.name}
                                            >
                                                <span>{cond.emoji}</span>
                                                <span className="health-chip-name">{cond.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="wizard-actions">
                    <button className="primary-btn" onClick={handlePlan} disabled={loading || !destination || people.length === 0}>
                        {loading ? 'Berechne Packliste...' : '🚀 Packliste generieren'}
                    </button>
                    <button className="secondary" onClick={loadTestData}>
                        ✨ Testdaten laden (Island)
                    </button>
                </div>
            </div>

            {result && (
                <div className="result-container">
                    <div className="packing-dashboard">
                        <div className="dashboard-header">
                            <div>
                                <h2>📋 Interaktive Packliste</h2>
                                <p className="dashboard-meta">
                                    {destination} • {days} Tage • {people.length} Personen {activities.length > 0 && `• ${activities.length} Aktivitäten`}
                                </p>
                            </div>
                            <div className="progress-badge">
                                <span className="progress-number">{stats.percent}%</span>
                                <span className="progress-sub">gepackt</span>
                            </div>
                        </div>

                        {/* Weather Data Summary Section */}
                        {weatherInfo && (
                            <WeatherDashboardSummary
                                destination={weatherInfo.location || destination}
                                date={weatherInfo.date || date}
                                days={days}
                                weatherData={weatherInfo.data}
                                triggers={weatherInfo.triggers}
                            />
                        )}

                        {/* Global Progress Bar */}
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${stats.percent}%` }}
                            />
                        </div>
                        <div className="progress-label">
                            <span>{stats.packed} von {stats.total} Gegenständen eingepackt</span>
                            {stats.percent === 100 && <span className="ready-badge">🎉 Alles gepackt! Gute Reise!</span>}
                        </div>

                        {/* Interactive Toolbar */}
                        <div className="checklist-toolbar">
                            <div className="filter-buttons">
                                <button
                                    className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
                                    onClick={() => setFilter('ALL')}
                                >
                                    Alle ({stats.total})
                                </button>
                                <button
                                    className={`filter-btn ${filter === 'PENDING' ? 'active' : ''}`}
                                    onClick={() => setFilter('PENDING')}
                                >
                                    Offen ({stats.total - stats.packed})
                                </button>
                                <button
                                    className={`filter-btn ${filter === 'PACKED' ? 'active' : ''}`}
                                    onClick={() => setFilter('PACKED')}
                                >
                                    Gepackt ({stats.packed})
                                </button>
                            </div>

                            <div className="action-buttons">
                                <button className="secondary small-btn" onClick={() => markAll(true)}>
                                    ✓ Alle abhaken
                                </button>
                                <button className="secondary small-btn" onClick={() => markAll(false)}>
                                    ↺ Zurücksetzen
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* People Cards */}
                    {(result.people || []).map(p => {
                        const pStat = stats.personStats[p.id] || { total: 0, packed: 0, percent: 0 };
                        const visibleItems = (p.inventory || []).filter(item => filterItem(p.id, item.id));

                        return (
                            <div key={p.id} className="person-card">
                                <div className="card-header">
                                    <div className="card-title-group">
                                        <h3>{p.name}</h3>
                                        <span className="type-badge">{p.type}</span>
                                    </div>
                                    <div className="card-progress">
                                        <span className="count-text">{pStat.packed} / {pStat.total} gepackt ({pStat.percent}%)</span>
                                        <div className="mini-progress-bar">
                                            <div className="mini-progress-fill" style={{ width: `${pStat.percent}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="item-list">
                                    {visibleItems.length === 0 ? (
                                        <p className="no-items">Keine Gegenstände für diesen Filter.</p>
                                    ) : (
                                        visibleItems.map(item => {
                                            const packed = isItemPacked(p.id, item.id);
                                            const badge = getActivityBadge(item.tags);
                                            const healthBadge = getHealthBadge(item.tags);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`item-badge ${packed ? 'packed' : ''}`}
                                                    onClick={() => toggleItem(p.id, item.id)}
                                                    role="checkbox"
                                                    aria-checked={packed}
                                                    tabIndex={0}
                                                >
                                                    <span className="checkbox-icon">{packed ? '✓' : '○'}</span>
                                                    <span className="item-details">
                                                        <span className="item-name">
                                                            {item.quantity}x {item.name} {badge}{healthBadge}
                                                        </span>
                                                        <span className="item-weight">{(item.weight || 0) * (item.quantity || 1)}g</span>
                                                    </span>
                                                    <button
                                                        className="item-delete-btn"
                                                        title="Gegenstand entfernen"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveItem('PERSON', p.id, item.id);
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="card-footer">
                                    <span>Gewicht: <strong>{(((p.currentLoad || 0)) / 1000).toFixed(1)} kg</strong> / {(((p.maxLoad || maxWeight || 23000)) / 1000).toFixed(1)} kg</span>
                                    <button
                                        className="small-btn add-adhoc-btn"
                                        onClick={() => setAdHocModal({
                                            targetType: 'PERSON',
                                            targetId: p.id,
                                            targetName: p.name
                                        })}
                                    >
                                        ➕ Gegenstand
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Community Box */}
                    {Array.isArray(result.communityBox) && result.communityBox.length > 0 && (
                        <div className="community-box">
                            <div className="card-header">
                                <div className="card-title-group">
                                    <h3>📦 Community Box (Gemeinsames Gepäck)</h3>
                                    <button
                                        className="small-btn add-adhoc-btn"
                                        onClick={() => setAdHocModal({
                                            targetType: 'COMMUNITY',
                                            targetId: 'community',
                                            targetName: 'Community Box'
                                        })}
                                    >
                                        ➕ Gegenstand
                                    </button>
                                </div>
                                <div className="card-progress">
                                    <span className="count-text">{stats.community.packed} / {stats.community.total} gepackt ({stats.community.percent}%)</span>
                                    <div className="mini-progress-bar community-bar">
                                        <div className="mini-progress-fill community-fill" style={{ width: `${stats.community.percent}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="item-list">
                                {result.communityBox.filter(item => filterItem('community', item.id)).length === 0 ? (
                                    <p className="no-items">Keine Gegenstände für diesen Filter.</p>
                                ) : (
                                    result.communityBox.filter(item => filterItem('community', item.id)).map(item => {
                                        const packed = isItemPacked('community', item.id);
                                        const badge = getActivityBadge(item.tags);
                                        const healthBadge = getHealthBadge(item.tags);
                                        return (
                                            <div
                                                key={item.id}
                                                className={`item-badge ${packed ? 'packed' : ''}`}
                                                onClick={() => toggleItem('community', item.id)}
                                                role="checkbox"
                                                aria-checked={packed}
                                                tabIndex={0}
                                            >
                                                <span className="checkbox-icon">{packed ? '✓' : '○'}</span>
                                                <span className="item-details">
                                                    <span className="item-name">
                                                        {item.quantity}x {item.name} {badge}{healthBadge}
                                                    </span>
                                                    <span className="item-weight">{(item.weight || 0) * (item.quantity || 1)}g</span>
                                                </span>
                                                <button
                                                    className="item-delete-btn"
                                                    title="Gegenstand entfernen"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveItem('COMMUNITY', 'community', item.id);
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            </>
            )}

            {adHocModal && (
                <AddAdHocItemModal
                    targetName={adHocModal.targetName}
                    catalogItems={catalogManager.getEnabled()}
                    days={days}
                    peopleCount={people.length}
                    onClose={() => setAdHocModal(null)}
                    onAdd={handleAddAdHocItem}
                />
            )}

            <LoadTripModal
                isOpen={isLoadModalOpen}
                onClose={() => setIsLoadModalOpen(false)}
                onSelectTrip={handleSelectTripFromCloud}
            />
        </div>
    );
}

export default App;
