// Pictogrammes dessinés par l'appli (trait de 2, couleur du texte) : onglets, rubriques du suivi du jour, repas, écrans d'explication.
export const ICONS = {
  today:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  training:'<svg viewBox="0 0 24 24"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  progress:'<svg viewBox="0 0 24 24"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>',
  food:'<svg viewBox="0 0 24 24"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3.5 4-3.5 8h3.5"/></svg>',
  person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  water:'<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  body:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 10a4 4 0 0 1 8 0M12 10l2-2.5"/></svg>',
  activity:'<svg viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
  pain:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  breakfast:'<svg viewBox="0 0 24 24"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/></svg>',
  dinner:'<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  snack:'<svg viewBox="0 0 24 24"><path d="M12 8c-2-2-7-1-7 4 0 4 3 8 5 8 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-8 0-5-5-6-7-4zM12 8c0-2 1-4 3-5"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};
// Pastille ronde avec son pictogramme (décorative : le texte à côté dit la même chose)
export const ic = name => '<span class="ic" aria-hidden="true">' + (ICONS[name] || '') + '</span>';
// Icône de chaque ligne du suivi du jour (clé de lineCard)
export const LINE_ICON = { eau:'water', corps:'body', activites:'activity', genou:'pain', douleurs:'pain' };
// Icône de chaque repas du journal
export const MEAL_ICON = { breakfast:'breakfast', lunch:'food', dinner:'dinner', snack:'snack' };
