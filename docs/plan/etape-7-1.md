# Fiche étape 7.1 - Mode tactique

Brief de session. Objectif unique: ajouter au jeu son deuxième mode, le mode tactique, où l'on capture par un cône directionnel à charges limitées au lieu de capturer en touchant. C'est la première application réelle du principe des modes enfichables, et l'étape qui ouvre le jalon 5.

## Origine de cette fiche

Aucune fiche n'existait: la section 3 du ROADMAP dit seulement « le mode tactique en premier, ajouté comme jeu de règles enfichable », sans numéro ni entrée dans la carte thématique. Elle est rédigée le 12 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la section 3 du ROADMAP (jalon 5) et le point 2 de sa section 5;
- la section 6 du cadrage (`docs/design/cadrage.md`), et le journal de `docs/design/README.md` au 29 juin 2026 (le mode est un jeu de règles enfichable) et au 10 septembre 2026 (aucune commande de capture en v1, la zone de capture tactile reviendra avec le mode tactique);
- la branche `mode-strategique`, commit `8a7b5fc` (v0.9.0), seule version du mode qui ait tourné: dans `server.js`, `tacticalModeCollisions`, `getEntitiesInCaptureRange`, `checkEntityInCone`, `getDirectionVector`, `getAngleBetweenVectors`, `updateCaptureAttempts` et les gestionnaires `startCapture` et `endCapture`; `TACTICAL_MODE_CONFIG` dans `game-constants.js`; la touche Espace et `drawCaptureRange` dans `public/client.js`; `public/js/capture-indicator.js`. Pour des cas de test, `tests/tactical-mode-fix.test.js` de la branche `modular-architecture-broken`;
- le handoff 2.3, et l'état du dépôt au commit `b2b80c8`;
- quatre décisions de jeu posées au porteur du projet le 12 septembre 2026, comme le demandait la condition d'arrêt du handoff 2.3.

