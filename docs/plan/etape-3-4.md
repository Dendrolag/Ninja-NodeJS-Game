# Fiche étape 3.4 - Gestion du mot de passe

Brief de session. Objectif unique: un joueur change son mot de passe depuis son profil, en fermant ses autres sessions, et retrouve l'accès à un compte dont il a oublié le mot de passe grâce à un code de secours.

Fiche rédigée le 15 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.4 du ROADMAP (section 4), du handoff 2.5, de la décision du porteur du projet prise au début de la session, et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.5, puis cette fiche. Au besoin: le handoff 3.2 (mécanisme de session, limites de tentatives), le journal de `docs/design/README.md` (entrées du 11 septembre 2026 sur la session par jeton et les tentatives limitées, du 14 septembre sur les migrations compatibles avec la version précédente).

## Pourquoi

Relevé à la recette de l'étape 5.4: un compte ne peut ni changer son mot de passe, ni le retrouver. Un joueur qui soupçonne qu'on connaît son mot de passe n'a aucun moyen de reprendre la main, et un joueur qui l'oublie perd son compte et sa progression. La réinitialisation habituelle passe par un courriel; les comptes n'en ont pas, et le compte est facultatif (décision du 11 septembre 2026).

## Décision du porteur du projet (15 septembre 2026)

Quatre voies présentées pour le mot de passe oublié: un code de secours, une réinitialisation manuelle par le porteur du projet, un courriel facultatif avec un service d'envoi, ou rien. **Retenue: le code de secours.** Il ne demande aucune donnée personnelle ni aucun service externe, et le joueur s'en sert seul. Conséquence assumée, à dire au joueur: un code perdu et un mot de passe oublié font perdre le compte.

## État du dépôt au départ (15 septembre 2026)

1. **Le mot de passe se choisit une fois, à l'inscription.** Son empreinte scrypt vit dans `mots_de_passe` (une ligne par compte, avec `modifie_le`), écrite par `creerCompte` dans la transaction du compte.
2. **Les sessions sont des jetons opaques** dont la base garde l'empreinte SHA-256, dans `sessions`, indexée par compte. Aucune fonction ne ferme les sessions d'un compte; seule la déconnexion ferme la sienne.
3. **Les tentatives sont limitées par pseudo et par adresse** (`LimiteurDeTentatives`, `LIMITES_COMPTES`), avant toute vérification du mot de passe.
4. **Une session fermée ne coupe pas une connexion de jeu déjà ouverte** (dette du handoff 3.2): le compte est identifié à l'ouverture du lien, une fois pour toutes. Le handoff la gardait « à reconsidérer si une suppression de compte ou une exclusion arrive ».
5. **Le client** parle aux comptes par `ApiComptes` (`comptes/api.ts`), garde le jeton dans un coffre, et traite toute réponse 401 comme une session expirée: le jeton est oublié, la page repasse en invité.
6. **Le profil** montre la progression, les statistiques et l'historique, et propose de se déconnecter. L'écran de connexion a deux onglets, se connecter et créer un compte.
7. **Trois migrations** (`0000` à `0002`), appliquées au démarrage du serveur en production.

## Décisions de conception

1. **Changer son mot de passe demande l'ancien**, même avec une session ouverte: un jeton volé ne suffit pas à s'approprier le compte. Le nouveau suit la règle de l'inscription (`validerMotDePasse`).
2. **Changer son mot de passe ferme toutes les autres sessions du compte**, et garde celle qui a fait la demande. Le changement et la fermeture se font dans une seule transaction.
3. **Un code de secours par compte**: seize caractères de l'alphabet de Crockford (ni I, ni L, ni O, ni U), soit 80 bits tirés du générateur cryptographique, affichés en quatre groupes (`K7QM-3X9D-TP4W-8HNE`). La saisie ignore la casse, les espaces et les tirets, et lit O comme 0, I et L comme 1. La base n'en garde que l'empreinte SHA-256, dans une table à part (`codes_de_secours`), comme les jetons: un code tiré au hasard sur 80 bits n'a pas besoin d'un hachage lent.
4. **Un code n'est montré qu'une fois**, au moment où il est émis, et jamais relu. Le joueur le note, puis le confirme; l'écran dit qu'il pourra en créer un autre depuis son profil.
5. **Chaque nouveau mot de passe s'accompagne d'un nouveau code**: à l'inscription, au changement et à la réinitialisation. L'ancien code ne vaut plus rien. Raison: celui qui a changé son mot de passe parce qu'on le connaissait doit pouvoir compter qu'aucun code émis entre-temps ne sert plus.
6. **Un nouveau code se demande aussi depuis le profil, avec le mot de passe actuel**: c'est le chemin des comptes créés avant cette étape, qui n'en ont pas, et de qui a perdu le sien. Il ne ferme aucune session.
7. **La réinitialisation**: pseudo, code de secours et nouveau mot de passe, sans session. Acceptée, elle remplace le mot de passe et le code, ferme **toutes** les sessions du compte, puis en ouvre une neuve: le joueur est connecté, et reçoit son nouveau code. Un pseudo inconnu, un compte sans code et un code faux reçoivent la même réponse, « Pseudo ou code de secours incorrect. ». Le code est à usage unique, garanti par la base: il n'est remplacé que s'il est encore celui qui a été vérifié, si bien que deux réinitialisations simultanées avec le même code n'aboutissent pas toutes les deux.
8. **Toute vérification d'un secret passe par les limites de la connexion**: le seau du compte (par pseudo) et celui de l'adresse, avant de vérifier quoi que ce soit. Changer son mot de passe, demander un code et réinitialiser consomment donc les mêmes tentatives que se connecter: aucun de ces chemins n'ouvre plus d'essais que la connexion.
9. **Un ancien mot de passe faux se refuse en 403, pas en 401.** Le client lit 401 comme une session expirée et oublie le jeton: un mot de passe mal tapé depuis le profil ne doit pas déconnecter le joueur.
10. **Fermer les sessions d'un compte coupe les connexions de jeu ouvertes avec elles.** Après un changement ou une réinitialisation, le service des comptes prévient la couche réseau, qui revérifie la session de chaque connexion de ce compte et coupe celles qui n'en ouvrent plus. C'est ce qui rend la fermeture réelle pour un intrus déjà en partie: coupé, il ne peut pas revenir (étape 2.5), faute de session. La déconnexion volontaire ne coupe rien, comme avant.

