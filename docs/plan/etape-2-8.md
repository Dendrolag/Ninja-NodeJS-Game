# Fiche étape 2.8 - La présence et les invitations entre amis

Brief de session. Objectif unique: un compte voit lesquels de ses amis sont en ligne, et où, invite un ami en ligne dans sa partie sans lui montrer de code, et rejoint d'un clic la partie publique d'un ami. La liste des amis et sa pastille se mettent à jour en direct.

Fiche rédigée le 26 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.8 du ROADMAP (section 4), de l'étude `docs/design/etude-amis-et-fiche-joueur.md` (sections 4.3, 4.4, 4.5, 4.6 et 4.7), du handoff 3.6 (décision 3, la pastille en direct) et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.6, l'étude des amis, puis cette fiche. Au besoin: les fiches 2.5 (la place en partie, le registre des places) et 3.6 (les amis, leurs règles et leur écran).

## Pourquoi

Depuis l'étape 3.6, deux comptes peuvent devenir amis, mais la liste ne sert qu'à ouvrir des fiches. Ce qu'elle seule peut apporter, c'est de voir qui joue en ce moment et de l'inviter d'un geste. C'est la dernière des quatre étapes des amis. Le lien d'invitation de l'étape 2.7 couvre l'ami hors ligne, celle-ci l'ami qui a une page ouverte.

## État du dépôt au départ (26 septembre 2026)

1. **La page garde un lien Socket.IO ouvert hors partie** (étape 2.6), rattaché au compte par son jeton à l'ouverture (`socket.data.compteId`, étape 3.2). Le serveur sait donc, en mémoire, quels comptes ont une page ouverte et dans quelle partie chacune se trouve (`ServeurSocket.connexions`).
2. **Les amitiés sont en base** (étape 3.6): trois tables, des règles pures (`comptes/amities.ts`) et un geste par la route `POST /api/comptes/amis`. La couche réseau n'en sait rien: l'annuaire (`comptes/annuaire.ts`) ne lui offre que la session, l'identité, le pseudo et la fin de partie, plus l'écoute des sessions fermées (étape 3.4).
3. **La liste des amis se relit à la navigation** (étape 3.6, décision 12): une demande reçue page ouverte n'apparaît qu'à la navigation suivante.
4. **Une partie se vise de trois façons** (`DemandeRejoindre`): par code (privée), par identifiant (publique seulement), ou rien (partie rapide). Une partie privée visée par son identifiant reçoit le refus d'une partie inexistante.
5. **Le serveur de production est un seul processus**, et les parties vivent déjà en mémoire de ce processus.
6. **Hors partie, la page a des écrans de menu** (accueil, parties, créer, connexion, amis, profil), et des écrans de partie (salon, jeu, fin). La navigation est sans effet pendant une partie.

## Décisions de conception

Aucune n'a été soumise au porteur du projet: l'étude, qu'il a validée le 25 septembre 2026, fixe le besoin, et ce qui suit en découle. Chacune est signalée au handoff.

