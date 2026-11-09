// Minuteur de repos, bip de fin, écran gardé allumé pendant la séance.
import { $, pad } from './util.js';
import { S } from './store.js';
import { activeWorkout } from './data.js';

let tick = null; let audio = null;
export function unlockAudio(){ try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) {} }
function beep(){
  try { if (audio) { const o = audio.createOscillator(); const g = audio.createGain(); const t = audio.currentTime;
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.55); } } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
}
export function startRest(sec, label){ S.restEnd = Date.now() + sec * 1000; S.restTotal = sec; S.restLabel = label; S.restDoneAt = 0; ensureTick(); updateRest(); }
export function stopRest(){ S.restEnd = 0; S.restDoneAt = 0; updateRest(); }
export function ensureTick(){ if (!tick) tick = setInterval(onTick, 250); }
function onTick(){
  updateRest();
  const el = $('#elapsed'); const w = activeWorkout();
  if (el && w) {
    const secs = Math.floor((Date.now() - w.startedAt) / 1000); const m = Math.floor(secs / 60);
    el.textContent = m + ':' + pad(secs % 60);
    el.className = 'clock' + (m >= 90 ? ' bad' : m >= 75 ? ' warn' : '');
    const cw = $('#cutwarn'); if (cw) cw.hidden = m < 75;
  }
  if (!S.restEnd && !S.restDoneAt && !(w && S.view === 'training')) { clearInterval(tick); tick = null; }
}
export function updateRest(){
  const bar = $('#restbar');
  if (S.restEnd) {
    const left = Math.max(0, Math.ceil((S.restEnd - Date.now()) / 1000));
    $('#rest-time').textContent = Math.floor(left / 60) + ':' + pad(left % 60);
    $('#rest-label').textContent = S.restLabel;
    // Anneau : la part du repos qui reste (« +15 s » agrandit le total)
    const tot = Math.max(S.restTotal || 0, left) || 1; $('#rest-arc').setAttribute('stroke-dashoffset', (314.2 * (1 - left / tot)).toFixed(1));
    bar.hidden = false; bar.classList.remove('end');
    if (left <= 0) { S.restEnd = 0; S.restDoneAt = Date.now(); beep(); }
  } else if (S.restDoneAt && Date.now() - S.restDoneAt < 4000) {
    $('#rest-time').textContent = '0:00'; $('#rest-label').textContent = 'Repos terminé, série suivante.'; $('#rest-arc').setAttribute('stroke-dashoffset', '0');
    bar.hidden = false; bar.classList.add('end');
  } else { S.restDoneAt = 0; bar.hidden = true; }
}
let wake = null;
export async function requestWake(){ try { if ('wakeLock' in navigator && activeWorkout() && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWake(); });
