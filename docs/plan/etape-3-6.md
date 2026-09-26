# Fiche étape 3.6 - Les amis

Brief de session. Objectif unique: deux comptes peuvent devenir amis, par une demande acceptée, depuis un écran Amis (par pseudo) ou depuis la fiche d'un joueur rencontré au salon ou à la fin; l'amitié se retire, un compte se bloque; la fiche d'un ami montre les parties jouées ensemble et le face-à-face.

Fiche rédigée le 26 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.6 du ROADMAP (section 4), de l'étude `docs/design/etude-amis-et-fiche-joueur.md` (sections 3.2, 3.4, 4.1, 4.2, 4.3, 4.5, 4.6 et 7), du handoff 3.5 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.5, l'étude des amis, puis cette fiche. Au besoin: la fiche 3.5 (la fiche joueur et sa fenêtre), la fiche 3.1 (le schéma et les migrations).

## Pourquoi

La fiche joueur (étape 3.5) montre les statistiques d'un joueur rencontré, mais rien ne permet de le retrouver ensuite. L'amitié est ce lien: mutuelle, acceptée, défaite ou bloquée à tout moment. C'est la troisième des quatre étapes des amis; l'étape `2.8` y ajoutera la présence et les invitations, qui supposent la liste d'amis.

## État du dépôt au départ (26 septembre 2026)

1. **La fiche joueur existe** (`GET /api/comptes/joueur?pseudo=…`, `FicheJoueur`), ouverte d'un clic sur un pseudo au salon et au classement de fin, dans une fenêtre montée par l'application (`composants/ficheJoueur.ts`), tenue par l'état du client (`fiche`). Sa réponse est un objet à champs nommés et sa fenêtre une suite de sections, prévues pour s'agrandir.
2. **Le schéma de la base** a huit migrations (`0000` à `0007`). Toute fonctionnalité nouvelle s'ajoute par des tables qui référencent le compte, jamais par une colonne ajoutée aux tables existantes (`base/schema.ts`). Aucune route ne supprime un compte: la cascade suffit pour l'avenir.
3. **Les routes des comptes** passent par un seul routeur (`comptes/routes.ts`), qui traduit les réponses du service (`ReponseDeCompte`, `MotifDeRefus`) en codes HTTP. Le contrôle d'accès du navigateur n'autorise que `GET` et `POST`.
4. **Les limites de débit** sont des seaux (`LimiteurDeTentatives`), réglés dans `LIMITES_COMPTES` (`packages/shared/src/bornes.ts`).
5. **La navigation latérale** a quatre destinations (Jouer, Parties, Créer, Profil); un invité qui demande le profil est mené à la connexion (`ecranPourLaSession`). Sur téléphone, elle se replie en barre de 62 pixels par entrée.
6. **Les comptes en mémoire** des tests (`tests/outils/comptes-en-memoire.ts`) servent les scénarios de bout en bout et les tests d'intégration de la page, sans base.
7. **Une victoire en Équipes** place tous les vainqueurs premiers, et les perdants à égalité après eux; un abandon est placé dernier, à égalité avec les autres abandons.

## Décisions de conception

Aucune n'a été soumise au porteur du projet: l'étude, qu'il a validée le 25 septembre 2026, fixe le besoin, et ce qui suit en découle. Chacune est signalée au handoff.

