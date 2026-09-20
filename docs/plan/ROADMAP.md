# ROADMAP - Réécriture Neon Ninja

Plan d'exécution découpé en étapes calibrées pour une conversation Claude Code chacune. Ce fichier est la carte. La fiche détaillée de chaque étape est dans docs/plan/etape-X-Y.md, à lire avant d'attaquer l'étape.

Ce document distingue deux choses:

- **L'ordre d'exécution** (section 3), qui organise le travail en jalons livrables.
- **La carte thématique** (section 4), qui regroupe les étapes par domaine.

Les deux ne coïncident pas. La numérotation des étapes suit la carte thématique et ne change jamais, pour que les renvois entre fiches restent valides. C'est la section 3 qui dit dans quel ordre les exécuter.

## 1. Comment utiliser ce plan

- Une étape égale une conversation. On ne mélange pas deux étapes dans une même session.
- Lire la fiche de l'étape, et la réconcilier avec l'état réel du dépôt avant d'exécuter. Une fiche est un plan, pas un contrat figé. Tout écart se note dans le handoff.
- On termine toujours par un handoff (voir docs/handoffs/_TEMPLATE.md) et un commit.
- **La ligne « prochaine action exacte » en fin de fiche suit la numérotation thématique, pas l'ordre d'exécution.** En cas de divergence, la section 3 fait foi.

## 2. Définition de terminé, commune à toutes les étapes

Une étape est terminée quand, toutes ces conditions étant réunies:

1. Les tests requis de l'étape sont écrits et passent.
2. La CI est verte.
3. Aucune régression sur les tests de caractérisation.
4. Le code respecte les conventions de CLAUDE.md (commentaires en français, pas de variable globale mutable, fichiers concernés documentés).
5. Un handoff a été écrit et commité.

Si une étape déborde, ne pas forcer. La couper en deux, écrire un handoff partiel, et continuer dans la conversation suivante.

---

## 3. Ordre d'exécution et jalons

Le plan d'origine était découpé par couches: tout le moteur, puis tout le réseau, puis toute la base, puis tout le client. Conséquence, le jeu ne redevenait jouable qu'à l'étape 4.4, la vingtième sur vingt-trois. C'est la forme exacte de l'échec de la refonte de 2025: beaucoup construit, jamais confronté au réel.

L'ordre ci-dessous découpe en **tranches verticales**. La première tranche traverse le moteur, le serveur et le client pour redonner un jeu jouable, à parité avec l'existant. Les fonctionnalités nouvelles viennent ensuite, sur une base qui tourne.

### Jalon 1 - Le jeu actuel sur socle sain (15 étapes)

`0.1` `0.2` `1.1` `1.2` `1.3` `1.4` `1.5` `1.6` `2.1` `2.2` `1.7` `4.1` `4.2` `4.3` `4.4`

À l'arrivée: le jeu d'aujourd'hui, entièrement porté, couvert par des tests, avec une seule partie à la fois. Rien de neuf fonctionnellement, tout de neuf structurellement.

Adaptations à appliquer aux fiches de la phase 4 dans ce jalon, parce qu'elles supposent des étapes non encore faites:

- **4.1**: le flux d'état reste en JSON (celui de l'étape 2.2), pas en delta binaire. Pas de session authentifiée. Les écrans sont ceux du legacy (accueil et pseudo, salon, jeu, fin de partie), pas les sept écrans de la maquette. **Exigence de conception: isoler la couche réseau derrière une interface**, pour que le passage au delta binaire en 2.3 ne touche qu'elle.
- **4.3**: construire uniquement les écrans du legacy. Le navigateur de parties, la création, le profil et l'affichage de progression arrivent avec 2.4 et 3.3.
- **4.4**: parcours de bout en bout sans inscription ni progression. Deux clients dans la même partie, capture, score cohérent, plus un test de fumée en fenêtre mobile.

### Jalon 2 - Multi-parties (après les maquettes)

`0.3` `2.4`

Le cadrage fonctionnel puis le matchmaking, les parties privées par code et les publiques par liste et partie rapide. `2.1` ayant déjà encapsulé l'état par partie, il ne s'agit que d'en instancier plusieurs et d'y router les joueurs.

Les maquettes ont été déposées le 13 août 2026: ce jalon n'est plus bloqué. Elles sont à traiter comme des propositions à challenger, pas comme une spécification. Voir l'avertissement et les tensions relevées dans docs/design/README.md.

### Jalon 3 - Comptes et progression

`3.1` `3.2` `3.3`, puis reprise des écrans de `4.3` (navigateur, création, profil, fin de partie enrichie). Sa fiche est `docs/plan/etape-4-3-reprise.md`, rédigée le 11 septembre 2026 selon le cas de repli du PROTOCOLE.

### Jalon 4 - Performance et charge

`5.1` puis `5.2`. **`2.3` (delta binaire) est rattaché ici et conditionné à la mesure de `5.1`.** Le plan d'origine le plaçait en phase 2, avant toute mesure, ce qui contredisait son propre principe « optimisations validées par la mesure ». S'il n'est pas justifié, il ne se fait pas.

**Mesure du 11 septembre 2026 (étape 5.1): `2.3` est justifié, et se fait après `5.2`.** Ordre du jalon: `5.1` `5.2` `2.3`. Un instantané de partie à 150 bots pèse 21,5 Ko, soit 3,4 Mbit/s par joueur; mais le premier mur atteint en charge est la cadence du serveur, vers 16 à 24 parties pleines par processus, qui relève de `5.2`. Chiffres et raisonnement: `docs/mesures/charge-serveur.md`, et le journal de `docs/design/README.md`.

**Mesure du 12 septembre 2026 (étape 5.2): le mur de la cadence est levé, `2.3` suit.** Trois optimisations validées par la mesure, sans changement de jeu, font passer un processus de 16 à 48 parties pleines tenues, et de 24 à 64 parties mêlées. Le coût d'une partie pleine sur le vrai serveur est divisé par deux (1,92 à 0,95 ms par battement), et la perte de cadence de 5.1 est expliquée et corrigée: un processus ne décroche plus que lorsque son fil est réellement plein. La première limite est désormais la bande passante: 3,4 Mbit/s par joueur, 2 Gbit/s sortants pour 48 parties pleines. C'est l'objet de `2.3`.

**Mesure du 12 septembre 2026 (étape 2.3): le jalon 4 est terminé.** Le flux d'état voyage en trames binaires, une image puis des deltas: un message de partie pleine passe de 21,5 Ko à 464 octets, soit 0,07 Mbit/s par joueur, et 48 parties pleines écrivent 42 Mbit/s au lieu de 2 Gbit/s. Le jeu n'a pas changé. La capacité d'un processus ne change pas (48 parties pleines, 64 mêlées): son premier mur reste un fil plein. Le filtrage par zone d'intérêt est écarté par la mesure. Chiffres: section 12 de `docs/mesures/charge-serveur.md`.

### Jalon 5 - Extension

Le mode tactique en premier, ajouté comme jeu de règles enfichable (décision du 29 juin): étape `7.1`, fiche rédigée le 12 septembre 2026 selon le cas de repli du PROTOCOLE, après quatre décisions de jeu du porteur du projet. Puis les autres modes. Puis `5.3` et `6.1`, ramenés à un déploiement simple: le legacy n'a pas de joueurs en ligne, la bascule progressive et les drapeaux de fonctionnalité sont sans objet.

