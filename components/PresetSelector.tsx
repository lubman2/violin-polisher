import React from 'react';
import type { Preset } from '../lib/presets';

interface PresetSelectorProps {
  presets: Preset[];
  selectedId: string;
  onSelect: (presetId: string) => void;
}

export default function PresetSelector({ presets, selectedId, onSelect }: PresetSelectorProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <h3 className="text-lg font-semibold mb-3">Vyberte preset</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              selectedId === preset.id
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                : 'border-base-content/10 hover:border-base-content/30 hover:bg-base-200/50'
            }`}
          >
            <span className="text-3xl flex-shrink-0">{preset.icon}</span>
            <div>
              <p className="font-semibold">{preset.name}</p>
              <p className="text-sm opacity-70 leading-relaxed mt-0.5">{preset.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
