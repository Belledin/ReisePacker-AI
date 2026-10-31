import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-backdrop">
                    <div className="error-boundary-card">
                        <div className="error-boundary-icon">⚠️</div>
                        <h2>{this.props.fallbackTitle || 'Hoppla! Ein Fehler ist aufgetreten'}</h2>
                        <p className="error-boundary-desc">
                            Die Anwendung ist auf ein unerwartetes Problem gestoßen. Deine Daten wurden nicht gelöscht.
                        </p>
                        
                        {this.state.error && (
                            <div className="error-boundary-details">
                                <strong>Fehlermeldung:</strong>
                                <code>{this.state.error.message || String(this.state.error)}</code>
                            </div>
                        )}

                        <div className="error-boundary-actions">
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={this.handleReset}
                            >
                                ↺ Zurück zum Reiseplaner
                            </button>
                            <button
                                type="button"
                                className="secondary"
                                onClick={this.handleReload}
                            >
                                🔄 Seite neu laden
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
