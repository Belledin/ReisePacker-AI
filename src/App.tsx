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
import { auth, loginWithGoogle, logoutUser, onAuthStateChanged, getRedirectResult, User } from './lib/firebaseClient';
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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string>(() => {
        return localStorage.getItem('trip_collaborator_name') || 'Michael';
    });

    useEffect(() => {
        // Handle redirect result if returning from mobile redirect login
        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                setCurrentUser(result.user);
                if (result.user.displayName) {
                    setUserName(result.user.displayName);
                    localStorage.setItem('trip_collaborator_name', result.user.displayName);
                }
            }
        }).catch((err) => {
            console.error('Redirect sign-in error:', err);
        });

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (user?.displayName) {
                setUserName(user.displayName);
                localStorage.setItem('trip_collaborator_name', user.displayName);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (error: any) {
            console.error('Google login error:', error);
            if (error?.code === 'auth/popup-closed-by-user') {
                return;
            }

            let message = 'Anmeldung fehlgeschlagen.';
            const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'reisepacker.web.app';

            if (error?.code === 'auth/unauthorized-domain') {
                message = `Domain "${currentHost}" ist in Firebase noch nicht autorisiert!\n\n` +
                          `So schaltest du sie frei:\n` +
                          `1. Öffne Firebase Console -> Projekt "gen-lang-client-0620240836"\n` +
                          `2. Gehe zu "Authentication" -> Reiter "Settings" (Einstellungen)\n` +
                          `3. Scrolle zu "Autorisierte Domains"\n` +
                          `4. Klicke "Domain hinzufügen" und trage "${currentHost}" ein.`;
            } else if (error?.code === 'auth/operation-not-allowed') {
                message = 'Google Sign-In ist in der Firebase Console noch nicht aktiviert.\n\n' +
                          'Bitte in der Firebase Console unter Authentication -> Sign-in-Methode den Anbieter "Google" aktivieren.';
            } else if (error?.code === 'auth/popup-blocked') {
                message = 'Das Anmeldefenster wurde vom Smartphone-Browser blockiert.\n\n' +
                          'Bitte Popups in den Browser-Einstellungen erlauben.';
            } else if (error?.message) {
                message = `Anmeldefehler (${error.code || 'Unbekannt'}):\n${error.message}`;
            }

            alert(message);
        }
    };

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };
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
            luggageWeight: 3500, // 3.5 kg standard empty suitcase
            healthConditions: []
        };
        setPeople([...people, newPerson]);
    };

    const updatePerson = (id: string, field: keyof Person, value: any) => {
        setPlanError(null);
        setLastRequest(null);
        const updatedPeople = people.map(p => p.id === id ? { ...p, [field]: value } : p);
        setPeople(updatedPeople);

        // Also sync update to result.people if packing list is already generated
        if (result && Array.isArray(result.people)) {
            const updatedResultPeople = result.people.map(p => p.id === id ? { ...p, [field]: value } : p);
            setResult({
                ...result,
                people: updatedResultPeople
            });

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
                    people: updatedResultPeople,
                    communityBox: result.communityBox,
                    packedMap: checklistManager ? checklistManager.getAllStates() : {},
                    weatherInfo,
                    lastUpdatedBy: userName,
                    updatedAt: new Date().toISOString()
                }, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined).catch(console.error);
            }
        }
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
            { id: generateId(), name: 'Papa', type: 'ADULT', inventory: [], currentLoad: 0, maxLoad: 23000, luggageWeight: 3800, healthConditions: ['daily_meds', 'allergies'] },
            { id: generateId(), name: 'Mama', type: 'ADULT', inventory: [], currentLoad: 0, maxLoad: 23000, luggageWeight: 3500, healthConditions: ['contact_lenses'] },
            { id: generateId(), name: 'Teenager', type: 'TEEN', inventory: [], currentLoad: 0, maxLoad: 23000, luggageWeight: 2600, healthConditions: ['asthma'] },
            { id: generateId(), name: 'Kind', type: 'CHILD', inventory: [], currentLoad: 0, maxLoad: 15000, luggageWeight: 1400, healthConditions: ['motion_sickness'] }
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

            // Preserve any ad-hoc items previously added in result.people or result.communityBox
            const adhocItemsByPerson: Record<string, Item[]> = {};
            if (result && Array.isArray(result.people)) {
                result.people.forEach(rp => {
                    const adhoc = (rp.inventory || []).filter(item => item && item.id && item.id.startsWith('adhoc_'));
                    if (adhoc.length > 0) {
                        adhocItemsByPerson[rp.id] = adhoc;
                    }
                });
            }
            const communityAdhoc = (result && Array.isArray(result.communityBox))
                ? result.communityBox.filter(item => item && item.id && item.id.startsWith('adhoc_'))
                : [];

            // Preserve all previously checked checklist states
            const previousPackedStates = checklistManager ? checklistManager.getAllStates() : {};

            // CLONE people safely: preserve ad-hoc custom items if any, but cleanly reset calculated inventory
            const peopleClone: Person[] = people.map(p => {
                const preservedAdhoc = adhocItemsByPerson[p.id] || [];
                const initialLoad = preservedAdhoc.reduce(
                    (acc, item) => acc + ((item.weight || 0) * (item.quantity || 1)),
                    0
                );

                return {
                    id: p.id || generateId(),
                    name: (p.name || '').trim() || 'Reisende(r)',
                    type: p.type || 'ADULT',
                    inventory: [...preservedAdhoc],
                    currentLoad: initialLoad,
                    maxLoad: p.maxLoad || maxWeight || 23000,
                    luggageWeight: p.luggageWeight ?? 3500,
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

            // Re-attach community ad-hoc items if any
            if (communityAdhoc.length > 0) {
                res.communityBox.push(...communityAdhoc);
            }

            setResult(res);
            setLastRequest(currentRequestStr);

            // Initialize or update ChecklistManager with stable trip ID and restore checked states
            const tripId = activeTripId || `trip_${cleanDest.toLowerCase().replace(/\s+/g, '_')}_${date}_${days}`;
            const manager = new ChecklistManager(tripId);
            manager.setAllStates(previousPackedStates);
            manager.save();
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
                }, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined).catch(err => {
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

            await CollaborativeTripService.saveTrip(tripPayload, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined);
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
            }, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined).catch(console.error);
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
            }, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined).catch(console.error);
        }
    };

    // Remove a person completely from both wizard setup AND generated/loaded packing list
    const handleRemovePerson = (personId: string) => {
        // 1. Remove from configuration wizard list
        const updatedPeople = people.filter(item => item.id !== personId);
        setPeople(updatedPeople);

        // 2. If packing list result is already generated/loaded, also remove the person from result.people!
        if (result) {
            const updatedResultPeople = (result.people || []).filter(p => p.id !== personId);
            setResult({
                ...result,
                people: updatedResultPeople
            });

            // 3. Clean up checklist states for this person in checklistManager
            if (checklistManager) {
                const currentStates = checklistManager.getAllStates();
                const prefix = `${personId}___`;
                Object.keys(currentStates).forEach(key => {
                    if (key.startsWith(prefix)) {
                        delete currentStates[key];
                    }
                });
                checklistManager.setAllStates(currentStates);
                setPackedVersion(v => v + 1);
            }

            // 4. If trip is synced to Firestore, immediately update remote so collaborator devices remove the person too
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
                    people: updatedResultPeople,
                    communityBox: result.communityBox,
                    packedMap: checklistManager ? checklistManager.getAllStates() : {},
                    weatherInfo,
                    lastUpdatedBy: userName,
                    updatedAt: new Date().toISOString()
                }, userName, currentUser ? { uid: currentUser.uid, email: currentUser.email } : undefined).catch(console.error);
            }
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

    // Detect whether selected activities differ from the currently generated packing list
    const hasActivitiesChanged = useMemo(() => {
        if (!result) return false;
        if (!lastRequest) return false;
        try {
            const parsed = JSON.parse(lastRequest);
            const prevActs = Array.isArray(parsed.activities) ? parsed.activities.slice().sort().join(',') : '';
            const currActs = (activities || []).slice().sort().join(',');
            return prevActs !== currActs;
        } catch {
            return false;
        }
    }, [result, lastRequest, activities]);

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
                <div className="header-top-row">
                    <div className="header-title-group flex items-center gap-3">
                        <img
                            src="/apple-touch-icon.png"
                            alt="ReisePacker Icon"
                            className="w-11 h-11 rounded-xl shadow-md border border-blue-400/20"
                        />
                        <div>
                            <h1>ReisePacker AI 🧳</h1>
                            <p className="subtitle">Smarte Packlisten mit Wetter- & Gewichtsanalyse</p>
                        </div>
                    </div>
                    <div className="header-auth-section flex items-center gap-2">
                        <InstallPromptModal />
                        {currentUser ? (
                            <div className="user-profile-badge">
                                {currentUser.photoURL && (
                                    <img src={currentUser.photoURL} alt="Avatar" className="user-avatar-img" />
                                )}
                                <span className="user-name-label">{currentUser.displayName || currentUser.email}</span>
                                <button type="button" onClick={handleLogout} className="btn-auth-logout" title="Abmelden">
                                    Abmelden
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={handleGoogleLogin} className="btn-auth-login" id="btn-header-google-login">
                                <svg width="16" height="16" viewBox="0 0 24 24" className="google-icon">
                                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"/>
                                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"/>
                                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                                </svg>
                                <span>Mit Google anmelden</span>
                            </button>
                        )}
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

                    <div className="form-group flex-1">
                        <label>Standard-Gepäcklimit</label>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="number"
                                min="5"
                                max="45"
                                step="1"
                                value={((maxWeight || 23000) / 1000).toFixed(0)}
                                onChange={(e) => {
                                    const val = Math.max(5, parseFloat(e.target.value) || 23) * 1000;
                                    setMaxWeight(val);
                                    // Update people who don't have custom limit
                                    setPeople(people.map(p => ({
                                        ...p,
                                        maxLoad: val
                                    })));
                                }}
                                className="w-full"
                            />
                            <span className="text-xs text-slate-400 font-semibold">kg</span>
                        </div>
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
                    {hasActivitiesChanged && (
                        <div className="mt-3 p-3 bg-indigo-950/70 border border-indigo-500/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
                            <div className="flex items-center gap-2.5 text-xs text-indigo-200">
                                <span className="text-xl">💡</span>
                                <div>
                                    <strong className="block font-semibold text-white">Aktivitäten geändert!</strong>
                                    <span>Klicke auf Aktualisieren, um Gegenstände für neue Aktivitäten hinzuzufügen bzw. abgewählte zu entfernen.</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 flex-shrink-0"
                                onClick={handlePlan}
                                disabled={loading}
                            >
                                <span>{loading ? 'Berechne...' : '🔄 Packliste jetzt aktualisieren'}</span>
                            </button>
                        </div>
                    )}
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
                                    onClick={() => handleRemovePerson(p.id)}
                                    title={`${p.name || 'Person'} entfernen`}
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Luggage / Koffer-Eigengewicht & Limit Row */}
                            <div className="luggage-config-row mt-2.5 p-2 bg-slate-800/40 rounded-xl border border-slate-700/60 flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-slate-200 flex items-center gap-1">
                                    🧳 Koffer / Gepäck:
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Leergewicht:</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="15"
                                        value={((p.luggageWeight ?? 3500) / 1000).toFixed(1)}
                                        onChange={(e) => updatePerson(p.id, 'luggageWeight', Math.round(Math.max(0, parseFloat(e.target.value) || 0) * 1000))}
                                        className="w-16 px-1.5 py-0.5 text-xs text-center font-bold bg-slate-900 border border-slate-700 rounded text-indigo-300"
                                    />
                                    <span className="text-slate-400 font-medium">kg</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/70 hover:bg-slate-700 text-slate-300 border border-slate-600/50"
                                        onClick={() => updatePerson(p.id, 'luggageWeight', 1000)}
                                        title="Rucksack (~1.0 kg)"
                                    >
                                        🎒 1.0 kg
                                    </button>
                                    <button
                                        type="button"
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/70 hover:bg-slate-700 text-slate-300 border border-slate-600/50"
                                        onClick={() => updatePerson(p.id, 'luggageWeight', 2500)}
                                        title="Handgepäck Trolley (~2.5 kg)"
                                    >
                                        💼 2.5 kg
                                    </button>
                                    <button
                                        type="button"
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/70 hover:bg-slate-700 text-slate-300 border border-slate-600/50"
                                        onClick={() => updatePerson(p.id, 'luggageWeight', 3800)}
                                        title="Koffer Hartschale (~3.8 kg)"
                                    >
                                        🧳 3.8 kg
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <span className="text-slate-400">Max. Limit:</span>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="1"
                                        max="50"
                                        value={((p.maxLoad || maxWeight || 23000) / 1000).toFixed(0)}
                                        onChange={(e) => updatePerson(p.id, 'maxLoad', Math.round(Math.max(1, parseFloat(e.target.value) || 23) * 1000))}
                                        className="w-14 px-1.5 py-0.5 text-xs text-center font-bold bg-slate-900 border border-slate-700 rounded text-emerald-400"
                                    />
                                    <span className="text-slate-400 font-medium">kg</span>
                                </div>
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
                    <button
                        className={`primary-btn ${hasActivitiesChanged ? 'ring-2 ring-indigo-400 font-bold' : ''}`}
                        onClick={handlePlan}
                        disabled={loading || !destination || people.length === 0}
                    >
                        {loading
                            ? 'Berechne Packliste...'
                            : (result
                                ? (hasActivitiesChanged ? '🔄 Packliste mit geänderten Aktivitäten aktualisieren' : '🔄 Packliste neu berechnen')
                                : '🚀 Packliste generieren')}
                    </button>
                    <button className="secondary" onClick={loadTestData}>
                        ✨ Testdaten laden (Island)
                    </button>
                </div>
            </div>

            {result && (
                <div className="result-container">
                    <div className="packing-dashboard">
                        {hasActivitiesChanged && (
                            <div className="mb-4 p-3.5 bg-amber-950/60 border border-amber-500/70 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
                                <div className="flex items-center gap-2.5 text-xs text-amber-200">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <strong className="block font-bold text-amber-100 text-sm">Aktivitäten wurden oben geändert!</strong>
                                        <span className="text-amber-200/90">Die angezeigte Packliste entspricht noch nicht deiner neuen Aktivitätsauswahl ({activities.length} gewählt).</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-2 flex-shrink-0"
                                    onClick={handlePlan}
                                    disabled={loading}
                                >
                                    <span>🔄</span>
                                    <span>{loading ? 'Berechne...' : 'Packliste jetzt aktualisieren'}</span>
                                </button>
                            </div>
                        )}
                        <div className="dashboard-header">
                            <div>
                                <h2>📋 Interaktive Packliste</h2>
                                <p className="dashboard-meta flex flex-wrap items-center gap-1.5">
                                    <span>{destination} • {days} Tage • {people.length} Personen</span>
                                    {activities.length > 0 && (
                                        <>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                                                {activities.map(id => (
                                                    <span key={id} title={ACTIVITY_CATALOG[id as ActivityType]?.name}>
                                                        {ACTIVITY_CATALOG[id as ActivityType]?.emoji}
                                                    </span>
                                                ))}
                                                <span>({activities.length} Aktivitäten)</span>
                                            </span>
                                        </>
                                    )}
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
                                    <div className="flex items-center gap-3">
                                        <div className="card-progress">
                                            <span className="count-text">{pStat.packed} / {pStat.total} gepackt ({pStat.percent}%)</span>
                                            <div className="mini-progress-bar">
                                                <div className="mini-progress-fill" style={{ width: `${pStat.percent}%` }} />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition flex items-center gap-1"
                                            onClick={() => {
                                                if (window.confirm(`Möchtest du "${p.name}" und die gesamte zugehörige Packliste entfernen?`)) {
                                                    handleRemovePerson(p.id);
                                                }
                                            }}
                                            title={`Person "${p.name}" samt Packliste entfernen`}
                                        >
                                            <span>🗑️</span>
                                            <span className="hidden sm:inline">Entfernen</span>
                                        </button>
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
                                                    title={`${item.quantity}x ${item.name} (${(item.weight || 0) * (item.quantity || 1)}g)`}
                                                >
                                                    <span className="checkbox-icon">{packed ? '✓' : '○'}</span>
                                                    <span className="item-details">
                                                        <span className="item-name" title={item.name}>
                                                            <span className="item-qty-tag">{item.quantity}x</span> {item.name} {badge}{healthBadge}
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
                                <div className="card-footer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 mt-3">
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400">📦 Inhalt:</span>
                                            <strong className="text-slate-200">{((p.currentLoad || 0) / 1000).toFixed(1)} kg</strong>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400">🧳 Koffer (leer):</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="15"
                                                value={((p.luggageWeight ?? 3500) / 1000).toFixed(1)}
                                                onChange={(e) => updatePerson(p.id, 'luggageWeight', Math.round(Math.max(0, parseFloat(e.target.value) || 0) * 1000))}
                                                className="w-14 px-1 py-0.5 text-xs text-center font-bold bg-slate-950 border border-slate-700 rounded text-indigo-300"
                                                title="Koffer-Leergewicht anpassen"
                                            />
                                            <span className="text-slate-400 font-medium">kg</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400">⚖️ Gesamt:</span>
                                            <strong className={`font-bold ${((p.currentLoad || 0) + (p.luggageWeight ?? 3500)) > (p.maxLoad || maxWeight || 23000) ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}`}>
                                                {(((p.currentLoad || 0) + (p.luggageWeight ?? 3500)) / 1000).toFixed(1)} kg
                                            </strong>
                                            <span className="text-slate-500">/ {((p.maxLoad || maxWeight || 23000) / 1000).toFixed(0)} kg</span>
                                        </div>
                                        {((p.currentLoad || 0) + (p.luggageWeight ?? 3500)) > (p.maxLoad || maxWeight || 23000) ? (
                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-[11px] animate-pulse">
                                                ⚠️ +{((((p.currentLoad || 0) + (p.luggageWeight ?? 3500)) - (p.maxLoad || maxWeight || 23000)) / 1000).toFixed(1)} kg zu schwer!
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">
                                                (noch {(((p.maxLoad || maxWeight || 23000) - (p.currentLoad || 0) - (p.luggageWeight ?? 3500)) / 1000).toFixed(1)} kg frei)
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="small-btn add-adhoc-btn self-start sm:self-auto"
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
                                                title={`${item.quantity}x ${item.name} (${(item.weight || 0) * (item.quantity || 1)}g)`}
                                            >
                                                <span className="checkbox-icon">{packed ? '✓' : '○'}</span>
                                                <span className="item-details">
                                                    <span className="item-name" title={item.name}>
                                                        <span className="item-qty-tag">{item.quantity}x</span> {item.name} {badge}{healthBadge}
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
                            <div className="card-footer flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800 mt-3">
                                <div className="text-xs text-slate-300">
                                    <span>📦 Gesamtgewicht Gemeinschaftsbox: </span>
                                    <strong className="text-indigo-300 font-bold">
                                        {(result.communityBox.reduce((sum, item) => sum + ((item.weight || 0) * (item.quantity || 1)), 0) / 1000).toFixed(1)} kg
                                    </strong>
                                </div>
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
                currentUser={currentUser}
                onLogin={handleGoogleLogin}
            />
        </div>
    );
}

export default App;
