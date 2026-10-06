# Fiche étape 7.20 - Le socle du mode Among Ninjas

Brief de session. Objectif unique: un mode de déduction sociale jouable entre amis sur Tokyo. Des tueurs anonymes éliminent en secret des proies, qui font des tâches; un cadavre signalé ou le gong ouvre une réunion, où l'on discute puis vote pour éjecter un joueur; les morts jouent en fantôme; chacun ne voit que dans un rayon autour de lui. Une seule tâche provisoire, faite sur place, en attendant les stations et les mini-jeux de l'étape 7.21.

## Origine de cette fiche

Aucune fiche n'existait. Le mode est proposé par le porteur du projet le 5 octobre 2026 et étudié le même jour (`docs/design/etude-mode-among-ninjas.md`). Le ROADMAP conditionnait la suite aux sept questions de la section 19 de l'étude. Le 6 octobre 2026, le porteur du projet a demandé « Exécute l'étape 7.20 », ce qui tranche la question 7 (l'ordre), et a répondu au début de la session aux quatre questions qui touchent le socle. Les questions 3 (les tâches de sabotage) et 5 (la gêne des fantômes) concernent les étapes 7.22 et 7.25, et restent ouvertes.

Rédigée le 6 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'étude du 5 octobre 2026, sections 4 à 8, 12, 13, 16 et 18;
- les réponses du porteur du projet, ci-dessous;
- la fiche 7.3 (la Chasse, des rôles tirés au sort), la fiche 7.4 (le Massacre, prise comme modèle de mode), la fiche 2.9 (le flux par destinataire);
- l'état du dépôt au commit `48c31f8`, et le handoff 2.9.

**Numéro**: 7.20, dans la phase 7, « Modes de jeu ». Elle suit l'étape 2.9, dont elle a besoin: chaque joueur y reçoit sa propre vue.

## Rituel de début de session

Lire CLAUDE.md, le handoff 2.9, l'étude Among Ninjas, cette fiche, les fiches 7.3, 7.4 et 2.9, et `.claude/rules/sim-purity.md`.

## Ce qu'est le jeu aujourd'hui

- **Cinq modes**: la Horde (`classique`), le Tactique, les Équipes, la Chasse et le Massacre. Un mode se branche sur le moteur par son jeu de règles (`REGLES_DES_MODES`, `packages/sim/src/moteur.ts`): agir sur les entrées, résoudre les contacts, préparer le lancement, dire si la partie est décidée, dire qui est hors jeu.
- **La Chasse tire ses rôles à la graine au lancement**, refuse l'entrée dans une partie lancée, et lit sa fin avant le terme.
- **Le flux par destinataire existe** (étape 2.9): `cleDeVue` dit la vue de chacun, `vuesDe` les construit, `FluxParVue` tient une référence de delta par vue. Hors Chasse, tout le monde partage la vue commune.
- **Ce qui ne regarde qu'un joueur part à lui seul**: les notifications adressées, et la poche (étape 7.10), annoncée à son porteur quand elle change.
- **Le chat n'existe qu'au salon** dans la page. Le serveur diffuse un message à toute la partie, quel que soit son statut.
- **Le katana du Massacre** a un geste, un son, un ninja couché et du sang (`rendu/katana.ts`, `rendu/sang.ts`).
- **Toute partie finit au terme de sa durée** (`evaluerFinDePartie`), réglée de 30 à 600 secondes. La Chasse et le Massacre peuvent aussi être décidés avant.
- **Six couleurs de joueur** (`COULEURS_JOUEURS`); au-delà, les couleurs sont tirées. Le pseudo d'un joueur n'est pas dessiné sur la carte.

## Décisions du porteur du projet, 6 octobre 2026

