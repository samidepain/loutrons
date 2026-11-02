// Sauvegarde : export JSON et CSV, téléchargement ou menu de partage.
import { num, today } from './util.js';
import { S } from './store.js';
import { itemsOf, validSets, wName, workouts } from './data.js';

const EXPORT_TYPES = { json:'application/json', csv:'text/csv' };
export function exportFile(kind){
  // La sauvegarde porte déjà sa propre date : après une restauration, le rappel repart de là
  const docs = Object.fromEntries(S.docs); if (docs.settings) docs.settings = Object.assign({}, docs.settings, { lastExport: today() });
  const data = kind === 'json' ? JSON.stringify({ app:'carnet-muscu', version:4, exportedAt:new Date().toISOString(), docs }, null, 2) : toCsv();
  return new File([data], 'loutrons-' + today() + '.' + kind, { type:EXPORT_TYPES[kind] });
}
export function downloadFile(file){
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Téléphone ou tablette qui sait partager ce fichier : le menu de partage remplace le téléchargement
export function useShare(kind){
  try { return matchMedia('(pointer: coarse)').matches && !!(navigator.share && navigator.canShare && navigator.canShare({ files:[new File([''], 'test.' + kind, { type:EXPORT_TYPES[kind] })] })); } catch (e) { return false; }
}
function toCsv(){
  const rows = [['date','seance','exercice','serie','kg','reps','reserve']];
  workouts().forEach(w => { itemsOf(w).forEach(it => { const st = w.ex && w.ex[it.ex]; if (!st || it.kind === 'check') return; validSets(st.sets).forEach((x, i) => rows.push([w.date, wName(w), it.name, i + 1, it.kind === 'plyo' ? '' : String(num(x.kg) || 0), x.reps, st.rir == null ? '' : st.rir])); }); });
  return rows.map(r => r.map(v => { const s = String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
}
