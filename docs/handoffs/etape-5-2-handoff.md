# Handoff - Étape 5.2 Optimisations validées par la mesure

Date: 12 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Appliquer les optimisations utiles, et seulement celles que les mesures de l'étape 5.1 justifient: partir d'un point chaud mesuré, appliquer, remesurer dans les mêmes conditions, ne garder que ce qui gagne, sans jamais changer le jeu.

## Ce qui a été fait

- **Diagnostic des deux questions ouvertes de 5.1**, au profileur de V8 puis par mesure comparée:
  - **populations mêlées**: `avancerLesBots` rangeait chaque bot en recopiant toute la table des bots, un travail en carré de la population que V8 exécute quarante fois plus lentement après une partie plus petite;
  - **perte de cadence avant un fil plein**: `setInterval` repart de l'instant où son rappel a commencé, et perd donc pour de bon chaque retard pris derrière les autres parties et les fins d'écriture réseau.
- **Trois optimisations retenues**, chacune mesurée seule:
  1. la table des bots copiée une fois par battement (`packages/sim/src/bots.ts`);
  2. le relevé des contacts sans tableau par entité, avec un tri par axe exactement équivalent (`packages/sim/src/contacts.ts`);
  3. la boucle d'une partie qui vise l'heure prévue (`rappelSuivant`, `packages/server/src/horloge.ts`).
- **Preuve que le jeu n'a pas changé**: tests du moteur au vert, et empreinte de quatre longues parties déterministes identique à l'octet, relevée sur le code de 5.1 puis après chaque optimisation. L'outil est conservé: `tests/charge/empreinte.ts`.
- **Mesure de référence complète** après optimisation (`pnpm charge --sortie docs/mesures/charge-serveur-5-2.json`), dans les conditions de 5.1, et section 11 du rapport, datée.
- **Mesure sous Linux**, 5.1 et 5.2 sur la même machine d'intégration, par un nouveau workflow (`.github/workflows/charge.yml`).
- **Mesure du coût du client**, confiée à 5.2 par le handoff de 5.1: décodage et coût par image dans Chromium au processeur ralenti, poids de la page.
- **Seuils de référence mis à jour** (section 11.11 du rapport), journal des décisions, ROADMAP, fiches 5.2 et 2.3.

## Les chiffres clés

Machine de mesure: AMD Ryzen 7 3800X (8 cœurs, 16 fils), Windows 11 Pro, Node.js 24.16.0, comme en 5.1.

| Grandeur                                      | 5.1                 | 5.2                           |
| --------------------------------------------- | ------------------- | ----------------------------- |
| Battement du banc, 150 bots, 12 joueurs       | 0,77 ms             | 0,43 ms                       |
| Battement du banc, 1000 bots                  | 19,9 ms             | 7,8 ms                        |
| Populations mêlées, 150 après 50              | × 2,70              | × 1,01                        |
| Processeur par partie pleine, vrai serveur    | 1,92 ms             | 0,95 ms                       |
| Parties pleines tenues par processus          | 16 (24 non)         | 48 (64 non, fil plein)        |
| Parties mêlées tenues par processus           | 24 (32 à la limite) | 64 (96 non, fil plein)        |
| Fréquence à 48 parties pleines                | non jouée           | 20,0 Hz, fil à 84 %           |
| Taille d'un instantané, partie de référence   | 21 518 octets       | 21 518 octets, inchangée      |
| Client, décoder un instantané, processeur × 6 | non mesuré          | 0,48 ms                       |
| Client, notre code par image, processeur × 6  | non mesuré          | 1,2 ms, 60 images par seconde |

Sous Linux (EPYC 7763, 4 cœurs): 24 parties pleines non tenues en 5.1 (17,6 Hz, fil à 79 %), tenues en 5.2 (20,0 Hz, fil à 49 %); processeur par partie 1,96 puis 1,08 ms.

Détail de chaque gain, tableaux complets et reproductibilité: section 11 de `docs/mesures/charge-serveur.md`.

## Fichiers créés ou modifiés

Créés

- `tests/charge/empreinte.ts`: l'outil qui résume quatre parties déterministes à chaque battement, pour prouver qu'une optimisation ne change rien au jeu.
- `.github/workflows/charge.yml`: la mesure de charge sous Linux, lancée en poussant une branche `mesure-charge/` dont le dernier commit nomme les commits à mesurer.
- `docs/mesures/charge-serveur-5-2.json`: les chiffres bruts de la mesure de référence.
- `docs/mesures/5-2/`: les mesures intermédiaires (chaque optimisation seule, `setInterval` contre heure prévue) et les deux mesures sous Linux.
- `docs/handoffs/etape-5-2-handoff.md`.

Modifiés

