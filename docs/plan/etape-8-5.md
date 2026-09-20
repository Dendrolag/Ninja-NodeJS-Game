# Fiche étape 8.5 - Audit des saccades sur téléphone, et plan d'action

Brief de session. Objectif unique: **savoir pourquoi le jeu saccade sur un téléphone récent, chiffres à l'appui, et écrire ce qu'il faut faire.** Pas d'optimisation au jugé: on mesure d'abord, sur le vrai appareil, et le plan d'action en découle.

## Origine de cette fiche

Étape demandée par le porteur du projet le 20 septembre 2026: « Le jeu souffre encore de très grosses saccades sur smartphone (exemple ici iPhone 14 Pro), il n'est pas jouable en l'état. »

Rédigée selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de la demande, de l'état du dépôt au commit `8f715ce`, des sections 17 et 18 de `docs/mesures/charge-serveur.md`, et de la fiche 8.2 prise comme modèle.

**Numéro**: 8.5. **Elle passe avant l'étape `8.3`**, le miroir calculé: un jeu injouable sur téléphone prime sur une économie de commande d'images. L'ordre d'exécution est celui de la section 3 du ROADMAP, pas la numérotation.

## Rituel de début de session

Lire `CLAUDE.md`, le dernier handoff (8.4), cette fiche, puis la section 3 de `docs/plan/ROADMAP.md`. Puis **les sections 17 et 18 de `docs/mesures/charge-serveur.md`**, qui portent tout ce que le projet sait déjà du coût du rendu, et `.claude/rules/sim-purity.md` si l'étape devait toucher `packages/sim`, ce qui n'est pas prévu.

## Le symptôme, tel qu'il est rapporté

Sur iPhone 14 Pro, **de très grosses saccades**, au point que le jeu n'est pas jouable. Rien de plus n'est su à ce stade: ni à quel moment elles arrivent, ni si elles vont en empirant, ni ce que le joueur voyait à l'écran.

**Ces trois inconnues sont le premier travail de l'étape.** « Ça saccade » peut décrire quatre choses différentes, qui n'ont pas les mêmes causes ni les mêmes remèdes:

1. Une cadence d'images basse mais régulière: le dessin coûte trop cher.
2. Une cadence haute entrecoupée d'images très longues: un ramasse-miettes, un téléversement de texture, un travail périodique.
3. Un dessin fluide mais des personnages qui avancent par à-coups: un défaut de lissage entre deux instantanés, ou du réseau, et pas du rendu du tout.
4. Une dégradation progressive: l'échauffement de l'appareil, ou une fuite.

## Ce que le projet sait déjà, et son angle mort

À lire avant de mesurer quoi que ce soit.

| Ce qu'on sait                                                                          | Où c'est                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Le coût du rendu au processeur ralenti, au cadrage d'un téléphone                      | `docs/mesures/charge-serveur.md`, sections 17 et 18          |
| L'allègement du rendu de l'étape 5.7, et ce qu'il a gagné                              | La même, section 18                                          |
| Ce qu'un joueur reçoit du réseau: 9 Ko/s, 20 instantanés par seconde                   | La même, sections 12.3 et 19                                 |
| La densité de rendu plafonnée à 2, **après une saccade sur iPhone**                    | `packages/client/src/rendu/apparence.ts`, `DENSITE_MAXIMALE` |
| Le juge de stabilité, qui retient l'écran de jeu tant que l'affichage n'est pas fluide | `packages/client/src/rendu/stabilite.ts`                     |
| Le cadrage serré du téléphone: 600 sur 451 pixels de carte                             | `packages/client/src/rendu/apparence.ts`, `CADRAGE_MOBILE`   |
| Le montage du rendu, et ses options                                                    | `packages/client/src/rendu/pixi.ts`, `monterRendu`           |
| Le banc de rendu, qui tourne dans la CI                                                | `tests/e2e/banc-rendu.spec.ts`                               |

