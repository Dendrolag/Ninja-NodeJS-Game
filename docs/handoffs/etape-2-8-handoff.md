# Handoff - Étape 2.8 La présence et les invitations entre amis

Date: 26 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un compte voit lesquels de ses amis sont en ligne, et où, invite un ami en ligne dans sa partie sans lui montrer de code, et rejoint d'un clic la partie publique d'un ami. La liste des amis et sa pastille se mettent à jour en direct.

## Ce qui a été fait

- **La fiche** `docs/plan/etape-2-8.md`, rédigée selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.8 du ROADMAP, de l'étude des amis (sections 4.3 à 4.7) et du handoff 3.6. Quinze décisions de conception, aucune soumise au porteur du projet: l'étude, qu'il a validée, fixait le besoin.
- **Le registre de présence** (`amis/presence.ts`), en mémoire, un par couche réseau, sans horloge: il suit les pages de compte ouvertes et fermées, et la partie de chacune. Un compte à plusieurs pages prend l'état le plus engagé (en partie, salon, en ligne). Une partie terminée compte comme en ligne. D'une partie publique, les amis lisent l'identifiant, le mode, les joueurs et la capacité, d'une partie privée seulement qu'elle l'est.
- **Le registre des invitations** (`amis/invitations.ts`): un droit d'entrée tiré du générateur cryptographique (forme d'un jeton de session), lié à l'inviteur, à l'invité et à la partie, deux minutes sur l'horloge injectée, une invitation par minute vers un même ami, la nouvelle remplaçant l'ancienne.
- **L'assemblage** (`amis/ReseauDesAmis.ts`): les amis d'un compte sont lus à sa première page ouverte, gardés tant qu'il en a une, relus sur signal du service après chaque geste qui a écrit. La présence part entière, à chaque page ouverte et à chaque changement, jamais deux fois la même, et seulement aux amis. Les pages des deux comptes d'un geste reçoivent `amitiesChangees` et relisent leur liste: c'est la pastille en direct, et le blocage reste silencieux. Une invitation tombe, et l'invité l'apprend, quand elle expire, sert, quand la partie finit ou disparaît, quand l'inviteur la quitte, quand l'amitié cesse. Les invitations en attente sont renvoyées à chaque page que l'invité ouvre ensuite.
- **La couche réseau** (`ServeurSocket.ts`) dit à cet assemblage chaque page ouverte ou fermée, chaque entrée, retour et sortie, chaque partie qui change (salon diffusé, lancement, fin, disparition), et le départ définitif d'un compte. Un gestionnaire `inviter` (limite commune des demandes, validation, compte dans une partie). `rejoindre` accepte une quatrième façon de viser une partie, l'invitation: même refus pour un droit inconnu, expiré ou adressé à un autre compte, puis les règles d'entrée habituelles, et le droit n'est consommé qu'à l'entrée réussie.
- **L'annuaire** gagne `amisDe` (une requête sur `amities`, dans les deux colonnes) et `surAmitiesChangees`, sur le modèle de l'écoute des sessions fermées. Aucune migration.
- **La page**: la présence sur chaque ligne d'ami de l'écran Amis, rangée par présence puis par pseudo, avec « Rejoindre » pour le salon d'une partie publique qui a de la place. La présence sur la fiche d'un ami. Une section « Inviter des amis » au salon d'un compte. Des cartes d'invitation au-dessus des écrans de menu (« Alice vous invite », Rejoindre, Ignorer), jamais pendant une partie. La liste relue sur signal, même pendant une lecture, avec la fiche ouverte.

Ni `packages/sim`, ni la base, ni les règles d'entrée d'aucun mode ne changent.

## Fichiers créés ou modifiés

