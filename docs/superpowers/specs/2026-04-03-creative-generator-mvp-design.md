# Creative Generator MVP -- Design Spec

## Zusammenfassung

Next.js-Applikation zur automatisierten Erstellung von Werbeanzeigen-Creatives für Fitnessstudios. Zielnutzer: Werbeagentur die für mehrere Studios Ads schaltet. Kernversprechen: Pro Creative unter 5 Minuten statt 1:30h in Canva.

**MVP-Scope**: Vollständiger Flow von Studio-Erstellung bis zum fertigen PNG-Download. Alles lokal, kein Cloud-Deployment. Zeigbar für Kunden als Demo.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Rendering**: Puppeteer via separatem Express-Server (Port 3001)
- **AI Copy**: Anthropic Claude API (claude-sonnet-4-20250514) -- Headline-Vorschläge als Assistenz
- **AI Templates**: Anthropic Claude API -- HTML/CSS-Template-Generierung und -Anpassung per Prompt
- **AI Bilder**: Google AI Studio (Imagen 4) -- Bildgenerierung für Asset-Library
- **Bildverarbeitung**: Sharp für Bildoptimierung
- **Storage**: Lokales Filesystem (JSON-Dateien + Bilder)
- **Start**: `concurrently` -- ein `npm run dev` startet Next.js + Rendering-Server

## Architektur

```
/                                 → Root mit concurrently
  /app                            → Next.js Frontend (Port 3000)
    /page.tsx                     → Home: Studio-Liste
    /onboarding                   → 3-Step Studio-Erstellung
    /studio/[id]/creatives        → Creative Generator Dashboard
    /studio/[id]/templates        → Template-Verwaltung
    /studio/[id]/assets           → Asset-Library mit AI-Bildgenerierung
    /studio/[id]/settings         → System-Prompts, Studio-Daten
    /api/generate-copy            → Claude API: Headline-Vorschläge
    /api/generate-template        → Claude API: HTML/CSS-Template generieren/anpassen
    /api/generate-image           → Google AI: Imagen 4 Bildgenerierung
    /api/preview                  → HTML-Preview für iframe

  /rendering-server               → Standalone Express + Puppeteer (Port 3001)
    /src/index.ts                 → Express Server
    /src/routes/render.ts         → POST /api/render → PNG
    /src/routes/preview.ts        → GET /api/preview → HTML
    /src/utils/browser.ts         → Puppeteer Browser-Pool

  /lib                            → Shared Code
    /types.ts                     → TypeScript Types
    /storage.ts                   → Storage Abstraction (Filesystem)
    /prompts.ts                   → Default System-Prompts
    /template-utils.ts            → Platzhalter-Ersetzung, CSS-Var-Extraktion

  /data                           → Lokaler Datenspeicher
    /studios/                     → JSON pro Studio
    /templates/                   → Gespeicherte HTML/CSS Templates
    /creatives/                   → Creative-Metadaten
    /prompts/                     → Custom System-Prompts pro Studio
    /assets/                      → Hochgeladene + generierte Bilder

  /public
    /output/                      → Gerenderte PNGs

  /Referenzen                     → Stil-Referenzbilder (bestehend)
```

## Datenmodell

```typescript
interface Studio {
  id: string;
  name: string;                    // z.B. "FitX Power Gym"
  location: string;                // z.B. "Weissenthurm"
  primaryColor: string;            // Hex
  secondaryColor: string;          // Hex
  accentColor: string;             // Hex, für Preise
  logo?: string;                   // Pfad zum Logo
  backgroundImages: string[];      // Pfade zu Gym-Fotos
  personImages: string[];          // Pfade zu freigestellten Personen-PNGs
  generatedImages: string[];       // Pfade zu AI-generierten Bildern
  defaultFont: string;             // Google Font Name
  createdAt: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  studioId?: string;               // null = global, string = studio-spezifisch
  type: TemplateType;
  htmlContent: string;             // Vollständiges HTML/CSS
  cssVariables: Record<string, string>; // Extrahierte CSS-Variablen
  dynamicFields: DynamicField[];   // Erkannte Platzhalter
  thumbnail?: string;              // Auto-generiertes Vorschaubild
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface DynamicField {
  key: string;                     // z.B. "headline"
  label: string;                   // z.B. "Headline"
  type: 'text' | 'image' | 'color';
  placeholder?: string;
  required: boolean;
}

interface Creative {
  id: string;
  studioId: string;
  templateId: string;
  fieldValues: Record<string, string>;
  outputs: CreativeOutput[];       // Multi-Format Support
  createdAt: string;
}

interface CreativeOutput {
  format: CreativeFormat;
  status: 'pending' | 'rendering' | 'done' | 'error';
  outputPath?: string;
  error?: string;
}

type CreativeFormat =
  | 'instagram-post'      // 1080x1080
  | 'instagram-story'     // 1080x1920
  | 'facebook-feed'       // 1200x628
  | 'facebook-story'      // 1080x1920

type TemplateType =
  | 'price-offer'
  | 'trial-offer'
  | 'new-opening'
  | 'seasonal'
  | 'custom'

type PromptType =
  | 'copy-generation'
  | 'template-generation'
  | 'template-editing'
```

