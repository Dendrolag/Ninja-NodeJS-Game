# Handoff - Étape 1.5 Intelligence artificielle des bots

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Porter dans le moteur pur le comportement des bots ordinaires et des bots noirs, de façon déterministe, et faire tourner une partie complète sans réseau ni rendu. **Cette étape clôt le portage du gameplay.**

## Ce qui a été fait

- Les bots errent: alternance de marche et de pause, changement de cap spontané, demi-tour devant un mur, détection de blocage à trois niveaux (changement de cap, dégagement forcé, réapparition ailleurs).
- Les bots noirs chassent: choix de proie par priorité, poursuite dirigée, prise à vingt pixels, délai de deux secondes entre deux prises.
- Les bots noirs entrent en jeu à mi-partie, et reviennent si on les détruit tous.
- La carte se peuple par `peuplerDeBots`, avec des identifiants déterministes.
- Le moteur simule une partie complète de bout en bout: joueurs, bots, bots noirs, bonus, malus, zones, captures, score. Test d'intégration sur 1200 battements avec instantané de référence.
- Quatre défauts de l'audit découverts en portant, X26 à X29, tous corrigés par conception. Trois défauts déjà connus traités au passage: X12, X14, X27 découle de X25.
- Soixante-huit tests unitaires ajoutés. Couverture de `packages/sim`: 99,62 pour cent.

## Ce que le moteur sait faire de plus, en une page

Le contrat de `tick(etat, entrees, dtMs)` est inchangé, y compris son nombre d'arguments.

### Un bot porte maintenant son comportement

```ts
interface TraitsDeBot extends Entite {
  readonly cap: Vecteur;                       // toujours unitaire
  readonly enMouvement: boolean;               // marche ou pause
  readonly avantChangementDEtatMs: number;
  readonly avantChangementDeCapMs: number;
  readonly avantControleDeBlocageMs: number;
  readonly positionAuDernierControle: Position;
  readonly controlesSansAvancer: number;
}

export interface BotOrdinaire extends TraitsDeBot { readonly type: 'bot' }

export interface BotNoir extends TraitsDeBot {
  readonly type: 'botNoir';
  readonly cible: IdentifiantEntite | undefined;
  readonly avantRechercheDeCibleMs: number;
  readonly avantProchaineCaptureMs: number;
}

export type Bot = BotOrdinaire | BotNoir;
```

`Bot` devient une **union discriminée**, comme `ObjetRamassable` à l'étape 1.4. Le nom ne change pas, donc rien de l'existant n'a eu à bouger: `bot.type === 'bot'` filtre toujours, et les copies par diffusion préservent les champs propres au bot noir. Un test qui manipule un bot noir doit désormais le typer `BotNoir` pour lire `cible`.

L'héritage `BlackBot extends Bot` du legacy devient une variante. Un bot noir a tout ce qu'un bot ordinaire a, plus une proie et deux comptes à rebours.

### Le joueur gagne un compteur

```ts
readonly capturesParBotNoirSubies: number;   // portage de capturedByBlackBot
```

### Un événement de plus au journal du battement

```ts
type EvenementPartie =
  | CaptureDeJoueur | CaptureParBotNoir | DestructionDeBotNoir
  | BonusRamasse | MalusRamasse;
```

`CaptureParBotNoir` porte `botsPerdus`: le serveur de l'étape 2.2 y trouvera le nombre à annoncer, que le legacy recalculait au moment d'émettre.

### Les réglages gagnent un cinquième groupe

```ts
botsNoirs: {
  actifs: true,
  nombre: 2,
  momentApparitionPourCent: 50,
  rayonDetectionPx: 150,
  partDeBotsPerduePourCent: 50,
}
```

Les quatre derniers viennent de `DEFAULT_GAME_SETTINGS`, et **trois d'entre eux n'avaient aucun effet dans le legacy**: le rayon et la part perdue étaient lus dans les valeurs par défaut au lieu des réglages de la partie (X14), et le moment d'apparition n'était lu nulle part (X26). Ici les quatre agissent.

