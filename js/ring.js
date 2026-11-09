// Anneau de progression (Dark Glow) : piste grise, arc en dégradé orange qui part du haut, contenu facultatif au centre.
import { esc } from './util.js';

let uid = 0; // chaque anneau a son dégradé (identifiants SVG uniques dans la page)
// v : avancement de 0 à 1 (borné) ; o : { label (lu par VoiceOver, sinon anneau décoratif), html (centre, déjà échappé), cls }
export function ring(v, o){
  const opts = o || {}; const p = Math.max(0, Math.min(1, Number(v) || 0)); const c = 2 * Math.PI * 50; const id = 'rg' + (++uid);
  const arc = p > 0 ? '<circle class="pg" cx="60" cy="60" r="50" stroke="url(#' + id + ')" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/>' : '';
  return '<span class="ring' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : ' aria-hidden="true"') + '>'
    + '<svg viewBox="0 0 120 120"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop class="s1" offset="0"/><stop class="s2" offset=".5"/><stop class="s3" offset="1"/></linearGradient></defs>'
    + '<circle class="tr" cx="60" cy="60" r="50"/>' + arc + '</svg>' + (opts.html ? '<span class="c">' + opts.html + '</span>' : '') + '</span>';
}
