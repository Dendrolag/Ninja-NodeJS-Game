# Fiche étape 3.8 - Les exploits de partie

Brief de session. Objectif unique: un compte débloque, à la fin d'une partie, les succès qui demandent un relevé pendant la partie (exploits, secrets, « Rassembleur »). Le serveur relève ces faits à chaque battement, sans toucher `packages/sim`, les enregistre avec la partie, et les succès s'en déduisent par le même pli que ceux de l'étape 3.7.

Fiche rédigée le 28 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.8 du ROADMAP (section 4), des sections 4 et 5 de l'étude `docs/design/etude-succes.md`, du handoff 3.9 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.9, l'étude des succès, puis cette fiche. Au besoin: la fiche 3.7 (le socle des succès), la fiche 2.8 (les invitations entre amis), la fiche 3.3 (la fin de partie).

## Pourquoi

Le socle (`3.7`) ne récompense que ce que les résultats enregistrés disent: parties, victoires, prises. Les exploits récompensent la performance dans une partie (combo x5, tir de huit ninjas, dernière proie), les secrets apportent la surprise, et chaque mode reçoit au moins un succès à lui (étude, sections 3 et 4). C'est la seconde moitié de la liste de l'étude: 18 succès, pour 47 en tout.

## Ordre

`3.8` vient après `3.9`, faite le 27 septembre 2026 à la demande du porteur du projet. Les succès de cette étape deviennent des titres possibles sans rien changer au titre. Suite: `4.7`, les crédits.

## État du dépôt au départ (28 septembre 2026)