1. **Trois tables, celles de l'étude** (4.2): `amities (compte_a, compte_b, creee_le)`, une ligne par amitié avec `compte_a < compte_b` imposé par une contrainte, index sur `compte_b`; `demandes_d_ami (de, pour, creee_le)`, dirigée, `de <> pour`, index sur `pour`; `blocages (bloqueur, bloque, cree_le)`, dirigée, `bloqueur <> bloque`. Toutes en `on delete cascade` sur `comptes`. Une migration, `0008`, écrite par `pnpm base:generer`.
2. **Les règles sont une fonction pure du serveur** (`comptes/amities.ts`): à partir des faits entre deux comptes (amis, demande dans chaque sens, blocage dans chaque sens, nombre d'amis de chacun, demandes en attente du demandeur), elle décide si un geste est accepté et quelles écritures il fait. La base lit ces faits et applique ces écritures dans une transaction qui verrouille les deux comptes, dans un ordre fixe: deux gestes croisés ne peuvent ni dépasser une borne ni créer deux fois la même amitié. Les comptes en mémoire des tests appliquent la même fonction.
3. **Sept gestes**, d'un compte sur un autre désigné par son pseudo: demander, accepter, refuser, annuler sa demande, retirer un ami, bloquer, débloquer. Tous sont idempotents: redemander un ami déjà ami ne change rien et ne refuse rien.
4. **Demander.** Un pseudo sans compte rend 404 (« Aucun compte ne porte ce pseudo. »: l'inscription le dit déjà). Soi-même est refusé. Un compte qu'on bloque est refusé (« Vous avez bloqué ce compte. Débloquez-le d'abord. »). Une demande croisée vaut acceptation. Sinon la demande s'enregistre, sous les bornes.
5. **Bloquer défait tout, en silence** (étude, 4.1): l'amitié, les demandes dans les deux sens. Le bloqué ne l'apprend pas: sa fiche du bloqueur ne dit rien, et ses demandes nouvelles sont acceptées et enregistrées, mais le bloqueur ne les voit pas. Débloquer efface ces demandes ignorées: elles ne resurgissent pas.
6. **Refuser, annuler, retirer sont silencieux**: l'autre compte voit seulement la demande ou l'ami disparaître de sa liste.
7. **Les bornes** (étude, 4.1), dans `packages/shared/src/bornes.ts`: 200 amis, 50 demandes envoyées en attente, 10 demandes par minute et par compte. L'amitié (acceptation ou demande croisée) est refusée si l'un des deux a déjà 200 amis; la demande est refusée si le demandeur a 200 amis ou 50 demandes en attente. Les demandes ignorées d'un bloqué comptent dans ses 50. Tous les gestes ont en plus une limite commune, 30 d'un coup puis un par seconde, comme la fiche.
8. **Deux routes**, dans le routeur des comptes, réservées aux comptes connectés: `GET /api/comptes/amis` rend la liste (`ListeDAmis`: amis, demandes reçues, demandes envoyées, comptes bloqués, chacun avec son pseudo et son niveau, triés par pseudo); `POST /api/comptes/amis` porte un geste (`{ geste, pseudo }`) et rend le pseudo du compte visé dans son écriture, la relation qui en résulte et la liste à jour. Un seul point d'entrée pour sept gestes: la validation est une, et le contrôle d'accès du navigateur n'autorise que `GET` et `POST`. Un geste refusé par les règles rend 409, un nouveau motif de refus (`gesteImpossible`). La lecture de la liste n'a pas de limite: elle ne lit que soi, comme le profil.
9. **La fiche dit la relation** (`FicheJoueur.relation`: soi, aucune, ami, demande envoyée, demande reçue, bloqué), vue de celui qui la lit. Un bloqué ne lit jamais qu'il l'est. **Pour un ami**, elle porte les parties jouées ensemble et le face-à-face (`FicheJoueur.ensemble`): combien de fois chacun a fini devant l'autre, sans compter les égalités (les coéquipiers en Équipes, deux abandons). Une jointure de `resultats` sur lui-même par partie. Réservé aux amis (décision 2 de l'étude).
10. **Ajouter depuis le salon et la fin passe par la fiche**, pas par un bouton de plus sur chaque ligne. La fiche s'y ouvre déjà d'un clic sur le pseudo, et elle seule connaît la relation: un bouton par ligne proposerait « Ajouter » pour un ami de longue date. La fiche gagne une section Amitié, avec les gestes que la relation permet, et Bloquer pour tout autre compte que soi.
11. **L'écran Amis est une cinquième destination** de la navigation (décision 6 de l'étude), avec une pastille qui compte les demandes reçues. Il montre, dans l'ordre: le champ « Ajouter par pseudo », les demandes reçues (Accepter, Refuser), les amis, les demandes envoyées (Annuler), les comptes bloqués (Débloquer). Chaque pseudo ouvre sa fiche. Un invité qui demande l'écran est mené à la connexion, comme pour le profil.
12. **La liste se relit sans pousser de message**: à l'ouverture d'une session de compte, à chaque navigation entre les écrans de menu, et au retour aux menus après une partie. Une demande reçue page ouverte n'apparaît donc qu'à la navigation suivante. La pousser en direct touche la couche réseau, que l'étape `2.8` (présence et invitations) ouvre de toute façon: elle l'y fera.
13. **Pas de confirmation avant de retirer ou de bloquer.** Débloquer défait un blocage, et une amitié retirée se redemande. Les deux boutons sont en style secondaire, séparés des autres.
14. **Aucune formule ne genre le joueur**: « Vous devant » et « Bob devant », pas « devant lui ».

## Périmètre

1. **Paquet partagé**: la route, les types (`GesteDAmitie`, `RelationDAmitie`, `DemandeDeGeste`, `PersonneListee`, `ListeDAmis`, `ReponseDeGeste`, `FaceAFace`), la validation d'un geste, les bornes et les limites; `FicheJoueur` gagne `relation` et `ensemble`.
2. **Base**: les trois tables, leur migration, la lecture des faits entre deux comptes, l'application d'un geste dans une transaction verrouillée, la liste, le face-à-face.
3. **Serveur**: la décision pure, `Authentification.amis` et `Authentification.gesteDAmitie`, la relation et le face-à-face dans la fiche, le motif `gesteImpossible` (409), les deux routes.
4. **Client**: les requêtes, l'état des amis, ses actions et ses commandes, l'écran Amis, la navigation et sa pastille, la section Amitié de la fiche et ses gestes, la section Ensemble, les styles.
5. **Outils de test**: les comptes en mémoire tiennent les amitiés par la même décision.
6. **Aucun changement** de `packages/sim`, du transport ni des règles de jeu.

## Hors périmètre

- La présence, les invitations entre amis, « Rejoindre » la partie d'un ami, la pastille poussée en direct: étape `2.8`.
- Le lien d'ami `?ami=Pseudo` (étude, 3.2).
- Les succès liés aux amis: étapes `3.7` et `3.8`.
- La suppression d'un compte.

## Tests requis

- TU de la décision: chaque geste depuis chaque relation, les demandes croisées, les bornes (200 amis de part et d'autre, 50 demandes), soi-même, le blocage silencieux dans les deux sens, les demandes ignorées effacées au déblocage, la relation vue par chacun.
- TU de la validation d'un geste.
- TU des routes: 200, 400, 401, 404, 409, 429 et 503 des deux routes.
- TI (base): contraintes des trois tables (ordre, soi-même, doublon), demande et acceptation, demandes croisées, refus, retrait, blocage et déblocage, demande d'un bloqué enregistrée mais invisible, bornes, gestes concurrents qui ne créent qu'une amitié, cascade à la suppression d'un compte, face-à-face et relation dans la fiche, liste triée.
- TU du client: requêtes, réduction (liste lue, geste en cours, refusé, accepté, fiche relue), session (liste lue à l'ouverture d'une session, à la navigation, refus en invité), modèles (écran Amis, navigation et pastille, section Amitié et Ensemble de la fiche), écran et fenêtre.
- Bout en bout (bureau): Alice demande Bob par son pseudo; Bob voit la pastille, accepte; les deux se voient amis; Alice retire Bob. Puis, au salon, Alice ajoute Bob depuis sa fiche, Bob accepte depuis la sienne, ils jouent une partie courte, et la fiche de Bob montre à Alice une partie jouée ensemble.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Deux comptes deviennent amis par pseudo et depuis la fiche, vérifié de bout en bout.
2. Un bloqué n'apprend jamais qu'il l'est, vérifié contre la base.
3. La fiche d'un ami montre les parties jouées ensemble et le face-à-face; celle d'un autre compte non.
4. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-6-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée), le cadrage si besoin, et l'étude des amis (statut). Prochaine action exacte: l'étape `2.8`, la présence et les invitations. Commiter.
