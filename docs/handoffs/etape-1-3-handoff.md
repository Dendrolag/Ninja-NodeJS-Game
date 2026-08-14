# Handoff - Étape 1.3 Capture et score

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Porter la résolution des captures et le calcul des scores dans le cœur de simulation pur, validés contre les tests de caractérisation.

## Ce qui a été fait

- Les bots entrent dans l'état, en données seulement: une identité, une place, une couleur, une nature. Aucun comportement, celui-ci reste l'étape 1.5.
- La capture d'un joueur par un autre: transfert de tous ses bots d'un coup, historique des deux côtés, réapparition de la victime avec une couleur neuve.
- La capture d'un bot par un joueur, et la contagion de couleur entre bots, séparées de la détection de contact.
- La destruction d'un bot noir par un joueur invincible.
- Le score et le classement, calculés depuis l'état et jamais rangés dedans.
- La règle de résolution du mode Classique, branchée dans le battement à l'endroit laissé libre par l'étape 1.2, et remplaçable par une autre.
- Un journal d'événements dans l'état: ce qui vient de se passer, à destination du futur serveur et du futur client.
- Deux défauts de l'audit découverts en portant, X20 et X21. Le second corrigé par conception, le premier porté tel quel avec une question ouverte ci-dessous.
- Quatre-vingt-deux tests unitaires ajoutés. Couverture de `packages/sim`: 99,71 pour cent, en hausse.

## Ce que le moteur sait faire de plus, en une page

Le contrat de `tick(etat, entrees, dtMs)` est inchangé, y compris son nombre d'arguments.

### Les bots vivent dans l'état, sans comportement

```ts
interface Bot extends Entite {
  readonly type: 'bot' | 'botNoir';
}

interface EtatPartie {
  // ... inchangé
  readonly bots: Readonly<Record<IdentifiantEntite, Bot>>;
  readonly evenements: readonly EvenementPartie[];
}
```

Bots ordinaires et bots noirs partagent **une seule collection**, là où le legacy tenait deux tables séparées (`bots` et `blackBots`). Leur nature se lit dans leur champ `type`, et un seul relevé de contacts les parcourt tous. `ajouterBot` et `retirerBot` les posent et les retirent; `entiteDe` et `toutesLesEntites` donnent accès aux joueurs et aux bots ensemble.

Pourquoi maintenant, alors que la fiche les plaçait en 1.5: le score d'un joueur **est** le nombre de bots qui portent sa couleur. Sans bots, les points 2, 3 et 4 de la fiche n'auraient eu aucune entité sur laquelle s'appliquer.

### Ce que le joueur porte en plus

```ts
interface Joueur extends Entite {
  // ... inchangé
  readonly invincibiliteActive: boolean;
  readonly captures: number;
  readonly joueursCaptures: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
  readonly capturesSubies: Readonly<Record<IdentifiantEntite, HistoriqueCapture>>;
  readonly botsGagnesAuTotal: number;
  readonly botsNoirsDetruits: number;
}
```

`invincibiliteActive` est un simple indicateur: **rien ne l'active à cette étape**, son cycle de vie est l'étape 1.4. Il est déjà lu par deux règles, un joueur invincible ne peut pas être capturé, et lui seul détruit les bots noirs qu'il touche. `estInvulnerable` couvre désormais les deux cas, protection d'apparition et invincibilité, là où le legacy testait souvent les deux séparément alors que le second contient le premier.

`botsControlled` n'est toujours pas porté: c'est le défaut X11, un compteur remis à zéro à cinq endroits et incrémenté nulle part. C'est `botsGagnesAuTotal` qui porte la valeur réelle.

### Comment l'état signale une capture au futur client

C'est le point 5 de la fiche. Un journal, vidé au début de chaque battement:

```ts
type EvenementPartie = CaptureDeJoueur | DestructionDeBotNoir;

interface CaptureDeJoueur {
  type: 'captureJoueur';
  attaquant: IdentifiantEntite;
  victime: IdentifiantEntite;
  botsTransferes: number;
  nouvelleCouleurVictime: Couleur;
  position: Position; // là où la victime se trouvait au moment du contact
}

interface DestructionDeBotNoir {
  type: 'botNoirDetruit';
  joueur: IdentifiantEntite;
  botNoir: IdentifiantEntite;
  position: Position;
  points: number; // quinze
}
```

`etat.evenements` décrit **ce battement-ci**, jamais l'histoire de la partie: celle-ci se lit dans les compteurs des joueurs. Le moteur ne connaît ni son, ni animation, ni notification; il constate, il n'annonce pas. C'est le serveur qui en fera des messages à l'étape 2.2.

