# Fiche étape 7.3 - Mode Chasse

Brief de session. Objectif unique: ajouter au jeu son quatrième mode, la Chasse, où des traqueurs infectent les proies qu'ils attrapent, et où les proies doivent tenir jusqu'au bout. Deuxième des fonctionnalités reportées, choisie par le porteur du projet après le mode Équipes.

## Origine de cette fiche

Aucune fiche n'existait: le handoff 7.2 renvoie aux fonctionnalités reportées (Chasse, Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet. Elle est rédigée le 16 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- la section 3 du ROADMAP, et la fiche 7.2 prise comme modèle;
- la section 6 du cadrage (`docs/design/cadrage.md`);
- la maquette (`docs/design/HANDOFF-CLAUDE-DESIGN.md`): « Chasse, 5-10 J, un traqueur, des proies. Survivez jusqu'au bout. » Une proposition non validée (cadrage, tension 2), sans règles;
- l'état du dépôt au commit `8264f69`, et le handoff 7.2;
- douze décisions posées au porteur du projet le 16 septembre 2026.

**Aucune référence de comportement.** Ni la v0.8.6, ni la v0.9.0 n'ont de mode Chasse: il n'y a rien à caractériser. Les règles ci-dessous font foi, et les comportements à préserver de CLAUDE.md s'appliquent partout où elles ne disent pas le contraire.

**Numéro**: 7.3, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.2, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, la section 6 du cadrage et la fiche 7.2.

## Décisions du porteur du projet, 16 septembre 2026

1. **La Chasse vient après les Équipes** parmi les fonctionnalités reportées.
2. **Infection.** Une proie attrapée par un traqueur devient traqueur à son tour. Les traqueurs se multiplient jusqu'à la fin.
3. **La survie seule compte.** Les ninjas de la carte ne font pas le score.
4. **Les premiers traqueurs sont tirés au sort** au lancement.
5. **Dix joueurs au plus.**
6. **Un traqueur par cinq joueurs au lancement**, arrondi au-dessus: un de 2 à 5 joueurs, deux de 6 à 10.
7. **Deux équilibrages**: un nouveau traqueur ne capture qu'au bout de trois secondes; les proies ont trois secondes d'avance au lancement. Les traqueurs vont à la même vitesse que les proies.
8. **Deux camps à la fin.** S'il reste une proie au terme du temps, les proies survivantes gagnent et tous les traqueurs perdent; sinon, tous les traqueurs gagnent. Les récompenses se calculent par camp, comme en Équipes. La partie s'arrête dès que la dernière proie tombe.
9. **Les ninjas servent de camouflage.** Ils errent toujours, sans compter pour personne, et les proies peuvent s'y fondre. Pas de Black Ninjas. Bonus et malus restent en jeu: l'invincibilité protège une proie, un malus frappe l'autre camp.
10. **Les traqueurs portent une couleur commune**, le rose-rouge `#FF2E7E` de la tuile Chasse; les proies gardent la leur. Une proie infectée change de couleur.
11. **Si tous les traqueurs quittent la partie**, une proie tirée au sort devient traqueur, avec son délai de trois secondes, et la partie continue.
12. **On n'entre pas dans une Chasse lancée.** Le retour d'un joueur dont le lien est tombé (étape 2.5) reste permis. **On lance à deux joueurs au moins.**

