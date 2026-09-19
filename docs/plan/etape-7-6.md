# Fiche étape 7.6 - Options de partie

Brief de session. Objectif unique: deux réglages de partie demandés par le porteur du projet. Tokyo et Rainy Tokyo, qui ont le même décor, deviennent une seule carte « Tokyo », avec une option pluie dans les réglages; les parties déjà enregistrées restent lisibles. Le nombre de faux ninjas au départ dépasse 150, jusqu'à un plafond propre à chaque carte, que la mesure du serveur et du rendu justifie.

## Origine de cette fiche

Aucune fiche n'existait: l'étape a été ajoutée le 18 septembre 2026, au tri de l'étape 5.5. Elle est rédigée le 18 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée 7.6 de la section 4 du ROADMAP, et la fiche 7.5 prise comme modèle;
- l'état du dépôt au commit `5e33731`, et le handoff 7.5;
- les mesures de `docs/mesures/charge-serveur.md` (sections 11.6, 11.9, 12.3 et 12.4) et du banc du rendu de l'étape 4.2 (`tests/e2e/banc-rendu.spec.ts`);
- les décisions posées au porteur du projet le 18 septembre 2026, ci-dessous.

**Constat qui fonde la fusion**: le fond, l'avant-plan et l'image de collision de `map1` (Rainy Tokyo) et de `map2` (Tokyo) sont identiques à l'octet, en normal comme en miroir, et leurs vignettes aussi. Seule la planche de pluie les distingue.

**Ce que disaient les mesures avant de trancher.** Serveur, banc du battement, douze joueurs sur Tokyo: 0,40 ms par battement à 150 faux ninjas, 1,0 ms à 300, 2,4 ms à 500, 7,5 ms à 1 000, pour un budget de 50 ms; le coût croît à peu près comme le carré du nombre d'entités. Débit par joueur: 0,13 Mbit/s à 300, 0,22 à 500. Rendu: 60 images par seconde à 500 sprites animés sur carte graphique (étape 4.2); au processeur ralenti six fois, seules 162 entités avaient été mesurées. Spirit & Time mesure deux fois la surface de Tokyo.

**Numéro**: 7.6, dans la phase 7, « Modes de jeu ».

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (7.5, ou le handoff partiel de cette étape), cette fiche, et `.claude/rules/sim-purity.md`.

## Décisions du porteur du projet, 18 septembre 2026

1. **Un plafond par carte**: 300 faux ninjas au départ sur Tokyo, 500 sur Spirit & Time. La densité est à peu près la même sur les deux cartes.
2. **Le plafond ne dépend pas du mode.** Aucun mode ne coûte plus cher que la Horde au banc, et un seul nombre par carte se comprend mieux dans le salon.
3. **La pluie est une option de Tokyo seule, activée par défaut.** La seule planche de pluie est celle de Tokyo; l'option ne s'affiche pas sur Spirit & Time. Une partie créée sans rien changer ressemble donc à l'ancienne carte par défaut, Rainy Tokyo.
4. **L'historique affiche « Tokyo » pour les deux anciennes cartes.** La pluie n'est pas une carte, et ne s'enregistre pas.

Écartés: un plafond unique de 300 ou de 500, un plafond plus prudent de 250 et 400; un plafond plus haut en Massacre ou en Chasse; la pluie sur toutes les cartes, la pluie désactivée par défaut; « Tokyo · pluie » dans l'historique.

## Décisions prises par cette fiche

Micro-décisions au sens du PROTOCOLE. Chacune se consigne au journal de `docs/design/README.md` quand elle est construite, et se révise en exécutant si le dépôt le demande.