**L'angle mort est nommé deux fois dans la documentation, et il n'a jamais été comblé.** Les sections 17.5 et 18 de `charge-serveur.md` se terminent toutes les deux sur la même réserve: « **Un vrai téléphone.** Le ralentissement de Chromium ne reproduit ni sa carte graphique ni son échauffement; à confirmer en jouant. » Le banc ralentit le processeur de Chromium six fois et dessine avec la carte graphique de la machine de mesure. **Aucune mesure n'a jamais été prise sur un téléphone, ni sur Safari.**

Deuxième fait à retenir: **un iPhone a déjà saccadé, à la recette de l'étape 5.4**, et la cause trouvée alors était la densité de rendu, plafonnée depuis à 2. Que cela recommence veut dire soit que le plafond ne suffit plus, soit que la cause est ailleurs.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE.

1. **On mesure avant de corriger.** Aucune optimisation ne part d'une intuition. C'est la règle qui a produit les gains de l'étape 5.7, et c'est celle qui évite de passer une semaine sur un point chaud imaginaire.
2. **La mesure se prend sur le téléphone du porteur du projet**, pas sur un simulateur. La session ne peut pas tenir un iPhone: elle fournit **l'instrument et le protocole**, le porteur du projet joue, et le relevé revient dans le dépôt. C'est la contrainte principale de l'étape, et elle dicte sa forme.
3. **L'instrument est un relevé dans la page**, ouvert par un paramètre d'adresse (`?diagnostic=1`), invisible sans lui. Pas de dépendance nouvelle, pas d'outil externe à installer sur le téléphone, et rien qui change le jeu de qui n'a pas demandé le paramètre.
4. **Le relevé s'exporte en texte**, copiable d'un bouton. Un chiffre lu à l'écran d'un téléphone et recopié à la main serait faux et incomplet.
5. **Le relevé mesure la distribution, pas la moyenne.** « 55 images par seconde en moyenne » ne dit rien d'une saccade. Ce qu'il faut, c'est le neuvième décile, le centile 99, et **le compte d'images au-delà de 50 millisecondes**, qui sont exactement ce que l'œil appelle une saccade.
6. **Le relevé sépare notre code, PixiJS et le reste**, comme le banc de l'étape 5.7 le fait déjà: sans cette séparation, un chiffre global ne désigne aucun coupable.
7. **Une cause dont le remède est un réglage se corrige dans l'étape, et se remesure.** Une constante, une option de montage du rendu: si l'audit désigne cela, on ne va pas planifier une étape pour changer un nombre. Tout remède structurel, lui, devient une étape à part entière, planifiée dans le ROADMAP. C'est la règle 7 de `CLAUDE.md` appliquée à la lettre.
8. **L'étape ne se termine pas sur un constat.** Elle rend un plan d'action ordonné, chaque action portant son gain attendu, son coût et son risque. Un audit sans plan ne sert à rien.

## Les hypothèses à départager

Écrites pour être **réfutées par la mesure**, pas pour être crues. Aucune n'est privilégiée. L'ordre est celui de la vraisemblance estimée, qui ne vaut rien tant qu'on n'a pas mesuré.