1. **La présence se déduit des pages ouvertes**, dans un registre en mémoire que possède la couche réseau, un par serveur, comme le registre des places (règle 5: aucun état de module). Rien ne s'écrit en base. Un compte sans page ouverte est hors ligne, y compris un joueur dont le lien est tombé en pleine partie et dont la place attend: il ne peut rien recevoir.
2. **Quatre états, dont trois se montrent**: en ligne (sur les menus), dans un salon, en partie. Hors ligne ne se transmet pas: un ami absent de la liste l'est. Un compte qui a plusieurs pages ouvertes prend l'état le plus engagé (en partie, puis salon, puis en ligne). Une partie terminée compte comme en ligne: son écran de fin n'empêche pas de répondre.
3. **Une partie publique se montre, une privée se tait.** Pour une partie publique: son identifiant, déjà public dans la liste des parties, son mode, ses joueurs et sa capacité. Pour une partie privée: seulement qu'elle l'est. La présence ne transporte jamais un code.
4. **La couche réseau connaît les amis des comptes connectés.** À la première page ouverte d'un compte, elle lit ses amis (identifiant et pseudo) en une requête, et les garde tant qu'il a une page ouverte. Une amitié étant mutuelle, les amis d'un compte sont aussi ceux qui le voient. L'annuaire gagne cette lecture (`amisDe`) et une écoute des amitiés changées (`surAmitiesChangees`), sur le modèle de l'écoute des sessions fermées: le service prévient après chaque geste qui a écrit, et la couche réseau relit les amis des deux comptes.
5. **La présence se pousse, en entier.** Chaque compte connecté reçoit la liste de ses amis en ligne, avec leur état (`presenceDesAmis`): à l'ouverture de chaque page, puis à chaque changement, et seulement si elle diffère de la dernière envoyée. Une liste entière plutôt que des changements: un message perdu ou un ordre inversé ne laisse jamais de présence fausse. Deux cents amis au plus la bornent.
6. **La liste des amis se met à jour en direct.** Après un geste qui a écrit, les pages des deux comptes reçoivent un signal sans contenu (`amitiesChangees`), et relisent leur liste par la route existante. Le blocage reste silencieux: la page du bloqué relit une liste où l'ami a disparu, comme après un retrait, et celle du bloqueur ne voit pas les demandes ignorées. C'est la pastille en direct que l'étape 3.6 laissait à celle-ci.
7. **On invite depuis le salon.** C'est le seul endroit où l'on est dans une partie en restant hors du jeu. Le salon d'un compte gagne une section « Inviter des amis », qui liste ses amis en ligne qui ne sont pas déjà dans cette partie, avec un bouton Inviter. L'écran Amis ne peut pas inviter: on n'y est jamais dans une partie.
8. **Une invitation se demande au serveur, qui vérifie tout** (`inviter`, avec accusé). La connexion est celle d'un compte, dans une partie qui n'est pas finie. Le pseudo est celui d'un ami, ce qui exclut un bloqué dans les deux sens, le blocage défaisant l'amitié. Cet ami a une page ouverte, et n'est pas déjà dans la partie. Un non-ami et un bloqué reçoivent le même refus. Limites: la limite commune des demandes de la connexion, et une invitation par minute vers un même ami (étude, 4.6).
9. **L'invitation porte un droit d'entrée tenu par le serveur**, pas un code. Un jeton aléatoire de la forme des jetons de session, lié à l'inviteur, à l'invité et à la partie, valable deux minutes. Une invitation nouvelle du même inviteur au même ami remplace la précédente. Le serveur la retire, et le dit aux pages de l'invité (`invitationRetiree`), quand elle expire, quand elle a servi, quand la partie se termine ou disparaît, quand l'inviteur quitte la partie, et quand leur amitié cesse. Les invitations en attente sont renvoyées à chaque page que l'invité ouvre ensuite (rechargement, second onglet).
10. **Rejoindre par invitation est une quatrième façon de viser une partie** (`DemandeRejoindre.invitation`), exclusive des trois autres. Le droit ne vaut que pour le compte invité: inconnu, expiré ou adressé à un autre, il reçoit le même refus, « Cette invitation n'est plus valable. ». Ensuite, la partie accueille ou refuse selon ses règles habituelles, inchangées: capacité, Chasse lancée, pseudo pris. Le droit n'est consommé qu'à l'entrée réussie. Une fois membre, l'invité voit le code d'une partie privée, comme tout membre du salon: c'est l'invitation qui ne le montre pas.
11. **L'invitation reçue s'affiche au-dessus des écrans de menu**, pas du salon, du jeu ni de la fin: « Alice vous invite », le mode, les joueurs, « partie privée » s'il y a lieu, avec Rejoindre et Ignorer. En partie, elle attend le retour aux menus, si elle vaut encore (étude, 4.4). Ignorer est local et silencieux: l'inviteur n'apprend rien, et le droit expire de lui-même.
12. **« Rejoindre » la partie d'un ami, depuis l'écran Amis**, pour un ami dans le salon d'une partie publique qui a de la place: c'est l'entrée par identifiant qui existe. Pas pour une partie en cours, que la liste des parties ne propose pas non plus, ni pour une partie privée, qui demande une invitation.
13. **L'écran Amis montre la présence**: chaque ami porte son état en une ligne, et les amis se rangent par état (dans un salon, en ligne, en partie, hors ligne), puis par pseudo. La fiche d'un ami dit aussi son état (étude, 4.3).
14. **Aucune formule ne genre le joueur**: « Alice vous invite », « Invitation envoyée à Bob ».
15. **Limite connue, écrite à l'étude** (4.4): présence et invitations supposent un seul processus serveur, comme les parties elles-mêmes.

