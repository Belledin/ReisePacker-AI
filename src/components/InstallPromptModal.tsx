import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallPromptModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already opened in standalone mode (already installed on homescreen)
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setIsStandalone(standalone);

        // Detect iOS
        const ua = window.navigator.userAgent.toLowerCase();
        const iOSDevice = /iphone|ipad|ipod/.test(ua);
        setIsIOS(iOSDevice);

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsOpen(false);
            }
        } else {
            setIsOpen(true);
        }
    };

    // If already running standalone on homescreen, show a subtle active badge or nothing
    if (isStandalone) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition transform active:scale-95"
                title="ReisePacker auf den Startbildschirm / Homescreen legen"
            >
                <img src="/apple-touch-icon.png" alt="Icon" className="w-4 h-4 rounded-sm object-cover" />
                <span>📱 Zum Startbildschirm</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-4 mb-4">
                            <img
                                src="/apple-touch-icon.png"
                                alt="ReisePacker App Icon"
                                className="w-16 h-16 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700"
                            />
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    ReisePacker AI
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    App-Icon auf dem Homescreen
                                </p>
                            </div>
                        </div>

                        {isIOS ? (
                            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                                <p className="font-semibold text-blue-600 dark:text-blue-400">
                                    So legst du das Icon auf dein iPhone / iPad:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <li>
                                        Tippe unten in Safari auf das <strong>Teilen-Symbol</strong>{' '}
                                        <span className="inline-block px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">
                                            [⬆]
                                        </span>
                                    </li>
                                    <li>
                                        Scrolle im Menü etwas nach unten und wähle <strong>„Zum Home-Bildschirm“</strong> (oder <em>Add to Home Screen</em>).
                                    </li>
                                    <li>
                                        Tippe oben rechts auf <strong>„Hinzufügen“</strong>.
                                    </li>
                                </ol>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Das ReisePacker-Koffersymbol wird nun wie eine native App auf deinem Homescreen angezeigt.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                                <p className="font-semibold text-blue-600 dark:text-blue-400">
                                    So legst du das Icon auf dein Android-Smartphone:
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <li>
                                        Tippe oben rechts im Chrome-Browser auf die <strong>drei Punkte</strong> (⋮).
                                    </li>
                                    <li>
                                        Wähle <strong>„App installieren“</strong> oder <strong>„Zum Startbildschirm hinzufügen“</strong>.
                                    </li>
                                    <li>Bestätige mit <strong>„Installieren“</strong>.</li>
                                </ol>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Die App öffnet sich künftig blitzschnell im Vollbildmodus ohne Browserleiste!
                                </p>
                            </div>
                        )}

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-xl transition"
                            >
                                Verstanden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
