# Fiche étape 3.9 - Le titre

Brief de session. Objectif unique: un compte choisit, depuis son profil, un titre parmi ses succès obtenus. Le titre s'affiche sous son pseudo au salon et sur sa fiche. Un titre non choisi n'affiche rien.

Fiche rédigée le 27 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.9 du ROADMAP (section 4), de la décision 1 de l'étude des succès (`docs/design/etude-succes.md`, section 8), du handoff 3.7 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.7, l'étude des succès, puis cette fiche. Au besoin: la fiche 3.7 (les succès), la fiche 3.5 (la fiche joueur) et la fiche 3.2 (le niveau au salon).

## Pourquoi

Un succès se récompense par la reconnaissance des autres joueurs, pas par des pièces qui n'achètent rien ni par de l'XP qui fausserait le niveau (étude, décision 1). Le titre rend visible, là où les joueurs se croisent, ce qu'un compte a accompli.

## Ordre

**`3.9` passe avant `3.8`**, sur demande du porteur du projet, le 27 septembre 2026. Le titre ne dépend que du socle (`3.7`): il se choisit parmi les succès obtenus, quels qu'ils soient. Les succès de `3.8`, exploits et secrets, deviendront des titres possibles sans rien changer ici. Suite: `3.8`.

## État du dépôt au départ (27 septembre 2026)

1. **Les succès obtenus sont dans `succes_debloques`** (migration `0009`), clé primaire sur le compte et le succès. Un identifiant que le code ne connaît plus est ignoré à la lecture.
2. **Le salon montre le niveau d'un compte** (`CompteDuSalon.niveau`), lu en base à chaque entrée en partie (`identiteDe` de l'annuaire, puis `CompteDeSession`), et projeté par `joueurDuSalon` (`instantane.ts`). Un invité n'a pas de champ `compte`.
3. **La fiche** (`FicheJoueur`) et **le profil** (`ProfilDuCompte`) sont des objets à champs nommés, qui portent déjà les succès.
4. **Les routes des comptes** traduisent, le service décide (`Authentification`), et des comptes en mémoire (`tests/outils/comptes-en-memoire.ts`) servent aux scénarios de bout en bout.
5. **Les migrations s'appliquent au démarrage du serveur**, pendant que l'ancien tourne encore: une migration doit rester compatible avec la version précédente. Une table ajoutée l'est.
6. **Chaque palier de difficulté a sa couleur** sur la page (`data-palier`, étape 3.7).

## Décisions de conception

Aucune n'a été soumise au porteur du projet: elles découlent de l'entrée du ROADMAP et de l'étude. Chacune est signalée au handoff.

