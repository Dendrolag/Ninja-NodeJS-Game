# Handoff - Étape 0.2 Tests de caractérisation du legacy

Date: 13 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Figer le comportement actuel du jeu sur les points sensibles, sous forme de tests de référence, avant tout portage.

## Ce qui a été fait

- Un harnais qui rend `legacy/server.js` testable sans le modifier, sans ouvrir de serveur, sans lire de fichier et sans laisser tourner de minuterie.
- Quatre suites de caractérisation couvrant les quatre domaines demandés: capture, collisions, score, effets.
- Une cinquième suite qui vérifie le harnais lui-même.
- Six instantanés de référence, versionnés.
- Quatre-vingt-treize tests ajoutés, tous au vert. `legacy/` n'a pas été touché.

### Comment le legacy a été rendu testable

C'est le point technique central de la session, et celui qu'il faut comprendre avant de toucher à ces tests.

`legacy/server.js` n'est pas importable: dès son évaluation, il ouvre Express, crée un serveur Socket.IO, décode une image de collision avec la bibliothèque native `canvas`, démarre une boucle de jeu à vingt battements par seconde et écoute un port. Il garde en plus tout son état dans des variables de module, partagées par le processus entier.

Le harnais lit donc le fichier **comme du texte**, remplace ses seules lignes d'import, et évalue le reste dans une fonction dont les paramètres portent les noms des éléments à contrôler: `Date`, `Math`, `setTimeout`, `setInterval`, `console`, plus les dépendances externes. En JavaScript un paramètre masque la globale de même nom, si bien que le code d'origine n'est **pas retouché**: il continue d'appeler `Date.now()` et `Math.random()`, mais ces appels atteignent l'horloge et le hasard que le test lui fournit.

Trois conséquences:

1. Chaque appel à `creerHarnais()` produit une instance neuve avec son propre état global. La remise à zéro entre deux scénarios est gratuite, et c'est ce qui rend la suite fiable malgré l'état global du legacy.
2. Le temps et le hasard sont déterministes, donc les instantanés sont stables.
3. Aucune entrée-sortie réelle.

Les constantes de `legacy/game-constants.js` sont chargées de la même façon, dans la même portée: chaque instance a sa propre copie mutable, accesseurs dynamiques de `GAME_CONFIG` compris, défauts inclus.

**C'est exactement ce que l'étape 1.1 remplacera proprement**: le temps injecté devient le paramètre `dt` du moteur, le hasard à graine devient le générateur de `packages/shared`. Ici c'est plaqué de l'extérieur sur du code qui n'a pas été conçu pour; là ce sera à la source.

## Fichiers créés ou modifiés

Créés

