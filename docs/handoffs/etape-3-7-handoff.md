# Handoff - Étape 3.7 Les succès, socle

Date: 27 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un compte débloque, à la fin d'une partie, les succès qui se déduisent de ses résultats enregistrés. Il les voit à l'écran de fin, au profil avec leur progression et leur rareté, et les autres comptes les voient sur sa fiche.

## Ce qui a été fait

- **Les décisions de l'étude tranchées avec le porteur du projet**, toutes sur la recommandation: un titre pour récompense, dans une étape à part (`3.9`), la liste de l'étude aux seuils proposés, le rattrapage des comptes existants, trois secrets (en `3.8`), « Seigneur de la Horde » plutôt qu'un cumul tous modes, et une mesure de rétention lancée à la main. Le porteur du projet a aussi fait passer `3.7` avant `2.8`, dont le socle ne dépend pas. Consignées dans l'étude, le ROADMAP et le journal.
- **La fiche** `docs/plan/etape-3-7.md`, rédigée selon le cas de repli du PROTOCOLE, avec dix-neuf décisions de conception tirées de la relecture du schéma.
- **Les définitions en données** (`packages/shared/src/succes.ts`): 29 succès de source « base », chacun une mesure et un seuil. Six en Découverte, dix en Habitué, huit en Expert, cinq en Légende.
- **Un pli pur sur l'historique** d'un compte, partie par partie, qui donne ses mesures et, pour chaque succès, la première partie après laquelle il était atteint. La fin de partie, le profil et le rattrapage passent tous par lui.
- **Attribuer, c'est rattraper.** Dans la transaction de fin de partie, chaque compte voit son historique plié, et tout succès atteint et absent s'inscrit, daté de sa partie d'origine. La partie n'annonce que les succès dont elle est l'origine. Un réessai d'enregistrement annonce les mêmes. Un succès oublié s'inscrit à la partie suivante du compte, à sa vraie date.
- **La table `succes_debloques`** (migration `0009`), clé primaire sur le compte et le succès, identifiant texte contrôlé par sa forme, en cascade sur le compte, partie mise à vide si elle disparaissait.
- **La rareté**, part des comptes qui ont joué et qui détiennent le succès, calculée à chaque lecture.
- **Deux commandes**: `pnpm base:rattraper`, idempotente, par lots de cinquante comptes, et `pnpm base:mesurer`, en lecture seule, qui relève la rétention (actifs par semaine, retour à sept jours par cohorte) et la calibration des seuils. Procédure dans `docs/mesures/retention.md` et `docs/deploiement.md`.
- **L'écran de fin** annonce les succès débloqués et le cumul le plus proche (« Plus que 2 cartes pour Touriste »). **Le profil** gagne une section « Succès », palier par palier, obtenus datés et colorés, les autres grisés avec leur progression, la rareté partout. **La fiche** montre les succès obtenus, avec leur rareté, sans leur date.
- **Un défaut de conception trouvé en route et corrigé avant commit** (règle 7): mesurés en niveaux, les succès de niveau faisaient de « Recrue » le succès le plus proche de tout débutant, le niveau 1 comptant pour un cinquième. Ils se mesurent en XP.

Ni `packages/sim`, ni les règles de jeu ne changent. Le transport change d'un champ: `progressionDeFin` porte les succès.

## Fichiers créés ou modifiés

