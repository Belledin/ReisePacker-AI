# 🧳 ReisePacker-AI (FamilyPack AI)

> **Smarte, wetter- und gewichtsoptimierte Packlisten für Einzelpersonen, Familien und Gruppenreisen.**

ReisePacker-AI ist eine moderne Webanwendung, die den Packprozess vor Reisen automatisiert und optimiert. Basierend auf Reisedauer, Zielort, Echtzeit-Wetterbedingungen, Altersstrukturen und Gepäcklimits generiert die App maßgeschneiderte Packlisten mit interaktiver Checkliste.

---

## ✨ Features & Highlights

- 🌤️ **Wetterbasierte Vorschläge (Weather Triggers):**
  - Automatische Abfrage von Wetterdaten für Zielort und Reisedatum.
  - Dynamische Trigger: z. B. Regenbekleidung bei >30 % Regenwahrscheinlichkeit oder Thermokleidung bei <10 °C.

- 👨‍👩‍👧‍👦 **Shared Mode vs. Individual Mode:**
  - **Shared Mode:** Gemeinschaftsartikel (z. B. Sonnencreme, Zahnpasta, Powerbanks) werden intelligent in einer **Community Box** gebündelt, statt redundant von jeder Person eingepackt zu werden.
  - **Individual Mode:** Autonome Packlisten für unabhängige Reisende.

- 👶 **Demografische Profile & Altersfaktoren:**
  - Automatische Gewichtsanpassung für verschiedene Personentypen:
    - **Erwachsene** (Faktor 1.0)
    - **Jugendliche** (Faktor 1.0)
    - **Kinder** (Faktor 0.6)
    - **Kleinkinder** (Faktor 0.3)

- ⚖️ **Gewichts- & Transport-Constraints:**
  - Automatische Berechnung des Gesamtgewichts pro Person inkl. 15 % Sicherheitspuffer.
  - Überwachung von Gepäcklimits (z. B. 23 kg Flug-Aufgabegepäck).

- ✅ **Interaktiver Pack-Modus (Pack Day UX):**
  - Intuitive Checkliste zum Abhaken von Gegenständen.
  - Echtzeit-Fortschrittsanzeige (global sowie pro Person und für die Community Box).
  - Filteroptionen (*Alle*, *Offen*, *Gepackt*) und Schnellaktionen (*Alle abhaken*, *Zurücksetzen*).
  - Persistente Speicherung des Packfortschritts im LocalStorage.

- 💾 **Historie & Cloud-Persistenz:**
  - Speichern und Verwalten vergangener Reisen mit Supabase.
  - *Clone & Edit*-Funktion zur Wiederverwendung bewährter Packlisten.

---

## 🛠️ Technologie-Stack

| Bereich | Technologie |
|---|---|
| **Frontend** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Backend & DB** | [Supabase](https://supabase.com/) (@supabase/supabase-js) |
| **Testing** | [Jest](https://jestjs.io/) & [ts-jest](https://kulshekhar.github.io/ts-jest/) |
| **Styling** | Modernes Responsive Dark-Theme (CSS) |

---

## 📁 Projektstruktur

`
ReisePacker-AI/
├── PRD.md                       # Produktanforderungen & Spezifikationen
├── knowledge_base.md            # Referenzdaten (Gewichtstabellen, Limits)
├── supabase/
│   └── schema.sql               # Datenbankschema für Trips & Items
└── src/
    ├── App.tsx                  # Hauptoberfläche (Trip Wizard & Checkliste)
    ├── index.css                # Styling & Themes
    ├── hooks/
    │   └── useHistory.ts        # Cloud-Historisierung & Persistenz
    ├── lib/
    │   └── supabaseClient.ts    # Supabase Client Initialisierung
    ├── logic/
    │   ├── PackingEngine.ts     # Kern-Algorithmus zur Packlistenberechnung
    │   ├── ChecklistManager.ts  # Zustand & Logik der interaktiven Checkliste
    │   └── DashboardService.ts  # Dashboard- & Statistik-Auswertungen
    └── services/
        └── WeatherService.ts    # Wetterdienst-Integration (APIs & Mocks)
`

---

## 🚀 Erste Schritte / Installation

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- 
pm oder yarn

### 1. Repository klonen
`ash
git clone https://github.com/Belledin/ReisePacker-AI.git
cd ReisePacker-AI
`

### 2. Abhängigkeiten installieren
`ash
npm install
`

### 3. Umgebungsvariablen einrichten (Optional)
Erstelle eine .env-Datei im Root-Verzeichnis:
`nv
# Wetterdienst (OpenWeatherMap API)
VITE_OPENWEATHER_API_KEY=dein_api_key

# Supabase Konfiguration
VITE_SUPABASE_URL=deine_supabase_url
VITE_SUPABASE_KEY=dein_supabase_anon_key
`
> *Hinweis:* Die App enthält integrierte Fallbacks und Testdaten, sodass sie auch ohne API-Keys direkt lauffähig ist.

### 4. Entwicklungsserver starten
`ash
npm run dev
`
Die App ist anschließend unter **http://localhost:5173/** erreichbar.

---

## 🧪 Tests ausführen

Die Unit-Tests für Packing-Engine, Wetterdienst, Historisierung und Checklist-Manager ausführen:
`ash
npm test
`

---

## 🗺️ Roadmap & Ausblick

- [ ] **Echtzeit-Kollaboration:** Gemeinsames Abhaken auf mehreren Geräten via Supabase Realtime.
- [ ] **Airline-Datenbank:** Automatische Übernahme von Handgepäckmaßen gängiger Airlines (Lufthansa, Ryanair etc.).
- [ ] **Export-Funktionen:** Export nach Apple Erinnerungen, Google Tasks und als PDF-Druckansicht.
- [ ] **KI-Koffer-Scan:** Foto-Erkennung von Gepäckstücken via Vision-KI.

---

## 📄 Lizenz

Dieses Projekt ist unter der [ISC Lizenz](LICENSE) lizenziert.