**Étape 7.1 terminée le 12 septembre 2026.** Le mode Tactique se crée, se joue et s'enregistre depuis la page, au clavier et au tactile: capture par un cône de 90 degrés et 100 pixels, cinq charges, une qui revient toutes les cinq secondes. Ajouter le mode n'a demandé que des ajouts aux points d'extension, plus l'élargissement du jeu de règles d'un mode, qui agit sur les entrées avant de résoudre les contacts. Le Classique est inchangé, empreinte des parties comprise; une partie Tactique coûte le même temps au serveur et 4 à 10 pour cent d'octets de plus par message (section 13 de `docs/mesures/charge-serveur.md`). Les autres modes (Chasse, Battle Royale, Équipes, Chaos) restent des propositions non validées (cadrage, tension 2): la suite du jalon 5 se décide avec le porteur du projet.

**Décision du 14 septembre 2026: les autres modes attendent la fin du socle.** Le porteur du projet a tranché, « d'abord on finalise le socle, ensuite on l'enrichit »: aucun nouveau mode ne se construit avant la fin de la réécriture. Ordre du jalon: `7.1` (terminée), `5.3`, `6.1`. Les autres modes viendront ensuite, en phase 7, chacun avec ses règles tranchées par le porteur du projet.

**Étape 5.3 terminée le 14 septembre 2026.** La page est en ligne sur Vercel, le serveur de jeu sur Render en offre gratuite, et chaque commit vert de `reecriture` se met en ligne seul, vérifié. Voir `docs/deploiement.md`.

**Décision du 14 septembre 2026: une recette fonctionnelle avant le retrait du legacy.** Le porteur du projet a cru voir des manques ou des défauts, dont l'attribution aléatoire des couleurs, et demande une étape qui teste fonctionnellement tout ce qui a été fait: étape `5.4`, fiche rédigée le même jour. Ordre du jalon: `7.1` et `5.3` (terminées), `5.4`, `6.1`.

**Décision du 14 septembre 2026, à la recette: deux manques connus deviennent des étapes.** Présentés au porteur du projet au début de l'étape 5.4, la reconnexion en cours de partie et la gestion du mot de passe n'ont pas été retenus dans celle-ci: ils deviennent les étapes `2.5` et `3.4`. Aucune ne conditionne le retrait du legacy, qui n'avait ni l'une ni l'autre: elles le suivent. Ordre du jalon: `5.4`, `6.1`, `2.5`, `3.4`, que le porteur du projet peut réordonner. Leurs fiches se rédigent au début de chacune, selon le cas de repli du PROTOCOLE.

**Étape 6.1 terminée le 15 septembre 2026: la réécriture est la seule version du jeu.** `reecriture` est fusionnée dans `master`, qui porte désormais le travail et la production, et la branche `reecriture` est supprimée. Plus rien en ligne ne sert la version d'origine: le service Render « To The Point » et les projets Vercel `ttp` et `neon-ninja` sont supprimés, sur décision du porteur du projet. Elle reste archivée sous l'étiquette `v0.8.6` et dans `legacy/`. Suite: `2.5` puis `3.4`, puis les fonctionnalités reportées (autres modes, pass de saison, skins, clans), chacune avec sa fiche.

**Étape 2.5 terminée le 15 septembre 2026: une coupure ne coûte plus la partie.** Un joueur dont le lien tombe en pleine partie, ou qui recharge sa page, retrouve sa place, sa couleur et ses ninjas dans les trente secondes; pendant ce temps, il reste dans la partie, immobile, et ses bots transmettent sa couleur. Revenir est une demande explicite, avec un jeton de retour secret et renouvelé, que le serveur refuse au-delà du délai, à une autre identité ou pour une partie terminée. Dans le salon, une déconnexion reste un départ. Fiche: `docs/plan/etape-2-5.md`. Suite: `3.4`, gestion du mot de passe, puis `2.6`, le lien perdu hors partie, ajoutée à l'exécution de l'étape 2.5 selon la règle 7; ordre que le porteur du projet peut changer.

**Étape 3.4 terminée le 15 septembre 2026: un compte gère son mot de passe.** Depuis son profil, un joueur change son mot de passe contre l'ancien, ce qui ferme ses autres sessions et coupe leurs connexions de jeu. Un mot de passe oublié se retrouve par un code de secours, voie choisie par le porteur du projet au début de l'étape: seize caractères remis à chaque nouveau mot de passe, montrés une seule fois, à usage unique. Fiche: `docs/plan/etape-3-4.md`. Suite: `2.6`, le lien perdu hors partie, puis les fonctionnalités reportées.

**Étape 2.6 terminée le 15 septembre 2026: hors partie, un lien perdu se rétablit sans recharger.** Sur l'accueil, dans les menus et devant le classement de fin, le joueur reste sur son écran pendant que la page rouvre le lien, toutes les trois secondes pendant une minute et demie, puis propose « Réessayer »; elle réessaie aussi dès qu'elle revient au premier plan. Dans le salon, le lien revenu y ramène le joueur, comme un nouvel arrivant. Deux défauts trouvés en route sont corrigés: le transport renvoyait sur le lien rétabli les messages émis pendant la coupure, et l'arrêt du serveur restait suspendu aux connexions qu'un navigateur ouvre d'avance. Fiche: `docs/plan/etape-2-6.md`. Suite: les fonctionnalités reportées (autres modes, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet, chacune avec sa fiche.

**Étape 7.2 terminée le 16 septembre 2026: le jeu a son mode Équipes.** Deux équipes d'une couleur chacune, douze joueurs au plus, l'équipe choisie au salon, et un joueur par équipe pour lancer. Capturer un adversaire rapporte sa part des ninjas de son équipe, un Black Ninja en fait perdre la moitié, un malus frappe l'équipe adverse, et les récompenses se calculent par équipe. Pour le moteur, une équipe est une couleur: l'état ne gagne aucun champ, et l'empreinte des quatre parties Classique de référence est identique. Fiche: `docs/plan/etape-7-2.md`. Suite: les autres fonctionnalités reportées (Chasse, Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet, chacune avec sa fiche.

**Décision du 16 septembre 2026: le mode Massacre suit la Chasse.** Le porteur du projet l'imagine après l'étape 7.3: tuer les bots d'un coup de katana en arc, avec du sang et des traces de pas, des combos de points, seul ou à plusieurs. Son intention et ce qui a été étudié sont dans `docs/design/idee-mode-massacre.md`; ses règles restent à trancher, en étape `7.4`, dans une nouvelle conversation. Les cartes beaucoup plus grandes d'une Battle Royale sont étudiées et gardées pour plus tard (`docs/mesures/etude-grandes-cartes.md`).

**Étape 7.3 terminée le 16 septembre 2026: le jeu a son mode Chasse.** Des traqueurs, un par tranche de cinq joueurs tirés au sort, cherchent les vrais joueurs cachés parmi les faux ninjas et tirent en cône: une proie touchée devient traqueur, un faux ninja coûte une vie, et le traqueur est éliminé à la troisième. Les proies marquent en parcourant la carte, les traqueurs par leurs captures et leurs vies; classement individuel aux points. La minimap ne montre que son camp, et il n'y a pas de Black Ninjas. Les règles ont été révisées par le porteur du projet en cours d'étape. Le Classique est inchangé, empreinte des parties comprise; une partie Chasse coûte un peu moins au serveur (section 15 de `docs/mesures/charge-serveur.md`). Fiche: `docs/plan/etape-7-3.md`. Suite: les autres fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet, chacune avec sa fiche.

