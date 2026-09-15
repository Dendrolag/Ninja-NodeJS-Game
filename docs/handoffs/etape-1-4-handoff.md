# Handoff - Étape 1.4 Bonus, malus et zones spéciales

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Porter les bonus, les malus et les zones spéciales, avec leurs effets et leurs durées, dans le moteur pur, en faisant passer toute apparition aléatoire par le générateur à graine.

## Ce qui a été fait

- Les trois bonus, les trois malus et les quatre zones existent dans le moteur, avec leurs durées, leurs taux d'apparition et leurs effets.
- Les objets à ramasser vivent sur la carte, vieillissent et disparaissent au bout de huit secondes.
- Le ramassage, laissé de côté aux étapes 1.2 et 1.3, est porté et branché dans le battement.
- Les apparitions ne passent plus par des minuteries: elles sont planifiées par l'état et avancées par dt. **Le défaut X1 de l'audit disparaît par construction**, et une nouvelle partie repart forcément d'un compteur propre.
- Le bonus de vitesse est appliqué par le moteur, et le malus de commandes inversées aussi. Le legacy laissait le client décider des deux.
- Les zones agissent sur les bots: chaos, répulsion, attraction. L'invisibilité reste une affaire d'affichage.
- Les réglages de partie accueillent les bonus, les malus et les zones, en trois groupes, avec une fusion qui descend dans les groupes.
- Quatre défauts de l'audit découverts en portant, X22 à X25, tous corrigés par conception.
- Cent un tests unitaires ajoutés. Couverture de `packages/sim`: 99,83 pour cent, en hausse.

## Ce que le moteur sait faire de plus, en une page

Le contrat de `tick(etat, entrees, dtMs)` est inchangé, y compris son nombre d'arguments.

### Ce qu'un joueur porte maintenant

```ts
interface Joueur extends Entite {
  // ... inchangé, sauf que invincibiliteActive a disparu
  readonly bonusRestantsMs: DureesRestantes<TypeBonus>; // vitesse, invincibilite, revelation
  readonly malusRestantsMs: DureesRestantes<TypeMalus>; // controlesInverses, flou, negatif
}
```

**`invincibiliteActive` n'existe plus comme champ.** C'était un indicateur doublé d'une durée, la maladie du legacy: deux vérités à tenir d'accord à la main. Il se lit maintenant, par `estInvincible(joueur)`, `bonusActif(joueur, nature)` ou `malusActif(joueur, nature)`. Les tests des étapes 1.2 et 1.3 qui posaient `invincibiliteActive: true` ont été repris en conséquence.

Un effet est actif tant qu'il lui reste du temps. Les durées décroissent à chaque battement, comme la protection d'apparition, et le déplacement du battement utilise les effets tels qu'ils sont au début: un bonus auquel il reste dix millisecondes vaut encore pour ce battement-là.

### Ce que la partie porte de plus

```ts
interface EtatPartie {
  // ... inchangé
  readonly objets: Readonly<Record<IdentifiantEntite, ObjetRamassable>>;
  readonly zones: Readonly<Record<IdentifiantEntite, ZoneSpeciale>>;
  readonly prochainesApparitions: ProchainesApparitions; // bonusMs, malusMs, zoneMs
  readonly compteurIdentifiants: number;
}
```

Bonus et malus posés partagent **une seule collection**, distingués par leur champ `categorie`, comme les bots et les bots noirs à l'étape 1.3. Les classes `Bonus` et `Malus` du legacy étaient identiques à la ligne près.

`compteurIdentifiants` remplace les identifiants du legacy, fabriqués avec `Date.now()` et `Math.random()`, tous deux interdits ici. Les objets s'appellent donc `bonus-0`, `malus-1`, `zone-2`. Deux parties de même graine donnent les mêmes identifiants.

### Comment les apparitions remplacent les minuteries

C'est le point le plus important de l'étape, et le fichier `planification.ts` ne fait que cela.

```ts
avancerUneEcheance(etat, dtMs, 'bonusMs', tirerIntervalle, declencher);
```

Un compte à rebours vit dans l'état, décroît du temps écoulé, déclenche à l'échéance et se réarme. Il n'y a rien à annuler: une partie neuve part d'un état neuf. Dans le legacy, `spawnBonus` et `spawnMalus` se replanifiaient par `setTimeout` sans jamais être annulées, et étaient relancées à chaque début de partie: après cinq parties, les bonus apparaissaient cinq fois plus vite. C'est ce qui donnait la sensation d'un jeu qui se dérègle et redevient normal après un redémarrage du serveur.

