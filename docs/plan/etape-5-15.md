# Fiche étape 5.15 - Surveiller le jeu en production, sans le ralentir

Brief de session. Objectif unique: **un tableau de bord gratuit qui montre la santé et l'usage du jeu en production**, pour voir venir les optimisations avant que les joueurs ne les ressentent, et savoir qui joue à quoi. Sans alourdir la page, sans ralentir le serveur, et sans pisteur.

## Origine de cette fiche

Demande du porteur du projet du 11 octobre 2026: « prévoir un outil de monitoring et de tableau de bord gratuit pour surveiller les performances du jeu et anticiper les optimisations, mais aussi avoir les statistiques d'utilisation et diverses métriques (Grafana ?). Attention à ne pas alourdir le jeu ni porter atteinte à ses performances. »

Rédigée le même jour selon le cas de repli du PROTOCOLE, à partir de l'état du dépôt au commit `437c511`, de `docs/deploiement.md`, de la fiche 8.6 et des offres gratuites relevées ce jour-là sur grafana.com/pricing et neon.com/pricing. **Elle n'est pas encore à exécuter**: cinq questions attendent le porteur du projet (plus bas), et l'étape demande de lui trois gestes hors du dépôt (« Ce que le porteur du projet fait lui-même »).

## Ce qu'on sait en entrant

### Ce qui se mesure déjà

- **`/sante`** (étapes 5.3 et 8.6): version en ligne, nombre de parties, de joueurs et de connexions, et le résumé du battement sur cinq minutes (`ChronometreDuBattement`, un tableau tournant de taille fixe, sans allocation pendant le jeu, résumé calculé à la demande seulement). C'est le bon modèle: le battement paie trois écritures dans un tableau, la lecture paie le reste.
- **`?diagnostic=1`** (étape 8.5): un relevé de la cadence et des durées d'image dans la page, qui n'existe que si l'adresse le demande. Instrument de séance, pas de surveillance: rien ne remonte.
- **`pnpm base:mesurer`** (étape 3.7): rétention et calibration, lues dans la base, à la main. Aucun relevé fait à ce jour.
- **Le banc de charge** (`pnpm charge`, étapes 5.1 et 5.2) et **l'empreinte des parties**: la référence pour prouver qu'un ajout ne change ni le coût du battement ni le jeu.

### Ce qui manque