**Décision du 15 septembre 2026: le mode Équipes ouvre les fonctionnalités reportées.** Le porteur du projet l'a choisi parmi les quatre modes proposés, le pass de saison, les skins et les clans, puis a tranché ses règles: deux équipes d'une couleur chacune, douze joueurs, choix de l'équipe au salon, capture d'un adversaire qui rapporte sa part des bots de son équipe, malus sur l'équipe adverse, récompenses par équipe. Étape `7.2`, fiche rédigée le même jour selon le cas de repli du PROTOCOLE. Les autres fonctionnalités reportées suivent, dans l'ordre que fixera le porteur du projet.

**Décision du 16 septembre 2026: la Chasse suit les Équipes.** Le porteur du projet l'a choisie parmi les fonctionnalités reportées restantes, puis a tranché douze règles: une proie attrapée devient traqueur (infection), la survie seule compte, un traqueur par cinq joueurs tiré au sort au lancement, dix joueurs, trois secondes avant qu'un nouveau traqueur capture, deux camps à la fin, les ninjas en camouflage sans Black Ninjas, une couleur commune aux traqueurs, pas d'entrée dans une Chasse lancée. Étape `7.3`, fiche rédigée le même jour selon le cas de repli du PROTOCOLE.

**Révision du 16 septembre 2026, pendant l'étape 7.3: la Chasse devient un jeu de repérage.** Après les lots A et B, le porteur du projet a fait évoluer le mode. Le traqueur capture par un tir en cône, comme en Tactique, et ne prend que l'entité la plus proche. Viser un faux ninja lui coûte une vie, et il est éliminé à la troisième. Les proies marquent un point par tranche de cent pixels parcourus. Un traqueur marque cinquante points par capture et vingt-cinq par vie restante. Le classement est individuel, aux points. La fiche est réécrite en conséquence (lots A2 et B2).

**Décision du 16 septembre 2026: les règles du Massacre.** Le porteur du projet les a tranchées en dix points: le katana balaie un arc de 160 degrés sur 60 pixels, toutes les 400 millisecondes, et tue les bots comme les joueurs; la carte se vide, et la partie s'arrête quand tout est tué, avec 5 points par seconde restante; un bot vaut 10 points fois un multiplicateur de combo, qui monte toutes les cinq morts enchaînées à moins de deux secondes, jusqu'à x5; un joueur tué perd son combo et la moitié de ses points, au profit de son tueur; les Black Ninjas restent, tranchables; huit joueurs, solo lançable, record personnel en solo; le sang est une préférence du joueur. Étape `7.4`, fiche rédigée le même jour selon le cas de repli du PROTOCOLE.

**Étape 7.4 terminée le 18 septembre 2026: le jeu a son mode Massacre.** On ne capture plus: un coup de katana en arc tue les faux ninjas, les Black Ninjas et les autres joueurs, et les morts enchaînées multiplient les points. La carte se vide, avec un bonus au temps restant; le mode se joue seul, avec un record personnel au profil, ou à huit. Le sang, les cadavres et les traces de pas sont dessinés tout en code, les mêmes pour tous, et chacun choisit d'en voir plus ou moins. Le Classique est inchangé, empreinte des parties comprise; une partie Massacre coûte moins qu'une Classique, la carte se vidant sous les coups (section 16 de `docs/mesures/charge-serveur.md`). Fiche: `docs/plan/etape-7-4.md`. Suite: les autres fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet, chacune avec sa fiche.

**Décision du 18 septembre 2026: du peaufinage et du débogage avant toute nouvelle évolution.** En jouant après l'étape 7.4, le porteur du projet a relevé un défaut d'affichage (un personnage arrêté se retournait face à l'écran), corrigé le jour même pour les joueurs (`b7f9cd3`) puis, sur sa décision, pour les bots (`24e2fc2`). Il demande une étape consacrée à ce genre de défauts avant d'attaquer les fonctionnalités reportées: étape `5.5`, peaufinage et débogage de tout le jeu, les cinq modes compris. Sa fiche se rédige au début de la session selon le cas de repli du PROTOCOLE, à partir de la liste que donne le porteur du projet et des limites connues des handoffs. Ordre: `5.5`, puis les fonctionnalités reportées.

**Décision du 18 septembre 2026, au début de l'étape 5.5: deux nouvelles étapes.** La liste du porteur du projet mêlait des défauts et des évolutions. Les défauts, et deux limites connues (la flèche d'une proie infectée, la teinte fixe des cadavres), restent dans `5.5` (fiche `docs/plan/etape-5-5.md`). Deviennent des étapes: `7.5`, réglages du Classique (combo, points flottants qui suivent le combo, renommage en « Horde » à confirmer, vitesse commune de 150 pixels par seconde aux joueurs et aux bots hors bonus), qui change le score et les vitesses protégés par CLAUDE.md et se fait donc en une fois; et `7.6`, options de partie (Tokyo unique avec une option pluie, plus de 150 bots selon le mode ou la carte). Ordre: `5.5`, `7.5`, `7.6`, puis les fonctionnalités reportées.

**Étape 5.5 terminée le 18 septembre 2026: le jeu est peaufiné avant ses nouvelles règles.** Quatorze points corrigés, chacun avec son test: les sons (tous se taisaient au cinquantième fait reçu; les captures du Classique; les sons du katana et du fusil du Tactique, fournis par le porteur du projet; le volume sous iOS, par Web Audio), « Rejouer » qui garde le mode, le HUD en une seule barre supérieure, l'en-tête des menus sur téléphone, la connexion au serveur rendue visible, l'aide lisible, la couleur des cadavres, les flèches de localisation, et le serveur Render tenu éveillé tant qu'une page est ouverte. Empreinte des parties de référence identique. Fiche: `docs/plan/etape-5-5.md`. Suite: `7.5`, puis `7.6`.

**Étape 7.5 terminée le 18 septembre 2026: le Classique devient la Horde.** Les faux ninjas ralliés à la suite font un combo aux règles du Massacre, dont la prime s'ajoute au score et se perd avec les ninjas à la capture; les points flottants montent du blanc au magenta avec le combo, en Horde et en Massacre; joueurs, faux ninjas et Black Ninjas vont tous à 150 pixels par seconde hors bonus. Les nouvelles empreintes des quatre parties de référence sont au handoff. Fiche: `docs/plan/etape-7-5.md`. Suite: `7.6`.

**Étape 7.6 terminée le 19 septembre 2026: Tokyo unique, et plus de faux ninjas.** Rainy Tokyo et Tokyo sont une seule carte « Tokyo », dont la pluie est un réglage de partie, activé par défaut; les parties jouées sur l'ancienne Tokyo restent lisibles. Chaque carte a son plafond de faux ninjas au départ, 300 sur Tokyo et 500 sur Spirit & Time, dans tous les modes. Le serveur les tient sans effort (2,3 ms par battement à 500); dans la page, le lissage en carré du nombre d'entités est corrigé, et la transmission des sprites reste à alléger pour les téléphones d'entrée de gamme (section 17 de `docs/mesures/charge-serveur.md`). Le jeu est inchangé, empreinte des parties comprise hors du nouveau réglage. Fiche: `docs/plan/etape-7-6.md`.

