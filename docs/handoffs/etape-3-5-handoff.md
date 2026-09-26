# Handoff - Étape 3.5 La fiche joueur

Date: 26 septembre 2026
Auteur: session Claude Code
Statut: terminée, sous réserve de la CI (voir « Tests »)

## Objectif de l'étape

Tout compte connecté peut lire la fiche d'un autre compte, par son pseudo, depuis le salon et le classement de fin; le profil passe à la même agrégation des statistiques.

## Ce qui a été fait

- **La fiche** `docs/plan/etape-3-5.md`, rédigée selon le cas de repli du PROTOCOLE, à partir de l'entrée du ROADMAP et de l'étude des amis. Treize décisions de conception, aucune soumise au porteur du projet: l'étude, qu'il a validée, fixait le contenu.
- **La route** `GET /api/comptes/joueur?pseudo=…` (`adresseDeLaFiche`, `FicheJoueur`): 401 sans session valable, 400 pour un pseudo mal formé, 404 « Aucun compte ne porte ce pseudo. », 429 au-delà de 30 lectures puis une par seconde et par compte (`LIMITES_COMPTES.ficheParCompte`), 503 sans base. Le pseudo est retrouvé quelle que soit son écriture, et rendu dans celle du compte.
- **Une agrégation par mode** (`statistiquesParMode`, une requête `group by`), qui remplace `statistiquesDuCompte`, et une déduction pure (`statistiquesDeJoueur`): totaux, ordre des modes, mode préféré départagé par la partie la plus récente, dont la date ne sort pas du serveur. Chaque mode porte ses parties, ses parties à plusieurs, ses victoires, son meilleur score et son meilleur score joué seul.
- **Le profil passe à la même agrégation**: tuiles Parties jouées, Victoires (« sur 9 parties à plusieurs »), Mode préféré, Pièces, Points de ligue, puis un tableau « Par mode ». Le meilleur score global et la tuile « Record Massacre solo » disparaissent: ce record est la colonne « Seul » de la ligne Massacre.
- **La fenêtre de la fiche**, montée par l'application comme celle du code de secours, et tenue par l'état du client (`fiche`): lecture en cours, échec avec « Réessayer », fiche lue en trois sections (identité, statistiques, par mode). Elle se ferme par son bouton, la croix, Échap ou un clic à côté, et d'elle-même quand l'écran change ou que la session redevient celle d'un invité. Une réponse arrivée pour une fiche fermée ou remplacée est ignorée.
- **Le pseudo devient un bouton** « Bob, voir sa fiche » au salon et dans le tableau du classement de fin, pour un joueur qui a un compte, quand on a soi-même un compte. Sa propre ligne aussi. Un invité ne voit aucun bouton.
- **Règle 7**: « Inscrit le » genrait le joueur; il devient « Membre depuis le », au profil comme sur la fiche. Et en construisant le tableau, le profil débordait de l'écran d'un téléphone: ses grilles ne pouvaient pas se réduire sous la largeur d'un tableau. Corrigé avant commit, vérifié en capture à 390 pixels, fiche comprise.

Ni `packages/sim`, ni le transport, ni le schéma de la base (aucune migration) ne changent.

## Fichiers créés ou modifiés

