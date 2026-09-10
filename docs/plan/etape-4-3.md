# Fiche étape 4.3 - Menus et interface

Brief de session. Objectif unique: construire les écrans de menu en version réduite v1, fidèles à la maquette mais sans les fonctionnalités reportées. C'est ce qui relie le joueur au flux création, salon et fin de partie.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 4.2, le cadrage docs/design/cadrage.md (inventaire des écrans et version réduite v1), et les maquettes dans docs/design/, puis cette fiche.

## Objectif

Construire les écrans hors jeu sur le modèle de la maquette: accueil, navigateur de parties publiques, création de partie, salon, fin de partie, profil. Chaque écran est en version réduite v1, n'affichant que les données v1, sans pass de saison, ni skins, ni clans.

## Périmètre

1. Accueil: résumé du compte (pseudo, niveau, rang, pièces, gemmes), statistiques en ligne, et accès aux actions (partie rapide, créer, parcourir). Sans le bloc pass de saison en v1.
2. Navigateur de parties publiques: la liste des salons ouverts avec les colonnes de la maquette (hôte, mode, carte, joueurs, latence), et la jonction par sélection ou par code. Branché sur les contrats de l'étape 2.4.
3. Création de partie: le formulaire de configuration sur le modèle de la maquette (mode, carte, visibilité, réglages avancés). La validation côté client reflète le bornage côté serveur de l'étape 2.4. Seul le mode classique est sélectionnable en v1, les autres modes apparaissent comme à venir.
4. Salon: joueurs présents (pseudo, niveau, état prêt, hôte, places libres), récapitulatif de la configuration, code d'invitation si privé, chat du salon, et lancement par l'hôte.
5. Fin de partie: placement et podium, progression (passage de niveau, pièces, points de ligue), défi accompli le cas échéant, et les actions rejouer et accueil. Branché sur le récapitulatif de fin de l'étape 3.3.
6. Profil: version réduite v1 (pseudo, niveau, victoires, rang mondial, statistiques). Sans pass de saison, sans collection de skins, sans clan.
7. Système visuel: reprendre l'identité néon de la maquette (palette, navigation latérale, mise en page) de façon cohérente entre les écrans.

## Hors périmètre

- Aucun écran ni widget des fonctionnalités reportées (pass de saison, boutique de skins, clans, échelle de ligue détaillée).
- Aucune logique de jeu ni de rendu in-game. C'est l'étape 4.2.
- Pas de revalidation métier côté client à la place du serveur. Le client reflète les règles, le serveur reste l'autorité.

## Tests requis

- Tests de navigation entre écrans.
- Test du formulaire de création: une configuration invalide est signalée côté client, cohérente avec le refus serveur.
- Test du salon: affichage des joueurs et de l'état prêt, action de lancement réservée à l'hôte.
- Test de l'écran de fin: les données de progression affichées correspondent au récapitulatif reçu.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les six écrans hors jeu existent en version réduite v1.
2. Ils sont branchés sur les contrats et les données réelles.
3. Aucune fonctionnalité reportée n'est présente.
4. L'identité visuelle est cohérente.
5. Les tests passent.

## Réconciliation, faite le 10 septembre 2026

Cette fiche décrit les écrans de la maquette complète, qui supposent le matchmaking (2.4), les comptes (3.2) et la progression (3.3). La section 3 du ROADMAP place l'étape dans le jalon 1, avant ces trois étapes, et en restreint le périmètre: **seuls les écrans du legacy sont construits**. Le ROADMAP fait foi. Les écarts, point par point.

1. **Quatre écrans, pas six.** Accueil et pseudo, salon, jeu, fin de partie: ce sont les écrans du legacy (`mainMenu`, `waitingRoom`, `gameScreen` et sa fenêtre de fin). Le navigateur de parties publiques et la création de partie arrivent avec l'étape 2.4, le profil et la fin enrichie avec l'étape 3.3, comme le prévoit le jalon 3 (« reprise des écrans de 4.3 »).
2. **La création de partie devient le panneau de réglages du salon.** C'est ainsi que le legacy fonctionne: on entre dans un salon, puis l'hôte règle la carte, le mode miroir, la durée, les bots, les bonus, les malus et les zones. Le test « une configuration invalide est signalée côté client, cohérente avec le refus serveur » porte donc sur ce panneau. La cohérence est garantie par construction: le client appelle `validerReglages`, la fonction même que le serveur applique.
3. **Pas d'état « prêt ».** Il n'existe ni dans le legacy ni dans le contrat d'événements. Le test du salon porte sur l'affichage des joueurs, le badge d'hôte, et le lancement réservé à l'hôte.
4. **Ni places libres, ni capacité, ni code d'invitation, ni visibilité.** Tous dépendent de l'étape 2.4. Le salon affiche le nombre de joueurs présents.
5. **Fin de partie sans progression.** Pas de niveau, de pièces, de points de ligue ni de défi: ils appartiennent à l'étape 3.3. L'écran montre le podium et le classement complet reçus dans `partieTerminee`.
6. **« Rejouer » ouvre un nouveau salon.** Le retour au salon d'une partie terminée n'existe pas (handoff 2.1): une partie finie refuse les nouveaux venus. Rejouer quitte la partie finie et redemande à entrer avec le même pseudo, ce qui place le joueur dans le premier salon en attente, ou en ouvre un.
7. **Pas de navigation latérale.** Ses quatre entrées (Jouer, Parties, Créer, Profil) mènent à trois écrans qui n'existent pas encore. La décision du 29 juin 2026 est de masquer entièrement ce qui est reporté plutôt que de le griser. L'en-tête de marque et l'identité visuelle de la maquette sont repris.
8. **La page, l'empaqueteur et le service des fichiers sont à construire ici.** Le handoff 4.2 le prévoyait: rien ne servait le client à un navigateur.
9. **Deux fonctions du jeu en partie manquaient à l'étape 4.2**, et l'écran de jeu en a besoin pour être à parité avec le legacy: la localisation de son ninja (touche F, bouton sur mobile, et automatiquement au départ et après une capture), et les annonces en jeu (« Capturé par X ! », le nom du bonus ramassé, le malus subi). Traitées ici selon la règle 7 de CLAUDE.md.
10. **Le bouton « Terminer » du HUD de la maquette** (tension 7 du journal de conception) est tranché: voir le journal du 10 septembre 2026.

Les tests requis sont ajustés en conséquence: navigation entre les quatre écrans, panneau de réglages et cohérence avec le refus du serveur, salon (joueurs, hôte, lancement réservé), fin de partie (classement affiché égal au classement reçu).

## Rituel de fin de session

Écrire docs/handoffs/etape-4-3-handoff.md. Lister les écrans construits et les écarts éventuels avec la maquette. Prochaine action exacte pour l'étape 4.4: couvrir les parcours critiques en bout en bout Playwright, multi-clients et en fenêtre mobile. Commiter.