- **Rien ne garde l'historique.** `/sante` dit l'instant présent: un pic de la nuit est perdu au matin.
- **Rien n'alerte.** Ni une production qui ne répond plus, ni une mise en ligne sautée (`docs/deploiement.md`, « Rien ne surveille cela automatiquement à ce jour »), ni un battement qui se dégrade.
- **Les parties d'invités ne laissent aucune trace.** `ServeurSocket.ts` n'enregistre une fin de partie que si au moins un compte y a joué (`fin.resultats.length === 0`, ligne 1642 au commit `437c511`). La table `parties` ne dit donc pas combien on joue.
- **On ne sait pas comment tourne la page chez les joueurs.** Les audits 8.5 et 5.12 ont reposé sur le téléphone du porteur du projet.
- **Les journaux** ne se lisent que par SSH sur la machine Oracle, et se perdent à chaque redémarrage du conteneur.
- **La machine Oracle peut être reprise** si elle reste sous 20 pour cent de processeur au 95e centile sur sept jours (`docs/deploiement.md`, « Ce qu'Oracle peut reprendre »). Personne ne regarde ce chiffre.

### Les contraintes

- **Gratuit**, comme tout l'hébergement.
- **La base Neon gratuite a 100 heures de calcul par mois** (CU-heures, relevé du 11 octobre 2026), s'endort après 5 minutes sans requête et ne se réveille qu'à la suivante. Un tableau de bord qui interroge la base toutes les minutes la tiendrait éveillée en permanence et brûlerait ce budget. **La base ne doit être lue qu'à la demande, et écrite rarement.**
- **La page n'ouvre qu'à son serveur de jeu** (politique de sécurité, `connect-src`). Un script d'analyse tiers demanderait d'élargir cette politique, d'ajouter du poids à la page et, avec un cookie, un bandeau de consentement.
- **`packages/sim` reste pur.** Rien de cette étape n'y entre.

## L'offre retenue: Grafana Cloud, en offre gratuite

Relevé du 11 octobre 2026: 10 000 séries de métriques actives, 50 Go de journaux par mois, 14 jours de rétention, 3 utilisateurs, 100 000 vérifications de disponibilité par mois, alertes comprises, sans carte bancaire.

### Pourquoi lui

| Option                                                             | Pour                                                                                                                                        | Contre                                                                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grafana Cloud gratuit** (recommandée)                            | Hébergé ailleurs: survit à une panne de la machine Oracle. Rien à administrer. Alertes, vérifications de disponibilité et journaux compris. | 14 jours de rétention: l'historique long vient de la base (décision 6). Trois utilisateurs.                                                                                      |
| Prometheus et Grafana sur la machine Oracle                        | Rétention sans limite, tout chez nous.                                                                                                      | Sur la machine du jeu: lui prend de la mémoire et du processeur, meurt avec elle, et c'est justement quand elle tombe qu'on veut voir. Un site de plus à exposer et à sécuriser. |
| Analyse dans la page (Vercel Analytics, Umami, PostHog, Plausible) | Visites et pages vues sans effort.                                                                                                          | Un script de plus dans la page, une politique de sécurité élargie, souvent un cookie et son bandeau. Ne voit pas le jeu: ni parties, ni modes, ni battement.                     |
| Sentry gratuit                                                     | Erreurs de la page détaillées.                                                                                                              | Une bibliothèque de plusieurs dizaines de kilo-octets dans la page. Les erreurs remonteront par le serveur (lot C).                                                              |

### Le principe: tout se compte dans le serveur, rien ne part de lui

```
 Page du joueur ──(fin de partie: un résumé)──> Serveur de jeu ──> /metriques, sur 127.0.0.1 seulement
                                                      │                     ^
                                                      │                     │ lu toutes les 30 s
                                                      │              Agent Grafana Alloy (même machine,
                                                      │              processus à part, bridé)
                                                      │                     │ envoie
                                                      v                     v
                                             Base Neon (une ligne      Grafana Cloud: métriques,
                                             par partie terminée)      journaux, alertes, tableaux
                                                      ^                     │
                                                      └──── lue à la demande (statistiques longues)
 Vérifications de disponibilité de Grafana (Francfort) ──> /sante de la production et la page publique
```

1. **Le serveur de jeu compte, il n'envoie rien.** Il ne fait aucun appel réseau pour la surveillance. Un agent, sur la même machine mais dans son propre processus, vient lire ses compteurs. Si Grafana Cloud tombe, ou l'agent, le jeu ne le sait pas.
2. **Dans le battement, seulement des opérations de coût fixe**: ajouter un à un compteur, ranger une durée dans un seau d'histogramme dont les bornes sont fixées d'avance. Ni allocation, ni chaîne construite, ni tri. Le reste se calcule quand l'agent lit, deux fois par minute.
3. **La page n'envoie qu'un message de plus par partie**, à la fin, sur la connexion qu'elle a déjà. Aucun script tiers, aucun cookie, aucune adresse de plus dans la politique de sécurité.

## Décisions prises par cette fiche

Micro-décisions techniques, internes à l'étape (PROTOCOLE, « Ce qui ne nécessite pas de solliciter l'humain »).

