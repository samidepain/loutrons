---
name: loutrons-frontend
description: Règles techniques et graphiques de Loutrons, PWA de musculation en HTML, CSS et JavaScript natifs (sans framework ni compilation), utilisée sur iPhone. À lire avant toute modification d'interface dans ce projet - nouvel écran, carte, formulaire, bouton, animation, couleur, texte affiché, correction visuelle ou d'accessibilité. Ces règles priment sur les compétences de design génériques (frontend-design, ui-ux-pro-max, web-design-guidelines) quand elles se contredisent.
---

# Loutrons : interface

Loutrons s'utilise à la salle, d'une main, entre deux séries, souvent sans réseau. Chaque écran doit être lisible d'un coup d'œil, se toucher au pouce et répondre tout de suite. Il doit aussi ressembler au reste de l'appli : mêmes composants, mêmes couleurs, même ton.

Le `CLAUDE.md` à la racine décrit l'architecture, le modèle de données et l'historique. Ce document dit **comment construire l'interface**.

## 1. Priorité des règles

1. **L'architecture ne change pas.** On garde HTML, CSS et JavaScript natifs, des modules ES chargés tels quels, aucun framework, aucun bundler, aucune dépendance npm dans l'appli, GitHub Pages, IndexedDB et le service worker.
2. **Les compétences de design génériques sont des sources d'idées, pas des règles.** On ignore ce qu'elles proposent quand cela contredit ce document, en particulier :
   - Tailwind, shadcn, React ou d'autres composants à installer ;
   - une police ou une palette nouvelle ;
   - une icône chargée depuis un CDN ;
   - des images générées par une IA ;
   - un « style » complet à appliquer, comme le glassmorphisme ou le néomorphisme (le verre de Loutrons est limité à trois éléments, voir la section 5).
3. **On réutilise avant de créer.** On ajoute un composant seulement si aucun composant existant ne convient (voir la section 6).
4. **On ne change jamais une fonctionnalité au passage.** Une retouche visuelle ne modifie ni les calculs, ni les données, ni les textes des sources scientifiques.

## 2. Avant d'écrire du code

- Lire le fichier de l'écran concerné dans `js/views/`, puis les actions qu'il utilise dans `js/actions.js` (objet `A`).
- Repérer dans `index.html` les classes déjà utilisées par des écrans voisins.
- Lister les états à dessiner, pas seulement le cas idéal :
  - premier lancement, stockage vide ;
  - liste vide ;
  - valeur inconnue (`null`) ;
  - texte très long, comme un nom de produit Open Food Facts ;
  - sans connexion ;
  - module désactivé (genou, détente, sport) ;
  - suivi de l'alimentation activé ou non ;
  - séance en cours ;
  - thème clair et thème sombre.
- Se demander ce que la personne veut faire en premier sur cet écran. Cette action doit être la plus visible et la plus facile à toucher.

## 3. Mobile d'abord, iPhone en priorité

- **Largeurs** :
  - référence à 390 px (iPhone 12 à 16) ;
  - rien ne doit casser à 320 px (iPhone SE de 1re génération) ;
  - le contenu ne s'élargit pas au-delà de 640 px (`main`, `.top-in`, `.tabs-in`).
- **Aucun défilement horizontal** de la page :
  - mettre `min-width:0` sur les enfants de grilles et de flex ;
  - utiliser `overflow-wrap:anywhere` pour les noms longs ;
  - utiliser `.scroll` seulement pour un tableau.
- **Zones de sécurité** : l'appli installée s'affiche sous l'encoche et au-dessus de la barre d'accueil.
  - Tout élément fixe ou collant tient compte de `env(safe-area-inset-top)` et de `env(safe-area-inset-bottom)`, comme `.top`, `.tabs`, `.restbar` et `.toast`.
  - Le bas de `main` laisse la place à la barre d'onglets (`--tabs-h`), au minuteur de repos et à la zone de sécurité.
- **Cibles tactiles** :
  - 44 × 44 px au minimum pour toute action (`.btn`, `.fld`, champs `.f`) ;
  - les quelques exceptions existantes (`.btn.sm` et `.link` à 36 px, `.emile-x` à 32 px) ne doivent pas servir de modèle pour une action importante ;
  - les grilles de 7 jours (`.days`, calendrier) font environ 31 px de large à 320 px : c'est accepté, elles gardent 44 px de haut ;
  - au moins 6 px entre deux cibles.
- **Saisie** :
  - champs en 16 px ou plus, sinon Safari zoome sur la page ;
  - `inputmode="numeric"` ou `inputmode="decimal"` pour les nombres, lus avec `num()` qui accepte la virgule ;
  - `type="date"` pour les dates ;
  - `type="search"` pour les recherches ;
  - jamais `user-scalable=no`.
- **Pas de survol** : aucune information ni action ne doit dépendre de `:hover`. Un appui se voit grâce à `:active` (voir la section 7).
- **Mode installé, sans barre de Safari** : il n'y a pas de bouton « Précédent » du navigateur. Tout écran poussé a donc son bouton de retour (section 4).
- **Pouce** :
  - l'action principale d'un formulaire est en bas, en `.btn.primary.big` (pleine largeur) ;
  - les actions destructrices sont à part, en `.btn.danger` ou `.btn.ghost`, avec une confirmation (`S.confirm`).
- **Clavier ouvert** : vérifier qu'aucun élément fixe ne cache le champ en cours de saisie.

## 4. Navigation

Toute la navigation passe par `render()`, puis `navigate(paint)` dans `js/nav.js`. On ne remplace jamais `#app` à la main et on ne crée pas d'animation d'écran ailleurs.