**Décision du 19 septembre 2026: trois étapes suivent `7.6`.** Deux demandées par le porteur du projet: `4.5`, les textes de présentation du menu principal, qui parlent encore de troupeaux et de capture seule, alors que le jeu compte cinq modes, la Horde, l'élimination et la traque; `5.6`, le référencement du jeu dans les moteurs de recherche. Une issue de la mesure de `7.6`, sur décision du porteur du projet: `5.7`, l'allègement du rendu, pour que 500 entités tiennent sur un téléphone d'entrée de gamme. Ordre: `4.5`, `5.6`, `5.7`, puis les fonctionnalités reportées; le porteur du projet peut le changer. Leurs fiches se rédigent au début de chacune, selon le cas de repli du PROTOCOLE.

**Étape 4.5 terminée le 19 septembre 2026: le jeu se présente tel qu'il est.** Les textes de l'accueil, de la création et de l'aide ont été réécrits avec le porteur du projet, dans un ton court et un peu décalé: « Le ninja, c'est vous. Enfin, un des trois cents. », « Plusieurs modes, beaucoup de ninjas. », une carte par mode sur l'accueil, une section par mode dans l'aide. Le joueur lit « PNJ » là où il lisait « faux ninjas ». L'aide cite enfin Espace et le bouton Katana pour les trois modes qui s'en servent. Aucune règle ne change. Fiche: `docs/plan/etape-4-5.md`.

**Étape 5.6 terminée le 19 septembre 2026: le jeu peut être trouvé.** La page dit ce qu'est le jeu dans son titre, déclare une seule adresse, `ninja.dendrolag.fr`, vers laquelle l'alias `vercel.app` redirige, sert un fichier des robots et un plan du site, décrit le jeu en données structurées, et montre une vraie scène de partie quand on partage son lien. Un moteur de recherche qui n'exécute pas le jeu lit le titre de l'accueil et les cinq modes, qui servent aussi d'écran de chargement. Reste au porteur du projet à déclarer le domaine à Google et à Bing. Fiche: `docs/plan/etape-5-6.md`.

**Étape 5.7 terminée le 19 septembre 2026: 500 entités tiennent sur un téléphone d'entrée de gamme.** Le rendu ne transmet plus à PixiJS que ce qui change, et que ce que la caméra montre: au processeur ralenti six fois et au cadrage d'un téléphone, une image à 500 entités coûte environ 5 ms de processeur au lieu de 16, notre code 1,6 à 1,9 ms au lieu de 5,8 à 6,2. Tout à l'écran, notre code tient sous le quart d'une image (2,7 ms). Rien ne change de ce qui se voit, sinon un défaut corrigé: un personnage créé en cours de partie, comme un cadavre du Massacre, ne passe plus devant les autres (section 18 de `docs/mesures/charge-serveur.md`). Fiche: `docs/plan/etape-5-7.md`. Suite: les fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet.

**Décision du 19 septembre 2026: les objets du Tactique ouvrent la suite.** Hors de la liste des fonctionnalités reportées, le porteur du projet demande six objets qui jouent sur l'arme du Tactique: trois bonus (Rafale, Recharge rapide, Visée large) et trois malus (Tir unique, Visée étroite, Recharge lente), avec les charges affichées sous le joueur, une vue plus proche sur ordinateur et une minimap limitée aux alentours. Les règles et les rendus ont été tranchés avec lui sur maquettes. Étape `7.7`, fiche `docs/plan/etape-7-7.md`, rédigée le même jour selon le cas de repli du PROTOCOLE. Ensuite, les autres fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet.

**Étape 7.7 terminée le 20 septembre 2026: le Tactique a ses six objets.** Rafale, Recharge rapide et Visée large, et leurs contraires Tir unique, Recharge lente et Visée étroite, qui frappent les autres joueurs; un bonus et son contraire s'annulent. Les six n'existent que dans ce mode, réglables comme les autres objets, à la moitié de leur taux pour que la carte ne se charge pas davantage. Les charges se lisent sur un arc sous son propre ninja, la vue est plus proche sur ordinateur (500 pixels de carte au lieu de 900) et la minimap ne montre que les joueurs à moins de 900 pixels. Deux défauts anciens corrigés en chemin: Vision floue et Vision négative ne troublaient plus l'écran de leur victime, et un malus subi de nouveau voyait sa jauge s'allonger. La Horde est inchangée, empreinte des parties comprise; une partie Tactique coûte autant qu'avant au serveur (section 19 de `docs/mesures/charge-serveur.md`). Fiche: `docs/plan/etape-7-7.md`. Suite: les autres fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans), dans l'ordre que fixe le porteur du projet.

**Décision du 20 septembre 2026: deux étapes suivent 7.7.** Le porteur du projet a demandé, en recettant les objets du Tactique, de revoir le style des repères de localisation, et d'amorcer les nouvelles cartes. Sur maquettes (`docs/design/etape-7-8/`), il a choisi de remplacer les quatre triangles rouges par une onde qui se referme, à la couleur du joueur: étape `7.8`. Pour les cartes, il a choisi une étude avant tout prototype: étape `8.1`. Leurs fiches se rédigent au début de chacune, selon le cas de repli du PROTOCOLE.

**Étape 7.8 terminée le 20 septembre 2026: le repère de localisation est une onde.** Les quatre triangles rouges cèdent la place à deux anneaux à la couleur du joueur, cernés de blanc, qui se resserrent sur son ninja en boucle pendant le repérage, plus un anneau d'ancrage discret. Les occasions, les durées et le fondu ne changent pas. Fiche: `docs/plan/etape-7-8.md`. Suite: `8.1`, l'étude des structures de carte.

**Étape 8.1 terminée le 20 septembre 2026: l'étude des structures de carte.** Première étape de la phase 8, et un document, pas du code: `docs/mesures/etude-structures-de-carte.md`. Ce qu'est techniquement une carte (neuf fichiers, un seuil de luminosité, un étirement à ne pas rater), ce que valent les deux cartes existantes une fois mesurées (des terrains ouverts: détour médian 1,08 et 1,06, relevé à 1,07 quand l'étape 8.2 a affiné le tirage de l'outil), ce qu'une partie à plusieurs demande à une carte, douze critères de jugement chiffrés, quatre archétypes, et les limites du socle (environ 12 Mpx et 1 000 PNJ sans rien changer). Un outil de mesure relançable l'accompagne. Fiche: `docs/plan/etape-8-1.md`. Suite: le porteur du projet a répondu le jour même aux cinq questions de la section 7, et à deux autres. Un quartier de **2400 sur 1800** à **1,20 de détour**, éprouvé d'abord en **carte de travail** sans graphiste, avec un **miroir calculé** par le jeu, et le repérage jugé à la recette plutôt qu'anticipé. Réponses consignées à la section 7.1 de l'étude et au journal de conception. Deux étapes en découlent: `8.2`, la carte de travail, et `8.3`, le miroir calculé, indépendantes l'une de l'autre.

**Étape 8.2 terminée le 20 septembre 2026: le jeu a une troisième carte, et elle a une structure.** `quartier`, un quartier de 2400 sur 1800 en noir et blanc, sans graphiste, produit par un programme du dépôt (`docs/mesures/dessiner-le-quartier.mjs`) et non dessiné à la main. **Détour médian 1,24**, dans la cible de 1,20 à 1,35, contre 1,08 et 1,07 aux deux cartes héritées: c'est le premier terrain du jeu où le chemin se choisit. Les douze critères de l'étude 8.1 sont tenus, et le plafond de 340 PNJ est confirmé au banc de charge. Mesures et jugement: section 9 de `docs/mesures/etude-structures-de-carte.md`. Fiche: `docs/plan/etape-8-2.md`. Reste au porteur du projet d'y jouer à plusieurs et de dire si la structure vaut un décor. Suite: `8.3`, le miroir calculé.

