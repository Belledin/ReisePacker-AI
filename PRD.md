# Produktanforderungen (PRD) - FamilyPack AI

## Kern-Logik & Features

### Dynamische Gruppen
- **Unterstützung für Familien:** Shared Mode (Ressourcen werden geteilt)
- **Unabhängige Gruppen:** Individual Mode
- **Profile:**
    - Erwachsen
    - Kind (Faktor 0.6)
    - Kleinkind (Faktor 0.3)

### Vorschlags-Engine
- **Dauer:** Kleidung = $Tage + 1$
- **Wetter:**
    - Nutze Browser-Agent für Zielort & Datum
    - **Trigger:**
        - Regen > 30% -> Regenzeug
        - Temp < 10°C -> Thermoschicht

### Aktivitäten
- Tags (Wandern, Ski, Strand) kombinieren Items ohne Dubletten

### Transport-Constraints
- **Flug:** Gewichtslimit 20-23kg, Flüssigkeitsregel
- **PKW:** Volumen/Dachbox
- **Bahn:** Handlichkeit

### Historisierung
- Jede Liste wird archiviert
- 'Clone & Edit'-Funktion für neue Reisen
