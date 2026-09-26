# Fiche étape 2.7 - Le lien d'invitation

Brief de session. Objectif unique: une adresse `?partie=CODE` ouvre le jeu sur l'entrée dans cette partie privée, et le salon d'une partie privée propose de partager ce lien.

Fiche rédigée le 26 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.7 du ROADMAP (section 4), de l'étude `docs/design/etude-amis-et-fiche-joueur.md` (sections 3.1, 4.7 et 5), du handoff 8.7 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 8.7, l'étude des amis, puis cette fiche. Au besoin: les fiches 2.4 (parties privées par code) et 2.6 (état du lien sur l'accueil).

## Pourquoi

Une partie privée se rejoint par un code de six caractères. Aujourd'hui, l'invité doit ouvrir le jeu, aller dans « Parcourir » et taper le code que l'hôte lui a dicté ou envoyé. L'étude des amis a montré que le besoin premier, rejouer ensemble, tient surtout à un lien qu'on envoie dans n'importe quelle messagerie, et qui sert aussi les invités sans compte. C'est la première des quatre étapes des amis, et la seule qui ne touche ni la base ni le transport.

## État du dépôt au départ (26 septembre 2026)

1. **Le serveur accepte déjà une entrée par code** (`rejoindre` avec `code`, étape 2.4), validée par `validerCodeInvitation` (`packages/shared/src/validation.ts`), qui ramène le code à sa forme canonique (majuscules, sans espaces). Un code inconnu est refusé avec un motif, et chaque essai consomme un jeton de la limite de débit.
2. **Le salon d'une partie privée montre son code** et un bouton qui le copie (`interface/ecrans/salon.ts`). Aucun lien n'existe.
3. **La page ne lit dans son adresse que `?diagnostic=1`** (étape 8.5, `diagnostic/demande.ts`), lu dans `principal.ts`.
4. **L'accueil** (`interface/modeles/accueil.ts`, `interface/ecrans/accueil.ts`) porte le champ de pseudo d'un invité, le bouton « Partie rapide », l'état du lien, et le refus d'entrée du serveur sous le champ.
5. **Une page rechargée en partie reprend sa place** (étape 2.5) avant toute autre entrée: elle ne peut pas entrer ailleurs pendant ce temps.
6. **En production, la page est servie par Vercel et le serveur de jeu par Render**: le lien doit pointer vers la page, pas vers le serveur.

## Décisions de conception

Aucune décision n'a été soumise au porteur du projet: l'étude, qu'il a validée le 25 septembre 2026, fixe le besoin, et ce qui suit en découle. Chacune est signalée au handoff.

1. **L'entrée se fait sur l'accueil, pas sur un écran nouveau.** Avec une invitation, l'accueil annonce « Une partie privée vous attend », avec le code; son bouton principal devient « Rejoindre la partie », qui envoie la demande d'entrée par ce code; « Ignorer » rend l'accueil ordinaire. Un invité y choisit son pseudo dans le champ qui existe déjà. Un écran de plus aurait demandé un nouvel état de navigation pour un seul formulaire.
2. **Un compte rejoint en un clic, pas d'office.** Il n'a pas de pseudo à choisir, mais l'entrée reste un geste du joueur: une page ouverte depuis une messagerie, parfois des heures plus tard, n'entre pas seule dans une partie.
3. **Un code mal formé se dit.** L'accueil affiche « Ce lien d'invitation n'est pas valable », avec le motif de `validerCodeInvitation`, et « Ignorer ». Rien ne part au serveur. Un code bien formé mais inconnu, ou une partie pleine ou déjà lancée, est refusé par le serveur, et son motif s'affiche sous le formulaire, comme pour toute entrée.
4. **L'invitation vit dans l'état du client**, lue une fois au démarrage. Elle cesse à la première entrée acceptée, dans cette partie ou une autre, et quand le joueur l'ignore. Elle survit à un retour en partie (étape 2.5), qui passe avant elle.
5. **L'adresse oublie l'invitation dès qu'elle a servi**: la page retire `partie` de son adresse, sans recharger ni ajouter d'entrée à l'historique. Recharger ensuite ne repropose pas une partie finie. Les autres paramètres, dont `diagnostic`, restent.
6. **Le lien partagé est l'adresse de la page, avec le seul paramètre `partie`.** Ni `diagnostic`, ni fragment: un relevé de performance ne se transmet pas avec une invitation.
7. **Partager sur un appareil tactile, copier ailleurs.** Le salon d'une partie privée gagne un bouton « Partager le lien » quand le navigateur sait partager (`navigator.share`) et que son pointeur principal est tactile; « Copier le lien » sinon. Sur ordinateur, le partage du système est rare et déroutant, la copie est ce qu'on attend. Un partage annulé par le joueur ne dit rien; un partage qui échoue autrement se rabat sur la copie; une copie impossible montre le lien, à sélectionner.

## Périmètre

1. **Page**: lire `?partie=` au démarrage (`principal.ts`), et retirer le paramètre de l'adresse quand l'invitation a servi.
2. **Client**: l'invitation dans l'état, ses actions (ouverte, ignorée), la commande pour l'ignorer, son effacement à l'entrée.
3. **Interface**: l'accueil avec invitation; le bouton de partage du salon; son pictogramme; leurs styles.
4. **Aucun changement** de `packages/shared` hors lecture, du serveur, de la base, du transport ou de `packages/sim`.

## Hors périmètre

- Un lien pour les parties publiques: elles se rejoignent par la liste, et n'ont pas de code.
- Le lien d'ami `?ami=Pseudo` (étude, section 3.2): il suivra la fiche joueur, si on le veut.
- Un aperçu du salon avant d'entrer (hôte, mode, places): il demanderait un message réseau nouveau.
- Les invitations entre amis connectés: étape `2.8`.

## Tests requis

- TU de la lecture du code dans l'adresse: absent, bien formé, en minuscules ou avec des espaces, mal formé, vide; de l'adresse d'invitation fabriquée et de l'adresse qui l'oublie.
- TU de l'état: invitation ouverte, ignorée, effacée par l'entrée, gardée par une sortie de partie.
- TU du modèle et de l'écran d'accueil avec invitation: pseudo demandé à un invité, pas à un compte, demande envoyée par le code, refus du serveur affiché, code mal formé, « Ignorer ».
- TU du partage: choix entre partager et copier, partage annulé, partage en échec rabattu sur la copie, copie impossible.
- Bout en bout (bureau): Alice crée une partie privée et copie le lien depuis son salon; Bob, invité, ouvre le lien, choisit son pseudo et entre dans le salon d'Alice; son adresse ne porte plus le code.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un invité qui ouvre un lien d'invitation entre dans la partie privée, vérifié de bout en bout.
2. Les parcours existants (accueil, parties, retour en partie, lien perdu) passent sans changement.
3. Aucun changement du serveur ni du moteur: la couverture de `packages/sim` ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-2-7-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée) et l'étude des amis. Prochaine action exacte: l'étape `3.5`, la fiche joueur. Commiter.
