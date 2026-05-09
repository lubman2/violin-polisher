/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Standalone FFmpeg worker for violin-polisher.
 * Loads ffmpeg-core via fetch+blob URL to completely bypass
 * Next.js/Turbopack bundler interference.
 */

let ffmpeg = null;

const FFMessageType = {
  LOAD: 'LOAD', EXEC: 'EXEC', WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE', DELETE_FILE: 'DELETE_FILE',
  LOG: 'LOG', PROGRESS: 'PROGRESS', ERROR: 'ERROR',
};

self.onmessage = async function (ev) {
  var id = ev.data.id;
  var type = ev.data.type;
  var _data = ev.data.data;
  console.log('[worker] received:', type, id);
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) {
      throw new Error('ffmpeg not loaded');
    }
    var result;

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
      self.postMessage({ id: id, type: type, data: result }, [result.buffer]);
    } else {
      self.postMessage({ id: id, type: type, data: result });
    }
  } catch (e) {
    self.postMessage({ id: id, type: 'ERROR', data: e.message || String(e) });
  }
};

async function loadFFmpegCore(cfg) {
  var corePath = cfg.coreURL;
  var wasmPath = cfg.wasmURL;

  if (ffmpeg) return false;

  // Step 1: Fetch core JS as text
  var resp = await fetch(corePath);
  if (!resp.ok) throw new Error('Failed to fetch ffmpeg-core: HTTP ' + resp.status);
  var code = await resp.text();

  // Step 2: Create blob URL so browser treats it as proper ESM
  var blob = new Blob([code], { type: 'text/javascript' });
  var blobURL = URL.createObjectURL(blob);

  // Step 3: Import the blob URL (fully independent from Next.js bundler)
  var module = await import(blobURL);
  var createFFmpegCore = module.default;
  URL.revokeObjectURL(blobURL);

  if (!createFFmpegCore) {
    throw new Error('Failed to load ffmpeg-core: createFFmpegCore not found');
  }

  ffmpeg = await createFFmpegCore({
    mainScriptUrlOrBlob: corePath + '#' + btoa(JSON.stringify({ wasmURL: wasmPath })),
  });

  // Register callbacks
  ffmpeg.setLogger(function (data) {
    self.postMessage({ type: 'LOG', data: data });
  });
  ffmpeg.setProgress(function (data) {
    self.postMessage({ type: 'PROGRESS', data: data });
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