Écartés par ces décisions: le chat perché à un seul traqueur, l'élimination, la perte des ninjas au profit du traqueur; le score en ninjas, mixte ou au temps de survie individuel; le traqueur désigné par l'hôte ou volontaire; huit ou douze joueurs; toujours un seul traqueur; des traqueurs plus rapides; les Black Ninjas qui infectent, la carte vide; un marqueur au lieu d'une couleur; la victoire des proies quand les traqueurs partent; l'entrée en cours de partie comme traqueur; trois joueurs pour lancer.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Nom « Chasse », identifiant `chasse`.** Le nom de la maquette et du cadrage.
2. **Un traqueur, pour le moteur, c'est la couleur des traqueurs.** Comme une équipe en Équipes. `captureAutorisee` refuse déjà une capture entre joueurs de même couleur: deux traqueurs ne se capturent pas. `COULEUR_DES_TRAQUEURS` rejoint les couleurs réservées: aucun joueur, aucun bot à sa naissance ni aucune zone de chaos ne la reçoit hors du rôle.
3. **Le moment où chacun est devenu traqueur vit dans l'état**, dans un champ facultatif propre au mode (`chasse`), comme l'état tactique de l'étape 7.1: une table de l'identifiant d'un traqueur vers le temps de jeu écoulé quand il l'est devenu. C'est ce qui porte le délai de trois secondes et le temps de survie. Une seule fonction fait d'un joueur un traqueur, et pose sa couleur et son moment ensemble. Une partie Classique n'a pas ce champ: son état et son empreinte ne changent pas.
4. **Seul un traqueur capture, et seulement une proie.** Deux proies qui se touchent, ou un traqueur et une proie dans l'autre sens, ne produisent rien. Il n'y a donc jamais de tirage au sort entre deux attaquants. Le traqueur capture si `captureAutorisee` l'accepte (protection, invincibilité, délai d'une seconde) et s'il est traqueur depuis plus de trois secondes.
5. **L'infection a lieu sur place.** La proie ne réapparaît pas ailleurs: elle prend la couleur des traqueurs là où elle est, et son délai de trois secondes la laisse s'éloigner ou se faire fuir. L'événement de capture existant la décrit: zéro ninja transféré, nouvelle couleur celle des traqueurs.
6. **Un joueur ne repeint aucun ninja**, et un joueur invincible ne rencontre aucun Black Ninja: ils n'existent pas. Les ninjas gardent la couleur quelconque de leur naissance, que seule une zone de chaos change; aucune couleur de joueur ne se transmet donc entre eux.
7. **Les Black Ninjas sont absents par le mode, pas par un réglage de l'hôte.** Les réglages imposés par un mode vivent dans une fonction pure de `packages/shared`, que le moteur applique en créant l'état et que le salon affiche; les réglages des Black Ninjas n'apparaissent pas dans un salon Chasse.
8. **Les premiers traqueurs sont tirés au lancement, après les ninjas**, par le générateur à graine, parmi les joueurs dans leur ordre d'entrée dans l'état. Ils deviennent traqueurs au temps zéro: leur délai de trois secondes coïncide avec la protection d'apparition que chaque proie porte déjà depuis le salon (décision 7). Le jeu de règles d'un mode gagne ce qu'il fait au lancement; les autres modes n'y font rien, sans tirage.
9. **Le remplacement d'un traqueur parti (décision 11)** se fait dans le battement, dans ce que le mode fait des entrées: s'il n'y a plus aucun traqueur et au moins deux joueurs, une proie est tirée au sort. Seul dans la partie, un joueur reste proie jusqu'au terme. Un traqueur absent (étape 2.5) est encore dans l'état: il compte, immobile, jusqu'à son retour ou sa sortie.
10. **La fin anticipée (décision 8)**: une partie Chasse est terminée quand il ne reste plus aucune proie, qu'elle soit tombée ou partie. Le jeu de règles d'un mode gagne ce verdict; les autres modes n'ont que le temps.
11. **Le score d'un joueur en Chasse est son temps de survie, en secondes entières**: le temps de jeu écoulé pour une proie, le moment où il est devenu traqueur pour un traqueur. Le classement range les proies d'abord, puis les traqueurs par survie, à égalité par captures. Ce sont aussi les points enregistrés: aucun ninja n'est porté, et le temps de survie est ce que le mode fait valoir.
12. **Le placement enregistré et les récompenses** reprennent la règle des camps des Équipes, sans égalité possible: les vainqueurs présents sont premiers et devancent tous les autres, abandons compris, avec les points de ligue du premier; les perdants sont placés juste après et ne devancent que les abandons, avec les points de ligue du dernier. Un abandon reste dernier. Ce qui est commun aux deux modes se partage dans `packages/shared`.
13. **Une chasse gagnée avant le terme vaut une partie entière.** Le temps de jeu d'un présent court jusqu'à la durée réglée, et non jusqu'au battement de la dernière capture: les traqueurs ne sont pas payés moins d'XP pour avoir gagné vite. La règle des trois minutes pour la ligue lit la durée réglée, comme ailleurs.
14. **Le camp se déduit de la couleur partout où le client en a besoin** (HUD, fin de partie, notifications), par une fonction pure de `packages/shared`: le flux d'état ne change pas de forme.
15. **La partie rapide ne change pas**, et une Chasse lancée disparaît déjà de la liste des parties publiques, qui ne montre que les salons.
16. **Refus d'entrée**: « Cette chasse a déjà commencé. », par code comme par la liste.