- `packages/shared/src/entrees.ts`: `DemandeRejoindre.invitation`, `DemandeInvitation`. `evenements.ts`: `PartieDUnAmi`, `LieuDUnAmi`, `PresenceDUnAmi`, `InvitationRecue`, `InvitationRetiree`, `InvitationEnvoyee`, l'événement montant `inviter`, les descendants `presenceDesAmis`, `amitiesChangees`, `invitationRecue`, `invitationRetiree`. `bornes.ts`: `BORNES_INVITATIONS`. `validation.ts`: l'invitation dans `validerDemandeRejoindre`, `validerDemandeInvitation`. `index.ts`: les exports.
- `packages/server/src/amis/presence.ts`, `invitations.ts`, `ReseauDesAmis.ts` (créés), et leurs tests.
- `packages/server/src/ServeurSocket.ts`: les faits dits aux amis, `surInviter`, l'entrée par invitation, `envoyerAuxAmis`.
- `packages/server/src/comptes/annuaire.ts` (`AmiConnu`, `amisDe`, `surAmitiesChangees`), `Authentification.ts` (leur implémentation, le signal après un geste qui écrit), `base/amities.ts` (`amisParIdentifiant`), `index.ts`.
- `tests/outils/comptes-en-memoire.ts`: `amisDe` et le signal, comme Authentification. Les annuaires d'essai de `ServeurSocket.comptes.test.ts`, `comptes/routes.test.ts` et `serveur.arret.test.ts` gagnent les deux méthodes.
- `packages/client/src/etat.ts` (`presences`, `invitationsDAmis`), `actions.ts`, `reduction.ts`, `client.ts` (les quatre messages, `inviter`, `ignorerLInvitationDAmi`, l'accès par invitation), `comptes/session.ts` (`relireLesAmis`).
- `packages/client/src/interface/modeles/presence.ts` (créé), `amis.ts`, `fiche.ts`, `accueil.ts` (le refus d'une entrée par invitation reste sur sa carte). `composants/invitationsDAmis.ts`, `inviterDesAmis.ts` (créés), `ficheJoueur.ts`. `ecrans/amis.ts`, `salon.ts`. `application.ts`.
- `packages/client/page/styles/ecrans.css`: pastille de présence, cartes d'invitation, section du salon.
- `tests/e2e/amis-en-direct.spec.ts` (créé), `playwright.config.ts` (joué par le seul projet bureau).
- Documentation: `docs/plan/etape-2-8.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md` (section Amis), `docs/design/etude-amis-et-fiche-joueur.md` (statut), `CLAUDE.md` (une ligne), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: l'entrée par invitation (forme, exclusivité, réglages), la demande d'invitation,
  - serveur, sans base: le registre de présence (11 cas), le registre des invitations (11 cas: émission, remplacement, limite par ami, validité, expiration, retraits, fermeture), l'assemblage (30 cas: présence poussée aux seuls amis, sans doublon, jamais de code, seconde page, base en panne, lecture périmée ignorée, chaque refus d'invitation, droit d'entrée, expiration, service unique, retraits, amitiés changées), la couche réseau par de vraies sockets (11 cas, dont l'entrée dans une partie privée sans code, un autre compte et un invité refusés, un serveur sans comptes),
  - base (`tests/base/amis.test.ts`, 2 cas): `amisDe` dans les deux sens sans demandes ni blocages, le signal après les seuls gestes qui écrivent,
  - client: réduction et câblage (15 cas), modèles (10 cas), application dans un document (13 cas: écran Amis, Rejoindre et son refus, cartes, salon, fiche),
  - bout en bout (bureau, 2 scénarios): la pastille, la présence et l'invitation sans naviguer, jusqu'à l'entrée sans code, puis « Rejoindre » le salon public d'un ami.
- Résultat: `pnpm verify` en local, 2 863 tests unitaires et d'intégration au vert (109 de plus qu'au handoff 3.6), 94 sautés (base Neon absente). Tests de la base contre un PostgreSQL 16 du conteneur: 93 sur 94, le seul échec étant l'écart de version connu (`23503` contre `23001`, handoff 3.6). Bout en bout en local: 58 scénarios sur 58, bureau et mobile, en 6,7 minutes, sans relance.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `83648dd`** (run `36263573183`), tests de la base Neon compris, du premier coup. Le run du premier commit de l'étape a été annulé par la poussée suivante, pas en échec. Mise en ligne sautée: la branche n'est pas `master`.

## Décisions et écarts au plan

1. **Une présence absente est hors ligne, même quand la place attend.** Un joueur dont le lien est tombé en pleine partie n'a pas de page: il ne recevrait pas une invitation. Dire « en partie » serait plus fidèle au jeu, moins à ce qu'on peut faire avec lui.
2. **On invite depuis le salon, pas depuis l'écran Amis** (l'étude, 4.5, mettait Inviter sur l'écran Amis « quand on est soi-même dans un salon »): la navigation est sans effet pendant une partie, on n'est donc jamais à la fois au salon et sur l'écran Amis.
3. **La liste de présence part entière**, pas en changements: aucun ordre ni aucune perte ne peut laisser une présence fausse, et deux cents amis au plus la bornent.
4. **La pastille en direct est un signal sans contenu**, qui fait relire la liste par la route existante: toute la logique de ce qui se montre ou se tait (le blocage silencieux) reste en un seul endroit.
5. **Ignorer une invitation est local**: l'inviteur n'apprend rien, le droit expire de lui-même, et les autres pages de l'invité la gardent jusque-là.
6. **« Rejoindre » ne vaut que pour le salon d'une partie publique qui a de la place**, comme la liste des parties: une partie en cours n'est pas proposée, même si le mode l'accepterait.
7. **Une invitation remplacée ou retirée est dite à l'invité** (`invitationRetiree`), mais le refus d'une entrée par invitation (partie complète, Chasse lancée) la laisse valable le temps qu'il lui reste.
8. **Écart de branche**, comme aux étapes 2.7, 3.5 et 3.6: la session travaille sur la branche imposée `claude/etape-2-8-dbw8hu`, repartie de `master`, et non directement sur `master`. Le porteur du projet a demandé la fusion le 26 septembre 2026: la branche a rejoint `master` en avance rapide, et part en ligne avec la CI de `master`. Aucune migration.

## Problèmes connus et dette

- **Un seul processus serveur**, limite écrite à l'étude (4.4): présence et invitations vivent en mémoire, comme les parties. Le jour de plusieurs processus, les trois devront partager un registre.
- **Tests de la base en local, sans Neon**, comme au handoff 3.6: un PostgreSQL 16 démarré à la main (`initdb`, `pg_ctl` sur le port 5433, hors dépôt) et une configuration Vitest hors dépôt qui migre puis fournit `adresseBase`. Le seul écart reste `parties.test.ts` (`23503` contre `23001`). Si l'outil sert encore, il mériterait toujours une étape.
- **Playwright en local**: le dépôt attend la révision 1234 de Chromium, le conteneur a la 1194. Un lien de l'une à l'autre (`chrome-headless-shell`) a suffi, hors dépôt.

## Prochaine action exacte

Exécuter l'étape `3.7`, le socle des succès: trancher d'abord avec le porteur du projet les six décisions ouvertes de `docs/design/etude-succes.md` (récompense, liste, rattrapage, secrets, ninjas capturés hors Horde, mesure de rétention), puis rédiger la fiche selon le cas de repli du PROTOCOLE.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-7.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