## Storage Abstraction Layer

```typescript
interface StorageAdapter {
  // Studios
  getStudio(id: string): Promise<Studio | null>;
  saveStudio(studio: Studio): Promise<void>;
  listStudios(): Promise<Studio[]>;

  // Templates
  getTemplate(id: string): Promise<SavedTemplate | null>;
  saveTemplate(template: SavedTemplate): Promise<void>;
  listTemplates(studioId?: string): Promise<SavedTemplate[]>;
  deleteTemplate(id: string): Promise<void>;

  // Creatives
  saveCreative(creative: Creative): Promise<void>;
  listCreatives(studioId: string): Promise<Creative[]>;

  // Assets
  uploadAsset(file: Buffer, filename: string, studioId: string, type: string): Promise<string>;
  listAssets(studioId: string, type?: 'person' | 'background' | 'logo' | 'generated'): Promise<string[]>;
  deleteAsset(path: string): Promise<void>;

  // Prompts
  getSystemPrompt(studioId: string, type: PromptType): Promise<string>;
  saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void>;
}

// Phase 1: FilesystemStorage
// Phase 2 (später): SupabaseStorage
```

## Template-System

### Kernprinzip

Templates sind eigenständige HTML/CSS-Dokumente mit `{{platzhaltern}}`. Sie werden per AI-Prompt generiert/angepasst. Der Stil der Referenzbilder (Referenzen/-Ordner) ist das Fundament -- alle Default-Prompts und das Referenz-Template bilden diesen Stil ab.

### Referenz-Stil (1:1 aus den Kundenbildern)

- **Typografie**: Montserrat Black (font-weight: 900), UPPERCASE Headlines
- **Preis**: Kräftiges Orange auf dunklem halbtransparentem Balken, riesig
- **Streichpreis**: Durchgestrichen, darunter, kleinere Schrift, reduzierte Opacity
- **Hintergrund**: Gym-Foto, geblurt (4-8px), abgedunkelt (brightness 0.3-0.5)
- **Person**: Freigestellt (PNG), zentriert oder leicht versetzt, überlappt mit Text
- **Text-Lesbarkeit**: text-shadow auf allen Textelementen
- **Standort**: Oben, weiß, bold
- **Gesamtwirkung**: Bold, impact-driven, direct-response Werbung

### Platzhalter

Standard-Platzhalter die jedes Template unterstützen muss:
- `{{width}}`, `{{height}}` -- Format-Dimensionen
- `{{backgroundImage}}` -- Hintergrund-URL
- `{{personImage}}` -- Freigestellte Person-URL
- `{{primaryColor}}`, `{{accentColor}}` -- Studio-Farben
- `{{location}}` -- Standortname

Template-spezifische Platzhalter (je nach Typ):
- `{{headline}}`, `{{subline}}` -- Texte
- `{{price}}`, `{{originalPrice}}` -- Preise
- `{{logo}}` -- Logo-URL

### Template-Rendering-Flow

```
Template HTML (mit {{platzhaltern}})
         ↓
template-utils.ts: Platzhalter-Ersetzung
         ↓
Fertiges HTML
    ↓              ↓
  iframe          POST /api/render
(Vorschau)        (Puppeteer → PNG)
```

Vorschau und Render nutzen exakt denselben HTML-Output.

### AI-Template-Generierung

**Generierung (neues Template):**
- User beschreibt per Prompt was er will
- Optional: Referenzbilder anhängen oder bestehende Templates als Stil-Referenz auswählen
- Claude generiert vollständiges HTML/CSS
- Platzhalter werden automatisch aus dem HTML extrahiert
- Vorschau sofort im iframe
- Iterationsloop: Prompt → Vorschau → neuer Prompt → ... → Speichern

