# Fiche étape 5.14 - Une CI plus courte

Brief de session. Objectif unique: **qu'une poussée sur `master` parte en ligne en 10 à 12 minutes au lieu de 26**, sans retirer ni affaiblir aucune vérification.

## Origine de cette fiche

Demande du porteur du projet du 5 octobre 2026, pendant l'étape 5.13, qui trouvait la CI « de plus en plus longue ». Rédigée dans la conversation de l'étape 5.13, à partir des durées des exécutions 37311210618 et 37324675167.

## Ce qu'on sait en entrant

Durées de l'exécution 37311210618 (commit `70a9a9e`), job par job, en série:

| Job                    | Durée  | Dont                                                                  |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| Types, linter et tests | 5 min  | tests unitaires et de la base: 4 min 20 (259 s de mur, 636 s cumulés) |
| Bout en bout           | 17 min | scénarios Playwright: 16 min 17, un seul à la fois                    |
| Mise en ligne          | 4 min  | Render, puis la machine Oracle en secours depuis l'étape 5.13         |

- **Le bout en bout tourne avec un seul processus** en CI (`workers: 1` dans `playwright.config.ts`): sans carte graphique, deux parties en parallèle se privaient de processeur au point de faire échouer les scénarios (exécution 34522355452, commentaire du fichier). Le dépôt est public: les machines de GitHub sont gratuites, et chacune a 4 processeurs.
- **Le bout en bout attend la vérification** (`needs: verification`), pour ne pas lancer les navigateurs sur un commit déjà rouge.
- **Les tests de la base dominent les tests unitaires**: `tests/base/amis.test.ts` 168 s, `succes.test.ts` 81 s, puis sept fichiers entre 39 et 47 s. Chaque requête fait l'aller et retour entre les machines de GitHub et Neon.
- Le projet `banc` de Playwright dépend des projets `bureau` et `mobile`, pour mesurer le rendu seul.

## Pistes, à mesurer avant de choisir

1. **Répartir le bout en bout** sur plusieurs jobs (`--shard=i/N`, matrice), chacun à un processus, puis fusionner les rapports. Vérifier ce que devient la dépendance du `banc`.
2. **Lancer le bout en bout en même temps que la vérification.** Le coût d'un commit rouge devient des minutes de machine gratuites. La mise en ligne attend toujours les deux.
3. **Les tests de la base**: regrouper les requêtes, paralléliser les fichiers sur des schémas ou branches distincts, ou rapprocher la région; mesurer d'abord où part le temps.
4. Le cache de Playwright et de pnpm entre exécutions, s'il reste du temps à gagner.

## Hors périmètre

- Retirer un scénario ou un test pour gagner du temps.
- Changer la mise en ligne elle-même (étape 5.13).

## Définition de terminé

1. Une poussée de code part en ligne en 12 minutes au plus, relevé sur trois exécutions.
2. Tous les scénarios et tous les tests d'avant sont joués, et le rapport de Playwright reste conservé en cas d'échec.
3. Trois exécutions vertes de suite, sans échec intermittent nouveau.
4. Les durées avant et après sont notées dans le handoff.

## Réconciliation (5 octobre 2026, session de l'étape)

Écarts au plan et choix, décidés en mesurant.

1. **Durées d'entrée corrigées.** Sur les exécutions 37324675167 et 37330153650, juste avant l'étape, une poussée mettait 29 à 30 minutes à partir en ligne, pas 26: vérification 4 min 45, bout en bout 19 min 35 à 20 min 35 (scénarios 18 min 54 à 19 min 41), mise en ligne 4 min 30 à 4 min 45. Le rapport de Playwright du 37330153650 donne la durée de chaque scénario: 1 119 s pour les 92 scénarios bureau et mobile, 45 s pour le banc, 71 s pour le plus long (la partie à deux joueurs).
2. **Piste 1, retenue: dix parts.** Playwright 1.62 répartit par nombre de scénarios, pas par durée, dans l'ordre des fichiers: les scénarios courts (`rendu-*`, `hud-*`) se suivent et déséquilibrent les parts. Simulé sur les durées du rapport, la plus longue part vaut 462 s à quatre parts, 378 s à six, 263 s à huit, 206 s à dix; une répartition par durée tiendrait en six parts, mais demanderait une table de durées à entretenir. Dix parts, gratuites pour un dépôt public, se rééquilibrent seules quand on ajoute un scénario. Toujours un scénario à la fois par machine.
3. **Le banc a son propre job**, lancé avec `--no-deps`. Avec `--shard`, sa dépendance aux projets `bureau` et `mobile` ferait rejouer tous les scénarios dans la part qui le reçoit. Seul sur sa machine, il mesure sans partager le processeur, ce que sa dépendance garantissait; elle reste pour les passages locaux.
4. **Le rapport reste conservé**: chaque part écrit un rapport brut (`blob`), un job « Rapport de bout en bout » les fusionne en un seul rapport HTML, l'artefact `rapport-playwright`, conservé sept jours, échec ou non. La mise en ligne ne l'attend pas. `fail-fast: false`: une part qui échoue n'arrête pas les autres, et le rapport dit tout ce qui est rouge.
5. **Piste 2, retenue**: plus rien n'attend la vérification. La mise en ligne attend tous les jobs de tests.
6. **Piste 3, retenue sous une autre forme: les tests de la base dans leur propre job, huit fichiers à la fois.** Une fois le bout en bout réparti, la vérification devenait le plus long job (6 min 11, dont 5 min 05 de tests, exécution 37368060441). Mesure: en local, près de Neon, les tests de la base prennent 57 s; sur GitHub, 734 s cumulés. Ils attendent le réseau, pas le processeur, et Vitest n'en joue que trois à la fois sur quatre processeurs. À huit à la fois, dans un job à part, ils prennent 2 min 14, leur job 2 min 33, et la vérification, sans eux, 1 min 37. Ni regroupement de requêtes (les bornes insèrent déjà en une requête) ni découpage de `amis.test.ts` (113 à 189 s selon Neon, le plus long) ne sont nécessaires à ce jour. Rapprocher la région demanderait un projet Neon à part, hors de proportion.
7. **Piste 4, non retenue**: le cache de pnpm existe déjà; celui des navigateurs de Playwright gagnerait une vingtaine de secondes par part, sans changer le chemin le plus long au point de le justifier.
8. **Exécution 37368060441 (premier essai)**: un incident de GitHub Actions, le 5 octobre au soir, a laissé six parts et la vérification sans machine (« The job was not acquired by Runner of type hosted even after multiple attempts »). Relancée une fois l'incident passé, verte, sans mise en ligne: un commit de documentation d'une autre session était arrivé entre-temps sur `master`.
