# Fiche étape 7.20 - Among Ninjas, le socle du mode

Brief de session. Objectif unique: ajouter au jeu son sixième mode, Among Ninjas, dans une forme jouable entre amis sur Tokyo. Des tueurs anonymes éliminent en secret des proies, qui font des tâches à des stations de la carte, signalent les cadavres, se réunissent et votent pour éjecter les tueurs. Les morts jouent en fantôme. Chacun ne voit que ce qui l'entoure. Les vraies tâches (mini-jeux), les sabotages et les pas entendus viennent aux étapes suivantes: ici, une seule tâche provisoire.

## Origine de cette fiche

Rédigée le 6 octobre 2026, à la suite de l'étude `docs/design/etude-mode-among-ninjas.md` et des réponses du porteur du projet (section 20 de l'étude), dans la conversation de l'étude. Sources: l'étude, la section 3 du ROADMAP, la fiche 7.3 (la Chasse) prise comme modèle, la fiche et le handoff 2.9 (le flux par destinataire), et l'état du dépôt au commit qui suit `48c31f8`.

**Aucune référence de comportement.** Ni la v0.8.6, ni la v0.9.0 n'ont ce mode: rien à caractériser. Les règles ci-dessous font foi, et les comportements à préserver de CLAUDE.md s'appliquent partout où elles ne disent pas le contraire.

**Numéro**: 7.20, dans la phase 7, « Modes de jeu ». Les numéros 7.13 à 7.19 sont réservés, provisoirement, par l'étude du 3 octobre.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (2.9, ou le handoff partiel de cette étape), cette fiche, `.claude/rules/sim-purity.md`, les sections 3 à 13 et 20 de l'étude, la fiche 7.3 et la fiche 2.9. Charger la compétence `conception-de-cartes` avant de poser les stations sur Tokyo.

Les valeurs chiffrées ont été confirmées par le porteur du projet le 6 octobre 2026 (section « Valeurs confirmées »).

## Décisions du porteur du projet