**Editierung (bestehendes Template):**
- Bestehendes HTML wird als baseTemplate mitgeschickt
- User beschreibt Änderung per Prompt
- Claude gibt angepasstes HTML zurück
- Neue Version wird gespeichert

**Referenzen bei der Generierung:**
- Bilder hochladen (Screenshots von Ads)
- Bestehende Templates aus der App als Stil-Referenz auswählen
- Werden im Prompt an Claude mitgeschickt

### CSS-Variablen

Templates nutzen CSS Custom Properties in `:root` für anpassbare Werte. Der Template-Editor bietet Slider für diese Variablen:

- `--bg-blur` -- Hintergrund-Blur (0-20px)
- `--bg-brightness` -- Hintergrund-Helligkeit (0-1)
- `--headline-size` -- Headline-Schriftgröße
- `--price-size` -- Preis-Schriftgröße
- `--person-scale` -- Person-Skalierung
- `--person-position-y` -- Person vertikale Position
- Weitere je nach Template

## AI-Integration

### Claude API (Anthropic)

**Headline-Vorschläge** (`POST /api/generate-copy`):
- Manuelles Schreiben ist der Standard -- der Kunde ist Werbeexperte
- AI-Button ("Vorschläge") generiert 5 Varianten als Inspiration/Brainstorming
- Input: Studio-Daten, Angebotstyp, Preis, optionaler Kontext
- Output: JSON-Array mit `{ headline, subline? }`

**Template-Generierung** (`POST /api/generate-template`):
- Input: Prompt, Format, optional baseTemplate, optional Referenzbilder/-templates, studioId
- System-Prompt enthält den Referenz-Stil als Basis
- Output: Vollständiges HTML, erkannte DynamicFields

### Google AI Studio (Imagen 4)

**Bildgenerierung** (`POST /api/generate-image`):
- Freitext-Prompt für beliebige Bilder
- Verfügbar in Asset-Library und im Onboarding
- Generiertes Bild → Vorschau → "In Library übernehmen" oder "Neu generieren"
- Gespeichert als Asset mit Typ-Zuordnung

### System-Prompts

Drei editierbare Prompts pro Studio, Default vorgeladen mit Referenz-Stil:

1. **Copy-Generation**: Direct-Response-Copywriting für deutschen Fitnessmarkt
2. **Template-Generation**: HTML/CSS-Generierung im Referenz-Stil
3. **Template-Editing**: Anpassung bestehender Templates

Editierbar unter Settings mit verständlichen Labels und Erklärungen. "Standard"-Button zum Zurücksetzen.

## Frontend

### Design-System

