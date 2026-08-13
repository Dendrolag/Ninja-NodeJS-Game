# PROTOCOLE - Enchaînement autonome des étapes

Règles qui permettent à Claude Code d'avancer seul dans la roadmap, une étape après l'autre, sur plusieurs sessions, sans intervention humaine entre les étapes. À lire en complément de la section méthode de travail de CLAUDE.md.

## Démarrage d'une session

**Un prompt de démarrage n'a besoin de contenir qu'une chose: le numéro de l'étape à exécuter.** Tout le reste est ci-dessous, et doit y rester. Si une session a besoin d'une information de cadrage qui n'est pas dans les documents, c'est un défaut de documentation: l'ajouter ici plutôt que de la remettre dans le prompt suivant.

### Lecture d'ouverture, dans cet ordre

1. `CLAUDE.md`, chargé automatiquement. La constitution. Ses règles non négociables priment sur tout le reste.
2. Le **dernier** handoff de `docs/handoffs/`. C'est la source de vérité sur l'avancement réel, jamais la mémoire automatique ni le souvenir d'une session précédente.
3. La fiche de l'étape dans `docs/plan/etape-X-Y.md`.
4. `docs/plan/ROADMAP.md`, section 3. **C'est l'ordre d'exécution qui fait foi**, pas la numérotation des fiches ni la ligne « prochaine action exacte » en fin de fiche, qui suit la numérotation thématique.
5. `.claude/rules/sim-purity.md`, dès que l'étape touche `packages/sim`.

### Où vit le contexte accumulé

Aucun de ces documents n'a besoin d'être résumé dans un prompt. Ils se consultent au moment où l'étape en a besoin.

| Ce qu'on cherche                         | Où c'est                                                       |
| ---------------------------------------- | -------------------------------------------------------------- |
| Décisions de conception déjà tranchées   | `docs/design/README.md`, journal des décisions, daté           |
| Réglages de gameplay à préserver         | `CLAUDE.md`, section « Comportements à préserver »             |
| Défauts du legacy, numérotés B, S, X, P  | `docs/audit/AUDIT-EXISTANT.md`                                 |
| Comportement exact du legacy, exécutable | `tests/caracterisation/`, et son README                        |
| Avancement réel et dette ouverte         | Le dernier handoff de `docs/handoffs/`                         |
| Périmètre et écrans de la v1             | `docs/design/README.md`, puis `docs/design/cadrage.md` dès 0.3 |

### Cadre permanent de travail

Vrai pour toutes les étapes, à ne pas redemander ni rappeler dans un prompt.

- **Branche `reecriture`.** Tout le travail s'y fait. `master` porte le jeu d'origine encore jouable et **ne doit jamais être touchée**. Ne pas fusionner `reecriture` dans `master` avant l'étape 6.1: cela propagerait les suppressions et casserait le jeu.
- **Commit et poussée autorisés** dès qu'une tâche est terminée, sans demander. La CI doit être verte avant de considérer une étape terminée.
- **`legacy/` est une référence en lecture seule.** Jamais modifiée, jamais corrigée, jamais reformatée.
- **Les tests de `tests/caracterisation/` sont l'étalon du comportement attendu.** Attention à ne pas se méprendre sur leur rôle: ils s'exécutent **contre le legacy**, pas contre le nouveau code. Ils ne sont donc pas une cible que `packages/sim` doit faire passer. On les lit avant de porter, pour savoir ce que le portage doit reproduire, et on écrit les tests unitaires équivalents dans le nouveau paquet.
- **Règle 7 de CLAUDE.md.** Un défaut découvert en route se traite immédiatement, même hors du périmètre de l'étape. Les défauts numérotés de l'audit se corrigent par conception au moment où le portage les rencontre; ils ne se reproduisent jamais à l'identique.

## Boucle d'une étape (une session)

1. Début. Appliquer la section « Démarrage d'une session » ci-dessus: lecture d'ouverture dans l'ordre, puis prise de connaissance du cadre permanent. Ne pas dupliquer cette liste ailleurs, elle a un seul endroit.
2. Fiche fournie. Les fiches des 23 étapes sont fournies dans docs/plan/. Cas de repli seulement: si une fiche manquait, la rédiger à partir de l'entrée ROADMAP.md correspondante, de la structure des fiches existantes prise comme modèle, de l'état réel du dépôt et du dernier handoff, puis la commiter avant de l'exécuter.
3. Réconcilier avant d'exécuter. Une fiche est un plan, pas un contrat figé. Si l'état du dépôt ou des décisions antérieures divergent des hypothèses de la fiche, mettre la fiche à jour et noter l'écart dans le handoff de fin.
4. Exécuter. Rester strictement dans le périmètre de l'étape. Ne jamais tirer en avant du travail des étapes suivantes.
5. Vérifier. Contrôler la définition de terminé de la fiche et la définition commune de ROADMAP.md. Tous les tests au vert, CI verte, aucune régression de caractérisation.
6. Fin. Écrire le handoff depuis docs/handoffs/_TEMPLATE.md, renseigner la prochaine action exacte pointant vers l'étape suivante, commiter. Puis repartir d'un contexte neuf (/clear) pour l'étape suivante.

## Ordre d'exécution et porte avant la phase 2

Suivre ROADMAP.md dans l'ordre. Point important sur les dépendances:

- Les étapes 0.1, 0.2, puis 1.1 à 1.5 (fondations et cœur de simulation) ne dépendent pas des maquettes d'interface. Elles s'enchaînent de façon entièrement autonome.
- L'étape 0.3 (cadrage fonctionnel depuis les maquettes) et les phases 2 et 3 dépendent du périmètre fonctionnel défini par les maquettes (types de parties, modèle de partie, champs de progression).

**Mise à jour du 13 août 2026: cette porte est levée.** Les maquettes ont été déposées dans `docs/design/`, l'étape 0.3 n'est plus bloquée. La condition d'arrêt correspondante ne s'applique donc plus. Elle est conservée ci-dessous par prudence, au cas où une étape future dépendrait d'un livrable de conception encore absent. Rappel de posture: les maquettes sont des propositions à challenger, pas une spécification. Voir l'avertissement en tête de `docs/design/README.md`.

## Conditions d'arrêt (Claude Code met en pause et sollicite l'humain)

- Une étape nécessite un livrable de conception absent de docs/design/. Ne concerne plus les maquettes, déposées le 13 août 2026.
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
- Ne jamais toucher à `master`, ni fusionner `reecriture` dedans avant l'étape 6.1.
- Terminer chaque étape en fournissant le prompt à lancer dans la conversation suivante, sans attendre qu'on le demande. Il tient en deux lignes: ce protocole porte le reste.