1. **L'identifiant `map1` devient Tokyo, et `map2` se retire.** `map1` est la carte par défaut, celle des parties de référence, des bancs et de la planche de pluie: la garder laisse l'empreinte et les mesures comparables. `map2` quitte `CARTES`, la liste des cartes jouables; elle reste dans une liste des cartes enregistrées, dont l'énumération de la base est tirée, pour que les parties déjà jouées se lisent encore. Aucune migration: l'énumération de la base ne change pas.
2. **Deux types de carte.** `IdentifiantCarte` reste la carte jouable (réglages, terrain, rendu); une carte enregistrée (`CarteEnregistree`) est ce qu'une partie terminée a pu retenir, et c'est elle que portent l'historique du profil, la table des parties et le récapitulatif de fin. La page nomme les deux anciennes cartes « Tokyo ».
3. **Les images de `map2` quittent `assets/cartes/`**: aucune carte jouable ne les lit plus, et l'historique n'en a pas besoin. Elles restent dans l'histoire du dépôt et sous l'étiquette `v0.8.6`.
4. **La pluie est un réglage de partie** (`ReglagesPartie.pluie`, vrai par défaut), à côté du mode miroir: l'hôte le choisit au salon, il voyage avec les réglages, et le moteur l'ignore. La page fait tomber la pluie quand le réglage est vrai et que la carte en a une; sur Spirit & Time le réglage reste sans effet, et l'écran des réglages le cache.
5. **Le plafond est une règle qui met deux réglages en rapport**, comme les deux durées des zones: la borne de `nombreBotsInitial` devient 10 à 500 (le plus haut des plafonds), et après complétion, le nombre de faux ninjas ne doit pas dépasser le plafond de la carte choisie (`PLAFONDS_DE_FAUX_NINJAS`, dans `packages/shared`). Le message dit le plafond de la carte.
6. **Dans l'écran des réglages**, le curseur des faux ninjas prend le plafond de la carte choisie; passer de Spirit & Time à Tokyo ramène un nombre trop haut au plafond de Tokyo, plutôt que d'afficher une erreur.
7. **Les valeurs par défaut ne changent pas**: 50 faux ninjas, Tokyo, pluie comprise. Une partie rapide se joue comme avant.
8. **Une carte retirée demandée par une page est refusée** comme toute carte inconnue: la page et le serveur sont toujours de la même version (vérification de `VERSION_DU_JEU`), aucun ancien client ne peut encore l'envoyer.
9. **L'empreinte du jeu hache l'état entier, réglages compris**: le nouveau réglage `pluie` y figure et change donc ses octets sans rien changer au jeu. La preuve que les parties de référence n'ont pas changé est l'empreinte recalculée sans ce seul champ, qui doit être identique à celle du handoff 7.5; les nouvelles références, avec le champ, se relèvent ensuite.

## Périmètre

### Lot A. Le contrat

1. **Les cartes**: `CARTES` sans `map2`, la liste des cartes enregistrées et `CarteEnregistree` (micro-décisions 1 et 2), le chemin de la pluie.
2. **Les réglages**: `pluie` (micro-décision 4), `PLAFONDS_DE_FAUX_NINJAS`, la borne élargie et la règle croisée dans `validerReglages` (micro-décision 5).

### Lot B. Le serveur et la base

1. **La base**: l'énumération tirée des cartes enregistrées, sans migration; la lecture des parties et du profil en `CarteEnregistree`.
2. **Le terrain** des seules cartes jouables; les images de `map2` retirées (micro-décision 3).
3. **Tests à travers le vrai serveur**: une partie avec pluie et sans pluie, une partie à plus de 150 faux ninjas, un réglage au-dessus du plafond refusé.

### Lot C. La page

1. **Le nom** « Tokyo » pour `map1` et pour l'ancienne `map2` (micro-décision 2), partout où il se lit.
2. **L'option pluie** dans l'écran des réglages, cachée hors de Tokyo; **le rendu** et le préchargement qui la lisent (micro-décision 4).
3. **Le curseur des faux ninjas** borné par la carte (micro-décision 6).

### Lot D. Mesure et documentation