### L'ordre d'un battement

1. le journal du battement précédent est effacé;
2. chaque joueur applique son entrée et se déplace, puis ses protections et ses effets se rapprochent de leur fin;
3. **les bots errent, les bots noirs chassent, et de nouveaux bots noirs entrent en jeu quand leur heure est venue**;
4. les zones vieillissent, apparaissent, et agissent sur les bots;
5. les objets posés vieillissent, et de nouveaux apparaissent;
6. on relève les contacts entre entités et on en tire les conséquences;
7. les joueurs ramassent les objets sur lesquels ils se trouvent.

Le point 3 est nouveau, et sa place est celle du legacy: sa boucle appelait `updateBots` puis `sendUpdates`, et c'est cette dernière qui appliquait les effets de zone (`server.js:2799`). Un bot bouge donc de lui-même avant d'être poussé par une zone.

### Comment un bot noir choisit

Un joueur vulnérable prime toujours sur un bot; à nature égale, le plus proche l'emporte. Un bot déjà neutre ne l'intéresse pas, il n'y a rien à y prendre. Les bots noirs s'ignorent entre eux. Entre deux recherches, un joueur qui entre dans le rayon lui fait lâcher le bot qu'il poursuivait.

Une prise sur un joueur lui fait perdre la part de bots réglée et le fait réapparaître ailleurs, **en gardant sa couleur**: contrairement à une capture par un autre joueur, il ne perd pas tout. Une prise sur un bot le rend neutre. Dans les deux cas le délai de deux secondes se réarme; un joueur protégé, lui, ne consomme rien.

## Fichiers créés ou modifiés

Créés, dans `packages/sim/src/`

- `bots.ts`: tout le comportement. Portage de `Bot` (legacy/server.js:941), `BlackBot` (:1130), `createBots` (:1547), `addBot` (:1553), `updateBots` (:1558) et `spawnBlackBots` (:1333).
- `bots.test.ts`: 58 tests. Errance, contrôle de blocage, choix de proie, poursuite, prise, apparition, peuplement, déterminisme.
- `partie.test.ts`: 8 tests. Le test de partie complète demandé par la fiche, plus le déterminisme, la stabilité de la population et l'entrée en jeu des bots noirs.
- `__snapshots__/partie.test.ts.snap`: l'instantané de référence d'une partie d'une minute.

Modifiés

