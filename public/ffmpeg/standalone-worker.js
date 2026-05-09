/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

let ffmpeg = null;

const MSG = { LOAD:'LOAD', EXEC:'EXEC', WRITE_FILE:'WRITE_FILE', READ_FILE:'READ_FILE', DELETE_FILE:'DELETE_FILE', LOG:'LOG', PROGRESS:'PROGRESS', ERROR:'ERROR' };

self.onmessage = async function(ev) {
  var id=ev.data.id, type=ev.data.type, _d=ev.data.data;
  console.log('[worker] rx:', type, id);
  try {
    if(type!==MSG.LOAD && !ffmpeg) throw Error('ffmpeg not loaded');
    var r;
    switch(type) {
      case MSG.LOAD:         r = await loadCore(_d);   break;
      case MSG.EXEC:         r = execFF(_d);           break;
      case MSG.WRITE_FILE:   ffmpeg.FS.writeFile(_d.path,_d.data); r=true; break;
      case MSG.READ_FILE:    r = ffmpeg.FS.readFile(_d.path,{encoding:_d.encoding||'binary'}); break;
      case MSG.DELETE_FILE:  try{ffmpeg.FS.unlink(_d.path)}catch(e){} r=true; break;
      default: throw Error('unknown: ' + type);
    }
    if(r instanceof Uint8Array) self.postMessage({id,type,data:r},[r.buffer]);
    else self.postMessage({id,type,data:r});
  } catch(e) {
    console.error('[worker] err:', e.message);
    self.postMessage({id,type:MSG.ERROR,data:e.message||String(e)});
  }
};

async function loadCore(cfg) {
  if(ffmpeg) return false;
  console.log('[worker] loading core...');

  // Direct import — corePath is same-origin URL
  var mod = await import(cfg.coreURL);
  var factory = mod.default;
  if(!factory) throw Error('createFFmpegCore not found');

  console.log('[worker] initializing WASM...');
  ffmpeg = await factory({
    locateFile: function(path) {
      if(path.endsWith('.wasm')) return cfg.wasmURL;
      return path;
    }
  });
  console.log('[worker] WASM ready');

  ffmpeg.setLogger(function(d){self.postMessage({type:MSG.LOG,data:d})});
  ffmpeg.setProgress(function(d){self.postMessage({type:MSG.PROGRESS,data:d})});
  return true;
}

function execFF(cfg) {
  ffmpeg.setTimeout(cfg.timeout||-1);
  ffmpeg.exec.apply(ffmpeg, cfg.args);
  var ret = ffmpeg.ret; ffmpeg.reset(); return ret;
}