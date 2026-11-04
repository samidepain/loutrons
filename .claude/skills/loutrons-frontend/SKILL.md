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
   - un « style » complet à appliquer, comme le glassmorphisme ou le néomorphisme.
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
  - **Aujourd'hui**, dans l'ordre : salut et date ; la séance du jour (prévue, en cours, faite, ou jour de repos ou de sport) ; « Ta semaine » ; « Ton alimentation » si le suivi est activé ; un seul conseil d'Émile ; « Ton suivi du jour » en lignes compactes (eau, poids et sommeil, activités, genou). Le haut tient sans défilement à 390 × 844 : ne rien ajouter au-dessus du conseil d'Émile ;
  - **Entraînement › Séances** : « Ton programme » (changer de programme, changer les jours) et les séances ; **› Exercices** : la liste, et les exercices masqués tout en bas ; **› Planning** : « Tes jours », « Cette semaine » (semaine chargée, décharge anticipée), « Réglages de l'entraînement » (début du programme, options genou, détente et sport, jours de sport) ;
  - **Profil** : toi, ton alimentation, apparence, tes données, La science, et une ligne vers les réglages de l'entraînement ;
  - **fiche d'un exercice** : ouverte depuis Entraînement › Exercices ou Progrès › « Tes exercices » ; `S.ficheFrom` (`'exercices' | 'progress'`) nomme le retour.
  - **séance en cours** (Entraînement) : un seul exercice ouvert (ou un superset), les autres repliés en lignes ; `sessionFocus(w, { open, ask })` (`js/data.js`) dit lesquels sont ouverts, quelle série est en cours et si la question des reps en réserve attend ;
  - **« Voir le mouvement »** : fenêtre (`S.move`, `sheet:'move'`) ouverte depuis l'exercice ouvert ; le même bloc est dans la fiche.
- **États d'affichage d'Aujourd'hui** (non enregistrés) : `S.todayOpen` (ligne compacte ouverte, une seule) et `S.emileMore` (autres conseils affichés).
- **États d'affichage de la séance** (non enregistrés, remis à zéro au début, à la fin et à l'abandon) : `S.sessOpen` (exercice ouvert à la main), `S.rirAsk` (exercice qui attend ses reps en réserve), `S.setEdit` (`{ ex, i }`, série faite en correction), `S.move` (exercice de « Voir le mouvement »). Après une validation, `showCurrent()` (`actions.js`) garde `#cur` visible au-dessus du minuteur.

## 5. Identité graphique

**Ambiance** (version 2.6) : sportive et sombre. Noir pur, orange vif, blanc ; plus de marron ni de crème. Peu de cadres : des blocs gris sans bordure, des boutons en pilule.

**Couleurs** : toujours par les variables de `:root`, jamais en dur. Les contrastes de texte sont vérifiés à 4,5:1 dans les deux thèmes.

