# Handoff - Étape 5.1 Tests de charge serveur

Date: 11 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Mesurer le comportement du serveur sous charge, pour valider les paris du multi-parties et du delta binaire avant toute optimisation: un harnais qui fait tourner N parties peuplées de plus de 100 bots, le temps de battement par partie, la taille réelle des messages diffusés, et des seuils de référence. On mesure, on ne corrige pas. Cette étape ouvre le jalon 4.

## Ce qui a été fait

- **Un harnais de charge**, `tests/charge/`, lancé par `pnpm charge`. Trois mesures, chacune dans un processus neuf par configuration ou par palier:
  - **le banc du battement**: une vraie `GameRoom` avec les murs de map1, avancée aussi vite que possible; moteur, projection et sérialisation chronométrés séparément; taille exacte de la trame WebSocket; déterministe pour les tailles;
  - **les populations mêlées**: plusieurs parties dans un même processus, comparées à la même partie seule;
  - **la charge du serveur complet**: le serveur compilé tel que `pnpm dev` le lance, de 1 à 96 parties de douze vrais clients Socket.IO répartis sur 7 processus, par le vrai protocole (partie privée, entrée par code, compte à rebours réel), jusqu'au premier palier qui ne tient plus la fréquence.
- **Aucune ligne du jeu n'est modifiée pour mesurer.** Le serveur reçoit son horloge par injection: le harnais lui passe celle du système, enveloppée, qui chronomètre chaque battement. Seuls deux commentaires de `packages/shared` changent, pour dire ce que la mesure a conclu.
- **Un rapport de référence**, `docs/mesures/charge-serveur.md`, et ses chiffres bruts, `docs/mesures/charge-serveur-5-1.json`, écrits par le harnais.
- **Des seuils de référence**: critères de tenue, budget par cœur validé par la mesure, valeurs de comparaison pour 5.2, et deux seuils vérifiés en CI.
- **La décision sur l'étape 2.3**: justifiée, placée après 5.2 (ROADMAP, journal, fiche 2.3).
- **Deux trouvailles non prévues**, mesurées et documentées: le coût d'une partie dépend des parties jouées avant elle dans le même processus (× 2,6 à × 3,7); et la cadence du serveur décroche avant que son fil soit plein.
- **Deux incohérences corrigées** (règle 7): la fiche 5.2 renvoyait à 5.3 alors que 2.3 la suit désormais; la fiche 2.3 renvoyait à des étapes faites (2.4, 4.1) et à un événement qui n'existe plus (`updateEntities`).

## Les chiffres clés

Machine de mesure: AMD Ryzen 7 3800X (8 cœurs, 16 fils), Windows 11 Pro, Node.js 24.16.0.

| Question                                                  | Réponse mesurée                                                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Coût d'un battement, partie pleine (150 bots, 12 joueurs) | 0,77 ms au banc (moteur 0,65), 1,9 ms sur le vrai serveur, diffusion et travail entre battements compris                                |
| Croissance avec les bots                                  | presque le carré: 50 bots 0,21 ms, 300 bots 2,2 ms, 1000 bots 19,9 ms                                                                   |
| Taille d'un instantané                                    | 21,5 Ko à 150 bots, 117 octets par entité; 4,3 fois moins compressé                                                                     |
| Débit                                                     | 3,4 Mbit/s par joueur, 42 Mbit/s par partie pleine, 78 Mo par joueur pour une partie de trois minutes                                   |
| Parties par processus                                     | 16 parties pleines tenues, 24 non, sur quatre passages; en mélange 50 et 150 bots, 24 tenues, 32 à la limite (tenues une fois sur deux) |
| Populations mêlées                                        | 150 bots après 50: × 2,70; 300 après 150: × 3,65                                                                                        |
| Mémoire                                                   | 334 Mo au premier palier non tenu: pas une limite                                                                                       |

## Où le serveur sature en premier

