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
