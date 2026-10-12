# Fiche étape 5.15 - La fluidité des parties, surveillée en direct

Brief de session. Objectif unique: **voir en direct, dans un tableau de bord gratuit, si les parties en production sont fluides, être prévenu dans les minutes qui suivent une latence, une saccade ou une baisse de performance, et avoir de quoi la corriger**: où elle naît (le serveur, le réseau ou la page), sur quels appareils, dans quel mode, sur quelle carte, à quelle charge, depuis quelle version. Sans alourdir la page, sans ralentir le serveur, sans pisteur.

## Origine de cette fiche

Demandes du porteur du projet du 11 octobre 2026:

1. « Prévoir un outil de monitoring et de tableau de bord gratuit pour surveiller les performances du jeu et anticiper les optimisations, mais aussi avoir les statistiques d'utilisation et diverses métriques (Grafana ?). Attention à ne pas alourdir le jeu ni porter atteinte à ses performances. »
2. Réponses aux questions de la première version de cette fiche: « Grafana Cloud juste pour moi, et je veux tout mesurer pour m'assurer des bonnes performances du jeu et suivre l'évolution de l'adoption du jeu quand je commencerai à le partager sur les réseaux. »
3. Puis la priorité: « Le plus important à surveiller dans un premier temps, c'est la fluidité des parties, identifier instantanément les latences, saccades ou baisses de performances indésirables, et avoir les données suffisantes pour pouvoir corriger efficacement. »

La fiche d'origine a donc été coupée en deux: **celle-ci installe la surveillance et la consacre à la fluidité**; l'usage et l'adoption sont l'étape `5.16` (`docs/plan/etape-5-16.md`), qui s'appuie sur ce que celle-ci installe.

Rédigée selon le cas de repli du PROTOCOLE, à partir de l'état du dépôt au commit `437c511`, de `docs/deploiement.md`, des fiches et audits 8.5 et 8.6, et des offres gratuites relevées le 11 octobre 2026 sur grafana.com/pricing et neon.com/pricing.

## Ce qu'on sait en entrant

### Les leçons des audits 8.5, 8.6 et 5.12

- **Une saccade a trois origines possibles, et il faut les séparer pour la corriger.** Sur l'iPhone du porteur du projet, le dessin était fluide mais les instantanés arrivaient irrégulièrement (8.5): le réseau, pas la page. Plus tard, le son faisait tomber la page à 9,5 images par seconde (5.12): la page, pas le réseau. Le serveur, lui, peut peiner sur une offre dont la puissance n'est pas garantie (8.6).
- **Une moyenne cache une saccade.** « 55 images par seconde » ne dit rien d'une image de 200 ms perdue parmi cent autres. Il faut des répartitions (neuvième décile, centile 99) et le compte des images lentes (`packages/client/src/diagnostic/histogramme.ts`).
- **Un instrument ne doit pas fabriquer ce qu'il mesure**: rien d'alloué pendant la partie, rien d'écrit dans le document à chaque image (`diagnostic.ts`, `releve.ts`).

### Ce qui se mesure déjà, et ce qui manque

| Origine | Ce qui existe                                                                                                                                                                         | Ce qui manque                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serveur | `ChronometreDuBattement` (8.6): écart et durée de chaque battement, résumés sur cinq minutes par `/sante`                                                                             | L'historique, le détail par mode et par charge, la part de chaque phase du battement (moteur, vues, codage, envoi), le ramasse-miettes, la boucle d'événements                            |
| Réseau  | Le relevé `?diagnostic=1` (8.5) compte les instantanés reçus, l'écart entre deux, et les images où le lissage attendait le suivant                                                    | Ces chiffres chez tous les joueurs; le délai aller et retour, que la page ne mesure pas; ce qui reste en file d'envoi côté serveur; le transport (WebSocket ou repli en requêtes longues) |
| Page    | Le même relevé sépare, image par image, notre code, PixiJS et le reste (navigateur, carte graphique, ramasse-miettes). La boucle accepte une sonde (`SondeDImage`, `rendu/boucle.ts`) | Tout cela chez tous les joueurs, pas seulement sur l'appareil du porteur du projet quand il ajoute `?diagnostic=1`                                                                        |