1. **L'ordre**: le flux par destinataire (2.9) d'abord, fait; puis ce socle, joué entre amis avant les tâches.
2. **Le nom**: « Among Ninjas ». Écarté: un nom en français (« Traîtres », « Infiltrés »). Le risque de marque noté par l'étude (section 17.4) reste à vérifier si le jeu grandit.
3. **Les tâches**: une liste par proie, l'hôte réglant le nombre de tâches par proie (2 à 8, 5 par défaut). Écartée: une réserve commune.
4. **Les PNJ**: une foule qui sert au jeu. Ce socle pose la foule neutre (étude, section 8, option 2); le déguisement des tueurs en PNJ et la tâche des ninjas égarés viennent avec l'appropriation (étape 7.25).
5. **Le tour à durée maximale**: gardé, comme réglage de l'hôte (aucune, 2, 3 ou 5 minutes). À son terme, la réunion se tient d'office.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE, tirées des recommandations de l'étude quand elle en fait. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

### Le mode et le salon

1. **Identifiant `amongNinjas`**, nom affiché « Among Ninjas ». Capacité de douze joueurs, **cinq au minimum pour lancer**. On n'entre pas dans une partie lancée, comme en Chasse; le retour d'un joueur dont le lien est tombé reste permis.
2. **Tokyo imposée**: le mode impose la carte `map1` (`imposerLesReglagesDuMode`), la seule où les rayons et le point de réunion ont été pensés. Le miroir et la pluie restent au choix de l'hôte: le point de réunion se retourne avec la carte.
3. **Ce que le mode retire**: les bots noirs, l'Évadé, les bonus, les malus, les zones, les objets de poche. Tout ce qui frappe au hasard brouille la déduction (étude, section 8).
4. **Les réglages du mode** forment un groupe facultatif, comme les objets du Tactique: nombre de tueurs (1 à 3, 2 par défaut), tâches par proie (2 à 8, 5), recharge du meurtre (10 à 60 secondes, 25), durée maximale d'un tour (aucune, 120, 180 ou 300 secondes, 180 par défaut), discussion (15 à 120 secondes, 45), vote (15 à 120 secondes, 45), votes anonymes (non par défaut), confirmer les éjections (oui par défaut). La durée de partie ne s'applique pas à ce mode, et le salon la cache.
5. **Le nombre de tueurs se borne au nombre de joueurs** au lancement: un de cinq à six joueurs, deux au plus de sept à huit, trois au plus au-delà (étude, section 5). Un réglage plus haut est ramené à la borne.

### Les rôles et les phases

6. **Les rôles se tirent à la graine au lancement**, parmi les joueurs dans leur ordre dans l'état, comme les traqueurs de la Chasse. Les tueurs se connaissent.
7. **Les phases**: révélation (5 secondes), jeu, discussion, vote, éjection (5 secondes), puis de nouveau le jeu. **Hors du jeu, le monde est figé**: personne ne bouge, les PNJ non plus, aucune recharge n'avance; seules les minuteries de la phase descendent. Le temps de la partie, lui, avance toujours: c'est du temps joué.
8. **Aucun chronomètre de partie**: la partie finit par une victoire, et seulement ainsi. Une pause de l'hôte fige tout, phases comprises, comme ailleurs.
9. **Le tour à durée maximale** (décision 5) se compte du début du tour; à son terme, une réunion s'ouvre, motif « le temps ».

### Le meurtre, le cadavre, les fantômes

10. **Le meurtre**: le bouton de capture, réservé à un tueur vivant pendant le jeu. Il prend la proie vivante la plus proche à 70 pixels au plus, de centre à centre; à distance égale, l'ordre de l'état départage. Rien si sa recharge n'est pas finie. Recharge réglée (25 secondes par défaut), et 10 secondes au début de chaque tour. Un tueur ne tue ni un tueur, ni un fantôme.
11. **Le cadavre** reste à la place de la victime, à sa couleur, jusqu'à la fin de la réunion suivante.
12. **La victime devient un fantôme** sur place. Un fantôme va à la même vitesse, traverse les murs sans quitter la carte, et n'est vu que des fantômes. Une proie fantôme finit ses tâches; un tueur fantôme (éjecté) ne tue plus. Un fantôme ne signale pas, ne sonne pas le gong et ne vote pas.

### Le bouton d'action: signaler, sonner, faire une tâche

