import React, { useState, useEffect } from 'react';
import { CloudDownload, Clock, MapPin, Calendar, Users, X, ArrowRight, AlertCircle, LogIn, Lock } from 'lucide-react';
import { CollaborativeTripService, CollaborativeTripData } from '../services/CollaborativeTripService';

export interface LoadTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTrip: (trip: CollaborativeTripData) => void;
    currentUser?: { uid: string; displayName?: string | null; email?: string | null } | null;
    onLogin?: () => void;
}

export const LoadTripModal: React.FC<LoadTripModalProps> = ({
    isOpen,
    onClose,
    onSelectTrip,
    currentUser,
    onLogin
}) => {
    const [code, setCode] = useState('');
    const [recentTrips, setRecentTrips] = useState<CollaborativeTripData[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setCode('');
            loadRecents();
        }
    }, [isOpen, currentUser]);

    const loadRecents = async () => {
        if (!currentUser) {
            setRecentTrips([]);
            return;
        }

        setLoadingRecent(true);
        try {
            const list = await CollaborativeTripService.listRecentTrips(10, currentUser.uid);
            setRecentTrips(list);
        } catch (e) {
            console.error('Error loading recent trips:', e);
        } finally {
            setLoadingRecent(false);
        }
    };

    const handleSearchByCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const queryCode = code.trim();
        if (!queryCode) return;

        setSearching(true);
        setError(null);

        try {
            const found = await CollaborativeTripService.loadTripByCodeOrId(queryCode);
            if (found) {
                onSelectTrip(found);
                onClose();
            } else {
                setError(`Keine Reise mit dem Code oder der ID "${queryCode}" gefunden. Bitte überprüfe den Code.`);
            }
        } catch (err: any) {
            setError('Fehler beim Laden der Reise aus der Cloud.');
        } finally {
            setSearching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" id="load-trip-modal-backdrop">
            <div className="modal-dialog load-trip-dialog" id="load-trip-modal-content">
                <div className="modal-header">
                    <div className="flex items-center gap-2">
                        <CloudDownload className="text-indigo-400" size={22} />
                        <h3 className="m-0 text-lg font-semibold text-white">Reise von Cloud laden</h3>
                    </div>
                    <button type="button" onClick={onClose} className="close-btn" id="btn-close-load-modal">
                        <X size={20} />
                    </button>
                </div>

                <div className="load-trip-content">
                    <p className="text-sm text-gray-300 mb-4">
                        Gib den <strong>Reise-Code</strong> ein (z. B. von Mitreisenden geteilt) oder wähle eine deiner gespeicherten Reisen aus:
                    </p>

                    {/* Search / Enter Code Input */}
                    <form onSubmit={handleSearchByCode} className="code-input-form mb-5">
                        <div className="code-input-group">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="Code eingeben (z. B. REYK342)"
                                className="code-text-input"
                                id="input-search-trip-code"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={searching || !code.trim()}
                                className="btn-code-submit"
                                id="btn-search-trip-code"
                            >
                                {searching ? 'Sucht...' : (
                                    <>
                                        <span>Öffnen</span>
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>
                        </div>
                        {error && (
                            <div className="error-banner mt-2 flex items-center gap-2 text-rose-400 text-xs">
                                <AlertCircle size={14} />
                                <span>{error}</span>
                            </div>
                        )}
                    </form>

                    {/* Recent Trips Section */}
                    <div className="recent-trips-section">
                        <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                            <Clock size={14} />
                            <span>Deine gespeicherten Reisen:</span>
                        </div>

                        {!currentUser ? (
                            <div className="p-4 text-center text-xs text-gray-300 bg-[#121216] rounded-lg border border-[#2a2b36] flex flex-col items-center gap-2">
                                <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                                    <Lock size={15} />
                                    <span>Deine Reisen sind geschützt</span>
                                </div>
                                <p className="text-gray-400 max-w-sm">
                                    Melde dich mit Google an, um deine eigenen Reisen in dieser Liste zu sehen und fremden Zugriff zu verhindern.
                                </p>
                                {onLogin && (
                                    <button
                                        type="button"
                                        onClick={onLogin}
                                        className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs transition-colors"
                                    >
                                        <LogIn size={13} />
                                        <span>Jetzt mit Google anmelden</span>
                                    </button>
                                )}
                            </div>
                        ) : loadingRecent ? (
                            <div className="text-center py-6 text-sm text-gray-400">
                                Lade deine Reisen...
                            </div>
                        ) : recentTrips.length === 0 ? (
                            <div className="empty-trips-notice p-4 text-center text-xs text-gray-400 bg-[#121216] rounded-lg border border-[#2a2b36]">
                                Du hast noch keine Reisen in der Cloud gespeichert. Erstelle eine neue Reise und klicke auf „In Cloud speichern &amp; teilen“!
                            </div>
                        ) : (
                            <div className="recent-trips-grid">
                                {recentTrips.map((item) => {
                                    const totalItems = (item.people || []).reduce((acc, p) => acc + (p.inventory?.length || 0), 0) + (item.communityBox?.length || 0);
                                    const packedCount = Object.values(item.packedMap || {}).filter(Boolean).length;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                onSelectTrip(item);
                                                onClose();
                                            }}
                                            className="recent-trip-card"
                                            id={`recent-trip-${item.shareCode || item.id}`}
                                        >
                                            <div className="recent-card-top">
                                                <div className="trip-destination-title flex items-center gap-1.5 font-semibold text-white">
                                                    <MapPin size={14} className="text-indigo-400" />
                                                    <span>{item.destination || 'Unbenannte Reise'}</span>
                                                </div>
                                                <span className="code-chip">{item.shareCode}</span>
                                            </div>

                                            <div className="recent-card-meta flex items-center gap-3 text-xs text-gray-400 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {item.date} ({item.days} Tage)
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users size={12} />
                                                    {item.people?.length || 0} Personen
                                                </span>
                                            </div>

                                            <div className="recent-card-footer mt-3 pt-2 border-t border-[#2a2b36] flex justify-between items-center text-xs">
                                                <span className="text-emerald-400">
                                                    {packedCount}/{totalItems} gepackt
                                                </span>
                                                <span className="text-gray-500">
                                                    {item.lastUpdatedBy ? `von ${item.lastUpdatedBy}` : ''}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-modal-cancel"
                        id="btn-cancel-load-trip"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};
