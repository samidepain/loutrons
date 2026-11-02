// Petits outils : dates, nombres, texte, stockage local, message en bas de l’écran.

export const $ = (s, el) => (el || document).querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pad = n => String(n).padStart(2, '0');
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseIso = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
export const today = () => iso(new Date());
export const mondayOf = s => { const d = parseIso(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
export const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);
export const num = v => { if (v == null) return null; const s = String(v).trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return isFinite(n) ? n : null; };
export const fmtKg = x => (x == null || isNaN(x)) ? '—' : String(Math.round(x * 100) / 100).replace('.', ',');
export const roundTo = (x, step) => { step = step > 0 ? step : 0.25; return Math.round(Math.round(x / step) * step * 100) / 100; };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const MONTHS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
export const WEEKDAYS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
export const fmtDate = s => { const d = parseIso(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
export const fmtDateLong = s => { const d = parseIso(s); return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
export const withDot = s => s.slice(-1) === '.' ? s : s + '.'; // fin de phrase sans doubler le point de « oct. »
export const e1rm = (kg, reps) => kg * (1 + reps / 30);
export const clone = o => JSON.parse(JSON.stringify(o));
export const rid = () => Math.random().toString(36).slice(2, 8);
export function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
export const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
export const nSeries = n => n + ' série' + (n > 1 ? 's' : '');
// Mois au format AAAA-MM : nom, mois voisins, et cases du lundi au dimanche (null hors du mois)
const MONTHS_LONG = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
export const fmtMonth = ym => { const p = ym.split('-').map(Number); return MONTHS_LONG[p[1] - 1] + ' ' + p[0]; };
export const addMonths = (ym, n) => { const p = ym.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
export function monthDays(ym){
  const p = ym.split('-').map(Number); const lead = (new Date(p[0], p[1] - 1, 1).getDay() + 6) % 7; const n = new Date(p[0], p[1], 0).getDate();
  const out = Array(lead).fill(null); for (let i = 1; i <= n; i++) out.push(ym + '-' + pad(i));
  while (out.length % 7) out.push(null);
  return out;
}
export const lowFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
// « 1er mars 2027 » : pour les dates d'objectif, souvent dans plusieurs mois
export const fmtDateYear = s => { const d = parseIso(s); return (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); };
// 2 450 : séparateur des milliers (espace fine insécable)
export const fmtInt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
// Texte comparable : sans accents ni majuscules, ponctuation remplacée par des espaces
export const norm = s => String(s == null ? '' : s).replace(/[œŒ]/g, 'oe').replace(/[æÆ]/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let toastT = null;
export function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); }
export function toggleIn(arr, v){ arr = (arr || []).slice(); const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); return arr; }