- `packages/shared/src/constantes.ts`: les constantes `BOTS` (durées d'errance, seuils de blocage, distances de test) et `BOTS_NOIRS` (délai de prise, intervalle de recherche, seuil de prise).
- `packages/shared/src/reglages.ts`: le groupe `botsNoirs`, ses valeurs par défaut, et la note sur X26.
- `packages/shared/src/index.ts`: les nouvelles constantes et le nouveau type de réglages.
- `packages/sim/src/etat.ts`: `Bot` devient une union, `TraitsDeBot`, `BotOrdinaire`, `BotNoir`, `CaptureParBotNoir`, `capturesParBotNoirSubies`; `ajouterBot` tire le cap et les compteurs.
- `packages/sim/src/moteur.ts`: `avancerLesBots` branchée dans le battement, et l'ordre documenté.
- `packages/sim/src/contacts.ts`: la note sur la capture par bot noir, qui pointait vers l'étape 1.5, pointe maintenant vers `bots.ts`.
- `packages/sim/src/index.ts`: exporte `avancerLesBots`, `faireApparaitreLesBotsNoirs`, `peuplerDeBots`, et les nouveaux types.
- `packages/sim/src/etat.test.ts`: le test de placement d'un bot, plus deux tests sur son état de départ.
- `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/etape-1-5.md`: voir plus bas.

Aucune modification de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 68 tests, dont 58 dans `bots.test.ts`, 8 dans `partie.test.ts`, et 2 dans `etat.test.ts`.
- Résultat: **496 tests Vitest passent, 0 échec** (428 au handoff 1.4, plus 68).
- Couverture de `packages/sim`: **99,62 pour cent** des instructions, 99,15 pour cent des branches, contre 99,83 et 99,71 au handoff 1.4. Elle baisse très légèrement et reste très au-dessus de la cible de 80 à 90. `packages/shared` reste à 100 pour cent.
- Lignes non couvertes de `packages/sim`, toutes défensives et inatteignables aujourd'hui: dans `bots.ts`, la sortie de boucle quand un bot a disparu en cours de parcours, et la poursuite d'une proie introuvable (le choix de proie la valide juste avant); dans `couleurs.ts`, le repli de `couleurUnique` déjà signalé aux handoffs 1.1 à 1.4.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: verte au dernier `pnpm verify`.

## Décisions et écarts au plan

Les écarts à la fiche sont dans la section « Réconciliation » de `docs/plan/etape-1-5.md`. Les décisions de fond sont au journal de `docs/design/README.md`, datées du 14 août 2026. En résumé:

1. **`Bot` devient une union discriminée.** Un bot ordinaire n'a pas de proie: lui donner un champ `cible` toujours vide aurait été la maladie du legacy, celle des champs morts qu'on finit par croire vivants.

2. **Le cap est unitaire, la vitesse est une constante à part** (défaut X28). Le legacy multipliait par la vitesse un vecteur dont la longueur n'était jamais garantie: un bot fraîchement posé avançait à une vitesse tirée au sort entre zéro et une fois et demie la vitesse annoncée, et un bot noir qui perdait sa proie errait à cinq cents pixels par seconde.

3. **Un bot bloqué change de cap, il ne glisse pas le long du mur.** Un joueur, lui, glisse. Les deux comportements restent distincts, comme dans le legacy: c'est ce qui donne aux bots leur démarche de billard.

4. **La capture par bot noir vit dans `bots.ts`, pas dans le relevé des contacts.** Un bot noir ne prend que la proie qu'il poursuit: ce n'est pas une conséquence d'un contact, c'est l'aboutissement d'une chasse. Un joueur qui frôle un bot noir occupé ailleurs ne risque rien, exactement comme dans le legacy.

5. **`peuplerDeBots` est séparée de `creerEtatInitial`.** Un salon en attente n'a pas besoin de bots. Le serveur choisira le moment (étape 2.1), le moteur ne suppose rien. Conséquence: aucun test existant n'a eu à changer.

6. **Le pas d'un bot noir est borné par la distance à sa proie**, et la prise se juge après le déplacement. Le legacy jugeait sur la distance d'avant, ce qui revient au même à sa cadence de cinquante millisecondes, mais laisserait un pas de temps grossier traverser la proie sans la voir. Cas limite associé, corrigé au passage: un bot noir exactement superposé à sa proie n'a aucune direction à suivre, et il prend quand même; sans cela il resterait bloqué sur elle indéfiniment.

7. **`resetPlayer` n'est pas portée.** Cycle de vie serveur, pas logique de jeu: une partie neuve est un état neuf. Seul son compteur utile, `capturedByBlackBot`, devient un champ de joueur.

8. **Quatre défauts découverts en portant (règle 7).** X26 (le moment d'apparition des bots noirs n'est lu nulle part), X27 (le bot noir traverse les murs en poursuivant), X28 (la vitesse d'un bot dépend d'un vecteur non unitaire), X29 (le bot noir teste l'invulnérabilité de deux façons différentes). Tous corrigés par conception, décrits dans l'audit.

9. **Ce qui n'est délibérément pas porté.** `Bot.unstuck` (:1034) est du code mort qui appelle une méthode inexistante, déjà signalé au défaut X10. Le bornage des coordonnées à la carte (:1093) ne sert plus à rien, hors de la carte tout étant mur. Le champ `destroyed` testé par `updateBots` (:1569) n'est jamais écrit nulle part. Le réglage `blackBotSpeed` reste non porté (X13, décision du 13 août 2026).

## Ce que la prochaine étape doit savoir

- **Le peuplement de la partie est à la charge de l'appelant.** Une partie créée par `creerEtatInitial` n'a aucun bot. L'étape 2.1 devra appeler `peuplerDeBots` au lancement de la partie, pas à la création du salon.
- **Les bots noirs reviennent.** Détruire le dernier bot noir en fait renaître une fournée complète au battement suivant. C'est le comportement du legacy, conservé délibérément: sa condition porte sur leur absence, pas sur une apparition déjà faite.
- **Le client ne calcule aucun comportement de bot** (étape 4.1). Il reçoit des positions et des directions, il dessine.

## Problèmes connus et dette

- **La question ouverte du handoff 1.3 reste ouverte, et elle est maintenant plus visible**: les bots blancs effacent les couleurs par contagion (défaut X20). Elle devait être tranchée « en une ligne à l'étape 1.5 » selon le handoff 1.4; elle ne l'a pas été, faute de décision du porteur du projet, et la corriger n'était pas dans le périmètre de cette fiche. Maintenant que les bots se déplacent vraiment, cette contagion s'exerce en continu: un joueur perd des points sans que personne ne l'attaque. **C'est la première question à poser.** La correction tient toujours en une ligne dans `capturerBot`: refuser la repeinte quand le capteur est un bot neutre.
- **Les tests des bots ne s'appuient pas sur la caractérisation**, qui n'a pas pu figer ce domaine à l'étape 0.2: l'errance repose entièrement sur `Math.random` et `Date.now`, et l'état interne d'un bot n'est jamais exposé. Ils s'appuient sur la lecture du code d'origine. Même situation que les zones à l'étape 1.4.
- **Le contrôle de blocage échantillonne, donc il dépend du découpage du temps.** Il mesure la distance parcourue depuis le contrôle précédent, toutes les cinq cents millisecondes: appeler le moteur une fois par seconde ou vingt fois ne donne pas les mêmes constats de blocage. C'est inhérent à la méthode du legacy, et sans conséquence à cadence fixe. À garder en tête si l'étape 2.1 rend le pas de temps variable.
- **Aucune optimisation spatiale**, inchangé depuis 1.3. Le choix de proie d'un bot noir parcourt tous les joueurs et tous les bots à chaque recherche, soit deux fois par seconde et par bot noir: négligeable à deux bots noirs, à revoir si le nombre devient un réglage libre. Le relevé des contacts reste le premier poste de coût. Grille spatiale à l'étape 5.2, conditionnée à la mesure de 5.1.
- **`packages/server` et `packages/client` restent vides.** Normal à ce stade.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 1.4.

## Prochaine action exacte

Dans une conversation neuve: lire la section « Failles de sécurité » de `docs/audit/AUDIT-EXISTANT.md`, puis la fiche `docs/plan/etape-1-6.md`, et commencer par le point 1 de son périmètre, l'autorité sur le déplacement.

Quatre points à avoir en tête dès le début de l'étape 1.6:

1. **Les points 1 et 2 du périmètre de la fiche 1.6 sont déjà largement acquis.** Le déplacement est calculé par le moteur à partir de `dt` depuis l'étape 1.1, le bonus de vitesse est détenu par le moteur depuis l'étape 1.4, et le facteur mobile n'a jamais été porté. Réconcilier la fiche avant de l'exécuter: ce qui reste à faire est de **borner l'intention reçue** (un vecteur de norme arbitraire, `NaN`, `Infinity`) et de décider du sort du facteur mobile.
2. **`EntreeJoueur` n'est validée nulle part.** `tick` vérifie `dtMs`, mais `entree.deplacement` est pris tel quel avant `aLaLongueur`, qui protège de la norme mais pas de `NaN`. C'est le premier trou à boucher.
3. **Le point 3 du périmètre, la validation des entrées, est le gros du travail**: schémas dans `packages/shared` pour le pseudo, le chat et les paramètres de partie. Les bornes des réglages du bot noir ajoutés à cette étape en font partie.
4. **La règle qui prime**: un défaut de sécurité ne se caractérise pas, il se corrige par conception. Section « Sécurité » de CLAUDE.md.

## Étape suivante

Fiche à lire: `docs/plan/etape-1-6.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.6 suit bien 1.5.