---

## 4. Carte thématique des étapes

### Phase 0. Filet et fondations

Poser le harnais de test et figer le comportement actuel avant tout portage.

**0.1. Squelette du dépôt et outillage.** Monorepo (packages sim, server, client, shared), TypeScript, linter, formateur, Vitest, Playwright, CI GitHub Actions verte sur un test trivial. Committer CLAUDE.md, .claude/rules/ et docs/. Figer le legacy en lecture seule.
Tests requis: un test trivial vert dans Vitest, un scénario vide qui démarre dans Playwright, la CI verte.

**0.2. Tests de caractérisation du legacy.** Enregistrer le comportement actuel sur les points sensibles: résolution d'une capture, détection de collision, calcul de score, effets des bonus et malus. Ces références deviennent la vérité du comportement attendu.
Tests requis: une suite de caractérisation qui encode le comportement legacy et passe au vert.

**0.3. Cadrage fonctionnel depuis les maquettes.** Documentation, sans code. Produire docs/design/cadrage.md: périmètre v1, inventaire des écrans et de leurs besoins en données, contrat de configuration de partie, forme des données de progression, principe des modes enfichables.
Vérifications requises: chaque écran v1 a ses besoins listés, le contrat de configuration est complet.

### Phase 1. Cœur de simulation pur

Porter toute la logique de gameplay dans packages/sim, sans entrée-sortie, couverte par des tests unitaires. Phase la plus risquée et la plus structurante. Elle valide tôt la préservation du gameplay.

**1.1. Squelette du moteur et modèle d'état.** Modèle d'état, contrat tick(etat, entrees, dt), générateur à graine, portage de Entity et Player.
Tests requis: TU sur la création d'état, la pureté, l'avancement par tick, le déterminisme de la graine.

**1.2. Déplacements et collisions.** Carte de collisions taille-agnostique sur données pures, déplacements des entités.
Tests requis: TU sur collisions entité-entité et entité-terrain, sur plusieurs tailles de carte, conformes à la caractérisation.

**1.3. Capture et score.** Résolution d'une capture de bot et de joueur, transfert des bots, calcul du classement.
Tests requis: TU sur la résolution d'une capture et la mise à jour des scores, conformes à la caractérisation.

**1.4. Bonus, malus et zones spéciales.** Effets et durées.
Tests requis: TU sur l'application et l'expiration de chaque effet.

**1.5. Intelligence artificielle des bots.** Bots standards et BlackBot, rendus déterministes via la graine.
Tests requis: TU sur les décisions des bots dans des situations données, reproductibles.

**1.6. Durcissement et autorité serveur.** Étape ajoutée, absente du plan d'origine. Validation des entrées, autorité du serveur sur le mouvement, limitation de débit, échappement des données fournies par le joueur. Les défauts de sécurité relevés dans docs/audit/AUDIT-EXISTANT.md ne se caractérisent pas, ils se corrigent par conception.
Tests requis: TU et TI sur le rejet des entrées invalides, le plafonnement du déplacement par unité de temps, le refus d'un débit excessif.

**1.7. Pause de partie.** Étape ajoutée le 14 août 2026, découverte à l'exécution de l'étape 2.2. Le legacy propose une pause (`togglePause`, `pauseGame`, `resumeGame`), et aucune étape de la phase 1 ne l'a portée : ni `EtatPartie` ni `tick` ne connaissent la notion. Elle ne pouvait pas être ajoutée dans la couche réseau, qui n'a le droit de contenir aucune logique de jeu. Périmètre : un état de pause dans le moteur, le temps de jeu qui cesse de s'écouler pendant, l'exposition par `GameRoom`, et les événements réseau correspondants. À placer après 2.2 parce qu'elle traverse le moteur, la room et le réseau, et avant le client, qui a besoin du contrat complet.
Tests requis : TU sur l'arrêt de l'écoulement du temps et le gel des entités pendant la pause, TI sur la mise en pause et la reprise par le réseau, plus la vérification qu'une partie en pause ne se termine pas.

### Phase 2. Serveur et réseau

**2.1. GameRoom et RoomManager.** Envelopper le moteur pur dans une GameRoom qui détient l'état d'une partie, et un RoomManager qui en instancie plusieurs. Boucle de tick par room, temps injecté.
Tests requis: TI sur le cycle de vie d'une room, et sur l'isolation entre plusieurs rooms.

**2.2. Couche Socket.IO et contrats d'événements.** Contrats typés partagés, routage des événements par room.
Tests requis: TI avec des clients simulés, vérification des séquences et de l'isolation entre rooms.

**2.3. Diffusion en delta binaire.** Remplacer la diffusion d'état complet en JSON par un delta binaire. **Conditionné à la mesure de l'étape 5.1.**
Tests requis: TI sur la correction du delta, plus une mesure avant-après de la taille des messages.

**2.4. Matchmaking, parties privées et publiques.** Code d'invitation pour les privées, liste et partie rapide pour les publiques (le cadrage de l'étape 0.3 a remplacé la file).
Tests requis: TI sur la création et la jonction par code, et l'attribution en file publique.

**2.5. Reconnexion en cours de partie.** Étape ajoutée le 14 septembre 2026, à la recette de l'étape 5.4, sur décision du porteur du projet. Un joueur dont le lien se coupe, ou qui recharge la page, retrouve sa partie, sa couleur et ses ninjas, dans un délai borné; au-delà, son départ est un abandon, comme aujourd'hui. La reconnexion automatique de Socket.IO reste coupée (étape 4.1): le retour est une demande explicite, authentifiée, que le serveur accepte ou refuse. Contrainte posée à l'étape 5.4: seule la couleur d'un joueur présent dans l'état de la partie se transmet d'un bot à l'autre (comportement à préserver 11); le joueur doit donc rester dans l'état pendant son délai de retour, sans quoi ses bots cessent de propager sa couleur pendant la coupure.
Tests requis: TI sur le retour dans la partie dans le délai et le refus au-delà, sur le refus d'un retour usurpé; bout en bout d'un rechargement de page en pleine partie.

**2.6. Lien perdu hors partie.** Étape ajoutée le 15 septembre 2026, à l'exécution de l'étape 2.5, selon la règle 7 de CLAUDE.md. L'étape 2.5 garde la place d'un joueur en pleine partie. Sur l'accueil, dans les menus ou dans le salon, une page qui perd son lien affiche toujours « La connexion au serveur a été perdue » et ne le rétablit pas: c'est la fragilité relevée à l'étape 5.4, celle d'un téléphone qui change de réseau ou d'une page privée de processeur, et elle fait échouer des parcours de bout en bout sous charge. Hors d'une partie en cours, il n'y a pas de place à reprendre: la page peut rouvrir le lien d'elle-même. Ce qui est dit au joueur, et le sort de sa place dans un salon, se tranchent au début de l'étape. Tranché le 15 septembre 2026: le joueur reste sur son écran, la page essaie une minute et demie puis propose « Réessayer », et dans le salon elle redemande la place au retour du lien.
Tests requis: TU sur la réouverture d'un lien perdu hors partie et sur ce qui est dit au joueur; bout en bout d'un lien coupé sur l'accueil, puis rétabli sans recharger.

### Phase 3. Persistance et comptes

**3.1. Base de données et schéma.** PostgreSQL, schéma comptes, progression et résultats, migrations versionnées.
Tests requis: TI avec base de test, migrations rejouables, opérations de base.