**Sur un processus, la cadence des battements**, quand le fil du serveur est occupé à plus de 60 à 75 pour cent: les parties tombent à 18 battements par seconde, avec des à-coups. Le budget par cœur (35 ms utilisables par battement, divisées par le coût réel d'une partie) prédit le palier: 18 parties pleines, pour 16 tenues et 24 non.

Écartés par la mesure comme cause: le fil plein (73 pour cent au décrochage), le ramasse-miettes (2,3 pour cent du temps), la bande passante seule (les mêmes parties à un joueur décrochent aussi, avec 67 Mbit/s), les minuteries de Node seules (un test isolé tient 19,7 Hz jusqu'à 84 pour cent d'occupation). **Le mécanisme exact n'est pas identifié**: reste ce que le serveur fait entre ses battements, recevoir les intentions et écrire les instantanés sur des centaines de connexions. Et tout est mesuré sous Windows.

**Pour un joueur, la bande passante**: 3,4 Mbit/s en continu. C'est ce qui justifie 2.3.

Orientation pour 5.2, dans l'ordre: diagnostiquer la perte de cadence (et la remesurer sous Linux); diagnostiquer les populations mêlées; le partitionnement spatial seulement si les bornes du salon doivent monter; le niveau de détail d'IA n'est pas désigné par la mesure.

## Architecture du harnais

```
pnpm charge ──> charge.ts (ligne de commande, tableaux, JSON)
                  ├─ battement-isole.ts ──fork──> battement.ts        (banc, un processus par configuration)
                  └─ charge-reseau-isolee.ts ──fork──> charge-reseau.ts (un processus par palier)
                                                         ├─ serveur compilé + horloge instrumentée
                                                         └─fork──> clients.ts x 7 (vrais clients Socket.IO)
seuils.ts: critères de tenue, budget par cœur, partie de référence      statistiques.ts: centiles
```

| Fichier                   | Responsabilité                                                                            | Pur |
| ------------------------- | ----------------------------------------------------------------------------------------- | --- |
| `statistiques.ts`         | Résumer une série: moyenne, centiles, extrêmes                                            | oui |
| `seuils.ts`               | Critères de tenue, budget par cœur, partie et taille de référence, conversions de débit   | oui |
| `battement.ts`            | Le banc du battement dans le processus courant                                            | non |
| `battement-isole.ts`      | Jouer une suite de configurations du banc dans un processus neuf                          | non |
| `clients.ts`              | Processus de clients simulés: créer, rejoindre, lancer, bouger, compter les octets reçus  | non |
| `charge-reseau.ts`        | Un palier de charge: serveur compilé, horloge instrumentée, fenêtre de mesure, assemblage | non |
| `charge-reseau-isolee.ts` | Jouer un palier dans un processus neuf                                                    | non |
| `charge.ts`               | La ligne de commande: plan, balayages, affichage, fichier JSON                            | non |

`repartir`, `botsDeLaRoom`, `assembler` et `verdictDeTenue` sont pures et testées sur des valeurs écrites à la main.

## Fichiers créés ou modifiés

Créés

- `tests/charge/statistiques.ts`, `seuils.ts`, `battement.ts`, `battement-isole.ts`, `clients.ts`, `charge-reseau.ts`, `charge-reseau-isolee.ts`, `charge.ts`: le harnais.
- `tests/charge/statistiques.test.ts`, `seuils.test.ts`, `battement.test.ts`, `charge-reseau.test.ts`: ses tests.
- `docs/mesures/charge-serveur.md`: le rapport de référence. `docs/mesures/charge-serveur-5-1.json`: ses chiffres bruts. `docs/mesures/charge-serveur-5-1-reproductibilite.json`: le second passage du serveur complet, qui chiffre la reproductibilité.
- `docs/handoffs/etape-5-1-handoff.md`.

Modifiés

- `package.json`: le script `charge` (compile, puis lance le harnais).
- `tsconfig.tests.json`: `allowImportingTsExtensions`, parce que Node lance le harnais en retirant les types sans réécrire les chemins d'importation.
- `packages/shared/src/constantes.ts`: le commentaire de `CAPACITES` annonçait la confrontation à la mesure de 5.1; il en donne le résultat.
- `packages/shared/src/evenements.ts`: le flux d'état serait remplacé « si la mesure le justifie »; elle l'a justifié.
- `CLAUDE.md`: commande `pnpm charge`, dossier `tests/charge/`, rapport dans l'index.
- `docs/plan/etape-5-1.md`: section « Réconciliation », neuf points.
- `docs/plan/etape-5-2.md`: section « Apport de la mesure de l'étape 5.1 »; prochaine action corrigée vers 2.3.
- `docs/plan/etape-2-3.md`: note de justification et écarts à réconcilier.
- `docs/plan/ROADMAP.md`: jalon 4, ordre `5.1` `5.2` `2.3`.
- `docs/design/README.md`: quatre décisions du 11 septembre 2026.

Aucune modification de `packages/sim`, `packages/server`, `packages/client`, `legacy/` ni `tests/caracterisation/`. Aucune migration.

## Tests

- Ajoutés, par exigence de la fiche:
  - **le harnais s'exécute et produit des mesures reproductibles**: `battement.test.ts` (chaque battement mesuré et détaillé; deux exécutions de même graine rendent les mêmes octets; une autre graine, une autre partie; une partie au-delà des bornes du salon), `charge-reseau.test.ts` (une vraie charge courte sur le serveur compilé: clients servis, aucune connexion perdue, un message par battement, et la taille mesurée sur le fil concorde avec celle que le banc calcule);
  - **des seuils de référence sont définis et vérifiés**: `battement.test.ts` porte la taille de référence (21 518 octets à 5 pour cent) et le budget d'une partie pleine; `seuils.test.ts` (critères de tenue, budget par cœur, cadence égale à celle du serveur);
  - `statistiques.test.ts`: centiles, résumé, arrondis; `charge-reseau.test.ts`: répartition, attribution des bots, assemblage des relevés.
- Un rapport chiffré existe: `docs/mesures/charge-serveur.md`.
- Résultat: **1 511 tests sur 1 511** par `pnpm verify` (109 fichiers, tests de la base compris), dont les 32 nouveaux du harnais. Bout en bout: non touchés, rejoués par la CI.
- Couverture de `packages/sim` et `packages/shared`: inchangée, aucun code de ces paquets n'ayant changé (commentaires seulement).
- Types (paquets, tests, bout en bout), linter et formatage: verts.
- Le harnais lui-même: `pnpm charge --rapide` et quatre passages complets joués pendant l'étape, sans erreur.
- Aucune régression de caractérisation.

La charge courte de `charge-reseau.test.ts` dure une dizaine de secondes, dont cinq de compte à rebours réel, et lance un processus de clients. Elle ne juge pas si le serveur tient: les autres tests tournent en parallèle, et la machine d'intégration n'est pas celle du rapport.

## Décisions et écarts au plan

Quatre décisions au journal de `docs/design/README.md`, datées du 11 septembre 2026. Les écarts à la fiche sont dans sa section « Réconciliation ». Cinq points à lire ici.

### 1. On mesure la compilation, sans toucher au serveur

Le harnais charge `packages/*/dist`, le code de production, et mesure par l'horloge injectée. Un crochet dans le serveur aurait été du code de test en production; un profileur ralentit ce qu'il observe.

### 2. Un processus neuf par mesure

Trouvé en calibrant, puis vérifié: 300 bots coûtent 2,3 ms dans un processus neuf, 8,0 ms après une partie de 150 bots, à travail identique à l'octet près. Même chose sur le serveur complet: 2 parties pleines jouées dans le processus du palier précédent coûtaient 2,48 ms par battement, 1,24 en processus neuf. Sans cette règle, les chiffres dépendaient de l'ordre des mesures.

### 3. Les critères de tenue et le budget par cœur

Au moins 19 battements par seconde par partie, un écart p99 entre deux battements de 100 ms au plus, aucune connexion perdue. Budget: 70 pour cent d'un battement pour les parties. **La mesure a validé cette marge**: les pertes de cadence sont apparues à partir de 62 pour cent d'occupation du fil, aucun palier n'a tenu au-delà de 72 pour cent, et le budget calculé avec le coût réel d'une partie prédit les paliers observés. Le coût du banc, lui, surestime la capacité d'un facteur 2,5: il ignore la diffusion.

### 4. L'étape 2.3 est justifiée, et vient après 5.2

La bande passante le justifie (3,4 Mbit/s par joueur). Mais le premier mur d'un processus est la cadence, qui relève de 5.2, et 2.3 ne l'aurait repoussé que d'une dizaine de pour cent. Section 3 du ROADMAP mise à jour.

### 5. Deux hypothèses fausses, et comment la mesure les a écartées

J'ai d'abord cru que la bande passante saturait le serveur (les deux scénarios décrochaient vers 900 Mbit/s): les mêmes parties à un seul joueur décrochent aussi, à 67 Mbit/s. J'ai ensuite cru à la dérive de `setInterval`, qui ne rattrape pas un retard: un test isolé, avec ou sans à-coups, garde sa cadence. Les deux mesures sont consignées, pour que 5.2 ne les refasse pas.

### Ce que cette étape rend structurellement impossible

- **Le flux d'état ne peut plus grossir sans qu'on le voie**: la taille de l'instantané de la partie de référence est vérifiée en CI, à 5 pour cent.
- **Une optimisation ne peut plus se déclarer sans mesure comparable**: les conditions, la commande et les valeurs de comparaison sont écrites, et le harnais les rejoue.
- **Une mesure de charge ne peut plus dépendre de l'ordre dans lequel on la joue**: chaque configuration et chaque palier ont leur processus.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **La cause de la perte de cadence n'est pas identifiée.** Voir « Où le serveur sature en premier ». C'est le premier travail de 5.2.
- **Tout est mesuré sous Windows**, et la production tournera sous Linux (Render). L'ordonnancement des minuteries et des entrées-sorties y diffère: la saturation est à remesurer sur Linux (machine ou machine d'intégration) avant de dimensionner l'hébergement, en 5.2 ou au plus tard en 5.3. WSL n'est pas installé sur la machine de mesure.
- **Les populations mêlées coûtent 2,6 à 3,7 fois plus cher**, cause probable non vérifiée (formes d'objets polymorphes). Un vrai serveur y est exposé en permanence.
- **Le réseau est local**: ni latence ni limite de débit. Le débit sortant réel d'un hébergement, et son coût, restent à mesurer en 5.3.
- **Le coût du client n'est pas mesuré**: décoder 21,5 Ko de JSON vingt fois par seconde sur un téléphone. Étape 5.2.
- **La mémoire relevée est celle du processus**, pas une consommation par partie; elle ne dit pas ce que coûte une partie de plus.
- **La suite unitaire s'allonge d'une dizaine de secondes** avec la charge courte, et ses tests du harnais lisent la compilation des paquets: compiler avant en local (`pnpm typecheck` ou `pnpm build`), comme pour les comptes en mémoire.
- **Une régression de durée ne se voit qu'en relançant le harnais** sur la même machine: le seul seuil de durée vérifié en CI ne détecte qu'un effondrement.
- **Sous PowerShell, `pnpm charge` affiche « NativeCommandError »**: pnpm écrit la commande lancée sur la sortie d'erreur. Sans effet, le code de sortie est 0.

Repris du handoff de la reprise des écrans du jalon 3, inchangé: les erreurs d'un travailleur échappent aux scénarios de bout en bout; continuer en invité laisse la session ouverte côté serveur; une déconnexion dans un onglet ne touche pas un autre; la liste des parties ne se rafraîchit pas d'elle-même; aucune gestion du mot de passe ni suppression de compte; `app.js` pèse 739 Ko minifié (mesure du chargement mobile en 5.2). Et du handoff 3.3: un échec d'enregistrement n'est pas retenté; poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` au déploiement (5.3).

## État de la CI

**Verte** sur le commit de l'étape, `6ed41cc`: exécution GitHub Actions 34637473454, sur `reecriture`.

- « Types, linter et tests »: réussi, en 1 min 51 s. Il comprend la suite unitaire avec les 32 tests du harnais (dont la charge courte sur le vrai serveur, sous Linux), le seuil de taille de la partie de référence, et les tests de la base contre une branche Neon neuve.
- « Bout en bout »: réussi, en 4 min 50 s, 13 scénarios sur 13.

`master` n'a pas été touché. Aucune fusion de `reecriture` avant l'étape 6.1.

## Prochaine action exacte

Dans une conversation neuve: exécuter l'étape 5.2, optimisations validées par la mesure. C'est la section 3 du ROADMAP qui la désigne: le jalon 4 enchaîne désormais `5.1` `5.2` `2.3`.

Quatre points à avoir en tête dès le début:

1. **Lire les sections 1, 6 et 7 de `docs/mesures/charge-serveur.md`**, puis la section « Apport de la mesure de l'étape 5.1 » de la fiche `docs/plan/etape-5-2.md`, qui classe les quatre points chauds.
2. **Commencer par diagnostiquer, pas par optimiser.** La perte de cadence vers 60 à 75 pour cent d'occupation n'a pas de cause établie: profiler le serveur sous charge (le palier se lance par `mesurerLaChargeEnProcessusNeuf`, dont les options de Node se passent dans `charge-reseau-isolee.ts`), et remesurer sous Linux. Idem pour les populations mêlées (`--trace-ic`, `--prof`).
3. **Comparer avant après par le harnais**, sur la même machine, machine au repos: `pnpm charge --sortie docs/mesures/charge-serveur-5-2.json`, puis mettre à jour le rapport, daté, et les valeurs de la section 7 si elles changent.
4. **Une optimisation qui change la taille du flux fait échouer `battement.test.ts`**: c'est voulu; la nouvelle taille se mesure et se reporte dans `OCTETS_PAR_MESSAGE_DE_REFERENCE`. Le format du flux, lui, appartient à 2.3.

## Étape suivante

Fiche à lire: `docs/plan/etape-5-2.md`.

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`.
