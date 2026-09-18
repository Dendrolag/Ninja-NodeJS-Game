# Handoff - Étape 7.4 Mode Massacre

Date: 18 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Ajouter au jeu son cinquième mode, le Massacre: plus de capture, un coup de katana en arc tue les faux ninjas et les joueurs qu'il balaie, chaque mort laisse du sang, les morts enchaînées font monter un multiplicateur, et la carte se vide. Troisième des fonctionnalités reportées, choisie par le porteur du projet.

## Ce qui a été fait

- **Le porteur du projet a tranché les dix questions** de `docs/design/idee-mode-massacre.md` au début de la session: nom Massacre; katana en arc de 160 degrés sur 60 pixels, toutes les 400 ms; carte qui se vide, fin quand tout est tué avec 5 points par seconde restante; combos (10 points par faux ninja fois un multiplicateur qui monte toutes les cinq morts enchaînées à deux secondes au plus, jusqu'à x5); PvP, la victime perd son combo et la moitié de ses points au profit de son tueur; Black Ninjas, bonus, malus et zones gardés, sauf la zone de chaos; solo lançable avec record personnel; sang réglé par chaque joueur; sons générés par script; huit joueurs.
- **Fiche** `docs/plan/etape-7-4.md` rédigée selon le cas de repli du PROTOCOLE (`4ebdf98`), réconciliée en fin d'étape (sept écarts).
- **Lots A et B (`20ddac3`)**: le mode dans le contrat, le cône du Tactique rendu réglable, `EtatPartie.massacre` (armes, points, combos), le coup, les morts, le joueur tué, la perte face à un Black Ninja, la carte vidée et son bonus, les points; les trois faits du moteur et leurs notifications à toute la partie; l'arme dans l'état tactique du flux; le record solo déduit des résultats; la migration.
- **Lot C (`360dc0c`)**: la page. Tuile, salon, bouton et touche du katana, arc de visée, traînée du coup, éclat des morts, cadavres, secousse, compteur de combo et ninjas restants, annonces, points qui s'envolent, aide, record au profil, zone de chaos retirée des réglages. Le sang tout en code, reproductible et imprimé sur un calque de sol, les traces de pas, la préférence de sang dans le panneau du son. Deux sons synthétisés par `tests/outils/sons-katana.ts`. Vérifié à l'écran, au bureau et sur téléphone, par le scénario de bout en bout et à la main dans le navigateur.
- **Lot D (`b1a9e64`)**: le micro-arrêt de l'impact, le banc de charge (section 16 de `docs/mesures/charge-serveur.md`), la documentation, et un défaut d'affichage corrigé en route (voir plus bas).

## Fichiers créés ou modifiés

Commit `4ebdf98` (fiche): `docs/plan/etape-7-4.md` (créé), `docs/plan/ROADMAP.md`.

Commit `20ddac3` (lots A et B): `packages/shared/src/constantes.ts` (mode, capacité 8, `MASSACRE`), `reglages.ts` et test (pas de chaos en Massacre), `evenements.ts` et `index.ts` (notifications `coupDeKatana`, `joueurTranche`, `carteVidee`), `comptes.ts` (`recordMassacreSolo`); `packages/sim/src/massacre.ts` et test (créés), `tactique.ts` (`geometrieDuCone`, `CONE_TACTIQUE`), `etat.ts`, `moteur.ts`, `contacts.ts` (`regleMassacre`), `score.ts`, `index.ts`, `modes.test.ts`; `packages/server/src/instantane.ts` et test, `ServeurSocket.ts`, `ServeurSocket.massacre.test.ts` (créé), `GameRoom.ts` (doc du bilan), `base/parties.ts` et `comptes/Authentification.ts` (record), `migrations/0006_mode_massacre.sql` et métadonnées; `tests/base/profil.test.ts`; client: nom, phrase, tuile et pictogramme `katana`, tuile cachée jusqu'au lot C.

Commit `360dc0c` (lot C): `tests/outils/sons-katana.ts` et `assets/sons/katana-*.wav` (créés); `packages/shared/src/massacre.ts` (créé, `multiplicateurDuCombo`), `ressources.ts`; `packages/client/src/rendu/sang.ts`, `traces.ts`, `katana.ts` (créés), `scene.ts`, `pixi.ts`, `boucle.ts`, `apparence.ts`; `hud/modele.ts`, `hud/surcouche.ts`, `page/styles/jeu.css`, `page/styles/composants.css`; `faits.ts`, `client.ts`, `annonces.ts`, `pointsFlottants.ts`, `sons/declencheurs.ts`; `interface/preferences.ts`, `composants/son.ts`, `composants/reglages.ts`, `composants/aide.ts`, `modeles/creation.ts`, `modeles/reglages.ts`, `modeles/profil.ts`, `ecrans/jeu.ts`, `ecrans/types.ts`, `application.ts`, `essais.ts`; `massacre.test.ts` et `massacre.essais.ts` (créés), tests de création, profil et boucle; `tests/e2e/massacre.spec.ts` (créé), `rendu-couleurs.spec.ts`, `rendu-pluie.spec.ts`.

Commit `b1a9e64` (lot D): `packages/client/src/rendu/katana.ts`, `boucle.ts`, `apparence.ts` (micro-arrêt), `interface/ecrans/jeu.ts` (taille du terrain suivie), `massacre.test.ts`; `tests/charge/battement.ts`; `docs/mesures/charge-serveur.md` et deux fichiers de chiffres bruts (créés); `docs/design/README.md`, `cadrage.md`, `idee-mode-massacre.md`; `docs/plan/etape-7-4.md`, `ROADMAP.md`; `CLAUDE.md`; `assets/README.md`.

Commit de ce handoff: `docs/handoffs/etape-7-4-handoff.md` (créé).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - **moteur** (`packages/sim/src/massacre.test.ts`, 38 tests): géométrie de l'arc et cône du Tactique inchangé, multiplicateur, lancement, coup (tout l'arc, attente, vide, direction), combos (fenêtre, plafond), joueur tué (moitié volée, réapparition, protection, un par coup, coup perdu dans le même battement), Black Ninja (tranché, prise payée au journal du battement), toucher sans effet, carte vidée et bonus, joueurs qui vont et viennent, classement, jeu de règles, malus, déterminisme d'une partie entière;
  - **serveur**: projection de l'arme et des trois notifications (`instantane.test.ts`), et `ServeurSocket.massacre.test.ts`: partie lancée seul sans chaos, coups annoncés jusqu'à la carte vidée qui termine la partie avec son bonus et un temps joué réel, joueur tué annoncé à tous;
  - **base**: le record solo, qui ignore les parties à plusieurs et les autres modes (`tests/base/profil.test.ts`);
  - **client** (`massacre.test.ts`, 26 tests): HUD du combo et du katana, annonces, sons, points, dessin reproductible du sang, empreintes, traces de pas, scène (niveaux normal, discret, désactivé), micro-arrêt, préférence; création d'une partie Massacre, profil;
  - **bout en bout**: `tests/e2e/massacre.spec.ts`, au bureau et sur téléphone.
