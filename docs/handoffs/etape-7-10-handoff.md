# Handoff - Étape 7.10 La poche et la fumée

Date: 28 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Donner à chaque joueur une poche d'une place, qui garde un objet ramassé jusqu'à ce qu'il choisisse de s'en servir, et y mettre le premier de ces objets, la fumée: déclenchée, elle enveloppe le ninja d'un nuage et le fait réapparaître ailleurs sur la carte, loin des menaces.

## Ce qui a été fait

- **Faite dans la conversation qui l'a décidée**, à la demande du porteur du projet, comme les étapes 4.6 et 7.9. La même conversation a étudié et tranché les étapes 7.10, 7.11 et 7.12, et en a écrit les fiches.
- **Le moteur** (`packages/sim/src/poche.ts`, créé): ramasser une fumée remplit la poche; une poche pleine passe sur l'objet sans le prendre. La poche se vide à toute prise: capture, prise par un Black Ninja, infection en Chasse, mort en Massacre. Le joueur qui s'en sert reparaît au hasard, loin des autres joueurs, des Black Ninjas et de l'Évadé, et à un tiers de carte au moins de son départ, cette distance se relâchant avant l'écart aux menaces. La fumée se résout juste après le déplacement des joueurs, avant les bots, les tirs et les contacts: elle l'emporte sur un contact du même battement. Rien d'autre ne change pour le joueur. Une demande sur une poche vide ne tire rien du générateur.
- **L'apparition**: la fumée tente sa chance avec les bonus, après toutes les autres natures, dans tous les modes, à la moitié de son taux en Tactique. Réglage `objetsDePoche.fumee` (actif, taux), 15 pour cent par défaut.
- **La poche ne regarde que son porteur** (décision révisée par le porteur du projet): elle ne voyage pas dans le flux d'état, commun à toute la partie. Le serveur l'envoie au seul joueur, par le message `poche`, à chaque changement, et la redit à l'entrée et au retour après une coupure. L'objet empoché (`objetEmpoche`, à lui seul) et le nuage (`fumee`, à tous) sont des notifications.
- **L'intention** `utiliserLaPoche`, sans charge, avec son seau de cadence (deux par seconde), relayée par la room au battement suivant, comme un tir.
- **La page**:
  - la touche E dans tous les modes, ignorée dans un champ de saisie, et, sur écran tactile, un disque de brume à gauche de la minimap, caché poche vide;
  - la carte de poche en tête des effets, sans jauge, avec la touche E;
  - un grand titre « En poche · Fumée » à l'empochement;
  - le nuage C, dans une couche de la scène au-dessus des personnages et sous les toits, au départ et, plus petit, à l'arrivée;
  - le son `fumee`, provisoire;
  - « E pour la fumée » au rappel des touches, une section « À garder en poche » dans l'aide, et les deux champs de la fumée au formulaire, avec une ligne au récapitulatif du salon.
- **La planche** `docs/design/etape-7-10/1-fumee.png`: le nuage (A, B, C), la marque de poche (A, B, C, finalement aucune), le HUD (A, B), le bouton sur téléphone (A, B). Retenus: nuage C, HUD A, téléphone A. Le pictogramme a été redessiné sur la forme du nuage C, à la demande du porteur du projet.

## Fichiers créés ou modifiés

- `packages/shared`:
  - `constantes.ts`: `TYPES_OBJETS_DE_POCHE`, `ObjetDePoche`, `FUMEE`, et `NatureBonus` qui les comprend;
  - `reglages.ts`: le groupe `objetsDePoche`; `validation.ts`: sa validation; `bornes.ts`: le seau `poche`;
  - `evenements.ts`: `ObjetEmpoche`, `PocheVue`, `FumeeVue`, l'intention `utiliserLaPoche`, les messages `objetEmpoche`, `poche`, `fumee`, et une note sur `JoueurVu` qui interdit d'y mettre la poche;
  - `flux.ts`: la fumée parmi les natures d'objet, ajoutée à la fin;
  - `ressources.ts`: l'icône et le son `fumee`; `index.ts`: les exports.
