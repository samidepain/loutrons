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
  - les quelques exceptions existantes (`.chip` à 38 px, `.btn.sm` et `.link` à 36 px, `.emile-x` à 32 px) ne doivent pas servir de modèle pour une action importante ;
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

## 5. Identité graphique

**Couleurs** : toujours par les variables de `:root`, jamais en dur. Les contrastes de texte sont vérifiés à 4,5:1 dans les deux thèmes.

| Variable | Rôle |
|---|---|
| `--bg` | fond de l'écran (crème `#FAF5EC` en clair, anthracite `#120F10` en sombre) |
| `--surface`, `--surface-2` | cartes ; fonds secondaires (champs de séance, statistiques, barres) |
| `--line` | bordures et séparateurs |
| `--ink`, `--muted` | texte principal ; texte secondaire et étiquettes |
| `--accent`, `--on-accent` | orange : action principale, élément actif, progression ; texte posé sur l'orange |
| `--accent-ink` | orange lisible comme texte (`#A65200` en clair) |
| `--accent-soft` | fond orangé léger (pastille `.pill.acc`) |
| `--court`, `--court-soft` | marron et beige de la mascotte : informations, liens, repères secondaires, Émile |
| `--good`, `--warn`, `--bad` (+ `-soft`) | réussite, prudence, alerte |
| `--shade` | voile sous un écran ou une fenêtre |

- L'orange signale **ce qu'on peut faire ou ce qui est en cours**. On n'en met pas partout : un écran a une seule action principale `.btn.primary`.
- Le marron (`--court`) sert aux informations et aux liens (`.link`, `details.cue`, `.alert.info`, bulle d'Émile).
- Les couleurs d'état (`good`, `warn`, `bad`) servent uniquement à des états réels : séance faite, prudence, erreur.

**Typographie** : deux polices, hébergées dans `fonts/`.

| Usage | Police | Tailles |
|---|---|---|
| Titres, noms d'exercices, chiffres (`.num`, `.clock`, `.stat .v`) | `--f-display` : Barlow Condensed 500, 600 ou 700 | h1 30, h2 24, h3 20 ; grands chiffres 28 à 40 |
| Texte, boutons, champs | `--f-body` : Source Sans 3 | 16 (texte), 14 (`.small`), 12 en capitales espacées (`.label`, `.f > span`) |

- Les chiffres qu'on compare (charges, reps, minutes, kcal) sont en `font-variant-numeric:tabular-nums`, via `.num` ou les champs `.n`.
- Les titres longs passent à la ligne proprement grâce à `text-wrap:balance`, déjà appliqué aux titres.

**Formes et espacements** :
- Rayons : `--r` (12 px) pour les cartes ; 10 px pour les boutons, champs et puces ; 999 px pour les pastilles et les barres.
- Espacements sur la grille 2, 4, 6, 8, 10, 12, 16 px. On utilise `gap` plutôt que des marges : 16 entre cartes, 12 dans une carte, 6 à 10 dans une rangée.
- Ombres rares : seulement pour un élément qui flotte au-dessus du reste (minuteur, calques de navigation).

**Marque et mascotte** :
- « LOUTRONS » en majuscules dans l'en-tête, « Loutrons » dans les phrases.
- Le logo est dans `icons/logo.png` ; on ne le redessine pas.
- **Émile** signe les conseils (`emile()` dans `js/emile.js`) :
  - il appelle la personne « loutron », « loutronne » ou par son prénom (`hey()`, `callName()`) ;
  - ses conseils sont calculés par des règles et restent courts ;
  - il a une croix pour fermer, avec une clé qui décrit la situation : `emile(body, { key })` ;
  - les objectifs de chaque exercice restent des calculs sans signature.

## 6. Composants existants (`index.html`)

À utiliser tels quels. Chercher le nom de la classe dans `js/views/` pour voir un exemple réel.

| Besoin | Composant |
|---|---|
| Bloc de contenu | `section.card` (`.card.flat` sans cadre) ; `.card.welcome` centré |
| Mise en page | `.row` (horizontal, passe à la ligne), `.between`, `.stack` (vertical) |
| Action | `.btn` ; `.primary` (une par écran) ; `.ghost` ; `.danger` ; `.big` (pleine largeur, en bas) ; `.sm` |
| Lien discret, « Annuler », « ‹ Retour » | `button.link` |
| Choix dans une liste (programme, aliment, activité) | `button.pick` avec `.n` (nom) et `.m` (précision) ; `.on` sélectionné ; `.static` non cliquable ; `.planned` prévu |
| Choix court ou nombre (jours, reps en réserve, douleur 0-10) | `.chips` > `button.chip` (`.txt` pour du texte, `.on`, `.sec`, `.hi`) ; `.days` pour 7 jours ; `.seg` pour des sous-onglets qui défilent |
| Champs de formulaire | `.fields` (grille) > `label.f` > `span` + `input` (classe `.n` pour un nombre) |
| Saisie pendant la séance | `.setrow` > `.sn`, `.fld` (champ et unité), `.chk` |
| Case à cocher avec explication | `label.toggle` |
| Petite information d'état | `.pill` (`.good`, `.warn`, `.bad`, `.acc`, `.court`) |
| Message dans la page | `.alert` (`.warn`, `.good`, `.info`) |
| Conseil | `emile(html, { title, tone, key })` |
| Confirmation brève après une action | `toast('…')` (`js/util.js`) |
| Chiffres clés | `.stats` > `.stat` > `.v` + `.l` ; `.stats.needs` sur 2 colonnes |
| Barre de progression | `.bar > i` (fine) ; `.mbar > i` (+ `b` pour un repère) dans `.mrow` |
| Tableau | `.scroll > table.tbl` |
| Détail repliable, consignes | `details.cue > summary` |
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
- **Retour au toucher** : `transform:scale(.96)` sur `.btn`, et `.93` sur `.chip`, en 140 ms. Les lignes de liste prennent la couleur `--surface-2` à l'appui. On réutilise ces règles pour un nouvel élément touchable.
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
- Les seules couleurs en dur sont celles de `THEME_COLORS` dans `render.js`, le fond du rond d'Émile, le blanc posé sur le vert ou le rouge (`.chk` validée, `.chip.on.hi`, minuteur terminé), le noir du scanner et les ombres. On n'en ajoute pas.
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