- `tests/caracterisation/harnais/charger-legacy.ts`: le harnais. Chargement, instrumentation, substituts de dépendances, fabrication d'images de collision factices. Porte l'explication complète en tête de fichier.
- `tests/caracterisation/harnais/alea.ts`: générateur pseudo-aléatoire à graine (mulberry32) qui remplace `Math.random` pendant les scénarios. Sert uniquement au harnais, il ne préfigure pas celui de `packages/shared`.
- `tests/caracterisation/harnais/scenario.ts`: raccourcis de lecture partagés par les suites (sortie de la protection de spawn, comptage des bots par couleur, résumé d'un joueur).
- `tests/caracterisation/capture.test.ts`: 25 tests. Capture de joueur, capture de bot, capture par bot noir, destruction d'un bot noir, refus de capture.
- `tests/caracterisation/collisions.test.ts`: 31 tests. Dérivation de la carte depuis l'image, limites de carte, contact avec un mur, résolution du déplacement, vitesses relatives, distance de sécurité au spawn, contacts entre entités.
- `tests/caracterisation/score.test.ts`: 12 tests. Calcul, classement, départage, et le score comme stock.
- `tests/caracterisation/effets.test.ts`: 18 tests. Bonus, expiration, malus et leur cible.
- `tests/caracterisation/harnais.test.ts`: 7 tests. Vérifie le harnais, pas le jeu.
- `tests/caracterisation/README.md`: à quoi sert ce dossier et comment il fonctionne.
- `tests/caracterisation/__snapshots__/*.snap`: quatre fichiers d'instantanés, six instantanés au total.

Modifié

- `docs/plan/etape-0-2.md`: ajout d'une section « Réconciliation avec le dépôt », voir plus bas.

Aucune modification de `legacy/`, ni de `packages/`, ni de la configuration.

## Tests

- Ajoutés: 93 tests de caractérisation, répartis en cinq fichiers.
- Résultat: **108 tests Vitest passent, 0 échec** (15 préexistants plus 93 nouveaux). **4 tests Playwright passent, 0 échec.**
- Couverture de `packages/sim`: toujours sans objet, le paquet est vide. La mesure commence à l'étape 1.1. Ces tests ne visent pas `packages/`, ils lisent le legacy.
- Types, linter et formatage: tous au vert.
- État de la CI: le workflow lance `pnpm test`, qui inclut `tests/**/*.test.ts`. La nouvelle suite est donc exécutée sans modifier la configuration.

## Comportements caractérisés

### Capture

- Une capture transfère **tous** les bots de la victime d'un seul coup.
- Historique tenu des deux côtés (`capturedPlayers`, `capturedBy`), cumulé sur les captures répétées.
- La victime réapparaît ailleurs, avec une couleur différente de la sienne et de celle de l'attaquant, et une nouvelle protection de 3 secondes.
- Refus de capture dans trois cas: victime invincible par bonus, victime encore protégée par son apparition, attaquant dans son délai d'une seconde. Le délai est testé en inégalité stricte: refus à exactement 1000 ms, acceptation à 1001.
- Capture d'un bot par contact en dessous de 20 pixels, borne exclue. Un bot repeint un autre bot au contact (contagion de couleur).
- Bot noir: perte de la moitié des bots, arrondie à l'entier inférieur, joueur conservé dans sa couleur, délai propre de 2 secondes.
- Bot noir détruit par un joueur invincible: suppression du bot, 15 points.

### Collisions

- Un pixel est un mur quand la moyenne de ses trois composantes est **strictement inférieure à 128**. Testé aux bornes, et sur une teinte asymétrique (bleu pur, moyenne 85, donc mur).
- La grille produite prend les dimensions de la carte, quelle qu'elle soit.
- Tout point hors carte est un mur. Le contour d'une entité est testé sur seize points, deux cercles concentriques de rayons `r` et `0,7 r`, ce qui donne un dégagement effectif de 16 pixels.
- Résolution du déplacement: mouvement complet, sinon axes séparés (c'est le glissement le long d'un mur), sinon six angles d'essai, sinon immobilité.
- Ramassage d'un bonus ou d'un malus en dessous de 15 pixels, borne exclue. Seuls les joueurs ramassent.
- Instantané de référence: une carte en caractères des positions tenables autour d'un mur.

### Score

- Le score est un **stock**: nombre de bots portant la couleur du joueur à l'instant présent, plus 15 par bot noir détruit.
- Se faire capturer le remet à zéro, sauf les points de bots noirs qui restent acquis.
- Tri par score décroissant, départage par nombre de captures, puis ordre d'arrivée (le tri de JavaScript est stable, le legacy n'a pas de troisième critère).
- `currentBots` (stock) et `totalBotsControlled` (cumul) sont deux choses différentes.

### Effets