Si un battement franchit plusieurs échéances, elles se produisent toutes. Le nombre d'apparitions ne dépend donc pas du découpage du temps: vingt appels à cinquante millisecondes et un appel d'une seconde produisent les mêmes apparitions.

Première tentative dès le premier battement pour les bonus et les malus, comme le legacy qui appelait `spawnBonus` au lancement de la partie; la première zone attend son intervalle de quinze secondes, comme lui aussi.

### Ce que le journal du battement contient de plus

```ts
type EvenementPartie = CaptureDeJoueur | DestructionDeBotNoir | BonusRamasse | MalusRamasse;
```

`MalusRamasse` porte la liste de ses `victimes`: le serveur de l'étape 2.2 y trouvera directement qui prévenir de sa bonne fortune et qui prévenir du contraire, ce que le legacy calculait au moment d'émettre.

### Les réglages sont désormais en groupes

`ReglagesPartie` gagne trois groupes, `bonus`, `malus` et `zones`, avec les valeurs du legacy. Comme les groupes sont imbriqués, la fusion avec les valeurs par défaut descend dedans:

```ts
creerEtatInitial({ graine: 1, reglages: { bonus: { types: { vitesse: { dureeS: 25 } } } } });
// le taux d'apparition de la vitesse et les deux autres bonus restent aux valeurs par defaut
```

C'est `completerReglages` de `packages/shared` qui s'en charge, testée pour elle-même. Un champ explicitement à `undefined`, ce qui peut arriver depuis le réseau, n'efface pas la valeur par défaut.

### L'ordre d'un battement

1. le journal du battement précédent est effacé;
2. chaque joueur applique son entrée et se déplace, puis ses protections et ses effets se rapprochent de leur fin;
3. les zones vieillissent, apparaissent, et agissent sur les bots;
4. les objets posés vieillissent, et de nouveaux apparaissent;
5. on relève les contacts entre entités et on en tire les conséquences, captures comprises;
6. les joueurs ramassent les objets sur lesquels ils se trouvent.

L'ordre des deux dernières étapes est celui du legacy, où un joueur résolvait ses captures avant de ramasser ce qui traînait à ses pieds. **Un bonus d'invincibilité ramassé ne protège donc qu'à partir du battement suivant.**

## Fichiers créés ou modifiés

Créés, dans `packages/sim/src/`

- `effets.ts`: ce qu'un joueur porte et pour combien de temps. Portage de `updatePlayerBonuses` (legacy/server.js:627) et des trois indicateurs de `Player`.
- `effets.test.ts`: 15 tests. Cumul des bonus, renouvellement des malus, expiration à la milliseconde près.
- `objets.ts`: les bonus et malus posés sur la carte. Portage de `spawnBonus` (:1579), `spawnMalus` (:651), `handleBonusCollection` (:1614), `handleMalusCollection` (:684), `updateBonusItems` (:1499), `updateMalusItems` (:1477), `cleanExpiredBonuses` (:1495) et du ramassage écrit en ligne dans `detectCollisions` (:1737 à 1761).
- `objets.test.ts`: 30 tests. Pose, vieillissement, apparitions, plafond des malus, ramassage, déterminisme.
- `zones.ts`: les zones spéciales. Portage de `SpecialZone` (:487), `manageSpecialZones` (:803) et de l'application des effets, qui vivait dans `sendUpdates` (:1809).
- `zones.test.ts`: 29 tests. Géométrie, vie et mort, les quatre effets, les murs.
- `planification.ts`: les apparitions sans minuterie. Remplace le mécanisme du défaut X1.
- `planification.test.ts`: 9 tests. Échéances, rattrapage, tirage de l'intervalle.

Créés, dans `packages/shared/src/`

- `reglages.test.ts`: 7 tests sur la fusion des réglages et les valeurs du legacy.

Modifiés

- `packages/shared/src/constantes.ts`: les catalogues `TYPES_BONUS`, `TYPES_MALUS` et `TYPES_ZONE`, les constantes `OBJETS` et `ZONES`.
- `packages/shared/src/reglages.ts`: les trois groupes de réglages, `PartielProfond` et `completerReglages`.
- `packages/shared/src/index.ts`: les nouveaux types et constantes.
- `packages/sim/src/etat.ts`: les effets des joueurs, les objets, les zones, les comptes à rebours, le compteur d'identifiants, `identifiantSuivant`, `bonusActif`, `malusActif`, `estInvincible`; `estInvulnerable` lit maintenant la durée du bonus.
- `packages/sim/src/moteur.ts`: les nouveaux systèmes dans le battement, le multiplicateur de vitesse, l'inversion des commandes, la décroissance des effets.
- `packages/sim/src/capture.ts`: `estInvincible(joueur)` au lieu du champ disparu.
- `packages/sim/src/index.ts`: le point d'entrée expose les effets, les objets, les zones et la planification.
- `packages/sim/src/moteur.test.ts`: 11 tests ajoutés sur les effets dans le battement.
- `packages/sim/src/etat.test.ts`, `capture.test.ts`, `contacts.test.ts`: reprise des tests qui posaient `invincibiliteActive`.
- `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/etape-1-4.md`: voir plus bas.