1. **Le titre est un succès obtenu, désigné par son identifiant.** Il s'affiche sous le nom du succès (« Centurion »), à la couleur de son palier. Le serveur n'envoie que l'identifiant, comme pour les succès: le nom et le palier viennent du paquet partagé. Un identifiant que la page ne connaît pas n'affiche rien.
2. **Une table à part, `titres`** (migration `0010`): une ligne par compte qui a choisi, clé primaire sur le compte, et **une clé étrangère composée (compte, succès) vers `succes_debloques`**. C'est la base qui garantit qu'un titre est un succès obtenu, pas seulement le service. Une table plutôt qu'une colonne de `comptes`, comme le mot de passe: un compte reste une identité, sans colonne vide selon ses choix, et la table ajoutée est compatible avec la version précédente du serveur.
3. **Choisir, c'est une seule écriture conditionnelle**: l'insertion ne part que si le succès est inscrit pour ce compte, et remplace le titre précédent. Rien n'est lu avant d'écrire, si bien que deux choix simultanés ne laissent jamais un titre non obtenu. **Retirer** efface la ligne, et retirer un titre absent ne fait rien.
4. **Un succès perdu emporte son titre**: la clé étrangère est en cascade. Un succès ne se perd pas aujourd'hui, mais un compte supprimé, ou un succès effacé à la main, ne laisse pas de titre orphelin.
5. **La route**: `POST /api/comptes/titre`, avec une session, corps `{ "titre": "<identifiant>" }` pour choisir, `{ "titre": null }` pour retirer. Réponse: le titre porté après la demande. Refus: 400 pour une demande mal formée ou un identifiant inconnu, **409 pour un succès connu mais pas obtenu** (motif nouveau, `succesNonObtenu`), 401 sans session.
6. **Pas de limite de tentatives propre au titre.** Une demande coûte une écriture sur la ligne de son propre compte, et ne touche personne d'autre: c'est moins qu'une lecture du profil, qui n'est pas limitée. Les limites existantes protègent des secrets (connexion) ou des autres comptes (fiche, gestes d'amitié).
7. **Le titre se lit avec le compte, en une requête**: les lectures du profil par identifiant et par pseudo gagnent une jointure externe sur `titres`. L'entrée en partie, le profil et la fiche le reçoivent sans requête de plus.
8. **Au salon, le titre est celui de l'entrée en partie**, comme le niveau (fiche 3.2): `CompteDeSession` et `CompteDuSalon` gagnent un champ `titre` facultatif. Un titre changé pendant qu'on est dans un salon s'affichera à l'entrée suivante. Les écrans ne proposent de toute façon le profil que hors partie.
9. **Un champ facultatif, absent quand il n'y a pas de titre**, dans le salon, la fiche et le profil: un titre non choisi n'affiche rien, et n'envoie rien. Les contrats existants restent valides tels quels.
10. **Le profil propose une liste déroulante** dans la section « Succès », sous le titre de la section: « Aucun », puis les succès obtenus, rangés par palier. Choisir envoie la demande aussitôt, sans bouton de confirmation; pendant qu'elle part, la liste est désactivée; un refus s'affiche sous elle, et la liste revient au titre porté. Sans succès obtenu, la liste est remplacée par une phrase qui dit comment en obtenir un. Le titre porté s'affiche aussi sous le pseudo, dans l'en-tête du profil.
11. **Un succès secret obtenu peut être un titre**, et s'affiche sous son nom: la fiche montre déjà les succès obtenus, secrets compris.

## Périmètre

1. **Paquet partagé**: `DemandeDeTitre`, `TitreDuCompte`, les champs `titre` de `ProfilDuCompte`, `FicheJoueur`, `CompteDuSalon` et `CompteDeSession`, la validation `validerDemandeDeTitre`, le chemin de la route.
2. **Base**: la table `titres` et sa migration `0010`, choisir, retirer, et la jointure des lectures du profil.
3. **Serveur**: le service (`choisirUnTitre`), le motif `succesNonObtenu`, la route, l'identité d'entrée en partie et le salon.
4. **Client**: la requête, la commande de session, l'état de la demande, les modèles et les écrans du profil, du salon et de la fiche, les styles.
5. **Outils de test**: les comptes en mémoire gardent un titre.
6. **Aucun changement** de `packages/sim` ni des règles de jeu.

## Hors périmètre

- Un titre dans le HUD, au classement, sur l'écran de fin ou dans la liste des amis: l'entrée du ROADMAP dit le salon et la fiche.
- Les succès de `3.8`, exploits et secrets: ils deviendront des titres possibles sans changement ici.
- Mettre à jour en direct le titre d'un joueur déjà dans un salon (décision 8).

## Tests requis

- TU du paquet partagé: la validation de la demande (identifiant connu, `null`, identifiant inconnu, champ absent, pas un objet).
- TU du serveur: la route (codes 200, 400, 401, 409), la projection du salon avec et sans titre, l'identité d'entrée qui porte le titre.
- TI (base): la table et sa clé étrangère (un titre non obtenu est refusé par la base elle-même, la cascade), choisir un succès obtenu, refusé pour un succès non obtenu, remplacer, retirer, retirer sans titre, le titre lu par le profil, la fiche et l'identité d'entrée, un identifiant retiré du code ignoré.
- TU du client: la réduction de la demande, la commande de session, les modèles du profil (liste, titre porté, refus), du salon et de la fiche, les écrans.
- Bout en bout: un compte choisit un titre depuis son profil, puis un autre joueur le lit sous son pseudo au salon.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un titre choisi au profil se lit au salon par un autre joueur, vérifié de bout en bout.
2. La base refuse d'elle-même un titre qui n'est pas un succès obtenu.
3. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-9-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (ordre, étape terminée), le cadrage (salon et profil) et l'étude des succès. Prochaine action exacte: l'étape `3.8`, les exploits de partie. Commiter.
