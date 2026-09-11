# Fiche étape 4.3, reprise du jalon 3 - Écrans des parties et des comptes

Brief de session. Objectif unique: donner au joueur, dans la page, tout ce que les étapes 2.4, 3.2 et 3.3 ont construit côté serveur: parcourir et créer des parties, se connecter à un compte, voir sa progression à la fin d'une partie et dans son profil. C'est l'étape qui ferme le jalon 3.

## Origine de cette fiche

Aucune fiche n'existait pour cette étape: la section 3 du ROADMAP la nomme seulement, « reprise des écrans de 4.3 (navigateur, création, profil, fin de partie enrichie) ». Elle est rédigée le 11 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de:

- l'entrée du jalon 3 dans la section 3 du ROADMAP;
- la fiche 4.3, dont le périmètre d'origine décrivait les six écrans hors jeu, et sa réconciliation du 10 septembre 2026, qui en reportait quatre points à ce jalon;
- la section 3 du cadrage (`docs/design/cadrage.md`): en-tête commun, écrans 1, 2, 3, 4, 6 et 7;
- les handoffs 2.4, 3.2 et 3.3, et l'état réel du dépôt au commit 05dc372;
- les maquettes `docs/design/screenshots/01`, `02`, `03`, `06` et `07`, à challenger, pas à recopier.

Le nom du fichier suit la proposition du handoff 3.3. La numérotation thématique ne change pas: cette étape reste une reprise de 4.3.

## Rituel de début de session

Lire CLAUDE.md, le handoff 3.3, cette fiche, la section 3 du cadrage, puis les handoffs 2.4 (flux de création et de jonction) et 3.2 (mécanisme de session). Les maquettes se regardent dans `docs/design/screenshots/`.

## Objectif

À la fin de l'étape, un joueur peut, depuis la page:

1. jouer en invité comme aujourd'hui, ou se connecter à un compte, s'inscrire, et se déconnecter;
2. voir en permanence, s'il est connecté, son niveau, son palier et ses pièces;
3. lancer une partie rapide, parcourir les parties publiques et en rejoindre une, rejoindre une partie privée par son code, ou créer une partie publique ou privée;
4. dans le salon d'une partie privée, lire et copier le code d'invitation, et voir les places libres;
5. à la fin d'une partie, voir ce qu'elle lui a rapporté: XP, niveau, pièces, points de ligue et palier;
6. consulter son profil: identité, progression, statistiques et dernières parties.

## État de départ, constaté dans le dépôt

Ce qui existe et se réutilise:

- **Serveur complet pour les parties**: `creerPartie`, `listerParties`, `rejoindre` par identifiant, par code ou sans rien (étape 2.4). Le salon porte mode, visibilité, capacité et code.
- **Serveur complet pour les comptes**: quatre routes HTTP (`ROUTES_COMPTES`), connexion Socket.IO authentifiée par `auth.jeton`, refus de connexion pour un jeton qui n'ouvre rien (étape 3.2).
- **Récapitulatif de fin**: `progressionDeFin`, après `partieTerminee`, pour chaque compte présent (étape 3.3). Règles de déduction partagées: `niveauDeXp`, `avancementDuNiveau`, `palierDePoints`.
- **Client**: les commandes `creerPartie`, `listerParties` et `rejoindre(pseudo, acces)` sont câblées et l'état garde `partiesPubliques`; un refus d'entrée retient à quelle demande il répond. Quatre écrans (accueil, salon, jeu, fin), le panneau de réglages décrit par `GROUPES_REGLAGES` et validé par `validerReglages`.

Ce qui manque:

- **Côté client, rien des comptes**: aucune requête HTTP, aucun jeton gardé, aucun `auth` à l'ouverture de Socket.IO.
- **Le transport s'ouvre dès sa création** (`creerReseauSocketIo`), sans pouvoir choisir avec quel jeton, ni rouvrir après une connexion.
- **Un refus de connexion réseau n'est pas écouté**: l'accueil afficherait « Connexion au serveur… » indéfiniment.
- **`progressionDeFin` n'est pas écouté par le client.**
- **Le profil n'a pas de route**: `lireHistorique` existe en base, rien ne calcule les statistiques ni ne les rend.
- **Aucun écran** de navigateur de parties, de création, de profil ou de connexion; le salon n'affiche ni code, ni visibilité, ni capacité.
- **Le bouton de l'accueil s'appelle « Jouer »**; le cadrage l'appelle « Partie rapide ». Deux fichiers du harnais de bout en bout le cherchent sous son nom actuel.