- Résultat: **2 227 tests unitaires sur 2 227**; types des paquets, des tests et du bout en bout compilés en appelant tsc directement; linter et formatage verts. Bout en bout en local: **32 scénarios sur 32**.
- Couverture de `packages/sim`: **99,84 pour cent** des instructions (99,82 au handoff 7.3); `massacre.ts` à 100.
- **Empreinte du jeu identique** avant l'étape, après les lots A et B, et en fin d'étape, pour les quatre parties Classique de référence.
- Mesure de charge: section 16 de `docs/mesures/charge-serveur.md`. À 8 joueurs et 150 faux ninjas au départ, 0,281 ms par battement contre 0,379 en Classique, et 334 octets par message contre 435.
- État de la CI: verte sur les quatre commits de l'étape (détail plus bas).

## Décisions et écarts au plan

Six entrées au journal de `docs/design/README.md` (16 et 18 septembre 2026): les règles du mode, les points rangés dans l'état et le record déduit, toucher sans effet et la prise d'un Black Ninja lue au journal du battement, le cône réglable, l'arme dans l'état tactique et le combo dans les coups, le sang dans la page. Les sept écarts à la fiche sont dans sa section « Réconciliation ». À retenir ici:

1. **Le jeu de règles d'un mode ne s'est pas élargi**: le Massacre tient dans les questions existantes. La perte face à un Black Ninja se paie dans `agir`, d'après les prises du même battement.
2. **Le sang ne dépend que de ce que le serveur envoie**: la graine vient de l'identifiant du mort, et le générateur est celui de `packages/shared`.
3. **Défaut corrigé en route (règle 7)**: un canevas monté pendant que la page était cachée (onglet en arrière-plan, panneau masqué) restait à 0 sur 0, noir, jusqu'au prochain redimensionnement de la fenêtre. L'écran de jeu observe maintenant la taille du terrain lui-même.

