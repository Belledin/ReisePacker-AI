import React from 'react';
import { Thermometer, Droplets, CloudSun, Sun, CloudRain, Snowflake, MapPin, Calendar, Compass, Umbrella, Flame, ShieldCheck } from 'lucide-react';
import { WeatherData, WeatherTriggers } from '../services/WeatherService';

export interface WeatherDashboardSummaryProps {
    destination: string;
    date: string;
    days: number;
    weatherData: WeatherData;
    triggers: WeatherTriggers;
}

export const WeatherDashboardSummary: React.FC<WeatherDashboardSummaryProps> = ({
    destination,
    date,
    days,
    weatherData,
    triggers
}) => {
    // Format travel date into a friendly German display string
    const formatDisplayDate = (dateStr: string) => {
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return d.toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    // Determine condition presentation
    const getConditionPresentation = () => {
        const code = (weatherData.conditionCode || '').toLowerCase();
        if (code.includes('snow') || triggers.isSnowy) {
            return {
                label: 'Schneefall / Winter',
                sub: 'Schneerisiko & frostig',
                icon: <Snowflake className="weather-icon text-cyan-400" size={24} />,
                colorClass: 'condition-snow'
            };
        }
        if (code.includes('rain') || triggers.isRainy) {
            return {
                label: 'Regnerisch',
                sub: `${weatherData.rainProb}% Niederschlag`,
                icon: <CloudRain className="weather-icon text-blue-400" size={24} />,
                colorClass: 'condition-rain'
            };
        }
        if (triggers.isHot || code.includes('clear') || code.includes('sun')) {
            return {
                label: weatherData.temp > 24 ? 'Sonnig & Heiß' : 'Klar & Sonnig',
                sub: 'Geringe Bewölkung',
                icon: <Sun className="weather-icon text-amber-400" size={24} />,
                colorClass: 'condition-sun'
            };
        }
        return {
            label: 'Mäßig / Bewölkt',
            sub: 'Stabile Wetterlage',
            icon: <CloudSun className="weather-icon text-indigo-300" size={24} />,
            colorClass: 'condition-cloud'
        };
    };

    const getTempRating = (temp: number) => {
        if (temp < 0) return { text: 'Eiskalt / Frost', color: 'badge-frost' };
        if (temp < 10) return { text: 'Kalt (<10°C)', color: 'badge-cold' };
        if (temp < 20) return { text: 'Mild', color: 'badge-mild' };
        if (temp < 26) return { text: 'Warm', color: 'badge-warm' };
        return { text: 'Sehr heiß (>25°C)', color: 'badge-hot' };
    };

    const condition = getConditionPresentation();
    const tempRating = getTempRating(weatherData.temp);

    return (
        <section className="weather-summary-panel" id="weather-summary-dashboard">
            <div className="weather-summary-header">
                <div className="weather-header-title">
                    <CloudSun size={18} className="weather-header-icon" />
                    <span className="weather-title-text">Wetter-Zusammenfassung</span>
                </div>
                <div className="weather-header-meta">
                    <span className="weather-meta-tag" id="weather-meta-location">
                        <MapPin size={13} />
                        {destination}
                    </span>
                    <span className="weather-meta-tag" id="weather-meta-date">
                        <Calendar size={13} />
                        {formatDisplayDate(date)}
                    </span>
                    <span className="weather-meta-duration" id="weather-meta-days">
                        <Compass size={13} />
                        {days} {days === 1 ? 'Tag' : 'Tage'}
                    </span>
                </div>
            </div>

            {/* Grid of 3 simple weather indicator cards */}
            <div className="weather-cards-grid" id="weather-metrics-grid">
                {/* 1. Temperatur */}
                <div className="weather-card" id="weather-temp-card">
                    <div className="weather-card-top">
                        <div className="weather-icon-wrapper temp-wrapper">
                            <Thermometer size={20} />
                        </div>
                        <span className="weather-card-label">Temperatur</span>
                    </div>
                    <div className="weather-card-body">
                        <div className="weather-card-value">
                            {weatherData.temp}°C
                        </div>
                        <span className={`weather-rating-chip ${tempRating.color}`}>
                            {tempRating.text}
                        </span>
                    </div>
                </div>

                {/* 2. Wetterlage */}
                <div className="weather-card" id="weather-condition-card">
                    <div className="weather-card-top">
                        <div className={`weather-icon-wrapper ${condition.colorClass}`}>
                            {condition.icon}
                        </div>
                        <span className="weather-card-label">Wetterlage</span>
                    </div>
                    <div className="weather-card-body">
                        <div className="weather-card-value text-compact">
                            {condition.label}
                        </div>
                        <span className="weather-card-subtext">
                            {condition.sub}
                        </span>
                    </div>
                </div>

                {/* 3. Regenrisiko */}
                <div className="weather-card" id="weather-rain-card">
                    <div className="weather-card-top">
                        <div className="weather-icon-wrapper rain-wrapper">
                            <Droplets size={20} />
                        </div>
                        <span className="weather-card-label">Regenwahrscheinlichkeit</span>
                    </div>
                    <div className="weather-card-body">
                        <div className="weather-card-value">
                            {weatherData.rainProb}%
                        </div>
                        <span className={`weather-rating-chip ${weatherData.rainProb > 30 ? 'badge-rain-high' : 'badge-rain-low'}`}>
                            {weatherData.rainProb > 30 ? 'Erhöhtes Risiko' : 'Trocken / Gering'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Impact & Packing Triggers Banner */}
            <div className="weather-triggers-bar" id="weather-packing-impact-banner">
                <div className="triggers-label-wrapper">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span className="triggers-heading">Auswirkung auf Packliste:</span>
                </div>
                <div className="triggers-chips-list">
                    {triggers.isRainy && (
                        <span className="trigger-pill trigger-rain" id="trigger-badge-rain">
                            <Umbrella size={13} />
                            Regenzeug & Schirm eingepackt (Regen &gt; 30%)
                        </span>
                    )}
                    {triggers.isCold && (
                        <span className="trigger-pill trigger-cold" id="trigger-badge-cold">
                            <Snowflake size={13} />
                            Thermoschicht & Kälteschutz (&lt; 10°C)
                        </span>
                    )}
                    {triggers.isHot && (
                        <span className="trigger-pill trigger-hot" id="trigger-badge-hot">
                            <Flame size={13} />
                            Sonnenschutz & leichte Sommerkleidung (&gt; 25°C)
                        </span>
                    )}
                    {triggers.isSnowy && (
                        <span className="trigger-pill trigger-snow" id="trigger-badge-snow">
                            <Snowflake size={13} />
                            Winterausrüstung aktiv
                        </span>
                    )}
                    {!triggers.isRainy && !triggers.isCold && !triggers.isHot && !triggers.isSnowy && (
                        <span className="trigger-pill trigger-mild" id="trigger-badge-neutral">
                            <CloudSun size={13} />
                            Gemäßigtes Reiseklima – Standard-Garderobe ausreichend
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
};