- `packages/sim`:
  - `poche.ts` (créé);
  - `moteur.ts`: l'intention, et les poches servies après le déplacement;
  - `objets.ts`: l'apparition et le ramassage, `accorderLeBonus` typé sans les objets de poche;
  - `capture.ts`, `bots.ts`, `massacre.ts`, `chasse.ts`: toute prise vide la poche;
  - `etat.ts`: `Joueur.poche`, les faits `objetEmpoche` et `fumee`; `index.ts`: les exports.
- `packages/server`:
  - `ServeurSocket.ts`: le message, le seau, `annoncerLesPoches` et la mémoire par connexion, remise à zéro à l'entrée et au retour;
  - `GameRoom.ts`: `demanderLaPoche` et les entrées du battement;
  - `instantane.ts`: les notifications, et un commentaire qui écarte la poche de la projection;
  - `releveDesExploits.ts`: les deux faits, sans effet.
- `packages/client`:
  - `client.ts`, `faits.ts`, `actions.ts`, `etat.ts`, `reduction.ts`: les messages, les faits, l'état `poche`, remis à vide au lancement;
  - `controles/touches.ts`, `clavier.ts`, `controles.ts`, `rendu/boucle.ts`: la touche E et la demande;
  - `hud/modele.ts`, `hud/surcouche.ts`, `page/styles/jeu.css`: la carte et le bouton;
  - `rendu/apparence.ts`, `scene.ts`, `pixi.ts`: `APPARENCE_FUMEE`, le nuage et sa couche;
  - `annonces.ts`, `sons/declencheurs.ts`: l'annonce et le son;
  - `interface/composants/aide.ts`, `interface/ecrans/jeu.ts`, `interface/modeles/reglages.ts`, `salon.ts`: l'aide, le rappel, le formulaire, le récapitulatif.
- `assets/objets/fumee.svg` (créé): le pictogramme, en planche de deux images comme ceux du Tactique.
- `tests/charge/empreinte.ts`: l'option `--sans-poche`, et des joueurs qui se servent de leur poche à des battements fixes sans rien tirer du générateur de l'outil.
- `tests/e2e/poche.spec.ts` (créé), `tests/e2e/harnais/parcours.ts` (mission `ramasserUneFumee`), `tests/e2e/rendu-couleurs.spec.ts`, `rendu-miroir.spec.ts`, `rendu-pluie.spec.ts`: le champ `fumees` de leurs scènes d'essai.
- Documentation:
  - `docs/plan/etape-7-10.md`, `etape-7-11.md`, `etape-7-12.md` (créées), la fiche 7.10 avec sa réconciliation;
  - `docs/plan/ROADMAP.md`, `docs/design/README.md`: la décision, l'étape faite, le journal;
  - `docs/design/etape-7-10/1-fumee.png` (créée);
  - `docs/mesures/charge-serveur.md` (section 21) et `charge-serveur-7-10-horde.json` (créé);
  - ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - moteur (`poche.test.ts`, 24 cas): le ramassage, la poche pleine, la fumée tirée à son taux, sans tirage coupée, à moitié en Tactique; le vidage à chaque sorte de prise, pas quand on devient traqueur sans être pris; la destination loin des menaces et du départ, déterministe, le relâchement sur une carte sans place; la fumée qui l'emporte sur un contact; ce qui ne change pas; la poche vide et le joueur hors jeu; deux fuites du même battement;
  - la partie de référence avec la fumée, une troisième instantané, les deux d'avant restant ceux d'avant l'étape, fumée coupée;
  - contrat: la validation du réglage, la fumée posée dans le flux, les treize icônes;
  - serveur: la projection sans poche et les deux notifications; la room qui ignore une demande au salon ou d'un absent; à travers le vrai serveur (`ServeurSocket.poche.test.ts`), la fumée empochée, dite au seul porteur, puis la fuite vue des deux joueurs, et une demande sur poche vide sans effet, stables sur quatre passages après la dernière modification;
  - page: le son et l'annonce, la touche E (une fois, pas dans un champ, oubliée à l'entrée), le modèle et la surcouche du HUD (carte, bouton, sans bouton), l'état et les messages, le nuage de la scène (vie, taille d'arrivée, zone d'invisibilité, gonflement et bouffées), le récapitulatif du salon;
  - bout en bout: `poche.spec.ts`, dans les deux cadrages. Alice est guidée jusqu'à une fumée, la carte de poche paraît, elle s'en sert par E ou par le bouton, le serveur la déplace et vide sa poche, la carte s'en va. Capture d'écran jointe au rapport.
