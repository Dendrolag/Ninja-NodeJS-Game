# Fiche étape 0.2 - Tests de caractérisation du legacy

Brief de session. Objectif unique: figer le comportement actuel du jeu sur les points sensibles, sous forme de tests de référence, avant tout portage. Ces tests deviennent la vérité du comportement attendu pour toute la phase 1.

## Rituel de début de session

Lire CLAUDE.md, puis le handoff de l'étape 0.1 dans docs/handoffs/, puis cette fiche. Lire aussi docs/audit/AUDIT-EXISTANT.md, qui recense les comportements suspects déjà repérés (voir la section « Défauts déjà repérés » plus bas).

Base legacy: master v0.8.6, figée en lecture seule dans legacy/ à l'étape 0.1. Tous les numéros de ligne de cette fiche s'y réfèrent.

## Objectif

Produire une suite de tests de caractérisation (golden master) qui enregistre, pour des situations de jeu précises, ce que le legacy produit aujourd'hui: qui capture qui, quels scores, quelles collisions, quels effets de bonus et de malus. Si le portage en phase 1 reproduit ces mêmes sorties, le ressenti de jeu est préservé.

## Méthode

Le legacy (server.js dans legacy/) est un module à état global, mêlé aux sockets et au temps. On ne teste donc pas ses fonctions internes de façon isolée et fragile. On capture le comportement au niveau le plus stable: le résultat d'un traitement de jeu sur un état connu.

Démarche:
1. Identifier le plus petit ensemble de fonctions legacy qui calculent la logique d'un instant de jeu sur un état donné, en neutralisant la diffusion réseau (remplacer l'émission de sendUpdates par un espion) et le temps (valeurs fixes).
2. Construire une poignée de scénarios déterministes (positions, directions, états des entités fixés à la main).
3. Exécuter le traitement et enregistrer la sortie comme référence (instantané).
4. Toute exécution future doit reproduire l'instantané.

Difficulté connue: le legacy tire son aléa de Math.random et son temps de Date.now, directement dans les classes, et son état vit en variables de module. Neutraliser l'aléa et le temps pour la durée des tests, et prévoir la remise à zéro de l'état global entre deux scénarios. Le consigner dans le handoff: c'est exactement ce que le générateur à graine et le paramètre dt de l'étape 1.1 viendront remplacer proprement.

## Périmètre (fonctions et comportements à caractériser)

À partir de legacy/server.js, couvrir au minimum:

- **Capture**: handlePlayerCapture (ligne 737) et la capture de bot écrite en ligne dans detectCollisions (lignes 1686 à 1707). Vérifier le transfert de tous les bots, l'historique des deux côtés, et le refus de capture (invincibilité, protection de spawn, délai entre captures).
- **Collisions**: detectCollisions (ligne 1671) pour les contacts entité contre entité, et CollisionMap.canMove (ligne 394) pour le terrain. Vérifier la résolution sur des situations de contact connues, dont le glissement le long d'un mur.
- **Score**: calculatePlayerScores (ligne 1766). Vérifier le classement produit sur un état donné, le retour à zéro après capture, et le départage à égalité.
- **Effets**: handleBonusCollection (ligne 1614) et handleMalusCollection (ligne 684). Vérifier l'effet appliqué, sa nature et sa cible (un malus frappe les autres joueurs, pas celui qui le ramasse).

Pour chaque domaine, au moins deux ou trois scénarios, dont un cas limite (contact exactement à la distance limite, contact simultané, score à égalité).

Le mode tactique et le système de capture par cône ne font pas partie du périmètre: ils n'existent pas dans la base retenue. Voir la section 5 de docs/plan/ROADMAP.md.

## Défauts déjà repérés, et comment les traiter

docs/audit/AUDIT-EXISTANT.md recense des défauts du legacy. **Ils ne se traitent pas tous de la même façon**, et c'est le point le plus important de cette étape.

**Comportements de gameplay surprenants: les caractériser tels quels.** Ils font peut-être partie du plaisir de jeu, et la décision de les changer se prend consciemment, plus tard, jamais par accident au détour d'un portage. Par exemple: un malus frappe les autres et non son ramasseur; la distance de sécurité au spawn ne s'applique jamais parce que registerEntity n'est jamais appelée, si bien que les entités peuvent apparaître les unes sur les autres.

**Défauts de sécurité et de robustesse: ne pas les caractériser.** Les figer dans un instantané de référence reviendrait à en faire le comportement attendu, et donc à les réimplanter fidèlement dans la nouvelle base. Ils sont traités par conception à l'étape 1.6. Cela concerne notamment l'absence de validation du pseudo, la confiance accordée aux champs speedBoostActive et isMobile envoyés par le client, et l'absence de toute limitation de débit.

**Bugs francs: les noter, ne pas les reproduire.** Par exemple le gestionnaire joinRunningGame déclaré deux fois et donc exécuté deux fois, la variable startTime non déclarée dans getValidPosition, les chaînes de setTimeout jamais annulées, ou fs non importé. Les consigner dans le handoff et ne pas les porter.

En cas de doute sur la catégorie d'un comportement, le caractériser et poser la question dans le handoff. Il est moins coûteux de figer un comportement qu'on changera ensuite que de perdre silencieusement un réglage de gameplay.

## Hors périmètre

- Aucun portage, aucune écriture dans packages/. Les tests vivent dans une zone dédiée à la caractérisation et lisent le legacy en référence.
- Ne pas chercher une couverture exhaustive du legacy. On fige les comportements sensibles, pas chaque ligne.
- Ne pas corriger le legacy. Ne pas modifier legacy/.

## Tests requis

- Une suite de caractérisation au vert, couvrant capture, collisions, score, effets, avec leurs instantanés de référence enregistrés et versionnés.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les scénarios des quatre domaines existent et passent.
2. Les instantanés de référence sont commités.
3. Chaque comportement surprenant rencontré est consigné dans le handoff, classé dans l'une des trois catégories ci-dessus.
4. La CI exécute cette suite et reste verte.

## Rituel de fin de session

Écrire docs/handoffs/etape-0-2-handoff.md. Lister les comportements caractérisés, et le classement de chaque point surprenant. Prochaine action exacte pour l'étape 1.1: créer le squelette du moteur pur et le modèle d'état dans packages/sim, en portant Entity et Player. Commiter.
