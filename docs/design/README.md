# docs/design - Maquettes et conception

## Ce que contient ce dossier

Les maquettes Neon Ninja réalisées avec Claude Design, et le journal vivant des décisions de conception. Les maquettes sont des propositions ouvertes, un point de départ à interroger, pas une spécification à suivre à la lettre.

Fichiers, déposés le 13 août 2026:
- `Neon Ninja.html`, le prototype autonome. S'ouvre dans un navigateur, hors ligne, les sept écrans sont navigables. C'est la référence visuelle et comportementale la plus commode.
- `Neon Ninja.dc.html`, la source du prototype (structure, logique, données de démonstration).
- `Icon.dc.html`, les tracés des trente-cinq pictogrammes SVG sur mesure.

  Attention: ces deux fichiers `.dc.html` chargent un `support.js` qui **n'est pas dans l'export**. Ouverts directement dans un navigateur, ils s'affichent mal ou pas du tout. Ils se lisent comme du code source. Pour voir le rendu, utiliser `Neon Ninja.html`, qui est autonome.
- `screenshots/01-accueil.png` à `07-profil-progression.png`, les captures pleine taille des sept écrans.
- `HANDOFF-CLAUDE-DESIGN.md`, le document de passation de l'export: jetons de conception, description écran par écran, états, modes, cartes, système de progression.

## Posture de travail

On ne suit pas les maquettes aveuglément. On interroge, on propose, on itère. Concrètement:

- Une maquette est une hypothèse de conception. Tout élément peut être questionné, gardé, modifié ou écarté.
- **Avertissement sur HANDOFF-CLAUDE-DESIGN.md.** Ce document se déclare lui-même « haute fidélité » et affirme que « couleurs, typographie, espacements, rayons, ombres et interactions sont définitifs ». **Cette affirmation ne nous engage pas.** Elle décrit la confiance de l'outil qui a produit l'export, pas une décision prise ici. Le document est une proposition dense et détaillée, avec beaucoup de projections: il se lit comme une source d'idées, jamais comme une spécification à appliquer telle quelle.
- On distingue ce qui est figé (le périmètre v1 validé, et les formes de données qui en découlent) de ce qui reste ouvert (le traitement visuel, les parcours, les interactions précises, le mobile).
- Une question ouverte se discute avant d'être tranchée. Une décision se consigne ici, avec sa raison et sa date.
- Quand une décision touche l'aval (modèle de données, contrats réseau, écrans), elle remonte dans docs/design/cadrage.md et dans la fiche d'étape concernée.

## Relation avec le plan

Deux documents, deux rôles. Ce README est le journal ouvert de la conception, où l'on échange et où l'on trace les décisions. docs/design/cadrage.md, produit à l'étape 0.3, est l'instantané consolidé que la construction consomme (phases 2, 3 et 4). Le README alimente le cadrage. Toute évolution ultérieure met à jour les deux.

## Ce qui est figé

Périmètre v1, validé le 2026-06-29:

- Construire: mode Classique, flux création et salon (public et privé), comptes et authentification, progression de base (niveau, XP, pièces, points de ligue, rang, historique de parties).
- Modéliser de façon extensible sans construire: pass de saison, skins, clans.
- Reporter: les cinq autres modes, le pass de saison, la boutique de skins, les clans, l'échelle de ligue détaillée.
- Architecture: le mode est un jeu de règles enfichable, Classique est le premier.

Tout le reste, en particulier l'apparence et l'ergonomie de chaque écran, reste ouvert à la discussion.

## Questions ouvertes

À discuter et trancher au fil de l'eau. Numérotées pour pouvoir s'y référer.

1. Mobile, schéma de contrôle (ambition tranchée le 2026-06-29, voir journal). Reste à confirmer le schéma tactile concret. Proposition en cours: manette virtuelle au pouce pour le déplacement, zone de tap pour la capture, agencement responsive qui replie la navigation latérale et réduit le HUD. À valider avant la phase 4.

2. Monnaie premium. La maquette montre deux monnaies, pièces et gemmes. En v1 on gagne des pièces. Les gemmes (monnaie premium) ont-elles un sens en v1 sans boutique où les dépenser ? On les affiche quand même, ou on masque le bloc gemmes tant que la boutique n'existe pas ?

3. Système de rang. La maquette montre un rang détaillé (Diamant II) et des points de ligue. On stocke le rang et les points en v1. Mais un vrai classement suppose un appariement par niveau, qu'on a reporté. En v1, le rang est-il une simple progression affichée tirée des points de ligue, sans appariement par compétence ? Quelle règle des points vers le palier ? Cela touche les récompenses de l'étape 3.3.