13. **Le bouton d'action est celui de la poche** (touche E, bouton de poche au tactile), qui n'a pas d'objet dans ce mode. Il fait, dans cet ordre: signaler un cadavre à 100 pixels au plus; sonner le gong à 100 pixels au plus du point de réunion; commencer une tâche.
14. **Signaler**: un vivant, proie ou tueur. Un tueur peut signaler sa propre victime.
15. **Le gong**: un vivant, une fois par partie, pas dans les 15 premières secondes d'un tour. **Le point de réunion** est le passage piéton central de Tokyo, (1145, 630) (étude, section 10), retourné en miroir.
16. **La tâche provisoire**: une proie qui a encore des tâches en commence une là où elle est; elle la finit en restant **5 secondes sans bouger**. Bouger ou une réunion l'interrompt, et elle repart de zéro. Un tueur qui presse le bouton ne commence rien: il fait semblant en restant immobile. Personne ne voit la tâche d'un autre.
17. **Le compte des tâches**: chaque proie reçoit le nombre réglé au lancement. La barre commune (faites sur total) se voit de tous. Une proie qui quitte la partie retire ses tâches restantes du total (étude, section 4.2).

### La réunion

18. **Ouverte** par un signalement, le gong ou le terme du tour. Toute tâche en cours s'interrompt. Chacun apprend qui l'a ouverte, pourquoi, quel cadavre a été trouvé, et qui est mort: tous les fantômes, trouvés ou non, comme dans Among Us.
19. **La discussion**, puis **le vote**. Pendant le vote, chaque vivant vote une fois pour un vivant, lui-même compris, ou passe; un vote ne se reprend pas. Le vote finit quand tous les vivants ont voté, ou à son terme. La majorité relative éjecte; une égalité, ou « passer » en tête, n'éjecte personne. Un vivant qui n'a pas voté ne compte pas.
20. **L'éjection**: « X a été éjecté », suivi, si l'hôte confirme les éjections, de « X était un tueur » ou « X n'était pas un tueur ». Les votes se montrent un par un, sauf si l'hôte les a voulus anonymes: on ne voit alors que le décompte. L'éjecté devient un fantôme, sans cadavre.
21. **Le retour au jeu**: les vivants sont replacés en cercle autour du point de réunion, les fantômes restent où ils sont, les cadavres disparaissent, la recharge des tueurs repart à 10 secondes, et le tour recommence.

### La victoire

22. **Les proies gagnent** quand toutes les tâches sont faites, fantômes compris, ou quand il ne reste plus aucun tueur vivant, éjecté ou parti. **Les tueurs gagnent** quand ils sont au moins aussi nombreux que les proies vivantes. Un meurtre ou une tâche décide sur-le-champ; une éjection décide à la fin de son écran, pour qu'on le voie.
23. **Le classement de fin est par camp**: les vainqueurs à la première place, les perdants à la suivante. Aucun point: le mode ne fait pas de score, et un meilleur score de profil n'en dépend pas. Le détail par joueur (rôle, tâches faites, meurtres, bons votes) se montre à la fin. Le temps joué est le temps réellement joué.

### La vue de chacun et ce qui part au réseau

24. **Chaque joueur a sa vue.** Un vivant voit, dans un disque centré sur lui, les vivants, les PNJ et les cadavres: **260 pixels pour une proie, 380 pour un tueur** (étude, section 7.1). Il ne voit jamais les fantômes. Les fantômes partagent une vue: toute la carte, fantômes compris. Un destinataire inconnu ne voit rien. La vision ne tient pas compte des murs (étude, section 7.2).
25. **Le rôle n'est jamais dans le flux d'état.** Il part à son seul joueur, comme la poche, dans un message privé qui dit aussi s'il est fantôme, ses tâches restantes, sa tâche en cours et s'il a encore son gong. La recharge du meurtre passe par l'état d'arme du joueur, dans sa seule vue, comme le katana du Massacre.
26. **Le classement du flux ne dit que les pseudos et les couleurs** dans ce mode: ni points, ni captures, ni qui est mort.
27. **La phase voyage dans le flux**: son nom, le temps qu'il lui reste, et la barre commune des tâches. Le cadavre est une entité nouvelle, le fantôme un indicateur du joueur, ajoutés en fin de codage: une partie des autres modes s'écrit à l'octet comme avant.
28. **Ce que la réunion dit à tous** part en notifications à tous: son ouverture, chaque vote exprimé (qui a voté, pas pour qui), le résultat. **Le meurtre** part au tueur, à la victime, qui apprend qui l'a tuée, et aux vivants dont le disque couvre l'endroit.
29. **Le chat en partie**: pendant la discussion et le vote, les vivants parlent aux vivants, et les fantômes les lisent; les fantômes parlent entre eux à tout moment, sans que les vivants les lisent. Pendant le jeu, le chat des vivants est fermé. Le serveur choisit les destinataires de chaque message.