## Périmètre

Découpé en lots, dans l'ordre d'exécution. Chaque lot se termine vert et se commite; si l'étape déborde d'une session, le handoff partiel s'arrête à la fin d'un lot.

### Lot A. La session de compte côté client

1. **Les requêtes des comptes derrière une interface** (`ApiComptes`), comme le transport depuis l'étape 4.1: une implémentation par `fetch`, une implémentation d'essai pour les tests. Une réponse refusée rend les motifs du serveur; un serveur injoignable rend un motif lisible.
2. **Le jeton gardé par le navigateur**, lu de façon tolérante comme les préférences du son (un navigateur qui refuse le stockage ne doit pas empêcher de jouer).
3. **Le transport s'ouvre sur demande, avec ou sans jeton**, et se rouvre quand la session change. Une fermeture volontaire n'est pas une connexion perdue. Un refus de connexion arrive dans l'état avec son motif.
4. **Le démarrage**: sans jeton, on ouvre en invité. Avec un jeton, on lit la progression (`moi`): acceptée, on ouvre avec le jeton; refusée pour session absente, on oublie le jeton, on ouvre en invité **et on le dit à l'écran**; injoignable, on garde le jeton et on ouvre avec lui.
5. **Un refus de connexion réseau ne se rabat jamais en invité en silence** (décision du 11 septembre 2026). L'accueil montre le motif et propose « Réessayer » et « Continuer en invité ».
6. **L'écran de connexion**: se connecter ou créer un compte, pseudo et mot de passe. Validation à la saisie par `validerDemandeConnexion` et `validerDemandeInscription`, les fonctions mêmes du serveur; les refus du serveur (identifiants, pseudo pris, trop de tentatives, comptes indisponibles) s'affichent sur le formulaire. « Continuer en invité » ramène à l'accueil.
7. **L'en-tête commun**: pour un compte, pièces, niveau avec l'avancement dans le niveau, pseudo et palier, qui mènent au profil; pour un invité, « Se connecter ». Pas de gemmes.
8. **Un compte entre sous son propre pseudo**: l'accueil ne demande pas de pseudo à un compte, et les demandes d'entrée et de création partent sans pseudo.
9. **La déconnexion**, depuis le profil: la session est fermée côté serveur, le jeton oublié, le transport rouvert en invité.

### Lot B. La fin de partie enrichie

1. Écouter `progressionDeFin` et le garder dans l'état jusqu'à la partie suivante ou la sortie.
2. Pour un compte: « Enregistrement de la partie… » tant que le récapitulatif n'est pas arrivé; puis XP gagnée, barre du niveau d'après, passage de niveau le cas échéant, pièces, variation des points de ligue, palier avant et après s'il a changé; ou le motif si la partie n'a pas été enregistrée.
3. Pour un invité: le classement seul, comme le prévoit le cadrage.
4. L'en-tête suit la progression d'après, sans relire le serveur.
5. Les noms des paliers s'écrivent côté client (Bronze, Argent, Or, Platine, Diamant), dans une table indexée par `IdentifiantPalier`.

### Lot C. Le profil

1. **Une route HTTP**, `GET /api/comptes/profil`, réservée à une session: la progression du compte (celle de `moi`), ses statistiques et ses dernières parties.
2. **Les statistiques se déduisent des résultats**, par une requête d'agrégat en base, sur tout l'historique et pas seulement sur les parties affichées: parties jouées, victoires, meilleur score.
3. **L'écran**: identité (initiales, pseudo, palier, date d'inscription), niveau et barre d'XP, pièces et points de ligue, statistiques, dernières parties (date, mode et carte, place sur le nombre de joueurs, points, XP, pièces, ligue), et « Se déconnecter ».
4. Un invité qui demande le profil est mené à l'écran de connexion.

### Lot D. Les parties

