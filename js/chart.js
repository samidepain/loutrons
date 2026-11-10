// Petits graphiques SVG.
import { esc, fmtDate, fmtKg, iso } from './util.js';

function niceStep(span, n){ const raw = span / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
export function chart(series, o){
  o = o || {};
  const all = [].concat.apply([], series.map(s => s.pts));
  if (!all.length) return '<p class="empty">' + esc(o.empty || 'Pas encore de données.') + '</p>';
  const W = 340, H = o.h || 170, L = 40, R = 14, T = 12, B = 26;
  let x0 = Math.min.apply(null, all.map(p => p.x)), x1 = Math.max.apply(null, all.map(p => p.x));
  // Un seul jour : on élargit l'axe pour poser le point, et on n'écrit que sa date
  const single = x0 === x1; if (single) { x0 -= 3 * 864e5; x1 += 3 * 864e5; }
  // La ligne de repère (thresh) reste visible : elle compte dans l'échelle
  const ys = all.map(p => p.y).concat(o.thresh != null ? [o.thresh] : []);
  let y0 = o.yMin != null ? o.yMin : Math.min.apply(null, ys);
  let y1 = o.yMax != null ? o.yMax : Math.max.apply(null, ys);
  if (o.yMin == null || o.yMax == null) { const span = (y1 - y0) || Math.max(1, Math.abs(y1) * 0.1); if (o.yMin == null) y0 = Math.max(0, y0 - span * 0.2); if (o.yMax == null) y1 = y1 + span * 0.2; }
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R);
  const Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const step = niceStep(y1 - y0, 3);
  let g = '';
  for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) {
    const y = Y(v).toFixed(1);
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--line)" stroke-width="1"/>';
    g += '<text x="' + (L - 6) + '" y="' + (+y + 4) + '" text-anchor="end">' + fmtKg(Math.round(v * 10) / 10) + '</text>';
  }
  if (o.thresh != null) { const y = Y(o.thresh).toFixed(1);
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + (o.threshColor || 'var(--bad)') + '" stroke-width="1.5" stroke-dasharray="4 4"/>';
    // Étiquette à gauche : la dernière valeur de la courbe s'écrit à droite et pouvait la recouvrir
    g += '<text x="' + (L + 4) + '" y="' + (+y - 5) + '" text-anchor="start" style="fill:' + (o.threshColor || 'var(--bad)') + '">' + esc(o.threshLabel || '') + '</text>'; }
  // Unité de l'axe en haut à gauche ; dates de début, de milieu (si la période dépasse 3 semaines) et de fin, avec l'année au-delà d'un an
  if (o.unit) g += '<text x="2" y="9">' + esc(o.unit) + '</text>';
  const lab = ms => fmtDate(iso(new Date(ms))) + (x1 - x0 > 300 * 864e5 ? ' ' + new Date(ms).getFullYear() : '');
  if (single) g += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lab((x0 + x1) / 2)) + '</text>';
  else g += '<text x="' + L + '" y="' + (H - 6) + '">' + esc(lab(x0)) + '</text>';
  if (!single && x1 - x0 >= 21 * 864e5) g += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lab((x0 + x1) / 2)) + '</text>';
  if (!single) g += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(lab(x1)) + '</text>';
  series.forEach((s, si) => {
    const pts = s.pts.slice().sort((a, b) => a.x - b.x); if (!pts.length) return;
    const c = s.color || 'var(--accent)';
    if (s.line !== false && pts.length > 1) {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      if (si === 0 && o.area !== false) g += '<path d="' + d + ' L' + X(pts[pts.length - 1].x).toFixed(1) + ' ' + (H - B) + ' L' + X(pts[0].x).toFixed(1) + ' ' + (H - B) + ' Z" style="fill:' + c + '" fill-opacity="0.12"/>';
      g += '<path' + (s.color ? '' : ' class="ln"') + ' d="' + d + '" fill="none" style="stroke:' + c + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    pts.forEach((p, i) => { const last = i === pts.length - 1;
      // Valeur du dernier point de la série principale, écrite au-dessus (à gauche du point s'il touche le bord)
      if (last && si === 0 && o.last !== false) g += '<text class="val" x="' + Math.min(X(p.x), W - 4).toFixed(1) + '" y="' + (Y(p.y) - 9).toFixed(1) + '" text-anchor="' + (X(p.x) > W - 40 ? 'end' : 'middle') + '">' + fmtKg(Math.round(p.y * 10) / 10) + '</text>';
      g += '<circle' + (last && !s.color ? ' class="pt-last"' : '') + ' cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (last ? 4.5 : 2.8) + '" style="fill:' + c + '"/>'; });
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Graphique') + '">' + g + '</svg>';
}
// Barres par semaine : items { label (début de semaine), v, open } ; `open` : semaine en cours, incomplète, tracée en pointillés
// (jamais comparée aux autres). Les valeurs s'écrivent au-dessus des barres jusqu'à 14 semaines ; au-delà, l'axe suffit.
let bid = 0;
export function bars(items, o){
  o = o || {}; const W = 340, H = o.h || 150, L = 28, R = 8, T = 16, B = 26; const id = 'bg' + (++bid);
  const mx = Math.max(o.min || 4, ...items.map(i => i.v)); const step = niceStep(mx, 3); const top = Math.ceil(mx / step) * step;
  const Y = v => T + (1 - v / top) * (H - T - B); const slot = (W - L - R) / items.length; const bw = Math.min(26, slot * 0.7);
  let g = (o.unit ? '<text x="2" y="9">' + esc(o.unit) + '</text>' : '') + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop class="s1" offset="0"/><stop class="s2" offset=".5"/><stop class="s3" offset="1"/></linearGradient></defs>';
  for (let v = 0; v <= top + 1e-9; v += step) { const y = Y(v).toFixed(1); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (+y + 4) + '" text-anchor="end">' + fmtKg(Math.round(v * 10) / 10) + '</text>'; }
  items.forEach((it, i) => {
    const cx = L + slot * (i + 0.5); const h = it.open ? Math.max(3, H - B - Y(it.v)) : Math.max(0, H - B - Y(it.v)); const y = H - B - h;
    if (it.v > 0 || it.open) g += '<rect class="' + (it.open ? 'bar-open' : 'bar-fill') + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4"' + (it.open ? '' : ' fill="url(#' + id + ')"') + '/>';
    if (items.length <= 14) g += '<text class="val" x="' + cx.toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle">' + fmtKg(it.v) + '</text>';
  });
  g += '<text x="' + (L + slot / 2) + '" y="' + (H - 6) + '" text-anchor="start">' + esc(fmtDate(items[0].label)) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(items[items.length - 1].label)) + '</text>';
  const desc = (o.label || 'Barres par semaine') + ' : ' + items.map(i => 'semaine du ' + fmtDate(i.label) + ', ' + fmtKg(i.v) + (i.open ? ' (en cours)' : '')).join(' ; ');
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(desc) + '">' + g + '</svg>';
}
