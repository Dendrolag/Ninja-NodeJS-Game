# Handoff - Étape 7.20 Among Ninjas, le socle du mode

Date: 10 octobre 2026
Auteur: session Claude Code
Statut: terminée, sous réserve de la note de version 1.9 à valider par le porteur du projet avant de pousser

## Objectif de l'étape

Ajouter le sixième mode, Among Ninjas, jouable entre amis sur Tokyo: des assassins anonymes éliminent en secret des proies qui font des tâches à des stations, un cadavre signalé ou le gong ouvre une réunion où l'on discute puis vote, les morts jouent en fantôme, chacun ne voit qu'autour de lui. Une seule tâche provisoire (tenir le bouton d'action à une station). Fiche: `docs/plan/etape-7-20.md`.

## Ce qui a été fait

Sessions du 6 au 9 octobre (handoff partiel du 9 octobre, commit `1c0e06a`):

- **Fiche**, valeurs confirmées, planche des rendus et choix du porteur du projet (`0aefcaa`, `44b9062`, `2a27908`).
- **Lot A, contrat et moteur** (`14e4ba2`). **Lot B, flux et serveur** (`da20b08`). **Lots C1 à C5, la page** (`5554ac3`, `22640e9`).
- Fusions de Prison Island (8.11) et des optimisations du 9 octobre.

Session du 10 octobre:

- **Fusion de `origin/master`** (explications des zones, 1.8.2, `22e38bd`): un conflit dans `packages/client/src/hud/modele.ts`, résolu en gardant le classement vide d'Among Ninjas et les effets de zone.
- **Retour d'essai du porteur du projet: les traits du vote** (`0eb1455`). Refaits à chaque image, leur animation repartait sans fin; leur pointe tombait sous la carte visée; ceux de « Passer » visaient un bouton caché. Ils se calculent en pixels sur la place réelle des cartes, une seule fois, partent du bord du votant et finissent par une flèche hors de la carte visée; un vote contre soi fait une boucle; « Passer » reste à l'éjection avec ses voix. Vérifié dans le navigateur avec six joueurs fictifs.
- **Lot D**: scénario de bout en bout, banc à douze vues, empreinte, documentation, version 1.9.0 et sa note.
- **Trois défauts trouvés en route** (règle 7), voir « Décisions et écarts ».

## Décisions du porteur du projet pendant l'étape

- Valeurs (fiche, « Valeurs confirmées ») et rendus (fiche, « Rendus choisis »), inchangés.
- 9 octobre: aucun pseudo sur la carte, sauf entre assassins.
- 10 octobre: essai local « assez concluant », un seul retour, les traits du vote, traité.

## Fichiers créés ou modifiés pendant la session du 10 octobre

- `packages/client/src/interface/composants/among.ts`: traits du vote en pixels, dessinés une fois (`dessinDeVote`), « Passer » et ses voix à l'éjection.
- `packages/client/src/interface/modeles/among.ts`: les voix pour passer.
- `packages/client/page/styles/jeu.css`: trait de longueur 1, flèche, voix de « Passer ».
- `packages/client/src/interface/modeles/salon.ts`: « Lancer » suspendu à cinq joueurs en Among Ninjas.
- `packages/client/src/interface/modeles/notesDeVersion.ts`: note 1.9; `packages/shared/src/version.ts`: 1.9.0.
- `packages/shared/src/among.ts`: cinq stations déplacées devant leur meuble, commentaire corrigé.
- `packages/server/src/terrain.test.ts`: les lieux d'Among Ninjas sur le vrai terrain, en normal et en miroir.
- `tests/e2e/among.spec.ts` (créé); `tests/e2e/harnais/parcours.ts` (`regler` coche une liste fermée); `tests/e2e/harnais/pilote.ts` (dégagement); `playwright.config.ts` (le scénario au seul projet bureau).
- `tests/e2e/navigation.spec.ts`: la présentation statique annonce six modes depuis le lot C, le scénario en attendait cinq.
- `tests/charge/battement.ts`: le banc joue Among Ninjas, la foule du mode tenant lieu de bots.
- Tests créés: `packages/client/src/interface/composants/among.test.ts`, `packages/client/src/interface/modeles/salon.among.test.ts`.
- Documentation: `CLAUDE.md` (comportements 1 à 4 et 11), `docs/design/README.md`, `docs/plan/ROADMAP.md`, `docs/plan/etape-7-20.md` (réconciliation), `docs/design/etude-mode-among-ninjas.md` (section 21), `docs/mesures/charge-serveur.md` (section 29) et ses deux fichiers bruts `charge-serveur-7-20-*.json`.

## Tests

- Ajoutés cette session: page (9 du modèle et du composant de réunion, 2 du salon), terrain (2, Tokyo normal et miroir), bout en bout (1 scénario).
- Résultat: 3 858 tests unitaires au vert; types des paquets, des tests et du bout en bout, et linter, propres. Tests de la base non joués en local (la CI les joue).
- Scénario `tests/e2e/among.spec.ts`: 12 passages de suite au vert, dont deux avec l'assassin dans une page. Suite de bout en bout complète, bureau et téléphone: 103 scénarios au vert, après correction de `navigation.spec.ts`, rouge depuis le lot C.
- Couverture de packages/sim: 99,83 pour cent des instructions, inchangée.
- Empreinte des quatre parties de référence, jeu et flux: identique à l'octet entre `origin/master` sans l'étape et le code de l'étape.

## Banc

Section 29 de `docs/mesures/charge-serveur.md`. Douze joueurs sur Tokyo, deux tours en alternance: 0,197 ms par battement avec 40 PNJ (Horde: 0,183), 0,279 avec 80 (Horde: 0,246). Le surcoût est le codage de douze trames au lieu d'une; chaque joueur reçoit trois fois moins d'octets (84 à 90 par message).

## Décisions et écarts au plan

Consignés dans la section « Réconciliation » de la fiche. En plus:

- **Stations déplacées.** Cinq sur treize (1, 2, 4, 5, 7) avaient leur centre sur leur meuble, dans un mur: le joueur devait se tenir au bord du disque, jusqu'à 38 pixels sur 50 pour la table de la maison, dont seuls 14 pour cent du disque étaient praticables. Le commentaire des lieux annonçait un test dans `terrain.test.ts` qui n'existait pas. Elles sont posées devant leur meuble, de 15 à 43 pixels de leur place, au point le plus proche dont le centre est tenable et dont 60 pour cent du disque au moins est praticable, en normal et en miroir; écart minimum entre deux stations, 117 pixels. Planche de contrôle faite sur le décor, non versionnée.
- **Salon.** La page proposait « Lancer » à moins de cinq joueurs, que le serveur refusait: elle le dit avec la phrase du serveur.
- **Pilote des scénarios.** Le clavier arrondit la direction à huit: un joueur restait collé au coin d'une borne d'arcade, le pilote visant toujours le même point. Immobile une seconde en route, il tente une direction tournée de 60 degrés, d'un côté puis de l'autre. Le changement touche tous les scénarios qui pilotent un joueur: d'où la suite complète rejouée.
- **Le scénario de bout en bout** utilise trois clients Socket.IO sans page: cinq pages à la fois priveraient de processeur la CI. Il va à une station, à un cadavre et à la victime par l'affût du pilote, qui s'arrête face au but en compensant sa glissade; viser simplement le but faisait passer au-delà sous charge.

## Problèmes connus et dette

- **La révélation (5 s) peut passer pendant le chargement de la carte**: un joueur lent la manque. Son rôle reste écrit dans le HUD; un assassin perd la présentation de ses complices, mais leurs pseudos sont sur la carte. À trancher avec le porteur du projet: allonger la révélation, ou ne la lancer qu'une fois tout le monde chargé.
- **L'égout de l'éjection est à affiner**, demande du porteur du projet sur planche, non faite.
- **La vision hors du disque**, peut-être trop claire: à juger en jouant.
- **Sur téléphone, rien n'a été vérifié** en vrai: table ronde, chat, bouton d'action. Les tests de la page couvrent le modèle, pas le cadrage.
- Textes du mode (présentation, rappel, aide, consignes) provisoires, à relire par le porteur du projet avec la note.

## État de la CI

Rien n'est poussé à l'heure d'écrire. À pousser après validation de la note 1.9 par le porteur du projet, avec la fusion de `852d826` (correctif de la CI arrivé sur `origin/master`).

## Comment essayer en local

1. `pnpm build`.
2. `node tests/outils/jeu-sans-base.mjs` (ou `preview_start` de la configuration « jeu-sans-base »).
3. Ouvrir http://localhost:3000, créer une partie Among Ninjas.
4. `node tests/outils/joueurs-fictifs.mjs http://localhost:3000 auto 4`, puis lancer la partie.

## Prochaine action exacte

L'étape 7.21, les tâches courtes et la carte. Sa fiche se rédige au début de l'étape, selon le cas de repli du PROTOCOLE, à partir des sections 8 et 18 de `docs/design/etude-mode-among-ninjas.md`. Trancher d'abord avec le porteur du projet la révélation manquée par un joueur lent.

## Étape suivante

Fiche à rédiger: `docs/plan/etape-7-21.md`.