## Périmètre

1. **Paquet partagé**: les types de la présence (`PresenceDUnAmi`, `LieuDUnAmi`, `PartieDUnAmi`), de l'invitation (`DemandeInvitation`, `InvitationEnvoyee`, `InvitationRecue`, `InvitationRetiree`), le champ `invitation` de `DemandeRejoindre`, leurs validations, les bornes (`BORNES_INVITATIONS`), et les événements (`inviter`, `presenceDesAmis`, `amitiesChangees`, `invitationRecue`, `invitationRetiree`).
2. **Base et service**: la lecture des amis d'un compte avec leur identifiant, `amisDe` et `surAmitiesChangees` dans l'annuaire et dans Authentification.
3. **Serveur**: le registre de présence (pur, sans horloge), le registre des invitations (droits d'entrée, délais sur l'horloge injectée, limite par ami), et leur orchestration, branchée sur la couche réseau: pages ouvertes et fermées, entrées et sorties, changements de partie, `inviter`, entrée par invitation.
4. **Client**: les nouveaux messages, l'état (présence, invitations reçues et envoyées), les commandes (inviter, rejoindre ou ignorer une invitation), la relecture sur signal.
5. **Interface**: la présence sur l'écran Amis et sur la fiche, « Rejoindre » la partie d'un ami, la section « Inviter des amis » du salon, les cartes d'invitation au-dessus des menus, leurs styles.
6. **Outils de test**: les comptes en mémoire gagnent `amisDe` et `surAmitiesChangees`.
7. **Aucun changement** de `packages/sim`, de la base (aucune migration), ni des règles d'entrée d'aucun mode.

## Hors périmètre

- Inviter un ami hors ligne: le lien d'invitation (étape 2.7) le fait.
- Une messagerie entre amis, un « suivi » à sens unique (étude, section 6).
- Le lien d'ami `?ami=Pseudo` (étude, 3.2).
- Plusieurs processus serveur.
- Les succès liés aux amis: étapes `3.7` et `3.8`.

## Tests requis

- TU du registre de présence: pages ouvertes et fermées, entrée et sortie de partie, plusieurs pages d'un même compte, état le plus engagé, partie publique et privée (aucun code), partie terminée.
- TU du registre des invitations: émission, remplacement, limite par ami, validité (accepté, expiré, adressé à un autre), consommation, retraits (partie, inviteur parti, amitié rompue), invitations en attente d'un compte, fermeture.
- TU de l'orchestration et TI de la couche réseau, avec un annuaire d'essai:
  - présence poussée à l'ouverture et aux changements, sans doublon, rien aux non-amis ni aux invités, jamais de code,
  - invitation acceptée, refusée d'un non-ami et d'un bloqué, d'un ami hors ligne, déjà présent, trop tôt,
  - entrée par invitation acceptée, expirée, d'un autre compte, dans une partie pleine,
  - retraits annoncés, signal `amitiesChangees` aux deux comptes, relecture des amis.
- TU des validations partagées.
- TI (base): `amisDe` rend les amis dans les deux sens, sans les demandes ni les blocages, et `surAmitiesChangees` prévient après un geste qui écrit, pas après un geste sans effet.
- TU du client: réduction (présence, invitations reçues, retirées, tentées, envoyées, remises à zéro), câblage des messages et commandes, relecture sur signal, modèles (écran Amis, fiche, section du salon, cartes d'invitation), composants dans un document.
- Bout en bout (bureau): Bob voit Alice en ligne sur son écran Amis. Alice crée une partie privée, Bob la voit « dans une partie privée ». Alice invite Bob depuis son salon, Bob rejoint par la carte d'invitation, sans code, et Alice le voit entrer. Puis la pastille en direct: une demande reçue page ouverte apparaît sans naviguer. Puis « Rejoindre » la partie publique d'un ami.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un compte invite un ami, qui entre dans la partie privée sans voir de code, vérifié de bout en bout.
2. La présence ne va qu'aux amis et ne porte jamais de code, vérifié par les tests de la couche réseau.
3. Un droit d'entrée expiré, ou adressé à un autre compte, ne fait entrer personne.
4. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-2-8-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée), le cadrage (section Amis), l'étude des amis (statut) et `CLAUDE.md` si besoin. Prochaine action exacte: l'étape `3.7`, le socle des succès. Commiter.