## État de départ, constaté dans le dépôt

Ce qui existe et se réutilise:

- **Le branchement du mode**: `MODES` et `CAPACITES` (`packages/shared/src/constantes.ts`); `EtatPartie.mode`; `REGLES_DES_MODES` et `JeuDeRegles { agir; resoudreContacts; perteFaceAuBotNoir; victimeDuMalus }` (`packages/sim/src/moteur.ts`).
- **Les règles de contacts par mode** (`regleDeContacts`, `contacts.ts`) et les captures autonomes (`capture.ts`), dont `capturerAvec` et son issue par mode.
- **Un état propre à un mode**, `EtatPartie.tactique`, facultatif, et sa transmission par le flux.
- **Les camps et leurs récompenses**: `placeDansLesEquipes` et `Devancement` (`packages/shared/src/equipes.ts`, `progression.ts`), le bilan par camp de `GameRoom`.
- **La condition de lancement** de `GameRoom`, vérifiée au démarrage et au terme du décompte par `ServeurSocket`.
- **Côté client**, `NOMS_DES_MODES` et `CAPTURES_DES_MODES`, la tuile « À venir », le HUD, le salon et l'écran de fin qui distinguent déjà les Équipes.

Ce qui manque:

- **Rien dans le jeu de règles ne dit ce qu'un mode fait au lancement, ni quand il est décidé avant le terme.** `GameRoom.lancer` ne fait que poser les ninjas; `evaluerFinDePartie` ne lit que le temps.
- **Le score ne connaît que les ninjas** (`scoreDe`), et le bilan fait courir le temps joué jusqu'au dernier battement.
- **Rien n'impose de réglage selon le mode**: les Black Ninjas viennent des réglages de l'hôte.
- **`accueillir` accepte toujours une partie en cours**, et la condition de lancement ne compte pas les joueurs.

## Périmètre

Découpé en lots, dans l'ordre d'exécution. Chaque lot se termine vert et se commite; si l'étape déborde d'une session, le handoff partiel s'arrête à la fin d'un lot.

### Lot A. Le jeu de règles Chasse dans le moteur

1. **L'empreinte du jeu** des quatre parties Classique de référence est relevée avant toute modification.
2. **Le mode `chasse`** rejoint `MODES`, avec sa capacité (10), la couleur des traqueurs et les réglages imposés par le mode (micro-décision 7) dans `packages/shared`; et, dans le même lot, ce que la compilation et la CI exigent dès qu'un mode existe: son nom et sa phrase de capture dans les tables du client, et la migration de l'énumération `mode_de_jeu`, écrite par `pnpm base:generer`. Jusqu'au lot C, l'écran de création ne propose pas le mode.
3. **Le jeu de règles s'élargit à deux questions** (micro-décisions 8 et 10): ce que le mode fait au lancement, et s'il est décidé avant le terme. Le Classique, le Tactique et les Équipes n'y font rien.
4. **L'état de la Chasse** (micro-décision 3): devenir traqueur, être traqueur, depuis quand, et pouvoir capturer.
5. **Le tirage des premiers traqueurs** (décisions 4 et 6) et **le remplacement d'un traqueur parti** (micro-décision 9).
6. **Les contacts du mode Chasse** (micro-décisions 4 à 6): l'infection, sans duel ni ninja repeint, sans dupliquer ce que `regleDeContacts` partage.
7. **Le malus** frappe l'autre camp; **la perte face à un Black Ninja** reste celle du Classique, sans objet.
8. **Le score en Chasse** (micro-décision 11), et **la fin anticipée** (micro-décision 10).
9. **Les couleurs réservées** (micro-décision 2): la couleur des traqueurs n'est tirée ni pour un joueur, ni pour un ninja, ni par une zone de chaos.

