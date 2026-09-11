# Fiche étape 3.2 - Authentification

Brief de session. Objectif unique: inscription, connexion, gestion de session, et authentification de la connexion réseau, de sorte qu'un compte identifié rejoigne une room sous son pseudo et avec son niveau, tandis qu'un invité continue d'y entrer avec un simple pseudo.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.1 (schéma et accès base), puis cette fiche.

## Objectif

Permettre à un joueur de créer un compte et de se connecter, gérer sa session, et authentifier sa connexion Socket.IO. **Le compte est optionnel** (décision du 11 septembre 2026, voir les ajustements plus bas): à la fin, un joueur connecté apparaît au salon avec le pseudo et le niveau de son compte, et un joueur non connecté y entre en invité, avec un pseudo, comme aujourd'hui.

## Périmètre

1. Inscription: créer un compte avec un pseudo unique et un mot de passe, le mot de passe étant haché avec un algorithme robuste. Compléter le schéma de l'étape 3.1 avec le mot de passe haché, dans la table `comptes` ou dans une table d'identifiants à part, par une migration (`pnpm base:generer`).
2. Connexion: vérifier les identifiants et ouvrir une session. Choisir entre session par cookie ou jeton, et consigner le choix. Pour un jeu web avec Socket.IO, une session qui authentifie aussi la connexion réseau est cohérente. Limiter les tentatives de connexion répétées.
3. Authentification de la connexion Socket.IO: à la connexion réseau, identifier le compte s'il y en a un. Une connexion authentifiée rejoint une room sous le pseudo de son compte; une connexion non authentifiée la rejoint en invité, avec un pseudo validé comme depuis l'étape 2.2.
4. Brancher le salon: le salon distingue les comptes des invités. Un compte y apparaît avec le pseudo et le niveau de son compte (le niveau se déduit de l'XP, voir les ajustements); un invité avec son pseudo, sans niveau.
5. Pseudos des invités: un invité ne doit pas pouvoir se faire passer pour un compte. Choisir et consigner la règle, par exemple: les pseudos des comptes sont refusés aux invités, ou les invités sont marqués comme tels partout où leur pseudo s'affiche.

## Hors périmètre

- Aucune progression branchée sur la fin de partie. C'est l'étape 3.3.
- Aucune récupération de mot de passe, aucune connexion par fournisseur tiers en v1, sauf décision contraire. Rester simple et sûr.
- Aucun compte invisible créé pour chaque navigateur afin de faire progresser les invités (voie C de la décision du 11 septembre 2026). Il reste possible plus tard, sans refonte.
- Aucune interface de connexion. Les écrans sont construits à la reprise des écrans du jalon 3. Ici on teste via les contrats.

## Tests requis

- TI d'inscription: création d'un compte, refus d'un pseudo déjà pris.
- TI de connexion: identifiants valides acceptés, invalides refusés, tentatives répétées limitées.
- TI d'accès: une action réservée aux comptes (lire sa propre progression, par exemple) est refusée sans authentification.
- TI réseau: une connexion authentifiée rejoint une room avec le pseudo et le niveau de son compte; une connexion non authentifiée la rejoint en invité avec son pseudo; un invité ne peut pas se faire passer pour un compte, selon la règle retenue.
- Les scénarios de bout en bout, qui jouent en invités, passent sans modification.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Inscription et connexion fonctionnent, mots de passe hachés.
2. La session est gérée, et le choix cookie ou jeton est consigné.
3. La connexion Socket.IO est authentifiée quand le joueur est connecté; sans compte, il rejoint une room en invité.
4. Le salon affiche le pseudo et le niveau réels d'un compte, et distingue les invités.
5. Les TI passent.

## Ajustements venus du cadrage, étape 0.3 (10 septembre 2026), et décision du 11 septembre 2026

`docs/design/cadrage.md` laissait une question au porteur du projet, qui touche directement cette fiche (section 8 du cadrage). Elle est tranchée.

1. **Peut-on jouer sans compte ? Oui: voie B, décidée par le porteur du projet le 11 septembre 2026.** On entre en invité avec un simple pseudo, comme depuis toujours; le compte est optionnel et n'apporte que la progression (XP, niveau, pièces, points de ligue, historique). Un invité ne laisse aucun résultat de partie, ne gagne ni ne perd de points de ligue, mais compte dans le nombre de joueurs et dans le placement des autres. Écartés: le compte obligatoire, et pour la v1 le compte invisible par navigateur. Détail au journal de `docs/design/README.md`. Cette fiche a été récrite en conséquence: périmètres 3 à 5, tests requis et définition de terminé.
2. **Le pseudo du compte suit les règles du pseudo de partie** (`BORNES_PSEUDO`: 1 à 20 caractères, liste blanche), unique et comparé sans distinction de casse après normalisation. C'est fait depuis l'étape 3.1: `creerCompte` valide avec `validerPseudo`, et la base tient l'unicité par `reperePseudo`, la règle même du salon.
3. **Le niveau affiché au salon se déduit de l'XP totale** du compte: il n'est pas stocké (section 5 du cadrage). Ses seuils ne sont fixés qu'à l'étape 3.3: en attendant, la fonction de déduction peut rendre un niveau provisoire, à condition que ce soit dit dans le handoff.
4. **Point à anticiper pour le choix cookie ou jeton**: le client est prévu sur Vercel et le serveur sur Render, donc sur deux domaines différents. Les navigateurs restreignent de plus en plus les cookies envoyés d'un domaine à l'autre. Un nom de domaine commun aux deux (par exemple `jeu.domaine.fr` et `api.domaine.fr`) ou une session par jeton lèvent la difficulté; le choix est à consigner.
5. **Le serveur de jeu ne dépend pas encore de la base** (handoff 3.1): prévoir qu'il continue de fonctionner en invités seulement sans `DATABASE_URL`, pour le développement local et les scénarios de bout en bout, ou consigner une autre décision.

## Rituel de fin de session

Écrire docs/handoffs/etape-3-2-handoff.md. Décrire le mécanisme de session retenu, la façon dont la connexion réseau est authentifiée, et la règle retenue pour les pseudos des invités. Prochaine action exacte pour l'étape 3.3: brancher la progression sur la fin de partie pour les joueurs qui ont un compte (XP, niveau, pièces, points de ligue, rang) et enregistrer leurs résultats. Commiter.