1. **Le dos de rendu choisi par Safari.** PixiJS 8 prend WebGPU quand le navigateur le propose, et retombe sur WebGL sinon (`monterRendu` ne demande rien de particulier). Safari a les deux, et ils n'ont pas les mêmes performances ni les mêmes défauts. À relever: lequel tourne réellement sur l'appareil. À essayer: forcer l'autre.
2. **La cadence d'écran de l'iPhone 14 Pro.** Son écran monte à 120 hertz. Si le navigateur cadence le jeu à 120 images par seconde, le budget d'une image tombe de 16,7 à 8,3 millisecondes, et un rendu qui tenait confortablement devient limite. À relever: la cadence réellement demandée. À essayer: la plafonner.
3. **Le coût du dessin, en vrai.** Les 3,2 à 3,6 millisecondes de PixiJS au cadrage d'un téléphone (section 18) sont mesurées sur une carte graphique de bureau. Celle d'un téléphone n'a ni la même bande passante mémoire ni le même pilote.
4. **Les téléversements de texture.** Le décor est deux images de 3000 par 2000, et la pluie de Tokyo une planche de 9000 par 2000, découpée en trois. Ce sont des pics ponctuels: ils expliqueraient des saccades au démarrage et à l'apparition d'un effet, pas une gêne continue. Le juge de stabilité de l'étape 5.4 en couvre déjà une partie.
5. **Le ramasse-miettes.** Des allocations par image dans la boucle de rendu produisent exactement le profil « cadence haute, images très longues de temps en temps ».
6. **Le lissage entre deux instantanés.** La section 17.5 note qu'il cherche la position précédente de chaque entité par un parcours complet, soit un coût en carré du nombre d'entités. Négligeable aux bornes mesurées, à revérifier sur un appareil lent. Et si le dessin est fluide mais le déplacement saccadé, c'est ici qu'il faut chercher, pas dans le rendu.
7. **Le réseau.** Vingt instantanés par seconde sur un accès mobile ne se répartissent pas régulièrement. Une irrégularité d'arrivée se voit comme une saccade alors que rien ne rame.
8. **L'échauffement et le mode économie d'énergie.** Un iPhone bride son processeur en chauffant, et le mode économie d'énergie plafonne l'affichage. Une dégradation progressive au fil d'une partie signe cette famille-là.
9. **Le son.** Plusieurs sons ponctuels déclenchés en même temps, joués par des éléments audio du navigateur, sont une cause classique de saccade sur iOS. À essayer: jouer une partie son coupé.
10. **Le filtre de lueur.** Une passe de calque qui coûte la surface de l'écran, sur un écran dense. Il ne couvre plus que les repères depuis le 15 septembre 2026, mais il reste une passe.

## Périmètre

### Lot A. L'instrument

1. Un relevé de performance dans la page, ouvert par `?diagnostic=1`, qui suit en continu: la durée de chaque image, la cadence demandée par le navigateur, le temps de notre code et celui de PixiJS séparément, le nombre d'entités dessinées, l'arrivée des instantanés et l'écart entre deux, le dos de rendu et la densité réellement utilisés, l'appareil et le navigateur, et la mémoire quand le navigateur la donne.
2. Ce qu'il montre à l'écran: la cadence, le neuvième décile et le centile 99 de la durée d'image, et **le compte d'images au-delà de 50 millisecondes depuis le début de la partie**. Rien d'autre: c'est un instrument, pas un tableau de bord.
3. Un bouton qui copie tout le relevé en texte, prêt à être collé dans le dépôt.
4. **Sans le paramètre, rien ne change**: ni affichage, ni mesure, ni coût.

### Lot B. La mesure sur le vrai appareil

1. Écrire le protocole de recette dans l'audit: quelles parties jouer, sur quelle carte, à combien de PNJ, combien de temps, et dans quel ordre, pour départager les hypothèses. Au minimum: une partie de référence, une partie son coupé, une partie sur la carte la plus légère, et une partie de trois minutes entières pour voir l'échauffement.
2. Le porteur du projet joue et renvoie les relevés. **C'est le point de rendez-vous de l'étape**: sans ces relevés, l'audit ne peut pas conclure, et la session s'arrête là en écrivant un handoff partiel.
3. Ranger les relevés bruts dans `docs/mesures/`, comme tous les autres chiffres du projet.

### Lot C. L'audit

`docs/mesures/audit-saccades-telephone.md`:

1. Le symptôme, mesuré: laquelle des quatre formes de saccade c'est, et à quel moment.
2. Chaque hypothèse de la liste ci-dessus, avec ce que la mesure en dit: confirmée, écartée, ou non tranchée et pourquoi.
3. La cause, ou les causes, avec le chiffre qui les désigne.
4. Ce que le banc de l'étape 5.7 ne voyait pas, et ce qu'il faudrait lui ajouter pour qu'il le voie la prochaine fois.

### Lot D. Le plan d'action

Dans le même document, une dernière section:

