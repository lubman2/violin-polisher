'use client';

import { useState, useCallback } from 'react';
import AudioUpload from '../components/AudioUpload';
import PresetSelector from '../components/PresetSelector';
import AudioPreview from '../components/AudioPreview';
import ProcessingStatus from '../components/ProcessingStatus';
import { PRESETS, type Preset } from '../lib/presets';
import { APP_VERSION } from '../lib/version';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('classical-hall');
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);

  const handleFileSelect = useCallback((file: File, url: string) => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setSelectedFile(file);
    setFileUrl(url);
    setProcessedUrl(null);
    setProcessedBlob(null);
  }, [fileUrl]);

  const handleProcessingComplete = useCallback((blob: Blob, url: string) => {
    setProcessedBlob(blob);
    setProcessedUrl(url);
  }, []);

  const handleProcessingError = useCallback((error: string) => {
    console.error('Chyba zpracování:', error);
  }, []);

  const selectedPreset = PRESETS.find(p => p.id === selectedPresetId) || PRESETS[0];

  return (
    <div className="min-h-screen bg-base-200">
      <header className="bg-base-100 border-b border-base-content/5 py-6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎻</span>
            <div>
              <h1 className="text-2xl font-bold flex items-baseline gap-2">
                Violin Polisher
                <span className="text-xs opacity-40 font-normal tabular-nums">v{APP_VERSION}</span>
              </h1>
              <p className="text-sm opacity-60">Zlepšete zvuk houslových nahrávek přímo v prohlížeči</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* Krok 1: Upload */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">1</span>
            Nahrajte nahrávku
          </h2>
          <AudioUpload
            selectedFile={selectedFile}
            fileUrl={fileUrl}
            onFileSelect={handleFileSelect}
          />
        </section>

        {/* Krok 2: Preset */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">2</span>
            Vyberte zvuk
          </h2>
          <PresetSelector
            presets={PRESETS}
            selectedId={selectedPresetId}
            onSelect={setSelectedPresetId}
          />
        </section>

        {/* Krok 3: Formát */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">3</span>
            Výstupní formát
          </h2>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="wav"
                checked={format === 'wav'}
                onChange={() => setFormat('wav')}
                className="radio radio-primary"
              />
              <span>WAV (bezeztrátový)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="mp3"
                checked={format === 'mp3'}
                onChange={() => setFormat('mp3')}
                className="radio radio-primary"
              />
              <span>MP3 (320 kbps)</span>
            </label>
          </div>
        </section>

        {/* Krok 4: Zpracování */}
        {selectedFile && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content text-sm font-bold">4</span>
              Zpracovat a stáhnout
            </h2>
            <ProcessingStatus
              key={`${selectedFile.name}-${selectedPresetId}-${format}`}
              preset={selectedPreset}
              inputFile={selectedFile}
              format={format}
              onComplete={handleProcessingComplete}
              onError={handleProcessingError}
            />
          </section>
        )}

        {/* Náhled */}
        {(fileUrl || processedUrl) && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-content text-sm font-bold">♪</span>
              Náhled
            </h2>
            <AudioPreview
              originalUrl={fileUrl || ""}
              processedUrl={processedUrl || ""}
              originalFile={selectedFile}
              processedBlob={processedBlob}
            />
          </section>
        )}

        {/* Jak to funguje */}
        <section className="mt-16 mb-8">
          <div className="bg-base-100 rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Jak to funguje</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">🧹 Vyčištění</h4>
                <p className="opacity-70">Odstraní brum, šum a subsonický hluk pomocí AI redukce šumu (RNNoise).</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🎛 Ekvalizace</h4>
                <p className="opacity-70">Opraví piezo „quack" a zvýrazní přítomnost + vzduch pro přirozený tón.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">📊 Komprese</h4>
                <p className="opacity-70">Jemně srovná dynamiku — zachová přechody smyčce a hudební výraz.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">🔊 Stereo + Reverb</h4>
                <p className="opacity-70">Přidá stereo šířku (Haasův efekt) a přirozený hallový reverb pro prostorovou hloubku.</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-base-200 rounded-lg">
              <p className="text-xs opacity-60">
                🔄 Veškeré zpracování běží lokálně ve vašem prohlížeči pomocí FFmpeg.wasm. Zvuk nikdy neopouští vaše zařízení — žádný upload na server.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