4. Les cinq modes non construits. La création montre six modes, seul Classique est jouable en v1. Comment présenter les cinq autres : grisés et marqués à venir, masqués, ou une seule tuile teaser à venir ? Et les fourchettes de joueurs par mode (Classique 4 à 12, Battle Royale 8 à 16, Équipes 2 contre 4) sont-elles justes pour notre jeu réel, ou des valeurs indicatives ? Cela touche la capacité à l'étape 2.4.

5. Cartes (tranché le 2026-06-29, voir journal). V1 sur les trois cartes existantes, Shibuya Cross reportée. Exigence structurelle: accueillir des cartes de tailles différentes en gardant un système de collision fonctionnel.

6. Effets du HUD. Le HUD affiche des effets nommés Invincibilité et Révélation. Sont-ce les bonus et malus du legacy, renommés pour la nouvelle conception ? Il faut associer l'ensemble des bonus et malus du moteur aux libellés du HUD, pour que l'affichage en jeu corresponde à ce que le moteur produit.

7. Défis du jour. Ils apparaissent sur l'accueil et l'écran de fin. Sont-ils dans le périmètre v1 ? Le cadrage les a laissés optionnels. Si oui, un ensemble minimal. Si non, les blocs de défis de l'accueil et de la fin sont reportés aussi.

8. Faux ninjas. La maquette part de 40 faux ninjas par défaut, on vise plus de 100. Quelle fourchette réglable par l'hôte, et quelle relation entre vrais ninjas (joueurs), faux ninjas (leurres) et le nombre de bots ? Le nombre s'adapte-t-il au nombre de joueurs ou à la carte ?

## Propositions

Idées à débattre, non décidées. Les propositions adoptées passent au journal.

1. Associer tôt les libellés du HUD aux effets du moteur. Fixer dans le cadrage la correspondance entre Invincibilité, Révélation et les bonus et malus du legacy, pour que moteur et interface s'accordent dès le départ. Lié à la question ouverte 6.

