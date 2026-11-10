// Balayer une ligne vers la gauche découvre « Supprimer », comme dans les applis iOS : un geste voulu, puis un toucher sur le bouton rouge.
// Structure : .sw > .sw-in (la ligne) + button.sw-del (derrière). Une seule ligne ouverte à la fois ; un nouvel affichage les referme.
const W = 92;
const rows = () => Array.from(document.querySelectorAll('.sw.open'));
export const swipeRow = (inner, act, v, label, extra) =>
  '<div class="sw"><div class="sw-in">' + inner + '</div><button type="button" class="sw-del" data-act="' + act + '" data-v="' + v + '"' + (extra || '') + ' aria-label="' + label + '" tabindex="-1">Supprimer</button></div>';

export function initSwipeRows(){
  let g = null; let mute = 0;
  document.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button > 0) return;
    const inn = e.target.closest('.sw-in'); const sw = inn && inn.parentElement;
    // Un toucher ailleurs referme les lignes ouvertes (sauf sur leur bouton : son clic fait la suppression)
    if (!e.target.closest('.sw-del')) rows().forEach(r => { if (r !== sw) r.classList.remove('open'); });
    g = sw ? { sw, inn, x0:e.clientX, y0:e.clientY, base: sw.classList.contains('open') ? -W : 0, drag:false, id:e.pointerId } : null;
  });
  document.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0; const dy = e.clientY - g.y0;
    if (!g.drag) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; } // c'est un défilement
      if (Math.abs(dx) < 8) return;
      g.drag = true; g.sw.classList.add('moving'); try { g.inn.setPointerCapture(e.pointerId); } catch (err) {}
    }
    g.pos = Math.max(-W * 1.25, Math.min(0, g.base + dx));
    g.inn.style.transform = 'translateX(' + g.pos + 'px)';
  });
  const end = e => {
    if (!g || e.pointerId !== g.id) return; const d = g; g = null; if (!d.drag) return;
    d.sw.classList.remove('moving'); d.inn.style.transform = '';
    d.sw.classList.toggle('open', e.type === 'pointerup' && d.pos < -W / 2);
    mute = Date.now() + 350;
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  // Le clic qui suit un glissement, ou qui touche une ligne ouverte, ne doit pas ouvrir la ligne : il la referme
  document.addEventListener('click', e => {
    const inn = e.target.closest('.sw-in'); if (!inn || !e.isTrusted) return;
    if (Date.now() < mute) { e.stopPropagation(); e.preventDefault(); return; }
    if (inn.parentElement.classList.contains('open')) { e.stopPropagation(); e.preventDefault(); inn.parentElement.classList.remove('open'); }
  }, true);
}