1. **Le socle est en ligne** (`3.7`): 29 succès en données dans `packages/shared/src/succes.ts`, chacun « une mesure atteint un seuil ». Le pli `parcoursDe` lit l'historique d'un compte partie par partie et dit la première partie de chaque succès. L'attribution se fait dans la transaction de fin (`enregistrerPartie`, puis `attribuerLesSucces`), et le rattrapage des comptes existants a été lancé en production.
2. **Le moteur publie les faits nécessaires** dans `etat.evenements`, remis à zéro à chaque battement: `captureJoueur` (avec `botsTransferes`), `joueurTranche`, `captureParBotNoir`, `malusRamasse`, `tirDeCapture` (avec `captures`, joueurs et bots confondus), `ralliement` et `coupDeKatana` (avec `multiplicateur`), `carteVidee` (sans auteur: son bonus va à chaque joueur présent), `evadeAttrape`, `doubleurVole`. La fin d'une Chasse se lit dans `etat.chasse.traqueurs`, le porteur du x2 dans `etat.evade.porteur`.
3. **`GameRoom` fait avancer le moteur** (`avancer`) et retient déjà, à côté de l'état, ce que la fin de partie demande (comptes, entrées, abandons). Son `bilan()` alimente `finPourLesComptes`. Le chronomètre du battement (`8.6`) montre la forme d'un relevé tenu par la room.
4. **Une invitation servie** (`2.8`) est retirée par `ReseauDesAmis.invitationServie`, qui connaît son inviteur, mais ne le rend pas.
5. **La table `resultats`** a pour clé primaire (partie, compte). Le schéma de l'étape 3.1 interdit d'y ajouter une colonne par besoin nouveau.
6. **Le client affiche tout succès du paquet partagé**, secrets compris (« ??? » avant l'obtention): il n'a rien à apprendre des nouveaux, sauf un commentaire et un test qui attendaient les premiers secrets.
7. **Les migrations s'appliquent au démarrage du serveur**, pendant que l'ancien tourne encore: une table ajoutée est compatible avec la version précédente.

## Décisions de conception

Aucune n'a été soumise au porteur du projet: elles découlent de l'étude, de ses décisions du 26 septembre 2026 et de l'état du dépôt. Chacune est signalée au handoff.

1. **Un relevé d'exploits, fonction pure du serveur** (`packages/server/src/releveDesExploits.ts`), comme l'étude le prévoit (section 5.2). Il reçoit l'état après un battement et rend le relevé suivant, sans rien muter. Un battement sans fait rend le même relevé. `GameRoom` le tient et le fait avancer après chaque `tick`, avant de prévenir la couche réseau. `packages/sim` n'est pas touché.
2. **Le relevé compte par joueur stable**: le compte pour un joueur qui en a un, la connexion pour un invité. Un compte qui quitte la partie puis y revient retrouve son relevé: partir et revenir n'efface pas une capture subie, ce qui ferait d'« Intouchable » un succès à tricher.
3. **Seuls les joueurs présents à la fin reçoivent leurs exploits** (étude, section 5.4): un abandon enregistre son résultat et débloque les succès du socle, pas les exploits. Un absent dont le lien est tombé, lui, est encore présent.
4. **Une table `faits_de_partie`** (migration `0011`): (partie, compte, fait, valeur), une ligne par fait non nul, clé primaire sur les trois premiers, clé étrangère composée vers le résultat (partie, compte), en cascade. Un fait sans résultat ne peut pas s'écrire. L'identifiant du fait est un texte contrôlé par sa forme: ajouter un fait ne demande pas de migration, et un fait inconnu du code est ignoré à la lecture, comme un succès. Aucune colonne ne s'ajoute à `resultats`.
5. **Les faits s'écrivent dans la transaction de fin**, après les résultats et avant l'attribution des succès, qui les lit avec l'historique. Au réessai d'une partie déjà enregistrée, rien ne s'écrit de plus.
6. **Les faits sont des valeurs positives**: un compte, un record ou un drapeau à 1. Ce qui se dit par une absence (« jamais capturé ») s'enregistre comme un fait positif (`intouchable`), constaté à la fin: une partie d'avant cette étape, sans aucun fait, ne passe donc pas pour une partie où l'on n'a jamais été pris, et le rattrapage n'attribue aucun exploit à tort.
7. **Le pli lit les faits de chaque partie** (`PartieDuParcours.faits`, facultatif: absent pour une partie sans relevé). Les mesures nouvelles sont des sommes, des records ou des comptes de parties qui croisent un fait et le résultat (« gagner une Horde d'au moins quatre joueurs sans être pris »). Les conditions qui dépendent du placement, du mode ou du nombre de joueurs vivent dans le pli, pas dans le relevé: la règle d'une victoire reste celle du socle.
8. **Une prise, pour « Revanche », « Sur le fil » et « Arroseur arrosé »**, c'est capturer, infecter ou tuer un joueur (`captureJoueur`, `joueurTranche`), comme pour « Première prise » (fiche 3.7, décision 6). Être pris par un Black Ninja ne compte pas comme être capturé par un joueur: « Intouchable » le nomme à part.
9. **« Revanche »**: prendre, moins de 30 secondes de jeu après, le dernier joueur qui vous a pris. Une revanche consomme la prise qu'elle venge. Le temps est celui du jeu, qui ne court pas pendant une pause.
10. **« Sur le fil »**: prendre un joueur dans la dernière seconde du temps de jeu, celle où le chronomètre passe de 1 à 0. Une Chasse qui s'achève plus tôt par la dernière infection ne compte pas: sinon, toute Chasse finie avant l'heure le donnerait.
11. **« Arroseur arrosé »**: être pris par un joueur moins de 3 secondes de jeu après avoir pris.
12. **« Pas de chance »**: être pris trois fois par un Black Ninja dans une même partie.
13. **« Table rase »** va à chaque joueur présent quand la carte est vidée, comme le bonus du moteur: le moteur ne dit pas qui a tué le dernier ninja, et vider la carte est l'œuvre de tous ceux qui y étaient.
14. **« Coup de filet »** compte les entités prises d'un tir, joueurs et ninjas confondus, comme le moteur: un joueur pris est un ninja aussi.
15. **« Dernière proie »**: à la fin d'une Chasse d'au moins quatre joueurs, être la seule proie restante. Une Chasse finie sans proie ne le donne à personne.
16. **« Double ou rien »**: porter le x2 à la fin et finir premier d'une partie à plusieurs. En Équipes, la première place est celle de l'équipe, comme pour toute victoire.
17. **« En chaîne »** (x3) ne se lit qu'en Horde, **« Combo parfait »** (x5) en Horde ou en Massacre: le fait est le multiplicateur le plus haut de la partie, et le mode se lit dans la partie.
18. **« Seigneur de la Horde »** compte les ralliements de la Horde, et **« Collectionneur de fantômes »** les Évadés attrapés: deux cumuls, qui montrent leur progression.
19. **« Rassembleur »**: un ami entre dans votre partie par votre invitation, et vous êtes présent à la fin de cette partie. `invitationServie` rend l'invitation retirée, et la couche réseau la signale à la room, qui retient les invités de chaque inviteur, même au salon. Il se range en Habitué: il demande un ami, qu'on ne se fait pas dans la première heure.
20. **Les secrets ont un palier** comme les autres, pour se ranger au profil: « Pas de chance » en Découverte (il arrive aux débutants), « Arroseur arrosé » en Habitué, « Sur le fil » en Expert.
21. **Rien ne change à l'affichage**: l'écran de fin, le profil, la fiche et le titre lisent déjà la liste du paquet partagé. Le commentaire et le test du client qui injectaient un secret faute d'en avoir un en lisent désormais un vrai.
22. **Pas de rattrapage**: aucun fait n'existe avant la mise en ligne, et les succès de cette étape ne comptent qu'à partir d'elle (étude, section 4). Le rattrapage de `3.7`, relancé, n'inscrirait rien de plus.

## La liste construite ici

18 succès de source « partie ». Les descriptions exactes vivent dans `succes.ts`.

| Palier     | Succès                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Découverte | Cadeau empoisonné (ramasser un malus), Pas de chance (secret)                                                                                              |
| Habitué    | Razzia (20 ninjas d'une prise), Revanche, En chaîne (x3 en Horde), Rassembleur, Arroseur arrosé (secret)                                                   |
| Expert     | Combo parfait (x5), Intouchable, Coup de filet (8 d'un tir), Dernière proie, Table rase, Chasseur d'Évadé, Main leste, Double ou rien, Sur le fil (secret) |
| Légende    | Collectionneur de fantômes (10 Évadés), Seigneur de la Horde (10 000 ninjas ralliés)                                                                       |

## Périmètre

1. **Paquet partagé**: les faits de partie (identifiants, type), `PartieDuParcours.faits`, les mesures nouvelles dans le pli, les 18 définitions.
2. **Serveur**: le relevé d'exploits et ses faits de fin, la room qui le tient et retient les invitations servies, le bilan qui porte les faits des présents, `finPourLesComptes`, l'annuaire, `invitationServie` qui rend l'invitation.
3. **Base**: la table `faits_de_partie` et sa migration `0011`, l'écriture dans la transaction de fin, la lecture avec l'historique.
4. **Client**: le commentaire et le test des secrets.
5. **Outils de test**: les comptes en mémoire gardent les faits et les plient.
6. **Aucun changement** de `packages/sim` ni des règles de jeu.

## Hors périmètre

- Un succès « ninjas capturés » tous modes: écarté (décision 6 de l'étude).
- Annoncer un succès pendant la partie, ou dire à un invité ce qu'il aurait débloqué.
- Un recalibrage des seuils.

## Tests requis

- TU du pli: chaque mesure nouvelle, chaque succès juste sous et juste sur son seuil, une partie sans faits qui ne donne aucun exploit, les conditions croisées (mode, nombre de joueurs, placement).
- TU du relevé: chaque fait sur des suites d'événements construites à la main (revanche dans et hors délai, consommée, contre un invité; sur le fil au bord de la seconde; arroseur arrosé; Black Ninja; ralliements et multiplicateurs; tirs; carte vidée pour les présents; Évadé et x2), les faits de fin (intouchable seulement en Horde, dernière proie, porteur du x2), un battement sans fait qui rend le même relevé, le relevé suivi par compte à travers un départ et un retour.
- TU de la room: le relevé suit une partie réelle rejouée par graine, abandons exclus, invitations servies retenues.
- TU du serveur: `finPourLesComptes` porte les faits des comptes présents, la route d'une invitation servie jusqu'à la room.
- TI (base): la table, sa clé étrangère et sa cascade, l'écriture dans la transaction, le réessai qui n'écrit rien, un fait inconnu ignoré, l'attribution d'un exploit datée de sa partie, et le rattrapage qui n'attribue aucun exploit à une partie sans faits.
- TU du client: le profil avec un vrai secret.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un exploit relevé pendant une partie s'enregistre avec elle et débloque son succès à la fin, annoncé et daté comme ceux du socle, vérifié en base.
2. Une partie sans faits ne donne aucun exploit, et le rattrapage relancé n'inscrit rien.
3. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-8-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée), le cadrage (profil) et l'étude des succès. Prochaine action exacte: l'étape `4.7`, les crédits. Commiter.
