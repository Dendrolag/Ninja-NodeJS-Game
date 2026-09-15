# Démarrage - Comment amorcer le dépôt

Ce que contient cette archive et comment s'en servir pour lancer la réécriture avec Claude Code.

## Contenu de l'archive

- CLAUDE.md, la constitution du projet, lue automatiquement par Claude Code à chaque session.
- .claude/rules/sim-purity.md, l'invariant de pureté du cœur de simulation.
- docs/plan/ROADMAP.md, la carte des 23 étapes.
- docs/plan/PROTOCOLE.md, les règles d'enchaînement autonome entre sessions.
- docs/plan/etape-X-Y.md, les 23 fiches détaillées, une par étape et par conversation.
- docs/handoffs/_TEMPLATE.md, le modèle de recap de fin de session.
- docs/design/README.md, le journal vivant de conception (questions ouvertes, propositions, décisions).
- docs/plan-redemarrage-neon-ninja.md, le plan d'ensemble et la stratégie de tests, document de contexte.

## État au 13 août 2026

Ce document décrivait l'amorçage d'un dépôt neuf à partir de l'archive. Le corpus est désormais installé dans le dépôt existant, et les maquettes sont déposées. Il reste à créer le dossier legacy/, ce que fait l'étape 0.1.

1. Maquettes. **Faites.** docs/design/ contient le prototype (Neon Ninja.html), sa source (Neon Ninja.dc.html), les pictogrammes (Icon.dc.html), les sept captures dans screenshots/, et le document de passation (HANDOFF-CLAUDE-DESIGN.md). L'étape 0.3 les lit pour produire le cadrage fonctionnel. Lire d'abord l'avertissement en tête de docs/design/README.md: ces maquettes sont des propositions à challenger, pas une spécification.

2. Code legacy. Créer un dossier legacy/ à la racine et y copier les fichiers actuels du jeu: server.js, client.js, game-constants.js, MapManager.js, AudioManager.js, index.html, styles.css. Ne pas copier server-v0-8-5.js, c'est un doublon d'ancienne version. Ce dossier est une référence en lecture seule, jamais modifiée. Il sert aux tests de caractérisation de l'étape 0.2 et au portage de la phase 1.

## Lancer la première session

1. Décompresser l'archive à la racine du nouveau dépôt.
2. Ajouter les maquettes et le dossier legacy comme indiqué ci-dessus.
3. Initialiser Git.
4. Ouvrir Claude Code dans le dépôt.
5. Lui donner comme tâche d'exécuter docs/plan/etape-0-1.md.

Ensuite, Claude Code avance seul, une étape par conversation: il lit le dernier handoff et la fiche de l'étape, exécute dans le périmètre, vérifie la définition de terminé, écrit le handoff, puis repart d'un contexte neuf pour l'étape suivante. L'ordre est 0.1, 0.2, 0.3, puis 1.1 jusqu'à 6.1.

## Décisions déjà prises

- Stack: TypeScript, Node.js avec Express et Socket.IO, PixiJS pour le rendu, PostgreSQL sur Neon.
- Hébergement de départ, entièrement gratuit: client sur Vercel, serveur sur Render, base sur Neon via le pooler. Fly.io prévu pour la production quand la latence le justifiera.
- Périmètre v1: mode Classique seul, parties publiques et privées, comptes et progression de base. Les trois cartes existantes du legacy. Autres modes, pass de saison, skins et clans reportés, mais le schéma reste extensible.
- Mobile correct, bureau prioritaire.

Le détail et les raisons de ces décisions sont dans docs/design/README.md et dans les fiches concernées.

## Questions de conception encore ouvertes

Consignées dans docs/design/README.md: le schéma de contrôle tactile, le modèle de rang, les gemmes en v1, la présentation des modes non construits, la correspondance des effets du HUD avec les bonus et malus, les défis du jour, et la fourchette de faux ninjas. Elles se tranchent au fil de l'eau, et les décisions se consignent dans le journal de ce même fichier.