- **Un écran est un état de `S`.**
  - `paint()` dans `js/render.js` choisit la vue.
  - `screenOf()` dans `js/nav.js` décrit l'écran affiché : `key` (unique), `level` (profondeur), `tab` (onglet du premier niveau), `from` (écran d'origine), `sheet` (fenêtre qui monte du bas) et `sub` (rang parmi des écrans voisins).
- **Ajouter un écran** :
  1. lui donner un état dans `S` (`js/store.js`) ;
  2. l'afficher dans `paint()` ;
  3. le décrire dans `screenOf()`. L'animation en découle toute seule :
     - niveau plus profond : poussé depuis la droite ;
     - niveau moins profond : retour vers la droite ;
     - fenêtre (`sheet`) : monte du bas et redescend ;
     - autre onglet : fondu ;
     - sous-onglet ou jour voisin : léger glissement.
- **Choisir le bon type d'écran** :
  - **écran poussé** : on consulte quelque chose de plus détaillé (fiche, bilan, profil) ;
  - **fenêtre** : on fait une tâche qu'on termine ou qu'on annule (ajouter, modifier, choisir). Elle a « Annuler » en haut à gauche et l'action principale en bas.
- **Retour** :
  - tout écran poussé a en haut à gauche un bouton `‹ <écran d'avant>` avec l'attribut `data-back` ;
  - ce bouton permet aussi le geste de retour depuis le bord gauche ;
  - le texte nomme l'écran où l'on revient, par exemple « ‹ Aujourd'hui ».
- **Imposer une animation** : `S.navHint = 'up' | 'down' | 'fade'` juste avant `render()`, seulement quand la règle par défaut ne convient pas.
- **Position de défilement** :
  - chaque écran la retrouve au retour ;
  - toucher l'onglet affiché remonte en haut ;
  - ne pas appeler `scrollTo` après `render()`, sauf pour amener la personne vers un élément précis.
- **Onglets** :
  - Aujourd'hui, Entraînement, Alimentation (seulement si le suivi est activé) et Progrès ;
  - le profil s'ouvre avec le rond en haut à droite ;
  - un nouvel écran trouve sa place dans cette structure, il n'ajoute pas d'onglet.
- **Où sont les choses** (version 2.8, séance en 2.9) :
  - **Aujourd'hui**, dans l'ordre : salut selon l'heure, date et bloc (version 3.9) ; la séance du jour (prévue, en cours, faite, ou jour de repos ou de sport) ; « Ta semaine » (jours en nom court, `shortName()` ; toucher un jour ouvre l’écran de ce jour, `S.day`, poussé comme une fiche : séance, activités à consulter, modifier, supprimer avec confirmation (`act-ask-del`) et ajouter ; le retour garde la semaine ou le mois et le jour choisi ; seul « Voir le mois » ouvre le mois) ; « Ton alimentation » si le suivi est activé ; un seul conseil d'Émile (replié en une ligne avec son titre, sauf les alertes de rang 2 ; `S.emileOpen`), puis le record des 7 derniers jours s'il y en a un (carte dorée) ; « Ton suivi du jour » en lignes compactes (eau, poids et sommeil — une pesée toutes les 2 semaines, avec rappel d’Émile —, activités, douleurs : une ligne `painLine()` pour le genou et les zones choisies). Le haut tient sans défilement à 390 × 844 : ne rien ajouter au-dessus du conseil d'Émile ;
  - **Entraînement › Séances** : « Ton programme » (changer de programme, changer la rotation) et les séances ; **› Exercices** : la liste, et les exercices masqués tout en bas ; **› Planning** : « Ta rotation », « Prévoir tes séances », « Cette semaine » (semaine chargée, décharge anticipée), « Réglages de l'entraînement » (début du programme, options genou, détente et sport, jours de sport) ;
  - **Profil** : en-tête (initiale, ancienneté, 3 chiffres), « Toi » et « Ton alimentation » en lignes de réglage (`p-…`, dont `p-act` et `p-goal` ; « Modifier » depuis Aujourd'hui ouvre `p-goal`), apparence, tes données, La science, et une ligne vers les réglages de l'entraînement ;
  - **fiche d'un exercice** : ouverte depuis Entraînement › Exercices ou Progrès › « Tes exercices » ; `S.ficheFrom` (`'exercices' | 'progress'`) nomme le retour.
  - **séance en cours** (Entraînement) : un seul exercice ouvert (ou un superset), les autres repliés en lignes ; `sessionFocus(w, { open, ask })` (`js/data.js`) dit lesquels sont ouverts, quelle série est en cours et si la question des reps en réserve attend ;
  - **« Voir le mouvement »** : fenêtre (`S.move`, `sheet:'move'`) ouverte depuis l'exercice ouvert ; le même bloc est dans la fiche ;
  - **Planning** (version 2.13) : « Ta rotation » (`.rot-row` : rang, nom, ↑ ↓ en `button.step`, case « Dans la rotation »), « Séances par semaine », « Prévoir tes séances » (`.days` > `button.plan-chip`, jours passés désactivés), puis « Cette semaine » et les réglages ; Aujourd'hui propose `plannedSessions()[jour] || nextSession()` ;
  - **Alimentation** (version 2.11) : un repas vide montre « Comme hier » et son premier habituel ; la fenêtre d'ajout, recherche vide, montre « Refaire un repas », « Tes repas », « Tes habituels au … » et « Récents » ; « Enregistrer ce repas » (2 aliments au moins) ouvre `S.food.mode = 'save-meal'`, le détail d'un repas enregistré `S.food.mode = 'meal'`.
- **États d'affichage d'Aujourd'hui** (non enregistrés) : `S.todayOpen` (ligne compacte ouverte, une seule) et `S.emileMore` (autres conseils affichés).
- **États d'affichage de la séance** (non enregistrés, remis à zéro au début, à la fin et à l'abandon) : `S.sessOpen` (exercice ouvert à la main), `S.rirAsk` (exercice qui attend ses reps en réserve), `S.setEdit` (`{ ex, i }`, série faite en correction), `S.move` (exercice de « Voir le mouvement »). Après une validation, `showCurrent()` (`actions.js`) garde `#cur` visible au-dessus du minuteur.

