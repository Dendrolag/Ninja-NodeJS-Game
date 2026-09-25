# Handoff - Étape 8.6 La régularité du battement en production

Date: 25 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Savoir si les instantanés partent du serveur à l'heure, pour dire si les à-coups ressentis sur téléphone naissent dans le serveur ou sur le chemin jusqu'à lui. Sans rien changer au jeu.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE (`docs/plan/etape-8-6.md`), à partir de l'audit 8.5 et de la décision du porteur du projet de ne pas ajouter de retard à l'affichage.
- **Le serveur chronomètre chaque battement de chaque partie**: l'écart réel depuis le battement précédent de la même partie, et le temps du battement entier, moteur, projection, codage et envoi compris. Un tableau tournant de 6 000 cases, sans allocation pendant le jeu.
- **`/sante` rend le résumé des cinq dernières minutes**, toutes parties confondues, dans un champ `battement`: médiane, neuvième décile, centile 99 et maximum de l'écart et de la durée, et le compte des écarts d'au moins 100 ms. `null` sans partie. Une origine autorisée peut la lire depuis la page.
- **Le relevé `?diagnostic=1` recopie ce résumé** dans une section « Serveur », lu toutes les trente secondes pendant la partie et à sa fin.
- **Première mesure en production**, le 25 septembre 2026, une partie privée d'une minute et demie jouée depuis l'ordinateur de développement: **le serveur bat à l'heure**. Écart médian 49,9 ms, p99 52,6 ms, maximum 70,9 ms, aucun battement d'au moins 100 ms; moins d'une milliseconde par battement. Vue de l'ordinateur, l'arrivée des instantanés est presque aussi régulière (p99 56,6 ms). Section 6.4 bis de `docs/mesures/audit-saccades-telephone.md`.
- **Conclusion provisoire**: l'irrégularité relevée sur l'iPhone (p99 de 119 à 151 ms) naît probablement entre le téléphone et le réseau, le Wi-Fi ou la radio du téléphone, et non au serveur. Un relevé de l'iPhone, qui porte désormais les deux côtés dans un même texte, le confirmera.

## Fichiers créés ou modifiés

Commit `66b49ca`:

- `packages/server/src/chronometreDuBattement.ts` et son test (créés): le chronomètre.
- `packages/server/src/GameRoom.ts`: la boucle de chaque partie l'alimente. `RoomManager.ts` (et son test): un chronomètre pour toutes les parties.
- `packages/server/src/ServeurSocket.ts`, `serveur.ts`, `index.ts`: le résumé, jusqu'à la route de santé.
- `packages/server/src/fichiers.ts` (et son test): le champ `battement` et l'en-tête du contrôle d'accès.
- `packages/shared/src/sante.ts` et son test (créés), `index.ts`: la forme du résumé et sa lecture vérifiée.
- `packages/client/src/diagnostic/serveur.ts` (créé), `diagnostic.ts`, `diagnostic.test.ts`, `principal.ts`: la section « Serveur » du relevé.
- `tests/e2e/diagnostic.spec.ts`: le relevé lit les battements en fin de partie.
- `docs/plan/etape-8-6.md` (créé), `docs/deploiement.md`: la fiche, et comment lire la régularité du serveur.

Commit de clôture: `docs/mesures/releves-8-6/01-production-ordinateur.txt` (créé), `docs/mesures/audit-saccades-telephone.md` (section 6.4 bis, plan d'action), `docs/plan/ROADMAP.md` (étapes 8.6 et 8.7), `docs/handoffs/etape-8-5-handoff.md` (statut), ce handoff.

Aucune modification de `packages/sim`, de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: cinq sur le chronomètre (séries connues, seuil de retard, fenêtre, capacité fixe), un sur la boucle qui l'alimente, trois sur `/sante` (résumé, `null`, contrôle d'accès), quatre sur la lecture du résumé dans le paquet partagé (réponses malformées comprises), deux sur la section « Serveur » du relevé, et le scénario de bout en bout qui la lit en fin de partie.
- Résultat: **2 464 tests unitaires au vert**. Types, linter et formatage verts. Bout en bout: 49 sur 49 en CI après relance (voir plus bas).
- Couverture de packages/sim: inchangée, le paquet n'est pas touché.
- État de la CI: verte sur `66b49ca` après relance des tâches en échec; la mise en ligne de ce commit a été sautée parce que `f883faf`, de l'étape 8.3, était déjà poussé par-dessus, et c'est la CI de `f883faf`, verte, qui a mis la 8.6 en ligne.

## Décisions et écarts au plan

1. **Écart de méthode, demandé par le porteur du projet**: l'étape s'est faite dans la conversation de l'étape 8.5. La règle « une étape égale une conversation » n'est pas tenue.
2. **Deux conversations ont travaillé en même temps dans le même dossier**: celle-ci (8.6) et celle de l'étape 8.3, qui a poussé ses commits par-dessus `66b49ca`. Aucun fichier n'a été mêlé (vérifié commit par commit), mais une mise en ligne a été sautée, et l'ordre des poussées a dû être surveillé pour ne pas en faire sauter une autre. À éviter: une seule conversation à la fois par dossier, ou une copie de travail chacune.
3. **La forme du résumé vit dans `packages/shared`**, avec sa lecture vérifiée: la page ne croit pas le réseau sur parole.
4. **La page lit `/sante` pendant la partie et à sa fin, pas au moment de la copie**: Safari n'écrit dans le presse-papiers que pendant le geste, qui ne peut pas attendre le réseau.
5. **Pas de mesure de l'attente de la boucle d'événements de Node**, ni de l'usage du processeur: l'écart entre battements les contient déjà, et c'est lui que le joueur ressent.

## Problèmes connus et dette

- **Les scénarios Tactique au pouce échouent par intermittence en CI**, antérieurs à 8.5 et 8.6: premier essai en échec les 20 et 21 septembre, trois essais en échec le 25 septembre sur `66b49ca`, vert à la relance, jamais reproduit en local (six sur six). Planifié comme étape `8.7` au ROADMAP (règle 7).
- **Le banc de rendu échoue en local ce 25 septembre**, notre code à 4,9 ou 5,0 ms au lieu de moins de 4,2 à 500 sprites au processeur ralenti. Le même banc, sur le code d'avant la 8.6, échoue de la même façon, et PixiJS y est lui-même 70 pour cent plus lent que dans ses mesures de référence: c'est la machine, chargée par l'autre conversation, pas le code. En CI, ce plafond ne s'exige pas (étape 4.5).
- **Confirmé sur l'iPhone le 25 septembre au soir** (`docs/mesures/releves-8-6/02-iphone-tactique-300.txt`, section 6.4 ter de l'audit): partie Tactique à 300 PNJ ressentie fluide; sur 41 instantanés arrivés avec au moins 100 ms d'écart, le serveur n'en explique que 3; l'écran de préparation couvre le gel du départ. Le serveur a eu un seul battement lent en trois minutes, 97,6 ms à 300 PNJ.

## Prochaine action exacte

Rien n'attend le porteur du projet: le relevé de l'iPhone est pris et l'étape close. Le relevé `?diagnostic=1` reste en ligne pour un prochain doute.

**À la session suivante**: l'étape `8.3` est déjà faite par une autre conversation (commit `f883faf`, handoff `docs/handoffs/etape-8-3-handoff.md`). Lire le dernier handoff et la section 3 du ROADMAP; la prochaine étape planifiée non faite est `8.7`, les scénarios Tactique au pouce.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-7.md`, à rédiger au début de l'étape. L'entrée correspondante est à la section 3 de `docs/plan/ROADMAP.md`.
