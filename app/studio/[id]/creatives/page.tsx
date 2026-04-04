'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { FormatSelector } from '@/components/format-selector';

import { AssetGrid } from '@/components/asset-grid';
import { LivePreview } from '@/components/live-preview';
import { BatchPanel } from '@/components/batch-panel';
import { CssVarSlider } from '@/components/css-var-slider';
import { QuickEditBar } from '@/components/quick-edit-bar';
import { ImageGenerator } from '@/components/image-generator';
import { replacePlaceholders, extractCssVariables } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS, ALL_FORMATS } from '@/lib/formats';
import type { Studio, SavedTemplate, CreativeFormat, CreativeOutput, Creative } from '@/lib/types';

export default function CreativesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');

  const [studio, setStudio] = useState<Studio | null>(null);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [savedCreatives, setSavedCreatives] = useState<Creative[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');

  // Field values
  const [headline, setHeadline] = useState('MONATLICH KÜNDBAR');
  const [price, setPrice] = useState('39,90€');
  const [originalPrice, setOriginalPrice] = useState('89,90€');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedBg, setSelectedBg] = useState('');

  // Dynamic text fields for add/remove
  const [customFields, setCustomFields] = useState<{ key: string; label: string; value: string }[]>([]);

  // Style overrides
  const [cssVars, setCssVars] = useState<Record<string, string>>({});

  // Render state
  const [outputs, setOutputs] = useState<CreativeOutput[]>([]);
  const [rendering, setRendering] = useState(false);

  // Asset lists
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  // Image generation
  const [showBgGen, setShowBgGen] = useState(false);
  const [showPersonGen, setShowPersonGen] = useState(false);

  // Left panel tab
  const [activeTab, setActiveTab] = useState<'inhalt' | 'stil'>('inhalt');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<{ cssVars: Record<string, string>; headline: string; price: string; originalPrice: string; selectedPerson: string; selectedBg: string }[]>([]);
  const [redoStack, setRedoStack] = useState<typeof undoStack>([]);
  const lastSnapshotTime = useRef(0);

  const currentSnapshot = useCallback(() => ({
    cssVars: { ...cssVars }, headline, price, originalPrice, selectedPerson, selectedBg
  }), [cssVars, headline, price, originalPrice, selectedPerson, selectedBg]);

  const pushUndo = useCallback(() => {
    const now = Date.now();
    if (now - lastSnapshotTime.current < 500) return;
    lastSnapshotTime.current = now;
    setUndoStack(prev => {
      const next = [...prev, currentSnapshot()];
      return next.length > 20 ? next.slice(-20) : next;
    });
    setRedoStack([]);
  }, [currentSnapshot]);

  const applySnapshot = useCallback((s: typeof undoStack[0]) => {
    setCssVars(s.cssVars);
    setHeadline(s.headline);
    setPrice(s.price);
    setOriginalPrice(s.originalPrice);
    setSelectedPerson(s.selectedPerson);
    setSelectedBg(s.selectedBg);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, currentSnapshot()]);
    applySnapshot(snapshot);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, currentSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, currentSnapshot()]);
    applySnapshot(snapshot);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, currentSnapshot, applySnapshot]);

  const loadAssets = async () => {
    const [persons, bgs] = await Promise.all([
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]);
    setPersonAssets(persons);
    setBgAssets(bgs);
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/studios/${studioId}`).then(r => r.json()),
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch(`/api/templates`).then(r => r.json()),
      fetch(`/api/creatives?studioId=${studioId}`).then(r => r.json()),
    ]).then(([studioData, studioTemplates, allTemplates, creativesData]) => {
      setStudio(studioData);
      setSavedCreatives(creativesData || []);
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      const merged = [...studioTemplates, ...globals];
      setTemplates(merged);

      let initial: SavedTemplate | null = null;
      const draftId = searchParams.get('draftId');
      
      if (draftId && creativesData) {
        const draft = creativesData.find((c: Creative) => c.id === draftId);
        if (draft) {
          const t = merged.find((temp: SavedTemplate) => temp.id === draft.templateId);
          if (t) {
            initial = t;
            setCssVars(draft.cssVars || extractCssVariables(t.htmlContent));
          }
          setHeadline(draft.fieldValues.headline || '');
          setPrice(draft.fieldValues.price || '');
          setOriginalPrice(draft.fieldValues.originalPrice || '');
          setSelectedPerson(draft.fieldValues.selectedPerson || '');
          setSelectedBg(draft.fieldValues.selectedBg || '');
        }
      } else if (preselectedTemplateId) {
        initial = merged.find((t: SavedTemplate) => t.id === preselectedTemplateId) || null;
      } else if (merged.length > 0) {
        initial = merged[0];
      }
      
      if (initial) {
        setSelectedTemplate(initial);
        // Only override standard cssVars and fields if we didn't just load a draft
        if (!draftId) {
          setCssVars(extractCssVariables(initial.htmlContent));
          if (initial.defaultFieldValues) {
            setHeadline(initial.defaultFieldValues.headline || 'MONATLICH KÜNDBAR');
            setPrice(initial.defaultFieldValues.price || '39,90€');
            setOriginalPrice(initial.defaultFieldValues.originalPrice || '89,90€');
            setSelectedPerson(initial.defaultFieldValues.selectedPerson || '');
            setSelectedBg(initial.defaultFieldValues.selectedBg || '');
          }
        }
      }
    });
    loadAssets();
  }, [studioId, preselectedTemplateId]);

  // Undo / Redo keyboard shortcuts + arrow-key nudging
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

  // Apply CSS var overrides to template HTML
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
      // Drag-Script sendet bereits: x = Offset von Mitte, y = Abstand von unten
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

  const buildFieldValues = (): Record<string, string> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const values: Record<string, string> = {
      headline,
      price,
      originalPrice,
      location: studio?.location || '',
      primaryColor: studio?.primaryColor || '#00D4FF',
      accentColor: studio?.accentColor || '#0090cc',
      backgroundImage: selectedBg ? `${origin}/api/assets/serve?path=${encodeURIComponent(selectedBg)}` : '',
      personImage: selectedPerson ? `${origin}/api/assets/serve?path=${encodeURIComponent(selectedPerson)}` : '',
      logo: studio?.logo || '',
    };
    // Include custom fields
    for (const field of customFields) {
      values[field.key] = field.value;
    }
    return values;
  };

  const dims = FORMAT_DIMENSIONS[format];

  const autoScale = Math.min(1, 400 / dims.width);
  const zoomIn = () => setZoom(prev => Math.min((prev ?? autoScale) + 0.1, 1.5));
  const zoomOut = () => setZoom(prev => Math.max((prev ?? autoScale) - 0.1, 0.25));
  const zoomReset = () => setZoom(null);
  const zoomPercent = Math.round((zoom ?? autoScale) * 100);

  const saveAsTemplate = async () => {
    if (!selectedTemplate) return;
    
    const name = window.prompt("Gib einen Namen für dein neues Template ein:", `${selectedTemplate.name} (Custom)`);
    if (!name) return;
    
    const newHtml = getStyledHtml(selectedTemplate.htmlContent);
    const newTemplate: SavedTemplate = {
      ...selectedTemplate,
      id: uuidv4(),
      name,
      htmlContent: newHtml,
      defaultFieldValues: {
        headline,
        price,
        originalPrice,
        selectedPerson,
        selectedBg,
      },
      studioId: studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      if (res.ok) {
        const saved = await res.json();
        setTemplates(prev => [...prev, saved]);
        setSelectedTemplate(saved);
        setCssVars(extractCssVariables(newHtml));
        alert('Template erfolgreich gespeichert!');
      }
    } catch (err) {
      alert('Fehler beim Speichern des Templates');
      console.error(err);
    }
  };

  const saveAsDraft = async () => {
    if (!selectedTemplate) return;
    const name = window.prompt("Gib einen Namen für diesen Entwurf ein:");
    if (!name) return;

    const draftFieldValues: Record<string, string> = {
      headline,
      price,
      originalPrice,
      selectedPerson,
      selectedBg,
    };
    for (const field of customFields) {
      draftFieldValues[field.key] = field.value;
    }

    const newDraft: Creative = {
      id: uuidv4(),
      name,
      studioId,
      templateId: selectedTemplate.id,
      cssVars,
      fieldValues: draftFieldValues,
      outputs: [],
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft)
      });
      if (res.ok) {
        const saved = await res.json();
        setSavedCreatives(prev => [...prev, saved]);
        alert('Entwurf erfolgreich gespeichert!');
      }
    } catch {
      alert('Fehler beim Speichern des Entwurfs');
    }
  };

  const loadDraft = (creativeId: string) => {
    const draft = savedCreatives.find(c => c.id === creativeId);
    if (!draft) return;
    const t = templates.find(temp => temp.id === draft.templateId);
    if (t) {
      setSelectedTemplate(t);
      setSelectedSection(null);
      setCssVars(draft.cssVars || extractCssVariables(t.htmlContent));
    }
    setHeadline(draft.fieldValues.headline || '');
    setPrice(draft.fieldValues.price || '');
    setOriginalPrice(draft.fieldValues.originalPrice || '');
    setSelectedPerson(draft.fieldValues.selectedPerson || '');
    setSelectedBg(draft.fieldValues.selectedBg || '');
  };

  const renderSingle = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const values = { ...buildFieldValues(), width: String(dims.width), height: String(dims.height) };
    const html = replacePlaceholders(getStyledHtml(selectedTemplate.htmlContent), values);

    const newOutput: CreativeOutput = { format, status: 'rendering' };
    setOutputs(prev => [...prev, newOutput]);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, width: dims.width, height: dims.height }),
      });

      if (!res.ok) throw new Error('Render failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'done', outputPath: url } : o
      ));
    } catch {
      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'error', error: 'Render fehlgeschlagen' } : o
      ));
    } finally {
      setRendering(false);
    }
  };

  const renderAllFormats = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const newOutputs: CreativeOutput[] = ALL_FORMATS.map(f => ({ format: f, status: 'rendering' as const }));
    setOutputs(prev => [...prev, ...newOutputs]);

    await Promise.all(ALL_FORMATS.map(async (fmt, idx) => {
      const d = FORMAT_DIMENSIONS[fmt];
      const values = { ...buildFieldValues(), width: String(d.width), height: String(d.height) };
      const html = replacePlaceholders(getStyledHtml(selectedTemplate.htmlContent), values);

      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, width: d.width, height: d.height }),
        });
        if (!res.ok) throw new Error('Render failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'done', outputPath: url } : o
        ));
      } catch {
        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'error', error: 'Render failed' } : o
        ));
      }
    }));

    setRendering(false);
  };

  const downloadFile = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `creative-${format}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback
      const a = document.createElement('a');
      a.href = url;
      a.download = `creative-${format}-${Date.now()}.jpg`;
      a.click();
    }
  };

  const downloadAllAsZip = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const doneOutputs = outputs.filter(o => o.status === 'done' && o.outputPath);
    const blobs = await Promise.all(
      doneOutputs.map(async (o) => {
        try {
          const res = await fetch(o.outputPath!);
          return { format: o.format, blob: await res.blob() };
        } catch { return null; }
      })
    );

    for (const result of blobs) {
      if (result) zip.file(`creative-${result.format}.jpg`, result.blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatives-${studioId}-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full">
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
              {/* Template */}
              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Template</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={e => {
                    const t = templates.find(t => t.id === e.target.value) || null;
                    setSelectedTemplate(t);
                    setSelectedSection(null);
                    if (t) {
                      setCssVars(extractCssVariables(t.htmlContent));
                      if (t.defaultFieldValues) {
                        setHeadline(t.defaultFieldValues.headline || 'MONATLICH KÜNDBAR');
                        setPrice(t.defaultFieldValues.price || '39,90€');
                        setOriginalPrice(t.defaultFieldValues.originalPrice || '89,90€');
                        setSelectedPerson(t.defaultFieldValues.selectedPerson || '');
                        setSelectedBg(t.defaultFieldValues.selectedBg || '');
                      }
                    }
                  }}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none"
                >
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Gespeicherte Entwürfe */}
              {savedCreatives.length > 0 && (
                <div>
                  <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Gespeicherte Entwürfe</label>
                  <select
                    value=""
                    onChange={e => loadDraft(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none"
                  >
                    <option value="" disabled>Entwurf laden...</option>
                    {savedCreatives.map(c => <option key={c.id} value={c.id}>{c.name || 'Ohne Name'}</option>)}
                  </select>
                </div>
              )}

              {/* Format */}
              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Format</label>
                <FormatSelector selected={format} onChange={setFormat} />
              </div>

              {/* Text fields with add/remove */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Texte & Angebote</label>
                  <button onClick={() => setCustomFields(prev => [...prev, { key: `custom_${Date.now()}`, label: 'Neues Textfeld', value: '' }])}
                    className="text-[#00D4FF] text-xs hover:text-[#00b4d8] font-semibold">
                    + Hinzufuegen
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Headline */}
                  <div className="group">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Headline</label>
                      <button onClick={() => setHeadline('')}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                        title="Feld leeren">✕</button>
                    </div>
                    <input value={headline} onChange={e => { pushUndo(); setHeadline(e.target.value); }}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none" />
                  </div>

                  {/* Price */}
                  <div className="group">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Preis</label>
                      <button onClick={() => setPrice('')}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                        title="Feld leeren">✕</button>
                    </div>
                    <input value={price} onChange={e => { pushUndo(); setPrice(e.target.value); }}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-[#00D4FF] text-sm font-bold outline-none" />
                  </div>

                  {/* Original Price */}
                  <div className="group">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Streichpreis</label>
                      <button onClick={() => setOriginalPrice('')}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity"
                        title="Feld leeren">✕</button>
                    </div>
                    <input value={originalPrice} onChange={e => { pushUndo(); setOriginalPrice(e.target.value); }}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-[#9ca3af] text-sm outline-none" />
                  </div>

                  {/* Custom fields */}
                  {customFields.map(field => (
                    <div key={field.key} className="group">
                      <div className="flex justify-between items-center mb-1">
                        <input
                          value={field.label}
                          onChange={e => setCustomFields(prev => prev.map(f => f.key === field.key ? { ...f, label: e.target.value } : f))}
                          className="text-[#9ca3af] text-xs uppercase tracking-wider bg-transparent border-none outline-none w-full cursor-text hover:text-white focus:text-white"
                        />
                        <button
                          onClick={() => setCustomFields(prev => prev.filter(f => f.key !== field.key))}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs transition-opacity ml-2 flex-shrink-0"
                          title="Feld entfernen">✕</button>
                      </div>
                      <input
                        value={field.value}
                        onChange={e => setCustomFields(prev => prev.map(f => f.key === field.key ? { ...f, value: e.target.value } : f))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none"
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
                <AssetGrid assets={personAssets} selected={selectedPerson} onSelect={(p) => { pushUndo(); setSelectedPerson(p); }} size="sm" />
                {showPersonGen && (
                  <div className="mt-2">
                    <ImageGenerator studioId={studioId} assetType="person" onGenerated={() => { loadAssets(); setShowPersonGen(false); }} />
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
                <AssetGrid assets={bgAssets} selected={selectedBg} onSelect={(bg) => { pushUndo(); setSelectedBg(bg); }} size="sm" />
                {showBgGen && (
                  <div className="mt-2">
                    <ImageGenerator studioId={studioId} assetType="background" onGenerated={() => { loadAssets(); setShowBgGen(false); }} />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Stil Tab */
            <CssVarSlider variables={cssVars} selectedSection={selectedSection} onChange={handleCssVarChange} />
          )}
        </div>

        {/* Render buttons - always visible at bottom */}
        <div className="p-4 space-y-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex gap-2 mb-2">
            <button onClick={undo} disabled={undoStack.length === 0}
              className="flex-1 bg-white/[0.045] hover:bg-white/[0.08] disabled:opacity-30 text-[#e8eaed] font-semibold py-2 rounded-lg text-xs transition-colors">
              ← Undo {undoStack.length > 0 && `(${undoStack.length})`}
            </button>
            <button onClick={redo} disabled={redoStack.length === 0}
              className="flex-1 bg-white/[0.045] hover:bg-white/[0.08] disabled:opacity-30 text-[#e8eaed] font-semibold py-2 rounded-lg text-xs transition-colors">
              Redo → {redoStack.length > 0 && `(${redoStack.length})`}
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <button onClick={saveAsDraft} disabled={!selectedTemplate}
              className="flex-1 bg-white/[0.045] hover:bg-white/[0.08] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs transition-colors">
              Als Entwurf speichern
            </button>
            <button onClick={saveAsTemplate} disabled={!selectedTemplate}
              className="flex-1 bg-white/[0.045] hover:bg-white/[0.08] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-xs transition-colors">
              Als Template speichern
            </button>
          </div>
          <button onClick={renderSingle} disabled={rendering || !selectedTemplate}
            className="w-full bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-3 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]">
            {rendering ? 'Rendert...' : 'Creative rendern'}
          </button>
          <button onClick={renderAllFormats} disabled={rendering || !selectedTemplate}
            className="w-full bg-transparent border border-[#00D4FF]/50 text-[#00D4FF] font-semibold py-2.5 rounded-full text-xs hover:bg-[#00D4FF]/10 transition-all">
            Alle Formate rendern (4x)
          </button>
        </div>
      </div>

      {/* Center: Preview */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#050507] p-6"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.deltaY < 0) zoomIn(); else zoomOut(); } }}
      >
        {selectedTemplate ? (
          <LivePreview
            html={selectedTemplate.htmlContent}
            width={dims.width}
            height={dims.height}
            fieldValues={buildFieldValues()}
            cssVars={cssVars}
            scale={zoom ?? undefined}
            editable
            onDragEnd={handleDragEnd}
            onSelectElement={setSelectedSection}
          />
        ) : (
          <div className="text-[#4b5563] text-sm">Waehle ein Template um die Vorschau zu sehen</div>
        )}
        <QuickEditBar
          selectedElement={selectedSection}
          fieldValues={buildFieldValues()}
          onFieldChange={(field, value) => {
            pushUndo();
            if (field === 'headline') setHeadline(value);
            else if (field === 'price') setPrice(value);
            else if (field === 'originalPrice') setOriginalPrice(value);
          }}
          width={Math.min(400, dims.width) * Math.min(1, 400 / dims.width)}
        />
        <div className="flex items-center gap-2 mt-2">
          <button onClick={zoomOut} className="text-[#9ca3af] hover:text-white text-sm px-2 py-1 bg-white/[0.045] rounded transition-colors">-</button>
          <span className="text-[#6b7280] text-xs w-10 text-center">{zoomPercent}%</span>
          <button onClick={zoomIn} className="text-[#9ca3af] hover:text-white text-sm px-2 py-1 bg-white/[0.045] rounded transition-colors">+</button>
          <button onClick={zoomReset} className="text-[#6b7280] hover:text-white text-xs px-2 py-1 rounded transition-colors">Fit</button>
        </div>
      </div>

      {/* Right: Output/Batch */}
      <div className="w-[220px] glass-panel p-4 overflow-y-auto flex-shrink-0" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        <BatchPanel
          outputs={outputs}
          onDownload={downloadFile}
          onDownloadAll={downloadAllAsZip}
        />
      </div>
    </div>
  );
}
