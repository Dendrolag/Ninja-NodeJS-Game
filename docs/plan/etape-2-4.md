# Fiche étape 2.4 - Matchmaking, parties privées et publiques

Brief de session. Objectif unique: créer et rejoindre des parties, en public via un navigateur de salons, et en privé via un code d'invitation. C'est la concrétisation du flux création et salon de la maquette.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.3, le cadrage docs/design/cadrage.md (contrat de configuration de partie et inventaire des écrans création, navigateur, salon), puis cette fiche.

## Objectif

Permettre à un joueur de créer une room à partir d'une configuration de partie, de la rendre publique ou privée, de lister les rooms publiques ouvertes, et de rejoindre une room soit depuis la liste publique soit via un code d'invitation. Le tout au-dessus du RoomManager et des contrats de l'étape 2.2.

## Contrat de configuration de partie (depuis le cadrage)

La création utilise les champs définis au cadrage: mode (v1 limité à classique), carte, visibilité publique ou privée, durée, nombre de faux ninjas, présence de black ninjas, bonus actifs, malus actifs, zones spéciales, capacité déduite du mode. Respecter les valeurs par défaut du cadrage.

## Périmètre

1. Création de room: à partir d'une configuration validée, le RoomManager instancie une room. Si elle est privée, lui associer un code d'invitation unique.
2. Navigateur public: exposer la liste des rooms publiques ouvertes avec les colonnes de la maquette (hôte, mode, carte, joueurs, et un indicateur de latence). Ne lister que les rooms publiques en phase de salon et non pleines.
3. Rejoindre: par sélection dans la liste publique, ou par saisie d'un code pour une room privée. Refuser si la room est pleine, déjà lancée selon le cas, ou si le code est invalide.
4. Salon: gérer l'état du salon d'une room (joueurs présents avec pseudo et niveau, état prêt, hôte, places libres), le réglage de la configuration par l'hôte avant lancement, et le lancement par l'hôte. Reprendre proprement la logique du salon legacy (joinWaitingRoom, updateGameSettings, startGameFromRoom), réécrite par room.
5. Validation: borner les champs de configuration (durée, nombre de faux ninjas, capacité) à des plages sûres, pour ne pas permettre des valeurs aberrantes.

## Hors périmètre

- Aucun classement par niveau ni appariement par compétence. La version 1 ne fait pas d'appariement fin, juste liste publique et code privé.
- Aucune persistance ici. Les comptes et la progression sont la phase 3. Le pseudo et le niveau affichés au salon peuvent venir d'une source temporaire tant que la phase 3 n'est pas faite, et seront branchés sur le compte ensuite.
- Aucun des cinq autres modes. La configuration accepte le champ mode, mais seul classique est jouable.
- Aucune interface. Le navigateur et le salon sont pilotés par les contrats réseau, l'écran est construit en phase 4.

## Tests requis

- TI de création d'une room privée et de jonction par code valide, et rejet d'un code invalide.
- TI de création d'une room publique, présence dans la liste, et jonction depuis la liste.
- TI de salon: présence des joueurs, état prêt, réglage par l'hôte, lancement par l'hôte seulement.
- TI de validation: une configuration aberrante (durée hors plage, capacité dépassée) est refusée.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Création publique et privée fonctionnelles, avec code d'invitation pour le privé.
2. Navigateur public correct (rooms ouvertes et non pleines).
3. Salon fonctionnel jusqu'au lancement par l'hôte.
4. Bornage des configurations en place.
5. Les TI passent.

## Fin de phase 2

Cette étape clôt la phase 2. Le serveur fait tourner plusieurs parties en parallèle, publiques et privées, jouables de bout en bout côté réseau, sans encore de persistance ni d'interface.

## Ajustements venus du cadrage, étape 0.3 (10 septembre 2026)

`docs/design/cadrage.md` précise ou corrige cette fiche sur six points. Le cadrage fait foi; la réconciliation complète reste à faire au début de l'étape, contre l'état réel du dépôt.

