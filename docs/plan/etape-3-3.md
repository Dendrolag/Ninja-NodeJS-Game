# Fiche étape 3.3 - Progression branchée sur la fin de partie

Brief de session. Objectif unique: à la fin d'une partie, calculer les récompenses, faire évoluer la progression du compte, et enregistrer le résultat. C'est ce qui alimente l'écran de fin de partie de la maquette.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.2 (comptes authentifiés), le handoff de l'étape 1.5 (le moteur expose les conditions de fin et les scores), le cadrage docs/design/cadrage.md (écran de fin de partie et données de progression), puis cette fiche.

## Objectif

Quand une GameRoom se termine, lire le résultat produit par le moteur (placement, score), en déduire les récompenses, appliquer l'évolution de la progression du compte, et persister le résultat de partie. À la fin, l'écran de fin de partie a toutes ses données.

## Périmètre

1. Détection de fin: la GameRoom détecte la fin via les conditions de fin pures du moteur (définies en phase 1) et déclenche le traitement de fin. Le déclenchement et la persistance sont côté serveur, le calcul des conditions reste pur dans le moteur.
2. Calcul des récompenses: à partir du placement et du score, déterminer l'XP gagnée, les pièces gagnées, et la variation de points de ligue. Définir des règles simples et claires, documentées.
3. Évolution de la progression: appliquer l'XP au niveau (gestion du passage de niveau), créditer les pièces, mettre à jour les points de ligue et, le cas échéant, le palier de rang. Persister la progression mise à jour.
4. Enregistrement du résultat: écrire le résultat de partie (mode, carte, placement, score, gains, horodatage) rattaché au compte.
5. Défis du jour: seulement si retenus en v1, vérifier l'accomplissement et créditer la récompense.
6. Exposer le récapitulatif de fin: fournir au client les données de l'écran de fin (placement, gains, passage de niveau, variation de rang, défi accompli le cas échéant).

## Hors périmètre

- Aucune logique de pass de saison, de skins ou de clans.
- Aucune échelle de ligue détaillée au-delà de la mise à jour du palier de rang stocké.
- Aucune interface. L'écran de fin est construit en phase 4, ici on fournit les données.

## Tests requis

- TI vérifiant qu'après une partie, la progression du compte reflète les récompenses (XP, niveau, pièces, points de ligue, rang).
- TI sur le passage de niveau: une XP suffisante fait monter le niveau correctement.
- TI sur l'enregistrement: le résultat de partie est persisté et rattaché au bon compte.
- TI sur le récapitulatif: les données fournies au client correspondent à l'évolution réellement appliquée.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La fin de partie applique des récompenses selon des règles documentées.
2. La progression évolue et est persistée, passage de niveau et rang compris.
3. Le résultat de partie est enregistré.
4. Le récapitulatif de fin est exposé au client.
5. Les TI passent.

## Fin de phase 3

Cette étape clôt la phase 3. Les comptes sont persistants et progressent après chaque partie. Avec les phases 1 à 3, le jeu est complet côté serveur et données, prêt pour la construction du client.

## Ajustements venus du cadrage, étape 0.3 (10 septembre 2026)

`docs/design/cadrage.md` précise cette fiche sur trois points. Le cadrage fait foi.

1. **Les défis du jour sont reportés.** Le périmètre 5 de cette fiche est sans objet.
2. **Le niveau et le palier se déduisent** de l'XP totale et des points de ligue, par des fonctions pures à écrire dans `packages/shared`, pour que serveur et client calculent la même chose. Seuls l'XP, les pièces et les points de ligue sont persistés.
3. **Les valeurs des récompenses** (XP, seuils de niveau, pièces, points de ligue, seuils de palier) sont à proposer ici et à faire valider par le porteur du projet: le cadrage n'en fixe que la forme.

## Ajustements venus de la décision du 11 septembre 2026 et de l'étape 3.1

1. **On joue sans compte; le compte n'apporte que la progression** (décision du porteur du projet, journal de `docs/design/README.md`). À la fin d'une partie, seuls les joueurs qui ont un compte reçoivent des récompenses et un résultat enregistré. Un invité ne gagne ni ne perd rien, points de ligue compris, mais il compte dans le nombre de joueurs de la partie et dans le placement des autres. Le récapitulatif de fin d'un invité montre le classement, sans gains ni progression.
2. **Le schéma existe** (handoff 3.1): une partie s'écrit dans `parties`, et le résultat de chaque compte dans `resultats`, par `enregistrerPartie`, en une seule transaction. Le « score » de cette fiche s'appelle `points`, comme dans `LigneClassement`.
3. **Appliquer les gains sans perdre d'écriture.** `ecrireProgression` remplace les valeurs. Ajouter les gains (XP, pièces, variation de points de ligue) dans la même transaction que l'enregistrement de la partie, plutôt que lire la progression puis la réécrire: deux écritures rapprochées ne peuvent alors pas s'effacer.
4. **Le palier de rang n'est pas stocké** (ajustement 2 ci-dessus): le périmètre 3 met à jour les points de ligue, et le palier s'en déduit.

## Réconciliation pendant l'étape (11 septembre 2026)

Écarts entre la fiche et ce qui a été construit, tous consignés au journal de `docs/design/README.md`.

1. **Les valeurs des récompenses ont été proposées puis validées** par le porteur du projet avant d'être codées (ajustement 3 du cadrage): XP au temps joué et aux joueurs devancés, pièces au dixième de l'XP, niveau n + 1 à 100 × n XP, points de ligue de +20 à -10 selon la place (deux joueurs et trois minutes au moins), paliers Bronze 0, Argent 100, Or 300, Platine 600, Diamant 1 000. Elles remplacent le niveau provisoire de l'étape 3.2.
2. **Une règle absente de la fiche a été ajoutée, et validée: l'abandon.** Un compte qui quitte une partie en cours est compté dernier. Sans elle, le périmètre 3 laissait quitter la partie avant la fin pour éviter toute perte de points de ligue. La room retient désormais les départs pendant la partie et le temps d'entrée de chacun (`GameRoom.bilan`).
3. **Périmètre 1: la détection de fin existait déjà** (étape 2.1, `surFinDePartie`). L'étape y branche le traitement de fin, dans `ServeurSocket`.
4. **Périmètre 6: le récapitulatif est un message à part, `progressionDeFin`**, adressé à chaque compte présent, qui suit `partieTerminee` sans le retarder. Le récapitulatif d'un invité reste le classement de `partieTerminee` (ajustement 1 du 11 septembre). Un échec d'enregistrement est annoncé au compte.
5. **`enregistrerPartie` change de contrat**: elle ajoute les gains dans sa transaction et rend l'évolution appliquée (`PartieEnregistree`), l'heure de fin devient facultative (celle de la base), et un compte inconnu lève une erreur explicite avant toute écriture. Les tests de l'étape 3.1 ont suivi.
6. **Une partie jouée uniquement par des invités n'est pas enregistrée**: sans résultat, elle n'apporterait rien à aucun profil.
7. **Prochaine étape**: la ligne « prochaine action exacte » ci-dessous suit la numérotation thématique et désigne 4.1, déjà faite. La section 3 du ROADMAP fait foi: le jalon 3 se termine par la reprise des écrans de 4.3.

## Rituel de fin de session

Écrire docs/handoffs/etape-3-3-handoff.md. Documenter les règles de récompense et la forme du récapitulatif de fin, car l'écran de fin de la phase 4 s'en sert. Prochaine action exacte pour l'étape 4.1: squelette client avec séparation état et rendu, et décodage du flux delta binaire. Commiter.