- `packages/shared/src/comptes.ts`: la route, `PARAMETRE_PSEUDO`, `adresseDeLaFiche`, les types `StatistiquesDUnMode`, `StatistiquesDeJoueur`, `FicheJoueur`; `ProfilDuCompte.statistiques` change de type; `StatistiquesDuCompte` disparaît. `bornes.ts`: la limite de lecture. `index.ts`: les exports.
- `packages/server/src/base/parties.ts`: `statistiquesParMode` remplace `statistiquesDuCompte`. `base/comptes.ts`: `profilParPseudo`.
- `packages/server/src/comptes/statistiques.ts` (créé): la déduction pure. `Authentification.ts`: `ficheJoueur`, `JOUEUR_INCONNU`, la limite optionnelle `ficheParCompte`, le profil sur la nouvelle agrégation. `annuaire.ts`: la méthode et le motif `joueurInconnu`. `routes.ts`: la route et son 404. `index.ts`: les exports.
- `packages/client/src/comptes/api.ts`: la requête `joueur`, `ficheDEssai`, `STATISTIQUES_VIDES`. `comptes/session.ts`: `ouvrirLaFiche`, `fermerLaFiche`. `etat.ts`, `actions.ts`, `reduction.ts`: l'état de la fiche, ses quatre actions, sa fermeture au changement d'écran et en invité.
- `packages/client/src/interface/modeles/statistiques.ts` et `fiche.ts` (créés), `profil.ts`, `salon.ts` (`aUneFiche`), `fin.ts` (`aUneFiche`). `composants/statistiques.ts` et `ficheJoueur.ts` (créés: tuiles, tableau, fenêtre, bouton de fiche). `ecrans/profil.ts`, `salon.ts`, `fin.ts`, `application.ts`. `index.ts`: les exports.
- `packages/client/page/styles/composants.css`, `ecrans.css`: le tableau par mode, le bouton de pseudo, la fenêtre, les grilles qui se réduisent.
- `tests/outils/comptes-en-memoire.ts`: la fiche, et le profil par la même déduction que le serveur.
- `playwright.config.ts`: le scénario de la fiche, joué par le seul projet bureau.
- Documentation: `docs/plan/etape-3-5.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md` (section du profil), `docs/design/etude-amis-et-fiche-joueur.md` (statut), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: l'adresse de la fiche, pseudo avec espace, accent, point, signes de requête, « . » et « .. » relus tels quels sur la bonne route;
  - serveur, sans base: la déduction (vide, totaux, ordre, mode préféré et son départage, colonne « Seul » absente sans partie seul); la route (200, pseudo relu, « .. », pseudo absent ou répété, 401, 404, 429, 503);
  - base (Neon, `tests/base/fiche.test.ts`, et `profil.test.ts` mis à jour): agrégats par mode et mode préféré sur un jeu de parties connu, niveau et palier, rien de privé, mode le plus joué même plus ancien, fiche sans partie, pseudo en minuscules et entouré d'espaces, refus sans session, pseudo mal formé ou qui n'est pas du texte, pseudo inconnu, limite par compte qui ne gêne pas les autres, route de bout en bout avec un pseudo « Léa B. »; profil par mode, record Massacre solo rangé dans sa ligne;
  - client: la requête (adresse encodée, jeton, 404); la réduction (ouverture, réception, refus, réponse périmée ignorée, fermeture au changement d'écran et en invité); la session (jeton, pas de double lecture, session expirée en salon et hors partie, réponse après déconnexion, invité); les modèles de la fiche, des statistiques, du profil, du salon et de la fin (`aUneFiche` selon la session, le compte, un joueur parti); la fenêtre montée par l'application, au salon et à la fin;
  - intégration page et serveur (`comptes-serveur.test.ts`): la fiche d'un autre compte lue au salon, et un pseudo inconnu;
  - bout en bout (`tests/e2e/fiche.spec.ts`, bureau): Alice et Bob s'inscrivent, jouent une partie courte ensemble; au classement, Alice ouvre la fiche de Bob et y lit une partie en Horde, sans pièces ni dernières parties, puis la ferme.
- Résultat: `pnpm verify` en local, 2 655 tests unitaires et d'intégration au vert (53 de plus qu'au handoff 2.7), 75 sautés (base Neon absente en local: les sept tests de `fiche.test.ts` et ceux de `profil.test.ts` mis à jour n'ont donc pas tourné ici). Types, linter et formatage verts. Bout en bout en local, Chromium sans interface: la fiche, le compte, les parties et le multijoueur au vert.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: à lire sur le commit poussé. C'est elle qui exécute pour la première fois les tests de la base écrits ici; un échec y serait à corriger en priorité.

## Décisions et écarts au plan

1. **La route n'est pas celle de l'étude** (`/api/joueurs/:pseudo`): un pseudo peut valoir « .. », que le navigateur lit dans un chemin comme un retour au dossier parent, même encodé. Elle passe en paramètre, dans le routeur des comptes.
2. **La colonne « Seul » vaut pour tous les modes**, et pas seulement le Massacre: c'est la lecture retenue de « un cas du même tableau au lieu d'une exception » (étude, 3.3). Le porteur du projet peut vouloir la réserver au Massacre.
3. **La fiche ne donne ni l'XP ni les points de ligue exacts**, seulement le niveau et le palier. Ni sa propre fiche ni la limite de lecture n'étaient demandées: ajoutées, la première parce qu'elle montre ce que les autres voient, la seconde parce que chaque lecture agrège tout l'historique.
4. **À la fin, un joueur parti avant la fin n'a pas de bouton**: le classement ne dit pas qui a un compte, et le salon ne le connaît plus. Le transport n'a pas été touché pour si peu.
5. **Écart de branche**, comme à l'étape 2.7: la session travaille sur la branche imposée `claude/etape-3-5-x2d5ab`, repartie de `master` (qui portait la 2.7), et non directement sur `master`. Rien ne part en ligne tant qu'elle n'a pas rejoint `master`, ce que décide le porteur du projet.

## Problèmes connus et dette

- **Les tests de la base n'ont pas tourné en local** (pas d'identifiants Neon dans ce conteneur): ils ne sont éprouvés que par la CI.
- Pas de fiche ouvrable ailleurs qu'au salon et à la fin: l'écran Amis de l'étape `3.6` apportera la recherche par pseudo.

## Prochaine action exacte

Vérifier que la CI du commit de l'étape est verte, tests de la base compris. Puis exécuter l'étape `3.6`, les amis: rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.6 du ROADMAP et des sections 4.1, 4.2, 4.5 et 4.6 de `docs/design/etude-amis-et-fiche-joueur.md`. La fiche joueur y gagne les parties jouées ensemble et le face-à-face, dans une nouvelle section de `composants/ficheJoueur.ts`.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-6.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