**3.2. Authentification.** Inscription, connexion, session, authentification de la connexion Socket.IO.
Tests requis: TI sur les parcours d'inscription et de connexion, et le rejet des accès non autorisés.

**3.3. Progression branchée sur la fin de partie.**
Tests requis: TI vérifiant que résultats et progression persistent après une partie.

**3.4. Gestion du mot de passe.** Étape ajoutée le 14 septembre 2026, à la recette de l'étape 5.4, sur décision du porteur du projet. Changer son mot de passe depuis le profil, en fermant les autres sessions du compte. La réinitialisation d'un mot de passe oublié demande un moyen de joindre le joueur, que les comptes n'ont pas: son périmètre se tranche avec le porteur du projet au début de l'étape. Tranché le 15 septembre 2026: un code de secours, remis à chaque nouveau mot de passe.
Tests requis: TI sur le changement accepté avec l'ancien mot de passe et refusé sans, sur la fermeture des autres sessions; bout en bout du changement depuis le profil.

### Phase 4. Client et rendu PixiJS

**4.1. Squelette client et couche réseau.** Séparation nette entre état et rendu, magasin d'état unique, couche réseau isolée derrière une interface.
Tests requis: TU sur la reconstruction d'état et les transitions d'écran.

**4.2. Rendu in-game PixiJS.** Lueur néon en filtre GPU au lieu du shadowBlur de Canvas 2D. Boucle de rendu propre, découplée du réseau.
Tests requis: banc de mesure de la fréquence d'images avec 100, 200 et 500 sprites, validant le choix du moteur.

**4.3. Menus et interface.**
Tests requis: scénarios de navigation, validation du formulaire de création.

**4.4. Bout en bout multi-clients.** Playwright, plusieurs clients simultanés, fenêtre mobile.
Tests requis: deux clients dans une même partie vérifiant la cohérence de l'état.

**4.5. Textes de présentation.** Faite le 19 septembre 2026 (fiche `docs/plan/etape-4-5.md`). Étape ajoutée le 19 septembre 2026, à la demande du porteur du projet. Revoir les textes de présentation du menu principal et des écrans qui décrivent le jeu: ils datent du jeu d'origine et parlent de troupeaux et de capture, alors que le jeu compte cinq modes, la Horde, l'élimination au katana et la traque. Les textes se rédigent avec le porteur du projet.
Tests requis: TU des écrans dont le texte change; aucun nom de mode ou de carte qui ne soit celui du contrat; bout en bout vert.

### Phase 5. Charge, performance et durcissement

**5.1. Tests de charge serveur.** N rooms peuplées de plus de 100 bots, mesure du temps par tick et de la bande passante.
Tests requis: rapport de charge chiffré, seuils de référence définis.

**5.2. Optimisations validées par la mesure.** Grille spatiale, niveau de détail sur l'IA des bots lointains, seulement si la mesure les justifie.
Tests requis: comparaison avant-après chiffrée, TU inchangés au vert.

**5.3. Déploiement.** Ramené à un déploiement simple, sans bascule progressive ni drapeau de fonctionnalité. Fiche réécrite le 14 septembre 2026: page sur Vercel, serveur de jeu sur Render, base sur Neon, sur des offres gratuites, avec un déploiement automatique et vérifié par la CI.
Tests requis: TU et TI du contrôle de version entre la page et le serveur, de la politique de sécurité partagée et de la route de santé; vérification que la version se déploie, démarre et répond dans l'environnement cible.

**5.4. Recette fonctionnelle.** Étape ajoutée le 14 septembre 2026, à la demande du porteur du projet. Dérouler une grille de recette de tout le jeu (écrans, règles, comptes, mode Tactique, cartes, multijoueur, mobile, production), en local et en production, en comparant au jeu d'origine là où il fait foi; corriger chaque défaut trouvé, dont l'attribution aléatoire des couleurs signalée.
Tests requis: un test qui échouait avant chaque correction; la grille complète, chaque cas avec son verdict.

**5.5. Peaufinage et débogage.** Étape ajoutée le 18 septembre 2026, à la demande du porteur du projet, après l'étape 7.4 et avant les fonctionnalités reportées. Recueillir auprès de lui les défauts et les manques qu'il relève en jouant, les compléter des limites connues des handoffs (5.4 à 7.4), les trier avec lui, puis corriger chacun, dans les cinq modes, sur ordinateur et sur téléphone. Aucune nouvelle fonctionnalité: ce qui en serait une devient une étape à part.
Tests requis: un test qui échouait avant chaque correction; empreinte des parties de référence identique, sauf changement voulu et consigné; bout en bout vert.

**5.6. Référencement.** Faite le 19 septembre 2026 (fiche `docs/plan/etape-5-6.md`). Étape ajoutée le 19 septembre 2026, à la demande du porteur du projet: que le jeu remonte dans les moteurs de recherche. Titre, description et aperçu de la page servie par Vercel, données structurées, plan du site et fichier des robots, contenu lisible sans exécuter le jeu, adresse canonique; mesurer avant et après avec les outils des moteurs de recherche.
Tests requis: TU ou TI des balises servies par la page; vérification en production de ce que voit un robot; bout en bout vert.

**5.7. Allègement du rendu.** Faite le 19 septembre 2026 (fiche `docs/plan/etape-5-7.md`). Étape ajoutée le 19 septembre 2026, issue de la mesure de l'étape 7.6, sur décision du porteur du projet de garder le plafond de 500 faux ninjas. Au processeur ralenti six fois, 500 entités coûtent 4,3 à 5,3 ms de notre code par image, dont 2,8 ms de transmission des sprites à PixiJS (section 17 de `docs/mesures/charge-serveur.md`). Réduire ce coût, par exemple en ne mettant à jour que ce que la caméra montre, sans changer ce qui se voit.
Tests requis: banc du rendu, série au processeur ralenti, avant et après, notre code sous le quart d'une image à 500 entités; TU de ce qui se dessine ou non; bout en bout vert.

### Phase 6. Retrait du legacy

**6.1. Extinction.** Retirer l'ancien monolithe une fois la nouvelle version en service.

### Phase 7. Modes de jeu

Phase ajoutée le 12 septembre 2026. Ajouter des jeux de règles au moteur, par ajout et non par refonte (cadrage de l'étape 0.3, section 6).

**7.1. Mode tactique.** Capture par un cône directionnel à charges limitées, au lieu de la capture au contact. Reprend l'intention et les valeurs de la v0.9.0 (branche `mode-strategique`), sans ses régressions, selon quatre décisions de jeu du porteur du projet du 12 septembre 2026.
Tests requis: TU sur la géométrie du cône, le tir, les charges et la visée; TI sur la commande de capture par le réseau; bout en bout d'une partie tactique, au clavier et au tactile; Classique inchangé, empreinte des parties comprise.

**7.2. Mode Équipes.** Deux équipes d'une couleur chacune, douze joueurs au plus, qui se disputent les bots de la carte. Première fonctionnalité reportée, choisie par le porteur du projet le 15 septembre 2026 avec neuf décisions de jeu: choix de l'équipe au salon, capture d'un adversaire qui rapporte sa part au plus près, bot noir qui en retire la moitié, malus sur l'équipe adverse, récompenses par équipe, lancement avec un joueur par équipe.
Tests requis: TU sur la part d'un joueur, la capture, le bot noir et le malus en équipes, le classement des équipes et les récompenses; TI sur le salon (arrivée, changement d'équipe, condition de lancement) et sur une partie Équipes à travers le vrai serveur et la base; bout en bout d'une partie préparée au salon et lancée; Classique et Tactique inchangés, empreinte des parties comprise.