| Variable | Rôle | Sombre | Clair |
|---|---|---|---|
| `--bg` | fond de l'écran, barre d'onglets | `#000000` | `#FFFFFF` |
| `--surface` | blocs (`.card`), bulle d'Émile | `#141414` | `#F4F4F4` |
| `--surface-2` | champs, boutons gris, puces, lignes de liste, statistiques, jours du calendrier | `#1F1F1F` | `#E9E9E9` |
| `--line` | séparateurs, appui sur une ligne de liste | `#2E2E2E` | `#DADADA` |
| `--ink`, `--muted` | texte principal ; texte secondaire et étiquettes | `#FFFFFF`, `#A3A3A3` | `#0A0A0A`, `#5C5C5C` |
| `--accent`, `--on-accent` | orange : action principale, élément actif, minuteur ; texte posé sur l'orange | `#FF7A1A`, `#000000` | `#FF7A1A`, `#000000` |
| `--accent-ink` | orange en texte : liens, « Annuler », onglet actif, titre du superset ; aussi les contours d'état (ligne choisie, champ en saisie, aujourd'hui dans le calendrier), pour garder 3:1 sur les gris clairs | `#FF7A1A` | `#A84300` |
| `--accent-soft` | fond orangé léger (`.pill.acc`) | `#331A05` | `#FFE8D6` |
| `--court`, `--court-soft` | repère secondaire neutre (gris) : `.pill.court`, `.chip.sec.on`, barre de l'eau, repère des barres | `#D4D4D4`, `#1F1F1F` | `#3D3D3D`, `#EDEDED` |
| `--good`, `--warn`, `--bad` (+ `-soft`) | réussite, prudence, alerte | | `--good` `#186B3C` en clair |
| `--shade` | voile sous un écran ou une fenêtre | | |
| `--fam-salle`, `--fam-cardio`, `--fam-collectif`, `--fam-autre` | couleur d'une famille d'activité dans le calendrier (points `.mk`) | `#FF7A1A`, `#4DA3FF`, `#B48CFF`, `#D4D4D4` | `#A84300`, `#1F6FD1`, `#7B3FD6`, `#3D3D3D` |

- L'orange signale **ce qu'on peut faire ou ce qui est en cours**. On n'en met pas partout : un écran a une seule action principale `.btn.primary`.
- Le gris neutre (`--court`) sert aux repères secondaires. Les liens et consignes à déplier sont en `--accent-ink`.
- Les couleurs d'état (`good`, `warn`, `bad`) servent uniquement à des états réels : séance faite, prudence, erreur.
- Dans un bloc déjà en `--surface-2` (`.item`, `.target`, `.stat`), les contrôles prennent le fond `--bg`, sinon ils disparaissent.

**Typographie** : Archivo (un seul fichier `fonts/archivo.woff2`, 37 Ko, graisse 800, largeur 62 à 125 %) et la police du téléphone (SF Pro sur iPhone).

| Usage | Police | Tailles |
|---|---|---|
| Titres (`h1`, `h2`, `h3`), « LOUTRONS », nom de la séance du jour (`.plan .name`) | `--f-display`, `font-stretch:125%` (très large) | h1 28, h2 20, h3 18 ; `.plan .name` 36 |
| Chiffres (`.num`, `.clock`, `.fld input`, `input.n`, `.chip`) et noms d'exercices (`.exname`, `.hitem .n`) | `--f-display`, `font-stretch:100%` | tailles du composant ; noms d'exercices 20 (19 sous 360 px) |
| Grands chiffres des cases (`.stat .v`) et nom de séance dans une case du calendrier (`.cday .s`) | `--f-display`, `font-stretch:62%` (étroite) | `.stat .v` 28 (24 sous 360 px) ; `.cday .s` 12 |
| Texte, boutons, champs | `--f-body` : police du système | 17 (texte), 15 (`.small`, étiquettes en demi-gras), 13 au moins (mentions) ; 12 pour les onglets |

- Pas de capitales espacées : seul « LOUTRONS » est en capitales (un test le vérifie). Les étiquettes s'écrivent avec une majuscule au début.
- Les chiffres qu'on compare (charges, reps, minutes, kcal) sont en `font-variant-numeric:tabular-nums` ; les chiffres d'Archivo ont tous la même largeur.
- Les titres longs passent à la ligne proprement grâce à `text-wrap:balance`, déjà appliqué aux titres.
- Archivo est plus large que l'ancienne police étroite : vérifier les champs de série et les cases du calendrier à 320 px (règles `@media (max-width:360px)` dans les sections Séance et Calendrier).

