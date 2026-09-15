# Handoff - Étape 6.1 Retrait du legacy

Date: 15 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Faire de la réécriture la seule version du jeu, dans le dépôt comme en ligne, et retirer ce qui reste de la version d'origine.

## Ce qui a été fait

- **Ressources de la version d'origine vérifiées avant tout retrait.** Les trois adresses listées par la fiche servaient toujours le jeu d'origine : `client.js` et `styles.css` identiques, par empreinte git, à ceux de `legacy/`, sur `to-the-point.onrender.com`, `ttp-eight.vercel.app` et `neon-ninja-gules.vercel.app`. Aucun groupe d'environnement ni domaine personnalisé n'en dépendait. Le service Render « To The Point » servait le commit `8842676` (déployé le 9 avril 2025), sans déploiement automatique.
- **Un ordre imposé, relevé en vérifiant** : les projets Vercel `ttp` et `neon-ninja` étaient reliés au dépôt et construisaient tout commit poussé sur `master` (leur étape de construction ignorée n'écartait que les autres branches). Pousser la fusion avant de les retirer y aurait construit la réécriture avec leurs anciens réglages. Ils ont donc été retirés avant la fusion.
- **Trois décisions du porteur du projet**, demandées au début : supprimer les trois ressources (« supprime tout ce qui doit l'être pour ne garder que la nouvelle version à jour ») ; supprimer la branche `reecriture` après la fusion ; garder la poussée directe sur `master` et corriger la documentation qui annonçait une fusion bloquée par une CI rouge, alors qu'aucune branche n'a jamais été protégée.
- **Retrait** : projets Vercel `ttp` et `neon-ninja` supprimés (leurs adresses répondent 404) ; service Render « To The Point » suspendu (503), puis supprimé (404). Le projet Vercel `neon-ninja-jeu` et le service Render « Neon Ninja » de la réécriture ne sont pas touchés, ni la base Neon.
- **Archive de la version d'origine** : étiquette annotée `v0.8.6` posée sur `bc44b32`, l'ancien sommet de `master`, et poussée. Le lien d'accueil du dépôt GitHub, qui menait à `to-the-point.onrender.com`, mène à `https://neon-ninja-jeu.vercel.app`.
- **Production sur `master`** : le job « Mise en ligne » de la CI, sa vérification du dernier commit et sa règle d'annulation suivent `master` ; le service Render « Neon Ninja » est passé de la branche `reecriture` à `master` par l'API (déploiement automatique toujours coupé).
- **Fusion** : commit `5a05351`, de parents `bc44b32` (ancien `master`) et `8a68455` (dernier commit de `reecriture`), dont le contenu est exactement celui de `reecriture`. Poussé en avance rapide sur `origin/master`, sans réécrire son historique. Les six commits propres à `master` depuis l'ancêtre commun `fe8c955` ne touchaient que le client, les styles, le README, le journal des versions et une capture d'écran : le client, les styles et la page de la v0.8.6 sont déjà dans `legacy/`, le reste demeure dans l'historique et sous l'étiquette.
- **Documentation** : CLAUDE.md, PROTOCOLE.md, `docs/deploiement.md`, le journal de conception, le ROADMAP et la fiche décrivent la nouvelle situation ; un `README.md` court est posé à la racine, la page d'accueil du dépôt sur sa branche principale n'en ayant plus.

## Fichiers créés ou modifiés

Commit `8a68455`, la production suit `master` :

- `.github/workflows/ci.yml` : job « Mise en ligne », dernier commit lu sur `master`, exécutions de `master` jamais annulées ; l'en-tête dit que c'est la mise en ligne, et non la poussée, qui attend la CI verte.
- `deploiement/deployer.ts` : commentaire, la branche qui le lance.
- `docs/deploiement.md` : branche `master`, retour arrière sur `master`, ressources d'origine retirées, heures gratuites de Render non partagées.
- `CLAUDE.md` : base de référence archivée sous `v0.8.6`, intégration continue décrite telle qu'elle est, comment jouer à la version d'origine.
- `docs/plan/PROTOCOLE.md` : cadre permanent sur `master` ; l'interdiction de toucher `master` retirée.
- `docs/design/README.md` : deux décisions au journal, la fusion et le retrait, la poussée directe.
- `README.md` (créé) : ce qu'est le jeu, où jouer, comment lancer, où lire.
- `package.json` : description sans « reecriture ».

Commit `5a05351` : la fusion, sans autre changement.

Commit de ce handoff :

- `docs/plan/ROADMAP.md` : étape 6.1 terminée, suite du jalon.
- `docs/plan/etape-6-1.md` : réconciliation du 15 septembre.
- `docs/handoffs/etape-6-1-handoff.md` (créé).

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés : aucun, l'étape ne change aucun code du jeu. Les tests requis par la fiche sont des vérifications en ligne, ci-dessous.
- Résultat avant la fusion, en local : **1 743 tests unitaires sur 1 743** (projet `unitaires`) ; types des trois projets compilés sans passer par rtk (paquets, tests, bout en bout), linter et formatage verts. Le projet `base` tourne en CI.
- Couverture de `packages/sim` : inchangée (aucun code touché), 99,77 pour cent au handoff 5.4.
- Aucune régression de caractérisation.
- Vérifications de la fiche :
  - CI verte sur `master` après la fusion, mise en ligne comprise : voir « État de la CI ».
  - Page et serveur en production du commit de fusion : voir « État de la CI ».
  - Anciennes adresses : `to-the-point.onrender.com`, `ttp-eight.vercel.app` et `neon-ninja-gules.vercel.app` répondent 404.

## Décisions et écarts au plan

Deux entrées au journal de `docs/design/README.md`, datées du 15 septembre 2026.

### 1. Une fusion dont le contenu est celui de la réécriture

Une fusion ordinaire aurait mis en conflit les fichiers que `master` modifiait et que `reecriture` avait déplacés dans `legacy/`. Le commit de fusion a été construit avec le contenu de `reecriture` et les deux historiques pour parents : rien du jeu d'origine n'est perdu (étiquette, historique, `legacy/`), et `master` avance sans poussée forcée. `legacy/README.md` dit encore que les fichiers non copiés « restent accessibles dans l'historique Git et sur `master` » : vrai pour l'historique et l'étiquette `v0.8.6`, plus pour le sommet de `master`. Ce dossier ne se modifie jamais ; l'étiquette est citée dans CLAUDE.md.

### 2. Écarts à la fiche

- La branche `reecriture` est supprimée, et une étiquette `v0.8.6` est posée : ni l'une ni l'autre n'étaient prévues, décidées avec le porteur du projet.
- La correction de la documentation sur la protection des branches (CLAUDE.md, CI) n'était pas prévue : défaut relevé en route, traité selon la règle 7.
- Un `README.md` à la racine, non prévu par la fiche.
- La suppression de « To The Point » et le passage du service de jeu sur `master` ont d'abord été refusés par l'outil de Claude Code (motif : déploiement en production), puis faits après un second accord du porteur du projet.

## Problèmes connus et dette

Nouveau : aucun.

Résolu par cette étape, repris des handoffs précédents : les heures gratuites de Render partagées avec « To The Point ».

Repris du handoff 5.4, inchangé : une page privée de processeur perd sa connexion au serveur sans la rétablir (étape 2.5) ; la pluie coûte au chargement du décor ; un point flottant manqué une fois en jeu ; la fluidité et le lancement sur iPhone restent à confirmer sur un vrai téléphone ; en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone ; les erreurs d'un travailleur échappent aux scénarios de bout en bout ; les limites de tentatives vivent en mémoire de l'instance ; le relevé des contacts et le lissage du client restent en carré du nombre d'entités ; l'outil de Vercel est téléchargé par npx à chaque mise en ligne ; des déploiements Vercel non promus restent de la première mise en ligne ; le jeton Vercel expire le 14 septembre 2027. Les sons et la musique restent à écouter par le porteur du projet (cas C21 de la grille de recette).

Anciennes branches restées sur GitHub, en archive, sans effet sur la production : `mode-strategique` (v0.9.0, référence du mode Tactique), `refacto`, `claude/audit-rewrite-hbnwgy`.

## État de la CI

- `5a05351` (fusion, avec `8a68455`) : **verte** sur `master`, exécution 34956438323 : « Types, linter et tests » (1 min 50 s), « Bout en bout » (5 min 29 s) et **« Mise en ligne »** (2 min 42 s). La mise en ligne est partie, le code de mise en ligne ayant changé depuis `4317096` : page envoyée, serveur construit et en ligne, « Le serveur de jeu : conforme », page promue, « La page publique : conforme ».
- Vérifié ensuite depuis la machine de développement : `https://neon-ninja.onrender.com/sante` rend la version `5a05351c4845d98b69901fc633a2c30d30ecee58` ; `https://neon-ninja-jeu.vercel.app/` répond 200 et son `app.js` porte ce commit et l'adresse du serveur de jeu ; les trois anciennes adresses répondent 404.
- Page de production ouverte dans un navigateur : accueil affiché, console sans message, `/sante` passé de 0 à 1 connexion ; « Partie rapide » en invité mène au salon d'une partie publique Classique sur Rainy Tokyo, et `/sante` compte alors 1 partie et 1 joueur. Onglet fermé ensuite, sans lancer la partie.
- Le commit de ce handoff ne touche que la documentation : sa mise en ligne doit s'arrêter d'elle-même, la production restant sur `5a05351`.

Plus de branche `reecriture` : sur GitHub restent `master` et trois branches d'archive.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 2.5, reconnexion en cours de partie**, puis 3.4, gestion du mot de passe ; leur ordre est à confirmer par le porteur du projet. Aucune fiche n'existe encore : dans une conversation neuve, sur `master`, rédiger `docs/plan/etape-2-5.md` selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.5 du ROADMAP (section 4) et de la contrainte héritée de la règle 11 (le joueur reste dans l'état de la partie pendant son délai de retour), la commiter, puis l'exécuter. Les fonctionnalités reportées (autres modes, pass de saison, skins, clans) se planifient ensuite au même format de fiches et de handoffs.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-5.md`, à rédiger au début de la session