Aucune modification de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 101 tests unitaires, dont 83 dans quatre nouveaux fichiers de `packages/sim` (15 effets, 30 objets, 29 zones, 9 planification), 7 dans un nouveau fichier de `packages/shared` (réglages), et 11 dans `moteur.test.ts`.
- Résultat: **428 tests Vitest passent, 0 échec** (327 préexistants, plus 101 nouveaux).
- Couverture de `packages/sim`: **99,83 pour cent** des instructions, 99,71 pour cent des branches, contre 99,71 et 99,55 au handoff 1.3. Elle monte. La cible reste 80 à 90. `packages/shared` est à 100 pour cent.
- `effets.ts`, `objets.ts`, `zones.ts`, `planification.ts`, `etat.ts`, `moteur.ts` sont à 100 pour cent. Seules lignes non couvertes du paquet: le repli de `couleurUnique` quand trente-deux tirages tombent tous sur une couleur interdite, déjà signalé aux handoffs 1.1 à 1.3, hors d'atteinte en pratique.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: verte au dernier `pnpm verify`.

## Décisions et écarts au plan

Les écarts à la fiche sont consignés dans la section « Réconciliation » de `docs/plan/etape-1-4.md`. Les décisions de fond sont au journal de `docs/design/README.md`, datées du 14 août 2026. En résumé:

1. **Quatre fichiers au lieu du seul `bonus.ts` annoncé par le handoff 1.3.** Un effet porté par un joueur, un objet posé sur la carte, une zone et une planification sont quatre sujets distincts.

2. **Le moteur expire les trois bonus.** Le legacy n'expirait que l'invincibilité côté serveur; la vitesse et la révélation restaient armées indéfiniment, et c'est le client qui les arrêtait au bout de dix secondes. La durée jouée est préservée, l'autorité change de camp. Sans cela, le bonus de vitesse que le moteur applique lui-même durerait toute la partie.

3. **La vitesse et les commandes inversées sont appliquées par le moteur.** Le facteur mobile du legacy, lui, n'est pas porté: il n'a jamais été un réglage d'équilibrage, seulement la faille S2 vue sous un autre angle. Le plafond de multiplicateur du legacy est conservé bien qu'aucun cumul ne puisse aujourd'hui dépasser 1,7.

4. **Un bonus se cumule, un malus se renouvelle.** Le premier est le comportement à préserver numéro 10. Le second est ce que faisait le client du legacy, seul endroit où un malus vivait: il inscrivait une fin à « maintenant plus la durée ». Les durées d'un même malus étant fixes, un renouvellement ne raccourcit jamais rien.

5. **Les forces des zones et la probabilité du chaos sont ramenées à la seconde.** Même raison que pour les vitesses à l'étape 1.1 (défaut X17): le legacy poussait un bot de trois ou quatre pixels par battement, sans regarder le temps. La probabilité du chaos, cinq pour cent par battement, devient une probabilité par unité de temps: sur deux fois plus de temps, un bot a bien deux fois plus de chances d'avoir changé de couleur, et non deux fois plus de tirages.

6. **Une zone ne pousse plus un bot dans un mur** (défaut X25). La poussée passe par la résolution de déplacement, comme tout autre mouvement.

7. **Un bonus peut apparaître à côté d'un joueur.** L'apparition d'un objet évite les murs mais ne respecte pas la distance de sécurité, contrairement à celle d'un joueur ou d'un bot: apparaître collé à un adversaire est une mauvaise expérience, tomber sur un bonus n'en est pas une.