- Résultat: 3 127 tests unitaires et d'intégration au vert en local (`--project unitaires`), types, linter et formatage verts; les tests de la base sautés en local, joués par la CI. Bout en bout: `poche.spec.ts` 2 sur 2 en local.
- Couverture de packages/sim: 99,81 pour cent des instructions et 98,93 des branches (`poche.ts` 100 et 92, `objets.ts` et `moteur.ts` 100).
- Empreinte des parties de référence, fumée coupée (`--sans-poche`): identique à l'octet à celle du handoff 7.9, jeu et flux, pour les quatre parties.
- Nouvelles empreintes, fumée active (réglages par défaut):
  - 150 bots, 12 joueurs, murs: jeu `9b206692ccb5acd192b6790c1ac44653dddb0fd7948bf05bd48fcfd85cab7c9f`, flux `1b6998572c963b542d8131f69470a7892588ae04e0c1029d612fa25b77f687a0`
  - 50 bots, 12 joueurs, murs: jeu `f13073961d350ddcc3e348ce9578da5971599309cc4894f29366a4e11113590f`, flux `c3b4ae53eb4f8de24c2ccd3c8f37abd1a3501d0dfeff90a5541e2516d9689388` (une fumée ramassée et utilisée)
  - 300 bots, 12 joueurs, sans mur: jeu `174fb38bc90a0e7aa3159807c4b1548f79008a5f45ddcdbe28adc87eb0026698`, flux `35b39038c31b558ed8b6519317cb33bafcef8c9f781e416c3909f8c674e5a07c`
  - 150 bots, 2 joueurs, murs: jeu `49180c49e1480da7bfb4ea4c1d3da79488a723a3030ed53b6bbcc8fa529b87c0`, flux `3d05ac1b160384f3bf7a289c1bd72e6082968da70856b86f3560b51f12f6ed33`
- Banc de charge: la fumée ne coûte rien de mesurable; avec la graine du banc, elle fait jouer une autre partie, plus chargée à 300 faux ninjas. Section 21 de `docs/mesures/charge-serveur.md`.
- État de la CI: voir la ligne ajoutée en fin de handoff après la poussée.

## Décisions et écarts au plan

1. **Écart de méthode, demandé par le porteur du projet**: l'étape s'est faite dans la conversation qui l'a décidée.
2. **La poche n'est visible de personne d'autre**, décision 3 révisée par le porteur du projet sur la planche. Elle ne passe donc pas par le flux d'état, où un client modifié la lirait, mais par un message au seul joueur.
3. **Le pictogramme reprend le nuage C**, et **un son à l'activation** viendra du porteur du projet; en attendant, le souffle du katana.
4. Les autres écarts de construction sont à la section « Réconciliation » de la fiche: les rendus retenus, la touche E dans un champ, les réglages, la couche du nuage, le nom du scénario de bout en bout, la demande servie jouée à travers le serveur, le banc.

## Problèmes connus et dette

- **Le son de la fumée est provisoire** (`SONS.fumee`, `katana-swing.mp3`). Quand le porteur du projet fournit son fichier: le déposer dans `assets/sons/`, et changer le nom de fichier de `SONS.fumee` dans `packages/shared/src/ressources.ts`. Le test des ressources vérifie que le fichier existe.
- **Un piège de nom**: `tests/e2e/fumee.spec.ts` est le test de fumée (« smoke test ») de l'étape 0.1, sans rapport avec la fumée du jeu. Un premier jet de cette étape l'a écrasé, restauré aussitôt.
- Rien d'autre.

## Prochaine action exacte

Exécuter l'étape `7.11`, la mine posée, second objet de poche: lire `docs/plan/etape-7-11.md`, réconcilier avec la poche construite ici (famille `TYPES_OBJETS_DE_POCHE`, table `SERVIR` de `poche.ts`, message `poche` au seul porteur), et commencer par la planche de rendu.

## Étape suivante

Fiche à lire: docs/plan/etape-7-11.md