Une conséquence à connaître: `tick` renvoie l'état reçu tel quel quand la partie est terminée, journal compris. Le dernier journal d'une partie reste donc lisible après la fin.

### Par quel point d'extension brancher une autre règle de capture

C'est le point 2 de la définition de terminé. Le relevé des contacts est de la géométrie, commune à tous les modes; ce qu'on en déduit est la règle du mode.

```ts
type RegleDeResolution = (etat: EtatPartie, contacts: readonly Contact[]) => EtatPartie;

resoudreContacts(etat, contacts); // mode Classique par défaut
resoudreContacts(etat, contacts, uneAutreRegle); // un autre mode
```

`regleClassique` est exportée sous ce nom. Un mode tactique, qui capturera par cône directionnel et non par simple proximité, s'écrira comme une autre fonction de ce type. Aucune autre ligne du moteur ne changera. C'est l'application concrète de la décision du 29 juin sur les jeux de règles enfichables, et **cette autre règle n'est pas construite ici**, conformément à la fiche.

La règle ne s'appuie pas sur l'ordre des entités dans un contact: elle regarde leur nature, pas leur rang. Un appelant qui construit sa propre liste de contacts obtient le même résultat, ce qui est couvert par un test.

### Qui capture qui, quand deux joueurs se heurtent

C'est la décision de conception la plus importante de l'étape, annoncée par le handoff 1.2.

Le legacy appelait la détection sur la seule entité qui venait de bouger, et cette entité était l'attaquant. Une collision frontale se jouait donc à la course au message: le gagnant était, en pratique, celui qui avait la meilleure connexion. Ici tout le monde avance dans le même battement et les paires n'ont pas de vainqueur désigné. La règle retenue:

1. Si un seul des deux a le droit de capturer l'autre, c'est lui.
2. Si les deux l'ont, **le générateur à graine tire au sort**.

Le tirage remplace la loterie du réseau par une loterie équitable et reproductible: à graine égale, la même partie se rejoue à l'identique. La règle plus simple « le premier arrivé dans la partie l'emporte » aurait donné un avantage permanent au même joueur pendant trois minutes.

Deux garde-fous complètent la règle, tous deux couverts par des tests:

- **Une paire ne produit jamais deux captures.** Sans cela, la victime capturerait son attaquant en retour dans le même battement.
- **Une victime déjà replacée ne capture plus personne ensuite.** Une capture la téléporte à l'autre bout de la carte: les contacts relevés plus tôt qui la concernaient encore ne décrivent plus rien de réel, et ils sont écartés. L'inverse reste possible et voulu: dans une mêlée à trois, un joueur peut en capturer un puis se faire capturer par un troisième dans le même battement.

## Fichiers créés ou modifiés

Créés, dans `packages/sim/src/`

- `capture.ts`: l'effet d'une capture donnée, écrit une fois, utilisable par n'importe quelle règle. Portage de `handlePlayerCapture` (legacy/server.js:737), de la capture de bot écrite en ligne dans `detectCollisions` (:1686 à 1707) et de la destruction d'un bot noir (:1718 à 1735).
- `capture.test.ts`: 29 tests. Transfert, historiques, réapparition, les quatre refus, contagion, destruction de bot noir.
- `score.ts`: le score et le classement. Portage de `calculatePlayerScores` (:1766).
- `score.test.ts`: 14 tests. Le stock contre le cumul, le départage, le retour à zéro après capture.

Modifiés

- `packages/sim/src/etat.ts`: les bots, les compteurs de capture des joueurs, l'indicateur d'invincibilité, le journal d'événements, `ajouterBot`, `retirerBot`, `entiteDe`, `toutesLesEntites`; `positionsOccupees` compte désormais les bots, `estInvulnerable` couvre les deux protections.
- `packages/sim/src/etat.test.ts`: 11 tests ajoutés.
- `packages/sim/src/contacts.ts`: le relevé inclut les bots; `resoudreContacts` accepte une règle; `regleClassique` écrite et branchée.
- `packages/sim/src/contacts.test.ts`: 22 tests ajoutés, et le test qui documentait l'absence de résolution remplacé.
- `packages/sim/src/moteur.ts`: le journal repart vide à chaque battement.
- `packages/sim/src/moteur.test.ts`: 6 tests ajoutés sur les captures dans le battement.
- `packages/sim/src/index.ts`: le point d'entrée expose les captures, le score, la règle de résolution et les bots.
- `packages/shared/src/constantes.ts` et `index.ts`: `SCORE.POINTS_PAR_BOT_NOIR`, valeur du legacy.
- `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/etape-1-3.md`: voir plus bas.