Du 5 octobre 2026 (la demande) et du 6 octobre 2026 (section 20 de l'étude):

1. **Le nom est « Among Ninjas »**, pour le moment.
2. **Des tueurs anonymes, tirés au sort. L'hôte en choisit le nombre selon le nombre de joueurs.** Des proies.
3. **Des tours de jeu**, qui finissent par un cadavre signalé (ou le gong d'urgence), suivis d'une délibération et d'un vote.
4. **Un tour à durée maximale, réglage de l'hôte**: à son terme, la réunion se tient d'office.
5. **Une liste de tâches par proie**, l'hôte réglant le nombre de tâches par proie.
6. **Les morts jouent en fantôme**, invisibles des vivants, et finissent leurs tâches.
7. **Une vision réduite**, d'un rayon différent pour les tueurs et les proies.
8. **Les tâches sont à des places fixes de la carte**, et changent d'une partie à l'autre. Tokyo pour l'essai.
9. **Les tueurs voient les stations des proies et ne peuvent pas faire leurs tâches.**
10. **Les PNJ: une foule neutre d'abord**, la foule qui sert au jeu (déguisement, ninjas égarés) plus tard.

## Valeurs confirmées par le porteur du projet, 6 octobre 2026

Posées au début de l'étape, avec les propositions de l'étude comme réponses par défaut. Les précisions en italique sont des micro-décisions de la session, qui traduisent une réponse ouverte en valeur; toutes se révisent après une partie d'essai.

| Sujet                   | Valeur retenue                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Joueurs                 | 5 pour lancer, 12 au plus. À revoir selon la taille des cartes à venir                                                                                                                                                                               |
| Tueurs                  | 1 de 5 à 6 joueurs, 1 à 2 de 7 à 8, 1 à 3 de 9 à 12. Par défaut: 1, 2, 2                                                                                                                                                                             |
| Tâches par proie        | 3 à 8, 5 par défaut. Deux réglerait la partie trop vite                                                                                                                                                                                              |
| Rayon de vision         | À essayer: le tueur semblait trop bien servi. _Trois paliers par rôle: proie 200, 260 (défaut) ou 320 px; tueur 260, 320 (défaut) ou 380 px._ Fantôme: toute la carte                                                                                |
| Meurtre                 | Le tueur doit être collé à sa victime: _la portée est le contact, comme une capture_. Un meurtre à la fois par tueur. Recharge 25 s (réglable de 10 à 60), 10 s au début de chaque tour                                                              |
| Signalement             | À 100 px d'un cadavre en vue. À tester                                                                                                                                                                                                               |
| Gong d'urgence          | Un par joueur et par partie, au centre de Tokyo, pas dans les 15 premières secondes d'un tour                                                                                                                                                        |
| Réunion                 | Discussion 45 s, vote 45 s, chacun réglable de 15 à 120 s. Éjection affichée 5 s                                                                                                                                                                     |
| Confirmer les éjections | **Jamais.** Le doute reste jusqu'au dernier tueur: une éjection ne dit pas le rôle de l'éjecté. Seule l'éjection du dernier tueur se voit, puisqu'elle finit la partie. Pas de réglage                                                               |
| Votes anonymes          | Non par défaut                                                                                                                                                                                                                                       |
| Tour à durée maximale   | Aucune, 2, 3 ou 5 minutes. **3 minutes par défaut**                                                                                                                                                                                                  |
| Terme de la partie      | **Aucun.** La partie ne finit que par la victoire d'un camp                                                                                                                                                                                          |
| Foule neutre            | 40 PNJ sur Tokyo (0 à 80), d'un gris réservé. Le comportement des PNJ dans ce mode se révisera plus tard                                                                                                                                             |
| Tâche provisoire        | Rester dans le disque de la station, bouton d'action tenu. _Une durée tirée à la graine entre 5 et 10 s pour chaque tâche de chaque liste_                                                                                                           |
| Points et place en fin  | Le camp vainqueur d'abord, puis un sous-classement aux points, par des faits de jeu. _Tâche faite 10, cadavre signalé 15, vote contre un tueur éjecté 20, meurtre 30, tueur trouvé dès la première réunion 25, deux meurtres dès le premier tour 25_ |

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **Identifiant `among`**, ajouté à `MODES` (`packages/shared/src/constantes.ts`), avec sa capacité (`CAPACITES`) et une migration de l'énumération `mode_de_jeu` (`pnpm base:generer`).
2. **L'état du mode vit dans un champ facultatif**, `EtatPartie.among`, comme `chasse` ou `massacre`. Il porte: le rôle de chaque joueur (proie ou tueur), vivant ou fantôme, la phase (`revelation`, `jeu`, `reunion`, `ejection`) et son compte à rebours, le temps écoulé du tour, la recharge du katana de chaque tueur, les cadavres (position, couleur, victime), les gongs utilisés, les votes de la réunion en cours, le résultat de la dernière éjection, les stations actives de la partie, la liste de tâches de chaque proie et la tâche en cours (station, temps passé). Une partie d'un autre mode n'a pas ce champ.
3. **Le tirage se fait à la graine, au lancement** (`lancer`): les tueurs, puis les stations actives, puis la liste de chaque proie, dans cet ordre. Aucun tirage dans les autres modes: l'empreinte des parties de référence en est le garde-fou.
4. **Les phases sont une machine à états du moteur.** Pendant la révélation, la réunion et l'éjection, personne ne bouge, rien ne se ramasse, et le temps de jeu de la partie ne s'écoule pas, mais le compte à rebours de la phase avance. Ce n'est pas la pause de l'étape 1.7, qui fige tout. À la fin d'une éjection, les vivants sont replacés autour du gong, les cadavres retirés, et un tour commence.
5. **Le meurtre** se joue dans `agir`, par la demande de capture existante (`capturer`): un tueur vivant, en phase de jeu, la recharge écoulée, prend la proie vivante la plus proche dans sa portée. À distance égale, l'ordre de l'état départage. La proie devient fantôme sur place, et un cadavre à sa couleur y reste. Les tueurs du battement passent dans un ordre tiré au sort, comme les tirs du Tactique. Aucun meurtre sur un tueur, un fantôme ou pendant une autre phase.
6. **Une seule demande d'action, contextuelle**, ajoutée aux entrées du moteur (`EntreeJoueur.agir` ou nom à choisir à l'exécution): selon ce qui est à portée, dans cet ordre, signaler un cadavre, sonner le gong, faire la tâche de la station. La touche E, celle de la poche, la porte: la poche n'a pas d'objet dans ce mode. Le vote est une autre entrée, qui nomme un joueur ou « passer ».
7. **La tâche provisoire**: une proie, vivante ou fantôme, qui tient l'action dans le disque d'une station de sa liste pendant la durée de cette tâche (5 à 10 secondes) fait la tâche. Sortir du disque ou lâcher l'action remet le compteur à zéro. Le moteur seul compte le temps: la page n'envoie que l'action tenue. Un tueur peut tenir l'action à une station, pour faire semblant: rien ne compte. Aux étapes suivantes, le mini-jeu remplace le maintien, et le moteur garde la présence et une durée minimale.
8. **Les stations de Tokyo** sont des données de la carte, à côté de ses dimensions: une place, un rayon (50 pixels), et les tâches qui lui vont (une seule, la provisoire, à cette étape). Les places partent de la section 10 de l'étude, se vérifient avec la commande de la compétence `conception-de-cartes` (chacune dans le morceau principal de l'étape 8.10, hors des murs), et se retournent avec le miroir (étape 8.3). Le gong a sa place. Les autres cartes n'ont pas de stations: le mode ne se propose que sur Tokyo.
9. **Les fantômes** bougent comme les vivants, ne touchent rien, ne ramassent rien, et traversent les murs. Ce dernier point est un ajout au jeu de règles d'un mode (qui traverse les murs), qui rend « personne » dans les autres modes, sans coût. Un fantôme ne signale pas, ne sonne pas le gong et ne vote pas.
10. **Les conditions de victoire** (`estDecidee`): toutes les tâches de toutes les proies faites, fantômes compris, ou tous les tueurs éjectés ou partis, et les proies gagnent. Les tueurs vivants au moins aussi nombreux que les proies vivantes, et les tueurs gagnent. Aucun terme: rien d'autre ne finit la partie. Le camp vainqueur se lit dans l'état.
11. **Les contacts ne produisent rien**: ni capture, ni contagion, ni Évadé. Les réglages imposés par le mode (`imposerLesReglagesDuMode`) retirent les Black Ninjas, l'Évadé, les bonus, les malus, les zones, les mines de zone et les objets de poche.
12. **La foule neutre**: des PNJ d'une couleur grise réservée à ce mode, qu'aucun joueur ne reçoit, et qui n'est pas une couleur de la palette. Ils errent comme partout.
13. **Douze couleurs nommées pour les joueurs.** La palette en compte six, et au-delà les couleurs sont tirées (étape 5.8). Ce mode a besoin de douze couleurs distinctes, lisibles sur Tokyo, avec un nom pour chacune (« Rose », « Cyan »...), montré au salon, en réunion et à la fin. Si la palette du jeu doit grandir, c'est pour ce mode seul.
14. **Un joueur qui part**: une proie retire ses tâches restantes du total. Un tueur qui ne revient pas dans les trente secondes de la reconnexion (étape 2.5) compte comme éjecté. S'il ne reste aucun tueur, les proies gagnent.
15. **On n'entre pas dans une partie lancée**: « Cette partie a déjà commencé. » Le retour après une coupure reste permis.

