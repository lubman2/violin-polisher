'use client';

import React from 'react';
import type { Preset } from '../lib/presets';

interface PresetEditorProps {
  preset: Preset;
  onChange: (updated: Preset) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="opacity-70">{label}</span>
        <span className="tabular-nums font-mono">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="range range-xs range-primary w-full"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="toggle toggle-sm toggle-primary" />
      <span>{label}</span>
    </label>
  );
}

export default function PresetEditor({ preset, onChange }: PresetEditorProps) {
  const [open, setOpen] = React.useState(false);

  const update = (patch: Partial<Preset>) => onChange({ ...preset, ...patch });
  const updateClean = (patch: Partial<Preset['clean']>) => update({ clean: { ...preset.clean, ...patch } });
  const updateComp = (patch: Partial<Preset['compressor']>) => update({ compressor: { ...preset.compressor, ...patch } });
  const updateStereo = (patch: Partial<Preset['stereo']>) => update({ stereo: { ...preset.stereo, ...patch } });
  const updateReverb = (patch: Partial<Preset['reverb']>) => update({ reverb: { ...preset.reverb, ...patch } });

  const updateEqBand = (index: number, patch: Partial<Preset['eq'][0]>) => {
    const eq = [...preset.eq];
    eq[index] = { ...eq[index], ...patch };
    update({ eq });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-sm btn-ghost opacity-60 hover:opacity-100 w-full">
        🎛 Upravit parametry presetu
      </button>
    );
  }

  return (
    <div className="bg-base-100 rounded-xl p-5 space-y-6 border border-base-content/10">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">🎛 Parametry: {preset.name}</h4>
        <button onClick={() => setOpen(false)} className="btn btn-xs btn-ghost">Zavřít ✕</button>
      </div>

      {/* Čištění */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold opacity-50 uppercase tracking-wider">🧹 Čištění</h5>
        <Slider label="High-pass filtr" value={preset.clean.highpassFreq} min={20} max={200} step={5} unit=" Hz" onChange={v => updateClean({ highpassFreq: v })} />
      </div>

      {/* EQ */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold opacity-50 uppercase tracking-wider">🎛 Ekvalizér</h5>
        {preset.eq.map((band, i) => (
          <Slider key={i} label={band.frequency + ' Hz'} value={band.gain} min={-12} max={12} step={0.5} unit=" dB" onChange={v => updateEqBand(i, { gain: v })} />
        ))}
      </div>

      {/* Komprese */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold opacity-50 uppercase tracking-wider">📊 Komprese</h5>
        <Toggle label="Zapnout kompresi" checked={preset.compressor.enabled} onChange={v => updateComp({ enabled: v })} />
        {preset.compressor.enabled && (
          <>
            <Slider label="Threshold" value={preset.compressor.threshold} min={-40} max={0} step={1} unit=" dB" onChange={v => updateComp({ threshold: v })} />
            <Slider label="Ratio" value={preset.compressor.ratio} min={1} max={10} step={0.5} unit=":1" onChange={v => updateComp({ ratio: v })} />
            <Slider label="Attack" value={preset.compressor.attack} min={1} max={500} step={10} unit=" ms" onChange={v => updateComp({ attack: v })} />
            <Slider label="Release" value={preset.compressor.release} min={50} max={1000} step={10} unit=" ms" onChange={v => updateComp({ release: v })} />
            <Slider label="Makeup gain" value={preset.compressor.makeupGain} min={0} max={12} step={0.5} unit=" dB" onChange={v => updateComp({ makeupGain: v })} />
          </>
        )}
      </div>

      {/* Stereo */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold opacity-50 uppercase tracking-wider">🔊 Stereo rozšíření</h5>
        <Toggle label="Zapnout stereo (Haas)" checked={preset.stereo.enabled} onChange={v => updateStereo({ enabled: v })} />
        {preset.stereo.enabled && (
          <Slider label="Haas delay" value={preset.stereo.haasDelay} min={1} max={30} step={1} unit=" ms" onChange={v => updateStereo({ haasDelay: v })} />
        )}
      </div>

      {/* Reverb */}
      <div className="space-y-2">
        <h5 className="text-xs font-semibold opacity-50 uppercase tracking-wider">🎵 Reverb</h5>
        <Toggle label="Zapnout reverb" checked={preset.reverb.enabled} onChange={v => updateReverb({ enabled: v })} />
        {preset.reverb.enabled && (
          <>
            <Slider label="Dozvuk" value={preset.reverb.decay} min={100} max={5000} step={100} unit=" ms" onChange={v => updateReverb({ decay: v })} />
            <Slider label="Pre-delay" value={preset.reverb.preDelay} min={0} max={100} step={5} unit=" ms" onChange={v => updateReverb({ preDelay: v })} />
            <Slider label="Wet mix" value={preset.reverb.wetMix} min={0} max={0.5} step={0.01} unit="" onChange={v => updateReverb({ wetMix: v })} />
          </>
        )}
      </div>
    </div>
  );
}