2. Compléments de maquette disponibles sur demande. Claude Design a proposé le 13 août 2026 de produire des ajouts: captures d'états spécifiques, variantes responsive, spécifications mobiles. Proposition de tri:

   - **À demander quand ce sera utile**: le schéma de contrôle tactile en jeu (emplacement de la manette virtuelle, zone de capture, éléments du HUD sacrifiés en petit écran). C'est la question ouverte 1, marquée à valider avant la phase 4, et ce n'est pas un problème de redimensionnement mais de conception. À confronter au joystick virtuel du legacy, déjà réglé.
   - **À demander quand ce sera utile**: les états non maquettés du salon (salon plein, code d'invitation invalide, perte de connexion), que le document de passation signale lui-même comme absents. Le salon fait partie du jalon 1.
   - **À ne pas demander pour l'instant**: les variantes responsive des écrans hors jeu. Le navigateur de parties, la création et le profil relèvent des jalons 2 et 3, et seront retaillés par le cadrage de l'étape 0.3. Produire leurs variantes maintenant reviendrait à travailler sur des écrans appelés à changer. La décision du 29 juin dit d'ailleurs qu'on adapte sans redessiner en mobile d'abord.

   Raison générale du report: tant que l'étape 0.3 n'a pas trié le périmètre, tout ajout de maquette augmente la matière à challenger et renforce l'ancrage sur des propositions qu'on doit pouvoir écarter.

## Journal des décisions

Consigner ici chaque décision tranchée, avec sa date et sa raison.

- 2026-06-29. Périmètre v1 validé (voir la section Ce qui est figé). Raison: la maquette décrit un produit bien plus large que le legacy, il faut bâtir la base v1 sans faire exploser le plan, tout en gardant le schéma extensible.
- 2026-06-29. Le mode est un jeu de règles enfichable, Classique en premier. Raison: ajouter un mode plus tard doit être un ajout, pas une refonte.
- 2026-06-29. Ambition mobile: mobile correct mais le bureau reste prioritaire. Conséquences: agencement responsive qui adapte les écrans de bureau (navigation latérale repliée, tableau des parties en cartes empilées, HUD réduit), contrôles tactiles fonctionnels, mais l'effort de finition va au bureau. On adapte, on ne redessine pas en mobile d'abord. Touche les étapes 4.2 (contrôles tactiles en plus du clavier), 4.3 (écrans responsives) et 4.4 (vérification en fenêtre mobile, en test de fumée).
- 2026-06-29. Cartes v1: les trois cartes existantes du legacy (map1 Rainy Tokyo, map2 Tokyo, map3 Spirit & Time, de tailles différentes), Shibuya Cross reportée comme contenu à créer. Raison: démarrer avec du contenu réel et jouable, sans création de carte pour la v1, tout en prévoyant des ajouts.
- 2026-06-29. Exigence structurelle des cartes: la structure doit accueillir des cartes de tailles différentes en gardant une collision fonctionnelle. Une carte est un descripteur de données (dimensions, données de collision, assets), pas du codé en dur. Le moteur ne consomme que les dimensions et les données de collision, en données pures et taille-agnostiques. La collision est dérivée de l'asset de collision de la carte en représentation de données, pour que le moteur reste pur. Ajouter une carte de n'importe quelle taille est alors un ajout de descripteur, sans modification du moteur. Touche les étapes 1.1 (le modèle d'état porte les dimensions de carte) et 1.2 (CollisionMap taille-agnostique sur données pures).
- 2026-06-29. Interface v1, deux choix d'affichage actés. Masquer entièrement les éléments reportés (gemmes, pass de saison, skins, clan) plutôt que de les griser. Et regrouper les cinq modes non construits en une seule tuile à venir sur l'écran de création. Raison: interface v1 honnête et épurée, sans promesses non tenues à l'écran.

- 2026-08-13. **Les durées de bonus se cumulent, et c'est voulu.** Ramasser deux bonus de vitesse coup sur coup donne vingt secondes, pas dix. Comportement du legacy, caractérisé à l'étape 0.2 et confirmé comme intentionnel par le porteur du projet. À porter tel quel. Consigné dans les comportements à préserver de CLAUDE.md (point 10). Touche l'étape 1.4.
- 2026-08-13. **Le bot noir garde la vitesse 5.** Les tests de caractérisation de l'étape 0.2 ont montré que le bot noir avance à 5 et non à 6: `BlackBot` lit `GAME_CONFIG.BOT_SPEED`, et le réglage `blackBotSpeed: 6` n'est lu nulle part. CLAUDE.md et l'audit annonçaient 6, tous deux corrigés. Décision: on garde le fonctionnement réel, joué depuis deux ans, plutôt que d'appliquer une valeur qui n'a jamais pris effet. Conséquence: le bot noir avance exactement à la vitesse d'un bot ordinaire, sa menace vient de sa poursuite dirigée, pas de sa vitesse. Le réglage `blackBotSpeed` est à retirer ou à brancher pour de bon lors du portage. Touche l'étape 1.5.

- 2026-08-13. **Les vitesses passent en pixels par seconde.** Le legacy déplace une entité d'une distance fixe à chaque événement, sans jamais regarder le temps: 3 pixels par message du client (toutes les 20 millisecondes), 5 pixels par battement du serveur (toutes les 50 millisecondes). Ramenées à la seconde, ces valeurs donnent 150 pixels par seconde pour un joueur et 100 pour un bot. Décision: le moteur exprime les vitesses par seconde et déplace proportionnellement au temps écoulé (dt). Raison: c'est la seule conversion qui préserve la vitesse réellement jouée, et elle supprime au passage la faille S2 de l'audit, où la vitesse d'un joueur dépendait de son débit de messages. Conséquence: la formule « joueur 3, bot 5 » reste vraie du legacy, mais ne se lit plus comme un rapport de vitesses. Voir le défaut X17 de l'audit. Touche les étapes 1.1, 1.2, 1.5 et 1.6.
- 2026-08-13. **Les réglages d'une partie voyagent dans son état.** Il n'existe aucun objet de réglages accessible globalement dans le nouveau code: le moteur ne connaît que celui que porte l'état qu'on lui passe. Raison: le legacy lisait par endroits les valeurs par défaut au lieu des réglages de la partie en cours (défaut X14), si bien que certains réglages du salon n'avaient aucun effet. Le défaut devient structurellement impossible. Touche les étapes 1.1 à 1.5 et 2.1.
- 2026-08-14. **La collision reste au pixel, mais tient dans un bit par pixel.** Le legacy construisait un tableau de tableaux de booléens aux dimensions de la carte, soit six millions d'entrées pour la grande carte et plusieurs dizaines de mégaoctets. Décision: garder exactement la même résolution, le pixel, mais la stocker à raison d'un bit par pixel, ce qui ramène la grande carte à 750 kilo-octets. Raison: une grille plus grossière aurait changé le tracé des murs dessinés depuis deux ans, alors que le coût mémoire, lui, n'était qu'un problème de représentation. Conséquence: le terrain voyage dans l'état de la partie, partagé par tous ses battements successifs et jamais recopié. La conversion de l'image de collision en données se fait hors du moteur, qui ne lit aucun fichier. Touche les étapes 1.2, 2.1 et 2.2.
- 2026-08-14. **La distance de sécurité au spawn est remise en service.** Le legacy prévoyait cent pixels entre deux apparitions, mais n'alimentait jamais le registre de positions qui aurait permis de l'appliquer (défaut X4): elle n'a donc jamais eu d'effet. Décision: la faire vivre plutôt que la retirer, parce qu'apparaître collé à un adversaire ou à un bot noir est une mauvaise expérience de jeu et que c'était manifestement l'intention. Elle reste un souhait et non une obligation: sur une carte trop encombrée, une place libre l'emporte sur la distance. Il n'y a plus de registre à tenir à jour, les positions occupées se lisent dans l'état. Touche les étapes 1.2 et 1.5.
- 2026-08-14. **Un mur ne se traverse plus, même en un seul pas.** Le test de collision du legacy n'examinait que le point d'arrivée d'un déplacement, jamais le trajet (défaut X15): un mur de deux pixels se franchissait d'un bond. Décision: balayer le trajet pixel par pixel. Raison: la caractérisation elle-même signale ce point comme une limite de méthode et non comme un réglage de jeu. Conséquence à connaître: en terrain dégagé, le moteur reste indifférent au découpage du temps, mais près d'un mur un pas de temps fin approche davantage du mur qu'un pas grossier. C'est la contrepartie normale d'un monde solide. Touche les étapes 1.2, 1.5 et 2.1.
- 2026-08-13. Maquettes déposées. Consigne explicite du porteur du projet: « à prendre avec des pincettes, créées avec Claude Design avec beaucoup de propositions et projections, à challenger le moment venu, ne surtout pas prendre tel quel sans réfléchir ». Cette consigne prime sur l'auto-déclaration de haute fidélité du document de passation. Voir l'avertissement en tête de fichier.

## Tensions relevées entre la maquette et le jeu réel

Relevées le 13 août 2026, par recoupement avec docs/audit/AUDIT-EXISTANT.md. **Elles ne sont pas tranchées.** Elles sont à instruire à l'étape 0.3, et alimentent les questions ouvertes ci-dessus.

1. **Le mode Miroir n'est pas un mode.** La maquette le présente comme un mode de jeu à part entière, avec une capacité propre (4 à 8 joueurs). Dans le jeu réel, le miroir est une **case à cocher** applicable à n'importe quelle carte, orthogonale au mode. Le modéliser en mode créerait une combinatoire artificielle (Classique-miroir, Chasse-miroir…). C'est la tension la plus structurante, car elle touche directement la notion de mode enfichable actée le 29 juin.

2. **Six modes affichés, un seul existe.** Le document de passation le reconnaît lui-même: Chasse, Battle Royale, Équipes et Chaos sont des propositions non validées. Cohérent avec la décision d'afficher une tuile unique « à venir ».

3. **Quatre cartes affichées, trois existent.** Shibuya Cross reste du contenu à créer, conformément à la décision du 29 juin.

4. **Le curseur de faux ninjas contredit l'objectif.** La maquette propose 10 à 80, par pas de 5, défaut 40. Le jeu réel démarre à 50 et l'objectif affiché est de dépasser 100. La borne haute est à revoir. Lié à la question ouverte 8.

5. **L'écran de profil suppose tout le système de rétention.** Pass de saison, skins, succès, clan, gemmes, ligues, défis quotidiens: tout cela est hors du périmètre v1, et très au-delà de l'ambition de départ d'un jeu entre amis. Les écrans Résultats et Profil relèvent du jalon 3, pas du jalon 1.

6. **Le ping affiché dans le navigateur de parties** suppose une mesure de latence par salon, qui n'existe nulle part aujourd'hui. À concevoir ou à retirer.

7. **Le bouton « Terminer » du HUD** n'a pas d'équivalent dans le jeu réel, qui propose une Pause. Décider s'il s'agit d'un abandon de partie, d'une pause renommée, ou d'un artefact de la maquette pour naviguer entre écrans.

8. **Ne pas introduire de framework front.** Le document de passation suggère de recréer les écrans dans « React, Vue, Svelte ou équivalent ». La stack décidée est PixiJS pour le jeu et le DOM pour les menus. Le passage par un framework serait une décision à part entière, à prendre pour ses propres raisons, pas parce qu'un export le suggère.

9. **Les jetons de conception sont utilisables tels quels.** Palette, typographie (Chakra Petch, Space Grotesk, Space Mono), espacements, rayons et pictogrammes SVG forment un système cohérent, sans dépendance externe et sans emoji, ce qui rejoint nos conventions. C'est la partie de la maquette la plus directement réutilisable.
