# Handoff - Étape 3.9 Le titre

Date: 27 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un compte choisit, depuis son profil, un titre parmi ses succès obtenus. Le titre s'affiche sous son pseudo au salon et sur sa fiche. Un titre non choisi n'affiche rien.

## Ce qui a été fait

- **L'étape passe avant `3.8`**, à la demande du porteur du projet: le titre ne dépend que du socle des succès. Consigné au ROADMAP, dans la fiche et dans l'étude.
- **La fiche** `docs/plan/etape-3-9.md`, rédigée selon le cas de repli du PROTOCOLE, onze décisions de conception.
- **Une table `titres`** (migration `0010`): une ligne par compte qui porte un titre, clé primaire sur le compte, et une clé étrangère composée (compte, succès) vers `succes_debloques`, en cascade. C'est la base qui refuse un titre non obtenu.
- **Choisir** est une seule insertion conditionnelle (elle prend la ligne du succès dans `succes_debloques`, ou rien), qui remplace le titre précédent. **Retirer** efface la ligne.
- **Le titre se lit avec le compte**, par une jointure externe dans les lectures du profil: l'entrée en partie, le profil et la fiche le reçoivent sans requête de plus. Un identifiant que le code ne connaît plus est ignoré.
- **Le service et la route**: `choisirUnTitre`, `POST /api/comptes/titre` avec `{ "titre": "<succès>" }` ou `{ "titre": null }`. Refus: 400 demande mal formée ou succès inconnu, 401 sans session, 409 succès non obtenu (motif nouveau `succesNonObtenu`).
- **Le salon** montre le titre de l'entrée en partie (`CompteDeSession.titre`, puis `CompteDuSalon.titre`), comme le niveau.
- **La page**: une liste « Titre » en tête de la section Succès du profil (« Aucun », puis les obtenus rangés par palier), qui envoie le choix aussitôt, se désactive pendant l'attente, dit un refus et revient au titre porté. Le titre s'affiche sous le pseudo, sous le nom du succès et à la couleur de son palier, dans l'en-tête du profil, sur la carte du salon et sur la fiche.

Ni `packages/sim`, ni les règles de jeu ne changent.

## Fichiers créés ou modifiés

- `packages/shared/src/comptes.ts`: `DemandeDeTitre`, `TitreDuCompte`, la route `titre`, les champs `titre` du profil et de la fiche. `evenements.ts`: `CompteDuSalon.titre`. `entrees.ts`: `CompteDeSession.titre`. `validation.ts`: `validerDemandeDeTitre`. `index.ts`: les exports.
- `packages/server/src/base/schema.ts`, `migrations/0010_titres.sql` et `meta/` (drizzle-kit): la table. `base/titres.ts` (créé): choisir et retirer. `base/comptes.ts`: la jointure, et `Profil.titre`.
- `packages/server/src/comptes/annuaire.ts`, `Authentification.ts`, `routes.ts`: le service, le motif, la route, le titre du profil, de la fiche et de l'identité d'entrée. `ServeurSocket.ts`, `instantane.ts`: le titre au salon. `index.ts`: les exports.
- `packages/client/src/comptes/api.ts` et `session.ts`: la requête et la commande. `etat.ts`, `actions.ts`, `reduction.ts`: l'état du dernier choix. `interface/modeles/titre.ts` et `interface/composants/titre.ts` (créés). `modeles/profil.ts`, `salon.ts`, `fiche.ts`, `ecrans/profil.ts`, `ecrans/salon.ts`, `composants/ficheJoueur.ts`: l'affichage. `page/styles/composants.css`: les styles.
- `tests/outils/comptes-en-memoire.ts`: le même choix en mémoire, et `accorderUnSucces` pour les scénarios. `playwright.config.ts`: le scénario du titre ne se joue qu'en cadrage bureau.
- Documentation: `docs/plan/etape-3-9.md` (créée), `docs/plan/ROADMAP.md` (ordre, étape terminée, nouvelle étape `4.7`), `docs/design/README.md` (deux entrées au journal), `docs/design/cadrage.md` (salon, profil), `docs/design/etude-succes.md` (décision 1), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: la validation de la demande (chaque succès connu, `null`, inconnu, absent, pas un objet, champs en trop) et la route;
  - serveur: la route (200, 401 sans jeton, 400, 401, 409, 503 sans base), le salon avec et sans titre, l'entrée en partie qui porte le titre;
  - base (`tests/base/titres.test.ts`, 10 cas, contre une branche Neon): la clé étrangère refuse un titre non obtenu, la cascade par le succès et par le compte, choisir et remplacer, refus sans toucher au titre porté, le succès d'un autre compte ne se prend pas, retirer deux fois, identifiant retiré ignoré, le service de bout en bout, le titre au profil, sur la fiche et à l'entrée en partie; `migrations.test.ts` connaît la table;
  - client: la requête, la commande de session (envoi, profil mis à jour sans relecture, retrait, refus, un choix à la fois, session expirée, invité), la réduction, les modèles du titre, du salon et de la fiche, les écrans du profil (liste, attente, refus, sans succès), du salon et de la fiche;
  - bout en bout (`tests/e2e/titre.spec.ts`): Alice choisit « Centurion » au profil, Bob le lit sous son pseudo au salon et sur sa fiche.
