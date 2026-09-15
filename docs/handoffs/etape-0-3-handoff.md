# Handoff - Étape 0.3 Cadrage fonctionnel depuis les maquettes

Date: 10 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Transformer les maquettes en un document de référence qui fige le périmètre v1, les données à modéliser et les contrats: `docs/design/cadrage.md`. Étape de documentation, sans code. Selon la section 3 du ROADMAP, elle ouvre le jalon 2, juste avant l'étape 2.4.

## Ce qui a été fait

- **`docs/design/cadrage.md` existe.** Il couvre les huit parties attendues: tri de périmètre, décisions sur les tensions et les questions ouvertes, inventaire des sept écrans, contrat de configuration de partie, forme des données de progression, principe des modes, renvois vers les fiches aval, et questions laissées au porteur du projet.
- **Il part du jeu qui tourne.** L'étape s'est exécutée après le jalon 1: le contrat de configuration étend `ReglagesPartie` au lieu d'en inventer un d'après la maquette, et l'inventaire distingue ce que l'étape 4.3 a déjà construit.
- **Les neuf tensions et les huit questions ouvertes sont tranchées**, les unes ici, les autres par des étapes précédentes, chacune avec son renvoi.
- **Dix décisions consignées** au journal de `docs/design/README.md`, datées du 10 septembre 2026, et le statut des tensions et des questions mis à jour.
- **Les fiches aval reçoivent leurs ajustements**: 2.4, 3.1, 3.2 et 3.3 ont une section « Ajustements venus du cadrage ». Règle du README: une décision qui touche l'aval remonte dans la fiche concernée.
- **La fiche 0.3 est réconciliée**, section à sept points.
- **Deux questions sont laissées au porteur du projet**, parce qu'elles engagent le produit au-delà du périmètre validé: jouer sans compte, et les valeurs des récompenses.

## Le contrat de configuration de partie, en résumé

La fiche demande de le résumer ici: les étapes 2.4 et suivantes s'appuient dessus. Détail complet: section 4 du cadrage.

**Choisi à la création, figé ensuite**

- `mode`: énumération, `classique` seul en v1. Figé, parce qu'il détermine la capacité.
- `visibilite`: `publique` (défaut) ou `privee`. Figée, pour qu'une partie ne disparaisse pas du navigateur sous les yeux de ceux qui la rejoignent.
- code d'invitation: fabriqué par le serveur pour une partie privée. Proposition: six caractères, majuscules et chiffres sans O, 0, I ni 1.
- capacité: propriété du mode, pas un champ. Classique: 12 au plus, 1 pour lancer.

**Réglé par l'hôte dans le salon jusqu'au lancement**: `ReglagesPartie`, inchangé, déjà validé par `validerReglages` et borné par `BORNES_REGLAGES`.

- `carte` (`map1` par défaut, trois cartes) et `modeMiroir` (faux);
- `dureePartieS` 180, de 30 à 600;
- `nombreBotsInitial` 50, de 10 à 150;
- `botsNoirs` (actifs, 2, à 50 % de la partie, 150 px, 50 % perdus);
- `bonus`, `malus` et `zones`, avec leurs interrupteurs, durées, taux et intervalles du legacy.

**Écarts avec la maquette**: durée minimale 30 et non 60; faux ninjas 10 à 150, défaut 50, et non 10 à 80, défaut 40; trois cartes et non quatre; miroir en réglage et non en mode; capacité 1 à 12 et non 4 à 12.

## La forme des données de progression, en résumé

Détail: section 5 du cadrage. **Principe: ce qui se déduit ne se stocke pas**, comme le score depuis le 14 août 2026.

- **Compte**: identifiant opaque, pseudo unique (règles de `BORNES_PSEUDO`, comparé sans casse), date d'inscription. Le mot de passe haché arrive à l'étape 3.2.
- **Progression**, une par compte: XP totale, pièces, points de ligue, date de mise à jour. **Le niveau se déduit de l'XP, le palier de rang des points de ligue**, par des fonctions pures de `packages/shared` écrites à l'étape 3.3. **Pas de gemmes.**
- **Résultat de partie**, un par compte et par partie: identifiant de la partie, mode, carte, mode miroir, durée, placement, nombre de joueurs, points, captures, Black Ninjas détruits, XP gagnée, pièces gagnées, variation signée des points de ligue, fin de partie.
- **Points d'extension**: pass de saison, skins, clans, gemmes, succès et défis du jour s'ajouteront par de nouvelles tables qui référencent le compte, sans colonne ajoutée aux tables v1. Aucune n'est créée en v1.

## Fichiers créés ou modifiés

Créés

- `docs/design/cadrage.md`: le cadrage.
- `docs/handoffs/etape-0-3-handoff.md`: ce handoff.

Modifiés

- `docs/design/README.md`: dix décisions du 10 septembre 2026; statut des tensions (toutes tranchées) et des questions ouvertes (toutes tranchées, deux nouvelles renvoyées au cadrage).
- `docs/plan/etape-0-3.md`: section « Réconciliation » à sept points.
- `docs/plan/etape-2-4.md`: six ajustements venus du cadrage, et le rappel que les scénarios de bout en bout sont à adapter.
- `docs/plan/etape-3-1.md`: trois ajustements (ni niveau ni palier stockés, pas de gemmes, pas de défis).
- `docs/plan/etape-3-2.md`: trois ajustements (question de l'accès sans compte à trancher avant l'étape, règles du pseudo, niveau déduit).
- `docs/plan/etape-3-3.md`: trois ajustements (pas de défis, déductions en fonctions pures, valeurs à faire valider).