**Numéro**: l'étape ouvre une phase 7, « Modes de jeu », dans la carte thématique. Le mode tactique n'est pas un portage de la base de référence (phase 1), ni le travail d'une seule couche, et les modes suivants s'y rangeront.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (2.3, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md` et la section 6 du cadrage. Le code de la v0.9.0 se relit sans changer de branche: `git show mode-strategique:server.js`.

## Ce que faisait la v0.9.0, et ce qu'elle vaut comme référence

Relevé dans le code, pas dans sa documentation:

1. Le mode se choisissait dans le salon, `classic` ou `tactical`.
2. La touche Espace émettait `startCapture`. Le serveur refusait le tir hors du mode tactique, sans charge, ou si le joueur était immobile; sinon il le résolvait **à la réception du message**, hors de la boucle de jeu.
3. **Un tir visait tout ce que contenait le cône**: joueurs et bots d'une autre couleur que le tireur, dont le centre est à 100 pixels au plus (inégalité large), et dont l'écart d'angle avec la direction du tireur est de 45 degrés au plus (large). La direction est l'une des huit du jeu. Les bots noirs ne sont pas des cibles.
4. Une charge était débitée dès que le cône contenait une cible, même si sa capture échouait. Un tir dans le vide ne coûtait rien.
5. Les bots du cône passaient à la couleur du tireur. Les joueurs passaient par `handlePlayerCapture`, donc par la protection d'apparition, l'invincibilité et le délai d'une seconde entre deux captures: **au plus un joueur par tir**.
6. Cinq charges au plus. Une charge revenait cinq secondes après le dernier tir ou la dernière recharge.
7. **Au contact, rien.** `classicModeCollisions` n'était pas appelée: toucher ne capturait ni bot ni joueur, et un joueur invincible ne détruisait plus de bot noir.
8. Le lancement imposait 45 bots, quel que soit le réglage de l'hôte.
9. Le client dessinait un cône translucide devant son propre joueur, des points de charge à côté de lui, une animation et un son de tir. Aucune commande tactile.

**Sa valeur de référence est faible.** Publiée le 20 décembre 2024, marquée le lendemain « régressions à corriger (paramètres écrasés) », elle n'a jamais été la version jouée: `master` est resté en v0.8.6. Elle n'a pas de tests de caractérisation et n'en aura pas, `legacy/` étant figé sur la v0.8.6. **Elle fait foi sur l'intention du mode et sur ses valeurs, pas sur ses modalités.** Ce qui n'est pas porté:

- **Les 45 bots imposés** (point 8): c'est un réglage de l'hôte écrasé, l'une des régressions annoncées.
- **La disparition de la contagion entre bots.** Le `detectCollisions` de la v0.9.0 sort d'emblée pour un bot: les bots cessaient de se transmettre leur couleur, dans les deux modes. Le comportement à préserver 11 de CLAUDE.md s'applique.
- **Le bot noir intouchable par un invincible** (point 7), conséquence d'un déplacement de code plutôt que d'une intention.
- **Le tir résolu à la réception du message**: deux tirs croisés se jouaient à la course au réseau, le défaut que `contacts.ts` décrit pour les duels du legacy. Ici le tir entre dans le battement.

## Décisions du porteur du projet, 12 septembre 2026

1. **Contact: le cône seul capture.** Toucher ne capture ni bot ni joueur. La contagion entre bots demeure, et un joueur invincible détruit toujours un bot noir en le touchant.
2. **Les valeurs de la v0.9.0**: angle de 90 degrés, portée de 100 pixels, cinq charges, une charge rendue toutes les cinq secondes; un tir sans cible ne coûte rien; un tir capture tout ce que le cône contient.
3. **Visée: la dernière orientation.** Un joueur garde la direction de son dernier déplacement, et vise de ce côté même immobile.
4. **Tactile: un bouton dédié**, fixe en bas à droite, qui porte l'état des charges. La manette ne peut pas naître sur lui.

Écartés par ces décisions: le contact qui capture encore les bots, le contact et le cône cumulés, le tir raté payant, les réglages du cône par l'hôte, le tir refusé à l'arrêt, le tap d'un second doigt.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Nom « Tactique », identifiant `tactique`.** Le nom du ROADMAP et du cadrage; la v0.9.0 hésitait entre « stratégique » (son commit) et « tactique » (son code et son écran).
2. **Capacité de douze joueurs**, comme le Classique. Rien dans le mode ne change le coût d'un joueur mesuré en 5.1.
3. **Le nombre de bots reste celui de l'hôte**, comme dans tout mode (cadrage, tension 4).
4. **Ce qui débite une charge: un tir qui capture au moins une entité.** Écart assumé au point 4 de la v0.9.0, qui débitait aussi un tir sur un joueur protégé. Pour le joueur, « sans cible » veut dire « sans effet ».
5. **Recharge**: une charge revient cinq secondes après le dernier tir payant ou la dernière recharge, comme dans la v0.9.0; un tir relance l'attente. Le calcul avance par dt: un long battement peut rendre plusieurs charges.
6. **Géométrie de la v0.9.0**, bornes comprises: distance entre centres au plus égale à la portée, écart d'angle au plus égal au demi-angle, vecteur de l'une des huit directions.
7. **Ordre des captures d'un tir**: les joueurs d'abord, puis les bots, chacun dans l'ordre de l'état, comme la v0.9.0. Les bots d'une victime passent donc au tireur avant que le cône ne repeigne les autres.
8. **Place du tir dans le battement**: après les déplacements, les bots, les zones et les objets, avant le relevé des contacts. Une demande reçue entre deux battements part au battement suivant, et plusieurs demandes dans le même intervalle n'en font qu'une.
9. **Orientation de départ: est**, la valeur de repli de `getDirectionVector` dans la v0.9.0. Une capture ne la change pas.
10. **La partie rapide ne change pas**: la première partie publique en attente, quel que soit son mode, sinon une nouvelle partie Classique. Le navigateur et le salon disent le mode.
11. **Les récompenses de fin ne dépendent pas du mode** (règles de l'étape 3.3).
12. **Touche Espace**, celle de la v0.9.0, sans répétition quand on la maintient, et jamais pendant la saisie du chat.

## État de départ, constaté dans le dépôt

Ce qui existe et se réutilise:

- **Le branchement du mode**: `MODES` et `CAPACITES` (`packages/shared/src/constantes.ts`); `EtatPartie.mode`; `REGLES_DES_MODES` (`packages/sim/src/moteur.ts`), indexée par tous les modes, si bien qu'oublier la règle d'un mode ajouté ne compile pas.
- **Les captures autonomes** de `packages/sim/src/capture.ts`: `capturerJoueur`, `capturerBot`, `detruireBotNoir`, qui vérifient elles-mêmes protection, invincibilité, délai, couleur à donner. Une règle tactique ne peut pas les contourner.
- **Le mode figé à la création**, porté par `GameRoom`, `InfosSalon` et `PartiePublique`, et enregistré en base par l'énumération `mode_de_jeu`, tirée de `MODES` (`packages/server/src/base/schema.ts`).
- **Les seaux de débit par famille** (`LIMITES_DEBIT`, `packages/shared/src/bornes.ts`).
- **Côté client**, `NOMS_DES_MODES`, une table indexée par mode, et l'écran de création avec sa tuile de mode et sa tuile « À venir ».

Ce qui manque:

- **Un tir n'est pas un contact.** `RegleDeResolution` reçoit l'état et les contacts, ni les entrées ni dt: un mode ne peut agir qu'à travers les contacts.
- **Aucune entrée ponctuelle.** `Entrees` est la dernière intention de déplacement de chaque joueur, que `GameRoom` conserve de battement en battement.
- **Aucune orientation.** `Joueur.direction` vaut `immobile` dès que le joueur s'arrête.
- **Aucun état de charges.**
- **Aucun événement de capture** dans le contrat réseau. `controles.ts` et `tactile.ts` expliquent en tête pourquoi il n'y en a pas: ces commentaires deviendront faux.
- **Le flux binaire** ne porte ni orientation ni charges.
- **La création** ne propose qu'un mode sélectionnable (`MODE_DE_CREATION`).

## Périmètre

Découpé en lots, dans l'ordre d'exécution. Chaque lot se termine vert et se commite; si l'étape déborde d'une session, le handoff partiel s'arrête à la fin d'un lot.

### Lot A. Le jeu de règles tactique dans le moteur

1. **Le mode devient un jeu de règles, pas une seule règle de contacts.** `REGLES_DES_MODES` passe à un objet par mode, qui dit ce que le mode fait des contacts et ce qu'il fait des entrées du battement. Proposition: `JeuDeRegles { resoudreContacts; agir(etat, entrees, dtMs) }`, le Classique ayant `regleClassique` et une action neutre. La table reste indexée par tous les modes.
2. **Le mode `tactique`** rejoint `MODES`, avec sa capacité et ses constantes (angle, portée, charges, recharge) dans `packages/shared`; et, dans le même lot, ce que la compilation et la CI exigent dès qu'un mode existe: son nom et sa description dans les tables du client indexées par mode, et la migration de l'énumération `mode_de_jeu`, écrite par `pnpm base:generer`.
3. **L'entrée d'un joueur gagne une demande de tir**, ponctuelle, distincte de `IntentionDeplacement`, qui reste le message `deplacer`.
4. **Le mode tactique tient son propre état, à part des joueurs**: pour chaque joueur, son orientation (l'une des huit directions, jamais immobile), ses charges et le temps avant la prochaine. Proposition: un champ facultatif de `EtatPartie`, absent d'une partie Classique, tenu par le jeu de règles; après les déplacements, l'orientation d'un joueur prend sa direction du battement quand elle n'est pas immobile. Raison: l'état d'une partie Classique reste identique à l'octet, donc son empreinte aussi, et aucune attente d'un test Classique ne change. Ajouter ces champs à `Joueur` aurait changé l'état de toutes les parties, et privé l'empreinte de sa valeur de preuve.
5. **Le tir**: cône, cibles, captures par les fonctions de `capture.ts`, débit et recharge. Un tir sans charge ne fait rien.
6. **Les contacts du mode tactique**: la contagion entre bots et la destruction d'un bot noir par un invincible, rien d'autre. Sans dupliquer `regleClassique`: ce qui leur est commun se partage.
7. **Un événement de journal pour le tir** (tireur, position, orientation, nombre de captures), qui nourrira l'animation et le son.

### Lot B. Contrat, réseau, flux et base

1. **Un événement montant `capturer`**, sans contenu, avec sa famille de débit. Refusé hors d'une partie en cours; sans effet dans une partie Classique.
2. **`GameRoom` retient la demande pour le battement suivant, puis l'oublie**; la dernière intention de déplacement, elle, reste conservée.
3. **Le flux d'état** porte l'orientation et les charges d'un joueur, et ce qu'il faut pour afficher la recharge. `VERSION_DU_FLUX` augmente. En Classique, la partie de référence doit rester dans son seuil (`OCTETS_PAR_MESSAGE_DE_REFERENCE`, 453 octets à 5 pour cent); sinon, mesurer, justifier et reporter la nouvelle taille.
4. **Le retour d'un tir** part à la salle, pour l'animation et le son, soit par un événement, soit déduit du flux: à trancher en construisant, et à consigner.
5. **La base**: une partie tactique s'enregistre (sa migration est au lot A).
6. **La création** accepte le mode tactique (`validerDemandeCreation`).

### Lot C. Le client

1. **Création**: la tuile Tactique, sélectionnable à côté du Classique, avec une phrase de description; la tuile « À venir » reste pour les autres modes; récapitulatif et capacité suivent le mode choisi.
2. **Une ligne de règle au salon** qui dit comment capturer. Le nom du mode et sa description arrivent dès le lot A, avec le mode lui-même; jusqu'au lot C, l'écran de création ne montre que le mode qu'il sait créer.
3. **Clavier**: Espace tire, en partie tactique seulement.
4. **Tactile**: le bouton fixe en bas à droite, avec les charges, absent en Classique; la manette ne naît pas dessus.
5. **HUD**: les charges et la recharge en cours.
6. **Rendu**: le cône translucide devant son propre joueur, selon son orientation; l'animation et le son d'un tir, avec les ressources existantes.
7. **Les commentaires** de `controles.ts` et `tactile.ts` qui disent qu'il n'existe aucune capture à déclencher.

### Lot D. Bout en bout et mesure

1. **Scénario de bureau**: une partie tactique créée depuis la page; un joueur tire sur un bot à portée et le capture; toucher ne capture pas.
2. **Fumée mobile**: le bouton de capture existe dans une partie tactique, et pas dans une partie Classique.
3. **Charge**: une partie tactique pleine passe au banc (temps par battement, taille du flux), comparée au Classique; seuils mis à jour s'il le faut.
4. **Empreinte**: celle du jeu, pour les quatre parties Classique de `tests/charge/empreinte.ts`, est identique à celle de 2.3.

## Hors périmètre

- Les autres modes (Chasse, Battle Royale, Équipes, Chaos): des propositions non validées (cadrage, tension 2).
- Les réglages du cône par l'hôte, le tir raté payant, le tir refusé à l'arrêt (écartés le 12 septembre 2026).
- Le cône des adversaires, la visée à la souris, la visée libre sur tout le cercle.
- Toute modification du comportement du Classique, de `legacy/` ou de `tests/caracterisation/`.
- Des récompenses ou des statistiques propres à un mode.

## Tests requis

- **Géométrie du cône (TU)**: cible dans le cône, hors de l'angle, hors de portée; bornes exactes (100 pixels, 45 degrés); les huit orientations; une cible au même point que le tireur. Les trois cas de `tactical-mode-fix.test.js`: orienté est, une cible à 50 pixels à l'est est prise, à 50 pixels au nord ne l'est pas, à 200 pixels à l'est ne l'est pas.
- **Tir (TU)**: bots blancs et bots d'autres joueurs capturés, ni les siens ni les bots noirs; un joueur capturé cède tous ses bots; au plus un joueur par tir; un joueur protégé ou invincible épargné; un tir sans effet ne coûte rien; un tir sans charge ne fait rien; une seule charge débitée quel que soit le nombre de captures.
- **Recharge (TU)**: une charge par cinq secondes, jamais plus de cinq, attente relancée par un tir payant, résultat indépendant du découpage de dt.
- **Visée (TU)**: l'orientation suit le déplacement effectif, demeure à l'arrêt et après une capture, suit les commandes inversées.
- **Contacts tactiques (TU)**: toucher un bot ou un joueur ne capture rien; les bots se transmettent leur couleur; un invincible détruit un bot noir; un bot noir capture toujours sa proie.
- **Moteur (TU)**: une demande de tir est consommée par le battement qui la reçoit; deux parties tactiques de même graine et mêmes entrées sont identiques; en pause, ni tir ni recharge; en Classique, une demande de tir ne change rien, et tous les tests existants restent verts sans modification de leurs attentes.
- **Réseau (TI)**: `capturer` limité en débit, refusé hors partie, sans effet en Classique; un tir à travers le vrai serveur capture, et toute la salle le voit dans le flux; une demande ne franchit pas la frontière d'une partie; une demande n'est jouée qu'une fois même sans nouveau message.
- **Flux (TU)**: aller-retour des nouveaux champs; une trame de l'ancienne version refusée.
- **Base (TI)**: migration rejouable; une partie tactique enregistrée.
- **Client (TU)**: création d'une partie tactique; Espace et bouton émettent une demande; indicateur des charges d'après l'état reçu; cône selon l'orientation.
- **Bout en bout**: les scénarios du lot D, sans erreur de console.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie tactique se crée, se joue et s'enregistre depuis la page, au clavier et au tactile.
2. **Le Classique n'a pas changé**: tests existants inchangés, empreinte du jeu des quatre parties de référence identique, partie de référence du flux dans son seuil.
3. Ajouter le mode n'a demandé que des ajouts aux points d'extension, plus l'élargissement du point d'extension lui-même (lot A, point 1), décrit dans la section 6 du cadrage.
4. La couverture de `packages/sim` ne baisse pas (99,63 pour cent au handoff 2.3).
5. Le cadrage (sections 1, 4 et 6), le journal de conception et les commentaires de `controles.ts` et `tactile.ts` décrivent ce qui a été construit.

## Points de vigilance

1. **Le Classique passe par le code modifié à chaque battement**: `REGLES_DES_MODES` change de forme, et `tick` appelle le jeu de règles à un nouvel endroit. L'empreinte du jeu de `tests/charge/empreinte.ts` est le garde-fou, et elle ne vaut preuve que si l'état d'une partie Classique ne gagne aucun champ (lot A, point 4). Elle se relève avant la première modification et se vérifie à la fin du lot A, pas seulement à la fin de l'étape.
2. **Une demande ponctuelle dans une table d'intentions conservées.** Le piège est de la rejouer à chaque battement, comme le journal que la pause rejouait à l'étape 1.7: aucun type ne le signale, seul un test l'empêche.
3. **Le cône se calcule sur la position du battement**; le client dessine une position lissée. Un léger décalage visuel est attendu, et ne se corrige pas côté serveur.
4. **La taille du flux Classique** est vérifiée en CI à une vingtaine d'octets près: ajouter des champs de joueur peut la faire échouer.

## Réconciliation pendant l'étape (12 septembre 2026)

Écarts entre la fiche et ce qui a été construit, tous consignés au journal de `docs/design/README.md`.

1. **Les quatre lots ont été exécutés dans l'ordre, un commit chacun**: A (`98295f6`, et `3830a5e` pour deux erreurs de types de ses tests), B (`2bcd9ad`), C (`98e9767`), D.
2. **Lot A, points 1 et 4, comme proposé.** Le jeu de règles d'un mode agit sur les entrées puis résout les contacts; l'état tactique vit dans `EtatPartie.tactique`, absent d'une partie Classique. L'empreinte du jeu des quatre parties de référence est restée identique à chaque lot.
3. **Décision 8 précisée.** Quand plusieurs joueurs tirent dans le même battement, l'ordre est tiré au sort par le générateur à graine, comme les duels de contacts; un joueur capturé par un tir perd le sien. Un seul tireur ne consomme aucun tirage.
4. **Lot B, point 4, tranché**: un tir est annoncé à chaque joueur de la partie par la notification `tirDeCapture`, qu'il capture ou non. Les charges sont publiques, dans le flux (version 2): une partie Classique n'y écrit pas un octet de plus.
5. **Lot B, point 1**: la couche réseau et `GameRoom` ne savent pas quels modes tirent; c'est le moteur qui ignore une demande en Classique. Famille de débit `capture`, cinq par seconde, rafale de cinq.
6. **Lot C, écarts à la fiche.** Le bouton Capturer est posé pour tous les appareils, au-dessus de la minimap, pas seulement au tactile: il porte les charges, que le bureau doit voir aussi. Il n'est jamais en focus, pour ne pas priver le clavier de la barre d'espace. Tout le monde voit l'éclair d'un tir; seul notre cône de visée est dessiné. Seul notre tir qui capture fait un son; aucun tir ne fait de phrase. La règle de capture du mode s'affiche au salon et dans l'aide.
7. **Lot D.** Le scénario `tests/e2e/tactique.spec.ts` joue dans les deux cadrages; le parcours solo vérifie qu'une partie Classique n'a pas de bouton de capture. Le banc du battement accepte un mode, et `pnpm charge --banc --mode tactique` mesure une partie Tactique; chiffres à la section 13 de `docs/mesures/charge-serveur.md`.
8. **Défaut trouvé hors périmètre, corrigé (règle 7).** `rtk pnpm typecheck` répond « aucune erreur » sans exécuter le script du dépôt: la compilation n'était pas refaite et la vérification des types des tests n'avait pas lieu. Le commit du lot A est parti avec deux erreurs de types, que la CI a relevées. La vérification se lance désormais en appelant `tsc` et `vitest` directement.
9. **Incohérences de documentation corrigées en route (règle 7)**: le nombre de fiches cité par `PROTOCOLE.md` et `CLAUDE.md`; le commentaire de `CAPACITES` qui annonçait l'étape 2.3 au futur; celui de `contacts.ts` qui annonçait l'étape 1.5; ceux de `controles.ts`, `tactile.ts`, `controles.test.ts` et de la liste des événements non portés, qui disaient qu'aucune capture n'était à déclencher.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-1-handoff.md`: les décisions construites, les écarts à la v0.9.0 et à cette fiche, les chiffres du banc, l'état de la CI. Prochaine action exacte: la section 3 du ROADMAP place ensuite « les autres modes », qu'aucune décision n'a validés (cadrage, tension 2); la session suivante pose d'abord la question au porteur du projet, et passe à `5.3` si aucun mode n'est retenu. Commiter.