1. **L'accueil**: « Partie rapide », « Créer une partie » et « Parcourir »; le champ du pseudo pour un invité; la tuile « à venir » des modes n'est pas reprise à l'accueil (elle vit à la création, décision du 29 juin 2026). Les règles du jeu restent.
2. **Le pseudo d'un invité est saisi une fois**, et repris par l'accueil, le navigateur et la création.
3. **Le navigateur des parties publiques**: la liste (hôte, mode, carte avec le miroir, joueurs sur capacité, « Rejoindre »), « Actualiser », un état vide qui propose de créer, le champ de code privé avec sa validation (`validerCodeInvitation`) et « Rejoindre », le bouton « Créer ». Les refus d'entrée s'affichent sur l'écran. Ni latence, ni filtres de mode, ni compteur de joueurs en ligne (cadrage).
4. **La création**: mode (tuile Classique, tuile « à venir » non sélectionnable), visibilité publique ou privée, réglages de départ, récapitulatif avec la capacité déduite du mode, « Créer le salon ». Les réglages réutilisent la description et le formulaire du panneau du salon, sans les dupliquer. La validation est `validerDemandeCreation`, la fonction du serveur.
5. **Le salon étendu**: visibilité; pour une partie privée, le code avec un bouton de copie; joueurs présents sur capacité et places libres.
6. **La navigation latérale**: ses quatre destinations existent désormais (Jouer, Parties, Créer, Profil). Elle n'est proposée que hors partie, pour qu'aucun clic ne fasse quitter un salon ou une partie sans le vouloir. En fenêtre étroite, elle se replie en barre (décision du 29 juin 2026).

### Lot E. Bout en bout

1. **Parties**: une partie privée créée depuis la page, rejointe par son code depuis une seconde page, avec le même salon des deux côtés; une partie publique trouvée dans la liste.
2. **Compte**: inscription depuis la page, en-tête, partie courte jusqu'à la fin enrichie, profil qui compte la partie, déconnexion. Les scénarios tournant sans base, le harnais fournit au serveur un service de comptes en mémoire: rien n'est ajouté au jeu pour les tests.
3. Les scénarios existants suivent le renommage de « Jouer » en « Partie rapide », sans rien perdre de ce qu'ils vérifient.

## Hors périmètre

- Pass de saison, skins, clans, gemmes, défis du jour, succès, rang mondial, échelle de ligue détaillée (cadrage, section 1).
- État « prêt », latence, filtres de mode, compteur de joueurs en ligne (cadrage, sections 2 et 3).
- Retour au salon après une partie, reconnexion à une partie en cours, changement de mot de passe, suppression de compte.
- Aucune logique de jeu ni de rendu in-game, aucune modification de `packages/sim`.
- Pas de revalidation métier côté client à la place du serveur: le client appelle les validateurs partagés, le serveur reste l'autorité.

## Décisions à prendre dans l'étape, et à consigner au journal

Proposées ici; chacune se tranche en exécutant, se justifie au journal de `docs/design/README.md`, et remonte au cadrage si elle touche un écran.

1. **Où garder le jeton.** Proposition: le stockage local du navigateur, qui survit à la fermeture de l'onglet comme la session de trente jours le suppose. Le risque connu, un script injecté qui le lirait, est celui que la faille S1 fermée et la politique de sécurité du contenu stricte empêchent déjà.
2. **Ce qui compte comme une victoire au profil.** Proposition: une première place dans une partie d'au moins deux joueurs, comme la règle de ligue; une partie jouée seul ne fait gagner personne.
3. **La navigation latérale hors partie seulement** (lot D, point 6).
4. **« Jouer » devient « Partie rapide »**, le nom du cadrage.
5. **Le pseudo d'un invité vit dans l'état du client**, pour être saisi une seule fois (lot D, point 2).
6. **Le transport s'ouvre sur demande** au lieu de s'ouvrir à sa création (lot A, point 3).

## Tests requis

