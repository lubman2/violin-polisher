/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

var ffmpeg = null;
var LOGS = []; // trace buffer

function log(msg) {
  var entry = { ts: Date.now(), msg: msg };
  LOGS.push(entry);
  console.log('[worker]', msg);
}
function logErr(msg) { console.error('[worker] ERR:', msg); LOGS.push({ ts: Date.now(), msg: 'ERR: ' + msg }); }

var MSG = { LOAD:'LOAD', EXEC:'EXEC', WRITE_FILE:'WRITE_FILE', READ_FILE:'READ_FILE', DELETE_FILE:'DELETE_FILE', LIST_FILES:'LIST_FILES', GET_LOGS:'GET_LOGS', LOG:'LOG', PROGRESS:'PROGRESS', ERROR:'ERROR' };

self.onmessage = async function(ev) {
  var id=ev.data.id, type=ev.data.type, _d=ev.data.data;
  log('rx:' + type + ' id=' + id);
  try {
    if(type!==MSG.LOAD && type!==MSG.GET_LOGS && !ffmpeg) throw Error('ffmpeg not loaded');
    var r;
    switch(type) {
      case MSG.LOAD:         r = await loadCore(_d);   break;
      case MSG.EXEC:         r = execFF(_d);           break;
      case MSG.WRITE_FILE:   r = writeFile(_d);        break;
      case MSG.READ_FILE:    r = readFile(_d);         break;
      case MSG.DELETE_FILE:  r = deleteFile(_d);       break;
      case MSG.LIST_FILES:   r = listFiles();          break;
      case MSG.GET_LOGS:     r = LOGS;                 break;
      default: throw Error('unknown: ' + type);
    }
    if(r instanceof Uint8Array) self.postMessage({id,type,data:r},[r.buffer]);
    else self.postMessage({id,type,data:r});
  } catch(e) {
    logErr(e.message);
    self.postMessage({id,type:MSG.ERROR,data:e.message||String(e)});
  }
};

function writeFile(cfg) {
  log('writeFile: ' + cfg.path + ' size=' + cfg.data.byteLength);
  try {
    ffmpeg.FS.writeFile(cfg.path, cfg.data);
    // Verify it was written
    var stat = ffmpeg.FS.stat(cfg.path);
    log('writeFile OK: ' + cfg.path + ' on disk size=' + stat.size);
    return true;
  } catch(e) {
    logErr('writeFile failed: ' + e.message);
    throw e;
  }
}

function readFile(cfg) {
  log('readFile: ' + cfg.path);
  try {
    var data = ffmpeg.FS.readFile(cfg.path, { encoding: cfg.encoding || 'binary' });
    log('readFile OK: ' + cfg.path + ' size=' + (data ? data.byteLength : 0));
    return data;
  } catch(e) {
    logErr('readFile failed: ' + e.message);
    throw e;
  }
}

function deleteFile(cfg) {
  log('deleteFile: ' + cfg.path);
  try { ffmpeg.FS.unlink(cfg.path); log('deleteFile OK'); } catch(e) { log('deleteFile warn: ' + e.message); }
  return true;
}

function listFiles() {
  log('listFiles');
  try {
    var names = ffmpeg.FS.readdir('/');
    var result = [];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (name === '.' || name === '..') continue;
      try {
        var st = ffmpeg.FS.stat('/' + name);
        result.push({ name: name, size: st.size, isDir: ffmpeg.FS.isDir(st.mode) });
      } catch(e) {
        result.push({ name: name, error: e.message });
      }
    }
    log('listFiles: ' + JSON.stringify(result));
    return result;
  } catch(e) {
    logErr('listFiles failed: ' + e.message);
    return { error: e.message };
  }
}

async function loadCore(cfg) {
  if(ffmpeg) { log('core already loaded'); return false; }
  log('loading core from ' + cfg.coreURL);
  var mod = await import(cfg.coreURL);
  var factory = mod.default;
  if(!factory) {
    logErr('factory is ' + typeof factory + ', keys: ' + Object.keys(mod).join(','));
    throw Error('createFFmpegCore not found');
  }
  log('factory type: ' + typeof factory);

  log('initializing WASM from ' + cfg.wasmURL);
  ffmpeg = await factory({
    locateFile: function(path) {
      if(path.endsWith('.wasm')) { log('locateFile: ' + path + ' -> ' + cfg.wasmURL); return cfg.wasmURL; }
      return path;
    }
  });
  log('WASM ready, ffmpeg keys: ' + Object.keys(ffmpeg).slice(0,10).join(','));
  log('ffmpeg.FS available: ' + !!ffmpeg.FS);

  ffmpeg.setLogger(function(d){self.postMessage({type:MSG.LOG,data:d})});
  ffmpeg.setProgress(function(d){self.postMessage({type:MSG.PROGRESS,data:d})});
  return true;
}

function execFF(cfg) {
  log('exec args: ' + cfg.args.join(' '));
  log('exec timeout: ' + (cfg.timeout || -1));
  ffmpeg.setTimeout(cfg.timeout || -1);
  ffmpeg.exec.apply(ffmpeg, cfg.args);
  var ret = ffmpeg.ret;
  log('exec ret: ' + ret);
  ffmpeg.reset();
  return ret;
}