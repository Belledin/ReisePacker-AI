import React, { useState } from 'react';
import { CatalogItem, calculateCatalogItemQuantity } from '../logic/defaultCatalog';
import { Category } from '../logic/PackingEngine';
import { CATEGORY_LABELS } from './CatalogManagerView';

interface AddAdHocItemModalProps {
    targetName: string; // e.g. "Papa" or "Community Box"
    catalogItems: CatalogItem[];
    days?: number;
    peopleCount?: number;
    onClose: () => void;
    onAdd: (
        item: {
            name: string;
            quantity: number;
            weight: number;
            category: Category;
            tags: string[];
        },
        saveToCatalog: boolean
    ) => void;
}

export const AddAdHocItemModal: React.FC<AddAdHocItemModalProps> = ({
    targetName,
    catalogItems,
    days = 1,
    peopleCount = 1,
    onClose,
    onAdd
}) => {
    const [selectedCatalogId, setSelectedCatalogId] = useState<string>('CUSTOM');
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [weight, setWeight] = useState(100);
    const [category, setCategory] = useState<Category>('misc');
    const [saveToCatalog, setSaveToCatalog] = useState(false);
    const [appliedRuleText, setAppliedRuleText] = useState<string | null>(null);

    const handleCatalogSelect = (id: string) => {
        setSelectedCatalogId(id);
        if (id === 'CUSTOM') {
            setName('');
            setWeight(100);
            setCategory('misc');
            setQuantity(1);
            setAppliedRuleText(null);
            setSaveToCatalog(false);
        } else {
            const found = catalogItems.find(i => i.id === id);
            if (found) {
                setName(found.name);
                setWeight(found.weight);
                setCategory(found.category);
                
                // Berechne die Menge anhand der hinterlegten Mengenregel
                const calculatedQty = calculateCatalogItemQuantity(found, days, peopleCount);
                setQuantity(calculatedQty);

                // Erläuternden Text für die Mengenregel anzeigen
                let ruleDesc = '';
                if (found.ruleType === 'PER_DAY') {
                    ruleDesc = `${found.defaultQuantity * (found.ruleValue || 1)}x pro Tag × ${days} Tage = ${calculatedQty} Stück`;
                } else if (found.ruleType === 'PER_X_DAYS') {
                    ruleDesc = `1x alle ${found.ruleValue || 3} Tage bei ${days} Reisetagen = ${calculatedQty} Stück`;
                } else if (found.ruleType === 'SHARED_PER_PEOPLE') {
                    ruleDesc = `Gemeinschaftlich für ${peopleCount} Personen = ${calculatedQty} Stück`;
                } else {
                    ruleDesc = `Feste Anzahl = ${calculatedQty} Stück`;
                }
                setAppliedRuleText(ruleDesc);
                setSaveToCatalog(false);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        let tags: string[] = ['custom'];
        if (selectedCatalogId !== 'CUSTOM') {
            const found = catalogItems.find(i => i.id === selectedCatalogId);
            if (found) {
                tags = [...found.tags];
            }
        }

        onAdd(
            {
                name: name.trim(),
                quantity: Math.max(1, quantity),
                weight: Math.max(0, weight),
                category,
                tags
            },
            saveToCatalog
        );
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>➕ Gegenstand hinzufügen zu: <span className="highlight-text">{targetName}</span></h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Aus Katalog auswählen</label>
                        <select
                            value={selectedCatalogId}
                            onChange={(e) => handleCatalogSelect(e.target.value)}
                        >
                            <option value="CUSTOM">✏️ Eigener / Freitext-Gegenstand...</option>
                            <optgroup label="Vorhandene Katalog-Gegenstände">
                                {catalogItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {CATEGORY_LABELS[item.category]?.emoji || '📦'} {item.name} ({item.weight}g)
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Bezeichnung *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z. B. Kuscheltier, Reisedecke, Schnorchel"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Anzahl</label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                required
                            />
                            {appliedRuleText && (
                                <small className="hint-text" style={{ color: '#0284c7', marginTop: '4px', display: 'block' }}>
                                    ✨ Mengenregel angewendet: {appliedRuleText}
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Gewicht pro Stück (g)</label>
                            <input
                                type="number"
                                min="0"
                                step="10"
                                value={weight}
                                onChange={(e) => setWeight(Number(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Kategorie</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as Category)}
                        >
                            {(Object.keys(CATEGORY_LABELS) as Category[]).map(catKey => (
                                <option key={catKey} value={catKey}>
                                    {CATEGORY_LABELS[catKey].emoji} {CATEGORY_LABELS[catKey].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedCatalogId === 'CUSTOM' && (
                        <div className="form-checkbox-row">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={saveToCatalog}
                                    onChange={(e) => setSaveToCatalog(e.target.checked)}
                                />
                                <span>Diesen Gegenstand dauerhaft im Katalog für zukünftige Reisen speichern</span>
                            </label>
                        </div>
                    )}

                    <div className="modal-footer">
                        <button type="button" className="secondary-btn" onClick={onClose}>
                            Abbrechen
                        </button>
                        <button type="submit" className="primary-btn">
                            Hinzufügen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