- **Navigation entre les écrans**, sur l'application entière dans un document: accueil, parties, création, profil, connexion, salon, jeu, fin; la navigation latérale; aucun écran de menu atteignable depuis une partie.
- **Formulaire de création**: une configuration invalide est signalée côté client sur son champ et ne part pas; un test d'intégration contre un vrai serveur vérifie que le serveur la refuse avec les mêmes motifs.
- **Navigateur**: la liste affichée correspond à la liste reçue; rejoindre par la liste et par un code; code mal formé refusé avant envoi; refus du serveur affiché.
- **Salon**: joueurs, badge d'hôte, lancement réservé à l'hôte (existant, vert); code affiché pour une partie privée seulement; capacité et places libres.
- **Fin de partie**: les données de progression affichées correspondent au récapitulatif reçu, pour une partie enregistrée, non enregistrée, et pour un invité.
- **Session du client**: jeton gardé puis joint à l'ouverture; jeton refusé par `moi` oublié et annoncé; refus de connexion réseau affiché sans repli; connexion et inscription refusées puis acceptées; déconnexion.
- **Route du profil**: tests de traduction HTTP (sans base), et test d'intégration contre Neon (statistiques et dernières parties d'après des parties enregistrées, victoire en solo non comptée, refus sans session).
- **Bout en bout**: les scénarios du lot E, sans erreur de console.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les écrans d'accueil, de parties, de création, de salon, de fin, de profil et de connexion existent en version v1 et sont branchés sur les contrats et les données réelles.
2. Un compte se connecte, joue, voit sa progression à la fin et dans son profil, et se déconnecte, depuis la page.
3. Aucune fonctionnalité reportée n'est présente, même grisée.
4. L'identité visuelle est cohérente entre les écrans, en bureau et en fenêtre mobile.
5. Les tests passent, dont les scénarios de bout en bout existants.
6. Le cadrage, le journal de conception et CLAUDE.md décrivent ce qui a été construit.

## Réconciliation pendant l'étape (11 septembre 2026)

Écarts entre la fiche et ce qui a été construit, tous consignés au journal de `docs/design/README.md`.

1. **Les cinq lots ont été exécutés dans l'ordre, un commit chacun**: A (session de compte), B (fin enrichie), C (profil), D (parties, création, salon, navigation), E (bout en bout).
2. **Les six décisions de la fiche sont tranchées** comme proposé: jeton dans le stockage local, en mémoire si le navigateur refuse; victoire à la première place d'une partie d'au moins deux joueurs (`JOUEURS_POUR_UNE_VICTOIRE`); navigation latérale hors partie seulement; « Partie rapide »; pseudo d'invité dans l'état du client (`pseudoSaisi`); transport ouvert sur demande (`Reseau.ouvrir`).
3. **« Continuer en invité » n'est pas une déconnexion.** Le refus du lien peut venir d'une base momentanément injoignable: le jeton est oublié par le navigateur, mais la session n'est pas fermée côté serveur.
4. **La lecture du profil et de la liste des parties part de la navigation** (`client.naviguer`), pas du montage de l'écran: un changement d'état au milieu d'un montage arrivait à l'écran qu'on quitte.
5. **Un refus d'entrée s'efface en changeant d'écran**: il concernait l'écran quitté.
6. **Le formulaire de réglages est extrait du panneau du salon** pour servir aussi à la création, réglages avancés repliés sous un titre. Aucun réglage n'est décrit deux fois.
7. **L'en-tête suit la progression sans rien redemander**: celle d'après la partie (`progressionDeFin`) et celle que porte le profil.
8. **Défaut trouvé hors périmètre, corrigé (règle 7).** La politique de sécurité du contenu, posée à l'étape 4.3, bloquait la lecture d'une image `data:` par laquelle PixiJS vérifie qu'un travailleur sait décoder les images. PixiJS concluait à tort que non. `connect-src` accepte désormais `data:`. Les erreurs vivaient dans la console du travailleur, que Playwright ne relaie pas: le scénario de navigation ne pouvait pas les voir.
9. **Bout en bout**: le serveur de scénario accepte des comptes en mémoire (`tests/outils/comptes-en-memoire.ts`), importés par chemin de compilation comme le reste du harnais. Les scénarios des parties et du compte ne tournent qu'en bureau: le premier fabrique ses deux appareils, le second joue une partie entière que le cadrage mobile rejouerait sans rien vérifier de plus.
10. **Écarts avec la maquette**, voulus: ni latence, ni filtres de mode, ni compteur de joueurs en ligne; le salon dit les places libres en texte sans dessiner d'emplacements vides; la fin n'a pas de défi; le profil n'a ni ratio, ni série, ni temps de jeu, ni rang mondial. Tous écartés ou reportés par le cadrage.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-3-reprise-handoff.md`. Lister les écrans construits et leurs écarts avec la maquette, les décisions prises, et l'état de la CI. Prochaine action exacte: la section 3 du ROADMAP désigne le jalon 4, qui commence par l'étape 5.1, tests de charge serveur. Commiter.