### La foule et les couleurs

30. **La foule**: des PNJ d'un gris uniforme, qui errent, ne se capturent pas, ne transmettent aucune couleur et marchent sans bruit. Leur nombre est le réglage de l'hôte.
31. **Douze couleurs nommées** pour les joueurs de ce mode, distinctes du gris de la foule, et **le pseudo au-dessus de chaque joueur en vue**: toute accusation passe par « j'ai vu Orange ».

### Le rendu

32. **Le rendu se choisit sur planche** au milieu de l'étape (`docs/design/etape-7-20/`): la révélation du rôle, le cercle de vision, le cadavre, le fantôme, l'écran de réunion et de vote, l'éjection, la fin. Les sons sont provisoires, pris dans ceux du jeu.

## Périmètre

### Lot A. Le contrat (`packages/shared`)

1. **Le mode**, sa capacité, ses valeurs (`AMONG_NINJAS`: rayons, portées, durées, point de réunion), ses réglages et leurs bornes, leur validation, les réglages imposés (micro-décisions 1 à 4).
2. **Les douze couleurs nommées** et le gris de la foule (micro-décisions 30 et 31).
3. **Le flux**: l'entité cadavre, l'indicateur fantôme, le bloc de phase; codage et aller-retour.
4. **Les messages**: le vote (du joueur au serveur), l'état privé, les notifications de réunion et de meurtre, le canal du chat, la fin de partie par camp.

### Lot B. Le moteur (`packages/sim`)

1. **L'état du mode**, le lancement et le tirage des rôles.
2. **Les phases** et le monde figé; le moteur sans chronomètre pour ce mode.
3. **Le meurtre**, le cadavre, les fantômes et leur déplacement sans murs.
4. **Le bouton d'action**: signaler, le gong, la tâche provisoire.
5. **La réunion**, le vote, l'éjection, le retour au jeu.
6. **La victoire**, le départ d'un joueur, la foule, les couleurs, le score nul.

### Lot C. Le serveur

1. **La room**: la condition de lancement, le refus d'entrer, le vote retenu pour le battement, le bilan par camp, le chat par canal.
2. **Les vues**: une clé par joueur, le disque de vision, la vue des fantômes, le classement neutre, l'arme du tueur dans sa seule vue.
3. **Le réseau**: le message de vote, l'état privé annoncé à chacun, les notifications, la fin par camp.
4. **La base**: la migration de l'énumération des modes; le résultat par camp dans le bilan.
5. **Tests à travers le vrai serveur**: une partie à cinq, du lancement à la victoire, où aucune trame ni notification ne trahit un rôle, un fantôme ou une position hors du disque.

### Lot D. La page

1. **La planche**, puis le rendu retenu (micro-décision 32).
2. **La création et le salon**: le mode, ses réglages, la condition des cinq joueurs.
3. **En partie**: la révélation, le masque de vision, les pseudos, le cadavre, le fantôme, le bouton d'action et son libellé, le bouton de meurtre et sa recharge, la barre des tâches, la phase et son temps, la minimap réduite à soi.
4. **La réunion**: les joueurs, vivants et morts, le chat, le vote, le décompte, l'éjection.
5. **Le chat des fantômes** pendant le jeu.
6. **La fin**: le camp vainqueur, les rôles révélés, le détail par joueur.
7. **L'aide** et les textes du mode.

### Lot E. Mesure et documentation