- Dark UI (Hintergrund #0a0a0a, Panels #111)
- Akzentfarbe: #FF4500 (Orange-Rot)
- Erfolg: #4CAF50
- Text: Weiß/Grau-Abstufungen
- Borders: #222-#333
- Desktop-only (Agentur-Tool)
- Alle Texte auf Deutsch

### Navigation

Eingeklappte Icon-Sidebar (links, ~52px breit):
- Icons für Creatives, Templates, Assets, Einstellungen
- Expandiert bei Hover mit Labels
- Studio-Name/Logo oben

### Seiten

**Home (`/`):**
- Studio-Liste als Cards
- "Neues Studio anlegen" Button

**Onboarding (`/onboarding`, 3 Steps):**

Step 1 -- Grunddaten:
- Studioname, Standort
- 3 Farben (Color Picker): Primär, Sekundär, Akzent
- Logo-Upload (optional)
- Font-Auswahl (Dropdown: Montserrat, Oswald, Bebas Neue, etc.)

Step 2 -- Assets:
- Hintergrundbilder: Upload (Drag & Drop, Mehrfach) + AI-Generierung (Imagen 4)
- Personen-Bilder: Upload + AI-Generierung
- Grid-Vorschau der hochgeladenen Bilder
- Hinweis: "Transparenter Hintergrund empfohlen für Personen"

Step 3 -- Stil prüfen:
- System-Prompts vorgeladen mit Referenz-Stil
- Verständliche Labels ("Headline-Stil", "Template-Stil")
- "Standard"-Button zum Zurücksetzen
- Test-Creative generieren um Stil zu validieren

**Creative Generator Dashboard (`/studio/[id]/creatives`):**

4-Spalten Layout:
1. Icon-Sidebar (Navigation)
2. Einstellungs-Panel (280px):
   - Template-Auswahl (Dropdown)
   - Format-Auswahl (4 Buttons: 1080x1080, 1080x1920, 1200x628, 1080x1920)
   - Headline: Textfeld (manuell tippen = Standard) + dezenter "Vorschläge" Button für AI
   - Preis + Streichpreis
   - Person aus Asset-Library (Thumbnail-Grid)
   - Hintergrund aus Asset-Library (Thumbnail-Grid)
   - "Creative rendern" Button
   - "Alle Formate rendern (4x)" Button
3. Live-Vorschau (Mitte, flex: 1):
   - iframe mit dem Template
   - Aktualisiert sich live bei jeder Änderung
   - Skalierte Darstellung mit Format-Label
4. Output/Batch-Panel (220px):
   - Generierte Creatives mit Status (Rendering.../Fertig/Fehler)
   - Download PNG pro Creative
   - "Alle als ZIP" Button
   - Batch-Modus: User klickt "Batch erstellen", fügt Zeilen hinzu (jede Zeile = eine Variante mit eigener Headline, Preis, Person, Hintergrund). "Batch rendern" generiert alle Varianten × gewählte Formate parallel.

**Template-Verwaltung (`/studio/[id]/templates`):**

Template-Liste:
- Grid mit Thumbnail-Vorschau
- Name, Typ, Version, letzte Änderung
- Buttons: Verwenden, Editieren, Drei-Punkte-Menü (Duplizieren, Löschen)
- "Neues Template per AI" Button

Template-Erstellen/Editieren:
- Links: AI-Prompt-Eingabe + CSS-Variablen-Slider + Referenzen-Upload
- Rechts: Live-Vorschau (iframe)
- Kein Code-Editor sichtbar (optional als verstecktes Advanced-Feature)
- Iterationsloop: Prompt → Vorschau → neuer Prompt → Speichern
- "Speichern" und "Neue Version" Buttons

**Asset-Library (`/studio/[id]/assets`):**
- Grid sortiert nach Typ (Hintergründe, Personen, Logos, Generierte)
- Upload per Drag & Drop
- AI-Bildgenerierung (Imagen 4): Prompt-Eingabe, Vorschau, Übernehmen
- Löschen-Funktion

**Einstellungen (`/studio/[id]/settings`):**
- Studio-Grunddaten editieren (Name, Standort, Farben, Font)
- System-Prompt Editor:
  - 3 Bereiche: "Headline-Stil", "Template-Erstellung", "Template-Anpassung"
  - Verständliche Erklärung über jedem Prompt
  - Textarea für den Prompt
  - "Auf Standard zurücksetzen" Button

## Rendering-Server

**Express + Puppeteer, Port 3001:**

- Browser-Pool: 1 Browser-Instanz, max 3 Pages gleichzeitig
- Timeout pro Render: 15 Sekunden
- Page wird nach jedem Render geschlossen und neu erstellt
- CORS aktiviert (localhost:3000 → localhost:3001)

**POST /api/render:**
- Input: `{ html: string, width: number, height: number, deviceScaleFactor?: number }`
- `deviceScaleFactor` Default: 2 (Retina)
- `waitUntil: 'networkidle0'` für Fonts/Bilder
- Output: PNG als Buffer

**GET /api/preview:**
- Query: `html` (Base64) oder `templateId` + Feldwerte
- Output: Fertiges HTML für iframe

**Batch-Rendering:**
- 4 parallele Render-Requests für alle Formate
- Batch-Modus: User definiert N Varianten (je eigene Headline/Preis/Bilder), jede wird in M gewählten Formaten gerendert → N×M Render-Jobs
- Fortschritt pro Job im UI sichtbar
- ZIP-Download via JSZip im Browser (alle PNGs eines Batch)

## Environment Variables

```
ANTHROPIC_API_KEY=              # Claude API für Copy + Templates
GOOGLE_API_KEY=                 # Google AI Studio für Imagen 4
```

## Nicht im MVP-Scope

- Hetzner-Deployment / Nginx
- Supabase-Migration (Storage-Interface ist vorbereitet)
- Mobile-Responsive Design
- User-Authentication
- Versionsverlauf / Undo-Redo
- Analytics / Usage-Tracking