## Périmètre

1. **Contrats partagés**: les trois demandes (changement, code, réinitialisation) et leur validation; le code de secours (bornes, normalisation, mise en forme); la réponse qui porte un code émis; l'inscription qui en porte un; les trois routes.
2. **Base**: la table `codes_de_secours` par une migration écrite par drizzle-kit; le code écrit avec le compte; le remplacement du mot de passe, du code et des sessions en une transaction; le code remplacé seul; la lecture des identifiants d'un compte par son identifiant et de son code par pseudo.
3. **Serveur**: la génération et l'empreinte du code; le changement, le nouveau code et la réinitialisation dans `Authentification`; les routes et leurs codes HTTP; l'écoute des sessions fermées dans l'annuaire, et la coupure des connexions dans `ServeurSocket`; les comptes en mémoire des tests.
4. **Client**: les trois requêtes; les commandes de session; le code à montrer dans l'état, et sa confirmation; la réinitialisation sur l'écran de connexion; la section sécurité du profil; la fenêtre du code de secours.

## Hors périmètre

- Un courriel, ou tout autre moyen de joindre le joueur.
- Supprimer son compte, changer son pseudo.
- Lister ou fermer une à une ses sessions.
- Couper les connexions de jeu à la déconnexion volontaire ou à l'expiration d'une session.
- Rétablir de lui-même un lien coupé hors partie: c'est l'étape 2.6. D'ici là, une page coupée parce que sa session a été fermée affiche « La connexion au serveur a été perdue » hors partie, et le refus de la session en partie.

## Tests requis

- TU du paquet partagé: normalisation et validation du code, mise en forme, validation des trois demandes.
- TU du serveur: forme et hasard du code, empreinte; routes (codes HTTP, en-têtes, jeton exigé); coupure des connexions dont la session est fermée, sans toucher aux autres ni aux invités.
- TI contre Neon: changement accepté avec l'ancien mot de passe, refusé sans ou avec un faux, sans rien changer; autres sessions fermées, session courante gardée; nouveau mot de passe qui ouvre, ancien qui n'ouvre plus; tentatives limitées; code émis à l'inscription qui réinitialise; code faux et pseudo inconnu à la même réponse; code à usage unique; réinitialisation qui ferme toutes les sessions; nouveau code qui annule l'ancien; connexion de jeu d'une session fermée coupée; migrations (sept tables).
- TU du client: requêtes, commandes, réduction, modèles et écrans (réinitialisation, sécurité du profil, fenêtre du code).
- Bout en bout: inscription et code montré; changement depuis le profil, qui ferme la session d'une autre page; ancien mot de passe refusé; réinitialisation par le code, qui connecte.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le changement depuis le profil est vérifié de bout en bout.
2. Le changement refusé sans l'ancien mot de passe et la fermeture des autres sessions sont vérifiés en intégration contre Neon.
3. Un mot de passe oublié se réinitialise avec le code de secours, vérifié de bout en bout et en intégration.
4. La migration est compatible avec la version précédente du serveur (une table ajoutée, rien de retiré).
5. `packages/sim` non touché: couverture et empreinte des parties inchangées.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-4-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le cadrage (tables des comptes) et la grille de recette 5.4. Prochaine action exacte pour l'étape 2.6, le lien perdu hors partie, dont la fiche se rédige au début de la session. Commiter.
