// Écrans d'explication du premier lancement : tant qu'une rubrique n'a aucune donnée, elle dit à quoi elle sert et ce qu'on peut y faire.
// « C'est parti » les ferme pour de bon (settings.intro) ; dès qu'il y a une donnée, ils ne reviennent plus.
import { esc } from '../util.js';
import { S } from '../store.js';
import { settings, workouts } from '../data.js';
import { ic } from '../icons.js';
import { hasMeals } from '../food.js';

const INTROS = {
  today:{ icon:'today', title:'Aujourd’hui, ton point de départ', lead:'Chaque jour, tu retrouves ici ce qui compte, et rien d’autre.', items:[
    ['training', 'Ta séance du jour', 'Lance-la d’un geste : Loutrons te propose la suivante de ta rotation.'],
    ['food', 'Ton alimentation', 'Ce qu’il te reste à manger aujourd’hui, si tu suis ton alimentation.'],
    ['water', 'Ton suivi du jour', 'Eau, poids, sommeil, activités et douleurs : quelques secondes pour tout noter.'],
    ['person', 'Émile', 'Ton coach te donne un conseil à la fois, quand il est utile.']] },
  training:{ icon:'training', title:'Ton entraînement', lead:'Ici, tu prépares et tu fais tes séances de musculation.', items:[
    ['training', 'Séances', 'Un programme est déjà prêt : choisis une séance et lance-la, ou crée la tienne.'],
    ['activity', 'Pendant la séance', 'Tu notes chaque série (charge et répétitions) ; le repos se chronomètre tout seul.'],
    ['progress', 'Charges conseillées', 'Après chaque séance, Loutrons calcule la charge de la fois suivante.'],
    ['today', 'Exercices et planning', 'Plus de 140 exercices avec photos, et ta rotation de séances par semaine.']] },
  food:{ icon:'food', title:'Ton alimentation', lead:'Un journal simple pour savoir où tu en es, repas après repas.', items:[
    ['breakfast', 'Note tes repas', 'Petit-déjeuner, déjeuner, dîner, collations : cherche un aliment par son nom.'],
    ['food', 'Scanne les produits', 'Le code-barres donne les valeurs nutritives, et le produit reste sur ton téléphone.'],
    ['progress', 'Compare à ton objectif', 'Calories, protéines, glucides et lipides du jour, selon tes besoins.'],
    ['snack', 'Gagne du temps', 'Les repas que tu refais souvent se rajoutent d’un seul geste.']] },
  progress:{ icon:'progress', title:'Ta progression', lead:'C’est ici que tu vois ton travail s’accumuler.', items:[
    ['training', 'Tes records', 'Chaque exercice garde ta meilleure série et ton gain de force.'],
    ['activity', 'Ton rythme', 'Combien de séances et de séries par semaine, sur les dernières semaines.'],
    ['body', 'Ton corps', 'Courbes de poids et de sommeil, pour suivre ce qui change vraiment.'],
    ['water', 'Les bilans', 'Toutes les 6 semaines, un bilan de bloc avec des pistes pour la suite.']] }
};
// hasData : la rubrique contient déjà des données (rien à expliquer)
export function introCard(key){
  const i = INTROS[key];
  if (!i || !S.loaded || (settings().intro || {})[key]) return '';
  const has = key === 'food' ? hasMeals() : workouts().length > 0;
  if (has) return '';
  return '<section class="card hero intro"><span class="intro-ic" aria-hidden="true">' + ic(i.icon) + '</span><h2>' + esc(i.title) + '</h2><p class="muted">' + esc(i.lead) + '</p>'
    + '<ul class="intro-list">' + i.items.map(x => '<li>' + ic(x[0]) + '<span class="stack"><b>' + esc(x[1]) + '</b><span class="muted small">' + esc(x[2]) + '</span></span></li>').join('') + '</ul>'
    + '<button type="button" class="btn primary big" data-act="intro-ok" data-v="' + key + '">C’est parti</button></section>';
}