Aucun fichier de code modifié.

## Tests

Étape de documentation: aucun test ajouté, aucun code touché.

- Vérifications requises par la fiche, faites sur le document:
  - chaque écran v1 a ses données listées, avec leur source et l'étape qui les construit (section 3);
  - le contrat de configuration est complet et une table le met en regard de chaque champ de la maquette (section 4.3);
  - les champs de progression couvrent ce que la fin de partie et le profil v1 affichent (section 5, dernier paragraphe des résultats);
  - le tri de périmètre classe chaque élément de la maquette dans une seule catégorie (section 1).
- Formatage des documents: vert (`prettier --check`).
- Tests Vitest, couverture, caractérisation: inchangés, aucun fichier concerné.
- CI: voir « État de la CI ».

## Décisions et écarts au plan

Les dix décisions sont au journal du README. Quatre points méritent d'être lus ici.

### 1. Le cadrage part du jeu qui tourne, pas des maquettes

La fiche supposait une étape exécutée avant la phase 1. À son exécution, le moteur, le serveur, `ReglagesPartie`, `BORNES_REGLAGES` et quatre écrans existent. Le cadrage les prend pour point de départ, et instruit chaque écart avec la maquette.

### 2. Le miroir n'est pas un mode

C'est la tension la plus structurante. Le legacy charge le miroir comme une variante des ressources de chaque carte (`legacy/js/MapManager.js`), et le contrat le porte déjà en `modeMiroir`. En faire un mode aurait multiplié chaque mode futur par deux. Le « mode Miroir » de la maquette disparaît.

### 3. Beaucoup de la maquette est écarté, et c'est la posture demandée

Saison, défis, pass, gemmes, clan, succès, rang mondial, skins, latence par salon, état « prêt », « Terminer »: aucun n'est repris, faute de besoin constaté ou parce que le périmètre du 29 juin les reporte. Consigne du porteur du projet du 13 août 2026: les maquettes sont des propositions à challenger. Ce qui est reporté reste masqué, jamais grisé.

### 4. Le mode n'arrive pas encore jusqu'au moteur

`RegleDeResolution` existe dans `packages/sim/src/contacts.ts`, mais `tick` appelle toujours la règle Classique par défaut. Le cadrage le dit, et en confie le branchement à l'étape 2.4, qui ajoute le champ `mode`.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Deux questions attendent le porteur du projet** (section 8 du cadrage):
  - **jouer sans compte**, à trancher avant l'étape 3.2. La fiche 3.2 exige un compte pour rejoindre une partie, alors que le jeu est né comme un jeu entre amis où l'on entre avec un pseudo;
  - **les valeurs des récompenses**, à proposer et faire valider à l'étape 3.3.
- **Les captures des maquettes n'ont pas toutes été ouvertes.** Quatre sur sept l'ont été (accueil, création, résultats, profil); le salon, le navigateur et le HUD sont décrits par le document de passation et correspondent à des écrans déjà construits ou très proches de l'existant.

Repris du handoff 4.4, inchangé: voir sa section « Problèmes connus et dette ».

## État de la CI

**Run 34522355452, commit 9f624bd: rouge, mais pas à cause de cette étape.**

- « Types, linter et tests »: vert. Le formatage des documents de l'étape y est vérifié.
- « Bout en bout »: la seule partie à deux a échoué aux trois essais. C'est un défaut de l'étape 4.4, révélé par ses signes vitaux, et traité dans son handoff (cinquième passage): cette étape ne touche aucun code.

**Run 34523549580, commit 43ad67e, qui contient cette étape et les corrections de l'étape 4.4: vert.** Les deux travaux au vert, 1080 tests, 10 scénarios de bout en bout sur 10 au premier essai.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 2.4, matchmaking, parties privées et publiques. **C'est la section 3 du ROADMAP qui la désigne**: le jalon 2 enchaîne `0.3` puis `2.4`. La ligne de fin de la fiche 0.3, qui cite l'étape 1.1, suit la numérotation thématique et ne fait pas foi.

Cinq points à avoir en tête dès le début:

1. **Lire la section « Ajustements venus du cadrage » de la fiche 2.4**, puis les sections 2, 3 et 4 du cadrage. Ils retirent la latence et l'état « prêt », fixent la capacité, et figent mode et visibilité à la création.
2. **La fiche demande le handoff de l'étape 2.3**, qui n'a pas été exécutée: le delta binaire est rattaché au jalon 4 et conditionné à la mesure de l'étape 5.1. Le dernier handoff fait foi.
3. **Le contrat de configuration étend `ReglagesPartie`**, déjà validé par `validerReglages`: on ajoute `mode` et `visibilite`, on ne réécrit rien.
4. **Brancher le mode sur le moteur**: `tick` appelle aujourd'hui la règle Classique par défaut.
5. **Les scénarios `parcours-solo.spec.ts` et `multijoueur.spec.ts` reposent sur la règle du premier salon en attente**, que cette étape remplace. `jeu.partie()` exige une seule partie par serveur, et Bob rejoint Alice sans code: les deux scénarios sont à adapter, et la CI le rappellera.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-4.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