- `packages/shared/src/succes.ts` (créé): définitions, pli, succès le plus proche. `comptes.ts`: `SuccesDuProfil`, `SuccesDeFiche`, et les champs `succes` du profil et de la fiche. `evenements.ts`: `SuccesDeFin`, le champ `succes` du récapitulatif. `index.ts`: les exports.
- `packages/server/src/base/schema.ts`, `migrations/0009_succes.sql` et `meta/` (drizzle-kit): la table.
- `packages/server/src/base/succes.ts` (créé): historiques en deux requêtes pour tous les comptes d'une partie, attribution, rareté, rattrapage. `base/parties.ts`: l'attribution dans la transaction de fin et au réessai.
- `packages/server/src/comptes/succes.ts` (créé): la mise en forme pure pour la fin, le profil et la fiche. `comptes/Authentification.ts`, `finDePartie.ts`: le profil, la fiche et le récapitulatif portent les succès.
- `packages/server/src/base/mesures.ts`, `mesurer.ts`, `rattraper.ts` (créés): les deux commandes. `packages/server/package.json`, `package.json`: leurs scripts. `packages/server/src/index.ts`: les exports.
- `packages/client/src/interface/modeles/succes.ts` (créé): rareté, phrase du plus proche, section du profil, succès de la fiche et de la fin. `modeles/fin.ts`, `profil.ts`, `fiche.ts`: les modèles portent les succès. `modeles/progression.ts`: `formaterJour`, déplacé depuis `profil.ts` (qui le réexporte) pour dater un succès sans importer le profil.
- `packages/client/src/interface/composants/succes.ts` (créé): la liste des obtenus et les paliers du profil. `composants/ficheJoueur.ts`, `ecrans/fin.ts`, `ecrans/profil.ts`: les sections. `comptes/api.ts`: les jeux d'essai.
- `packages/client/page/styles/composants.css`, `ecrans.css`: une couleur par palier de difficulté (vert, cyan, violet, or), cartes, jauges.
- `tests/outils/comptes-en-memoire.ts`: le même pli, les mêmes mises en forme, les amis d'aujourd'hui.
- `tests/e2e/compte.spec.ts`: la première partie annonce « Premier pas », que le profil date.
- Documentation: `docs/plan/etape-3-7.md` (créée), `docs/plan/ROADMAP.md` (ordre, `3.9`, étape terminée), `docs/design/etude-succes.md` (décisions), `docs/design/README.md` (deux entrées au journal), `docs/design/cadrage.md` (profil), `docs/deploiement.md` (commandes ponctuelles), `docs/mesures/retention.md` (créé), `CLAUDE.md` (commandes, une ligne), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé (`succes.test.ts`): les définitions (identifiants, paliers, unités), chacun des 29 succès juste sous et juste sur son seuil, les règles du pli (partie seul, podium à trois et en Équipes, série interrompue par une défaite ou un abandon mais pas par une partie seul, prises de tous les modes, meute en Chasse seulement, sommet de ligue qui redescend, jours différents, amis un par un, égalités), la première partie de chaque succès, la progression, le plus proche;
  - serveur: la mise en forme de la fin, du profil et de la fiche (`comptes/succes.test.ts`), le texte du relevé (`base/mesures.test.ts`);
  - base (`tests/base/succes.test.ts`, 13 cas): contraintes et cascade, identifiant retiré ignoré, annonce de la première partie datée de sa fin, jamais deux fois, réessai qui annonce les mêmes, succès oublié inscrit à sa vraie date sans être annoncé, amis d'aujourd'hui (bande et rivalité), jours à Paris, rattrapage daté et idempotent, compte sans partie, rareté dans un instantané cohérent, profil et fiche; `tests/base/mesures.test.ts`: actifs, cohortes, semaine de Paris; `migrations`, `parties`, `fiche`, `progression-de-fin` suivent;
  - client: modèles (rareté, plus proche, profil, secrets par une définition substituée, fiche, fin), écrans (fin, profil, fiche);
  - bout en bout: « Premier pas » annoncé à la fin, daté au profil.
- Résultat: `pnpm verify` en local, 2 839 tests unitaires et d'intégration au vert (85 de plus qu'au handoff 3.6). Tests de la base en local contre un PostgreSQL 16 du conteneur: 107 sur 108, le seul échec étant l'écart connu de version (voir plus bas). Bout en bout en local: 54 scénarios sur 56 en parallèle, les deux échecs étant le scénario du HUD de `peaufinage.spec.ts` au délai de 30 s, vert rejoué seul (21 et 22 s), sans lien avec l'étape. Vérification visuelle par captures: bloc de fin, profil sur ordinateur et sur téléphone. Elle a fait retirer « Obtenu par aucun joueur », répété sur chaque carte d'un profil neuf: la rareté ne s'écrit plus pour un succès que personne n'a.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `e8c6a12`** (run `36297798381`) du premier coup, tests de la base Neon compris (l'écart de version local n'existe pas sur Neon), tous les scénarios de bout en bout sans relance. Le commit serveur `de7b9f9` l'était aussi (run `36269071378`). Mise en ligne sautée: la branche n'est pas `master`.