- Bonus: vitesse, invincibilité, révélation. Durées lues dans les réglages de la partie. **Les durées se cumulent** quand le même bonus est ramassé deux fois.
- Seul le ramasseur est prévenu d'un bonus.
- **Un malus frappe les autres joueurs, pas celui qui le ramasse.** Le ramasseur reçoit `malusCollected` (une information), les autres reçoivent `applyMalus` (l'effet). Toute la partie reçoit `malusEvent`.
- Durées de malus: inversion 10 s, flou 12 s, négatif 14 s.
- Un objet posé sur la carte expire au bout de 8 secondes.

## Points surprenants rencontrés, et leur classement

Classement selon les trois catégories de la fiche.

### A. Comportements de jeu, caractérisés tels quels

1. **Un malus frappe les autres, pas son ramasseur.** Contre-intuitif, mais c'est le quatrième comportement à préserver de CLAUDE.md. Figé.
2. **Les durées de bonus se cumulent** au lieu de se remplacer. Ramasser deux bonus de vitesse donne vingt secondes. Figé, mais à confirmer: est-ce voulu, ou un effet de bord de l'écriture?
3. **La distance de sécurité au spawn ne s'applique jamais.** `registerEntity` n'est appelée nulle part, donc le registre de `PositionManager` reste vide et `SAFE_SPAWN_DISTANCE` est lettre morte. Un joueur peut réapparaître collé à un bot noir. Cité par la fiche comme exemple à caractériser tel quel: c'est fait, avec en plus un test montrant que le mécanisme fonctionnerait si on l'alimentait.
4. **Les points de bots noirs sont définitivement acquis.** Une capture remet les bots à zéro mais pas ces 15 points par bot noir. Un joueur capturé peut donc rester en tête du classement. Figé.

### B. Défauts de sécurité et de robustesse, NON caractérisés

Conformément à la fiche, ils ne sont pas figés dans un instantané. Traités par conception à l'étape 1.6.

1. `speedBoostActive` et `isMobile` sont crus sur parole quand le client les envoie.
2. Aucune limitation de débit sur aucun événement: la vitesse d'un joueur est proportionnelle à son débit de messages.
3. Le pseudonyme n'est validé nulle part.
4. Le champ `nickname` du chat n'est pas comparé à l'identité de la socket.

**Attention pour l'étape 1.6**: un test de `collisions.test.ts` fige bien les valeurs `3`, `× 1,7` et `× 2`, parce que ce sont des réglages de gameplay fragiles (cinquième comportement à préserver de CLAUDE.md, quatre corrections successives dans le journal des versions). Il ne fige **pas** le fait que le client soit cru sur parole. Quand 1.6 rendra le serveur autoritaire, les nombres doivent survivre, leur source non. Le commentaire est dans le test.

### C. Bugs francs, notés, à ne pas reproduire

Les quatre premiers étaient déjà dans l'audit, les cinq suivants sont nouveaux.

1. **X3, `getValidPosition` plante sur son chemin de secours.** `startTime` n'est jamais déclarée. **Rencontré en vrai pendant cette session**: sur une carte de test de 200 pixels de large, la marge de spawn de 100 pixels fait échouer les cent tentatives, et le legacy lève une `ReferenceError`. Ce n'est donc pas un chemin théorique. Les scénarios concernés utilisent une carte plus grande.
2. **X4, la distance de sécurité au spawn est inerte.** Voir A.3: classé aussi ici, parce que la cause est un branchement oublié, pas une décision de jeu.
3. **X1, fuite de minuteries.** Le harnais enregistre les `setTimeout` et `setInterval` programmés au chargement sans jamais les exécuter. Aucun `clearTimeout` n'existe dans le legacy.
4. **X5, les accesseurs dynamiques de `GAME_CONFIG` ne fonctionnent pas.** Confirmé: `GAME_CONFIG.WIDTH` renvoie toujours 2000.
5. **`botsControlled` n'est jamais incrémenté.** Il est mis à zéro à cinq endroits, lu à un seul (`server.js:794`), où le serveur l'envoie au client dans `playerCapturedEnemy`. Le client reçoit donc toujours zéro. C'est `totalBotsCaptures` qui porte la vraie valeur.
6. **La population de bots augmente à chaque capture par un bot noir.** `captureEntity` repeint en blanc les bots perdus, puis appelle `createWhiteBots(pointsLost)` qui en crée **autant de nouveaux**. Sur huit bots rouges: quatre repeints, quatre créés, soit huit bots blancs et douze bots au total au lieu de huit. Caractérisé avec un commentaire explicite.
7. **Le bot noir avance à 5, pas à 6.** `BlackBot.baseSpeed` lit `GAME_CONFIG.BOT_SPEED`, qui vaut 5. Le réglage `blackBotSpeed: 6` de `DEFAULT_GAME_SETTINGS` n'est lu **nulle part** dans le legacy. Le commentaire du code le dit d'ailleurs: « Utiliser la même vitesse que les autres bots ». **CLAUDE.md et l'audit annoncent tous les deux 6: ils se trompent sur la base v0.8.6.** Deux tests figent la valeur réelle. À trancher à l'étape 1.5: rétablir 6 comme annoncé, ou garder 5 comme joué depuis deux ans. C'est un vrai choix de gameplay, pas une correction évidente.
8. **Deux réglages de partie sont ignorés au profit des valeurs par défaut.** `captureEntity` lit `DEFAULT_GAME_SETTINGS.pointsLossPercent` et le constructeur de `BlackBot` lit `DEFAULT_GAME_SETTINGS.blackBotDetectionRadius`, au lieu de `currentGameSettings`. Changer ces réglages dans le salon n'a donc aucun effet sur la partie. Pire pour le rayon de détection: `sendUpdates` envoie au client la valeur de `currentGameSettings`, si bien que le client affiche un rayon que le serveur n'applique pas.
9. **`canMove` ignore son point de départ.** Ses deux premiers arguments ne sont lus nulle part: c'est un échantillonnage ponctuel, pas un balayage. Conséquence caractérisée: un mur de deux pixels de large se traverse en un seul déplacement. Ce n'est pas un réglage, c'est une limite de méthode. À traiter par conception à l'étape 1.2.

## Décisions et écarts au plan

1. **Zone retenue: `tests/caracterisation/`.** La fiche demandait une zone dédiée sans la nommer.
2. **Le glissement le long d'un mur n'est pas dans `canMove`.** La fiche le range sous les collisions de terrain. `canMove` ne renvoie qu'un booléen; la résolution qui fait glisser vit dans le gestionnaire `move` (`server.js:2604`). Caractérisé là. Le harnais atteint ce gestionnaire en branchant une socket factice sur le vrai gestionnaire de connexion du legacy.
3. **La bibliothèque native `canvas` n'est pas installée**, et l'exiger imposerait une compilation à chaque machine et à la CI. Le décodage de l'image lui est substitué par des pixels connus, et c'est le **vrai code de seuillage du legacy** qui les transforme en carte. Ce qui est testé est donc bien la règle du jeu (seuil à 128), pas le décodeur PNG.
4. **Les cartes de collision réelles de `legacy/assets/maps/` ne sont pas lues.** Pour la même raison, et parce que ce sont du contenu, pas du code (neuvième comportement à préserver de CLAUDE.md). Les scénarios utilisent des cartes synthétiques petites, ce qui les rend lisibles et rapides.
5. **Les instantanés excluent les valeurs tirées au sort** (positions et couleurs de réapparition). Elles dépendent du générateur du harnais, pas du legacy: les figer donnerait une fausse impression de caractérisation. Ces aspects sont vérifiés par des assertions de propriété (la position a changé, la couleur diffère de celles exclues).
6. **Aucune dépendance ajoutée.** Le harnais n'utilise que Node et Vitest.
7. **Trois fichiers du harnais ne sont pas des tests** (`charger-legacy.ts`, `alea.ts`, `scenario.ts`). Ils ne sont pas ramassés par le glob de Vitest, qui ne prend que `*.test.ts`.

## Problèmes connus et dette

- **Le harnais dépend de la forme du texte de `legacy/server.js`**, précisément de ses lignes d'import et de `import.meta.url`. `legacy/` étant figé en lecture seule, le risque est théorique, mais si quelqu'un recopie une autre version du legacy, le harnais casse d'un coup et bruyamment. Une garde possible, non posée pour rester dans le périmètre: figer l'empreinte SHA-256 de `legacy/server.js` dans un test.
- **`tests/` n'est pas couvert par `tsc --build`.** Le `tsconfig.json` racine ne référence que les quatre paquets. Les fichiers de test sont donc vérifiés par ESLint et transpilés par Vitest, mais leurs types ne sont jamais contrôlés. C'était déjà le cas avant cette session, pour `tests/purity/`. À traiter si on veut la garantie, hors périmètre ici.
- **L'IA des bots n'est pas caractérisée.** Hors périmètre de la fiche, c'est l'objet de l'étape 1.5. Seule la vitesse de poursuite du bot noir l'est, parce qu'elle relève des vitesses relatives.
- **Les zones spéciales ne sont pas caractérisées.** La fiche ne les demande pas. Elles arrivent à l'étape 1.4. À prévoir: leur constructeur tire une durée et une forme au hasard, et `manageSpecialZones` s'appuie sur `setTimeout`.
- **Le point A.2 (cumul des durées de bonus) est à trancher.** Figé pour l'instant, comme le veut la règle: il est moins coûteux de figer un comportement qu'on changera que de perdre un réglage sans s'en apercevoir.
- **Le point C.7 (vitesse du bot noir) demande une décision**, et il contredit CLAUDE.md. À traiter à l'étape 1.5. La constitution devra être corrigée dans un cas comme dans l'autre.
- Le dépôt pèse toujours 157 Mo, et `master` reste 6 commits en retard sur `origin/master`. Inchangé depuis le handoff 0.1.

## Prochaine action exacte

Dans une conversation neuve: créer `packages/sim/src/etat.ts` et `packages/sim/src/moteur.ts`, en portant `Entity` et `Player` depuis `legacy/server.js:832` et `:876`, avec le contrat `tick(etat, entrees, dt)`. Supprimer au passage `packages/shared/src/demo.ts` et son test, comme prévu par le handoff 0.1.

Les tests de caractérisation de `tests/caracterisation/` sont désormais la référence du comportement attendu: le portage doit les faire passer. Ils continuent de tourner contre le legacy, pas contre le nouveau code, et servent d'étalon de comparaison.

## Étape suivante

Fiche à lire: `docs/plan/etape-1-1.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear` avant d'attaquer l'étape 1.1. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.1 suit bien 0.2.