1. **Un petit module de métriques à nous**, `packages/server/src/metriques/`: compteurs, jauges, histogrammes à seaux fixes, et leur écriture au format texte de Prometheus. Une centaine de lignes, testées, sans dépendance. Pas `prom-client`: ses histogrammes allouent à l'observation selon les étiquettes, et ses métriques par défaut en mesurent beaucoup plus qu'il n'en faut. Chaque combinaison d'étiquettes est créée une fois, à l'avance, jamais dans le battement.
2. **`/metriques` n'est jamais public.** Le serveur l'écoute sur un second port, attaché à `127.0.0.1`, seulement si `PORT_DES_METRIQUES` est posé. Caddy ne le relaie pas. Absent, comme sur Render, en développement et dans les tests: aucun port, aucun compteur lu.
3. **Les étiquettes sont bornées**: le mode, la carte, la classe d'appareil (téléphone ou ordinateur), jamais un pseudo, un compte, une partie ni une adresse. Budget: **moins de 2 000 séries**, machine comprise, sur les 10 000 offertes.
4. **L'agent est Grafana Alloy**, en service du système sur la machine Oracle, bridé par systemd (`CPUQuota=25%`, `MemoryMax=300M`). Il lit `/metriques` toutes les 30 secondes, les métriques de la machine (processeur, mémoire, disque, réseau) par son exportateur intégré, et les journaux des conteneurs `neon-ninja-*`. Sa configuration vit dans `deploiement/oracle/` et s'installe par `installer.sh`, comme Caddy.
5. **Les tableaux de bord et les alertes vivent dans le dépôt**, en JSON, dans `deploiement/grafana/`, et s'importent par un script sans effet de bord à la relance. Un tableau modifié dans l'interface se réexporte dans le dépôt.
6. **L'historique long vient de la base**, pas des métriques (14 jours seulement): une ligne par partie terminée, invités compris (question 2). Grafana la lit par sa source PostgreSQL, sous un rôle en lecture seule, **seulement quand quelqu'un ouvre le tableau**: aucune alerte ne repose sur la base, pour ne jamais la réveiller seule.
7. **Render, en secours, n'est pas surveillé en continu.** Une vérification toutes les quelques minutes le tiendrait éveillé et consommerait ses 750 heures gratuites. Une vérification par jour suffit à savoir qu'il démarre.

## Ce que montre le tableau de bord

Trois tableaux, chacun lisible sans connaître Prometheus.

### 1. La santé, en ce moment et sur 14 jours

- Production en ligne ou non (vérification de `/sante` toutes les minutes depuis Francfort), et sa version.
- **Le battement**: écart réel entre deux battements (doit rester à 50 ms) et durée d'un battement (doit rester loin sous 50 ms), en médiane, neuvième décile et centile 99, et le nombre de battements en retard. Par mode.
- **Le coût par partie**: durée du battement rapportée au nombre de PNJ et de joueurs. C'est la courbe qui dit à l'avance quand un mode ou une carte approche de la limite: **la courbe qui sert à anticiper les optimisations**.
- **Le poids du flux**: octets envoyés par seconde, par mode, et taille moyenne d'une trame.
- Le processus: mémoire, ramasse-miettes, retard de la boucle d'événements de Node, processeur.
- La machine: processeur, mémoire, disque, réseau. **Avec le 95e centile du processeur sur sept jours, face au seuil de 20 pour cent** sous lequel Oracle peut reprendre la machine.

### 2. Les joueurs, chez eux

Du résumé de fin de partie (question 3), par classe d'appareil et par mode:

- images par seconde, en médiane et au dixième centile des parties;
- part des images d'au moins 50 ms;
- délai aller et retour avec le serveur;
- erreurs de la page, comptées par nature (lot C).

### 3. L'usage

- En direct: parties en cours par mode, joueurs connectés, parties publiques et privées.
- Sur 14 jours, par les métriques: parties lancées et terminées par mode et par carte, joueurs par partie, durée des parties, abandons et reconnexions, inscriptions et connexions aux comptes, joueurs invités et joueurs avec compte.
- Au-delà, par la base: les mêmes chiffres par jour et par semaine depuis la mise en ligne de l'étape, et la rétention des comptes de `pnpm base:mesurer`, en requêtes du tableau.
- Visiteurs distincts par jour, si le porteur du projet le veut (question 4).