**Formes et espacements** :
- Rayons : `--r` (16 px) pour les blocs ; 12 px pour les champs, lignes de liste, statistiques ; 999 px (pilule) pour les boutons, puces, pastilles et barres.
- Blocs, boutons, champs et puces sans bordure : on les distingue par leur fond. Un état (choisi, saisie en cours, exercice terminé) se montre par un contour intérieur (`box-shadow:inset 0 0 0 2px`).
- Espacements sur la grille 2, 4, 6, 8, 10, 12, 16 px. On utilise `gap` plutôt que des marges : 16 entre cartes, 12 dans une carte, 6 à 10 dans une rangée.
- Ombres rares : seulement pour un élément qui flotte au-dessus du reste (minuteur, calques de navigation).

**Marque et mascotte** :
- « LOUTRONS » en majuscules dans l'en-tête, « Loutrons » dans les phrases.
- Le logo est dans `icons/logo.png` : la loutre et sa barre sur fond noir, sans anneau ni halo (version 2.6). Source : `icons/source/logo-loutrons-simple.png`, tirée de l'original `icons/source/logo-loutrons.webp`. On ne le redessine pas.
- **Émile** signe les conseils (`emile()` dans `js/emile.js`) :
  - il appelle la personne « loutron », « loutronne » ou par son prénom (`hey()`, `callName()`) ;
  - ses conseils sont calculés par des règles et restent courts ;
  - il a une croix pour fermer, avec une clé qui décrit la situation : `emile(body, { key })` ;
  - les objectifs de chaque exercice restent des calculs sans signature ;
  - sur Aujourd'hui, un seul conseil à la fois : `emileQueue([{ rank, html }])` garde le plus important (1 : demande une réponse ; 2 : alerte ; 3 : sauvegarde ; 4 : rappel ; 5 : message de la semaine) et range les autres derrière « N autres conseils ».

## 6. Composants existants (`index.html`)

À utiliser tels quels. Chercher le nom de la classe dans `js/views/` pour voir un exemple réel.