### Lot B. Salon, serveur, contrat, fin de partie et base

1. **Le camp d'une couleur et l'issue d'une Chasse** (micro-décision 14): fonctions pures de `packages/shared`, depuis le classement.
2. **La place par camp** (micro-décision 12), partagée avec les Équipes sans rien changer à leurs résultats.
3. **`GameRoom`**: capacité, refus d'entrée dans une Chasse lancée (micro-décision 16), condition de lancement à deux joueurs, tirage au lancement par le jeu de règles, bilan par camp avec le temps joué jusqu'à la durée réglée (micro-décision 13).
4. **`ServeurSocket`**: le refus de démarrage à un joueur, et le décompte annulé si le salon retombe à un joueur, par la condition de lancement existante.
5. **La création** accepte le mode Chasse, et **la base** enregistre une partie Chasse, avec ses placements et ses gains.

### Lot C. Le client

1. **Création**: la tuile Chasse, sélectionnable, avec sa phrase; la tuile « À venir » reste pour Battle Royale et Chaos.
2. **Salon**: la phrase de capture du mode; « Lancer » suspendu à un joueur, avec la raison; les réglages des Black Ninjas masqués.
3. **HUD**: son rôle (proie ou traqueur), le nombre de proies restantes, et le classement en temps de survie.
4. **Fin de partie**: l'issue (« Les proies ont survécu », « Les traqueurs l'emportent »), les survivants, les traqueurs, les temps de survie; le récapitulatif des gains inchangé.
5. **Aide**: une ligne sur le mode Chasse. **Notifications**: l'infection dite comme telle, à l'infecté comme au traqueur.

### Lot D. Bout en bout, mesure et documentation

1. **Scénario** (`tests/e2e/chasse.spec.ts`): un hôte crée une partie Chasse; « Lancer » est suspendu tant qu'il est seul; un second joueur arrive, la partie se lance, chacun voit son rôle; le scénario lit le salon et le HUD sur un ordinateur et un téléphone.
2. **Charge**: une partie Chasse pleine passe au banc (`pnpm charge --banc --mode chasse`), comparée au Classique; chiffres dans `docs/mesures/charge-serveur.md`.
3. **Empreinte**: celle des quatre parties Classique de référence est identique à celle relevée avant le lot A.
4. **Documentation**: cadrage (sections 1, 4, 5 et 6), journal de conception, ROADMAP, et CLAUDE.md: les comportements à préserver 1 et 4 doivent dire ce qu'ils deviennent en Chasse.

## Hors périmètre