### Les alertes, par courriel au porteur du projet

| Alerte                                   | Quand                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| La production ne répond plus             | `/sante` sans réponse deux minutes de suite                                                     |
| La page publique ne répond plus          | `https://ninja.dendrolag.fr` sans réponse deux minutes de suite                                 |
| Le serveur peine                         | plus de 1 pour cent de battements en retard sur 10 minutes, avec au moins une partie            |
| La mémoire grimpe                        | mémoire du serveur au-dessus de 1 Go, ou en hausse continue sur six heures                      |
| La production est en retard sur `master` | le commit de `/sante` n'est pas le dernier commit qui touche le jeu, une heure après la poussée |
| Oracle pourrait reprendre la machine     | 95e centile du processeur sur six jours sous 20 pour cent                                       |

La dernière ligne demande une vérification que Grafana ne sait pas faire seul: un workflow GitHub planifié, toutes les heures, qui compare `/sante` à la tête de `master` avec la même règle que la mise en ligne (`deploiement/miseEnLigne.ts`: un commit de documentation ne compte pas) et échoue en le disant. GitHub prévient par courriel d'un workflow planifié en échec.

## Le budget de performance, et comment on le prouve

| Quoi                       | Plafond                                                             | Mesuré par                                                          |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Durée du battement         | aucune hausse au-delà de l'écart entre deux séries du banc          | `pnpm charge --banc`, avant et après, trois séries chacun           |
| Le jeu                     | inchangé                                                            | empreinte des parties de référence, identique                       |
| Lecture de `/metriques`    | sous 5 ms avec 24 parties pleines                                   | banc, en lisant la route pendant la charge                          |
| Mémoire du serveur         | moins de 5 Mo de plus                                               | banc                                                                |
| Page                       | aucune hausse de la durée d'image, moins de 2 Ko compressés de plus | banc du rendu de la CI, avant et après; taille de `app.js`          |
| Agent Alloy sur la machine | moins de 5 pour cent d'un cœur en moyenne, moins de 300 Mo          | ses propres métriques, sur 24 heures                                |
| Base Neon                  | aucune requête sans tableau ouvert                                  | tableau de consommation de Neon, une semaine après la mise en ligne |
| Séries actives             | moins de 2 000                                                      | page d'usage de Grafana Cloud                                       |

## Questions au porteur du projet

1. **Grafana Cloud gratuit, hébergé ailleurs, ou un Grafana installé sur la machine Oracle ?** Recommandation: Grafana Cloud, pour qu'une panne de la machine ne rende pas aveugle, et pour n'ajouter au serveur du jeu qu'un agent bridé. Le prix: 14 jours d'historique pour les métriques, compensé par la base pour l'usage.
2. **Une ligne en base pour chaque partie terminée, invités compris ?** Mode, carte, durée, nombre de joueurs, dont invités et comptes, dont téléphones, partie publique ou privée, heure de fin. Rien de personnel. Recommandation: oui, c'est le seul historique de l'usage au-delà de 14 jours. Le prix: une partie de seuls invités réveille la base, quelques minutes de calcul, là où elle n'en réveillait aucune. À l'usage actuel, une à deux heures de calcul par mois sur cent. Variante plus sobre: un total par jour, écrit une fois par jour et à l'arrêt du serveur.
3. **Un relevé de performance discret chez tous les joueurs ?** À chaque image, la page range sa durée dans un des douze seaux d'un histogramme fixe (une lecture d'horloge et une addition), puis envoie le résumé à la fin de la partie: cadence, part des images lentes, délai avec le serveur, téléphone ou ordinateur. Recommandation: oui, c'est la seule façon de savoir comment le jeu tourne sur les appareils des autres. Le banc du rendu prouvera que rien ne change. Sans lui, le tableau 2 se limite à ce que voit le serveur.
4. **Compter les visiteurs distincts par jour ?** Sans cookie: le serveur garde en mémoire, le temps d'une journée, l'empreinte de l'adresse et du navigateur salée d'un secret tiré chaque jour et jamais écrit, et n'en publie que le nombre. C'est la méthode de Plausible, sans consentement à demander. Recommandation: oui, faute de quoi « combien de gens viennent » se lit seulement en joueurs connectés. À trancher par le porteur du projet, qui répond du site.
5. **Qui voit le tableau de bord ?** L'offre gratuite compte trois utilisateurs. Recommandation: le porteur du projet seul, sans tableau public. Un tableau public des parties en cours se ferait dans une étape à part, dans la page du jeu.

