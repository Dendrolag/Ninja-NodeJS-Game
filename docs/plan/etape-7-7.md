# Fiche étape 7.7 - Objets du Tactique

Brief de session. Objectif unique: donner au mode Tactique six objets qui jouent sur son arme, trois bonus (Rafale, Recharge rapide, Visée large) et trois malus (Tir unique, Visée étroite, Recharge lente), et le rendre plus lisible et plus serré à l'écran: les charges affichées à côté du joueur, une vue plus proche sur ordinateur, une minimap limitée aux alentours. Les autres modes ne changent pas.

## Origine de cette fiche

Aucune fiche n'existait: la section 3 du ROADMAP était épuisée jusqu'aux fonctionnalités reportées, et le porteur du projet a ouvert celle-ci le 19 septembre 2026, hors de la liste d'origine (Battle Royale, Chaos, pass de saison, skins, clans). Elle est rédigée le même jour selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la liste du porteur du projet et des décisions tranchées avec lui, ci-dessous;
- la fiche 7.6 prise comme modèle, et la fiche 7.1 pour le mode Tactique;
- l'état du dépôt au commit `f2165ac`, et le handoff 5.7;
- quatre planches de maquettes dessinées avec les images du jeu, rangées dans `docs/design/etape-7-7/`.

**Numéro**: 7.7, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (5.7, ou le handoff partiel de cette étape), cette fiche, la fiche 7.1, et `.claude/rules/sim-purity.md`.

## Ce qu'est le Tactique aujourd'hui

Un joueur capture par un cône de 90 degrés sur 100 pixels, dans la direction de son dernier déplacement. Il a cinq charges au plus; un tir qui capture en coûte une, un tir sans effet ne coûte rien, et une charge revient toutes les cinq secondes (`packages/sim/src/tactique.ts`, `TACTIQUE` dans `packages/shared`). Son orientation et ses charges sont rangées à part, dans `EtatPartie.tactique`, absent des autres modes. Les six objets du jeu d'origine (trois bonus, trois malus) y apparaissent comme partout. Les charges s'affichent en points sur le bouton « Capturer », dans un coin de l'écran. La vue sur ordinateur montre 900 pixels de carte en hauteur, 271 sur téléphone. La minimap montre tous les joueurs.

## Décisions du porteur du projet, 19 septembre 2026

1. **Six objets, réservés au Tactique**, qui s'ajoutent aux six existants:

   | Objet               | Nature | Effet                                                                            | Durée |
   | ------------------- | ------ | -------------------------------------------------------------------------------- | ----: |
   | **Rafale**          | bonus  | Un tir ne coûte plus de charge. La seconde entre deux captures de joueur demeure |   5 s |
   | **Recharge rapide** | bonus  | Une charge revient en 1,5 s au lieu de 5                                         |  10 s |
   | **Visée large**     | bonus  | Cône de 120 degrés sur 150 pixels                                                |  10 s |
   | **Tir unique**      | malus  | Une seule charge utilisable; les autres sont gelées, pas perdues                 |  10 s |
   | **Visée étroite**   | malus  | Cône de 60 degrés sur 70 pixels                                                  |  10 s |
   | **Recharge lente**  | malus  | Une charge revient en 10 s au lieu de 5                                          |  12 s |