### Les vues (serveur)

16. **Une vue par joueur vivant, une vue des fantômes.** `cleDeVue` (`packages/server/src/vues.ts`) donne à chaque vivant sa propre clé, et une clé commune aux fantômes. `FluxParVue` code une trame par clé, comme l'a prévu l'étape 2.9.
17. **La vue d'un vivant** ne contient que ce qui est dans son rayon (lui-même, les vivants, les PNJ, les cadavres), jamais un fantôme. Les rôles n'y sont jamais. Le classement en cours de partie ne dit ni rôle, ni vivant ou mort: la liste des joueurs, avec leur couleur et leur pseudo. Un tueur reçoit à part, comme la poche, la liste de ses complices.
18. **La vue des fantômes** contient tout, rôles compris.
19. **Les notifications passent par la vue.** Un meurtre part au tueur, à la victime et aux vivants qui voient l'endroit, sans dire l'auteur à ceux qui ne le voient pas. Un signalement, le gong, l'ouverture d'une réunion, les votes et l'éjection partent à tous. La révélation du rôle part à chacun, seul.
20. **Un test vérifie qu'aucune trame ni notification adressée à un vivant ne contient de rôle**, ni la position d'un fantôme, ni rien hors de son rayon.

### Le chat

21. **Deux canaux.** Les vivants ne peuvent parler qu'en réunion, entre eux. Les fantômes parlent entre eux à tout moment, et lisent les vivants. Un vivant ne lit jamais un fantôme. Le serveur route chaque message selon le canal de son auteur, au moment où il l'écrit.