## Problèmes connus et dette

Limites assumées du mode Massacre:

- **L'équilibrage reste à jouer**: barème, fenêtre du combo, part volée, bonus de temps, capacité de huit.
- **Le cadavre a une teinte fixe**, la couleur du mort n'étant pas transmise avec sa mort.
- **Le coût du sang dans la page n'est pas mesuré** par le banc du rendu (un calque de 6 Mo pour la plus grande carte, puis rien).
- **Les sons du katana sont synthétiques**, en attendant de vrais sons: ils se remplacent sous le même nom.
- **Le panneau du navigateur de Claude Code** ne dessine pas pendant qu'il est masqué: pour vérifier une partie à la main, le scénario Playwright est plus fiable.

Repris du handoff 7.3, inchangé: un traqueur éliminé ne voit que les traqueurs et sa caméra reste figée; le coût d'un tir en Chasse n'est pas mesuré; l'équilibrage de la Chasse reste à jouer; une proie infectée voit encore la flèche de localisation. Du handoff 7.2: on ne distingue ses coéquipiers qu'à la couleur; une partie Équipes coûte un peu plus cher; une équipe vidée n'est plus classée; un joueur entré en cours de partie Équipes ne choisit pas son camp; le chat n'est pas par équipe. Et du handoff 2.6: un hôte seul dans son salon le perd avec son lien; un joueur revenu dans le salon n'en est plus l'hôte; l'écoute des sessions fermées et les limites de tentatives vivent dans le processus; fermer la fenêtre du code de secours vaut « noté »; l'échec isolé, non reproduit, du test des routes des comptes; le serveur de développement local parle à la base de production (question au porteur du projet); jusqu'à 45 secondes pour constater une coupure silencieuse; la pluie coûte au chargement du décor; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone; les erreurs d'un travailleur échappent aux scénarios de bout en bout; le relevé des contacts et le lissage du client restent en carré du nombre d'entités; l'outil de Vercel est téléchargé par npx à chaque mise en ligne; des déploiements Vercel non promus restent de la première mise en ligne; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

## État de la CI

- `4ebdf98` (fiche) et `20ddac3` (lots A et B, exécution 35316144304): **vertes**, avec les trois travaux « Types, linter et tests », « Bout en bout » et « Mise en ligne ».
- `360dc0c` (lot C, exécution 35318663898) et `b1a9e64` (lot D, exécution 35319360618): **vertes**, avec les trois mêmes travaux.
- Vérifié ensuite depuis la machine de développement: `https://neon-ninja.onrender.com/sante` rend la version `b1a9e640a476886eb4e439fe84586f04d84469bf`.
- Le commit de ce handoff ne touche que la documentation: sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `b1a9e64`.

## Après l'étape: correctif du 18 septembre 2026

Signalé par le porteur du projet: le personnage contrôlé se retournait face à l'écran dès qu'on s'arrêtait. Corrigé: le moteur garde la dernière direction à l'arrêt, comme le jeu d'origine, et la page montre alors la première image du personnage tourné (`packages/sim/src/moteur.ts`, `packages/client/src/rendu/scene.ts`, tests du moteur, du Tactique et de la scène; entrée au journal de conception). L'empreinte des parties Classique de référence change pour cette seule raison: la direction fait partie de l'état; captures, prises par Black Ninja, bonus et malus identiques. Nouvelles empreintes du jeu: `49aac682…9121` (150 bots, 12 joueurs), `cc2954ee…7b7a` (50 bots), `f3f388d2…360b` (300 bots sans mur), `a5329da1…7226` (150 bots, 2 joueurs).

## Prochaine action exacte

Dans une conversation neuve, sur `master`: demander au porteur du projet la fonctionnalité reportée suivante (Battle Royale, Chaos, pass de saison, skins, clans), trancher ses règles avec lui, puis rédiger sa fiche selon le cas de repli du PROTOCOLE et la commiter avant de l'exécuter.

Au porteur du projet: jouer un Massacre seul puis à plusieurs, pour régler le barème, la fenêtre du combo et le niveau de sang par défaut; écouter les deux sons du katana, et dire s'il veut les remplacer. Toujours en attente des handoffs précédents: une Chasse et une partie Équipes à plusieurs, les sons et la musique (cas C21), la base du serveur de développement local (handoff 3.4).

## Étape suivante

Fiche à lire: aucune encore; celle de la fonctionnalité reportée suivante, à rédiger au début de la session, une fois ses règles tranchées par le porteur du projet.
