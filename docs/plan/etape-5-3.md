# Fiche étape 5.3 - Déploiement

Brief de session. Objectif unique : mettre la réécriture en ligne, la page et le serveur de jeu, sur des offres gratuites, avec un déploiement automatique et vérifié à chaque commit vert de `reecriture`.

## Rituel de début de session

Lire CLAUDE.md, le dernier handoff (`docs/handoffs/etape-7-1-handoff.md`), puis cette fiche.

## Réconciliation du 14 septembre 2026

La fiche d'origine visait un déploiement **en parallèle de l'ancien monolithe**, avec drapeau de fonctionnalité, fraction du trafic et retour arrière vers l'ancienne version. Le ROADMAP (section 3, jalon 5, et écart 6 de la section 5) l'a ramenée à un déploiement simple : le legacy n'a pas de joueurs en ligne, il n'y a rien à basculer. La fiche est réécrite en conséquence.

Décisions du porteur du projet, prises au début de la session :

1. **Aucun nouveau mode avant la fin du socle.** Chasse, Battle Royale, Équipes et Chaos attendent que tout le reste soit réécrit. Le jalon 5 passe donc directement à cette étape.
2. **La solution la plus performante, évolutive et durable, sur des offres entièrement gratuites au début.** Le porteur a déjà un compte Vercel et un compte Render.
3. **Serveur Render en offre gratuite.**
4. **Autonomie après la mise en place** : le porteur fournit des clés d'API, Claude Code crée, déploie et vérifie seul.
5. **Base de production : la branche principale du projet Neon `neon-ninja`**, celle de `DATABASE_URL`. Les branches de test sont créées sans ses données.

Ce que la fiche d'origine ne savait pas, et que l'état du dépôt impose :

- **La page se connectait au serveur qui l'avait servie** (`io()` sans adresse, routes des comptes sans origine, politique de sécurité `'self'`). Servir la page ailleurs demande d'écrire l'adresse du serveur dans la page à l'empaquetage.
- **Le serveur Render gratuit se met en veille** après quinze minutes sans trafic, se réveille en une minute environ, et dispose d'un petit processeur. D'où le choix d'architecture ci-dessous.
- **La commande préalable au déploiement de Render n'existe pas en offre gratuite** : les migrations s'appliquent dans la commande de démarrage.
- **Fly.io** : écarté pour l'instant. Render propose Francfort, la région de la base Neon (AWS Francfort).
- **Dettes renvoyées à 5.3 par les handoffs précédents** : poser `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` ; vérifier la compression de `app.js` ; vérifier la console d'une partie dans un vrai navigateur, travailleurs compris ; la latence n'a été mesurée que sur un réseau local.

## Architecture retenue

- **Page sur Vercel** : la page empaquetée et les ressources (19 Mo de cartes et de sons), servies par le réseau de diffusion de Vercel, compressées, disponibles instantanément même quand le serveur dort.
- **Serveur de jeu sur Render**, offre gratuite, Francfort : le jeu seul, sans la page (`SERVIR_LA_PAGE=non`).
- **Base sur Neon** : branche principale du projet `neon-ninja`, par le pooler.

## Périmètre

1. **Page à deux origines** : l'adresse du serveur de jeu et la version sont écrites dans la page à l'empaquetage ; la politique de sécurité du contenu est écrite une seule fois, dans le paquet partagé, pour le serveur de développement et pour Vercel ; sortie Vercel au format Build Output API.
2. **Contrôle de version** : une page ne parle qu'au serveur construit du même commit ; les autres sont refusées avec un motif qui dit de recharger, et l'accueil ne propose que cela.
3. **Serveur de production** : le serveur ne sert pas la page ; la route de santé rend la version, l'activité (parties, joueurs, connexions) et l'adresse vue du demandeur ; les migrations s'appliquent au démarrage.
4. **Hébergement** : service Render (gratuit, Francfort, branche `reecriture`, sans déploiement automatique propre), projet Vercel, `DATABASE_URL` dans un groupe d'environnement Render posé par le porteur du projet.
5. **Déploiement automatique** : un job de la CI, après les deux jobs verts, sur `reecriture` seulement. Il prépare la page, déploie le serveur du commit et attend qu'il soit en ligne, vérifie sa version, puis met la page en ligne et la vérifie.
6. **Vérifications en ligne** : une partie jouée dans un vrai navigateur sur la production, console comprise ; un compte créé ; compression de la page ; `MANDATAIRES_DE_CONFIANCE` mesuré par la route de santé ; latence mesurée depuis la France.
7. **Documentation d'exploitation** : `docs/deploiement.md`, avec les variables, la procédure, le retour arrière et la surveillance.

## Hors périmètre

- Un nom de domaine propre, les offres payantes, plusieurs instances du serveur de jeu.
- La fusion de `reecriture` dans `master` et le retrait du legacy : étape 6.1.
- Les nouveaux modes : après la fin du socle.

## Tests requis

- TU : la politique de sécurité (avec et sans serveur de jeu, origines refusées) ; le contrôle de version ; la configuration de la page ; la configuration et le tri des fichiers de la sortie Vercel ; le modèle et l'écran d'accueil devant une page d'une autre version.
- TI : le refus de version par le serveur, avec de vrais clients Socket.IO puis avec le vrai client ; la route de santé (version, activité, adresse à travers les mandataires de confiance).
- Vérifications de mise en ligne : le déploiement échoue si la route de santé ne rend pas la version déployée, ou si la page en ligne ne porte pas la politique attendue.

## Définition de terminé

Conditions de ROADMAP réunies, plus :

1. La page et le serveur de jeu tournent en production, sur des offres gratuites.
2. Chaque commit vert de `reecriture` se déploie seul, et le déploiement vérifie ce qu'il a mis en ligne.
3. Une page d'une autre version que le serveur est refusée, et le joueur sait qu'il doit recharger.
4. `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` sont posés et vérifiés en ligne.
5. Une partie a été jouée en production, sans erreur dans la console.
6. L'exploitation et le retour arrière sont documentés.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-3-handoff.md` : adresses de production, mécanisme de déploiement, retour arrière, indicateurs surveillés, mesures. Prochaine action exacte : l'étape suivante de la section 3 du ROADMAP (6.1). Commiter.