- Résultat: 2 983 tests unitaires et d'intégration au vert (`--project unitaires`), 120 tests de la base au vert contre une branche Neon neuve, et les scénarios de bout en bout des comptes, des amis, de la fiche, du multijoueur et du titre au vert en local (6 sur 6). Vérification visuelle par captures Playwright: en-tête et section Succès du profil, liste sur téléphone, salon sur ordinateur et sur téléphone, fiche.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `b660e90`** (run `36336501020`) du premier coup, tests de la base Neon et scénarios de bout en bout compris, sans relance. La mise en ligne a suivi: le titre et la migration `0010` sont en production depuis le 27 septembre 2026.

## Décisions et écarts au plan

1. **`3.9` avant `3.8`**, sur demande du porteur du projet. Rien de `3.8` n'est tiré en avant: ses succès deviendront des titres possibles sans changement.
2. **Pas de limite de tentatives** propre au choix du titre (fiche, décision 6): une demande n'écrit que la ligne de son propre compte.
3. **Le succès d'un scénario est accordé directement** (`accorderUnSucces` des comptes en mémoire), comme un rattrapage, plutôt que gagné en jouant: le scénario des comptes éprouve déjà le gain d'un succès, et le titre n'a pas à rejouer une partie de trente secondes.
4. **Vérification visuelle sans `pnpm dev`**: sur cette machine, `DATABASE_URL` désigne la base de production, et le serveur y appliquerait ses migrations au démarrage. Les captures ont été prises par le harnais de bout en bout, qui tourne avec des comptes en mémoire.
5. **Écart de branche**: `master` avait reçu un commit de documentation de l'étape 3.7 pendant la session (le rattrapage est fait). Les trois commits de l'étape ont été rejoués par-dessus, sans conflit.
6. **Demande du porteur du projet en cours de session**: créditer Bribz pour le décor de Tokyo et les ninjas, et marquer les autres cartes comme prototypes. Il reste une étape consignée (`3.8`): la demande devient l'étape `4.7`, inscrite au ROADMAP avec la proposition du porteur du projet et les points à trancher. Recommandation: un lien « Crédits » dans le pied de l'accueil plutôt qu'une mention sur chaque vignette, et « Prototype » sur les vignettes des autres cartes, qui ne vise que le décor.

## Problèmes connus et dette

- **Prettier en local sous Windows**: le dépôt se lit en fins de ligne CRLF (`core.autocrlf`), que `prettier --check .` signale sur tous les fichiers non touchés, alors que la configuration demande LF. Les fichiers de l'étape sont en LF et passent la vérification; la CI, sous Linux, n'est pas concernée. Rien n'est reporté: c'est un effet de la copie de travail, pas du dépôt.
- Rien d'autre.

## Prochaine action exacte

Exécuter l'étape `3.8`, les exploits de partie. Rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.8 du ROADMAP et des sections 4 et 5 de `docs/design/etude-succes.md`. Puis l'étape `4.7`, les crédits.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-8.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