1. **Empreinte**: les parties de référence des autres modes, identiques à l'octet à celles du handoff 2.9.
2. **Banc de charge**: une partie Among Ninjas de douze joueurs, douze vues par battement, consignée dans `docs/mesures/charge-serveur.md`.
3. **Version**: une nouveauté majeure, le deuxième chiffre avance, avec une note soumise au porteur du projet.
4. **Documentation**: le journal de conception, le ROADMAP, l'étude, CLAUDE.md (comportements 1, 2 et 4: une précision datée pour ce mode).

## Hors périmètre

- Les stations, les sept tâches courtes, la minimap des stations et la carte plein écran (étape 7.21).
- Les sabotages, la panne de néons, la surchauffe (étape 7.22).
- Les pas entendus (étape 7.23); les mini-jeux d'arcade (étape 7.24).
- Le déguisement en PNJ, les ninjas égarés, les égouts, les traces de sang, la gêne des fantômes (étape 7.25).
- Des rayons de vision réglables par l'hôte; l'occlusion par les murs.
- Les défis et les succès propres au mode.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Contrat (TU)**: les bornes et la validation des réglages; les réglages imposés; le codage du cadavre, du fantôme et du bloc de phase, l'aller-retour, et une partie d'un autre mode qui s'écrit à l'octet comme avant; la validation du vote.
- **Moteur (TU)**: le tirage des rôles et sa borne; les phases et leurs durées, le monde figé; le meurtre (portée, recharge, la plus proche, ni tueur ni fantôme); le cadavre; le fantôme qui traverse les murs; signaler, le gong (une fois, pas dans les 15 premières secondes), la tâche (immobile 5 secondes, interrompue en bougeant ou par une réunion, rien pour un tueur); le vote (une fois, vivants seulement, majorité, égalité, passer); l'éjection et sa confirmation; le retour au jeu; chaque condition de victoire; le départ d'un tueur et d'une proie; la foule grise, sans contagion; aucune fin au terme d'une durée; le tour à durée maximale.
- **Serveur (TU et TI)**: la clé de chacun; un vivant ne reçoit rien hors de son disque ni aucun fantôme; un fantôme voit tout; le rôle n'est dans aucune trame; l'arme seulement dans la vue du tueur; le classement neutre; les notifications de meurtre aux seuls témoins; le chat par canal; le bilan par camp; une partie complète à cinq.
- **Client (TU)**: les modèles de la révélation, de la réunion, du vote, de la fin; le libellé du bouton d'action; les réglages au formulaire.
- **Bout en bout**: une partie Among Ninjas à cinq navigateurs, jusqu'à une réunion et un vote; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Among Ninjas se crée, se lance à cinq et se joue jusqu'à la victoire d'un camp depuis la page, au clavier et au tactile.
2. Aucune trame ni notification reçue par un vivant ne contient de rôle, de fantôme ou d'entité hors de son disque, vérifié par les tests du serveur.
3. Le rendu correspond à la planche retenue, vérifié dans le navigateur de Claude Code, avec une capture d'écran.
4. L'empreinte des parties de référence des autres modes est identique à celle du handoff 2.9.
5. La couverture de `packages/sim` ne baisse pas.

## Points de vigilance

1. **Le secret avant tout**: chaque donnée nouvelle se demande « à qui part-elle ? ». Un test le vérifie pour le rôle, les fantômes et les positions.
2. **Douze vues par battement**: mesurer au banc, la Chasse en coûtait 14 pour cent de plus avec deux.
3. **Les autres modes ne bougent pas**: champs du moteur facultatifs, codes ajoutés en fin de liste, empreinte comparée.
4. **Le nombre de joueurs**: cinq au minimum, donc les tests du serveur et le bout en bout en simulent cinq.
5. **La reconnexion** (étape 2.5): un joueur qui revient retrouve son rôle par le message privé, annoncé de nouveau.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-20-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape faite, ordre des suivantes), l'étude Among Ninjas (questions tranchées), CLAUDE.md (comportements à préserver 1, 2 et 4). Version: le deuxième chiffre avance, la note se soumet au porteur du projet. Prochaine action exacte: l'étape qui suit dans la section 3 du ROADMAP. Commiter.
