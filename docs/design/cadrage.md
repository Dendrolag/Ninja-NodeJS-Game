# Cadrage fonctionnel v1 - Neon Ninja

Produit par l'étape 0.3, le 10 septembre 2026. Consommé par l'étape 2.4, le jalon 3 (étapes 3.1, 3.2, 3.3 et la reprise des écrans de 4.3), et le jalon 5 pour le principe des modes.

## Comment lire ce document

- **C'est un instantané consolidé.** Le journal ouvert de la conception reste `docs/design/README.md`: chaque décision prise ici y est consignée avec sa date et sa raison. Toute évolution ultérieure met à jour les deux.
- **Les maquettes sont des propositions, pas une spécification.** Consigne du porteur du projet du 13 août 2026, rappelée en tête du README. Rien n'est repris au seul motif que la maquette le montre.
- **Ce cadrage part du jeu qui tourne.** L'étape 0.3 a été exécutée après le jalon 1: le moteur, le serveur, le contrat de réglages et quatre écrans existent déjà. Là où la maquette et le jeu réel divergent, le jeu réel est le point de départ, et l'écart est instruit.
- **Aucun code, aucun schéma implémenté ici.** Les formes décrites sont des contrats à construire dans les étapes citées.

## 1. Tri de périmètre v1

Le périmètre validé le 29 juin 2026 est repris tel quel, et précisé pour chaque élément que la maquette propose.