1. **Banc de charge**: le harnais accepte `--carte`; la Horde à 150 et 300 faux ninjas sur Tokyo, à 150, 300 et 500 sur Spirit & Time, consignés dans `docs/mesures/charge-serveur.md`.
2. **Banc du rendu**: une série au processeur ralenti six fois (téléphone d'entrée de gamme), à 300 et 500 entités, pour le coût de notre propre code par image, lissage compris.
3. **Empreinte**: identique hors du champ `pluie`, puis nouvelles références (micro-décision 9).
4. **Documentation**: CLAUDE.md (le nombre de cartes, si cité), le cadrage (tension 3), le journal de conception, le ROADMAP, l'aide de la page si elle nomme les cartes.

## Hors périmètre

- Une pluie pour Spirit & Time, ou toute nouvelle carte.
- Retenir la pluie dans l'historique.
- Une grille spatiale ou toute optimisation du moteur ou du client: elle ne se fait que si la mesure l'exige, et l'étape s'arrête alors pour en faire une étape à part.
- Changer les valeurs par défaut.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Validation (TU)**: `pluie` booléen, vrai par défaut; 300 accepté sur Tokyo, 301 refusé avec le plafond dans le message; 500 accepté sur Spirit & Time, 501 refusé; la carte `map2` refusée; les autres réglages inchangés.
- **Contrat (TU)**: les cartes jouables et enregistrées; le chemin de la pluie de Tokyo; un plafond pour chaque carte jouable, jamais au-dessus de la borne.
- **Moteur (TU)**: une partie peuplée de 500 faux ninjas sur Spirit & Time, déterministe.
- **Serveur (TI)**: une partie lancée avec et sans pluie, dont le salon et le lancement portent le réglage; une partie à 300 faux ninjas sur Tokyo; un réglage au-dessus du plafond refusé au salon; une partie ancienne en `map2` lue dans le profil.
- **Client (TU)**: « Tokyo » pour les deux anciennes cartes; l'option pluie visible sur Tokyo seulement; le curseur borné et ramené au plafond; la pluie tombée selon le réglage.
- **Bout en bout**: le scénario de la pluie, avec et sans l'option; les scénarios existants.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Une partie Tokyo sans pluie, et une partie Spirit & Time à 500 faux ninjas, se créent, se jouent et s'enregistrent depuis la page.
2. Le profil d'un compte qui a joué sur Rainy Tokyo ou Tokyo se lit toujours, sous le nom « Tokyo ».
3. Les mesures du Lot D sont consignées, et ne montrent aucun dépassement: au banc, une partie à son plafond reste sous 5 ms par battement; au rendu ralenti six fois, notre code reste sous le quart du budget d'une image.
4. L'empreinte des quatre parties de référence est identique hors du champ `pluie`.
5. La couverture de `packages/sim` ne baisse pas (99,84 pour cent au handoff 7.5).

## Points de vigilance

1. **L'énumération de la base ne doit pas perdre `map2`**: une valeur retirée d'une énumération PostgreSQL rendrait illisibles les parties enregistrées. Un test de la base le fige.
2. **Le lissage de la page est en carré du nombre d'entités**: c'est lui que la mesure au processeur ralenti doit regarder en premier.
3. **La densité au départ**: 300 faux ninjas sur Tokyo; vérifier que le peuplement les place tous hors des murs.

## Réconciliation pendant l'étape (18 et 19 septembre 2026)

Écarts entre la fiche et ce qui a été construit, consignés au journal de `docs/design/README.md` quand ils touchent une décision.

1. **Micro-décision 6 révisée**: le curseur des faux ninjas n'est pas « ramené au plafond » par une règle du formulaire, ce que la décision du 14 août 2026 interdit (aucun rognage dans la conversion des valeurs). Son maximum suit la carte, et un curseur ne montre pas de valeur au-delà de son maximum: passer à Tokyo le ramène au bout de sa course, sous les yeux de l'hôte. Le composant le fait lui-même, pour ne pas dépendre du navigateur.
2. **Le récapitulatif du salon dit la pluie** (« Tokyo · Pluie »), pour que les joueurs sachent ce qui les attend; l'historique ne la retient pas, comme décidé.
3. **Le lissage de la page est corrigé dans l'étape** (règle 7): la mesure au processeur ralenti a montré qu'il coûtait 3,3 ms par image à 500 entités, par un parcours en carré. Il retrouve désormais les entités par identifiant.
4. **Le seuil du quart d'une image n'est pas atteint à 500 entités** au processeur ralenti (4,3 à 5,3 ms); il l'est à 300. Le porteur du projet a choisi de garder 500 et d'optimiser dans une étape à part, `5.7`. Le banc exige en continu le plafond existant du coût propre (8 ms), et consigne les valeurs.
5. **La série téléphone du banc du rendu a sa propre composition** (douze joueurs, le reste en faux ninjas) et un échauffement d'une seconde par charge; la série d'origine garde la sienne pour rester comparable.
6. **Le harnais de charge gagne `--carte`**, et son rapport retient le mode et la carte mesurés.
7. **Deux étapes nouvelles demandées par le porteur du projet en cours de session**, `4.5` (textes de présentation du menu principal) et `5.6` (référencement), inscrites au ROADMAP sans être commencées.

## Rituel de fin de session

Écrire `docs/handoffs/etape-7-6-handoff.md`: les décisions construites, les écarts à cette fiche, les mesures, l'empreinte, l'état de la CI. Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP. Commiter.