| Besoin | Composant |
|---|---|
| Bloc de contenu | `section.card` (fond `--surface`, sans bordure ; `.card.flat` transparent) ; `.card.welcome` centré ; `.plan` garde un contour orange |
| Mise en page | `.row` (horizontal, passe à la ligne), `.between`, `.stack` (vertical) |
| Action | `.btn` (pilule grise) ; `.primary` (orange, une par écran) ; `.ghost` (texte orange) ; `.danger` (texte rouge) ; `.big` (pleine largeur, 52 px, en bas) ; `.sm` |
| Lien discret, « Annuler », « ‹ Retour » | `button.link` |
| Choix dans une liste (programme, aliment, activité) | `button.pick` avec `.n` (nom) et `.m` (précision) ; `.on` sélectionné ; `.static` non cliquable ; `.planned` prévu |
| Choix court ou nombre (jours, reps en réserve, douleur 0-10) | `.chips` > `button.chip` (`.txt` pour du texte, `.on`, `.sec`, `.hi`) ; `.days` pour 7 jours ; `.seg` pour des sous-onglets qui défilent |
| Champs de formulaire | `.fields` (grille) > `label.f` > `span` + `input` (classe `.n` pour un nombre, aussi hors de `label.f`) ; champs remplis sans bordure, contour orange pendant la saisie |
| Exercice replié dans la séance | `button.pick.ex-line` (`data-act="ex-open"`) > `.exl` > `.n` + `.m` (« 0/3 · 49,5 kg × 6 », « ✓ 3/3 ») ; exercice ouvert : `section.card.ex.open[data-ex]` |
| Série en cours (une seule à l'écran, `#cur`) | `.cur-set` > `.stepper` × 2 (`.st-lab`, `button.step` − et + avec `data-act="step"` et `data-f="kg" | "reps"`, `.fld`), puis `.btn.primary.big` « Valider la série N » ; valeur ± palier avec `stepValue()` (`util.js`) |
| Séries faites et à venir | `.set-line` : `.done` (bouton, `data-act="set-edit"` pour corriger) ou `.next` (grisée) ; `.sn`, `.sl-v`, `.sl-ok` |
| Question des reps en réserve | `.cur-set.rir-ask` > `.rir-q`, `.chips` en grille de 5 > `.rir-c` (puce, et `.vise` sous la valeur visée), `button.link` « Passer la question » |
| Photos du mouvement et silhouette en grand | `movementBlock(e, { cue })` (`js/views/movement.js`) : `.mv` > `button.mv-photos` (alternance en CSS, `.mv.paused` la fige), `.mv-cap`, puis `bodyMap(m, { big:true })` (`.bodymap.big` et `.legend.big`) ; moins d'animations : `.photos` côte à côte |
| Saisie du cardio pendant la séance | `.setrow.cardio` > `.sn`, `.fld` (champ et unité) |
| Case à cocher avec explication | `label.toggle` |
| Petite information d'état | `.pill` (`.good`, `.warn`, `.bad`, `.acc`, `.court`) |
| Ligne compacte d'Aujourd'hui (nom, valeur, geste rapide, détail ouvert sur place) | `lineCard(clé, nom, valeur, bouton, détail)` dans `js/views/activity.js` : `section.card.line` > `.line-row` > `button.line-h[data-act="today-open"]` |
| Familles d'un jour dans le calendrier | `.mks` > `i.mk.fam-<famille>.<état>` (`done` plein, `planned` anneau, `active` point entouré), d'après `dayFamilies(day)` |
| Message dans la page | `.alert` (`.warn`, `.good`, `.info`) |
| Conseil | `emile(html, { title, tone, key })` |
| Confirmation brève après une action | `toast('…')` (`js/util.js`) |
| Chiffres clés | `.stats` > `.stat` > `.v` + `.l` ; `.stats.needs` sur 2 colonnes |
| Barre de progression | `.bar > i` (fine) ; `.mbar > i` (+ `b` pour un repère) dans `.mrow` |
| Tableau | `.scroll > table.tbl` |
| Détail repliable | `details.cue > summary` |
| Groupe (superset) | `.group > .gh` |
| Objectif calculé | `.target` |
| Liste vide | `p.empty` |
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
- **Une animation explique un changement.** Elle montre d'où vient un élément ou ce qui a changé, elle ne décore pas. Pas d'animation au chargement des listes ni en boucle.
- **Jamais bloquante** : une nouvelle navigation termine l'animation en cours (`finish()`), et l'interface répond pendant l'animation.
- **`prefers-reduced-motion`** : les transitions CSS sont coupées et la navigation devient un simple fondu. Une nouvelle animation en JavaScript vérifie ce réglage, avec `reduced()` dans `nav.js` ou `matchMedia`.

## 8. Thèmes clair et sombre

- Les variables sombres sont définies **deux fois**, avec des valeurs identiques :
  - dans `@media (prefers-color-scheme: dark){:root:not([data-theme="light"])}` ;
  - dans `:root[data-theme="dark"]`.
  Une variable ajoutée ou modifiée l'est dans les trois blocs : clair, sombre automatique et sombre choisi.
- Le choix de la personne (`settings.theme` : `auto`, `light` ou `dark`) est appliqué par `applyTheme()` dans `js/render.js`. Il est recopié dans `localStorage` (`loutrons-theme`) pour éviter un flash au lancement, et il met à jour les `meta theme-color`.
- Les seules couleurs en dur sont celles de `THEME_COLORS` dans `render.js` (`#FFFFFF` et `#000000`, comme les `meta theme-color` et le manifeste), le fond noir `#000000` du rond d'Émile, le blanc posé sur le vert ou le rouge (`.chk` validée, `.chip.on.hi`, minuteur terminé), le noir du scanner et les ombres. On n'en ajoute pas. `tests/theme.test.js` vérifie la couleur de lancement et l'absence de l'ancienne palette.
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
  - espace insécable avant `: ; ? !` (fonction `fr()`, pour l'instant interne à `views/goal.js` : la déplacer dans `util.js` si un autre écran en a besoin) ;
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
