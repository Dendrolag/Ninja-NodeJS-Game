# Fiche étape 5.16 - L'usage et l'adoption du jeu

Brief de session. Objectif unique: **savoir qui joue à quoi, d'où viennent les visiteurs, et si une publication sur les réseaux amène des joueurs qui restent**. Sans cookie, sans script tiers, et sans réveiller la base pour rien.

## Origine de cette fiche

Demande du porteur du projet du 11 octobre 2026: un outil de surveillance gratuit, avec « les statistiques d'utilisation et diverses métriques », puis « suivre l'évolution de l'adoption du jeu quand je commencerai à le partager sur les réseaux ». Le même jour, il a donné la priorité à la fluidité des parties: « le plus important à surveiller dans un premier temps ». La fiche d'origine a donc été coupée en deux. L'étape `5.15` installe la surveillance et suit la fluidité; celle-ci vient ensuite, sur ce que `5.15` aura installé.

Réponses du porteur du projet, du 11 octobre 2026 (questions de la fiche 5.15, gardées dans sa section « Questions soumises »): Grafana Cloud, pour lui seul; une ligne en base par partie terminée, invités compris; les visiteurs distincts par jour, sans cookie; « tout mesurer ».

## Ce qu'on sait en entrant

- **Ce qui existe après `5.15`**: Grafana Cloud, l'agent Alloy sur la machine Oracle, le module de métriques du serveur et sa route locale `/metriques`, le message périodique de la page pendant une partie. Réconcilier avec le handoff de `5.15` avant d'exécuter.
- **Les parties d'invités ne laissent aucune trace.** `ServeurSocket.ts` n'enregistre une fin de partie que si au moins un compte y a joué (`fin.resultats.length === 0`, ligne 1642 au commit `437c511`).
- **`pnpm base:mesurer`** (étape 3.7) lit la rétention des comptes, à la main. Aucun relevé fait à ce jour (`docs/mesures/retention.md`).
- **La base Neon gratuite a 100 heures de calcul par mois** et s'endort après 5 minutes sans requête. Elle ne se lit qu'à la demande, et s'écrit rarement.
- **Grafana Cloud gratuit garde 14 jours de métriques.** L'historique long vient de la base.

## Décisions prises par cette fiche

1. **Une ligne en base par partie terminée, invités compris**: mode, carte, durée, nombre de joueurs, dont invités et comptes, dont téléphones, partie publique ou privée, heure de fin. Rien de personnel. Écrite à la fin de la partie, hors du battement, comme l'enregistrement actuel.
2. **Les visiteurs distincts par jour, sans cookie ni stockage dans le navigateur.** Le serveur garde en mémoire, le temps d'une journée, l'empreinte de l'adresse et du navigateur salée d'un secret tiré chaque jour par `node:crypto` et jamais écrit, et n'en publie que le nombre. Tout s'oublie à minuit, heure de Paris, et à chaque redémarrage; un redémarrage dans la journée peut compter deux fois un visiteur, ce qui se lit dans le tableau à côté des mises en ligne. C'est la méthode de Plausible: aucun consentement à demander.
3. **La provenance de chaque arrivée, dans une liste fermée**: X, Instagram, TikTok, Facebook, Reddit, Discord, YouTube, LinkedIn, Twitch, moteur de recherche, lien d'invitation d'un ami, accès direct, autre. Elle se lit d'abord dans le paramètre `utm_source` de l'adresse, ensuite dans le site d'origine (`document.referrer`), réduite à sa catégorie dans la page même, par une fonction pure de `packages/shared`: ni l'adresse complète ni le paramètre brut ne quittent la page.
4. **Le parcours**, par provenance et par jour: arrivées, puis visiteurs qui ont joué au moins une partie, puis comptes créés, puis comptes revenus sept jours après. Le serveur retient la catégorie d'une connexion le temps de la connexion seulement, et celle d'un compte à son inscription (une colonne de `comptes`, vide pour les comptes existants).
5. **Un total par jour des arrivées**, par provenance et par appareil, écrit en base une fois par jour et à l'arrêt du serveur (`fermer()`), ajouté au total déjà écrit pour ce jour.
6. **Grafana lit la base par sa source PostgreSQL**, sous un rôle en lecture seule, **seulement quand quelqu'un ouvre le tableau**. Aucune alerte ne repose sur la base.

**À savoir pour publier**: les applications d'Instagram, de TikTok et souvent de X ne disent pas d'où vient le visiteur. Un lien partagé doit porter sa source, par exemple `https://ninja.dendrolag.fr/?utm_source=tiktok`; la redirection de l'ancienne adresse Vercel garde le paramètre. `docs/deploiement.md` donnera un lien par réseau.