1. **Aucune latence par salon.** Le navigateur n'affiche pas de ping: toutes les parties tournent sur le même serveur. Section 2 du cadrage, tension 6.
2. **Aucun état « prêt ».** L'hôte lance, le compte à rebours annulable sert de préavis. Le périmètre 4 de cette fiche est réduit d'autant.
3. **Capacité du Classique: 12, et 1 joueur suffit pour lancer.** La capacité est une propriété du mode, pas un champ.
4. **Mode et visibilité sont figés à la création**; le code d'invitation est fabriqué par le serveur. Les réglages de `ReglagesPartie` restent modifiables par l'hôte jusqu'au lancement.
5. **Le contrat de configuration étend `ReglagesPartie`**, qui existe et est déjà validé par `validerReglages`: il ne se réécrit pas.
6. **Brancher le mode sur le moteur**: `tick` appelle aujourd'hui la règle Classique par défaut. Section 6 du cadrage.

Et un point du dépôt à ne pas oublier: les scénarios de bout en bout `parcours-solo.spec.ts` et `multijoueur.spec.ts` s'appuient sur la règle provisoire du premier salon en attente, que cette étape remplace. Ils sont à adapter (handoff 4.4).

## Réconciliation au début de l'étape (10 septembre 2026)

Écarts entre cette fiche et le dépôt réel, constatés avant d'écrire le code. Le dépôt et le cadrage font foi.

1. **Pas de handoff de l'étape 2.3.** Le delta binaire est rattaché au jalon 4 et conditionné à la mesure de l'étape 5.1 (section 3 du ROADMAP). Le dernier handoff lu est celui de l'étape 0.3.
2. **Le salon existe déjà**, construit aux étapes 2.1 et 2.2 puis affiché à l'étape 4.3: joueurs, hôte, réglages par l'hôte, lancement par l'hôte seulement, compte à rebours annulable, transfert de propriété. Le périmètre 4 se réduit donc à ce qui manque: le mode, la visibilité, le code et la capacité dans ce que reçoit le salon. Ses tests d'intégration existent (`ServeurSocket.test.ts`) et restent verts.
3. **Pas d'état « prêt » ni de latence** (ajustements 1 et 2 du cadrage).
4. **Pas de niveau au salon.** Il n'existe aucune source, même temporaire, avant la phase 3: le pseudo vient de la demande d'entrée, comme depuis l'étape 2.2, et le niveau arrivera avec les comptes (étape 3.2) puis sa déduction de l'XP (étape 3.3). Ajouter un niveau factice aurait mis à l'écran une donnée fausse.
5. **Le bornage de la configuration existe** (`validerReglages`, `BORNES_REGLAGES`, étape 1.6). La capacité n'étant pas un champ, « capacité dépassée » se vérifie à l'entrée: la treizième personne est refusée.
6. **La « file » des parties publiques devient la partie rapide** du cadrage: rejoindre sans identifiant ni code mène à la première partie publique en attente et non pleine, ou en crée une. C'est exactement la règle provisoire du premier salon en attente, restreinte aux parties publiques: les scénarios de bout en bout n'ont donc **rien à adapter**, contrairement à ce que prévoyait le handoff 0.3. Seuls deux commentaires de leur harnais ont changé.
7. **Aucun écran** (hors périmètre de la fiche): le client sait créer, lister et rejoindre par code depuis cette étape, et l'écran « Jouer » de l'étape 4.3 appelle la partie rapide. Le navigateur et la création arrivent avec la reprise des écrans du jalon 3.

## Rituel de fin de session

Écrire docs/handoffs/etape-2-4-handoff.md. Décrire le flux de création, de jonction et de salon, et la source temporaire du pseudo et du niveau en attendant la phase 3. Prochaine action exacte pour l'étape 3.1: mettre en place PostgreSQL et le schéma comptes, progression et résultats de partie, à partir du cadrage. Commiter.
