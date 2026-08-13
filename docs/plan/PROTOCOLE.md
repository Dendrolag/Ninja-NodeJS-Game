# PROTOCOLE - Enchaînement autonome des étapes

Règles qui permettent à Claude Code d'avancer seul dans la roadmap, une étape après l'autre, sur plusieurs sessions, sans intervention humaine entre les étapes. À lire en complément de la section méthode de travail de CLAUDE.md.

## Boucle d'une étape (une session)

1. Début. Lire CLAUDE.md (chargé automatiquement), puis le dernier handoff dans docs/handoffs/, puis la fiche de l'étape courante dans docs/plan/.
2. Fiche fournie. Les fiches des 23 étapes sont fournies dans docs/plan/. Cas de repli seulement: si une fiche manquait, la rédiger à partir de l'entrée ROADMAP.md correspondante, de la structure des fiches existantes prise comme modèle, de l'état réel du dépôt et du dernier handoff, puis la commiter avant de l'exécuter.
3. Réconcilier avant d'exécuter. Une fiche est un plan, pas un contrat figé. Si l'état du dépôt ou des décisions antérieures divergent des hypothèses de la fiche, mettre la fiche à jour et noter l'écart dans le handoff de fin.
4. Exécuter. Rester strictement dans le périmètre de l'étape. Ne jamais tirer en avant du travail des étapes suivantes.
5. Vérifier. Contrôler la définition de terminé de la fiche et la définition commune de ROADMAP.md. Tous les tests au vert, CI verte, aucune régression de caractérisation.
6. Fin. Écrire le handoff depuis docs/handoffs/_TEMPLATE.md, renseigner la prochaine action exacte pointant vers l'étape suivante, commiter. Puis repartir d'un contexte neuf (/clear) pour l'étape suivante.

## Ordre d'exécution et porte avant la phase 2

Suivre ROADMAP.md dans l'ordre. Point important sur les dépendances:

- Les étapes 0.1, 0.2, puis 1.1 à 1.5 (fondations et cœur de simulation) ne dépendent pas des maquettes d'interface. Elles s'enchaînent de façon entièrement autonome.
- L'étape 0.3 (cadrage fonctionnel depuis les maquettes) et les phases 2 et 3 dépendent du périmètre fonctionnel défini par les maquettes (types de parties, modèle de partie, champs de progression).

Conséquence: Claude Code peut exécuter seul tout le bloc jusqu'à l'étape 1.5 incluse. Arrivé là, si docs/design/ ne contient pas encore les maquettes, s'arrêter et écrire un handoff demandant les maquettes, car l'étape 0.3 puis la phase 2 en ont besoin pour figer le schéma de données et les contrats réseau sans reprise coûteuse.

## Conditions d'arrêt (Claude Code met en pause et sollicite l'humain)

- Une étape nécessite les maquettes et docs/design/ est vide.
- La définition de terminé ne peut pas être atteinte (un test ne passe pas, une hypothèse d'architecture se révèle fausse). Écrire un handoff au statut bloquée, précisant exactement ce qui bloque.
- Une décision contredirait une règle non négociable de CLAUDE.md.

## Ce qui ne nécessite pas de solliciter l'humain

- Une étape dépasse une session. La couper, écrire un handoff partiel, continuer à la session suivante. C'est normal et autorisé.
- Des micro-décisions techniques internes à une étape, du moment qu'elles respectent CLAUDE.md.

## Garde-fous permanents

- Ne jamais affaiblir la pureté de packages/sim pour faire compiler quelque chose. Déplacer l'entrée-sortie vers packages/server et injecter ce dont le moteur a besoin.
- Ne jamais sauter l'écriture des tests pour aller plus vite.
- Ne jamais modifier le contenu de legacy/.
- Une étape égale une session. Ne pas fusionner deux étapes.
- CLAUDE.md reste stable. L'état d'avancement va dans les handoffs, jamais dans CLAUDE.md.