- `packages/sim/src/bots.ts`: `avancerLesBots` copie la table des bots une fois par battement.
- `packages/sim/src/contacts.ts`: `detecterContacts` sans tableau par entité, avec le tri par axe `horsDePortee`.
- `packages/server/src/horloge.ts`: `rappelSuivant`, et l'horloge du système en suite de minuteries simples visant l'heure prévue.
- `packages/sim/src/contacts.test.ts`, `packages/sim/src/moteur.test.ts`, `packages/server/src/horloge.test.ts`: les tests des trois changements (voir Tests).
- `.github/workflows/ci.yml`: la CI ordinaire ignore les branches `mesure-charge/`.
- `tests/charge/battement.test.ts`, `battement-isole.ts`, `charge-reseau-isolee.ts`: commentaires qui citaient comme actuels des chiffres que 5.2 a changés.
- `docs/mesures/charge-serveur.md`: section 11, et renvois depuis les sections de 5.1.
- `docs/design/README.md`: cinq décisions du 12 septembre 2026.
- `docs/plan/etape-5-2.md`: résultat et réconciliation, sept points.
- `docs/plan/etape-2-3.md`: note d'après 5.2, dont la question du filtrage par zone d'intérêt.
- `docs/plan/ROADMAP.md`: section 3, jalon 4, résultat de 5.2.
- `CLAUDE.md`: la ligne de `tests/charge/`, avec l'outil d'empreinte et la mesure sous Linux.

Aucune modification de `packages/client`, `packages/shared`, `legacy/`, `tests/caracterisation/` ni `tests/e2e/`. Aucune migration.

## Tests

- Ajoutés:
  - `contacts.test.ts`, quatre tests: le relevé comparé à la comparaison naïve de toutes les distances dans une mêlée de 92 entités (mêmes paires, même ordre, mêmes distances); une paire proche sur les deux axes jugée à la distance; le seuil appliqué des deux côtés de chaque axe; une position non numérique qui ne touche personne.
  - `moteur.test.ts`: une partie de 600 battements, 60 bots, 4 joueurs, bots noirs et zones, dont chaque état est gelé en profondeur avant de passer au moteur: une écriture dans un état reçu lèverait une erreur.
  - `horloge.test.ts`, huit tests: `rappelSuivant` (échéance prévue, fréquence exacte sur mille rappels en retard, reprise sans rafale après un gel, délai arrondi et jamais nul), et l'horloge du système sous minuteries simulées (cadence, arrêt, arrêt depuis le rappel, aucune minuterie laissée).
- Comparaison avant après chiffrée pour chaque optimisation, dans les conditions de 5.1: section 11.5 du rapport.
- Empreinte des parties identique sur le code de 5.1 et après chaque optimisation.
- Résultat: **1 524 tests sur 1 524** par `pnpm verify`, dont 399 du moteur. Types, linter et formatage: verts.
- Couverture de `packages/sim` et `packages/shared`: **99,77 pour cent**, inchangée (99,77 au handoff de la reprise des écrans du jalon 3); `sim` seul à 99,63, `contacts.ts` et `moteur.ts` à 100 pour cent.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Cinq décisions au journal de `docs/design/README.md`, datées du 12 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation ». Quatre points à lire ici.

### 1. Le moteur peut remplir une copie de travail avant de la rendre

La règle « rien n'est modifié sur place » vise ce que le moteur reçoit. `avancerLesBots` écrit dans une copie neuve de la table des bots, que personne d'autre ne détient, puis la rend. Le test de gel en profondeur rend impossible le retour d'une écriture dans un état reçu. Changer la forme de l'état (tables `Map`) a été écarté: tout le moteur pour un gain que la copie unique donne déjà.

### 2. Le tri par axe est exact, pas approché

Une paire éloignée d'au moins 20 pixels sur un axe est écartée sans calcul de distance, parce que `Math.hypot` ne rend jamais moins que le plus grand des deux écarts. Les paires restantes sont jugées exactement comme avant, et la distance rangée dans le contact est la même. Une grille spatiale aurait demandé de retrier les paires pour garder l'ordre du relevé, dont dépend le rejeu: inutile aux bornes actuelles.

### 3. La boucle vise l'heure prévue

Chaque battement programme le suivant à l'échéance précédente plus 50 ms. Un retard d'un intervalle ou plus repart de maintenant, sans rafale; le moteur reçoit de toute façon le temps réellement écoulé, donc le jeu n'en dépend pas. Le palier ne bouge pas, la fréquence reste à 20 Hz jusqu'au fil plein. À saturation, les écarts sont un peu plus irréguliers qu'avec `setInterval`: sans effet sur un palier tenu.

### 4. Ce que la mesure écarte

Grille spatiale (contacts à 0,15 ms à 150 bots), niveau de détail d'IA (jamais dominant), optimisation du client (section 11.9), et filtrage par zone d'intérêt, reporté à la fin de 2.3 dont le format décide du gain.

### Ce que cette étape rend structurellement impossible