Et rien ne garde l'historique, rien n'alerte, rien ne relie une saccade à son contexte. Les journaux ne se lisent que par SSH, et se perdent à chaque redémarrage du conteneur.

### Les contraintes

- **Gratuit**, comme tout l'hébergement. Grafana Cloud gratuit, relevé du 11 octobre 2026: 10 000 séries de métriques actives, 50 Go de journaux par mois, 14 jours de rétention, 3 utilisateurs, 100 000 vérifications de disponibilité par mois, alertes comprises, sans carte bancaire.
- **La page n'ouvre qu'à son serveur de jeu** (politique de sécurité). Aucun script tiers, aucun cookie.
- **`packages/sim` reste pur.** Rien de cette étape n'y entre.
- **La base Neon n'est pas touchée** par cette étape (100 heures de calcul par mois en offre gratuite).

## Le principe

```
 Page du joueur ──(toutes les 10 s pendant la partie: un bulletin)──> Serveur de jeu
                                                                         │  compte, journalise les épisodes
                                                                         v
                                          /metriques sur 127.0.0.1    journal (sortie standard du conteneur)
                                                  ^                         ^
                                                  │ lus toutes les 15 s      │ suivi en continu
                                          Agent Grafana Alloy (même machine, processus à part, bridé)
                                                                         │ envoie
                                                                         v
                                 Grafana Cloud: métriques, journaux, tableau « Fluidité », alertes
 Vérifications de disponibilité de Grafana (Francfort) ──> /sante de la production et page publique
```

1. **Le serveur compte et écrit dans son journal, il n'envoie rien.** Aucun appel réseau pour la surveillance. L'agent, dans son propre processus, lit ses compteurs et suit son journal. Si Grafana Cloud tombe, ou l'agent, le jeu ne le sait pas.
2. **Dans le battement et dans chaque image, seulement des opérations de coût fixe**: lire l'horloge, ajouter un à un compteur, ranger une durée dans une case fixée d'avance. Ni allocation, ni chaîne construite, ni tri.
3. **La page envoie un bulletin toutes les dix secondes pendant une partie**, sur la connexion qu'elle a déjà: une centaine d'octets, à comparer aux vingt instantanés par seconde qu'elle reçoit. Rien hors partie.
4. **Les métriques disent qu'il y a un problème; les journaux disent lequel.** Les métriques n'ont que des étiquettes bornées (mode, carte, appareil, navigateur); le détail d'un épisode, partie et contexte compris, va dans le journal, avec un débit plafonné.

## Ce que l'on mesure

### Le serveur