### La page

22. **Le cercle de vision**: un masque sombre sur l'écran, percé d'un disque au bord adouci, en filtre PixiJS. Le décor reste visible, assombri.
23. **Deux boutons sur téléphone, pas un de plus**: l'action contextuelle, et le meurtre pour un tueur (le bouton de capture). Au clavier: E et la touche de capture.
24. **La minimap** montre notre position et nos stations à faire. Un tueur y voit les stations des proies. Jamais les autres joueurs. La carte plein écran vient à l'étape 7.21.
25. **L'écran de réunion** recouvre le jeu: les joueurs avec leur couleur, leur nom et leur état (vivant, fantôme, a voté), le chat, le compte à rebours, le vote. Puis l'éjection.

## Périmètre

### Lot A. Le moteur

1. Le mode dans le contrat (`MODES`, capacité, couleur grise réservée, réglages du mode et leur validation, réglages imposés).
2. L'état du mode, le tirage au lancement, les phases et leurs comptes à rebours, le tour à durée maximale.
3. Le meurtre, le cadavre, le signalement, le gong, la réunion, le vote, l'éjection, le replacement.
4. Les stations de Tokyo (données), la tâche provisoire, les listes par proie.
5. Les fantômes, et la question « qui traverse les murs » au jeu de règles.
6. Les conditions de victoire, les départs.
7. Les événements du moteur: meurtre, signalement, gong, réunion ouverte, vote, éjection, tâche faite, victoire.
8. L'empreinte des quatre parties de référence identique avant et après.

### Lot B. Le serveur

1. `GameRoom`: capacité, cinq joueurs pour lancer avec la raison, entrée refusée, départs, bilan par camp (décision « Points et place en fin »).
2. Les vues par joueur et des fantômes, les notifications par vue, la révélation et les complices à part.
3. Les demandes: l'action contextuelle, le vote, validées par les schémas (étape 1.6) et limitées en débit.
4. Le chat en deux canaux.
5. La base: la migration de l'énumération, une partie Among Ninjas enregistrée. Le relevé des exploits (étape 3.8) ne doit pas casser: aucun succès nouveau à cette étape.
6. Tests à travers le vrai serveur: une partie jouée jusqu'à un meurtre, un signalement, une réunion, un vote qui éjecte un tueur et la victoire des proies.

### Lot C. La page

1. Création: la tuile du mode, sur Tokyo seulement. Salon: les réglages du mode, « Lancer » suspendu à cinq joueurs, le nombre de tueurs borné par le nombre de joueurs, le total des tâches affiché.
2. La révélation du rôle, le cercle de vision, le cadavre, le bouton d'action et son libellé selon le contexte, le bouton de meurtre et sa recharge, la tâche provisoire et sa jauge.
3. Les fantômes: le fantôme vu par un fantôme, translucide, et la vue entière.
4. L'écran de réunion, le vote, l'éjection, le chat des fantômes.
5. La minimap du mode, la barre des tâches restantes.
6. La fin: le camp vainqueur au titre, puis le classement.
7. L'aide: quelques lignes sur le mode. Rendus provisoires, à soumettre sur planche au porteur du projet (révélation, cercle, cadavre, réunion, éjection) comme aux étapes 7.9 à 7.12.

### Lot D. Bout en bout, mesure et documentation

1. Scénario `tests/e2e/among.spec.ts`: cinq joueurs dans un salon, la partie se lance, chacun voit son rôle, une proie fait sa tâche, un meurtre, un signalement, la réunion, un vote. Au bureau. Le téléphone pour un des joueurs si le temps de la CI le permet (étape 5.14: dix parts).
2. Banc: `pnpm charge --banc --mode among`, à douze joueurs, soit douze vues, comparé au Classique. Nouvelle section de `docs/mesures/charge-serveur.md`.
3. CLAUDE.md, comportements à préserver 1, 2 et 4: leur précision pour ce mode (pas de score en stock, pas de capture, pas de malus). Journal de conception, ROADMAP, étude.
4. Version mineure (1.8.0) et sa note, dont le texte se soumet au porteur du projet.

## Hors périmètre