Aucune modification de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 82 tests unitaires, dont 43 dans deux nouveaux fichiers (29 pour la capture, 14 pour le score) et 39 dans trois fichiers existants (22 pour les contacts, 11 pour l'état, 6 pour le moteur).
- Résultat: **327 tests Vitest passent, 0 échec** (245 préexistants, plus 82 nouveaux).
- Couverture de `packages/sim`: **99,71 pour cent** des instructions, 99,55 pour cent des branches, contre 99,54 et 99,30 au handoff 1.2. Elle monte. La cible reste 80 à 90.
- `capture.ts`, `score.ts`, `contacts.ts`, `etat.ts` et `moteur.ts` sont à 100 pour cent. Seules lignes non couvertes du paquet: le repli de `couleurUnique` quand trente-deux tirages tombent tous sur une couleur interdite, déjà signalé aux handoffs 1.1 et 1.2, hors d'atteinte en pratique.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: verte au dernier `pnpm verify`.

## Décisions et écarts au plan

1. **Les bots sont portés ici, en données seulement.** Détaillé plus haut. Le handoff 1.2 recommandait plutôt d'écrire la règle sur le type `Entite` générique et de la brancher en 1.5, au motif que cela respecte mieux le périmètre. Cette option a été écartée: elle aurait laissé les points 2, 3 et 4 de la fiche sans aucune entité sur laquelle s'appliquer, donc sans test réel, et 1.5 aurait hérité à la fois du comportement des bots et du branchement des règles écrites ici. Le périmètre est tenu autrement: les bots portés n'ont **aucun comportement**, pas une ligne de déplacement ni de décision.

2. **Le score se déduit de l'état, il n'y est pas rangé.** Le point 4 de la fiche demandait qu'une capture « mette à jour les scores dans l'état ». C'est le cas, mais indirectement: une capture repeint des bots, et le score se lit dans les bots. Le stocker aurait créé une seconde vérité à tenir à jour à la main, avec le risque qu'elle diverge de la première: c'est exactement la maladie du legacy, où un compteur était remis à zéro à cinq endroits et incrémenté nulle part. Conséquence heureuse: le comportement à préserver numéro 1, « le score est un stock », devient une propriété structurelle et non une règle à respecter.

3. **Le total du classement est nommé pour ce qu'il est.** Le legacy appelait `currentBots` un total qui comprenait aussi les points de bots noirs, ce qui laissait croire à un nombre de bots. La ligne de score expose maintenant `points`, `botsPortes` et `pointsBotsNoirs` séparément.

4. **La capture d'un joueur par un bot noir n'est pas portée.** Elle relève du comportement du bot noir, donc de l'étape 1.5. Le compteur `capturedByBlackBot` n'est pas posé non plus, pour ne pas installer un champ dont personne ne sait encore se servir. Le défaut X12 de l'audit (la population de bots qui augmente à chaque capture par un bot noir) attend donc 1.5, où il ne devra pas être reproduit.

5. **Une seule collection pour les bots et les bots noirs.** Le legacy tenait deux tables séparées qui ne se rencontraient jamais, ce qui explique deux règles: un bot noir ne se repeint jamais, et un contact entre deux bots noirs ne produit rien. Les deux sont conservées, mais elles s'expriment maintenant par un test sur la nature de l'entité, plus par le hasard de la structure de données.

6. **Deux défauts découverts en portant (règle 7).** Décrits dans l'audit, section « Défauts découverts à l'étape 1.3 ».
   - **X21**, corrigé par conception: `handlePlayerCapture` ne vérifiait pas la couleur de sa victime, cette condition vivant chez son unique appelant. Appelée directement sur deux joueurs de même couleur, elle comptait une capture et « transférait » à l'attaquant ses propres bots. La vérification est maintenant dans la règle d'autorisation, appelée par la capture elle-même: aucun appelant ne peut plus l'oublier.
   - **X20**, porté tel quel, avec une question ouverte ci-dessous.

7. **Le contact entre un joueur et un bot est symétrique.** Dans le legacy, un bot qui entrait dans un joueur ne produisait rien, et c'est le déplacement suivant du joueur, vingt millisecondes plus tard, qui repeignait le bot. Ici le contact repeint le bot quel que soit celui qui a bougé. Le résultat observable est le même, à un battement près, et il ne dépend plus du débit de messages.

## Question ouverte, à trancher par le porteur du projet

**Les bots blancs effacent les couleurs, et personne ne l'a peut-être jamais remarqué** (défaut X20).

Dans le legacy, un bot qui touche un autre bot de couleur différente lui impose la sienne, sans condition. Comme le serveur fait cela pour chaque bot vingt fois par seconde, la couleur diffuse dans les deux sens: un bot **blanc**, c'est-à-dire non capturé, repeint en blanc un bot de couleur. Un joueur perd donc des points sans que personne ne l'attaque.

C'est un comportement réel du jeu depuis deux ans, caractérisé à l'étape 0.2. Il a été porté tel quel, conformément à la règle « le legacy fait foi sur le gameplay ». La question est de savoir s'il est voulu:

- Si oui, rien à faire: c'est une pression permanente qui empêche les scores de se figer, et elle est déjà en place.
- Si non, la correction tient en une ligne: n'autoriser la contagion que depuis un bot **de couleur**, jamais depuis un bot neutre. Elle serait à faire à l'étape 1.5, quand les bots se déplaceront et que l'effet deviendra observable en jeu.

Précision utile pour trancher: ce n'est pas un clignotement. Dans un même passage, le plus ancien des deux bots l'emporte, et le portage reproduit exactement cette règle.

## Problèmes connus et dette

- **Aucune optimisation spatiale.** `detecterContacts` compare toujours toutes les paires, et il y a désormais des bots dedans. Avec cinquante bots et six joueurs, cela fait un peu plus de mille cinq cents comparaisons par battement; avec plus de cent bots et cinquante bots noirs, plusieurs dizaines de milliers. C'est volontaire: la grille spatiale est l'étape 5.2, conditionnée à la mesure de 5.1. C'est le premier endroit à regarder si 5.1 trouve le moteur lent.
- **La résolution des contacts recopie l'état à chaque contact résolu.** Chaque capture reconstruit la table des joueurs et celle des bots. C'est négligeable tant que les captures sont rares, ce qu'elles sont, mais la contagion entre bots, elle, ne l'est pas: chaque bot repeint reconstruit la table entière des bots. À surveiller en 1.5, quand les bots bougeront et se toucheront en permanence.
- **Le tirage au sort du duel consomme le générateur à graine.** C'est voulu et sans conséquence sur la reproductibilité, mais cela signifie qu'un test qui veut un vainqueur connu doit rendre l'un des deux joueurs incapable de capturer, plutôt que d'espérer un résultat. Le mécanisme est documenté dans le fichier de tests du moteur.
- **La comparaison profonde de deux états reste lente dans les tests.** Inchangé depuis 1.2: `toEqual` sur deux états entiers compare octet par octet deux terrains de 375 kilo-octets. Les tests écrits à cette étape comparent des morceaux d'état plutôt que l'état entier, ce qui suffit à les garder rapides. La suite complète tient en 4 secondes.
- **Le facteur mobile et le multiplicateur de bonus ne sont toujours pas appliqués.** Inchangé depuis 1.1: le premier relève de l'autorité serveur (étape 1.6, faille S2), le second des bonus (étape 1.4).
- **`packages/server` et `packages/client` restent vides.** Normal à ce stade.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1, 0.2, 1.1 et 1.2.

## Prochaine action exacte

Dans une conversation neuve: créer `packages/sim/src/bonus.ts` et y porter les bonus, les malus et les zones spéciales avec leurs effets et leurs durées, en commençant par le ramassage, qui est le morceau de `detectCollisions` (legacy/server.js:1735 à 1760) délibérément laissé de côté aux étapes 1.2 et 1.3.

Quatre points à avoir en tête dès le début de l'étape 1.4:

1. **Les durées de bonus se cumulent, et c'est voulu.** Deux bonus de vitesse ramassés coup sur coup donnent vingt secondes, pas dix. C'est le comportement à préserver numéro 10 de CLAUDE.md, confirmé comme intentionnel le 13 août 2026.
2. **Un malus frappe les autres, pas celui qui le ramasse.** Comportement à préserver numéro 4.
3. **`invincibiliteActive` existe déjà sur le joueur et attend son cycle de vie.** Rien ne l'active aujourd'hui; deux règles la lisent déjà. C'est l'étape 1.4 qui doit l'allumer au ramassage du bonus et l'éteindre à l'expiration, en durée restante décroissante comme la protection d'apparition, jamais en date absolue.
4. **Le ramassage n'est pas un contact entre entités.** Bonus et malus sont des objets posés sur la carte, à un seuil de quinze pixels et non vingt. Ils ne passent donc pas par `detecterContacts`, qui ne connaît que les entités.

Lire `tests/caracterisation/effets.test.ts` avant de porter: il décrit précisément ce que le portage doit reproduire, et c'est le domaine où le legacy a le plus de surprises (défaut X1, la fuite de minuteries).

## Étape suivante

Fiche à lire: `docs/plan/etape-1-4.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.4 suit bien 1.3.
