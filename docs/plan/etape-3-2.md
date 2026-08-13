# Fiche étape 3.2 - Authentification

Brief de session. Objectif unique: inscription, connexion, gestion de session, et authentification de la connexion réseau, de sorte qu'une room soit rejointe par un compte identifié.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.1 (schéma et accès base), puis cette fiche.

## Objectif

Permettre à un joueur de créer un compte et de se connecter, gérer sa session, et authentifier sa connexion Socket.IO. À la fin, le pseudo et le niveau affichés au salon viennent du compte réel, remplaçant la source temporaire de l'étape 2.4.

## Périmètre

1. Inscription: créer un compte avec un pseudo unique et un mot de passe, le mot de passe étant haché avec un algorithme robuste. Compléter la table compte de l'étape 3.1 avec le champ de mot de passe haché.
2. Connexion: vérifier les identifiants et ouvrir une session. Choisir entre session par cookie ou jeton, et consigner le choix. Pour un jeu web avec Socket.IO, une session qui authentifie aussi la connexion réseau est cohérente.
3. Authentification de la connexion Socket.IO: à la connexion réseau, identifier le compte. Une room n'est rejointe que par un compte authentifié.
4. Brancher le salon: remplacer la source temporaire de pseudo et de niveau de l'étape 2.4 par les données du compte authentifié.

## Hors périmètre

- Aucune progression branchée sur la fin de partie. C'est l'étape 3.3.
- Aucune récupération de mot de passe, aucune connexion par fournisseur tiers en v1, sauf décision contraire. Rester simple et sûr.
- Aucune interface de connexion. Les écrans sont construits en phase 4. Ici on teste via les contrats.

## Tests requis

- TI d'inscription: création d'un compte, refus d'un pseudo déjà pris.
- TI de connexion: identifiants valides acceptés, invalides refusés.
- TI d'accès: une action nécessitant un compte est refusée sans authentification.
- TI réseau: une connexion Socket.IO non authentifiée ne peut pas rejoindre de room, une connexion authentifiée le peut, avec le pseudo et le niveau du compte.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Inscription et connexion fonctionnent, mots de passe hachés.
2. La session est gérée, et le choix cookie ou jeton est consigné.
3. La connexion Socket.IO est authentifiée, la jonction de room exige un compte.
4. Le salon affiche le pseudo et le niveau réels du compte.
5. Les TI passent.

## Rituel de fin de session

Écrire docs/handoffs/etape-3-2-handoff.md. Décrire le mécanisme de session retenu et la façon dont la connexion réseau est authentifiée. Prochaine action exacte pour l'étape 3.3: brancher la progression sur la fin de partie (XP, niveau, pièces, points de ligue, rang) et enregistrer le résultat. Commiter.