- Des traqueurs plus rapides, un radar ou une flèche vers les proies, un temps de survie par capture.
- Les autres modes (Battle Royale, Chaos), et la Chasse en équipes ou en Tactique.
- Le mode spectateur, l'entrée en cours de partie.
- Des statistiques ou des récompenses propres au mode au-delà de la micro-décision 12.
- Toute modification du comportement du Classique, du Tactique ou des Équipes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Rôles (TU)**: devenir traqueur pose la couleur et le moment ensemble; une proie n'est pas traqueur; le délai de trois secondes, refusé à trois secondes pile et accordé juste après.
- **Lancement (TU)**: un traqueur de 2 à 5 joueurs, deux de 6 à 10; tirage reproductible à graine égale; les autres modes ne tirent rien et leur état ne change pas.
- **Infection (TU)**: un traqueur prêt infecte la proie qu'il touche, sur place; la proie protégée, invincible, ou le traqueur dans son délai ou dans sa seconde entre deux captures ne produisent rien; deux proies, deux traqueurs, une proie qui touche un traqueur ne produisent rien; aucun ninja repeint; l'événement de capture et les compteurs.
- **Remplacement (TU)**: plus de traqueur à deux joueurs ou plus, une proie tirée au sort devient traqueur avec son délai; seul, rien; un traqueur absent compte.
- **Malus et monde (TU)**: un malus frappe l'autre camp; aucun Black Ninja n'apparaît, quels que soient les réglages reçus; la couleur des traqueurs n'est jamais tirée pour un ninja, une zone de chaos ou une proie.
- **Score et fin (TU)**: temps de survie d'une proie et d'un traqueur; ordre du classement; la partie est décidée quand la dernière proie tombe ou part, pas avant; le temps décide toujours.
- **Moteur (TU)**: deux parties Chasse de même graine et mêmes entrées sont identiques; le jeu de règles élargi ne change rien au Classique, au Tactique et aux Équipes, et tous les tests existants restent verts sans modification de leurs attentes.
- **Camps et récompenses (TU)**: issue, place des vainqueurs et des perdants, abandons; les Équipes inchangées.
- **Salon et serveur (TI)**: capacité de dix; entrée refusée dans une Chasse lancée, retour après coupure accepté; lancement refusé seul; décompte annulé si le salon retombe à un joueur; réglages des Black Ninjas sans effet; une partie Chasse à travers le vrai serveur, jusqu'à une infection et la fin anticipée; bilan, temps joué jusqu'à la durée réglée.
- **Base (TI)**: migration rejouable; une partie Chasse enregistrée, placements et gains compris.
- **Client (TU)**: création d'une partie Chasse; salon (« Lancer » suspendu, Black Ninjas masqués); HUD (rôle, proies restantes); fin (les deux issues); notifications d'infection.
- **Bout en bout**: le scénario du lot D, sans erreur de console.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Chasse se crée, se prépare au salon, se joue et s'enregistre depuis la page, au bureau et sur téléphone.
2. **Le Classique, le Tactique et les Équipes n'ont pas changé**: tests existants inchangés, empreinte du jeu des quatre parties de référence identique.
3. Ajouter le mode n'a demandé que des ajouts aux points d'extension, plus l'élargissement du jeu de règles (lot A, point 3), décrit dans la section 6 du cadrage.
4. La couverture de `packages/sim` ne baisse pas (99,79 pour cent au handoff 7.2).
5. Le cadrage, le journal de conception et CLAUDE.md décrivent ce qui a été construit.

## Points de vigilance

1. **Le tirage au lancement et le remplacement consomment l'aléa.** Ils ne doivent le faire qu'en Chasse: un tirage de plus en Classique décalerait toute la partie. L'empreinte est le garde-fou, vérifiée à la fin du lot A.
2. **La couleur et la table des traqueurs ne doivent jamais diverger.** Une seule fonction les écrit; aucun autre chemin (réglages changés au salon, retour de l'étape 2.5) ne donne la couleur des traqueurs.
3. **La fin anticipée et le premier battement.** Une Chasse sans traqueur tiré n'est pas décidée pour autant; une Chasse au salon n'est jamais évaluée comme terminée.
4. **Les points d'une proie montent chaque seconde**: le classement change à chaque seconde, et le flux d'état l'envoie. Le banc dit ce que cela coûte.
5. **L'exclusion d'une couleur de plus dans les tirages** ne change un tirage que s'il tombait exactement sur elle: l'empreinte doit le confirmer.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-3-handoff.md`: les décisions construites, les écarts à cette fiche, les chiffres du banc, l'état de la CI. Prochaine action exacte: demander au porteur du projet la fonctionnalité reportée suivante (Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles, puis rédiger sa fiche. Commiter.
