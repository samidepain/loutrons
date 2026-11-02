// Lecture des codes-barres avec la caméra arrière : lecteur intégré au navigateur s'il existe (Android),
// sinon la bibliothèque ZXing livrée avec l'appli (vendor/zxing, chargée seulement au premier scan, nécessaire sur iPhone).
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let zxing = null;
function loadZxing(){
  if (!zxing) zxing = new Promise((ok, ko) => {
    if (window.ZXing) { ok(window.ZXing); return; }
    const s = document.createElement('script'); s.src = 'vendor/zxing/zxing.min.js';
    s.onload = () => ok(window.ZXing); s.onerror = () => { zxing = null; ko(new Error('zxing')); };
    document.head.appendChild(s);
  });
  return zxing;
}
async function nativeDetector(){
  if (!('BarcodeDetector' in window)) return null;
  try { const ok = await window.BarcodeDetector.getSupportedFormats(); return ok.indexOf('ean_13') >= 0 ? new window.BarcodeDetector({ formats: FORMATS.filter(f => ok.indexOf(f) >= 0) }) : null; } catch (e) { return null; }
}
// Démarre la lecture dans l'élément vidéo ; onCode(code) au premier code lu. Renvoie une fonction pour tout arrêter.
export async function startScanner(video, onCode){
  let stopped = false; let stop = () => { stopped = true; };
  const det = await nativeDetector();
  if (det) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:'environment' } });
    if (stopped) { stream.getTracks().forEach(t => t.stop()); return () => {}; }
    video.srcObject = stream; await video.play().catch(() => {});
    let timer = null;
    const tick = async () => {
      if (stopped) return;
      try { const r = await det.detect(video); if (r.length && !stopped) { stop(); onCode(r[0].rawValue); return; } } catch (e) {}
      timer = setTimeout(tick, 200);
    };
    stop = () => { stopped = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
    tick();
    return () => stop();
  }
  const Z = await loadZxing();
  const hints = new Map(); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
  const reader = new Z.BrowserMultiFormatReader(hints, 250);
  stop = () => { stopped = true; try { reader.reset(); } catch (e) {} };
  if (stopped) return () => {};
  await reader.decodeFromConstraints({ audio:false, video:{ facingMode:'environment' } }, video, res => { if (res && !stopped) { stop(); onCode(res.getText()); } });
  return () => stop();
}
