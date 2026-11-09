// Petits graphiques SVG.
import { esc, fmtDate, fmtKg, iso } from './util.js';

function niceStep(span, n){ const raw = span / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
// Mini-courbe d'une case de chiffres (décorative : la valeur est écrite à côté)
export function spark(vals){
  if (vals.length < 2) return '';
  const W = 100, H = 28, mx = Math.max(1, ...vals); const X = i => (i / (vals.length - 1) * W).toFixed(1), Y = v => (H - 3 - v / mx * (H - 6)).toFixed(1);
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + vals.map((v, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(v)).join(' ') + '"/></svg>';
}
export function chart(series, o){
  o = o || {};
  const all = [].concat.apply([], series.map(s => s.pts));
  if (!all.length) return '<p class="empty">' + esc(o.empty || 'Pas encore de données.') + '</p>';
  const W = 340, H = o.h || 170, L = 40, R = 14, T = 12, B = 26;
  let x0 = Math.min.apply(null, all.map(p => p.x)), x1 = Math.max.apply(null, all.map(p => p.x));
  if (x0 === x1) { x0 -= 3 * 864e5; x1 += 3 * 864e5; }
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
    g += '<text x="' + (W - R) + '" y="' + (+y - 5) + '" text-anchor="end" style="fill:' + (o.threshColor || 'var(--bad)') + '">' + esc(o.threshLabel || '') + '</text>'; }
  g += '<text x="' + L + '" y="' + (H - 6) + '">' + esc(fmtDate(iso(new Date(x0)))) + '</text>';
  g += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(iso(new Date(x1)))) + '</text>';
  series.forEach((s, si) => {
    const pts = s.pts.slice().sort((a, b) => a.x - b.x); if (!pts.length) return;
    const c = s.color || 'var(--accent)';
    if (s.line !== false && pts.length > 1) {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
      if (si === 0 && o.area !== false) g += '<path d="' + d + ' L' + X(pts[pts.length - 1].x).toFixed(1) + ' ' + (H - B) + ' L' + X(pts[0].x).toFixed(1) + ' ' + (H - B) + ' Z" style="fill:' + c + '" fill-opacity="0.12"/>';
      g += '<path' + (s.color ? '' : ' class="ln"') + ' d="' + d + '" fill="none" style="stroke:' + c + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    pts.forEach((p, i) => { const last = i === pts.length - 1; g += '<circle' + (last && !s.color ? ' class="pt-last"' : '') + ' cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (last ? 4.5 : 2.8) + '" style="fill:' + c + '"/>'; });
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Graphique') + '">' + g + '</svg>';
}
