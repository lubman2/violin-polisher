/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Standalone FFmpeg worker for violin-polisher.
 * Self-contained — no external ESM imports.
 * Uses importScripts to load UDM ffmpeg-core.
 * 
 * Messages: { id, type, data }
 * Types: LOAD, EXEC, WRITE_FILE, READ_FILE, DELETE_FILE, FFPROBE,
 *        RENAME, CREATE_DIR, LIST_DIR, DELETE_DIR, MOUNT, UNMOUNT, LOG, PROGRESS, ERROR
 */

let ffmpeg = null;

const FFMessageType = {
  LOAD: 'LOAD', EXEC: 'EXEC', FFPROBE: 'FFPROBE', WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE', DELETE_FILE: 'DELETE_FILE', RENAME: 'RENAME',
  CREATE_DIR: 'CREATE_DIR', LIST_DIR: 'LIST_DIR', DELETE_DIR: 'DELETE_DIR',
  MOUNT: 'MOUNT', UNMOUNT: 'UNMOUNT', LOG: 'LOG', PROGRESS: 'PROGRESS', ERROR: 'ERROR',
};

const ERROR_UNKNOWN = new Error('unknown message type');
const ERROR_NOT_LOADED = new Error('ffmpeg not loaded');

self.onmessage = async ({ data: { id, type, data: _data } }) => {
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
    let data;

    switch (type) {
      case FFMessageType.LOAD:
        data = await loadFFmpegCore(_data);
        break;
      case FFMessageType.EXEC:
        data = execFF(_data);
        break;
      case FFMessageType.FFPROBE:
        data = ffprobeFF(_data);
        break;
      case FFMessageType.WRITE_FILE:
        ffmpeg.FS.writeFile(_data.path, _data.data);
        data = true;
        break;
      case FFMessageType.READ_FILE:
        data = ffmpeg.FS.readFile(_data.path, { encoding: _data.encoding || 'binary' });
        break;
      case FFMessageType.DELETE_FILE:
        ffmpeg.FS.unlink(_data.path);
        data = true;
        break;
      default:
        throw ERROR_UNKNOWN;
    }

    if (data instanceof Uint8Array) {
      self.postMessage({ id, type, data }, [data.buffer]);
    } else {
      self.postMessage({ id, type, data });
    }
  } catch (e) {
    self.postMessage({ id, type: FFMessageType.ERROR, data: e.toString() });
  }
};

async function loadFFmpegCore({ coreURL, wasmURL, workerURL }) {
  if (ffmpeg) return false;

  // Load UMD core via importScripts — exposes createFFmpegCore on self
  if (!self.createFFmpegCore) {
    try {
      importScripts(coreURL);
    } catch {
      importScripts(coreURL.replace('/umd/', '/esm/'));
    }
  }

  if (!self.createFFmpegCore) {
    throw new Error('Failed to load ffmpeg-core');
  }

  const actualWasm = wasmURL || coreURL.replace(/.js$/, '.wasm');
  const actualWorker = workerURL || coreURL.replace(/.js$/, '.worker.js');

  ffmpeg = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL: actualWasm, workerURL: actualWorker }))}`,
  });

  ffmpeg.setLogger = (cb) => {
    const origSetLogger = ffmpeg.setLogger;
    origSetLogger((data) => {
      self.postMessage({ type: FFMessageType.LOG, data });
    });
  };

  ffmpeg.setProgress = (cb) => {
    const origSetProgress = ffmpeg.setProgress;
    origSetProgress((data) => {
      self.postMessage({ type: FFMessageType.PROGRESS, data });
    });
  };

  // Register initial callbacks
  ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));

  return true;
}

function execFF({ args, timeout = -1 }) {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
}

function ffprobeFF({ args, timeout = -1 }) {
  ffmpeg.setTimeout(timeout);
  ffmpeg.ffprobe(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
}
