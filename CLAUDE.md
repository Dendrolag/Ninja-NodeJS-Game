# CLAUDE.md - Neon Ninja (réécriture)

Constitution stable du projet, lue par Claude Code au début de chaque session. Elle contient les règles durables et l'index. Elle ne contient ni le plan d'exécution (docs/plan/ROADMAP.md) ni l'état d'avancement (docs/handoffs/). La garder courte et stable, cible sous 150 lignes.

## Le projet en bref

- Jeu multijoueur navigateur en temps réel: capturer des bots en les touchant, capturer les autres joueurs pour leur voler tous leurs bots d'un coup.
- Le jeu existe et a été joué. C'est un prototype réussi qui a atteint sa limite structurelle, pas un projet en échec.
- Réécriture complète sur des bases saines. On préserve le gameplay réglé depuis deux ans, on reconstruit tout le reste.
- Objectifs: jeu évolutif, robuste, performant, couvert par des tests, qui tienne dans le temps. Puis parties privées et publiques, plus de 100 bots à l'écran, comptes et progression.

## Règles non négociables

1. **Cœur de simulation pur.** packages/sim ne fait aucune entrée-sortie. Pas de réseau, pas de DOM, pas de Date.now(), pas de Math.random(). Le temps (dt) et l'aléa (graine) sont injectés depuis l'extérieur. Forme du moteur: `tick(etat, entrees, dt)` qui renvoie un nouvel état. La règle complète et son enforcement par le linter sont dans .claude/rules/sim-purity.md.
2. **Déterminisme.** Mêmes entrées, même sortie. Tout hasard passe par le générateur à graine de packages/shared.
3. **Tests d'abord.** On ne porte aucune logique sans un test qui la couvre. La couverture de packages/sim ne baisse jamais.
4. **Le legacy fait foi sur le gameplay.** Les tests de caractérisation de l'étape 0.2 sont la référence du comportement attendu. Ils s'exécutent contre le legacy, jamais contre le nouveau code: ce sont un étalon, pas une cible que packages/sim devrait faire passer. On les lit avant de porter, et on écrit les tests unitaires équivalents dans le nouveau paquet.
5. **Aucun état global mutable.** C'était la cause des blocages du legacy.
6. **Une étape égale une conversation.** On ne fusionne jamais deux étapes.
7. **Aucun bug ni incohérence n'est laissé en place.** Tout défaut découvert en cours de route se traite immédiatement, y compris hors du périmètre de l'étape en cours: code, documentation, constitution. On ne reporte pas, on ne se contente pas de le noter. Deux précisions: `legacy/` reste figé en lecture seule, ses bugs se notent et ne se portent pas; et un défaut trop gros pour l'étape en cours devient une étape à part entière, planifiée dans le ROADMAP, jamais une ligne de dette.

## Cible de couverture

Couvrir profond là où vit le gameplay, léger ailleurs. **80 à 90 pour cent sur packages/sim uniquement.** Viser 100 pour cent partout produirait des tests fragiles sur du code de liaison qui ne protègent de rien.

## Stack

- TypeScript strict partout. pnpm avec workspaces. ESM.
- Serveur: Node.js, Express, Socket.IO. État encapsulé par partie (GameRoom), plusieurs parties via RoomManager.
- Client: PixiJS pour le rendu in-game (lueur néon en filtre GPU), DOM pour les menus.
- Persistance: PostgreSQL via Neon, accès par le pooler. Le branchement Neon fournit les bases de test isolées.
- Hébergement: client sur Vercel, serveur sur Render, base sur Neon. Fly.io si la latence le justifie plus tard.
- Tests: Vitest en unitaire et intégration, Playwright en bout en bout.
- Intégration continue: GitHub Actions, fusion bloquée si la CI est rouge.

## Structure du dépôt

- `packages/sim`, le cœur de simulation pur, le plus testé, zéro entrée-sortie.
- `packages/server`, Express, Socket.IO, GameRoom et RoomManager. Dépend de sim.
- `packages/client`, PixiJS et interface.
- `packages/shared`, constantes, types partagés, générateur à graine, schémas de validation.
- `legacy/`, le code d'origine en lecture seule. **Jamais modifié.**
- `docs/plan/`, la carte et les 24 fiches d'étape.
- `docs/design/`, les maquettes et le journal de conception.
- `docs/handoffs/`, les recaps de fin de session.
- `docs/audit/`, l'audit de l'existant.
- `tests/e2e/`, les scénarios Playwright.