- **Le battement**, par mode: écart réel entre deux battements (doit rester à 50 ms), durée (doit rester loin sous 50 ms), battements en retard (écart d'au moins 100 ms).
- **Chaque phase du battement**: le moteur, les vues par destinataire, le codage, l'envoi. Quatre lectures d'horloge de plus par battement. C'est ce qui dira quoi optimiser.
- **La charge qui va avec**: PNJ, joueurs et entités par partie, pour tracer la durée du battement en fonction de la charge, par mode et par carte. **C'est la courbe qui annonce une optimisation avant qu'elle ne se ressente.**
- **Le processus**: pauses du ramasse-miettes (`PerformanceObserver` de `node:perf_hooks`, entrées `gc`), retard de la boucle d'événements (`monitorEventLoopDelay`), mémoire, processeur.
- **La machine**, par l'agent: processeur, mémoire, réseau, et le vol de processeur par l'hôte, signe d'une machine partagée qui peine.

### Le réseau

- **Côté serveur**: octets envoyés par seconde et taille des trames, par mode; ce qui attend dans la file d'envoi de chaque connexion au moment d'envoyer (un joueur dont la file grossit reçoit en retard); le transport de chaque connexion, WebSocket ou requêtes longues, ces dernières étant une cause de saccades à elles seules; les reconnexions.
- **Côté page, dans le bulletin**: l'écart entre deux instantanés reçus, en répartition; les images où le lissage attendait l'instantané suivant (l'à-coup que voit le joueur); le délai aller et retour, mesuré par un accusé de réception de Socket.IO toutes les cinq secondes, jamais à chaque image.

### La page

Dans le bulletin, par les mêmes points de mesure que le relevé 8.5, sans son panneau:

- la durée d'image en répartition, et le compte des images d'au moins 50 ms et d'au moins 100 ms;
- la part de notre code, de PixiJS et du reste dans les images lentes;
- les entités dessinées, le son actif ou non, l'onglet visible ou non (un onglet caché ralentit sa boucle: ses images ne comptent pas comme des saccades);
- une fois par partie: appareil (téléphone ou ordinateur), famille de navigateur, moteur de rendu, définition de l'écran, nombre de cœurs et mémoire annoncés quand le navigateur les donne, version de la page;
- les erreurs de la page, comptées par nature.

### Les épisodes

Quand un seuil est franchi, l'épisode s'écrit dans le journal, avec son contexte, pour qu'on puisse le corriger sans le reproduire:

- **côté serveur**: un battement d'au moins 100 ms d'écart ou de 25 ms de durée, avec ses quatre phases, la partie, son mode, sa carte, ses PNJ et ses joueurs, la dernière pause du ramasse-miettes et le retard de la boucle d'événements;
- **côté page**: un bulletin avec une image d'au moins 100 ms ou un instantané en retard d'au moins 250 ms, avec le détail de la pire image (notre code, PixiJS, le reste), l'appareil, le navigateur, les entités dessinées, le son, et ce que le serveur sait de la partie à cet instant.

Débit plafonné: un épisode par joueur et par minute, soixante par minute en tout. Le reste est seulement compté.

**Le bulletin de chaque partie**: toutes les dix secondes, une ligne du journal par partie en cours (mode, carte, joueurs, PNJ, battement, pire joueur de la partie). Le tableau en tire la liste des parties en cours, chacune avec son verdict.

## Ce que montre le tableau « Fluidité »

Rafraîchi toutes les quinze secondes. Lisible sans connaître Prometheus.

1. **Le verdict, en haut**: les parties sont-elles fluides en ce moment, et sinon, **où naît la saccade**: serveur (battements en retard), réseau (instantanés en retard alors que le serveur bat à l'heure), page (images lentes alors que les instantanés arrivent à l'heure). C'est la méthode de lecture de 8.5 et 8.6, appliquée en continu.
2. **Les parties en cours**, une ligne chacune, avec leur verdict et leur pire joueur.
3. **Les joueurs chez eux**, par appareil et par navigateur: images par seconde, neuvième décile et centile 99 de la durée d'image, part des images lentes, délai aller et retour, instantanés en retard.
4. **Le serveur**: battement et ses phases, durée du battement en fonction de la charge, par mode et par carte, ramasse-miettes, boucle d'événements, mémoire, machine.
5. **Avant et après chaque mise en ligne**: chaque version est marquée sur les courbes (la version passe dans les métriques), et un panneau compare les mêmes chiffres version par version. **Une baisse de performance indésirable se voit à la mise en ligne qui l'a apportée.**
6. **Les derniers épisodes**, en table, chacun avec tout son contexte, filtrables par origine, mode, carte, appareil et version.

Le relevé `?diagnostic=1` reste l'instrument de séance, pour creuser sur un appareil précis.

## Les alertes, par courriel au porteur du projet

Métriques lues toutes les 15 secondes, règles évaluées toutes les minutes: **un problème qui dure se signale en deux à trois minutes**. Une saccade isolée ne déclenche rien, elle se lit dans les épisodes; une dégradation qui dure, si.

| Alerte                                   | Quand                                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| La production ne répond plus             | `/sante` sans réponse deux minutes de suite                                                                                               |
| La page publique ne répond plus          | `https://ninja.dendrolag.fr` sans réponse deux minutes de suite                                                                           |
| Le serveur peine                         | plus de 1 pour cent de battements en retard sur 5 minutes, avec au moins une partie                                                       |
| Le battement s'alourdit                  | centile 99 de la durée du battement au-dessus de 25 ms sur 5 minutes                                                                      |
| Le réseau hoquette                       | plus de 5 pour cent d'instantanés en retard chez au moins deux joueurs, serveur à l'heure                                                 |
| La page rame                             | plus de 5 pour cent d'images lentes sur une famille d'appareils, sur 10 minutes                                                           |
| Une version a dégradé la fluidité        | une heure après une mise en ligne, images lentes ou durée du battement en hausse de moitié sur la version précédente, à charge comparable |
| La mémoire grimpe                        | mémoire du serveur au-dessus de 1 Go, ou en hausse continue sur six heures                                                                |
| La production est en retard sur `master` | le commit de `/sante` n'est pas le dernier commit qui touche le jeu, une heure après la poussée                                           |

Les seuils sont des points de départ: la session les règle sur ce que montre une semaine de production, et le porteur du projet les ajuste ensuite.

La dernière ligne demande une vérification que Grafana ne sait pas faire seul: un workflow GitHub planifié, toutes les heures, qui compare `/sante` à la tête de `master` avec la règle de la mise en ligne (`deploiement/miseEnLigne.ts`: un commit de documentation ne compte pas) et échoue en le disant. GitHub prévient par courriel d'un workflow planifié en échec.

## Décisions prises par cette fiche

Micro-décisions techniques, internes à l'étape (PROTOCOLE, « Ce qui ne nécessite pas de solliciter l'humain »).

1. **Grafana Cloud gratuit, pour le porteur du projet seul** (sa réponse du 11 octobre 2026). Hébergé ailleurs: une panne de la machine Oracle ne rend pas aveugle.
2. **Un petit module de métriques à nous**, `packages/server/src/metriques/`: compteurs, jauges, histogrammes à cases fixes, écriture au format texte de Prometheus. Sans dépendance. Pas `prom-client`, dont les histogrammes allouent à l'observation selon les étiquettes. Chaque combinaison d'étiquettes est créée une fois, à l'avance, jamais dans le battement. `ChronometreDuBattement` et `/sante` restent tels quels: la page et la mise en ligne les lisent.
3. **`/metriques` n'est jamais public.** Le serveur l'écoute sur un second port, attaché à `127.0.0.1`, seulement si `PORT_DES_METRIQUES` est posé. Caddy ne le relaie pas. Absent, comme sur Render, en développement et dans les tests: aucun port.
4. **La page mesure par la sonde de la boucle**, comme le relevé 8.5, avec des histogrammes à quelques cases et des compteurs remis à zéro à chaque bulletin. Le relevé détaillé et son panneau restent réservés à `?diagnostic=1`. La forme du bulletin et sa vérification vivent dans `packages/shared`: le serveur ne croit pas le réseau, et un bulletin mal formé, trop fréquent ou trop gros est ignoré et compté.
5. **Étiquettes bornées**: mode, carte, appareil, famille de navigateur (une liste fermée), version. Jamais un pseudo, un compte, une partie ni une adresse en étiquette: ils vont dans le journal. Budget: **moins de 5 000 séries**, machine comprise, sur les 10 000 offertes.
6. **Le journal du serveur s'écrit en lignes JSON** sur la sortie standard, que l'agent suit et envoie à Grafana. Débit plafonné (« Les épisodes »).
7. **L'agent est Grafana Alloy**, service du système sur la machine Oracle, bridé par systemd (`CPUQuota=25%`, `MemoryMax=300M`). Il lit `/metriques` toutes les 15 secondes, les métriques de la machine, et les journaux des conteneurs `neon-ninja-*`. Sa configuration vit dans `deploiement/oracle/` et s'installe par `installer.sh`, comme Caddy.
8. **Les tableaux et les alertes vivent dans le dépôt**, en JSON, dans `deploiement/grafana/`, importés par un script sans effet de bord à la relance.
9. **Render, en secours, n'est vérifié qu'une fois par jour**: une vérification fréquente le tiendrait éveillé et consommerait ses 750 heures gratuites.

## Le budget de performance, et comment on le prouve

| Quoi                       | Plafond                                                             | Mesuré par                                                 |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Durée du battement         | aucune hausse au-delà de l'écart entre deux séries du banc          | `pnpm charge --banc`, avant et après, trois séries chacun  |
| Le jeu                     | inchangé                                                            | empreinte des parties de référence, identique              |
| Lecture de `/metriques`    | sous 5 ms avec 24 parties pleines                                   | banc, en lisant la route pendant la charge                 |
| Mémoire du serveur         | moins de 5 Mo de plus                                               | banc                                                       |
| Page                       | aucune hausse de la durée d'image, moins de 3 Ko compressés de plus | banc du rendu de la CI, avant et après; taille de `app.js` |
| Bulletins reçus            | moins de 1 pour cent des octets échangés pendant une partie         | banc, `--reseau`                                           |
| Agent Alloy sur la machine | moins de 5 pour cent d'un cœur en moyenne, moins de 300 Mo          | ses propres métriques, sur 24 heures                       |
| Séries actives             | moins de 5 000                                                      | page d'usage de Grafana Cloud                              |

## Ce que le porteur du projet fait lui-même

La session ne crée pas de compte, ne saisit aucun secret et n'a pas d'accès SSH à la production (mémoire du projet, « Machine Oracle par le porteur »).

1. **Créer le compte Grafana Cloud** gratuit, avec une pile en Europe (Francfort si proposé), puis un jeton d'accès limité à l'écriture des métriques et des journaux, et un second, limité à l'import des tableaux et des alertes.
2. **Sur la machine Oracle**, recopier `deploiement/oracle/` et relancer `installer.sh`, qui installe Alloy; poser le jeton d'écriture dans `/etc/neon-ninja/alloy`, lisible du seul service, et `PORT_DES_METRIQUES` dans `/etc/neon-ninja/environnement`. La session lui donne les commandes PowerShell exactes.
3. **Jouer une partie en production**, sur ordinateur et sur téléphone, pour la définition de terminé.

## Périmètre

### Lot A. Le serveur mesure

- `packages/server/src/metriques/`: registre, compteur, jauge, histogramme à cases fixes, écriture au format texte, et leurs tests.
- Les mesures du serveur et du réseau ci-dessus, branchées sans rien changer à ce que fait le jeu: au même endroit que `ChronometreDuBattement.enregistrer` pour le battement, dans la boucle des envois pour les phases, les octets et la file d'envoi.
- Le second port, `PORT_DES_METRIQUES`, sur `127.0.0.1`.
- Le journal en lignes JSON, les épisodes du serveur et le bulletin de chaque partie, avec leur débit plafonné.

### Lot B. La page rend compte

- La sonde de surveillance branchée sur la boucle, ses histogrammes à quelques cases, l'accusé de réception toutes les cinq secondes, le bulletin toutes les dix secondes pendant une partie, la description de l'appareil une fois par partie, les erreurs de la page.
- La forme du bulletin et sa vérification dans `packages/shared`; sa réception, son ajout aux métriques, et ses épisodes, côté serveur.

### Lot C. L'agent, Grafana et les alertes

- La configuration d'Alloy et son installation dans `deploiement/oracle/`.
- Le tableau « Fluidité » et les alertes dans `deploiement/grafana/`, et le script qui les importe.
- Le workflow planifié qui compare la production à `master`.
- Les vérifications de disponibilité: production et page toutes les minutes, Render une fois par jour.

### Lot D. Mesure et documentation

- Le budget de performance, relevé et consigné dans `docs/mesures/charge-serveur.md`, nouvelle section.
- `docs/deploiement.md`, section « Surveillance »: où est le tableau, comment lire le verdict, que faire à chaque alerte, comment retrouver le contexte d'un épisode. Retirer « Rien ne surveille cela automatiquement à ce jour ».
- `CLAUDE.md`: la variable `PORT_DES_METRIQUES`, et une ligne à l'index.

## Hors périmètre

- Toute modification de `packages/sim`.
- L'usage et l'adoption: étape `5.16`.
- Un script d'analyse tiers dans la page, un cookie, une politique de sécurité élargie.
- Le traçage distribué et le profilage continu: rien ne le justifie à un seul serveur.
- Corriger ce que montrera le tableau: chaque correction devient une étape, mesurée.

## Tests requis

- TU du module de métriques: compteur, jauge, cases d'histogramme, format texte, aucune allocation à l'observation (mesure du tas sur un grand nombre d'observations).
- TU de la sonde de surveillance de la page: histogrammes, remise à zéro par bulletin, onglet caché exclu, aucune allocation par image.
- TU de la forme du bulletin et de ses refus (mal formé, trop fréquent, trop gros).
- TU du plafond des épisodes.
- TI du serveur: `/metriques` absent sans `PORT_DES_METRIQUES`, présent sur `127.0.0.1` seulement, jamais sur le port public; ses chiffres suivent une partie jouée par de vrais clients Socket.IO (battements, phases, octets, bulletins); un battement lent forcé produit un épisode dans le journal.
- TU du workflow de comparaison à `master`, par la règle déjà testée de `miseEnLigne.ts`.
- Bout en bout: une partie jouée envoie ses bulletins et le jeu ne change pas; suite complète au vert.
- Le budget de performance, chiffré avant et après.

## Définition de terminé

1. Le tableau « Fluidité » montre en direct une partie jouée en production par le porteur du projet, sur ordinateur et sur téléphone: verdict, battement et ses phases, joueurs chez eux, parties en cours.
2. **Une saccade provoquée de chaque origine est reconnue par le verdict et retrouvée dans les épisodes avec son contexte**: le serveur (battement ralenti à dessein sur un serveur d'essai), le réseau (lien bridé dans les outils du navigateur), la page (processeur ralenti dans les outils du navigateur).
3. Chaque alerte a été déclenchée une fois, pour de vrai ou par une règle de test, et le courriel reçu.
4. Le budget de performance est tenu, chiffres consignés.
5. Empreinte des parties de référence identique, couverture de `packages/sim` inchangée.
6. CI verte, mise en ligne faite, `docs/deploiement.md` à jour.

## Points de vigilance

- **Ne jamais mettre d'identifiant en étiquette**: une étiquette par partie ou par joueur ferait exploser le nombre de séries, donc l'offre gratuite, et ferait fuir des données personnelles.
- **Le serveur redémarre à chaque mise en ligne**: ses compteurs repartent de zéro. Les tableaux n'utilisent que `rate` et `increase`, qui le savent.
- **Bleu et vert**: deux conteneurs se succèdent à chaque mise en ligne. Les métriques portent l'emplacement en étiquette, pour ne pas mêler les deux pendant la bascule.
- **Un onglet caché, un téléphone qui se verrouille** ralentissent la boucle sans que le joueur ne voie rien: ces images ne comptent pas comme des saccades.
- **Le bulletin d'une page d'une autre version** est refusé comme le reste: le contrôle de version de la connexion s'applique.
- **Le jeton d'écriture de Grafana est un secret**: jamais dans le dépôt, jamais dans la page.

## Rituel de fin de session

Handoff depuis `docs/handoffs/_TEMPLATE.md`. Étape invisible au joueur: pas de changement de `NUMERO_DE_VERSION`.

## Questions soumises au porteur du projet, et ses réponses du 11 octobre 2026

Posées par la première version de cette fiche. **Réponse: Grafana Cloud, pour lui seul, et tout mesurer**, puis la fluidité d'abord. Les questions 2 et 4 relèvent désormais de l'étape `5.16`.

1. **Grafana Cloud gratuit, hébergé ailleurs, ou un Grafana installé sur la machine Oracle ?** Retenu: Grafana Cloud.
2. **Une ligne en base pour chaque partie terminée, invités compris ?** Retenu (étape `5.16`).
3. **Un relevé de performance discret chez tous les joueurs ?** Retenu, et renforcé par la priorité donnée à la fluidité: un bulletin toutes les dix secondes plutôt qu'un résumé en fin de partie, pour voir une dégradation pendant qu'elle a lieu.
4. **Compter les visiteurs distincts par jour, sans cookie ?** Retenu (étape `5.16`).
5. **Qui voit le tableau de bord ?** Retenu: le porteur du projet seul.

## Réconciliation

Écarts au plan constatés en exécutant, le 12 octobre 2026.

1. **`PORT_DES_METRIQUES` est posée par `neon-ninja.sh`, pas dans `/etc/neon-ninja/environnement`.** Les deux emplacements partagent le réseau de la machine, et tournent ensemble pendant une bascule: un même port les ferait se heurter. Chaque emplacement prend le sien, cent ports après celui du jeu (3101 pour le bleu, 3102 pour le vert), et l'agent lit les deux, l'emplacement en étiquette. Un geste de moins pour le porteur du projet.
2. **Le tableau et les alertes sont décrits en TypeScript** (`deploiement/grafana/tableau.ts`, `alertes.ts`, `requetes.ts`), et non en JSON brut: ils partagent les seuils et les formules, et un test vérifie qu'ils ne lisent que des métriques que le serveur écrit. `importer.ts` les envoie à Grafana, sans effet de bord à la relance.
3. **Le bulletin voyage en tableau de nombres**, une centaine d'octets, et non en objet JSON, qui triplerait sa taille. L'appareil se décrit à part, au début de la partie puis une fois par minute: une page revenue après une coupure ouvre une nouvelle connexion, que le serveur ne connaît pas encore.
4. **Rien ne se compte avant le lever de l'écran de préparation.** Les premières images d'une partie préparent le décor et rament toujours (recette de l'étape 5.4): elles auraient fait un épisode à chaque lancement.
5. **La version est une étiquette de toutes les séries**, et non une série à part: constante pour un processus, elle ne multiplie rien, et chaque mise en ligne se lit sur chaque courbe. Le journal la porte aussi, ligne par ligne.
6. **La durée du battement porte le mode, la carte et une tranche de charge** (0-50, 51-150, 151-300, 301-600, plus de 600 PNJ). Ses séries naissent à la première rencontre, au premier battement d'une partie puis toutes les dix secondes, jamais à chaque battement.
7. **« Le réseau hoquette chez au moins deux joueurs » est approché**: aucune métrique ne porte le joueur (décision 5 de la fiche). L'alerte part sur la part de tous les instantanés en retard, serveur à l'heure, avec au moins deux joueurs en partie; le joueur et son appareil sont dans les épisodes et la ligne de chaque partie.
8. **« Une version a dégradé la fluidité » fait deux alertes**, la page et le battement, et compare la première heure d'une version aux sept jours précédents: une requête ne sait pas désigner « la version précédente ». La mémoire aussi en fait deux, haute et en hausse.
9. **Render est vérifié par le workflow « Production a jour », une fois par jour**, et non par une vérification de Grafana: le workflow lit sa version, donc vérifie à la fois qu'il répond et qu'il est à jour, sans entamer les 100 000 vérifications gratuites du mois. Les deux vérifications de Grafana, production et page, partent d'une seule sonde, Francfort: deux sondes dépasseraient ce plafond.
10. **La saccade du serveur ne se provoque pas en production**: rien dans le jeu ne ralentit le battement à dessein, et en ajouter un serait une porte de plus. Le test d'intégration `ServeurSocket.surveillance.test.ts` force un battement lent et en lit l'épisode; le réseau et la page se provoquent dans les outils du navigateur.
11. **`deploiement/grafana/` ne déclenche pas de mise en ligne** (`verifications.ts`): le serveur ne le lit pas, et le réimporter suffit.
12. **Le harnais de charge gagne `--surveillance`**: le serveur surveillé comme en production, ses clients qui envoient leurs bulletins, et la route `/metriques` lue toutes les quinze secondes pendant la mesure.
