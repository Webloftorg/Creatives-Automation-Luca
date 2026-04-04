// components/creative-editor-modal.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { FormatSelector } from '@/components/format-selector';
import { AssetGrid } from '@/components/asset-grid';
import { LivePreview } from '@/components/live-preview';
import { CssVarSlider } from '@/components/css-var-slider';
import { QuickEditBar } from '@/components/quick-edit-bar';
import { ImageGenerator } from '@/components/image-generator';
import { extractCssVariables, extractPlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface CreativeEditorModalProps {
  variant: CampaignVariant;
  studioId: string;
  personAssets: string[];
  bgAssets: string[];
  onSave: (updatedVariant: CampaignVariant) => void;
  onClose: () => void;
  onAssetsChanged: () => void;
}

export function CreativeEditorModal({
  variant,
  studioId,
  personAssets,
  bgAssets,
  onSave,
  onClose,
  onAssetsChanged,
}: CreativeEditorModalProps) {
  const [values, setValues] = useState<Record<string, string>>({ ...variant.fieldValues });
  const [cssVars, setCssVars] = useState<Record<string, string>>(extractCssVariables(variant.templateHtml));
  const [templateHtml] = useState(variant.templateHtml);
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');
  const [activeTab, setActiveTab] = useState<'inhalt' | 'stil'>('inhalt');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showPersonGen, setShowPersonGen] = useState(false);
  const [showBgGen, setShowBgGen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<{ cssVars: Record<string, string>; fieldValues: Record<string, string> }[]>([]);
  const [redoStack, setRedoStack] = useState<{ cssVars: Record<string, string>; fieldValues: Record<string, string> }[]>([]);
  const lastSnapshotTime = useRef(0);

  const pushUndo = useCallback(() => {
    const now = Date.now();
    if (now - lastSnapshotTime.current < 500) return;
    lastSnapshotTime.current = now;
    setUndoStack(prev => {
      const next = [...prev, { cssVars: { ...cssVars }, fieldValues: { ...values } }];
      return next.length > 20 ? next.slice(-20) : next;
    });
    setRedoStack([]);
  }, [cssVars, values]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, { cssVars: { ...cssVars }, fieldValues: { ...values } }]);
    setCssVars(snapshot.cssVars);
    setValues(snapshot.fieldValues);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, cssVars, values]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, { cssVars: { ...cssVars }, fieldValues: { ...values } }]);
    setCssVars(snapshot.cssVars);
    setValues(snapshot.fieldValues);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, cssVars, values]);

  // Keyboard shortcuts for undo/redo + arrow-key nudging
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Keyboard nudging
      if (!selectedSection) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();

      const step = e.shiftKey ? 0.1 : 1;
      const xVar = selectedSection === 'person' ? '--person-position-x' : `--${selectedSection}-x`;
      const yVar = selectedSection === 'person' ? '--person-position-y' : `--${selectedSection}-y`;

      pushUndo();
      setCssVars(prev => {
        const updates = { ...prev };
        const currentX = parseFloat(prev[xVar] || '50');
        const currentY = parseFloat(prev[yVar] || '50');
        if (e.key === 'ArrowLeft') updates[xVar] = `${(currentX - step).toFixed(1)}%`;
        if (e.key === 'ArrowRight') updates[xVar] = `${(currentX + step).toFixed(1)}%`;
        if (e.key === 'ArrowUp') updates[yVar] = `${(currentY - step).toFixed(1)}%`;
        if (e.key === 'ArrowDown') updates[yVar] = `${(currentY + step).toFixed(1)}%`;
        return updates;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedSection, pushUndo, cssVars]);

  // Dynamic text fields management
  const [textFields, setTextFields] = useState<{ key: string; label: string; value: string }[]>([]);

  useEffect(() => {
    // Initialize text fields from existing values + template placeholders
    const fields: { key: string; label: string; value: string }[] = [];
    const imageKeys = new Set(['personImage', 'backgroundImage', 'logo']);
    const colorKeys = new Set(['primaryColor', 'accentColor', 'secondaryColor']);
    const systemKeys = new Set(['width', 'height', ...imageKeys, ...colorKeys]);

    const labels: Record<string, string> = {
      headline: 'Headline',
      price: 'Preis',
      originalPrice: 'Streichpreis',
      location: 'Standort',
    };

    // Extract all placeholders from template HTML to ensure we show all editable fields
    const placeholders = extractPlaceholders(templateHtml);
    const addedKeys = new Set<string>();

    // First add known text fields in preferred order
    const orderedKeys = ['headline', 'price', 'originalPrice', 'location'];
    for (const key of orderedKeys) {
      if (placeholders.includes(key) || values[key] !== undefined) {
        if (!systemKeys.has(key)) {
          fields.push({ key, label: labels[key] || key, value: values[key] || '' });
          addedKeys.add(key);
        }
      }
    }

    // Then add any remaining text fields from values or placeholders
    const allTextKeys = new Set([
      ...Object.keys(values),
      ...placeholders,
    ]);
    for (const key of allTextKeys) {
      if (addedKeys.has(key) || systemKeys.has(key)) continue;
      const val = values[key] || '';
      // Skip if it looks like a URL/path
      if (val.startsWith('http') || val.startsWith('/api/')) continue;
      fields.push({ key, label: labels[key] || key, value: val });
      addedKeys.add(key);
    }

    setTextFields(fields);
  }, []);

  const updateField = (key: string, value: string) => {
    pushUndo();
    setValues(prev => ({ ...prev, [key]: value }));
    setTextFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  };

  const removeField = (key: string) => {
    setTextFields(prev => prev.filter(f => f.key !== key));
    setValues(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addTextField = () => {
    const key = `custom_${Date.now()}`;
    const newField = { key, label: 'Neues Textfeld', value: '' };
    setTextFields(prev => [...prev, newField]);
    setValues(prev => ({ ...prev, [key]: '' }));
  };

  const renameField = (key: string, newLabel: string) => {
    setTextFields(prev => prev.map(f => f.key === key ? { ...f, label: newLabel } : f));
  };

  const dims = FORMAT_DIMENSIONS[format];

  const autoScale = Math.min(1, 400 / dims.width);
  const zoomIn = () => setZoom(prev => Math.min((prev ?? autoScale) + 0.1, 1.5));
  const zoomOut = () => setZoom(prev => Math.max((prev ?? autoScale) - 0.1, 0.25));
  const zoomReset = () => setZoom(null);
  const zoomPercent = Math.round((zoom ?? autoScale) * 100);

  const getStyledHtml = (html: string): string => {
    let styled = html;
    for (const [key, value] of Object.entries(cssVars)) {
      styled = styled.replace(
        new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)([^;]+)`),
        `$1${value}`,
      );
    }
    return styled;
  };

  const handleCssVarChange = (key: string, value: string) => {
    pushUndo();
    setCssVars(prev => ({ ...prev, [key]: value }));
  };

  const handleDragEnd = useCallback((elementId: string, xPercent: number, yPercent: number) => {
    pushUndo();
    if (elementId === 'person') {
      setCssVars(prev => ({
        ...prev,
        '--person-position-x': `${Math.round(xPercent)}%`,
        '--person-position-y': `${Math.round(yPercent)}%`,
      }));
    } else {
      setCssVars(prev => {
        const updates = { ...prev, [`--${elementId}-y`]: `${Math.round(yPercent)}%` };
        if (Math.round(xPercent) !== -999) {
          updates[`--${elementId}-x`] = `${Math.round(xPercent)}%`;
        }
        return updates;
      });
    }
  }, [pushUndo]);

  const handleSave = () => {
    // Apply CSS vars back to template HTML
    const styledHtml = getStyledHtml(templateHtml);
    onSave({
      ...variant,
      templateHtml: styledHtml,
      fieldValues: values,
    });
  };

  const extractAssetPath = (url: string): string => {
    if (!url) return '';
    try {
      // Handle both relative and absolute URLs: /api/assets/serve?path=... and http://localhost:3000/api/assets/serve?path=...
      const pathParam = url.split('path=')[1];
      if (pathParam) return decodeURIComponent(pathParam.split('&')[0]);
      return url;
    } catch { return ''; }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 glass-panel flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 className="text-white font-bold text-lg font-[family-name:var(--font-heading)]">Creative Editor</h2>
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={undoStack.length === 0}
            className="text-[#9ca3af] hover:text-white disabled:text-[#4b5563] text-sm px-2 py-1 rounded transition-colors"
            title="Rueckgaengig (Ctrl+Z)">
            ← {undoStack.length > 0 && <span className="text-[10px] text-[#6b7280]">({undoStack.length})</span>}
          </button>
          <button onClick={redo} disabled={redoStack.length === 0}
            className="text-[#9ca3af] hover:text-white disabled:text-[#4b5563] text-sm px-2 py-1 rounded transition-colors"
            title="Wiederherstellen (Ctrl+Y)">
            → {redoStack.length > 0 && <span className="text-[10px] text-[#6b7280]">({redoStack.length})</span>}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-[#00D4FF] hover:bg-[#00b4d8] text-black font-bold py-2 px-6 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]"
          >
            Speichern & Schliessen
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.045] hover:bg-white/[0.08] text-[#9ca3af] hover:text-white text-lg transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content - 3 panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor Panel */}
        <div className="w-[320px] glass-panel flex flex-col flex-shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Tab switcher */}
          <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setActiveTab('inhalt')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'inhalt' ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#6b7280] hover:text-white'
              }`}>
              Inhalt
            </button>
            <button onClick={() => setActiveTab('stil')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'stil' ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#6b7280] hover:text-white'
              }`}>
              Stil
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'inhalt' ? (
              <>
                {/* Format */}
                <div>
                  <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Format</label>
                  <FormatSelector selected={format} onChange={setFormat} />
                </div>

                {/* Dynamic text fields */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Texte & Angebote</label>
                    <button onClick={addTextField}
                      className="text-[#00D4FF] text-xs hover:text-[#00b4d8] font-semibold">
                      + Hinzufuegen
                    </button>
                  </div>
                  <div className="space-y-3">
                    {textFields.map(field => (
                      <div key={field.key} className="group">
                        <div className="flex justify-between items-center mb-1">
                          <input
                            value={field.label}
                            onChange={e => renameField(field.key, e.target.value)}
                            className="text-[#9ca3af] text-xs uppercase tracking-wider bg-transparent border-none outline-none w-full cursor-text hover:text-white focus:text-white"
                          />
                          <button
                            onClick={() => removeField(field.key)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity ml-2 flex-shrink-0"
                            title="Feld entfernen"
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          value={field.value}
                          onChange={e => updateField(field.key, e.target.value)}
                          className={`w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#00D4FF]/50 ${
                            field.key === 'price' ? 'text-[#00D4FF] font-bold' :
                            field.key === 'originalPrice' ? 'text-[#9ca3af]' : 'text-white'
                          }`}
                          placeholder={field.label}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Person */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Person</label>
                    <button onClick={() => setShowPersonGen(!showPersonGen)}
                      className="text-[#00D4FF] text-xs hover:text-[#00b4d8]">
                      {showPersonGen ? 'Schliessen' : 'AI generieren'}
                    </button>
                  </div>
                  <AssetGrid
                    assets={personAssets}
                    selected={extractAssetPath(values.personImage || '')}
                    onSelect={p => updateField('personImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
                    size="sm"
                  />
                  {showPersonGen && (
                    <div className="mt-2">
                      <ImageGenerator studioId={studioId} assetType="person" onGenerated={() => { onAssetsChanged(); setShowPersonGen(false); }} />
                    </div>
                  )}
                </div>

                {/* Background */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Hintergrund</label>
                    <button onClick={() => setShowBgGen(!showBgGen)}
                      className="text-[#00D4FF] text-xs hover:text-[#00b4d8]">
                      {showBgGen ? 'Schliessen' : 'AI generieren'}
                    </button>
                  </div>
                  <AssetGrid
                    assets={bgAssets}
                    selected={extractAssetPath(values.backgroundImage || '')}
                    onSelect={p => updateField('backgroundImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
                    size="sm"
                  />
                  {showBgGen && (
                    <div className="mt-2">
                      <ImageGenerator studioId={studioId} assetType="background" onGenerated={() => { onAssetsChanged(); setShowBgGen(false); }} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Stil Tab */
              <CssVarSlider variables={cssVars} selectedSection={selectedSection} onChange={handleCssVarChange} />
            )}
          </div>
        </div>

        {/* Center: Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050507] p-6"
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.deltaY < 0) zoomIn(); else zoomOut(); } }}
        >
          <LivePreview
            html={templateHtml}
            width={dims.width}
            height={dims.height}
            fieldValues={values}
            cssVars={cssVars}
            scale={zoom ?? undefined}
            editable
            onDragEnd={handleDragEnd}
            onSelectElement={setSelectedSection}
          />
          <QuickEditBar
            selectedElement={selectedSection}
            fieldValues={values}
            onFieldChange={(field, value) => { pushUndo(); updateField(field, value); }}
            width={Math.min(400, dims.width) * Math.min(1, 400 / dims.width)}
          />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={zoomOut} className="text-[#9ca3af] hover:text-white text-sm px-2 py-1 bg-white/[0.045] rounded transition-colors">-</button>
            <span className="text-[#6b7280] text-xs w-10 text-center">{zoomPercent}%</span>
            <button onClick={zoomIn} className="text-[#9ca3af] hover:text-white text-sm px-2 py-1 bg-white/[0.045] rounded transition-colors">+</button>
            <button onClick={zoomReset} className="text-[#6b7280] hover:text-white text-xs px-2 py-1 rounded transition-colors">Fit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