**7.3. Mode Chasse.** Des traqueurs repèrent les vrais joueurs cachés parmi les faux ninjas et les infectent d'un tir en cône; viser un faux ninja coûte une vie, sur trois. Les proies marquent en restant mobiles. Deuxième fonctionnalité reportée, choisie par le porteur du projet le 16 septembre 2026, règles révisées le même jour: infection, traqueurs tirés au sort, dix joueurs, ninjas en camouflage sans Black Ninjas, couleur commune des traqueurs, classement individuel aux points.
Tests requis: TU sur les rôles, le tirage, le tir en cône, les vies et l'élimination, le remplacement d'un traqueur parti, les points et la fin anticipée; TI sur le salon (lancement, entrée refusée) et sur une partie Chasse à travers le vrai serveur et la base; bout en bout d'une partie lancée; Classique, Tactique et Équipes inchangés, empreinte des parties comprise.

**7.4. Mode Massacre.** Plus de capture: un coup de katana en arc tue les bots et les joueurs, chaque mort laisse du sang, et les morts enchaînées font monter un multiplicateur de points. La carte se vide; la partie s'arrête quand tout est tué, avec un bonus au temps restant. Troisième fonctionnalité reportée, choisie par le porteur du projet le 16 septembre 2026: huit joueurs, solo lançable avec record personnel, vol de la moitié des points d'un joueur tué, Black Ninjas tranchables, sang réglable par chaque joueur.
Tests requis: TU sur l'arc, le coup, les combos, le joueur tué, le Black Ninja et la carte vidée; TU du dessin reproductible du sang et des traces de pas; TI sur une partie Massacre à travers le vrai serveur et la base, record solo compris; bout en bout d'une partie lancée seul; Classique, Tactique, Équipes et Chasse inchangés, empreinte des parties comprise.

**7.5. Réglages du Classique.** Faite le 18 septembre 2026 (fiche `docs/plan/etape-7-5.md`). Étape ajoutée le 18 septembre 2026, au tri de l'étape 5.5. Un multiplicateur de combo pour les captures de faux ninjas enchaînées, sur le modèle du Massacre; des points flottants blancs dont la couleur et la taille montent avec le combo, sur une échelle fixée avec le porteur du projet; le renommage du Classique en « Horde », à confirmer; une vitesse commune de 150 pixels par seconde aux joueurs et aux bots, Black Ninjas compris, hors bonus. Les comportements à préserver 1 et 5 de CLAUDE.md sont mis à jour, datés, et les règles du combo tranchées au début de l'étape.
Tests requis: TU sur le combo et la vitesse; TU des points flottants; nouvelles empreintes des parties de référence, changement voulu et consigné; les autres modes inchangés là où la vitesse ne les touche pas; bout en bout vert.

**7.6. Options de partie.** Faite le 19 septembre 2026 (fiche `docs/plan/etape-7-6.md`). Étape ajoutée le 18 septembre 2026, au tri de l'étape 5.5. Tokyo et Rainy Tokyo ont le même décor: une seule carte « Tokyo », et une option pluie dans les réglages de partie, les parties et records déjà enregistrés restant lisibles. Plus de 150 faux ninjas au départ, selon le mode ou la carte, dans la limite qu'une mesure du débit et du rendu justifie.
Tests requis: TU de la validation des réglages; TI d'une partie avec pluie et d'une partie à plus de 150 bots; mesure au banc de charge et au banc du rendu; empreinte des parties de référence identique; bout en bout vert.

**7.7. Objets du Tactique.** Faite le 20 septembre 2026 (fiche `docs/plan/etape-7-7.md`). Étape ajoutée le 19 septembre 2026, à la demande du porteur du projet. Six objets réservés au Tactique, qui s'ajoutent aux six existants: Rafale (un tir ne coûte plus de charge), Recharge rapide, Visée large, et leurs contraires Tir unique, Recharge lente, Visée étroite, qui frappent les autres joueurs. Un bonus et le malus contraire s'annulent; les taux d'apparition baissent pour garder la même densité d'objets. Les charges s'affichent en arc sous le ninja, pour soi seul; la vue sur ordinateur passe à 500 pixels de haut; la minimap ne montre que les joueurs proches.
Tests requis: TU de chaque objet, des annulations, des recharges variables et de l'apparition; TI d'une partie Tactique à travers le vrai serveur; TU de l'arc, des icônes, de la vue et de la minimap; empreinte des parties de référence identique; bout en bout vert.

**7.8. Style des repères de localisation.** Faite le 20 septembre 2026 (fiche `docs/plan/etape-7-8.md`). Étape ajoutée le 20 septembre 2026, à la demande du porteur du projet. Les quatre triangles rouges cernés de blanc du jeu d'origine ne tiennent pas dans le style du jeu, et leur rouge se confond avec les Black Ninjas. Ils cèdent la place à une onde qui se referme: deux anneaux à la couleur du joueur, qui se resserrent sur son ninja (rendu A des maquettes). À trancher en ouvrant l'étape: la couleur en Chasse, où les traqueurs partagent une couleur, et le rayonnement, puisque les repères passent dans le calque qui rayonne.
Tests requis: TU de la géométrie et de l'opacité du repère; bout en bout vert; le reste du rendu inchangé.

### Phase 8. Cartes