- **Une optimisation qui change le jeu sans qu'on le voie**: l'empreinte de quatre longues parties se compare avant et après, en une commande.
- **Une écriture du moteur dans un état reçu**: chaque état d'une longue partie est gelé avant de lui être passé, en test.
- **Une dérive de la cadence des parties par accumulation des retards**: l'échéance se compte depuis l'échéance précédente, et un test vérifie la fréquence exacte sur mille rappels en retard.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Le filtrage du flux par zone d'intérêt reste une question**, à trancher par la mesure en fin d'étape 2.3 (note de la fiche 2.3).
- **Le relevé des contacts reste en carré du nombre d'entités**: sans enjeu jusqu'à 150 bots, 7,1 ms de moteur à 1000 bots. Si les bornes du salon montent, la grille spatiale redevient la candidate.
- **Le lissage du client cherche la position précédente de chaque entité par un parcours complet** (`positionPrecedente`, `packages/client/src/rendu/interpolation.ts`): en carré aussi, 0,20 ms par image au processeur ralenti six fois, négligeable aux bornes actuelles.
- **La mesure du client ne reproduit ni la carte graphique ni l'échauffement d'un téléphone**: le ralentissement de Chromium ne porte que sur le processeur.
- **La mesure sous Linux est celle d'une machine d'intégration à quatre cœurs**, partagés avec les clients simulés: elle compare deux versions, elle ne dit pas ce que tiendra l'hébergement (étape 5.3).
- **Le budget par cœur est désormais prudent** (36 parties pleines prédites, 48 tenues). Sa marge de 30 pour cent est gardée pour ce que la charge ne sollicite pas: routes des comptes, base, ouvertures de connexions.
- **Les fichiers de `docs/mesures/5-2/` joués sur l'arbre de travail portent le commit `8b3992d`**, avant le commit des optimisations: c'est écrit dans le rapport.
- **Plus de la moitié du coût d'une partie est hors du moteur** (0,95 ms sur le serveur, 0,43 au banc): diffusion, écritures, réception, ramasse-miettes. L'étape 2.3 en réduira une part.
- **Sous PowerShell, une commande à plusieurs lignes contenant du JavaScript peut être bloquée** par le garde-fou du terminal: passer par un fichier de script.

Repris du handoff de 5.1, inchangé ou précisé: tout est mesuré sur un réseau local, sans latence ni limite de débit (5.3); la mémoire relevée est celle du processus; la suite unitaire lit la compilation des paquets pour les tests du harnais (compiler avant en local); une régression de durée ne se voit qu'en relançant le harnais; `pnpm charge` affiche « NativeCommandError » sous PowerShell, sans effet. `app.js` pèse 739 Ko minifié, **219 Ko en gzip**: Express le sert sans compression, l'hébergement prévu compresse, à vérifier en 5.3. Et des handoffs précédents: les erreurs d'un travailleur échappent aux scénarios de bout en bout; continuer en invité laisse la session ouverte côté serveur; une déconnexion dans un onglet ne touche pas un autre; la liste des parties ne se rafraîchit pas d'elle-même; aucune gestion du mot de passe ni suppression de compte; un échec d'enregistrement n'est pas retenté; poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` au déploiement (5.3).

## État de la CI

- Commit des optimisations, `1eaccd3`: **verte**, exécution GitHub Actions 34654055650 (« Types, linter et tests » et « Bout en bout »).
- Mesure sous Linux: exécution 34654057859 du workflow « Charge », réussie, branche `mesure-charge/5-2` supprimée ensuite.
- Commit de documentation: voir le commit qui suit, qui confirme sa CI dans ce handoff.

`master` n'a pas été touché. Aucune fusion de `reecriture` avant l'étape 6.1.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 2.3, diffusion en delta binaire. C'est la section 3 du ROADMAP qui la désigne: le jalon 4 enchaîne `5.1` `5.2` `2.3`.

Quatre points à avoir en tête dès le début:

1. **Lire les deux notes en tête de la fiche `docs/plan/etape-2-3.md`** (5.1 et 5.2): la taille de départ, les écarts de la fiche à réconcilier, et la question du filtrage par zone d'intérêt à trancher en fin d'étape.
2. **Le flux est isolé derrière une interface** des deux côtés: `instantaneDe` et `notificationsDe` (`packages/server/src/instantane.ts`) côté serveur, `reconstruire` (`packages/client/src/reconstruction.ts`) côté client, qui est « le seul endroit du client qui sache comment le flux est fait ».
3. **Le gain à viser est de taille, pas de calcul**: 21 518 octets par instantané, 4,3 fois moins en deflate; la sérialisation coûte 0,08 ms au serveur et le décodage 0,48 ms sur un téléphone lent.
4. **Adapter `tests/charge/empreinte.ts`** pour résumer séparément l'état du moteur et les notifications, qui doivent rester identiques, et l'instantané, qui va changer; et reporter la nouvelle taille dans `OCTETS_PAR_MESSAGE_DE_REFERENCE` (`tests/charge/seuils.ts`), que `battement.test.ts` vérifie.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-3.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
