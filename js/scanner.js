// Lecture des codes-barres avec la caméra arrière : lecteur intégré au navigateur s'il existe (Android),
// sinon la bibliothèque ZXing livrée avec l'appli (vendor/zxing, chargée seulement au premier scan, nécessaire sur iPhone).
// Pas d'UPC-E (code court américain) : ses 8 chiffres seraient pris pour un EAN-8, donc pour un autre produit.
const FORMATS = ['ean_13', 'ean_8', 'upc_a'];
// Image demandée en 1280 × 720 : à la résolution par défaut (640 × 480), les barres fines d'un petit code-barres ne se lisent pas
const CAMERA = { audio:false, video:{ facingMode:'environment', width:{ ideal:1280 }, height:{ ideal:720 } } };
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
// Démarre la lecture dans l'élément vidéo ; onCode(code) au premier code accepté par ok(code) : un code mal lu (clé de contrôle fausse)
// est ignoré et la lecture continue, au lieu de s'arrêter sur une erreur. Renvoie une fonction pour tout arrêter.
export async function startScanner(video, onCode, ok = () => true){
  let stopped = false; let stop = () => { stopped = true; };
  const det = await nativeDetector();
  if (det) {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA);
    if (stopped) { stream.getTracks().forEach(t => t.stop()); return () => {}; }
    video.srcObject = stream; await video.play().catch(() => {});
    let timer = null;
    const tick = async () => {
      if (stopped) return;
      try { const r = await det.detect(video); const hit = r.find(x => ok(x.rawValue)); if (hit && !stopped) { stop(); onCode(hit.rawValue); return; } } catch (e) {}
      timer = setTimeout(tick, 200);
    };
    stop = () => { stopped = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
    tick();
    return () => stop();
  }
  const Z = await loadZxing();
  const hints = new Map(); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A]);
  // lecture plus patiente : toutes les lignes de l'image sont essayées (code penché, reflet sur une partie)
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.BrowserMultiFormatReader(hints, 250);
  stop = () => { stopped = true; try { reader.reset(); } catch (e) {} };
  if (stopped) return () => {};
  await reader.decodeFromConstraints(CAMERA, video, res => { if (res && !stopped && ok(res.getText())) { stop(); onCode(res.getText()); } });
  return () => stop();
}