8. **Quatre défauts découverts en portant (règle 7).** Décrits dans l'audit, section « Défauts découverts à l'étape 1.4 »: X22 (la zone d'invisibilité n'a aucun effet serveur, et sa remise à zéro dépend de l'ordre des zones), X23 (l'expiration de l'invincibilité cumulée repart de la dernière collecte, si bien que serveur et client ne s'accordent pas), X24 (le serveur n'expire ni la vitesse ni la révélation), X25 (les zones poussent les bots à travers les murs). Tous corrigés par conception.

9. **Ce qui n'est délibérément pas porté.** `clearMalusEffects` (:676) ne fait que demander aux clients d'effacer leurs effets visuels. `shouldBlink` et `getBlinkState` calculent une opacité et une échelle depuis `Date.now()`: c'est de l'animation, le client la retrouvera dans `dureeDeVieRestanteMs` et le seuil de clignotement. La forme rectangulaire de `SpecialZone` est du code mort, `generateRandomShape` ne produisant que des cercles. Le champ `isInvisible` est mort (X22). Le legacy ne faisait rien pour un joueur sans socket connectée: le moteur ne connaît pas les sockets.

## Ce que la prochaine étape doit savoir

- **Le client ne doit pas inverser les commandes de son côté** (étape 4.1). Le moteur s'en charge; les inverser deux fois les remettrait à l'endroit.
- **Le client calcule lui-même l'invisibilité** à partir des zones reçues, comme le fait déjà celui du legacy. `estCache(etat, position)` lui donne la réponse.
- **Le flou et le négatif restent de l'affichage.** Le moteur ne fait que porter leur durée restante.

## Problèmes connus et dette

- **Les bots ne bougent toujours pas d'eux-mêmes.** Les zones de répulsion et d'attraction les déplacent, mais leur errance et la chasse du bot noir sont l'étape 1.5. Une conséquence à connaître: un bot poussé par une zone est aujourd'hui le seul bot qui se déplace.
- **La question ouverte du handoff 1.3 reste ouverte**: les bots blancs effacent les couleurs par contagion (défaut X20). Elle n'a pas été tranchée, et la correction, si elle est décidée, tient en une ligne à l'étape 1.5.
- **Aucune optimisation spatiale**, inchangé depuis 1.3. S'y ajoutent les zones, qui parcourent tous les bots à chaque battement, et le ramassage, qui compare chaque joueur à chaque objet. Ces deux-là sont négligeables devant le relevé des contacts: au plus trois zones, au plus une dizaine d'objets. La grille spatiale reste l'étape 5.2, conditionnée à la mesure de 5.1.
- **La zone de chaos consomme un tirage par bot présent et par battement.** Avec cent bots dans une grande zone, cela fait deux mille tirages par seconde. Sans conséquence mesurée, mais c'est le premier endroit à regarder si 5.1 trouve les zones coûteuses.
- **Les tests des zones ne s'appuient pas sur la caractérisation**, qui n'a pas pu figer ce domaine à l'étape 0.2: forme, durée et effets dépendaient tous de `Math.random` et de `Date.now`. Ils s'appuient sur la lecture du code d'origine. C'est le domaine du portage le moins bien filet-de-sécurisé.
- **Le facteur mobile et le plafond de multiplicateur ne servent à rien aujourd'hui.** Le premier n'est pas porté (autorité serveur, étape 1.6), le second est appliqué mais ne peut pas mordre.
- **`packages/server` et `packages/client` restent vides.** Normal à ce stade.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 1.3.

## Prochaine action exacte

Dans une conversation neuve: créer `packages/sim/src/bots.ts` et y porter le comportement des bots ordinaires, c'est-à-dire l'errance de `Bot.update` (legacy/server.js:961, dans la classe `Bot` déclarée à la ligne 941), avec son changement de direction périodique et sa détection de blocage, rendue déterministe par le générateur à graine. Puis le bot noir et sa chasse.

Cinq points à avoir en tête dès le début de l'étape 1.5:

1. **Les bots existent déjà dans l'état depuis l'étape 1.3**, en données seulement. Il n'y a rien à créer côté modèle, seulement du comportement à ajouter.
2. **Un bot avance à 100 pixels par seconde, un joueur à 150.** Les constantes sont dans `VITESSES`. Le bot noir avance exactement comme un bot ordinaire: décision du 13 août 2026, défaut X13.
3. **Le défaut X12 ne doit pas être reproduit**: dans le legacy, une capture par un bot noir repeint les bots perdus en blanc **et** en crée autant de nouveaux, si bien que la population de bots dérive à la hausse pendant la partie.
4. **Le défaut X14 ne doit pas être reproduit non plus**: le bot noir lisait les réglages par défaut au lieu de ceux de la partie. Les réglages du bot noir restent à ajouter à `ReglagesPartie`, sur le modèle des trois groupes ajoutés à l'étape 1.4.
5. **La capture d'un joueur par un bot noir n'est pas portée**, ni le compteur `capturedByBlackBot`. C'est le travail de 1.5.

Lire `tests/caracterisation/collisions.test.ts` avant de porter: il décrit le comportement de déplacement figé sur le legacy.

## Étape suivante

Fiche à lire: `docs/plan/etape-1-5.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.5 suit bien 1.4.