- Les mini-jeux, la carte plein écran, les tâches visuelles, la barre des tâches en réglage (étape 7.21).
- Les sabotages, l'aide des fantômes et leur malédiction (étape 7.22).
- Les pas des autres joueurs (étape 7.23).
- Les tâches longues (étape 7.24).
- Les égouts, le déguisement, les ninjas égarés, les traces de sang du tueur (étape 7.25).
- L'occlusion de la vue par les murs, les autres cartes, la partie rapide qui mène à ce mode.
- Toute modification des règles des autres modes, de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: le mode, sa capacité, la validation de ses réglages (tueurs bornés par les joueurs, tâches, durées), les réglages imposés.
- **Lancement (TU)**: nombre de tueurs, stations et listes tirées, reproductibles à graine égale. Aucun tirage dans les autres modes.
- **Phases (TU)**: révélation, jeu, réunion, éjection, retour. Personne ne bouge hors du jeu. Le temps de partie gelé en réunion. Le tour à durée maximale qui ouvre la réunion.
- **Meurtre (TU)**: la plus proche dans la portée. La recharge, celle du début de tour. Rien sur un tueur, un fantôme, hors phase de jeu. Le cadavre. L'ordre des tueurs reproductible.
- **Signalement et gong (TU)**: portée, cadavre en vue, un gong par joueur, les quinze premières secondes, un fantôme qui ne peut pas.
- **Vote (TU)**: majorité relative, égalité, passer, un fantôme qui ne vote pas, un vote hors réunion ignoré, l'éjection d'un tueur et d'une proie.
- **Tâches (TU)**: cinq secondes dans le disque, remise à zéro en sortant ou en lâchant, une station hors de la liste, un tueur qui fait semblant, un fantôme qui finit sa liste.
- **Fantômes (TU)**: traversent les murs, ne touchent rien. Les autres modes inchangés.
- **Victoire (TU)**: chacune des quatre conditions, les départs d'une proie et d'un tueur.
- **Vues (TU)**: la vue d'un vivant ne contient que son rayon, ni fantôme ni rôle. Celle des fantômes, tout. Les notifications d'un meurtre selon le témoin. Aucune fuite de rôle, vérifiée sur une partie entière.
- **Serveur (TI)**: lancement à cinq, entrée refusée, une partie jouée jusqu'à la victoire des proies par le vote, le chat en deux canaux, la partie enregistrée.
- **Page (TU)**: création, salon, révélation, boutons et libellés, réunion, fin, minimap.
- **Bout en bout**: le scénario du lot D.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Among Ninjas se crée, se prépare au salon, se joue et s'enregistre depuis la page, au bureau et sur téléphone, sur Tokyo, en normal et en miroir.
2. **Aucune trame ni notification adressée à un vivant ne dit un rôle, la position d'un fantôme ou ce qui est hors de son rayon**, vérifié par les tests du serveur.
3. **Les cinq autres modes n'ont pas changé**: tests existants inchangés, empreinte des quatre parties de référence identique.
4. Le coût d'une partie à douze vues est mesuré et écrit.
5. La couverture de `packages/sim` ne baisse pas (99,79 pour cent au handoff 2.9).

## Points de vigilance

1. **L'étape est la plus grosse du projet.** La couper en sessions par lots, avec un handoff partiel à chaque coupure, plutôt que de la forcer. Les lots A et B se testent sans page.
2. **Les tirages ne se font que dans ce mode.** Toute nouvelle question au jeu de règles rend « personne » ou « rien » ailleurs, sans coût ni tirage.
3. **Les phases touchent le déplacement et le ramassage de tous les modes**: comme le hors-jeu de la Chasse, elles passent par une question du jeu de règles, pas par un test du mode dans le moteur.
4. **Le rôle ne doit fuir par aucun canal**: trame, notification, classement, chat, salon, fin anticipée d'un joueur, ordre des listes, identifiants. Un tueur dont l'écran diffère (son bouton de meurtre) ne doit rien laisser passer dans ce que reçoivent les autres.
5. **Douze vues à vingt battements par seconde**: le coût est mesuré au lot D, mais la projection d'une vue doit rester linéaire dans le nombre d'entités dès le lot B.
6. **Les stations doivent être atteignables** et à bonne distance les unes des autres: la commande de mesure de la compétence le vérifie, en normal et en miroir.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-20-handoff.md`: les décisions confirmées en début d'étape, les écarts à cette fiche (section « Réconciliation » à ajouter ici), les chiffres du banc, l'état de la CI. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP et l'étude. Prochaine action exacte: l'étape 7.21, dont la fiche se rédige au début de l'étape selon le cas de repli du PROTOCOLE. Commiter.