## Décisions et écarts au plan

1. **`3.7` avant `2.8`**, sur demande du porteur du projet. Le ROADMAP fait foi: `3.7`, `2.8`, `3.8`, `3.9`.
2. **Les seuils ne sont pas calibrés sur la production**, contrairement à ce que prévoyait l'entrée du ROADMAP: cette session n'a pas accès à la base de production, et quelques semaines de résultats ne calibrent pas des délais d'une semaine ou d'un mois. Décision du porteur du projet. La requête de calibration est dans `pnpm base:mesurer`.
3. **Le relevé de rétention n'est pas fait**, pour la même raison. Il n'a pas à précéder la fusion, contrairement à ce que prévoyait l'étude: la commande relit l'historique, et les semaines d'avant la mise en ligne s'y lisent à tout moment. Un relevé un mois après suffit, avec la date de la mise en ligne.
4. **Attribuer rattrape** (fiche, décision 3): la fin de partie inscrit aussi les succès anciens d'un compte, à leur vraie date. Le script de rattrapage ne sert qu'aux comptes qui ne rejouent pas.
5. **Les succès de niveau se mesurent en XP** (voir plus haut), et la rareté ne compte que les détenteurs qui ont joué: un compte peut, en théorie, porter un succès sans partie (un test l'écrit à la main), et la part dépasserait cent.
6. **Le « plus proche » d'une première partie est souvent « Touriste »** (une carte sur trois fait déjà un tiers). C'est exact, et c'est une invitation à changer de carte. À revoir si le porteur du projet la trouve répétitive.
7. **Un abandon débloque les succès de base** (étude, 5.4): rien ne le distingue en base. Les descriptions disent « Jouer » et non « Terminer ».
8. **Écart de branche**, comme aux étapes précédentes: la session travaille sur la branche imposée `claude/etape-3-7-socle-succes-ikwb7u`, repartie de `master`. La fusion dans `master` met en ligne la migration `0009` et les succès.

## Problèmes connus et dette

- **Chaque fin de partie relit tout l'historique de ses comptes** pour le pli, dans la transaction. Quelques centaines de lignes par compte aujourd'hui, sans effet mesurable. Si un compte atteint des milliers de parties, le pli pourra repartir d'un état résumé: ce n'est pas un défaut aujourd'hui, et rien n'est reporté.
- **Tests de la base en local**: comme à l'étape 3.6, un PostgreSQL 16 du conteneur, hors dépôt. Seul écart, connu: `parties.test.ts` attend `23001` là où PostgreSQL 16 rend `23503`. Neon rend `23001`, la CI est verte.
- **Playwright en local**: le dépôt attend un Chromium plus récent que celui du conteneur. Un lien vers l'exécutable installé a suffi, hors dépôt.

## Prochaine action exacte

1. **Le porteur du projet**, après la mise en ligne: noter sa date dans `docs/mesures/retention.md`, puis lancer `pnpm base:rattraper` une fois avec l'adresse de production. Un mois après: lancer `pnpm base:mesurer` et recopier le relevé au même endroit.
2. **La session suivante**: exécuter l'étape `2.8`, la présence et les invitations entre amis. Rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.8 du ROADMAP et de la section 4.4 de `docs/design/etude-amis-et-fiche-joueur.md`. Elle y ajoutera la pastille des demandes d'ami poussée en direct (handoff 3.6, décision 3).

## Étape suivante

Fiche à lire: `docs/plan/etape-2-8.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
