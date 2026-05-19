'use client';

import { CARD_TEMPLATES } from '@/lib/templates';

interface TemplateSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export default function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {CARD_TEMPLATES.map((tpl) => {
        const selected = value === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onChange(tpl.id)}
            className={`relative rounded-xl overflow-hidden transition-all focus:outline-none ${
              selected
                ? 'ring-2 ring-offset-2 ring-primary scale-105 shadow-lg'
                : 'hover:opacity-100 opacity-75 hover:shadow-md'
            }`}
            title={tpl.name}
          >
            {/* Gradient swatch */}
            <div className="h-14 w-full" style={{ background: tpl.previewGradient }} />
            {/* Accent strip using borderColor */}
            <div className="h-1" style={{ background: tpl.borderColor }} />
            {/* Label */}
            <div className="bg-card border-x border-b border-border px-1 py-1 rounded-b-xl">
              <p className="text-[10px] font-medium text-center text-foreground leading-tight truncate">
                {tpl.name}
              </p>
            </div>
            {/* Tick */}
            {selected && (
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