## 5. Identité graphique

**Ambiance** (version 3.0, « Dark Glow ») : une salle éteinte avec un seul spot orange. Noir pur, orange vif, blanc. La lumière vient d'un endroit précis et éclaire ce qui compte maintenant : la prochaine séance, la série en cours, une réussite. Trois principes :
- **une source de lumière par écran** : la lumière forte ne va qu'à un seul élément ;
- **la lumière se mérite** : elle signale une action, un état en cours ou une réussite, jamais un décor ;
- **le gris est une matière** : les blocs ont un léger dégradé et un reflet d'un pixel, pas un aplat ni une bordure.

**Couleurs** : toujours par les variables de `:root`, jamais en dur. Les contrastes de texte sont vérifiés à 4,5:1 dans les deux thèmes.

| Variable | Rôle | Sombre | Clair |
|---|---|---|---|
| `--bg` | fond de l'écran (version 3.8 : noir légèrement profond, le noir pur `#000000` reste pour `--well`) | `#0B0B0D` | `#F5F5F4` |
| `--surface` | blocs à plat (ligne d'exercice repliée) ; les cartes utilisent `--card-top` → `--card-bot` | `#141414` | `#FFFFFF` |
| `--surface-2` | champs, boutons gris, puces, lignes de liste, statistiques, jours du calendrier | `#1F1F1F` | `#EDEDEB` |
| `--well` | contrôle posé dans un bloc déjà en `--surface-2` (`.item`, `.target`, `.cur-set`, bulle d'Émile dans une carte) | `#000000` | `#FFFFFF` |
| `--line` | séparateurs, appui sur une ligne de liste | `#2E2E2E` | `#DEDEDB` |
| `--ink`, `--muted` | texte principal ; texte secondaire et étiquettes | `#FFFFFF`, `#A3A3A3` | `#0A0A0A`, `#5C5C5C` |
| `--accent`, `--on-accent` | orange : action principale, élément actif, minuteur ; texte posé sur l'orange | `#FF7A1A`, `#000000` | `#FF7A1A`, `#000000` |
| `--accent-ink` | orange en texte : liens, « Annuler », onglet actif, titre du superset ; aussi les contours d'état (ligne choisie, champ en saisie, aujourd'hui dans le calendrier), pour garder 3:1 sur les gris clairs | `#FF7A1A` | `#A84300` |
| `--accent-soft` | fond orangé léger (`.pill.acc`) | `#331A05` | `#FFE8D6` |
| `--court`, `--court-soft` | repère secondaire neutre (gris) : `.pill.court`, `.chip.sec.on`, barre de l'eau, repère des barres | `#D4D4D4`, `#1F1F1F` | `#3D3D3D`, `#EDEDED` |
| `--good`, `--warn`, `--bad` (+ `-soft`) | réussite, prudence, alerte | | `--good` `#186B3C` en clair |
| `--shade` | voile sous un écran ou une fenêtre | | |
| `--fam-salle`, `--fam-cardio`, `--fam-collectif`, `--fam-autre` | couleur d'une famille d'activité dans le calendrier (points `.mk`) | `#FF7A1A`, `#4DA3FF`, `#B48CFF`, `#D4D4D4` | `#A84300`, `#1F6FD1`, `#7B3FD6`, `#3D3D3D` |
| `--grad-fire` | dégradé de l'orange (ambre `#FFB347` → orange `#FF7A1A` au centre → braise `#FF4D00`) : bouton principal, sélection, barres, rond du profil | identique | identique |
| `--card-top`, `--card-bot`, `--card-sh` | matière des cartes : dégradé vertical, reflet d'un pixel (sombre) ou ombre douce (clair) | `#171717` → `#111111` | blanc, ombre douce |
| `--edge`, `--ambient` | carte vedette : liseré dégradé et lumière ambiante en haut à droite | | |
| `--glow-1`, `--glow-2`, `--glow-3` | les trois niveaux de lumière (voir plus bas) | halos orange | ombres colorées douces |
| `--glass`, `--glass-line` | verre : en-tête et barre d'onglets (puis minuteur) | `rgba(24,24,24,.62)` | `rgba(255,255,255,.72)` |
| `--halo` | lumière de la salle en haut de chaque écran (`body` et `.nav-top`) | orange 8 % | orange 7 % |

- L'orange signale **ce qu'on peut faire ou ce qui est en cours**. On n'en met pas partout : un écran a une seule action principale `.btn.primary`.
- Le gris neutre (`--court`) sert aux repères secondaires. Les liens et consignes à déplier sont en `--accent-ink`.
- Les couleurs d'état (`good`, `warn`, `bad`) servent uniquement à des états réels : séance faite, prudence, erreur.
- Dans un bloc déjà en `--surface-2` (`.item`, `.target`, `.stat`, `.cur-set`), les contrôles prennent le fond `--well`, sinon ils disparaissent.
- **La sélection est toujours orange** : `.chip.on`, `.cday.sel` (dégradé `--grad-fire`, texte `--on-accent`, `--glow-2`), `.pick.on` (contour `--accent-ink` et `--glow-2`). Plus de blanc plein pour dire « choisi ». Exceptions : `.chip.on.hi` (douleur forte, rouge) et `.chip.sec.on` (gris, repère secondaire).

**Trois niveaux de lumière** (`box-shadow`, jamais sur du texte) :

| Niveau | Où | Règle |
|---|---|---|
| Fort, `--glow-3` | grand bouton principal (`.btn.primary.big`) ; plus tard : record, objectif atteint, fin de séance | **un seul par écran visible** |
| Intermédiaire, `--glow-2` | ce qui est choisi ou en cours : puce, ligne, jour choisi | quelques-uns au plus |
| Discret, `--glow-1` | barres de progression, rond du profil, avatar d'Émile, trait de l'onglet actif, petit bouton principal | décor de repère |

En clair, les lumières deviennent des ombres colorées douces : elles gardent la hiérarchie sans halo.

**Lumière maîtrisée** (version 3.8) : la lumière attire le regard, elle n'est jamais le sujet. Les trois niveaux ont été adoucis (halos plus courts et moins opaques, liseré `--edge` et lumière `--ambient` divisés par deux environ, `--halo` à 8 %).
- Pas de lumière sur un élément décoratif ou d'identité : rond du profil (`.me`), avatar d'Émile, icônes, cartes ordinaires.
- Pas de contour orange lumineux systématique : un contour orange dit « choisi » ou « en saisie », rien d'autre.
- Pas de nouvelle ombre orange en dur : on passe toujours par `--glow-1` à `--glow-3`, pour régler toute l'appli d'un seul endroit.

**Échelles** (version 3.8, bloc `:root` commun aux deux thèmes, après les blocs de couleurs) :

| Famille | Variables |
|---|---|
| Espacements | `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32 px |
| Rayons | `--r-sm` 12, `--r-md` 16, `--r` 20 (cartes), `--r-pill` 999 px |
| Texte | `--t-hero` 36, `--t-h1` 28, `--t-h2` 20, `--t-h3` 18, `--t-body` 17, `--t-small` 15, `--t-cap` 13 px |
| Mouvement | `--ease` (courbe d'iOS), `--dur-tap` 140 ms, `--dur-state` 240 ms, `--dur-win` 650 ms ; appui `--press` (.96) et `--press-sm` (.93) |
| États | `--dim` (.45) : opacité d'un contrôle désactivé |

Un nouveau composant les utilise ; les anciens règles passent dessus au fil des refontes d'écran, sans tout réécrire d'un coup.

**Typographie** : Archivo (un seul fichier `fonts/archivo.woff2`, 37 Ko, graisse 800, largeur 62 à 125 %) et la police du téléphone (SF Pro sur iPhone).

| Usage | Police | Tailles |
|---|---|---|
| Titres (`h1`, `h2`, `h3`), « LOUTRONS », nom de la séance du jour (`.plan .name`) | `--f-display`, `font-stretch:125%` (très large) | h1 28, h2 20, h3 18 ; `.plan .name` 36 |
| Chiffres (`.num`, `.clock`, `.fld input`, `input.n`, `.chip`) et noms d'exercices (`.exname`, `.hitem .n`) | `--f-display`, `font-stretch:100%` | tailles du composant ; noms d'exercices 20 (19 sous 360 px) |
| Grands chiffres des cases (`.stat .v`) | `--f-display`, `font-stretch:70%` ; unité en `small`, police du téléphone, grise | 32 (26 sous 360 px) |
| Nom de séance dans une case du calendrier (`.cday .s`) | `--f-display`, `font-stretch:62%` (étroite) | 12 |
| Texte, boutons, champs | `--f-body` : police du système | 17 (texte), 15 (`.small`, étiquettes en demi-gras), 13 au moins (mentions) ; 12 pour les onglets |

- **Chiffre très gros, unité petite et grise** (« 1 840 <small>kcal</small> ») : c'est le trait le plus fort de l'identité.
- Pas de capitales espacées : seul « LOUTRONS » est en capitales (un test le vérifie). Les étiquettes s'écrivent avec une majuscule au début.
- Les chiffres qu'on compare (charges, reps, minutes, kcal) sont en `font-variant-numeric:tabular-nums` ; les chiffres d'Archivo ont tous la même largeur.
- Les titres longs passent à la ligne proprement grâce à `text-wrap:balance`, déjà appliqué aux titres.
- Archivo est plus large que l'ancienne police étroite : vérifier les champs de série et les cases du calendrier à 320 px (règles `@media (max-width:360px)` dans les sections Séance et Calendrier).

**Formes et espacements** :
- Rayons : `--r` (20 px) pour les cartes et les messages ; 12 à 16 px pour les champs, lignes de liste, statistiques ; 999 px (pilule) pour les boutons, puces, pastilles et barres.
- Blocs, boutons, champs et puces sans bordure : on les distingue par leur fond. Seule la carte vedette (`.card.hero`, `.plan`) a un liseré d'un pixel, en dégradé. Un état (choisi, saisie en cours, exercice terminé) se montre par un contour intérieur (`box-shadow:inset 0 0 0 2px`) et, pour une sélection, par la lumière `--glow-2`.
- Espacements sur la grille 2, 4, 6, 8, 10, 12, 16 px. On utilise `gap` plutôt que des marges : 16 entre cartes, 12 dans une carte, 6 à 10 dans une rangée.
- Ombres noires rares : seulement pour un élément qui flotte au-dessus du reste (minuteur, calques de navigation). Les ombres orange sont les lumières, réglées par les trois niveaux.
- **Verre** (`--glass`, flou de 18 px) : seulement ce qui flotte au-dessus du contenu, c'est-à-dire l'en-tête, la barre d'onglets et le minuteur de repos. Jamais sur une carte ni un champ : un chiffre doit rester lisible à la salle. Sans `backdrop-filter`, le fond redevient opaque (`@supports`).
- **Une carte vedette par écran** (`.card.hero`, `.plan` sur Aujourd'hui) : liseré `--edge` et lumière `--ambient` en haut à droite. Sur les autres écrans, on la réserve à ce que la personne doit faire maintenant.
- Un bloc gris posé directement sur le fond de l'écran (sous-onglets `.seg`, `.stats` hors carte) prend la matière des cartes, sinon il disparaît sur le fond clair.

**Marque et mascotte** :
- « LOUTRONS » en majuscules dans l'en-tête, « Loutrons » dans les phrases. Depuis la version 3.6, la barre « LOUTRONS » n'apparaît que sur Aujourd'hui et l'accueil : ailleurs (`body.brandless`, posé par `paint()`), le titre de l'écran sert d'en-tête et le rond du profil flotte en haut à droite (le premier élément de `#app` garde 48 px à droite pour lui) ; dans une fenêtre qui monte du bas (`body.in-sheet`), pas de rond du profil.
- Le logo est dans `icons/logo.png` : la loutre et sa barre sur fond noir, sans anneau ni halo dans l'en-tête (version 2.6). Une lumière ambiante douce (`--ambient`) derrière Émile est permise seulement dans les états vides et les réussites (validé en version 3.0). Source : `icons/source/logo-loutrons-simple.png`, tirée de l'original `icons/source/logo-loutrons.webp`. On ne le redessine pas.
- **Émile** signe les conseils (`emile()` dans `js/emile.js`) :
  - il appelle la personne « loutron », « loutronne » ou par son prénom (`hey()`, `callName()`) ;
  - ses conseils sont calculés par des règles et restent courts ;
  - il a une croix pour fermer, avec une clé qui décrit la situation : `emile(body, { key })` ;
  - les objectifs de chaque exercice restent des calculs sans signature ;
  - **seulement les deux images existantes** : `icons/logo.png` (Émile en pied) et `icons/emile.png` (son visage). On peut les animer en entier (déplacement, échelle, opacité), jamais les redessiner. Les images d'ambiance (dossier `design_glow/`, hors dépôt) ne sont pas des assets. De nouvelles poses ne peuvent venir que de la personne, dans le style exact du logo ;
  - sur Aujourd'hui, un seul conseil à la fois : `emileQueue([{ rank, html }])` garde le plus important (1 : demande une réponse ; 2 : alerte ; 3 : sauvegarde ; 4 : rappel ; 5 : message de la semaine) et range les autres derrière « N autres conseils ».

## 6. Composants existants (`index.html`)

À utiliser tels quels. Chercher le nom de la classe dans `js/views/` pour voir un exemple réel.

| Besoin | Composant |
|---|---|
| Bloc de contenu | `section.card` (matière `--card-top` → `--card-bot`, reflet `--card-sh`, sans bordure ; `.card.flat` transparent) ; `.card.welcome` centré ; carte vedette `.card.hero` (et `.plan`, la séance du jour) : liseré `--edge`, lumière `--ambient`, une par écran |
| Mise en page | `.row` (horizontal, passe à la ligne), `.between`, `.stack` (vertical) |
| Action | `.btn` (pilule grise) ; `.primary` (dégradé `--grad-fire`, une par écran ; lumière forte en `.big`) ; `.ghost` (texte orange) ; `.danger` (texte rouge) ; `.big` (pleine largeur, 52 px, en bas) ; `.sm` |
| Lien discret, « Annuler », « ‹ Retour » | `button.link` |
| Choix dans une liste (programme, aliment, activité) | `button.pick` avec `.n` (nom) et `.m` (précision) ; `.on` sélectionné ; `.static` non cliquable ; `.planned` prévu |
| Choix court ou nombre (jours, reps en réserve, douleur 0-10) | `.chips` > `button.chip` (`.txt` pour du texte, `.on`, `.sec`, `.hi`) ; `.days` pour 7 jours ; `.seg` pour des sous-onglets qui défilent |
| Champs de formulaire | `.fields` (grille) > `label.f` > `span` + `input` (classe `.n` pour un nombre, aussi hors de `label.f`) ; champs remplis sans bordure, contour orange pendant la saisie |
| Exercice replié dans la séance | `button.pick.ex-line` (`data-act="ex-open"`) > `.exl` > `.n` + `.m` (« 0/3 · 49,5 kg × 6 », « ✓ 3/3 ») ; exercice ouvert : `section.card.ex.open[data-ex]` |
| Série en cours (une seule à l'écran, `#cur`) | `.cur-set` (vedette de la séance : liseré `--edge`, lumière ambiante ; − et + de 48 px, chiffres en 26 px) > `.stepper` × 2 (`.st-lab`, `button.step` − et + avec `data-act="step"` et `data-f="kg" | "reps"`, `.fld`), puis `.btn.primary.big` « Valider la série N » ; valeur ± palier avec `stepValue()` (`util.js`) |
| Séries faites et à venir | `.set-line` : `.done` (bouton, `data-act="set-edit"` pour corriger) ou `.next` (grisée) ; `.sn`, `.sl-v`, `.sl-ok` ; `.flash` sur la série tout juste validée (`S.justDone`, remis à `null` après l'affichage) ; `.pr` (version 3.16) : série record de l'exercice (`prSet()`, `engine.js`, même règle que `findPRs`), trophée doré `.trophy.xs` et « Record » à la place de la coche, annoncée par `toast()` à la validation |
| Séance de la liste (Entraînement › Séances) | `section.card.tpl` > `h2.tpl-name` ; la prochaine de la rotation (`nextSession()`) en premier, en `.card.tpl.hero` avec « Commencer » en `.btn.primary` ; « + Créer une séance » en bas, en gris |
| En-tête et fin de la séance en cours (version 3.16) | `.sess-head` > `.sess-top` (nom, chrono) + `.sess-prog` (barre décorative, compteur « 3/22 ») + semaine ; « Terminer la séance » avec des séries non validées demande `S.confirm = 'finish'` (`finish-yes`, `finish-no`) ; « Retirer la dernière » seulement si la dernière série n'est pas validée |
| Fin de séance (fenêtre, `S.summary.screen`, `sheet:'end'`) | `viewEnd()` (`views/session.js`) : `.end` > `.end-top` (anneau des séries, nom), `.stats`, effort, records, `.end-emile` (logo, lumière douce), « Retour à Aujourd'hui » (`close-summary`) ; `.end.enter` seulement au premier affichage (`S.summary.enter`) |
| Records sur l'historique (version 3.4) | `recordLog()` (`engine.js`, sans stockage) ; Progrès › « Tes records » : `.card.gold` > `.rec-line` (5 derniers) ; sans record, une bulle d'Émile ; Historique : `.hist-pr` (petit trophée doré) |
| En-tête du profil (version 3.5) | `.prof-head` > `.prof-ini` (initiale, dégradé lumineux) + prénom en `h1` et ancienneté (`settings.created`, sinon première séance, sinon début du programme), puis `.stats` (séances, semaines, records) |
| Réglage du profil | `lineCard('p-…', nom, valeur, '', champ)` : le champ n'existe que ligne ouverte (`S.todayOpen`) et s'enregistre à la sortie du champ (`change`), comme avant |
| Choix de l'apparence | `.theme-picks` > `button.theme-pick` (`.on`, `aria-pressed`) > `.tp.tp-auto | tp-light | tp-dark` (aperçu aux couleurs fixes des thèmes) |
| Importer un fichier | `label.btn.file-btn` > `input[type=file]` invisible par-dessus (reste focalisable : contour sur `:focus-within`) |
| État vide d'un écran | `section.card.empty-state` : logo `img.end-logo` (lumière douce), titre, phrase, action principale (ex. Progrès sans séance) |
| Courbe | `chart()` (`chart.js`) : la série principale (sans `color`) est lumineuse (`.ln`, dernier point `.pt-last`) ; mini-courbe d'une case : `spark(valeurs)` (décorative) |
| Record, réussite | `.card.gold` (liseré `--edge-gold`, lumière `--ambient-gold`, titre en `--gold-ink`) avec `.trophy` (rond `--grad-gold`, `--glow-gold`) ; l'or est réservé aux records |
| Question des reps en réserve | `.cur-set.rir-ask` > `.rir-q`, `.chips` en grille de 5 > `.rir-c` (puce, et `.vise` sous la valeur visée), `button.link` « Passer la question » |
| Photos du mouvement et silhouette en grand | `movementBlock(e, { cue })` (`js/views/movement.js`) : `.mv` > `button.mv-photos` (alternance en CSS, `.mv.paused` la fige), `.mv-cap`, puis `bodyMap(m)` (`.bodymap.big` et `.legend.big`) ; moins d'animations : `.photos` côte à côte |
| Raccourci qui ajoute d'un geste (habituel, repas passé, repas enregistré) | `.quick` > `.pick` (`.ql` > `.n` + `.m` ; `data-act="fd-open"` ou `fd-saved` pour un aliment ou un repas enregistré, `.pick.static` pour un repas passé) + `button.plus` rond de 44 px (`aria-label` « Ajouter … ») ; groupes de la fenêtre : `.qgroup` > `.label` ; `quickFood()`, `quickPast()` dans `js/views/food.js` |
| Aliments d'un repas enregistré | `.sm-list` > `p.sm-item` (nom, puis quantité et kcal) |
| Saisie du cardio pendant la séance | `.setrow.cardio` > `.sn`, `.fld` (champ et unité) |
| Case à cocher avec explication | `label.toggle` |
| Petite information d'état | `.pill` (`.good`, `.warn`, `.bad`, `.acc`, `.court`) |
| Ligne compacte d'Aujourd'hui (nom, valeur, geste rapide, détail ouvert sur place) | `lineCard(clé, nom, valeur, bouton, détail, repère)` (repère facultatif avant la valeur, comme l'anneau `.xxs` de l'eau) dans `js/views/activity.js` : `section.card.line` > `.line-row` > `button.line-h[data-act="today-open"]` |
| Familles d'un jour dans le calendrier | `.mks` > `i.mk.fam-<famille>.<état>` (`done` plein, `planned` anneau, `active` point entouré), d'après `dayFamilies(day)` |
| Message dans la page | `.alert` (`.warn`, `.good`, `.info`) |
| Conseil | `emile(html, { title, tone, key })` : bulle teintée selon le ton (orange par défaut, `good` vert, `warn` ambre, `bad` rouge, variable `--tint`) et avatar cerclé de la même couleur |
| Confirmation brève après une action | `toast('…')` (`js/util.js`) |
| Chiffres clés | `.stats` > `.stat` > `.v` + `.l` ; `.stats.needs` sur 2 colonnes |
| Barre de progression | `.bar > i` (fine) ; `.mbar > i` (+ `b` pour un repère) dans `.mrow` |
| Anneau de progression (version 3.1) | `ring(v, { label, html, cls })` dans `js/ring.js` : piste grise, arc en dégradé lumineux, contenu au centre (`.c`) ; tailles `.ring` 132 px, `.sm` 64, `.xs` 46, `.xxs` 22 ; sans `label`, il est décoratif (le texte voisin dit la valeur). À côté d'un texte : `.ring-row` |
| Grand chiffre et son unité | `.kcal` > `.v.num` + `small` (unité grise) |
| Journée du journal (Alimentation, version 3.3) | `section.card.hero.day-card` : anneau `.ring.md` (reste à manger au centre ; `.empty` : piste en pointillés et « Rien de noté », jamais « 0 » ; `.over` : arc en ambre au-delà de 110 %), `.macros` (3 × `.macro` : anneau `.xs` décoratif, nom, valeur sur l'objectif ; lipides `.over` au-delà du plafond), le reste sous `details.cue` « Détails » |
| En-tête d'un repas | `.meal-h` > `.stack.meal-t` (nom, kcal dessous) + `button.plus` (`fd-add`) |
| Recherche avec scanner | `.fd-search` > `input[type=search]` (52 px, 17 px) + `.btn.primary.scan-btn` (carré orange lumineux, icône en SVG, `aria-label`) |
| Tableau | `.scroll > table.tbl` |
| Détail repliable | `details.cue > summary` |
| Groupe (superset) | `.group > .gh` |
| Objectif calculé | `.target` |
| Liste vide | `p.empty` |
| Chargement | `p.loading` (petit cercle orange qui tourne, figé si « Réduire les animations ») |
| États communs | désactivé : opacité `--dim` (`.btn`, `.chip`, `.pick`, `.step`, `button.plus`, champs) ; survol : seulement à la souris (`@media (hover:hover) and (pointer:fine)`), jamais nécessaire ; appui : `--press` ; erreur et réussite : `.alert.bad` / `.alert.good`, `toast()` pour une confirmation brève |
| Bouton icône | `button.plus` (44 px, « + »), `button.step` (− et +), `.emile-x` (fermer) : rond, sans lumière, `aria-label` obligatoire |
| Texte secondaire | `.muted`, `.small`, `.label`, `.hero-date` |

**Créer un composant** :
- Seulement s'il doit servir plusieurs fois.
- Le CSS va dans `index.html`, dans la section concernée et avec un commentaire d'une ligne. Il n'utilise que les variables de couleur et marche dans les deux thèmes.
- Pas de `style="…"` en ligne, sauf pour une valeur calculée (largeur d'une barre en %, couleur d'un graphique). Les `gap` répétés en ligne (2, 4 ou 6 px) existent déjà ; ne pas en ajouter, proposer plutôt une classe.
- Les icônes sont en SVG en ligne (`viewBox="0 0 24 24"`, `stroke:currentColor`, `fill:none`, trait de 2), comme dans `ICONS` de `js/render.js`. Pas de police d'icônes ni de bibliothèque.

## 7. Animations

- **Les écrans sont animés par `js/nav.js`** (API Web Animations). La courbe est celle d'iOS, `cubic-bezier(.32,.72,0,1)` :
  - écran poussé : 420 ms ; retour : 380 ms ;
  - fenêtre qui monte : 460 ms ; qui redescend : 360 ms ;
  - fondu : 110 ms, puis 220 ms ;
  - glissement entre sous-onglets : 260 ms.
- **Retour au toucher** : `transform:scale(.96)` sur `.btn`, et `.93` sur `.chip`, en 140 ms. Les lignes de liste (`.pick`) prennent la couleur `--line` à l'appui, les lignes d'historique (`.hitem`) `--surface-2`. On réutilise ces règles pour un nouvel élément touchable.
- **Petites animations** : entre 140 et 300 ms, sur `transform` et `opacity` uniquement. Exception existante : la hauteur de la carte du calendrier et la fermeture d'une bulle d'Émile.
- **Une animation explique un changement.** Elle montre d'où vient un élément ou ce qui a changé, elle ne décore pas. Rien en boucle (sauf l'alternance des photos de « Voir le mouvement », que le toucher fige).
- **Permis depuis la version 3.0** (à ajouter aux étapes suivantes, limités ainsi) :
  - à l'ouverture d'un onglet seulement : les 4 premières cartes montent de 8 px en fondu, décalées de 30 ms, en 220 ms (`animate()` dans `nav.js`, fondu) ; jamais à chaque saisie ;
  - progression : un anneau ou une barre part de l'ancienne valeur, en 700 ms ;
  - série validée : contour orange qui s'allume et s'éteint, coche qui se dessine (600 ms) ;
  - réussite (record, objectif atteint, fin de séance) : 600 à 700 ms, une seule fois ; chiffres qui comptent seulement sur l'écran de fin de séance ;
  - durées : 140 ms (toucher), 200 à 300 ms (changement d'état), 600 à 700 ms (réussite) ; courbe `cubic-bezier(.32,.72,0,1)`.
- **Jamais bloquante** : une nouvelle navigation termine l'animation en cours (`finish()`), et l'interface répond pendant l'animation.
- **`prefers-reduced-motion`** : les transitions CSS sont coupées, la navigation devient un simple fondu et les chiffres s'affichent directement, sans compter. Une nouvelle animation en JavaScript vérifie ce réglage, avec `reduced()` dans `nav.js` ou `matchMedia`.

## 8. Thèmes clair et sombre

- Les variables sombres sont définies **deux fois**, avec des valeurs identiques :
  - dans `@media (prefers-color-scheme: dark){:root:not([data-theme="light"])}` ;
  - dans `:root[data-theme="dark"]`.
  Une variable ajoutée ou modifiée l'est dans les trois blocs : clair, sombre automatique et sombre choisi.
- Le choix de la personne (`settings.theme` : `auto`, `light` ou `dark`) est appliqué par `applyTheme()` dans `js/render.js`. Il est recopié dans `localStorage` (`loutrons-theme`) pour éviter un flash au lancement, et il met à jour les `meta theme-color`.
- Les seules couleurs en dur sont celles de `THEME_COLORS` dans `render.js` (`#F5F5F4` et `#0B0B0D`, comme les `meta theme-color` et le manifeste), les teintes du dégradé et des lumières dans les variables de `:root` (ambre `#FFB347`, braise `#FF4D00`), le reflet blanc du bouton principal, les aperçus des vignettes d'apparence (`.tp-*`), le fond noir `#000000` du rond d'Émile, le blanc posé sur le vert ou le rouge (`.chk` validée, `.chip.on.hi`, minuteur terminé), le noir du scanner et les ombres. On n'en ajoute pas. `tests/theme.test.js` vérifie la couleur de lancement et l'absence de l'ancienne palette.
- Les SVG utilisent `currentColor` ou les variables, comme `.bodymap` et `.chart`.
- On vérifie **chaque écran modifié dans les deux thèmes**, puis le contraste du texte (4,5:1) et des bordures utiles (3:1).

## 9. Hors connexion et mise en cache

- **Aucune ressource extérieure** : ni police, ni script, ni icône, ni image venant d'un autre site. Seule exception : Open Food Facts, interrogé par code-barres.
- **Nouveau fichier** (module, image, donnée) : l'ajouter à `FILES` dans `sw.js`. Les photos d'exercices passent par le cache à part `loutrons-photos-1`.
- **Fichier mis en cache modifié** : changer la version dans `js/version.js` et `VERSION` dans `sw.js`, avec le même numéro. Sinon les téléphones gardent l'ancienne version.
- Un écran qui a besoin du réseau (scan, photo pas encore vue) dit clairement ce qui manque, et le reste de l'écran marche quand même.

## 10. Préservation des données

- On ne lit et on n'écrit que par `S.docs`, `put()`, `del()` et `putSettings()`. Pas d'accès direct à IndexedDB depuis une vue.
- On ne renomme jamais un préfixe de document (`w_`, `b_`, `m_`…), un identifiant d'exercice (`BASE_EX`) ou de séance modèle : l'historique s'y rattache.
- Un nouveau champ est facultatif à la lecture. Un ancien document sans ce champ doit s'afficher correctement.
- Un changement de format passe par une migration testée sur une copie et une nouvelle version du format d'export. L'import accepte toujours les anciens exports.
- Une saisie en cours n'est jamais perdue par un nouvel affichage. C'est pourquoi les champs (`data-f`, `data-d`, `data-ac`…) mettent à jour `S` sans rappeler `render()`, puis ne redessinent qu'un aperçu ciblé (`#act-prev`, `#fd-prev`…).

## 11. Code de l'interface

- Les vues sont des fonctions qui renvoient du HTML sous forme de chaîne.
- **Tout texte variable passe par `esc()`** : saisie de la personne, données importées, réponse d'Open Food Facts. `emile()` attend du HTML déjà échappé.
- Les actions passent par `data-act="nom"` et `data-v="valeur"`, et sont traitées dans l'objet `A` de `js/actions.js`. Pas d'`onclick` ni d'écouteur ajouté dans une vue.
- Les boutons ont toujours `type="button"`.
- Les choix ont `aria-pressed="true|false"` et leur groupe `role="group"` avec un `aria-label` quand le titre ne suffit pas.
- Les nombres s'affichent avec `fmtKg()` (virgule), `fmtInt()` (espace fine entre les milliers) et `fmtRest()` (« 1 min 30 »). Les dates sont en `AAAA-MM-JJ`, lues avec les outils de `js/util.js` (`today()`, `parseIso()`, `addDays()`) ; jamais `toISOString()`, qui passe en heure UTC.

## 12. Accessibilité

- Chaque champ a une étiquette visible (`label.f > span`). Un bouton qui n'a qu'une icône a un `aria-label` en français.
- Le focus au clavier reste visible (`:focus-visible`, déjà défini) ; ne pas le supprimer.
- L'onglet actif a `aria-current="page"`. Les images décoratives ont `alt=""` ; les photos d'exercices ont un texte qui les décrit (« Développé couché : position de départ »).
- Une information n'est jamais donnée par la couleur seule : on ajoute un repère, un mot ou une légende, comme le calendrier avec `.mk` et sa légende.
- Un message qui apparaît sans action de la personne est annoncé (`aria-live="polite"`, comme le titre du mois ou le message du scanner).
- Le texte doit rester lisible si la personne agrandit la taille des caractères : pas de hauteur fixe sur un bloc de texte.

## 13. Textes

- En français, avec des phrases simples, et en tutoyant (« Ton entraînement », « Tes activités »).
- Typographie française :
  - guillemets « » ;
  - apostrophe typographique ’ dans les textes affichés ;
  - espace insécable avant `: ; ? !`, dans les guillemets et entre un nombre et son unité : `nbsp()` dans `util.js` (texte déjà échappé ou message) ; `fr()` de `views/goal.js` échappe puis met les espaces avant la ponctuation ;
  - unités séparées par une espace insécable.
- Vocabulaire professionnel : « perdre de la masse grasse », « prendre de la masse musculaire », « maintenir son poids ».
- Une règle de terrain n'est jamais présentée comme un résultat d'étude. Les sources restent dans « La science ».
- Un bouton dit ce qu'il fait (« Ajouter », « Enregistrer », « Supprimer l’activité »), pas « OK ».

## 14. Avant de dire qu'une modification est terminée

Suivre [references/verification.md](references/verification.md). En résumé :

1. Lancer `npm test` : tous les tests passent.
2. Vérifier dans Playwright à 390 px, en thème clair puis sombre : capture regardée, aucune erreur dans la console.
3. Vérifier à 320 px : pas de défilement horizontal, rien de coupé. Lancer axe-core sur l'écran, en clair et en sombre : aucun nouveau défaut grave.
4. Tester les interactions modifiées, y compris le retour, l'annulation, le geste depuis le bord et une saisie suivie d'un nouvel affichage.
5. Tester avec un stockage vide (premier lancement d'un ami), puis sans connexion après un premier chargement.
6. Avoir changé la version (`js/version.js` et `sw.js`) si un fichier mis en cache a changé, et ajouté les nouveaux fichiers à `FILES`.
7. Vérifier que le dépôt reste public et propre : aucune donnée personnelle, aucun secret, et la recherche du prénom décrite dans `CLAUDE.md` (« Avant un commit ») ne trouve rien.