## Base legacy de référence

**master v0.8.6.** C'est la version qui a réellement tourné, et elle correspond au périmètre v1 figé le 29 juin: mode Classique seul.

À savoir: le corpus de fiches d'origine visait `mode-strategique` v0.9.0, qui contient un mode tactique avec capture par cône. Cette version a été écartée. Les fiches concernées (0.1, 0.2, 1.1 à 1.5) ont été rebasées. Le mode tactique reviendra plus tard comme mode enfichable. Détail dans la section 5 de docs/plan/ROADMAP.md.

Note: `server.js` est identique entre v0.8.5 et v0.8.6, seuls le client et les styles diffèrent.

## Commandes

Gestionnaire de paquets: **pnpm**. Node 24. Si `pnpm` est absent: `npm i -g pnpm` (corepack échoue sans droits administrateur sur cette machine).

```bash
pnpm install              # installer les dépendances
pnpm verify               # types, linter et tests: à lancer avant tout commit
pnpm typecheck            # vérifier les types sur tous les paquets
pnpm lint                 # linter, dont l'invariant de pureté de packages/sim
pnpm format               # formater; pnpm format:check pour vérifier sans écrire
pnpm test                 # tests unitaires et d'intégration (Vitest)
pnpm test:watch           # les mêmes, en surveillance
pnpm test:coverage        # couverture, mesurée sur sim et shared
pnpm test:e2e             # tests de bout en bout (Playwright)
```

Lancer un sous-ensemble de tests: `pnpm test <motif>`, par exemple `pnpm test purity` ou `pnpm test packages/sim`.

```bash
pnpm build                # compiler les paquets et empaqueter la page du jeu
pnpm dev                  # compiler, empaqueter, puis lancer le jeu sur http://localhost:3000
pnpm dev:server           # compiler puis lancer le serveur seul, sans refaire la page
```

**Le jeu est jouable dans un navigateur depuis l'étape 4.3**: `pnpm dev`, puis ouvrir http://localhost:3000. Le serveur sert la page empaquetée par esbuild (`packages/client/web`, produite par `pnpm build`) et les ressources de `assets/`, et décode les murs des cartes. Variables d'environnement: `PORT`; `ORIGINES_AUTORISEES` (liste séparée par des virgules) pour le contrôle d'accès du navigateur; `CHEMIN_CLIENT` et `CHEMIN_RESSOURCES` pour servir la page et les ressources depuis un autre dossier. « Jouer » est la partie rapide: la première partie publique en attente, ou une nouvelle partie publique. Depuis l'étape 2.4, le serveur sait aussi créer une partie privée et la faire rejoindre par son code d'invitation; les écrans correspondants arrivent au jalon 3. Pour jouer à la version d'origine, utiliser la branche `master`.

Première utilisation de Playwright sur une machine neuve: `pnpm exec playwright install chromium`.

## Conventions de code

- Commentaires et documentation en français, compréhensibles par une personne non technique.
- Pas d'emoji dans le code ni dans la documentation.
- Une fonction, une responsabilité.
- Dans chaque message de commit et chaque handoff, préciser quels fichiers ont changé et pourquoi.
- Le formatage est délégué au formateur, pas géré à la main.

## Comportements à préserver

Réglages de gameplay à couvrir par des tests de caractérisation avant toute modification.

