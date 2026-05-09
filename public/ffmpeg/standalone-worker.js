/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Standalone FFmpeg worker for violin-polisher.
 * Loaded as ES module worker ({ type: 'module' }).
 * Uses dynamic import() to load ffmpeg-core (which needs import.meta).
 */

let ffmpeg = null;

const FFMessageType = {
  LOAD: 'LOAD', EXEC: 'EXEC', WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE', DELETE_FILE: 'DELETE_FILE',
  LOG: 'LOG', PROGRESS: 'PROGRESS', ERROR: 'ERROR',
};

self.onmessage = async function ({ data: { id, type, data: _data } }) {
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) {
      throw new Error('ffmpeg not loaded');
    }
    let result;

    switch (type) {
      case FFMessageType.LOAD:
        result = await loadFFmpegCore(_data);
        break;
      case FFMessageType.EXEC:
        result = execFF(_data);
        break;
      case FFMessageType.WRITE_FILE:
        ffmpeg.FS.writeFile(_data.path, _data.data);
        result = true;
        break;
      case FFMessageType.READ_FILE:
        result = ffmpeg.FS.readFile(_data.path, { encoding: _data.encoding || 'binary' });
        break;
      case FFMessageType.DELETE_FILE:
        try { ffmpeg.FS.unlink(_data.path); } catch (e) {}
        result = true;
        break;
      default:
        throw new Error('unknown message type: ' + type);
    }

    if (result instanceof Uint8Array) {
      self.postMessage({ id, type, data: result }, [result.buffer]);
    } else {
      self.postMessage({ id, type, data: result });
    }
  } catch (e) {
    self.postMessage({ id, type: FFMessageType.ERROR, data: e.message || String(e) });
  }
};

async function loadFFmpegCore(cfg) {
  var coreURL = cfg.coreURL;
  var wasmURL = cfg.wasmURL;

  if (ffmpeg) return false;

  // Load ffmpeg-core.js as an ES module — it uses import.meta internally
  var coreModule = await import(/* @vite-ignore */ coreURL);
  var createFFmpegCore = coreModule.default;

  if (!createFFmpegCore) {
    throw new Error('Failed to load ffmpeg-core: createFFmpegCore not found');
  }

  if (!wasmURL) {
    wasmURL = coreURL.replace(/\.js$/, '.wasm');
  }

  ffmpeg = await createFFmpegCore({
    mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL: wasmURL })),
  });

  // Register callbacks for log/progress
  ffmpeg.setLogger(function (data) {
    self.postMessage({ type: FFMessageType.LOG, data: data });
  });
  ffmpeg.setProgress(function (data) {
    self.postMessage({ type: FFMessageType.PROGRESS, data: data });
  });

  return true;
}

function execFF(cfg) {
  var args = cfg.args;
  var timeout = cfg.timeout || -1;
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec.apply(ffmpeg, args);
  var ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
}