## Ce que montrent les tableaux

### L'usage

- En direct: parties en cours par mode, joueurs connectés, parties publiques et privées.
- Sur 14 jours, par les métriques: parties lancées et terminées par mode et par carte, joueurs par partie, durée des parties, abandons et reconnexions, inscriptions et connexions aux comptes, joueurs invités et joueurs avec compte.
- Au-delà, par la base: les mêmes chiffres par jour et par semaine depuis la mise en ligne de l'étape, et la rétention des comptes de `pnpm base:mesurer`, en requêtes du tableau.
- Les heures et les jours où l'on joue, pour savoir quand publier et quand ne pas mettre en ligne.

### L'adoption

- Visiteurs distincts par jour.
- Arrivées par provenance, par jour, avec les publications du porteur du projet en annotations.
- Le parcours par provenance, de l'arrivée au retour à sept jours.
- La même chose semaine par semaine depuis la mise en ligne de l'étape, par la base.

## Ce que le porteur du projet fait lui-même

**Dans Neon**, créer le rôle en lecture seule que lira Grafana (la session peut le faire par l'API de Neon avec `NEON_API_KEY`, s'il le préfère), puis renseigner la source PostgreSQL dans Grafana.

## Périmètre

### Lot A. Le serveur compte l'usage

- Les compteurs d'usage dans le module de métriques de `5.15`: parties lancées, terminées et abandonnées par mode et par carte, joueurs par partie, durée, connexions aux comptes, inscriptions, invités et comptes.
- Les visiteurs distincts du jour, et leurs tests.
- Le message d'arrivée: sa forme et sa vérification dans `packages/shared`, son ajout aux arrivées et au parcours.

### Lot B. L'historique en base

- La table des parties jouées et la table des arrivées par jour, leurs migrations, compatibles avec la version précédente du serveur (`docs/deploiement.md`, « Migrations de la base »), leurs écritures. Une écriture qui échoue ne touche ni la partie ni l'enregistrement des comptes.
- La colonne de provenance de `comptes`.
- Les requêtes des tableaux, testées sur une branche Neon de test.

### Lot C. La page

- La catégorie de provenance, calculée à l'arrivée, envoyée avec la classe d'appareil sur la connexion qu'elle ouvre déjà, et jointe à une demande d'inscription.

### Lot D. Tableaux et documentation

- Les tableaux de l'usage et de l'adoption dans `deploiement/grafana/`.
- `docs/deploiement.md`: les liens à partager sur chaque réseau, et ce que dit chaque tableau.
- `docs/mesures/retention.md`: renvoyer au tableau.

## Hors périmètre

- Toute modification de `packages/sim`.
- Un script d'analyse tiers, un cookie, un stockage dans le navigateur, une politique de sécurité élargie.
- Un tableau public dans la page du jeu.

## Tests requis

- TU de la catégorie de provenance: chaque réseau par `utm_source` et par site d'origine, majuscules et sous-domaines (`m.facebook.com`, `l.instagram.com`, `t.co`), un paramètre inconnu rangé dans « autre », jamais la valeur brute.
- TU des visiteurs distincts: deux arrivées du même visiteur comptent une fois, deux visiteurs deux fois, le compte repart à minuit, aucune empreinte n'est lisible de l'extérieur.
- Tests de la base pour les deux tables, la colonne de provenance et les requêtes des tableaux.
- TI du serveur: une partie de seuls invités s'enregistre; le parcours suit une connexion de l'arrivée à la partie.
- Bout en bout: une arrivée par `?utm_source=tiktok` est comptée sous TikTok; suite complète au vert.
- Le banc de charge et l'empreinte des parties, inchangés.

## Définition de terminé

1. Le tableau de l'adoption montre l'arrivée du porteur du projet par un lien `utm_source`, sa partie, et la ligne de cette partie en base.
2. Aucune requête à la base sans tableau ouvert, vérifié sur la consommation de Neon une semaine après la mise en ligne.
3. Empreinte des parties de référence identique, banc inchangé, couverture de `packages/sim` inchangée.
4. CI verte, mise en ligne faite, `docs/deploiement.md` à jour.

## Rituel de fin de session

Handoff depuis `docs/handoffs/_TEMPLATE.md`. Étape invisible au joueur: pas de changement de `NUMERO_DE_VERSION`.

## Réconciliation

À remplir par la session de l'étape.
