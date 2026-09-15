import React, { useState, useMemo } from 'react';
import { PackingEngine, PackingRequest, Person, Item, HealthConditionType, Category } from './logic/PackingEngine';
import { WeatherService } from './services/WeatherService';
import { ChecklistManager } from './logic/ChecklistManager';
import { ACTIVITY_CATALOG, ActivityType } from './logic/activityCatalog';
import { ItemCatalogManager } from './logic/ItemCatalogManager';
import { CatalogManagerView } from './components/CatalogManagerView';
import { AddAdHocItemModal } from './components/AddAdHocItemModal';

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
    const [, setCatalogVersion] = useState<number>(0);

    const [destination, setDestination] = useState('');
    const [days, setDays] = useState(3);
    const [people, setPeople] = useState<Person[]>([]);
    const [activities, setActivities] = useState<string[]>([]);
    const [maxWeight, setMaxWeight] = useState(23000);
    const [mode, setMode] = useState<'SHARED' | 'INDEPENDENT'>('SHARED');

    const [result, setResult] = useState<{ people: Person[]; communityBox: Item[] } | null>(null);
    const [loading, setLoading] = useState(false);
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

    const addPerson = () => {
        const newPerson: Person = {
            id: generateId(),
            name: `Person ${people.length + 1}`,
            type: 'ADULT',
            inventory: [],
            currentLoad: 0,
            maxLoad: maxWeight,
            healthConditions: []
        };
        setPeople([...people, newPerson]);
    };

    const updatePerson = (id: string, field: keyof Person, value: any) => {
        setPeople(people.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const togglePersonHealthCondition = (personId: string, condId: HealthConditionType) => {
        setPeople(people.map(p => {
            if (p.id !== personId) return p;
            const current = p.healthConditions || [];
            const updated = current.includes(condId)
                ? current.filter(c => c !== condId)
                : [...current, condId];
            return { ...p, healthConditions: updated };
        }));
    };

    const toggleActivity = (actId: string) => {
        setActivities(prev =>
            prev.includes(actId) ? prev.filter(id => id !== actId) : [...prev, actId]
        );
    };

    const loadTestData = () => {
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
        const engine = new PackingEngine();
        const weatherService = new WeatherService();

        const currentInputs = {
            destination,
            days,
            people,
            activities,
            maxWeight,
            mode,
            date
        };

        const currentRequestStr = JSON.stringify(currentInputs);

        if (lastRequest === currentRequestStr && result) {
            console.log("Inputs unchanged, skipping plan generation.");
            return;
        }

        setLoading(true);

        try {
            // Fetch weather triggers
            const tripDate = new Date(date);
            const triggers = await weatherService.getWeatherTriggers(destination, tripDate);

            // CLONE people to avoid mutating state directly in PackingEngine
            const peopleClone = people.map(p => ({
                ...p,
                inventory: [...p.inventory],
                healthConditions: p.healthConditions ? [...p.healthConditions] : []
            }));

            const request: PackingRequest = {
                destination,
                days,
                people: peopleClone,
                activities,
                weatherTriggers: triggers,
                transportLimit: maxWeight,
                mode,
                customCatalog: catalogManager.getEnabled()
            };

            const res = engine.generateList(request);
            setResult(res);
            setLastRequest(currentRequestStr);

            // Initialize ChecklistManager with deterministic trip ID
            const tripId = `${destination.toLowerCase().replace(/\s+/g, '_')}_${date}_${days}_${activities.slice().sort().join('-')}`;
            const manager = new ChecklistManager(tripId);
            manager.load();
            setChecklistManager(manager);
            setPackedVersion(v => v + 1);
        } catch (error) {
            console.error("Error generating packing plan:", error);
        } finally {
            setLoading(false);
        }
    };

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

        if (adHocModal.targetType === 'PERSON') {
            const updatedPeople = result.people.map(p => {
                if (p.id !== adHocModal.targetId) return p;
                return {
                    ...p,
                    inventory: [...p.inventory, newItem],
                    currentLoad: p.currentLoad + (newItem.weight * newItem.quantity)
                };
            });
            setResult({ ...result, people: updatedPeople });
        } else {
            setResult({
                ...result,
                communityBox: [...result.communityBox, newItem]
            });
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
        if (targetType === 'PERSON') {
            const updatedPeople = result.people.map(p => {
                if (p.id !== targetId) return p;
                const targetItem = p.inventory.find(i => i.id === itemId);
                const weightLoss = targetItem ? targetItem.weight * targetItem.quantity : 0;
                return {
                    ...p,
                    inventory: p.inventory.filter(i => i.id !== itemId),
                    currentLoad: Math.max(0, p.currentLoad - weightLoss)
                };
            });
            setResult({ ...result, people: updatedPeople });
        } else {
            setResult({
                ...result,
                communityBox: result.communityBox.filter(i => i.id !== itemId)
            });
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
        checklistManager.toggleItem(getItemKey(ownerId, itemId));
        setPackedVersion(v => v + 1);
    };

    // Progress calculations
    const stats = useMemo(() => {
        if (!result || !checklistManager) {
            return { total: 0, packed: 0, percent: 0, personStats: {}, community: { total: 0, packed: 0, percent: 0 } };
        }

        let total = 0;
        let packed = 0;
        const personStats: Record<string, { total: number; packed: number; percent: number }> = {};

        result.people.forEach(p => {
            let pTotal = p.inventory.length;
            let pPacked = 0;
            p.inventory.forEach(item => {
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

        let cTotal = result.communityBox.length;
        let cPacked = 0;
        result.communityBox.forEach(item => {
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
                <h1>ReisePacker AI 🧳</h1>
                <p className="subtitle">Smarte Packlisten mit Wetter- & Gewichtsanalyse</p>
                <div className="nav-tabs">
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

            {activeTab === 'CATALOG' ? (
                <CatalogManagerView
                    catalogManager={catalogManager}
                    onCatalogUpdated={() => setCatalogVersion(v => v + 1)}
                />
            ) : (
                <>
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
                    {result.people.map(p => {
                        const pStat = stats.personStats[p.id] || { total: 0, packed: 0, percent: 0 };
                        const visibleItems = p.inventory.filter(item => filterItem(p.id, item.id));

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
                                                        <span className="item-weight">{item.weight * item.quantity}g</span>
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
                                    <span>Gewicht: <strong>{(p.currentLoad / 1000).toFixed(1)} kg</strong> / {(p.maxLoad / 1000).toFixed(1)} kg</span>
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
                    {result.communityBox.length > 0 && (
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
                                                    <span className="item-weight">{item.weight * item.quantity}g</span>
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
                    onClose={() => setAdHocModal(null)}
                    onAdd={handleAddAdHocItem}
                />
            )}
        </div>
    );
}

export default App;
