# Batch Campaign Generator - Design Spec

> Erweiterung des Creative Generator MVP um automatisierte Kampagnen-Erstellung mit AI-generierten Varianten, QA-Review und Batch-Rendering.

## Ziel

Ein Studio soll mit wenigen Klicks eine komplette Kampagne erstellen können:
1. Kampagnen-Parameter definieren (Name, Preis, Bilder, Anzahl Varianten)
2. AI generiert Design-Varianten × Headline-Varianten automatisch
3. Kunde reviewt, filtert, editiert inline
4. Batch-Render aller genehmigten Varianten × Formate → ZIP-Download

**Kernmetrik:** Von Kampagnen-Idee bis fertige PNGs in unter 5 Minuten.

---

## Datenmodell

### Campaign

```typescript
interface Campaign {
  id: string;
  studioId: string;
  name: string;
  baseTemplateId?: string;         // wenn gesetzt: nur Headlines variieren, Design bleibt
  designVariantCount: number;      // 1-4, wie viele Design-Varianten AI generiert
  headlineVariantCount: number;    // 2-5, wie viele Headlines pro Design
  formats: CreativeFormat[];       // welche Formate gerendert werden
  defaultValues: Record<string, string>;  // price, originalPrice, location, person, bg, etc.
  variants: CampaignVariant[];
  status: 'draft' | 'reviewing' | 'rendering' | 'done';
  createdAt: string;
  updatedAt: string;
}
```

### CampaignVariant

```typescript
interface CampaignVariant {
  id: string;
  templateHtml: string;            // vollständiges HTML (ggf. AI-generiert)
  fieldValues: Record<string, string>;  // headline, price, etc. (individuell editierbar)
  approved: boolean;               // true = wird gerendert, false = rausgeworfen
  outputs: CreativeOutput[];       // gerenderte PNGs pro Format
}
```

### Storage

Campaigns werden wie Studios/Templates als JSON in `data/campaigns/` gespeichert. Das bestehende `StorageAdapter`-Interface wird um folgende Methoden erweitert:

```typescript
// Erweiterung StorageAdapter
saveCampaign(campaign: Campaign): Promise<void>;
getCampaign(id: string): Promise<Campaign | null>;
listCampaigns(studioId: string): Promise<Campaign[]>;
deleteCampaign(id: string): Promise<void>;
```

---

## API-Routes

### CRUD

| Route | Method | Beschreibung |
|-------|--------|-------------|
| `/api/campaigns` | GET | Liste (query: `studioId`) |
| `/api/campaigns` | POST | Neue Kampagne anlegen |
| `/api/campaigns/[id]` | GET | Kampagne mit Varianten |
| `/api/campaigns/[id]` | PUT | Update (Varianten editieren, approve/reject) |
| `/api/campaigns/[id]` | DELETE | Kampagne löschen |

### Generate

`POST /api/campaigns/[id]/generate`

Logik:
1. Kampagne aus Storage laden
2. **Design-Varianten generieren:**
   - Wenn `baseTemplateId` gesetzt → Template laden, 1 Design
   - Wenn nicht → `generate-template` API aufrufen für `designVariantCount` verschiedene Layouts
   - Jeder Aufruf bekommt den Studio-spezifischen System-Prompt + die `defaultValues` als Kontext
3. **Headline-Varianten generieren:**
   - Für jedes Design → `generate-copy` API für `headlineVariantCount` Headlines
   - Studio-spezifischer Copy-Prompt wird verwendet
4. **Kombinieren:**
   - Designs × Headlines = Varianten
   - Jede Variante bekommt eigene `fieldValues` (Headline aus AI, Rest aus `defaultValues`)
   - Alle als `CampaignVariant[]` mit `approved: true` speichern
5. Status auf `reviewing` setzen

Response: Updated Campaign mit allen Varianten.

### Render

`POST /api/campaigns/[id]/render`

Logik:
1. Alle Varianten mit `approved: true` filtern
2. Für jede Variante × jedes Format:
   - Placeholders ersetzen
   - An Rendering-Server senden
   - PNG als Datei in `public/output/campaigns/[campaignId]/` speichern
   - `outputs` Array updaten
3. Status auf `done` setzen

Response: Streaming-Updates wären ideal, aber für MVP reicht Polling:
- Client pollt `GET /api/campaigns/[id]` alle 2 Sekunden während Status `rendering`
- Jeder gerenderte Output wird sofort in der Campaign gespeichert

---

## Frontend

### Sidebar

Neuer Eintrag zwischen "Creatives" und "Templates":
```
✏️ Creatives
📦 Kampagnen    ← NEU
🎨 Templates
📷 Assets
⚙️ Einstellungen
```

### Seite: `/studio/[id]/campaigns`