1. Le score est un **stock, pas un cumul**: se faire capturer le remet à zéro. C'est ce qui fait la tension de fin de partie.
2. Capturer un joueur transfère **tous** ses bots d'un coup.
3. Un bot noir fait perdre 50 pour cent des points; un bot noir détruit en rapporte 15.
4. Un malus ramassé frappe **les autres**, pas celui qui le ramasse.
5. Vitesses relatives: joueur 3, bot 5, **bot noir 5**, bonus de vitesse x1,7, facteur mobile x2. Déjà corrigé quatre fois dans le legacy, très fragile. Correction du 13 août 2026: ce fichier et l'audit annonçaient 6 pour le bot noir. C'est faux. `BlackBot` lit `GAME_CONFIG.BOT_SPEED`, qui vaut 5, et le réglage `blackBotSpeed: 6` n'est lu nulle part. Vérifié et couvert par les tests de caractérisation. Décision du 13 août 2026: on garde 5, la vitesse réellement jouée depuis deux ans. Précision du 13 août 2026 (étape 1.1): ces nombres sont des distances par pas, et les pas n'ont pas la même durée. Un joueur avance de 3 toutes les 20 millisecondes, un bot de 5 toutes les 50: ramenés à la seconde, **le joueur va à 150 pixels par seconde et le bot à 100**, donc le joueur est le plus rapide. Ce sont ces vitesses par seconde que le moteur applique. Détail au défaut X17 de l'audit.
6. Protection de 3 secondes au spawn, délai de 1 seconde entre deux captures.
7. Compte à rebours de 5 secondes, annulable jusqu'à 2 secondes.
8. Transfert de propriété du salon quand le propriétaire part.
9. Collisions dérivées d'une image `collision.png`, seuil de luminosité à 128. C'est du contenu, pas du code.
10. **Les durées de bonus se cumulent** au lieu de se remplacer: deux bonus de vitesse ramassés coup sur coup donnent vingt secondes. Confirmé comme voulu le 13 août 2026.
11. **Les bots se transmettent leur couleur au contact, mais seule une couleur de joueur se transmet.** Un troupeau rouge qui traverse un troupeau bleu le retourne. Un bot blanc, lui, ne repeint rien: il n'a pas de couleur à donner. Le legacy ne posait aucune condition, si bien que le blanc effaçait les scores par simple diffusion. Corrigé le 14 août 2026 sur décision du porteur du projet, défauts X20 et X30 de l'audit. C'est le seul écart de gameplay volontaire du portage.

## Sécurité: la règle qui prime sur la caractérisation

Les tests de caractérisation figent le gameplay du legacy. **Ils ne figent jamais ses failles.** Un défaut de sécurité ne se caractérise pas, il se corrige par conception. L'étape 1.6 y est consacrée, et docs/audit/AUDIT-EXISTANT.md recense ce qui a été trouvé.

En cas de doute sur la nature d'un comportement (réglage de jeu ou faille), le caractériser et poser la question dans le handoff.

## Méthode de travail multi-sessions

Le contexte d'une conversation ne survit pas d'une session à l'autre. Seuls ce fichier et docs/ survivent.

**Le cadrage complet d'une session est dans docs/plan/PROTOCOLE.md**, section « Démarrage d'une session »: ordre de lecture, carte du contexte accumulé, et cadre permanent de travail (branche, legacy, rôle exact des tests de caractérisation, autorisation de commiter et pousser). Un prompt de démarrage n'a donc besoin d'indiquer que l'étape à exécuter. Si une session a manqué d'une information de cadrage, la corriger dans PROTOCOLE.md plutôt que de la remettre dans le prompt suivant.

- Début de session: lire le dernier handoff dans docs/handoffs/, puis la fiche de l'étape courante dans docs/plan/.
- Fin de session: écrire un handoff depuis docs/handoffs/_TEMPLATE.md, puis commiter.
- Entre deux étapes, repartir d'un contexte neuf avec `/clear`.
- Les handoffs écrits sont la source de vérité sur l'avancement, jamais la mémoire automatique.
- **Réconcilier avant d'exécuter.** Une fiche est un plan, pas un contrat figé. Si le dépôt diverge de ses hypothèses, mettre la fiche à jour et noter l'écart dans le handoff.
- **L'ordre d'exécution est celui de la section 3 de docs/plan/ROADMAP.md**, pas la numérotation des fiches. La ligne « prochaine action exacte » en fin de fiche suit la numérotation thématique: en cas de divergence, le ROADMAP fait foi.

Les règles d'enchaînement autonome et les conditions d'arrêt sont dans docs/plan/PROTOCOLE.md.

## Index

- Plan d'exécution et jalons: `docs/plan/ROADMAP.md`
- Enchaînement autonome: `docs/plan/PROTOCOLE.md`
- Fiches d'étape: `docs/plan/etape-X-Y.md`
- Stratégie de tests et contexte: `docs/plan-redemarrage-neon-ninja.md`
- Audit de l'existant: `docs/audit/AUDIT-EXISTANT.md`
- Journal de conception et décisions: `docs/design/README.md`
- Invariant de pureté: `.claude/rules/sim-purity.md`
