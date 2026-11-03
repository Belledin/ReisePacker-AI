# 🧳 ReisePacker-AI (FamilyPack AI)

> **Smarte, wetter- und gewichtsoptimierte Packlisten mit Echtzeit-Kollaboration für Einzelpersonen, Familien und Gruppen.**

ReisePacker-AI ist eine moderne Webanwendung, die den Packprozess vor Reisen automatisiert und optimiert. Basierend auf Reisedauer, Zielort, Echtzeit-Wetterbedingungen, Altersstrukturen und Gepäcklimits generiert die App maßgeschneiderte Packlisten mit interaktiver Checkliste und synchronisiert den Packfortschritt live zwischen allen Mitreisenden.

---

## ✨ Features & Highlights

- 🔄 **Echtzeit-Kollaboration & Live-Sync (Google-Notizen-Feeling):**
  - Gemeinsames Packen auf Smartphone und Laptop in Echtzeit via **Cloud Firestore**.
  - Leicht merkbare **6-stellige Freigabecodes** (z. B. `BARC588`) und direkte Einladungslinks zum Teilen per WhatsApp, Mail oder Messenger.
  - Live-Statusanzeige, wer zuletzt welchen Gegenstand eingepackt hat.

- 🔒 **Google Authentication & geschützte Reisen:**
  - Schneller, sicherer Login mit Google.
  - Eigene Reisen sind geschützt und fest mit dem Benutzerkonto verknüpft.
  - Automatische Übernahme älterer Reisen (Auto-Claim).

- 🌤️ **Wetterbasierte Vorschläge (Weather Triggers):**
  - Automatische Wettervorhersage für Zielort und Reisedatum.
  - Intelligente Auslöser: z. B. Regenbekleidung bei >30 % Regenwahrscheinlichkeit oder Thermoschichten bei <10 °C.

- 👨‍👩‍👧‍👦 **Shared Mode vs. Individual Mode:**
  - **Shared Mode (Familien/Gruppen):** Gemeinschaftsartikel (Sonnencreme, Zahnpasta, Ladekabel, Reiseapotheke) werden in einer **Community Box** gebündelt, statt redundant von jeder Person eingepackt zu werden.
  - **Individual Mode:** Autonome, getrennte Packlisten für unabhängige Reisende.

- 👶 **Demografische Profile & Altersfaktoren:**
  - Automatische Gewichtsanpassung für verschiedene Personentypen:
    - **Erwachsene** (Faktor 1.0)
    - **Jugendliche** (Faktor 1.0)
    - **Kinder** (Faktor 0.6)
    - **Kleinkinder** (Faktor 0.3)

- 💊 **Gesundheits- & Medikamenten-Profile:**
  - Spezifische Packvorschläge für individuelle Bedürfnisse: Dauermedikation, Allergien, Asthma, Diabetes, Reisekrankheit und Kontaktlinsen.

- 📦 **Gegenstände-Katalog & Ad-hoc Items:**
  - Eigener Katalog-Manager zum Anpassen, Aktivieren, Deaktivieren und Erstellen von Standardartikeln.
  - JSON Export- und Importfunktion für eigene Pack-Kataloge.
  - Spontanes Hinzufügen individueller Gegenstände (Ad-hoc) während des Packens.

- ⚖️ **Gewichts- & Transport-Constraints:**
  - Automatische Berechnung des Gepäckgewichts pro Person inkl. 15 % Sicherheitspuffer.
  - Überwachung von Gepäcklimits (z. B. 23 kg Freigepäckgrenze bei Flügen).

- ✅ **Interaktiver Pack-Modus (Pack Day UX):**
  - Schnelle Checkliste mit Echtzeit-Fortschrittsbalken pro Person und für die Gemeinschaftsbox.
  - Filteroptionen (*Alle*, *Offen*, *Gepackt*) und Schnellaktionen (*Alle abhaken*, *Zurücksetzen*).

---

## 🛠️ Technologie-Stack

| Bereich | Technologie |
|---|---|
| **Frontend** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/), [Motion](https://motion.dev/), [Lucide React](https://lucide.dev/) |
| **Backend & Cloud** | [Firebase](https://firebase.google.com/) (Cloud Firestore, Authentication, Hosting) |
| **CI / CD** | [GitHub Actions](https://github.com/features/actions) (Automatisches Deployment bei Merge auf `main`) |
| **Testing** | [Jest](https://jestjs.io/) & [ts-jest](https://kulshekhar.github.io/ts-jest/) |

---

## 📁 Projektstruktur

```
ReisePacker-AI/
├── .github/workflows/          # GitHub Actions CI/CD (Auto-Deploy zu Firebase)
├── firestore.rules             # Sicherheitsregeln für Cloud Firestore
├── firebase.json               # Firebase Hosting & Firestore Konfiguration
├── PRD.md                      # Produktanforderungen & Spezifikationen
├── knowledge_base.md           # Referenzdaten (Gewichte, Pack-Regeln)
└── src/
    ├── App.tsx                 # Hauptanwendung (Header, Wizard, Checkliste)
    ├── index.css               # Design-System & Responsive Styling
    ├── components/
    │   ├── CollaborationBar.tsx       # Live-Sync Status & Teilen-Menü
    │   ├── LoadTripModal.tsx          # Cloud-Reisen laden & Code-Suche
    │   ├── CatalogManagerView.tsx     # Gegenstände-Katalog verwalten
    │   ├── AddAdHocItemModal.tsx      # Spontane Items hinzufügen
    │   ├── WeatherDashboardSummary.tsx# Wetterübersicht & Trigger-Badges
    │   └── ErrorBoundary.tsx          # Fehlerbehandlung UI
    ├── lib/
    │   ├── firebaseClient.ts   # Firebase App, Auth & Firestore Setup
    │   └── supabaseClient.ts   # Optionaler Supabase Client
    ├── logic/
    │   ├── PackingEngine.ts    # Kern-Algorithmus zur Packlistenberechnung
    │   ├── ChecklistManager.ts # Zustand der Checklisten & Offline-Sync
    │   ├── defaultCatalog.ts   # Standardkatalog mit Gewichten & Kategorien
    │   └── activityCatalog.ts  # Aktivitätenbezogene Ausrüstung
    └── services/
        ├── CollaborativeTripService.ts # Firestore Realtime Sync & Auto-Claim
        ├── WeatherService.ts   # Wetterdaten & Vorhersagen
        └── StorageService.ts   # LocalStorage Persistenz
```

---

## 🚀 Erste Schritte / Lokale Entwicklung

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- `npm`

### 1. Repository klonen
```bash
git clone https://github.com/Belledin/ReisePacker-AI.git
cd ReisePacker-AI
```

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Entwicklungsserver starten
```bash
npm run dev
```
Die App ist anschließend lokal unter **`http://localhost:3000/`** erreichbar.

---

## 🌐 Deployment (CI/CD)

Deployments erfolgen vollautomatisch über **GitHub Actions**:
Jeder Push auf den `main`-Branch baut das Projekt (`npm run build`) und aktualisiert **Firebase Hosting** unter:
👉 `https://reisepacker.web.app/`

Manuelles Deployment über die CLI (falls nötig):
```bash
npm run build
npx firebase-tools deploy
```

---

## 🧪 Tests & Typ-Prüfung

Tests ausführen:
```bash
npm test
```

TypeScript Typ-Check:
```bash
npm run lint
```

---

## 📄 Lizenz

Dieses Projekt ist unter der [ISC Lizenz](LICENSE) lizenziert.