**Kampagnen-Liste:**
- Grid/Liste aller Kampagnen mit Name, Status-Badge, Anzahl Varianten, Datum
- Button: "+ Neue Kampagne"
- Klick auf Kampagne → Detail-Ansicht je nach Status

### Kampagne erstellen: Setup (Step 1)

**Komponente: `components/campaign-setup.tsx`**

Formular:
- **Name** - Textfeld (z.B. "Sommerspezial Juli")
- **Template-Basis** - Dropdown: bestehende Templates ODER "AI generiert neue Designs"
- **Design-Varianten** - Slider/Dropdown: 1-4 (nur aktiv wenn "AI generiert")
- **Headline-Varianten** - Slider/Dropdown: 2-5
- **Formate** - Checkboxes für alle 4 Formate (default: alle an)
- **Preis / Streichpreis** - Textfelder
- **Person / Hintergrund** - AssetGrid-Picker (bestehende Komponente)
- Button: "Varianten generieren ✨" → Loading-State → weiter zu Step 2

### Kampagne reviewen: Variant Grid (Step 2)

**Komponente: `components/variant-grid.tsx`**

Grid-Ansicht aller generierten Varianten:
- Jede Variante als Karte mit LivePreview (1080×1080 skaliert auf ~200px)
- Unter der Preview: Headline-Text, Template-Info
- **Aktive Variante:** Normaler Border, Hover zeigt Action-Buttons
- **Rausgeworfene Variante:** Opacity 0.3, grayscale Filter, "Wiederherstellen"-Button

**Komponente: `components/variant-card.tsx`**

Actions pro Karte:
- ❌ Button (oben rechts): Toggle approved → false (ausgegraut)
- ✏️ Button: Öffnet Quick-Edit Overlay
- 🔗 "Im Editor öffnen": Speichert Varianten-HTML als neues temporäres Template, öffnet Template-Editor. Beim Speichern wird das Varianten-HTML aktualisiert.

**Komponente: `components/quick-edit-overlay.tsx`**

Modal/Overlay bei Klick auf ✏️:
- LivePreview (größer, ~400px)
- Textfelder: Headline, Preis, Streichpreis
- AssetGrid: Person, Hintergrund (aus Studio-Assets)
- Buttons: "Übernehmen" (speichert in Variant), "Abbrechen"

**Footer-Bar:**
- Links: "X von Y Varianten aktiv"
- Rechts: "Alle rendern (X Varianten × Z Formate = N PNGs)" Button

### Batch-Render Ansicht (Step 3)

**Komponente: `components/render-progress.tsx`**

- Progress-Bar oben: "12 von 24 fertig"
- Grid: Variant-Karten mit Status-Overlay (Spinner → ✓ → Preview-Thumbnail)
- Wenn komplett: Großer "📦 Alle als ZIP herunterladen" Button
- Einzelne Downloads pro Variante möglich

---

## Technische Details

### AI-Generierung: Parallelisierung

Design-Varianten werden sequentiell generiert (jeder Aufruf ist ein Claude-Request, ~3-5s).
Headline-Varianten pro Design werden in einem einzigen Aufruf generiert (Claude gibt Array zurück).

Erwartete Generierungszeit für 3 Designs × 3 Headlines:
- 3 Template-Generierungen à ~5s = ~15s
- 3 Copy-Generierungen à ~3s = ~9s (parallel möglich)
- Total: ~18-24 Sekunden

### Rendering: Parallelisierung

Der Rendering-Server hat einen Browser-Pool mit max 3 Pages.
Bei z.B. 6 Varianten × 4 Formate = 24 Renders:
- 3 parallel, ~2s pro Render
- Total: ~16 Sekunden

### Datei-Struktur Outputs

```
public/output/campaigns/
  [campaignId]/
    variant-[variantId]-instagram-post.png
    variant-[variantId]-instagram-story.png
    variant-[variantId]-facebook-feed.png
    variant-[variantId]-facebook-story.png
```

### ZIP-Download

Wie im bestehenden Creative-Dashboard: Client-seitiges JSZip. Sammelt alle fertigen PNGs aus den Variant-Outputs und generiert ZIP.

---

## Abgrenzung

**In Scope:**
- Kampagnen CRUD + Sidebar-Navigation
- AI-Generierung von Design- und Headline-Varianten
- Review-Grid mit Approve/Reject/QuickEdit
- Batch-Render mit Fortschritt
- ZIP-Download

**Nicht in Scope (Follow-Up):**
- Drag & Drop visueller Editor (Canvas-basiert)
- Kampagnen-Duplikation / Templates aus Kampagnen speichern
- A/B-Test Tracking / Performance-Metriken
- Kampagnen-Historie / Versionsvergleich
- Cloud-Deployment / Multi-User
