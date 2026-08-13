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

## Rituel de fin de session

Écrire docs/handoffs/etape-4-3-handoff.md. Lister les écrans construits et les écarts éventuels avec la maquette. Prochaine action exacte pour l'étape 4.4: couvrir les parcours critiques en bout en bout Playwright, multi-clients et en fenêtre mobile. Commiter.