**8.1. Étude des structures de carte.** Faite le 20 septembre 2026 (fiche `docs/plan/etape-8-1.md`, étude `docs/mesures/etude-structures-de-carte.md`). Étape ajoutée le 20 septembre 2026, à la demande du porteur du projet. Une note, sans code: ce qu'est techniquement une carte (image de collision et seuil de luminosité, fond et avant-plan, vignette, dimensions, miroir), ce qu'une carte doit à une partie à plusieurs (points d'apparition, distances, visibilité, goulets, densité de PNJ), trois ou quatre archétypes de structure de tailles différentes, et de quoi les juger avant de commander un décor. Le rendu visuel final serait confié au graphiste de Tokyo. Point de départ: `docs/mesures/etude-grandes-cartes.md` et les mesures de charge par carte.
Tests requis: aucun, c'est une étude. Les prototypes qu'elle proposera feront leurs propres étapes.
Résultat: les deux cartes existantes sont mesurées et se révèlent des terrains ouverts (détour médian 1,08 et 1,06, contre 1,2 à 1,7 pour une carte structurée), d'un seul tenant et sans poche isolée; un écran d'ordinateur montre 48 pour cent de Tokyo. Douze critères de jugement chiffrés, quatre archétypes, et un outil de mesure relançable (`docs/mesures/mesurer-les-cartes.mjs`, chiffres dans `cartes.json`). Le socle tient environ 12 Mpx et 1 000 PNJ sans rien changer. Cinq questions revenaient au porteur du projet, dont la taille visée, le détour visé et le sort du miroir: il y a répondu le jour même, et ses réponses sont consignées à la section 7.1 de l'étude. Les étapes 8.2 et 8.3 en découlent.

**Outillage de la phase 8, écrit le 20 septembre 2026.** La compétence `.claude/skills/conception-de-cartes/` porte l'extrait utilisable de l'étude 8.1: le contrat technique d'une carte, les douze critères de jugement, les vrais nombres du jeu, la commande qui mesure une carte, ce que chaque mode demande au terrain, et les décisions déjà prises. Elle se charge d'elle-même dès qu'une session parle d'une carte, ce qui évite de rouvrir l'étude de 280 lignes à chaque fois. Elle contient aussi `fiche-de-commande.md`, la page à remettre à un graphiste, écrite pour quelqu'un qui dessine. Elle porte aussi ce que l'étape 8.2 a appris en construisant le Quartier: une carte se calcule au lieu de se dessiner, et les trois règles de structure établies contre la mesure (pas de boulevard périphérique, des cours à une seule porte, pas de place centrale). Ce n'est pas une étape: c'est de l'outillage, écrit à la demande du porteur du projet après une recherche infructueuse de compétences de level design existantes, sur le catalogue et sur skillsmp.com.

**8.2. Carte de travail: un quartier.** Faite le 20 septembre 2026 (fiche `docs/plan/etape-8-2.md`, mesures section 9 de `docs/mesures/etude-structures-de-carte.md`). Étape ouverte le 20 septembre 2026 par les réponses du porteur du projet à l'étude 8.1 (section 7.1). Une carte jouable sans graphiste: un `collision.png` au trait, noir et blanc, qui dessine un quartier de **2400 sur 1800** visant un **détour médian de 1,20 à 1,35**, avec de vrais pâtés de maisons au lieu du mobilier de Tokyo. Elle se juge par les douze critères de la section 4 de l'étude **avant** d'y jouer, puis elle se joue à plusieurs. Le décor reste minimal, et ne se commande à un graphiste que si la structure convainc. Deux chiffres à établir dans l'étape: son plafond de PNJ (340 à 400 d'après l'étude, à confirmer par la mesure) et son détour réel, mesuré par `mesurer-les-cartes.mjs`.
Tests requis: les douze critères de l'étude verts sur la carte produite; TU des cinq endroits du code qui déclarent une carte, migration de la base comprise; TI d'une partie sur la carte nouvelle à travers le vrai serveur; mesure au banc de charge pour justifier le plafond de PNJ; les cartes existantes et l'empreinte des parties de référence inchangées; bout en bout vert.
Point de vigilance nommé par l'étude: le dégagement automatique des faux ninjas n'a jamais été éprouvé sur une carte à passages étroits.

Résultat: la carte existe, s'appelle `quartier`, et se joue. **Détour médian 1,24**, dans la cible, contre 1,08 et 1,07 aux deux cartes héritées. Les douze critères sont tenus (59,6 pour cent de jouable, un seul morceau, 93,1 pour cent hors bande d'apparition, 24 pixels au dixième le plus serré, traversée en 21,3 secondes). Plafond de 340 PNJ, déduit de la densité de Tokyo appliquée à la surface tenable mesurée, puis confirmé au banc: 1,24 ms par battement à 340 PNJ et 12 joueurs, le coût de Tokyo à 300. Elle est produite par un programme du dépôt, `docs/mesures/dessiner-le-quartier.mjs`, et non dessinée à la main. Trois enseignements de la mise au point, chacun contre une mesure: pas de boulevard périphérique, des cours à une seule porte, pas de grand vide central. Deux pièges invisibles à l'œil trouvés et fermés: une porte de cour qui donne sur le bord de la carte, et une place taillée dans l'angle d'un îlot qui laissait un point où un ninja tenait sans pouvoir sortir. Reste à faire par le porteur du projet: y jouer à plusieurs, et dire si la structure vaut un décor. Suite: `8.3`, le miroir calculé.

**8.3. Le miroir calculé.** Étape ouverte le 20 septembre 2026 par la même décision. Le miroir cesse d'être quatre images livrées à part: le serveur retourne la collision, la page retourne le décor. L'étude 8.1 a vérifié que c'est bien un simple retournement horizontal (à l'octet près pour la collision de Tokyo). Une carte ne se commande donc plus qu'une fois. **Indépendante de 8.2**, à faire avant, après, ou jamais. Réserve connue: l'avant-plan de Tokyo a été retouché à la main dans son dossier `mirror`, identique à 91 pour cent seulement, sans doute pour que les enseignes ne se lisent pas à l'envers; l'étape doit décider si l'on conserve une image livrée quand elle existe.
Tests requis: TU du retournement, côté serveur et côté page; les murs d'une carte retournée par le calcul identiques à ceux de l'image livrée aujourd'hui; l'empreinte des parties de référence en miroir inchangée; bout en bout vert.

---

## 5. Écarts assumés par rapport au plan d'origine

Consignés ici pour que la décision reste traçable.

1. **Ordre d'exécution en tranches verticales** au lieu de couches horizontales. Raison: rendre le jeu jouable au jalon 1 plutôt qu'à la vingtième étape.
2. **Base legacy: master v0.8.6** et non mode-strategique v0.9.0. Le corpus d'origine visait la v0.9.0 (vérifié: styles.css à 3 965 lignes, et huit fonctions du système de capture par cône qui n'existent que là). La v0.8.6 est Classique-seul, ce qui correspond au périmètre v1 figé le 29 juin, alors que les fiches 0.2 et 1.3 portaient le mode tactique dès la phase 1. Le mode tactique revient au jalon 5, comme mode enfichable. Note: server.js est identique entre v0.8.5 et v0.8.6, seul le client diffère.
3. **Étape 1.6 ajoutée.** Le plan d'origine ne traitait ni la validation des entrées, ni l'autorité serveur, ni la limitation de débit, alors que l'audit y a relevé des failles exploitables. La règle « caractériser sans corriger » de l'étape 0.2 est juste pour le gameplay et dangereuse pour la sécurité.
4. **2.3 conditionné à la mesure** et déplacé au jalon 4, pour respecter le principe posé en 5.2.
5. **Étape 1.7 ajoutée le 14 août 2026.** La pause de partie du legacy n'avait été portée par aucune étape de la phase 1, et l'étape 2.2 l'a découvert en relevant les événements du legacy. Elle ne pouvait pas se rattraper dans la couche réseau, qui ne contient aucune logique de jeu. Traitée selon la règle 7 de CLAUDE.md: un défaut trop gros pour l'étape en cours devient une étape à part entière, jamais une ligne de dette.
6. **5.3 et 6.1 simplifiés.** Le legacy n'a pas de joueurs en ligne: déploiement en parallèle, drapeaux de fonctionnalité et migration progressive sont sans objet.
7. **Phase 7 ajoutée le 12 septembre 2026, avec l'étape 7.1.** Le mode tactique n'avait ni numéro ni fiche. Il reçoit une phase à part plutôt qu'une place dans la phase 1: il n'est pas un portage de la base de référence, il traverse toutes les couches, et les modes suivants s'y rangeront.
8. **Les autres modes après la fin du socle**, décision du porteur du projet du 14 septembre 2026. Le jalon 5 les plaçait entre 7.1 et 5.3; ils viennent désormais après 6.1.
9. **Étape 5.4 ajoutée le 14 septembre 2026, une recette fonctionnelle.** Aucune étape n'avait déroulé le jeu entier tel qu'un joueur le vit, et le porteur du projet a cru voir des défauts, dont l'attribution aléatoire des couleurs. Elle se place avant 6.1: on ne retire pas la version d'origine sans avoir vérifié que la nouvelle la remplace.
10. **Étape 2.6 ajoutée le 15 septembre 2026, le lien perdu hors partie.** L'étape 5.4 avait rattaché à l'étape 2.5 la fragilité d'une page qui perd son lien; la fiche de l'étape 2.5 n'a traité que la partie en cours, où une place est à garder. Le reste devient une étape, conformément à la règle 7 de CLAUDE.md, plutôt qu'une ligne de dette.
