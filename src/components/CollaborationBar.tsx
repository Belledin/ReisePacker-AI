import React, { useState } from 'react';
import { Share2, Users, Copy, Check, Cloud, RefreshCw, Smartphone, Laptop, X, Send } from 'lucide-react';
import { CollaborativeTripData } from '../services/CollaborativeTripService';

export interface CollaborationBarProps {
    trip: CollaborativeTripData | null;
    currentUserName: string;
    onChangeUserName: (name: string) => void;
    onSaveToCloud: () => Promise<void>;
    onOpenLoadModal: () => void;
    isSaving: boolean;
    isLiveSyncing: boolean;
}

export const CollaborationBar: React.FC<CollaborationBarProps> = ({
    trip,
    currentUserName,
    onChangeUserName,
    onSaveToCloud,
    onOpenLoadModal,
    isSaving,
    isLiveSyncing
}) => {
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [showSharePopup, setShowSharePopup] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(currentUserName);

    const shareCode = trip?.shareCode || trip?.id || '';
    // Always use the public/pre URL instead of private dev URL so shared partners don't hit 403
    const origin = typeof window !== 'undefined'
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : '';
    const shareUrl = origin && shareCode
        ? `${origin}${window.location.pathname}?trip=${shareCode}`
        : '';

    const handleCopyLink = async () => {
        if (!shareCode) return;
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl || shareCode);
            }
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2500);
        } catch (err) {
            console.error('Failed to copy link', err);
        }
    };

    const handleCopyCode = async () => {
        if (!shareCode) return;
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareCode);
            }
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2500);
        } catch (err) {
            console.error('Failed to copy code', err);
        }
    };

    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const handleNativeShare = async () => {
        if (!shareCode) return;
        try {
            await navigator.share({
                title: 'Packliste für unsere Reise',
                text: `Hier ist unsere gemeinsame Reise-Packliste (Code: ${shareCode}):`,
                url: shareUrl || window.location.href,
            });
        } catch (err) {
            // User cancelled share
        }
    };

    const handleSaveName = () => {
        if (tempName.trim()) {
            onChangeUserName(tempName.trim());
        }
        setEditingName(false);
    };

    return (
        <div className="collab-bar-container" id="collaboration-sync-bar">
            {/* Left: User Identity Chip (Google Notizen Feel) */}
            <div className="collab-user-section">
                <div className="user-avatar-badge" title="Dein Profilname für die Zusammenarbeit">
                    <Users size={15} />
                </div>
                {editingName ? (
                    <div className="user-name-edit-box">
                        <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            onBlur={handleSaveName}
                            autoFocus
                            maxLength={20}
                            placeholder="Dein Name..."
                            className="user-name-input"
                            id="user-name-input-field"
                        />
                        <button
                            type="button"
                            onClick={handleSaveName}
                            className="btn-tiny-check"
                            id="btn-confirm-user-name"
                        >
                            <Check size={12} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            setTempName(currentUserName);
                            setEditingName(true);
                        }}
                        className="user-name-btn"
                        id="user-name-display-btn"
                        title="Klicken, um deinen Namen zu ändern"
                    >
                        <span>Aktiv als: <strong>{currentUserName}</strong></span>
                        <span className="user-edit-hint">(ändern)</span>
                    </button>
                )}
            </div>

            {/* Middle: Cloud & Sync Status */}
            <div className="collab-status-section">
                {isLiveSyncing ? (
                    <div className="sync-live-badge" title="Änderungen werden live zwischen allen Rechnern & Handys synchronisiert">
                        <span className="pulse-dot"></span>
                        <Cloud size={14} className="text-emerald-400" />
                        <span>Live mit Cloud synchronisiert</span>
                        {trip?.lastUpdatedBy && (
                            <span className="last-sync-author">
                                (Zuletzt: {trip.lastUpdatedBy})
                            </span>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onSaveToCloud}
                        disabled={isSaving}
                        className="btn-cloud-save"
                        id="btn-cloud-save-trip"
                        title="Diese Liste in der Cloud speichern, um sie mit deiner Frau zu teilen"
                    >
                        {isSaving ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Speichert...</span>
                            </>
                        ) : (
                            <>
                                <Cloud size={14} />
                                <span>In Cloud speichern & teilen</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Right: Share / Code Actions */}
            <div className="collab-actions-section">
                {shareCode ? (
                    <div className="share-code-pill-wrapper">
                        <button
                            type="button"
                            onClick={() => setShowSharePopup(!showSharePopup)}
                            className="btn-share-pill"
                            id="btn-toggle-share-popup"
                        >
                            <Share2 size={14} />
                            <span>Code: <strong>{shareCode}</strong></span>
                        </button>

                        {/* Share Details Dropdown / Modal */}
                        {showSharePopup && (
                            <>
                                <div
                                    className="share-popup-backdrop"
                                    onClick={() => setShowSharePopup(false)}
                                    aria-hidden="true"
                                />
                                <div className="share-dropdown-panel" id="share-dropdown-popup" role="dialog" aria-modal="true">
                                    <div className="share-dropdown-header">
                                        <div className="share-header-title-row">
                                            <h4>Reise teilen (wie Google Notizen)</h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowSharePopup(false)}
                                                className="btn-popup-close"
                                                aria-label="Fenster schließen"
                                                title="Schließen"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <p>Gemeinsam auf Smartphone &amp; Laptop bearbeiten. Jede Änderung wird in Echtzeit synchronisiert:</p>
                                    </div>
                                    <div className="share-code-box">
                                        <div className="share-code-left">
                                            <span className="share-code-label">Reisecode:</span>
                                            <span className="share-big-code">{shareCode}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCopyCode}
                                            className="btn-copy-code"
                                            id="btn-copy-share-code"
                                            title="Reisecode in die Zwischenablage kopieren"
                                        >
                                            {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                            <span>{copiedCode ? 'Kopiert!' : 'Code'}</span>
                                        </button>
                                    </div>

                                    <div className="share-link-action-block">
                                        <button
                                            type="button"
                                            onClick={handleCopyLink}
                                            className="btn-copy-link-primary"
                                            id="btn-copy-share-link"
                                            title="Direkten Einladungslink in Zwischenablage kopieren"
                                        >
                                            {copiedLink ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
                                            <span>{copiedLink ? 'Link erfolgreich kopiert!' : 'Direkten Link kopieren'}</span>
                                        </button>

                                        {canNativeShare && (
                                            <button
                                                type="button"
                                                onClick={handleNativeShare}
                                                className="btn-native-share"
                                                id="btn-native-share-action"
                                                title="Direkt per WhatsApp, Messenger oder E-Mail teilen"
                                            >
                                                <Send size={14} />
                                                <span>Direkt über WhatsApp / App teilen</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="share-instructions">
                                        <div className="inst-row">
                                            <Laptop size={14} />
                                            <span>Auf anderem PC: <strong>„Reise laden“</strong> anklicken &amp; Code <code>{shareCode}</code> eingeben.</span>
                                        </div>
                                        <div className="inst-row">
                                            <Smartphone size={14} />
                                            <span>Auf dem Smartphone: Link im Browser öffnen oder Code eingeben.</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                <button
                    type="button"
                    onClick={onOpenLoadModal}
                    className="btn-load-trip-header"
                    id="btn-open-load-trip-modal"
                    title="Bestehende Liste von anderem Rechner per Code oder Auswahl laden"
                >
                    <RefreshCw size={13} />
                    <span>Reise laden...</span>
                </button>
            </div>
        </div>
    );
};