2. **Les règles des objets existants s'appliquent**: un bonus profite au ramasseur, deux bonus identiques additionnent leur durée (comportement à préserver 10); un malus frappe tous les autres joueurs (comportement 4), et un malus identique relance sa durée sans s'y ajouter.
3. **Un bonus et le malus contraire s'annulent** tant que les deux durent: Visée large contre Visée étroite, Recharge rapide contre Recharge lente, Rafale contre Tir unique.
4. **Les six objets existants restent en Tactique**, et **on baisse les taux** pour que la carte ne se charge pas davantage qu'aujourd'hui.
5. **Chaque nouvel objet s'active et se désactive dans les réglages de partie**, comme les autres, et ne se propose que pour une partie Tactique.
6. **Les icônes sont dessinées dans le code**, sur le modèle des objets existants (un disque de couleur, un pictogramme noir), avec **une couleur par paire**: orange pour Rafale et Tir unique, cyan pour les recharges, lilas (celui du cône) pour les visées. Le pictogramme dit le sens de l'effet: l'infini et le « 1 », la flèche qui tourne et le sablier, le cône ouvert et le cône fermé. Planche 2.
7. **Les charges flottantes, rendu A**: un arc de cinq points sous le ninja, qui se remplissent comme ceux du bouton, et un petit symbole de l'effet en cours à droite de l'arc (l'infini, le « 1 », un double chevron, un sablier). Pendant une Rafale l'arc passe à l'orange; pendant un Tir unique les points gelés sont barrés; la charge qui revient se colore de l'effet de recharge. Planche 1.
8. **Les charges flottantes ne se montrent qu'à soi**: chacun voit l'arc sous son propre ninja, pas sous les autres.
9. **Sur ordinateur, la vue du Tactique montre 500 pixels de carte en hauteur**, au lieu de 900: 31 pour cent de la surface visible aujourd'hui. Le téléphone garde son cadrage. Planche 4.
10. **La minimap du Tactique ne montre que les joueurs proches**, dans un rayon autour de soi.

Écartés: les nouveaux objets dans les autres modes; remplacer les objets existants en Tactique; une carte plus chargée; vert pour les bonus et rouge pour les malus (le vert se confondait avec le Boost); l'anneau et la barre pour les charges; les charges des adversaires affichées; 600 et 700 pixels de vue; la minimap inchangée ou réduite à soi seul.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Les effets du Tactique vivent dans l'état tactique du joueur** (`EtatTactiqueDuJoueur`), pas dans `Joueur.bonusRestantsMs`: un joueur d'un autre mode garde exactement la même forme, et l'état d'une partie Horde reste identique à l'octet. C'est le choix de l'étape 7.1 pour les charges.
2. **Un catalogue à part**: `TYPES_BONUS_TACTIQUES` et `TYPES_MALUS_TACTIQUES` dans `packages/shared`, à côté de `TYPES_BONUS` et `TYPES_MALUS`, que les autres modes continuent de parcourir seuls. Un objet posé garde sa catégorie (bonus ou malus); sa nature s'élargit aux six nouvelles. Le ramassage aiguille une nature tactique vers l'état tactique, et réutilise `cumuler` et `remplacer` de `effets.ts`.
3. **Leurs réglages forment un groupe à part**, `objetsTactiques`, sur le modèle des groupes bonus et malus: pour chaque objet, actif et durée, plus un taux d'apparition pour chaque bonus. Le groupe n'existe que dans les réglages d'une partie Tactique: `imposerLesReglagesDuMode` le complète en Tactique et le retire des autres modes. Le formulaire ne le propose qu'en Tactique (`presentEn`, pendant de `absentEn`).
4. **Les taux**. Aujourd'hui, chaque bonus tente sa chance à part toutes les 4 secondes (25, 15 et 20 pour cent: 0,6 bonus par tentative en moyenne). En Tactique, les six bonus tentent leur chance, **chacun à la moitié de son taux**: les nouveaux valent 25 (Recharge rapide), 20 (Visée large) et 15 (Rafale, le plus fort) par défaut, si bien que la moyenne reste de 0,6 bonus par tentative. La règle est une règle du mode, dans le moteur, pas une réécriture des réglages de l'hôte; l'écran des réglages le dit en une phrase. Les malus ne font qu'un tirage, puis choisissent leur nature parmi celles qui sont actives: leur nombre ne change pas, et chacun des six tombe deux fois moins souvent qu'un des trois d'aujourd'hui. Rien à baisser.
5. **Les recharges modifient la vitesse de l'attente, pas sa durée restante**: l'attente décroît de `dt` fois 5/1,5 en Recharge rapide, de `dt` fois 5/10 en Recharge lente. Un effet qui commence ou finit au milieu d'une attente ne la fait pas sauter, et le report du reste d'une attente sur la suivante reste exact.
6. **Le Tir unique plafonne les charges utilisables à une**, sans toucher au compte: la réserve continue de se remplir, et le joueur retrouve ce qu'il avait à la fin de l'effet. L'arc montre les charges gelées barrées.
7. **La Rafale ne touche que le coût du tir**: chaque tir reste soumis à tout le reste (protection d'apparition, invincibilité, seconde entre deux captures de joueur). Un joueur sans charge peut tirer pendant une Rafale.
8. **Le cône d'un tir est celui du tireur au moment du tir**: l'événement `tirDeCapture` porte son ouverture et sa portée, pour que tout le monde voie l'éclair du tir à sa vraie taille. La visée affichée suit le cône effectif du joueur.
9. **Les charges restent publiques dans le flux**, comme l'a décidé l'étape 7.1 (on doit pouvoir savoir qu'un adversaire est désarmé): la décision 8 porte sur l'affichage seul. Les effets tactiques d'un joueur voyagent comme ses bonus et malus d'aujourd'hui, par les notifications qui lui sont adressées et la liste des effets du HUD.
10. **Le bouton « Capturer » garde ses points**: sur téléphone, c'est le bouton qui tire, et l'arc ne le remplace pas.
11. **Le rayon de la minimap vaut 900 pixels de carte**: à 500 pixels de vue, environ deux fois l'écran autour de soi. Il se règle dans `apparence.ts`, et se dessine comme un cercle sur la minimap. Comme la minimap de la Chasse, c'est un filtre d'affichage: le flux reste complet.
12. **La hauteur de vue devient une donnée du mode** sur ordinateur (900 par défaut, 500 en Tactique), passée à `echellePour`. Le Tactique seul en profite; la Chasse, qui tire aussi en cône, reste à 900.

## Périmètre

### Lot A. Le contrat

1. **Le catalogue** des six natures tactiques, leurs valeurs (durées par défaut, géométries des cônes, durées de recharge sous effet), et l'élargissement de la nature d'un objet (micro-décision 2).
2. **Les réglages**: le groupe `objetsTactiques`, sa complétion et sa validation, `imposerLesReglagesDuMode` (micro-décision 3).
3. **Les vues et les événements**: les effets tactiques dans les notifications d'un joueur et la liste des effets; l'ouverture et la portée dans `tirDeCapture` (micro-décision 8); le codage du flux s'il change.

### Lot B. Le moteur

1. **L'apparition**: en Tactique, les six bonus à la moitié de leur taux, et les six malus au tirage commun (micro-décision 4).
2. **Le ramassage**: les natures tactiques vers l'état tactique, cumul des bonus, relance des malus, victimes selon la règle du mode.
3. **L'arme**: le cône effectif, la recharge effective, le plafond du Tir unique, le coût nul de la Rafale, l'annulation par paire (décision 3; micro-décisions 5 à 7). Les effets s'écoulent avec le temps.

### Lot C. Le serveur

1. **Tests à travers le vrai serveur**: une partie Tactique où un joueur ramasse chacun des six objets, les notifications reçues par lui et par les autres; les réglages du groupe portés au lancement, et absents d'une partie Horde.

### Lot D. La page

1. **Les objets**: les six icônes dessinées dans le code, leurs couleurs et leurs libellés (décision 6).
2. **Les charges flottantes**: l'arc sous notre ninja, ses états et le symbole de l'effet (décisions 7 et 8).
3. **La visée et l'éclair du tir** au cône effectif (micro-décision 8).
4. **Le HUD**: les effets tactiques dans la liste des effets en cours.
5. **La vue**: 500 pixels de hauteur sur ordinateur en Tactique (décision 9, micro-décision 12).
6. **La minimap**: les joueurs dans le rayon, et le cercle du rayon (décision 10, micro-décision 11).
7. **Les réglages**: le groupe proposé en Tactique seulement, et la phrase sur les taux.
8. **L'aide** de la page, si elle décrit le Tactique ou les objets.

### Lot E. Mesure et documentation

1. **Empreinte**: les quatre parties de référence (Horde) identiques à l'octet, sans exception de champ.
2. **Banc de charge**: une partie Tactique pleine, avant et après, consignée dans `docs/mesures/charge-serveur.md`.
3. **Documentation**: le journal de conception, le ROADMAP, CLAUDE.md si un comportement à préserver le demande (aucun n'est changé: les règles 4 et 10 s'appliquent telles quelles).

## Hors périmètre

- Les nouveaux objets dans un autre mode, Chasse comprise, même si ses traqueurs tirent en cône.
- Un autre zoom sur téléphone.
- Afficher les charges des adversaires.
- Retirer ou changer les objets existants.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les natures tactiques et leurs valeurs; le groupe de réglages complété, validé, présent en Tactique seulement; les bornes des durées et des taux.
- **Moteur (TU)**: chaque objet ramassé et son effet; le cumul de deux bonus identiques; la relance d'un malus; les autres joueurs frappés par un malus, pas le ramasseur; l'annulation de chaque paire; la recharge rapide et lente, y compris un effet qui commence et finit au milieu d'une attente, sans dépendre du découpage du temps; le Tir unique qui gèle et rend les charges; la Rafale sans coût mais avec la seconde entre deux captures de joueur; le cône large et étroit, bornes comprises; l'apparition à la moitié des taux, déterministe; aucun objet tactique hors du Tactique.
- **Serveur (TI)**: le lot C.
- **Client (TU)**: les icônes; l'arc et ses états; la visée et l'éclair au cône effectif; la hauteur de vue par mode; la minimap filtrée par le rayon; le groupe de réglages proposé en Tactique seulement.
- **Bout en bout**: le scénario du Tactique, avec un objet ramassé et l'arc affiché; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Tactique se crée, se joue et s'enregistre depuis la page, avec les six nouveaux objets, sur ordinateur et sur téléphone.
2. L'arc des charges, les icônes et la vue de 500 pixels correspondent aux planches retenues, vérifiés dans le navigateur de Claude Code.
3. L'empreinte des quatre parties de référence est identique à celle du handoff 5.7.
4. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **Les tirages du générateur**: les natures tactiques ne tentent leur chance qu'en Tactique; une partie Horde ne doit consommer aucun tirage de plus. L'empreinte le prouve.
2. **La recharge est bornée comprise et reportée** (étape 7.1): la vitesse variable ne doit rien casser de la propriété « vingt battements de 50 ms rendent autant qu'un battement d'une seconde ».
3. **Le flux binaire** (étape 2.3): toute donnée nouvelle d'une entité ou d'un événement demande son codage et un test de l'aller-retour.
4. **La vue de 500 pixels sur une petite carte**: la caméra se borne déjà aux limites de la carte; vérifier Spirit & Time et Tokyo en miroir.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-7-handoff.md`: les décisions construites, les écarts à cette fiche, l'empreinte, les mesures, l'état de la CI. Prochaine action exacte: demander au porteur du projet la fonctionnalité reportée suivante. Commiter.
