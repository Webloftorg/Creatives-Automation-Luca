// components/variant-card.tsx
'use client';

import { useState } from 'react';
import { LivePreview } from '@/components/live-preview';
import type { CampaignVariant } from '@/lib/types';

interface VariantCardProps {
  variant: CampaignVariant;
  onToggleApproved: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  feedback?: 'good' | 'bad' | null;
  onFeedback: (rating: 'good' | 'bad', comment?: string) => void;
}

export function VariantCard({ variant, onToggleApproved, onEdit, onRegenerate, feedback, onFeedback }: VariantCardProps) {
  const [showComment, setShowComment] = useState<'good' | 'bad' | null>(null);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  const handleThumbsUp = () => {
    if (feedback === 'good') {
      onFeedback('good');
      setShowComment(null);
      return;
    }
    setShowComment('good');
  };

  const handleThumbsDown = () => {
    if (feedback === 'bad') {
      onFeedback('bad');
      setShowComment(null);
      return;
    }
    setShowComment('bad');
  };

  const submitFeedback = () => {
    if (!showComment) return;
    onFeedback(showComment, comment || undefined);
    setShowComment(null);
    setComment('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className={`glass-card rounded-xl overflow-hidden transition-all duration-300 ${
      variant.approved ? '' : 'opacity-30 grayscale'
    }`}>
      <div className="relative h-48 bg-[#050507] flex items-center justify-center overflow-hidden">
        <LivePreview
          html={variant.templateHtml}
          width={1080}
          height={1080}
          fieldValues={variant.fieldValues}
        />
        {/* Saved indicator */}
        {saved && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#22c55e] text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10">
            Gespeichert!
          </div>
        )}
        {/* Feedback indicator border */}
        {feedback && (
          <div className={`absolute inset-0 border-2 rounded-t-xl pointer-events-none ${
            feedback === 'good' ? 'border-[#22c55e]' : 'border-red-500'
          }`} />
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={handleThumbsUp}
            className={`variant-action w-7 h-7 rounded-md text-xs flex items-center justify-center ${
              feedback === 'good' ? '!bg-[#22c55e] !text-white' : ''
            }`}
            title="Gut - wird fuer zukuenftige Kampagnen gelernt">
            ↑
          </button>
          <button onClick={handleThumbsDown}
            className={`variant-action w-7 h-7 rounded-md text-xs flex items-center justify-center ${
              feedback === 'bad' ? '!bg-red-600 !text-white' : ''
            }`}
            title="Schlecht - Feedback geben">
            ↓
          </button>
          <button onClick={onRegenerate}
            className="variant-action w-7 h-7 rounded-md text-xs flex items-center justify-center"
            title="Mehr in diesem Stil">
            +
          </button>
          <button onClick={onEdit}
            className="variant-action w-7 h-7 rounded-md text-xs flex items-center justify-center"
            title="Bearbeiten">
            ✏️
          </button>
          <button onClick={onToggleApproved}
            className={`variant-action w-7 h-7 rounded-md text-xs flex items-center justify-center ${
              !variant.approved ? '!bg-[#22c55e] !text-white' : ''
            }`}
            title={variant.approved ? 'Entfernen' : 'Wiederherstellen'}>
            {variant.approved ? '×' : '↩'}
          </button>
        </div>
      </div>

      {/* Comment input for feedback */}
      {showComment && (
        <div className={`p-2 bg-[#15151e] border-t ${showComment === 'good' ? 'border-[#22c55e]/50' : 'border-red-500/50'}`}>
          <p className="text-[#9ca3af] text-[10px] uppercase tracking-wider mb-1">
            {showComment === 'good' ? 'Was war gut? (optional)' : 'Was war schlecht?'}
          </p>
          <div className="flex gap-1.5">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitFeedback(); }}
              className="flex-1 bg-[#0e0e15] border border-white/10 rounded px-2 py-1.5 text-white text-xs outline-none focus:border-[#00D4FF]/50"
              placeholder={showComment === 'good' ? 'z.B. tolle Farben, Person passt...' : 'z.B. zu viel Filter, Person zu klein...'}
              autoFocus
            />
            <button onClick={submitFeedback}
              className={`text-white text-xs px-2.5 py-1.5 rounded font-semibold transition-colors ${
                showComment === 'good' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-red-600 hover:bg-red-700'
              }`}>
              Senden
            </button>
          </div>
        </div>
      )}

      <div className="p-3">
        <p className="text-white text-sm font-semibold truncate">{variant.fieldValues.headline || 'Kein Headline'}</p>
        <div className="flex justify-between items-center">
          <p className="text-[#6b7280] text-xs mt-0.5">{variant.fieldValues.price || ''}</p>
          {feedback && (
            <span className={`text-[10px] font-semibold ${feedback === 'good' ? 'text-[#22c55e]' : 'text-red-400'}`}>
              {feedback === 'good' ? 'Gut bewertet' : 'Schlecht bewertet'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