1. Les actions, ordonnées par gain attendu rapporté au coût, chacune avec: ce qu'elle change, le gain espéré et d'où vient cette estimation, le risque pour le jeu, et si elle tient dans un réglage ou demande une étape.
2. Les actions qui tiennent dans un réglage: faites dans l'étape, et remesurées.
3. Les autres: proposées comme étapes au ROADMAP, sans être faites.
4. Ce qu'on accepte de ne pas faire, et pourquoi.

## Hors périmètre

- **Toute optimisation structurelle.** Le tri des sprites, le découpage du décor en tuiles, le filtrage du flux par zone d'intérêt: ce sont les chantiers de `etude-grandes-cartes.md`, et ils ne se lancent pas sur une intuition. Ils sortent de l'audit s'ils y sont désignés, comme étapes.
- **Toute règle de jeu.** `packages/sim` n'est pas touché.
- **Le serveur.** Les saccades sont rapportées sur un appareil, pas sur une partie: le serveur tient 340 PNJ à 1,24 milliseconde par battement. S'il devait être en cause, l'audit le dirait et cela deviendrait une autre étape.
- **Android, et les autres navigateurs.** L'appareil rapporté est un iPhone 14 Pro sous Safari. L'instrument servira aux autres, l'audit ne conclut que sur celui-là.
- `legacy/`, `tests/caracterisation/`.

## Tests requis

- **Le relevé lui-même**, en tests unitaires: le calcul des déciles et du compte d'images lentes sur une série connue, et le fait que **sans le paramètre d'adresse, rien n'est mesuré ni affiché**.
- **Un scénario de bout en bout** qui ouvre le jeu avec le paramètre et vérifie que le relevé apparaît, et sans lui qu'il n'apparaît pas.
- Le banc de rendu de la CI reste au vert et **ne se dégrade pas**: l'instrument ne doit rien coûter à qui ne le demande pas.
- La suite unitaire complète verte, types, linter et formatage verts, CI verte.

## Définition de terminé

1. L'audit nomme la cause, ou les causes, **avec le chiffre qui les désigne**, et dit ce qu'il n'a pas su trancher.
2. Chacune des dix hypothèses est explicitement confirmée, écartée, ou laissée ouverte avec sa raison.
3. Le plan d'action est ordonné, chiffré, et chaque action dit si elle tient dans un réglage ou demande une étape.
4. Les actions qui tiennent dans un réglage sont faites, et le gain est remesuré sur le vrai appareil.
5. Le relevé se relance d'une adresse, et la façon de s'en servir est écrite pour une personne non technique.
6. On peut dire si le jeu est jouable sur un iPhone 14 Pro, et à quelles conditions.

## Points de vigilance

1. **Mesurer change ce qu'on mesure.** Un relevé qui alloue, qui écrit dans le DOM à chaque image ou qui garde tout l'historique en mémoire fabriquera ses propres saccades. Il doit écrire dans des tableaux typés de taille fixe et ne toucher à l'affichage que quelques fois par seconde.
2. **Ne pas conclure d'une seule partie.** Un téléphone qui chauffe, une autre application en arrière-plan, un réseau qui hoquette: il faut plusieurs relevés, et le protocole doit le dire.
3. **La moyenne ment.** C'est la distribution qui décrit une saccade, et le compte d'images lentes qui la chiffre.
4. **Se méfier de la première hypothèse qui colle.** Deux causes peuvent se cumuler, et l'étape 5.4 a déjà montré qu'une cause trouvée sur iPhone pouvait en cacher une autre.
5. **Le porteur du projet est dans la boucle, et l'étape s'arrête sans lui.** C'est prévu, ce n'est pas un échec: on écrit un handoff partiel au statut bloquée, disant exactement quels relevés manquent.
6. **Écrire pour une personne non technique**, comme tout le reste de la documentation du projet.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-5-handoff.md` depuis le modèle, puis commiter. Si les relevés du vrai appareil manquent encore, le handoff est **partiel**, et sa prochaine action exacte est la recette à faire par le porteur du projet, protocole en main.