## Ce que le porteur du projet fait lui-même

La session ne crée pas de compte, ne saisit aucun secret et n'a pas d'accès SSH à la production (mémoire du projet, « Machine Oracle par le porteur »).

1. **Créer le compte Grafana Cloud** gratuit, avec une pile en Europe (Francfort si proposé), puis un jeton d'accès limité à l'écriture des métriques et des journaux, et un second, limité à l'import des tableaux.
2. **Sur la machine Oracle**, recopier `deploiement/oracle/` et relancer `installer.sh`, qui installe Alloy; poser le jeton d'écriture dans `/etc/neon-ninja/alloy`, lisible du seul service, et `PORT_DES_METRIQUES` dans `/etc/neon-ninja/environnement`. La session lui donne les commandes PowerShell exactes.
3. **Dans Neon**, créer le rôle en lecture seule que lira Grafana (la session peut le faire par l'API de Neon avec `NEON_API_KEY`, si le porteur du projet le préfère), puis renseigner la source PostgreSQL dans Grafana.

## Périmètre

### Lot A. Le serveur compte

- `packages/server/src/metriques/`: registre, compteur, jauge, histogramme à seaux fixes, écriture au format texte, et leurs tests.
- Le branchement, sans rien changer à ce que fait le jeu: le battement (écart, durée, par mode, au même endroit que `ChronometreDuBattement.enregistrer`), les octets envoyés, les parties lancées, terminées et abandonnées, les joueurs, les connexions et reconnexions, les comptes (inscriptions, connexions, échecs), les refus du contrôle de version, la boucle d'événements (`monitorEventLoopDelay` de `node:perf_hooks`), la mémoire et le ramasse-miettes.
- Le second port, `PORT_DES_METRIQUES`, sur `127.0.0.1`, et ses tests: absent, rien n'écoute; posé, la route répond, et seulement là.
- `/sante` reste ce qu'il est: la page et la mise en ligne le lisent.

### Lot B. L'historique en base

Selon la réponse à la question 2.

- La table, sa migration, compatible avec la version précédente du serveur (`docs/deploiement.md`, « Migrations de la base »), et son écriture à la fin de chaque partie, hors du battement, comme l'enregistrement actuel. Une écriture qui échoue ne touche ni la partie ni l'enregistrement des comptes.
- Les requêtes des tableaux, testées sur une branche Neon de test.

### Lot C. La page rend compte

Selon la réponse à la question 3.

- L'histogramme des durées d'image dans la boucle de rendu, et le délai avec le serveur, que la page ne mesure pas encore: un aller et retour daté toutes les quelques secondes sur la connexion existante (l'accusé de réception de Socket.IO), jamais à chaque image.
- Le résumé de fin de partie, sa forme et sa vérification dans `packages/shared` (la page ne croit pas le réseau, le serveur non plus), son envoi, et son ajout aux métriques côté serveur. Un résumé mal formé est ignoré et compté.
- Les erreurs de la page (`error`, `unhandledrejection`), comptées par nature et limitées à quelques-unes par partie, par le même chemin.

### Lot D. L'agent, Grafana et les alertes

- La configuration d'Alloy et son installation dans `deploiement/oracle/`.
- Les trois tableaux de bord et les alertes dans `deploiement/grafana/`, et le script qui les importe.
- Le workflow planifié qui compare la production à `master`.
- Les vérifications de disponibilité dans Grafana: production et page toutes les minutes, Render une fois par jour.

### Lot E. Mesure et documentation

- Le budget de performance ci-dessus, relevé et consigné dans `docs/mesures/charge-serveur.md`, nouvelle section.
- `docs/deploiement.md`, section « Surveillance »: où est le tableau de bord, ce que dit chaque tableau, que faire à chaque alerte. Retirer « Rien ne surveille cela automatiquement à ce jour ».
- `CLAUDE.md`: la variable `PORT_DES_METRIQUES`, et une ligne à l'index.

## Hors périmètre

- Toute modification de `packages/sim`.
- Un script d'analyse tiers dans la page, un cookie, une politique de sécurité élargie.
- Le traçage distribué et le profilage continu: rien ne le justifie à un seul serveur.
- La surveillance continue de Render.
- Un tableau public dans la page du jeu.
- Changer une optimisation du jeu à partir de ce que montrera le tableau: chacune deviendra une étape, mesurée.

## Tests requis

- TU du module de métriques: compteur, jauge, seaux d'histogramme, format texte, aucune allocation à l'observation (compteur d'objets ou mesure de tas sur un grand nombre d'observations).
- TI du serveur: `/metriques` absent sans `PORT_DES_METRIQUES`; présent sur `127.0.0.1` seulement; jamais sur le port public; ses chiffres suivent une partie jouée par de vrais clients Socket.IO (une partie lancée, un joueur, des battements, des octets).
- Tests de la base pour la table de l'historique et les requêtes des tableaux.
- TU de la forme du résumé de fin de partie et de son refus; TU de l'histogramme de la page.
- TU du workflow de comparaison à `master`, par la règle déjà testée de `miseEnLigne.ts`.
- Bout en bout: une partie jouée envoie son résumé, et le jeu ne change pas; suite complète au vert.
- Le budget de performance, chiffré avant et après.

## Définition de terminé

1. Le tableau de bord montre, en production, une partie jouée par le porteur du projet: le battement, le flux, les joueurs, la machine, et, selon ses réponses, le résumé de sa page et sa ligne en base.
2. Chaque alerte a été déclenchée une fois pour de vrai ou par une règle de test, et le courriel reçu.
3. Le budget de performance est tenu, chiffres consignés.
4. Empreinte des parties de référence identique, couverture de `packages/sim` inchangée.
5. CI verte, mise en ligne faite, `docs/deploiement.md` à jour.

## Points de vigilance

- **Ne jamais mettre d'identifiant en étiquette**: une étiquette par partie ou par joueur ferait exploser le nombre de séries, donc l'offre gratuite, et ferait fuir des données personnelles.
- **Le serveur redémarre à chaque mise en ligne**: ses compteurs repartent de zéro. C'est prévu par Prometheus (`rate` et `increase` savent les remises à zéro), mais pas par un compteur lu à la main. Les tableaux n'utilisent que ces fonctions.
- **Bleu et vert**: deux conteneurs se succèdent à chaque mise en ligne. L'agent lit l'emplacement en service (`/var/lib/neon-ninja/actif`) ou les deux ports, et les métriques portent l'emplacement en étiquette, pour ne pas mêler les deux pendant la bascule.
- **La base ne doit pas devenir une source d'alerte**: une alerte qui l'interroge la réveillerait toutes les minutes.
- **Le jeton d'écriture de Grafana est un secret**: jamais dans le dépôt, jamais dans la page.

## Rituel de fin de session

Handoff depuis `docs/handoffs/_TEMPLATE.md`. Étape invisible au joueur, sauf le relevé de la page s'il est retenu, qui ne se voit pas non plus: pas de changement de `NUMERO_DE_VERSION`.

## Réconciliation

À remplir par la session de l'étape.
