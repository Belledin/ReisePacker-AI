import React, { useState } from 'react';
import { CatalogItem, QuantityRuleType } from '../logic/defaultCatalog';
import { ItemCatalogManager } from '../logic/ItemCatalogManager';
import { Category } from '../logic/PackingEngine';

interface CatalogManagerViewProps {
    catalogManager: ItemCatalogManager;
    onCatalogUpdated: () => void;
}

export const CATEGORY_LABELS: Record<Category, { label: string; emoji: string }> = {
    clothing: { label: 'Kleidung', emoji: '👕' },
    hygiene: { label: 'Hygiene', emoji: '🧴' },
    electronics: { label: 'Elektronik', emoji: '🔌' },
    documents: { label: 'Dokumente', emoji: '📄' },
    health: { label: 'Gesundheit', emoji: '💊' },
    shared: { label: 'Gemeinschaft', emoji: '👥' },
    misc: { label: 'Sonstiges', emoji: '🎒' }
};

export const RULE_LABELS: Record<QuantityRuleType, string> = {
    FIXED: 'Feste Anzahl',
    PER_DAY: 'Pro Tag',
    PER_X_DAYS: 'Alle X Tage',
    SHARED_PER_PEOPLE: '1x pro X Personen'
};

export const CatalogManagerView: React.FC<CatalogManagerViewProps> = ({
    catalogManager,
    onCatalogUpdated
}) => {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Form fields
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState<Category>('clothing');
    const [formWeight, setFormWeight] = useState<number>(100);
    const [formRuleType, setFormRuleType] = useState<QuantityRuleType>('FIXED');
    const [formRuleValue, setFormRuleValue] = useState<number>(1);
    const [formDefaultQuantity, setFormDefaultQuantity] = useState<number>(1);
    const [formTags, setFormTags] = useState('');

    // Import state
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importJsonText, setImportJsonText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3500);
    };

    const items = catalogManager.getAll();

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
        const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
        return matchesSearch && matchesCat;
    });

    const openCreateForm = () => {
        setEditingItemId(null);
        setFormName('');
        setFormCategory('clothing');
        setFormWeight(100);
        setFormRuleType('FIXED');
        setFormRuleValue(1);
        setFormDefaultQuantity(1);
        setFormTags('base');
        setIsFormOpen(true);
    };

    const openEditForm = (item: CatalogItem) => {
        setEditingItemId(item.id);
        setFormName(item.name);
        setFormCategory(item.category);
        setFormWeight(item.weight);
        setFormRuleType(item.ruleType);
        setFormRuleValue(item.ruleValue || 1);
        setFormDefaultQuantity(item.defaultQuantity);
        setFormTags(item.tags.join(', '));
        setIsFormOpen(true);
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) return;

        const tags = formTags
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0);

        if (editingItemId) {
            catalogManager.updateItem(editingItemId, {
                name: formName.trim(),
                category: formCategory,
                weight: Math.max(0, formWeight),
                ruleType: formRuleType,
                ruleValue: Math.max(1, formRuleValue),
                defaultQuantity: Math.max(1, formDefaultQuantity),
                tags
            });
            showNotification(`„${formName}" erfolgreich aktualisiert.`);
        } else {
            catalogManager.addItem({
                name: formName.trim(),
                category: formCategory,
                weight: Math.max(0, formWeight),
                ruleType: formRuleType,
                ruleValue: Math.max(1, formRuleValue),
                defaultQuantity: Math.max(1, formDefaultQuantity),
                tags,
                enabled: true
            });
            showNotification(`„${formName}" zum Katalog hinzugefügt.`);
        }

        setIsFormOpen(false);
        onCatalogUpdated();
    };

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Möchtest du „${name}" wirklich aus dem Katalog löschen?`)) {
            catalogManager.deleteItem(id);
            showNotification(`„${name}" wurde gelöscht.`);
            onCatalogUpdated();
        }
    };

    const handleToggleEnabled = (id: string) => {
        catalogManager.toggleEnabled(id);
        onCatalogUpdated();
    };

    const handleReset = () => {
        if (window.confirm('Möchtest du den Katalog wirklich auf die Standardwerte zurücksetzen? Eigene Änderungen gehen verloren.')) {
            catalogManager.resetToDefaults();
            showNotification('Katalog wurde auf Standardwerte zurückgesetzt.');
            onCatalogUpdated();
        }
    };

    const handleExport = () => {
        const json = catalogManager.exportCatalog();
        navigator.clipboard.writeText(json)
            .then(() => showNotification('Katalog-JSON wurde in die Zwischenablage kopiert!'))
            .catch(() => {
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'reisepacker-katalog.json';
                a.click();
                showNotification('Katalog als JSON heruntergeladen.');
            });
    };

    const handleImportSubmit = () => {
        setImportError(null);
        const result = catalogManager.importCatalog(importJsonText);
        if (result.success) {
            setImportModalOpen(false);
            setImportJsonText('');
            showNotification(`${result.count} Gegenstände erfolgreich importiert!`);
            onCatalogUpdated();
        } else {
            setImportError(result.error || 'Fehler beim Importieren');
        }
    };

    const formatRuleDescription = (item: CatalogItem) => {
        switch (item.ruleType) {
            case 'PER_DAY':
                return `${item.defaultQuantity * (item.ruleValue || 1)}x pro Tag`;
            case 'PER_X_DAYS':
                return `1x alle ${item.ruleValue || 3} Tage`;
            case 'SHARED_PER_PEOPLE':
                return `1x für je ${item.ruleValue || 4} Personen`;
            case 'FIXED':
            default:
                return `Fix ${item.defaultQuantity}x`;
        }
    };

    return (
        <div className="catalog-manager-container">
            {notification && (
                <div className="toast-notification">
                    {notification}
                </div>
            )}

            <div className="catalog-header">
                <div>
                    <h2>📦 Gegenstandskatalog & Stammdaten</h2>
                    <p className="catalog-subtitle">
                        Verwalte hier alle Gegenstände, Standardgewichte und Mengenregeln. Änderungen werden im Browser gespeichert.
                    </p>
                </div>
                <div className="catalog-actions-bar">
                    <button className="primary-btn" onClick={openCreateForm}>
                        ➕ Neuer Gegenstand
                    </button>
                    <button className="secondary-btn" onClick={handleExport} title="Katalog als JSON sichern">
                        💾 Exportieren
                    </button>
                    <button className="secondary-btn" onClick={() => setImportModalOpen(true)} title="JSON importieren">
                        📥 Importieren
                    </button>
                    <button className="danger-btn small-btn" onClick={handleReset} title="Auf Standard-Items zurücksetzen">
                        🔄 Zurücksetzen
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="catalog-filter-bar">
                <input
                    type="text"
                    placeholder="🔍 Suche nach Gegenstand oder Tag..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="catalog-search-input"
                />

                <div className="catalog-category-chips">
                    <button
                        className={`cat-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setCategoryFilter('ALL')}
                    >
                        Alle ({items.length})
                    </button>
                    {(Object.keys(CATEGORY_LABELS) as Category[]).map(catKey => {
                        const count = items.filter(i => i.category === catKey).length;
                        return (
                            <button
                                key={catKey}
                                className={`cat-chip ${categoryFilter === catKey ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(catKey)}
                            >
                                {CATEGORY_LABELS[catKey].emoji} {CATEGORY_LABELS[catKey].label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Item Table / Cards */}
            <div className="catalog-items-grid">
                {filteredItems.length === 0 ? (
                    <div className="no-items-placeholder">
                        <p>Keine Gegenstände gefunden.</p>
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const catInfo = CATEGORY_LABELS[item.category] || { label: item.category, emoji: '📦' };
                        return (
                            <div key={item.id} className={`catalog-card ${!item.enabled ? 'disabled' : ''}`}>
                                <div className="catalog-card-header">
                                    <div className="catalog-card-title">
                                        <span className="cat-icon">{catInfo.emoji}</span>
                                        <strong>{item.name}</strong>
                                    </div>
                                    <label className="toggle-switch" title={item.enabled ? 'Aktiviert' : 'Deaktiviert'}>
                                        <input
                                            type="checkbox"
                                            checked={item.enabled}
                                            onChange={() => handleToggleEnabled(item.id)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>

                                <div className="catalog-card-details">
                                    <div className="detail-row">
                                        <span className="label">Kategorie:</span>
                                        <span className="value">{catInfo.label}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Gewicht:</span>
                                        <span className="value">{item.weight} g</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Mengenregel:</span>
                                        <span className="value">{formatRuleDescription(item)}</span>
                                    </div>
                                    {item.tags.length > 0 && (
                                        <div className="catalog-tags">
                                            {item.tags.map(t => (
                                                <span key={t} className="item-tag">#{t}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="catalog-card-footer">
                                    <span className="origin-badge">
                                        {item.isDefault ? 'Standard' : 'Benutzerdefiniert'}
                                    </span>
                                    <div className="card-btn-group">
                                        <button
                                            className="small-btn edit-btn"
                                            onClick={() => openEditForm(item)}
                                            title="Bearbeiten"
                                        >
                                            ✏️ Bearbeiten
                                        </button>
                                        <button
                                            className="small-btn danger-btn"
                                            onClick={() => handleDelete(item.id, item.name)}
                                            title="Löschen"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Create / Edit Modal */}
            {isFormOpen && (
                <div className="modal-backdrop" onClick={() => setIsFormOpen(false)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingItemId ? 'Gegenstand bearbeiten' : 'Neuen Gegenstand hinzufügen'}</h3>
                            <button className="close-btn" onClick={() => setIsFormOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSaveForm}>
                            <div className="form-group">
                                <label>Bezeichnung *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="z. B. Sonnenbrille"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Kategorie</label>
                                    <select
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value as Category)}
                                    >
                                        {(Object.keys(CATEGORY_LABELS) as Category[]).map(catKey => (
                                            <option key={catKey} value={catKey}>
                                                {CATEGORY_LABELS[catKey].emoji} {CATEGORY_LABELS[catKey].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Gewicht (in Gramm)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="10"
                                        value={formWeight}
                                        onChange={(e) => setFormWeight(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Mengenregel</label>
                                    <select
                                        value={formRuleType}
                                        onChange={(e) => setFormRuleType(e.target.value as QuantityRuleType)}
                                    >
                                        <option value="FIXED">Feste Anzahl</option>
                                        <option value="PER_DAY">Pro Tag</option>
                                        <option value="PER_X_DAYS">Alle X Tage</option>
                                        <option value="SHARED_PER_PEOPLE">Gemeinschaftlich (1x pro X Personen)</option>
                                    </select>
                                </div>

                                {formRuleType === 'PER_X_DAYS' && (
                                    <div className="form-group">
                                        <label>Intervall (Tage)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formRuleValue}
                                            onChange={(e) => setFormRuleValue(Number(e.target.value))}
                                            placeholder="z. B. 3 für alle 3 Tage"
                                        />
                                    </div>
                                )}

                                {formRuleType === 'SHARED_PER_PEOPLE' && (
                                    <div className="form-group">
                                        <label>Personen pro Einheit</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formRuleValue}
                                            onChange={(e) => setFormRuleValue(Number(e.target.value))}
                                            placeholder="z. B. 4 für je 4 Personen"
                                        />
                                    </div>
                                )}

                                {formRuleType !== 'PER_X_DAYS' && formRuleType !== 'SHARED_PER_PEOPLE' && (
                                    <div className="form-group">
                                        <label>Standard-Menge</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formDefaultQuantity}
                                            onChange={(e) => setFormDefaultQuantity(Number(e.target.value))}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Tags (kommagetrennt)</label>
                                <input
                                    type="text"
                                    value={formTags}
                                    onChange={(e) => setFormTags(e.target.value)}
                                    placeholder="z. B. base, rain, strand, foto"
                                />
                                <small className="hint-text">
                                    Hinweis: 'rain' wird nur bei Regen eingepackt, 'cold' nur bei Kälte.
                                </small>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="secondary-btn" onClick={() => setIsFormOpen(false)}>
                                    Abbrechen
                                </button>
                                <button type="submit" className="primary-btn">
                                    {editingItemId ? 'Änderungen speichern' : 'Hinzufügen'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModalOpen && (
                <div className="modal-backdrop" onClick={() => setImportModalOpen(false)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>JSON-Katalog importieren</h3>
                            <button className="close-btn" onClick={() => setImportModalOpen(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label>Füge hier den exportierten JSON-Code ein:</label>
                            <textarea
                                rows={8}
                                value={importJsonText}
                                onChange={(e) => setImportJsonText(e.target.value)}
                                placeholder='[ { "id": "...", "name": "...", ... } ]'
                                className="code-textarea"
                            />
                            {importError && (
                                <p className="error-text">⚠️ {importError}</p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={() => setImportModalOpen(false)}>
                                Abbrechen
                            </button>
                            <button className="primary-btn" onClick={handleImportSubmit}>
                                Jetzt Importieren
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
