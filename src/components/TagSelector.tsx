import React, { useState } from 'react';

export interface AvailableTag {
    id: string;
    label: string;
    emoji: string;
    group: 'logic' | 'weather' | 'activity' | 'health';
    description: string;
}

export const SYSTEM_TAGS: AvailableTag[] = [
    // 1. Basis & Logik
    {
        id: 'base',
        label: '#base',
        emoji: '⭐',
        group: 'logic',
        description: 'Immer & für jede Person auf jeder Packliste'
    },
    {
        id: 'shared',
        label: '#shared',
        emoji: '🤝',
        group: 'logic',
        description: 'Gemeinschaftlich teilbar (wandert in Box oder balanciertes Gepäck)'
    },

    // 2. Wetterbedingungen
    {
        id: 'rain',
        label: '#rain',
        emoji: '🌧️',
        group: 'weather',
        description: 'Nur bei Regenwetter (> 30% Regenwahrscheinlichkeit)'
    },
    {
        id: 'cold',
        label: '#cold',
        emoji: '❄️',
        group: 'weather',
        description: 'Nur bei Kälte (< 10°C Temperatur)'
    },

    // 3. Reisezweck & Aktivitäten
    {
        id: 'beach',
        label: '#beach',
        emoji: '🏖️',
        group: 'activity',
        description: 'Nur wenn Aktivität "Strand & Baden" gewählt ist'
    },
    {
        id: 'hiking',
        label: '#hiking',
        emoji: '🥾',
        group: 'activity',
        description: 'Nur wenn Aktivität "Wandern & Outdoor" gewählt ist'
    },
    {
        id: 'ski',
        label: '#ski',
        emoji: '⛷️',
        group: 'activity',
        description: 'Nur wenn Aktivität "Ski & Wintersport" gewählt ist'
    },
    {
        id: 'business',
        label: '#business',
        emoji: '💼',
        group: 'activity',
        description: 'Nur wenn Aktivität "Geschäftsreise" gewählt ist'
    },
    {
        id: 'cycling',
        label: '#cycling',
        emoji: '🚴',
        group: 'activity',
        description: 'Nur wenn Aktivität "Radtour" gewählt ist'
    },
    {
        id: 'camping',
        label: '#camping',
        emoji: '🏕️',
        group: 'activity',
        description: 'Nur wenn Aktivität "Camping" gewählt ist'
    },
    {
        id: 'fitness',
        label: '#fitness',
        emoji: '🏃',
        group: 'activity',
        description: 'Nur wenn Aktivität "Sport & Fitness" gewählt ist'
    },
    {
        id: 'sightseeing',
        label: '#sightseeing',
        emoji: '🏛️',
        group: 'activity',
        description: 'Nur wenn Aktivität "Sightseeing" gewählt ist'
    },

    // 4. Gesundheit
    {
        id: 'health',
        label: '#health',
        emoji: '💊',
        group: 'health',
        description: 'Medikamente & Gesundheitsbedarf'
    }
];

interface TagSelectorProps {
    selectedTags: string[];
    onChange: (tags: string[]) => void;
    showHelpText?: boolean;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
    selectedTags,
    onChange,
    showHelpText = true
}) => {
    const [customTagInput, setCustomTagInput] = useState('');

    const toggleTag = (tagId: string) => {
        const cleanId = tagId.toLowerCase().trim().replace(/^#/, '');
        if (selectedTags.includes(cleanId)) {
            onChange(selectedTags.filter(t => t !== cleanId));
        } else {
            onChange([...selectedTags, cleanId]);
        }
    };

    const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
        if ('key' in e && e.key !== 'Enter') return;
        e.preventDefault();
        const clean = customTagInput.toLowerCase().trim().replace(/^#/, '');
        if (clean && !selectedTags.includes(clean)) {
            onChange([...selectedTags, clean]);
            setCustomTagInput('');
        }
    };

    const removeCustomTag = (tagToRemove: string) => {
        onChange(selectedTags.filter(t => t !== tagToRemove));
    };

    const isBaseSelected = selectedTags.includes('base');
    const knownTagIds = new Set(SYSTEM_TAGS.map(t => t.id));
    const customSelectedTags = selectedTags.filter(t => !knownTagIds.has(t));

    return (
        <div className="tag-selector-component space-y-2.5">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                    Hashtags & Filter-Bedingungen:
                </label>
                <span className="text-[11px] text-slate-400">
                    {selectedTags.length} {selectedTags.length === 1 ? 'Tag aktiv' : 'Tags aktiv'}
                </span>
            </div>

            {/* System Tag Selection Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-900/60 rounded-xl border border-slate-800">
                {SYSTEM_TAGS.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border text-left ${
                                isSelected
                                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm'
                                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/70 text-slate-400 hover:text-slate-200'
                            }`}
                            title={`${tag.label}: ${tag.description}`}
                        >
                            <span>{tag.emoji}</span>
                            <span className="font-semibold">{tag.label}</span>
                            {isSelected && <span className="text-[10px] text-indigo-300">✓</span>}
                        </button>
                    );
                })}
            </div>

            {/* Custom Extra Tags (Freitext Tags) */}
            {customSelectedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Eigene Tags:</span>
                    {customSelectedTags.map(ct => (
                        <span
                            key={ct}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-purple-950/50 border border-purple-500/50 text-purple-200"
                        >
                            <span>#{ct}</span>
                            <button
                                type="button"
                                onClick={() => removeCustomTag(ct)}
                                className="text-purple-400 hover:text-purple-200 text-xs font-bold leading-none"
                                title="Tag entfernen"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Add Custom Tag Input */}
            <div className="flex items-center gap-2 pt-1">
                <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    placeholder="Eigenen Tag eingeben (z. B. tauchen, foto)..."
                    className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500"
                />
                <button
                    type="button"
                    onClick={handleAddCustomTag}
                    disabled={!customTagInput.trim()}
                    className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-lg font-medium transition"
                >
                    + Hinzufügen
                </button>
            </div>

            {/* Context Explanation & Hints */}
            {showHelpText && (
                <div className="p-2 bg-slate-900/40 rounded-lg border border-slate-800 text-[11px] space-y-1">
                    {isBaseSelected ? (
                        <p className="text-amber-300/90 flex items-start gap-1">
                            <span>⭐</span>
                            <span>
                                <strong>#base ist gewählt:</strong> Dieser Gegenstand wird <em>immer</em> für <em>jede Person</em> automatisch auf die Packliste gesetzt.
                            </span>
                        </p>
                    ) : (
                        <p className="text-slate-400 flex items-start gap-1">
                            <span>💡</span>
                            <span>
                                <strong>Ohne #base:</strong> Der Gegenstand wird nur eingepackt, wenn die passende Aktivität (z. B. #beach, #hiking) oder Wetterlage (#rain, #cold) zutrifft.
                            </span>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
