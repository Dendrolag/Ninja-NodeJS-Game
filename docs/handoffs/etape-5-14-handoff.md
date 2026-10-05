# Handoff - Étape 5.14 Une CI plus courte

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Qu'une poussée sur `master` parte en ligne en 10 à 12 minutes au lieu de 26, sans retirer ni affaiblir aucune vérification.

## Ce qui a été fait

- **Mesure d'entrée**: 29 à 30 minutes de la poussée à la mise en ligne (exécutions 37324675167 et 37330153650), en série: vérification 4 min 45, bout en bout 19 min 35 à 20 min 35, mise en ligne 4 min 30 à 4 min 45. Durée de chaque scénario tirée du rapport de Playwright: 1 119 s pour les 92 scénarios bureau et mobile, 45 s pour le banc.
- **Le bout en bout réparti sur dix machines** (`--shard`, matrice de dix parts), chacune un scénario à la fois comme avant. Dix parts choisies par simulation sur les durées du rapport: Playwright répartit par nombre de scénarios, pas par durée.
- **Le banc de mesure du rendu sur sa propre machine**, sans rejouer ses dépendances (`--no-deps`).
- **Un seul rapport de Playwright**: chaque part écrit un rapport brut, le job « Rapport de bout en bout » les fusionne dans l'artefact `rapport-playwright`, conservé sept jours, échec ou non.
- **Plus rien n'attend la vérification**: tous les jobs de tests partent ensemble, la mise en ligne les attend tous.
- **Les tests de la base dans leur propre job**, huit fichiers à la fois au lieu de trois: ils attendent le réseau entre GitHub et Neon, pas le processeur (57 s en local près de Neon, 734 s cumulés sur GitHub). Job de 2 min 33 à 3 min 08, contre 5 min de tests dans la vérification.

Durées après, de la poussée à la mise en ligne:

| Exécution   | Commit    | Tests verts | En ligne     | Remarque                                                        |
| ----------- | --------- | ----------- | ------------ | --------------------------------------------------------------- |
| 37380514396 | `747f54a` | 4 min 44    | **8 min 54** | Mise en ligne 4 min 07                                          |
| 37381765111 | `0ff90ce` | 4 min 23    | **7 min 20** | Mise en ligne 2 min 55                                          |
| (ce commit) | handoff   | voir CI     | sans objet   | Commit de documentation: rien à mettre en ligne, par conception |

Le chemin le plus long est désormais la plus longue part du bout en bout, la première ou la troisième (4 min 19 à 4 min 39, dont 3 min 37 de scénarios au plus), puis la mise en ligne elle-même (3 à 4 minutes, hors périmètre).

## Fichiers créés ou modifiés

- `.github/workflows/ci.yml`: jobs « Tests de la base », « Bout en bout (1 à 10) », « Banc de mesure du rendu », « Rapport de bout en bout »; la vérification ne joue plus que les tests unitaires; la mise en ligne attend la vérification, la base, les dix parts et le banc.
- `playwright.config.ts`: rapport brut (`blob`) en CI au lieu du rapport HTML; commentaire du banc.
- `eslint.config.js`, `.prettierignore`: le dossier `blob-report` ignoré.
- `docs/deploiement.md`: ce qu'attend la mise en ligne.
- `docs/plan/etape-5-14.md`: réconciliation. `docs/plan/ROADMAP.md`: clôture de 5.14.

Aucune modification de `legacy/`, de `tests/caracterisation/`, de `packages/` ni d'aucun test.

## Tests

- Ajoutés: aucun; l'étape ne change que la façon de les lancer. Vérifié en local que les dix parts et le banc couvrent les 95 scénarios, ni plus ni moins (92 + 3), et que la fusion des rapports bruts donne un rapport HTML complet.
- Résultat: 3 615 tests unitaires au vert, 138 tests de la base au vert, 95 scénarios au vert à chaque exécution, sans échec intermittent.
- Couverture de packages/sim: inchangée, non touché.
- État de la CI: verte sur `747f54a` (37380514396) et `0ff90ce` (37381765111), mises en ligne comprises; production (Oracle) et secours (Render) servent `0ff90ce`.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche.

- **Dix parts réparties par nombre** plutôt que six réparties par durée: rien à entretenir quand un scénario s'ajoute; les machines sont gratuites pour un dépôt public.
- **Les tests de la base à part, huit fichiers à la fois**, plutôt que regrouper leurs requêtes ou découper `amis.test.ts`: suffisant à ce jour, sans toucher aux tests.
- **Le cache des navigateurs de Playwright** n'est pas posé: une vingtaine de secondes par part, pour un gain marginal.
- **Le troisième relevé est un commit de documentation**, qui ne se met jamais en ligne (étape 5.4): la définition de terminé demande trois relevés d'une poussée de code; deux ont été mesurés de bout en bout, le troisième mesure les tests seuls. Créer un commit de code pour le seul relevé n'aurait rien vérifié de plus que les deux premiers.

## Problèmes connus et dette

- **Incident de GitHub Actions du 5 octobre au soir**: des jobs restés sans machine ont fait échouer l'exécution 37366708823 (`e0ea4b3`) et la première tentative de 37368060441 (« The job was not acquired by Runner of type hosted »). Rien à corriger chez nous; une CI à quinze jobs y est simplement plus exposée qu'une à trois.
- **Le message du commit `5522c1a`** porte une faute (« ne attend »): poussé, il n'est pas réécrit.
- **La première part reste parmi les plus longues**: elle reçoit la partie à deux joueurs et le relevé de diagnostic, les deux scénarios les plus longs. Si le bout en bout s'allonge, ajouter des parts à la matrice suffit.
- **`ubuntu-latest` passe à Ubuntu 26 à partir du 19 octobre 2026** (annonce de GitHub dans les annotations): à surveiller si une exécution casse à cette date.

## Prochaine action exacte

Exécuter l'étape `2.9`, le flux par destinataire: sa fiche n'existe pas encore, la rédiger selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.9 de `docs/plan/ROADMAP.md` et de `docs/design/etude-mode-among-ninjas.md`, section 3, puis la commiter. Vers le 10 novembre 2026, vérifier que la machine Oracle tourne toujours et clore la 5.9.

## Étape suivante

Fiche à lire: docs/plan/etape-2-9.md (à rédiger)