| Catégorie                                          | Élément                                                                   | Étape                   |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| **Construire en v1**                               | Mode Classique                                                            | Fait (phase 1)          |
|                                                    | Mode Tactique, capture par cône (jalon 5)                                 | Fait (7.1)              |
|                                                    | Création de partie, publique ou privée par code d'invitation              | 2.4, écran au jalon 3   |
|                                                    | Navigateur des parties publiques et « Partie rapide »                     | 2.4, écran au jalon 3   |
|                                                    | Salon: joueurs, hôte, réglages, chat, lancement                           | Fait (4.3), étendu 2.4  |
|                                                    | Comptes et authentification                                               | 3.1, 3.2                |
|                                                    | Progression de base: niveau, XP, pièces, points de ligue, palier de rang  | 3.1, 3.3                |
|                                                    | Historique des parties d'un compte                                        | 3.1, 3.3                |
|                                                    | Profil réduit et fin de partie enrichie                                   | Jalon 3                 |
| **Modéliser de façon extensible, sans construire** | Pass de saison, skins, clans                                              | Points d'extension, 3.1 |
| **Reporter entièrement**                           | Les autres modes: Chasse, Battle Royale, Équipes, Chaos                   | Jalon 5                 |
|                                                    | Pass de saison, boutique de skins, clans                                  | Après la v1             |
|                                                    | Échelle de ligue détaillée, appariement par niveau, rang mondial          | Après la v1             |
|                                                    | Gemmes (monnaie premium)                                                  | Avec une boutique       |
|                                                    | Défis du jour                                                             | Après la v1             |
|                                                    | Succès                                                                    | Après la v1             |
|                                                    | État « prêt » des joueurs du salon                                        | À réévaluer à l'usage   |
|                                                    | Latence affichée par salon                                                | Avec plusieurs régions  |
| **Écarté**                                         | Un « mode Miroir » distinct: le miroir est un réglage de carte (tension 1) | Sans objet              |
|                                                    | Le bouton « Terminer » du HUD (tension 7, tranchée à l'étape 4.3)          | Sans objet              |

**Règle d'affichage, décision du 29 juin 2026**: ce qui est reporté est masqué entièrement, jamais grisé. Les modes à venir sont regroupés en une seule tuile « à venir » à la création.

## 2. Décisions sur les tensions et les questions ouvertes

Les neuf tensions et les huit questions ouvertes du README sont l'entrée de cette étape. Le détail et les raisons sont au journal du README, daté du 10 septembre 2026.

| Point                                | Décision                                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tension 1, le miroir                 | **Un réglage de carte, pas un mode.** Le legacy le charge comme une variante de ressources de chaque carte (`legacy/js/MapManager.js`, dossiers `normal` et `mirror`), et le contrat actuel le porte en `modeMiroir`. Le mode « Miroir » de la maquette disparaît; ses « contrôles inversés » existent déjà, comme malus. |
| Tension 2, six modes                 | Un seul mode jouable. Les propositions Chasse, Battle Royale, Équipes et Chaos ne sont pas validées: tuile unique « à venir ».                                                                                                                                  |
| Tension 3, quatre cartes             | Trois cartes: map1 Rainy Tokyo et map2 Tokyo (2000 × 1500), map3 Spirit & Time (3000 × 2000), réconciliées avec `MAP_DIMENSIONS` du legacy. Shibuya Cross reportée.                                                                                          |
| Tension 4 et question 8, faux ninjas | **10 à 150, 50 par défaut**, les bornes du serveur actuel, qui sont celles du salon du legacy. La fourchette de la maquette (10 à 80, défaut 40) est écartée: elle contredit l'objectif de plus de 100. Le nombre est choisi par l'hôte, il ne s'adapte ni aux joueurs ni à la carte. La borne haute pourra monter si la mesure de l'étape 5.1 le permet. |
| Tension 5, profil                    | Profil réduit: identité, niveau, palier, pièces, statistiques simples, historique. Voir l'inventaire.                                                                                                                                                         |
| Tension 6, latence par salon         | **Retirée en v1.** Toutes les parties tournent sur le même serveur: la latence serait la même pour chaque salon, donc une colonne sans information. À concevoir si le jeu passe à plusieurs régions.                                                          |
| Tension 7, « Terminer »              | Tranchée à l'étape 4.3: Quitter pour soi, Pause pour l'hôte.                                                                                                                                                                                                  |
| Tension 8, framework                 | Confirmée à l'étape 4.3: DOM pour les menus, PixiJS pour le jeu.                                                                                                                                                                                              |
| Tension 9, jetons                    | Repris à l'étape 4.3.                                                                                                                                                                                                                                         |
| Question 1, contrôles mobiles        | Tranchée aux étapes 4.2 et 4.4: manette au pouce, aucune zone de capture en Classique.                                                                                                                                                                        |
| Question 2, gemmes                   | **Ni affichées ni stockées en v1.** Rien ne les gagne ni ne les dépense, et une monnaie premium suppose des achats, hors périmètre. Elles arrivent avec une boutique, par ajout.                                                                             |
| Question 3, rang                     | **Le palier se déduit des points de ligue**, par une table de seuils, sans appariement par compétence. Seuls les points sont stockés. Les seuils et les gains se fixent à l'étape 3.3.                                                                       |
| Question 4, modes et capacités       | Tuile unique « à venir ». Capacité du Classique: **12 joueurs**, la borne haute de la maquette; **1 joueur suffit pour lancer**, comme dans le legacy. Les fourchettes des autres modes ne sont pas retenues.                                                  |
| Question 5, cartes                   | Tranchée le 29 juin 2026, voir la tension 3.                                                                                                                                                                                                                  |
| Question 6, libellés du HUD          | Tranchée à l'étape 4.2: Boost (vitesse), Invincibilité, Révélation, Contrôles inversés, Vision floue, Vision négative, et les quatre zones (chaos, répulsive, attractive, invisibilité). Une seule table, `APPARENCE_OBJET` et `APPARENCE_ZONE` du client.     |
| Question 7, défis du jour            | **Reportés.** Les blocs de défis de l'accueil et de la fin de partie sont masqués, et aucune table n'est créée.                                                                                                                                              |

## 3. Inventaire des écrans

Sept écrans dans la maquette. Pour chacun: son statut en v1, les données qu'il affiche, et d'où elles viennent. « Existant » désigne ce que l'étape 4.3 a construit; le reste est à construire à l'étape indiquée.

### En-tête commun

- **v1**: marque, libellé d'écran, et, une fois connecté (3.2), niveau avec sa progression, pseudo, palier et pièces. Construit au jalon 3; un invité y trouve « Se connecter ».
- **Navigation latérale**: reprise au jalon 3, ses quatre destinations existant (Jouer, Parties, Créer, Profil). Proposée hors partie seulement, repliée en barre en fenêtre étroite (décision du 11 septembre 2026).
- **Écarté**: pastille de gemmes.

### 1. Accueil

- **Statut**: v1 réduit. Construit (4.3), enrichi au jalon 3: « Partie rapide », « Créer une partie », « Parcourir », et pas de pseudo à choisir pour un compte.
- **Données v1**: pseudo et niveau du compte; boutons « Partie rapide », « Créer une partie », « Parcourir »; présentation du mode Classique et tuile « à venir »; règles du jeu (existant).
- **Masqué**: bandeau de saison, défis du jour, pass de saison, grille des six modes.
- **« Partie rapide »**: rejoindre la première partie publique encore dans son salon et non pleine, ou en ouvrir une publique aux réglages par défaut s'il n'y en a aucune. C'est la règle provisoire du jalon 1, restreinte aux parties publiques.

### 2. Parties publiques

- **Statut**: v1. Données au 2.4, écran construit au jalon 3. La liste se redemande à chaque arrivée sur l'écran et sur demande.
- **Données v1, par salon listé**: pseudo de l'hôte, mode, carte (nom, et « Miroir » le cas échéant), joueurs présents sur capacité, et l'action « Rejoindre ».
- **Liste**: seulement les parties publiques dans leur salon et non pleines. Champ de code privé, bouton « Créer ».
- **Écarté**: latence, compteur global de joueurs en ligne, filtres par mode (deux modes, dont le nom figure sur chaque ligne), statut « En jeu » (une partie commencée n'est pas listée).

### 3. Créer une partie

- **Statut**: v1 réduit. Écran construit au jalon 3; le formulaire du panneau de réglages du salon (4.3) s'y réutilise, réglages avancés repliés.
- **Données v1**: mode (une tuile par mode jouable, Classique choisi d'abord, Tactique depuis l'étape 7.1; tuile « à venir »); carte parmi trois, avec l'aperçu et le mode miroir; visibilité publique ou privée; durée, faux ninjas, Black Ninjas, bonus, malus, zones (tout le contrat de la section 4); récapitulatif avec la capacité déduite du mode.
- **Écarté**: Shibuya Cross, les quatre tuiles de mode proposées par la maquette et non validées (Chasse, Battle Royale, Équipes, Chaos), et la tuile « Miroir », qui est un réglage de carte.

### 4. Salon

- **Statut**: v1. Existant (4.3), données étendues au 2.4, écran étendu au jalon 3: visibilité, code avec bouton de copie, places libres dites en texte (sans dessiner les emplacements vides de la maquette).
- **Données v1**: titre « Salon de {hôte} »; comment on capture dans le mode de la partie (7.1); visibilité et, si privée, le code d'invitation avec un bouton de copie; joueurs présents (pseudo, initiales, badge d'hôte, niveau dès 3.2); places libres sur la capacité; récapitulatif des réglages; chat; compte à rebours annulable; « Lancer » et « Réglages » pour l'hôte; « Quitter ».
- **Écarté en v1**: l'état « prêt ». L'hôte lance, et le compte à rebours de cinq secondes, annulable jusqu'à deux (comportement à préserver 7), sert de préavis. À réévaluer si des parties publiques entre inconnus le réclament.

### 5. Jeu en cours

- **Statut**: v1. Existant (4.2, 4.3); enrichi à l'étape 7.1 pour le mode Tactique: cône de visée devant son ninja, éclair de chaque tir, bouton « Capturer » portant les charges, barre d'espace.
- **Données**: temps restant; classement en direct; effets actifs sur soi avec leur reste; minimap des joueurs; localisation; Pause et Reprendre pour l'hôte; Quitter. En Tactique, l'orientation et les charges de chaque joueur (flux d'état, `JoueurVu.tactique`) et l'annonce de chaque tir (`tirDeCapture`).
- **Écarté**: « Terminer ».

### 6. Fin de partie

- **Statut**: v1, enrichi au jalon 3. Le classement s'affiche aussitôt; la progression le rejoint quand le serveur l'a écrite, « Enregistrement de la partie… » en attendant, ou le motif d'un échec.
- **Données existantes**: contexte (mode, carte), place, podium, classement complet (points, ninjas, captures, Black Ninjas), Rejouer, Accueil.
- **Données ajoutées (3.3)**: XP gagnée, niveau avant et après avec sa barre, pièces gagnées, variation des points de ligue, palier avant et après. **Fournies depuis l'étape 3.3** par le message `progressionDeFin` (`ProgressionDeFin`, `packages/shared/src/evenements.ts`), adressé à chaque compte présent à la fin, après `partieTerminee`; la barre se calcule par `avancementDuNiveau`. Un invité n'a que le classement.
- **Masqué**: défi accompli.

### 7. Profil

- **Statut**: v1 réduit, construit au jalon 3. Route `GET /api/comptes/profil` (`ProfilDuCompte`); les dix dernières parties; une victoire est une première place dans une partie d'au moins deux joueurs (décision du 11 septembre 2026). Un invité est mené à la connexion.
- **Données v1**: pseudo, date d'inscription, niveau et XP, palier et points de ligue, pièces; statistiques déduites de l'historique (parties jouées, victoires, meilleur score); dernières parties (mode, carte, placement, score, gains, date).
- **Masqué**: pass de saison, skins, succès, clan, gemmes, rang mondial, ratio, meilleure série, temps de jeu, ninjas capturés au total.

## 4. Contrat de configuration de partie

Entrée de l'étape 2.4 et du moteur. **Il étend le contrat qui tourne déjà**, `ReglagesPartie` (`packages/shared/src/reglages.ts`), borné par `BORNES_REGLAGES` (`bornes.ts`) et validé par `validerReglages`. Une valeur hors bornes est refusée, jamais rognée (décision du 14 août 2026).

### 4.1 Ce qui se choisit à la création, et ne change plus ensuite

| Champ        | Type                      | Défaut      | Règle                                                                                                                                                        |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`       | `'classique'` ou `'tactique'` | `classique` | Le Tactique depuis l'étape 7.1. **Figé à la création**: changer de mode pourrait changer la capacité, et exclure des joueurs déjà présents.                  |
| `visibilite` | `'publique'` ou `'privee'` | `publique`  | **Figée à la création**, pour qu'une partie ne disparaisse pas du navigateur sous les yeux de ceux qui la rejoignent.                                       |
| code         | texte, 6 caractères        | aucun       | **Fabriqué par le serveur** pour une partie privée, jamais fourni par le client. Retenu à l'étape 2.4: majuscules et chiffres, sans les caractères ambigus (O, 0, I, 1), tiré par `node:crypto` et unique parmi les parties ouvertes (`BORNES_CODE_INVITATION`). |
| capacité     | entier, déduit du mode     | 12          | **Pas un champ**: une propriété du mode. Classique: 12 au plus, 1 pour lancer.                                                                               |

### 4.2 Ce que l'hôte règle dans le salon, avant le lancement

C'est `ReglagesPartie`, sans changement. Les défauts sont ceux du legacy.

| Champ                                        | Type    | Défaut   | Bornes   |
| -------------------------------------------- | ------- | -------- | -------- |
| `carte`                                      | `map1`, `map2` ou `map3` | `map1` | trois cartes |
| `modeMiroir`                                 | booléen | faux     |          |
| `dureePartieS`                               | entier  | 180      | 30 à 600 |
| `nombreBotsInitial` (faux ninjas)            | entier  | 50       | 10 à 150 |
| `botsNoirs.actifs`                           | booléen | vrai     |          |
| `botsNoirs.nombre`                           | entier  | 2        | 1 à 5    |
| `botsNoirs.momentApparitionPourCent`         | entier  | 50       | 0 à 100  |
| `botsNoirs.rayonDetectionPx`                 | entier  | 150      | 50 à 500 |
| `botsNoirs.partDeBotsPerduePourCent`         | entier  | 50       | 0 à 100  |
| `bonus.intervalleApparitionS`                | entier  | 4        | 2 à 20   |
| `bonus.types.{vitesse, invincibilite, revelation}.actif` | booléen | vrai |      |
| `bonus.types.*.dureeS`                       | entier  | 10       | 5 à 30   |
| `bonus.types.{vitesse, invincibilite, revelation}.tauxApparitionPourCent` | entier | 25, 15, 20 | 5 à 100 |
| `malus.actifs`                               | booléen | vrai     |          |
| `malus.intervalleApparitionS`                | entier  | 8        | 4 à 30   |
| `malus.tauxApparitionPourCent`               | entier  | 20       | 5 à 100  |
| `malus.types.{controlesInverses, flou, negatif}.actif` | booléen | vrai |        |
| `malus.types.{controlesInverses, flou, negatif}.dureeS` | entier | 10, 12, 14 | 5 à 30 |
| `zones.actives`                              | booléen | vrai     |          |
| `zones.dureeMinimumS`                        | entier  | 10       | 5 à 120, au plus la maximale |
| `zones.dureeMaximumS`                        | entier  | 30       | 5 à 120  |
| `zones.intervalleApparitionS`                | entier  | 15       | 5 à 120  |
| `zones.types.{chaos, repulsion, attraction, invisibilite}` | booléen | vrai |      |

### 4.3 Correspondance avec la maquette

| Maquette                    | Contrat                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Mode                        | `mode`                                                                                      |
| Carte (quatre)              | `carte` (trois) et `modeMiroir`                                                             |
| Visibilité                  | `visibilite`, et le code fabriqué par le serveur                                            |
| Durée, 60 à 600, défaut 180 | `dureePartieS`, **30** à 600, défaut 180: la borne basse du salon du legacy est conservée   |
| Faux Ninjas, 10 à 80, défaut 40 | `nombreBotsInitial`, 10 à **150**, défaut **50**                                        |
| Interrupteur Black Ninjas   | `botsNoirs.actifs`, et quatre réglages de plus                                              |
| Bonus 3/3, Malus 3/3, Zones 4/4 | Le résumé des interrupteurs de `bonus.types`, `malus.types` et `zones.types`             |
| Capacité 4-12 J             | Capacité déduite du mode: 12, et 1 pour lancer                                              |

Chaque champ de la maquette a donc sa place; le contrat en porte davantage, parce que le salon du legacy en exposait davantage.

## 5. Forme des données de progression

Entrée de l'étape 3.1. **Principe, le même que pour le score depuis le 14 août 2026: ce qui se déduit ne se stocke pas.** Le niveau se déduit de l'XP totale, le palier se déduit des points de ligue. Stocker les deux reviendrait à tenir deux vérités à jour à la main (défaut X11 de l'audit).

### Compte

| Champ               | Forme                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| identifiant         | Opaque, fabriqué par le serveur                                                     |
| pseudo              | Unique, comparé sans distinction de casse après normalisation, règles de `BORNES_PSEUDO` (1 à 20 caractères, liste blanche) |
| date d'inscription  | Horodatage                                                                          |
| mot de passe haché  | Ajouté à l'étape 3.2, dans une table à part `mots_de_passe` (empreinte scrypt) |

### Progression, une par compte

| Champ              | Forme                        | Remarque                                                |
| ------------------ | ---------------------------- | ------------------------------------------------------- |
| XP totale          | Entier positif ou nul        | Le niveau et l'XP dans le niveau s'en déduisent         |
| pièces             | Entier positif ou nul        |                                                         |
| points de ligue    | Entier positif ou nul        | Le palier de rang s'en déduit                           |
| mise à jour        | Horodatage                   |                                                         |

Les règles de déduction (seuils de niveau, seuils de palier) et les règles de gain (XP, pièces, points par placement) sont des fonctions pures, écrites dans `packages/shared/src/progression.ts` à l'étape 3.3, pour que serveur et client calculent la même chose. Valeurs validées par le porteur du projet le 11 septembre 2026:

| Règle              | Valeur                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| XP d'une partie    | 10 XP par minute passée en partie, plus 20 XP par minute par joueur devancé au classement final          |
| Pièces             | Un dixième de l'XP gagnée, arrondi en dessous                                                            |
| Niveaux            | Passer du niveau n au niveau n + 1 coûte 100 × n XP                                                      |
| Points de ligue    | +20 au premier, -10 au dernier, en ligne droite; 2 joueurs et 3 minutes au moins; jamais sous zéro       |
| Paliers            | Bronze 0, Argent 100, Or 300, Platine 600, Diamant 1 000                                                 |
| Abandon            | Compté dernier: aucune XP ni pièce, la perte de points de ligue du dernier                               |

Les gains s'ajoutent à la progression dans la transaction qui enregistre la partie et les résultats. Une partie jouée uniquement par des invités n'est pas enregistrée.

### Résultat de partie, un par compte et par partie

| Champ                          | Forme                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| identifiant                    | Opaque                                                       |
| compte                         | Lien vers le compte                                          |
| partie                         | Identifiant commun aux résultats d'une même partie           |
| mode, carte, mode miroir       | Tels que joués                                               |
| durée de la partie             | En secondes                                                  |
| placement et nombre de joueurs | Entiers                                                      |
| points, captures, Black Ninjas détruits | Tirés du classement final (`LigneClassement`)       |
| XP gagnée, pièces gagnées      | Entiers positifs ou nuls                                     |
| variation des points de ligue  | Entier signé                                                 |
| fin de partie                  | Horodatage                                                   |

Ce que les écrans v1 lisent, et d'où: le profil lit le compte, la progression et l'historique; ses statistiques (parties jouées, victoires, meilleur score) se déduisent des résultats. La fin de partie lit le résultat de la partie et la progression avant et après.

### Points d'extension, prévus mais non construits

Chaque fonctionnalité reportée s'ajoutera par **de nouvelles tables qui référencent le compte**, sans colonne ajoutée aux tables v1:

- pass de saison: une saison, ses paliers, et la progression d'un compte dans une saison;
- skins: les skins, leur possession par un compte, et celui qui est équipé;
- clans: les clans, et l'appartenance d'un compte;
- gemmes: un solde, avec la boutique qui les rend utiles;
- succès et défis du jour: leur définition, et leur accomplissement par un compte.

Aucune de ces tables n'est créée en v1.

## 6. Principe des modes

Décision du 29 juin 2026, précisée ici.

- **Un mode est un jeu de règles enfichable.** Le moteur reste agnostique: il fait avancer le monde, et délègue au mode ce qui les distingue. La capacité est une propriété du mode.
- **Le Classique est le premier jeu de règles.** Il capture par simple proximité.
- **Le point d'extension existe.** Chaque mode fournit un jeu de règles, `JeuDeRegles` (`packages/sim/src/moteur.ts`): ce qu'il fait des entrées du battement avant le relevé des contacts (`agir`), et ce que produisent les contacts relevés (`resoudreContacts`, une `RegleDeResolution` de `packages/sim/src/contacts.ts`). Le mode voyage dans l'état de la partie (`EtatPartie.mode`), et `tick` choisit son jeu de règles dans `REGLES_DES_MODES`, une table indexée par tous les modes du contrat: oublier les règles d'un mode ajouté est une erreur de compilation. Branché avec le champ `mode` de la configuration à l'étape 2.4; élargi à l'étape 7.1, parce qu'un tir n'est pas un contact. Un mode qui retient quelque chose de ses joueurs le range à part dans l'état (`EtatPartie.tactique` pour le Tactique): l'état des autres modes n'en porte aucune trace.
- **Ajouter un mode est un ajout, pas une refonte**: une valeur d'énumération, sa capacité, son jeu de règles. Le contrat de configuration est l'interface stable.
- **Le miroir n'est pas un mode** (tension 1). Il se combine avec n'importe quel mode, sans combinatoire.
- **Le premier ajout prévu est le mode tactique** (capture par cône), au jalon 5: étape 7.1. Ses règles ont été tranchées par le porteur du projet le 12 septembre 2026: le cône seul capture, avec les valeurs de la v0.9.0 (90 degrés, 100 pixels, cinq charges, une charge toutes les cinq secondes, tir sans effet gratuit); un joueur vise dans la direction de son dernier déplacement; un bouton dédié sert au tactile. Détail et raisons dans `docs/plan/etape-7-1.md` et au journal de `docs/design/README.md`.

## 7. Renvois

| Partie du cadrage               | Alimente                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Tri de périmètre             | Toutes les étapes restantes                                                                          |
| 2. Décisions                    | 2.4 (capacité, latence, état prêt), 3.1 (gemmes, déductions), 3.3 (palier, défis), jalon 3 (écrans)  |
| 3. Inventaire des écrans        | 2.4 (données du navigateur et du salon), jalon 3 (reprise des écrans de 4.3), 3.3 (fin de partie)    |
| 4. Contrat de configuration     | 2.4 (création, visibilité, code, capacité, validation), le moteur (mode)                             |
| 5. Données de progression       | 3.1 (schéma), 3.2 (compte), 3.3 (règles de gain et de déduction, récapitulatif de fin)               |
| 6. Principe des modes           | 2.4 (branchement du mode), jalon 5 (mode tactique)                                                   |

## 8. Questions laissées au porteur du projet

Elles engagent le produit au-delà de ce que les maquettes et le périmètre du 29 juin permettent de trancher. Elles sont à décider avant l'étape indiquée.

1. **Peut-on jouer sans compte ? Tranché le 11 septembre 2026 par le porteur du projet: oui.** On entre en invité avec un pseudo, comme aujourd'hui; le compte est optionnel et n'apporte que la progression. Un résultat de partie n'est enregistré que pour un joueur qui a un compte, ce que le schéma de l'étape 3.1 prévoit déjà. Détail et conséquences au journal de `docs/design/README.md`, et dans la fiche 3.2, récrite en conséquence.
2. **Les valeurs des récompenses. Tranché le 11 septembre 2026 par le porteur du projet, à l'étape 3.3.** XP au temps joué et aux joueurs devancés, pièces au dixième de l'XP, niveau n + 1 à 100 × n XP, points de ligue de +20 à -10 selon la place, cinq paliers, abandon compté dernier. Le tableau est dans la section 5, le détail et les raisons au journal de `docs/design/README.md`.
