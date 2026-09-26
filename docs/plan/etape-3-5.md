# Fiche étape 3.5 - La fiche joueur

Brief de session. Objectif unique: tout compte connecté peut lire la fiche d'un autre compte, par son pseudo, depuis le salon et le classement de fin; le profil passe à la même agrégation des statistiques.

Fiche rédigée le 26 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.5 du ROADMAP (section 4), de l'étude `docs/design/etude-amis-et-fiche-joueur.md` (sections 3.3, 4.3, 4.5, 4.6 et 7), du handoff 2.7 et de l'état réel du dépôt.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 2.7, l'étude des amis, puis cette fiche. Au besoin: la fiche de la reprise des écrans du jalon 3 (le profil) et la fiche 7.4 (le record en Massacre joué seul).

## Pourquoi

Le profil ne se montre qu'à son propriétaire. Pour suivre les statistiques d'un joueur rencontré, et demain d'un ami, il faut une fiche lisible des autres. L'étude a aussi montré que les statistiques actuelles se lisent mal: un meilleur score toutes modes confondus compare des choses différentes, et le record en Massacre solo y fait exception. La fiche et le profil passent donc à une même agrégation par mode. C'est la deuxième des quatre étapes des amis; l'étape `3.6` y ajoutera les parties jouées ensemble et le face-à-face.

## État du dépôt au départ (26 septembre 2026)

1. **Le profil** (`GET /api/comptes/profil`, `ProfilDuCompte`) rend la progression, `StatistiquesDuCompte` (parties jouées, victoires, meilleur score global, record en Massacre solo, par `statistiquesDuCompte` dans `base/parties.ts`), les dix dernières parties et la présence d'un code de secours. Personne ne lit le profil d'un autre.
2. **Le salon distingue les comptes des invités** (`JoueurDuSalon.compte`, avec le niveau), sans identifiant de compte. Le pseudo d'un compte est unique (`comptes.repere_pseudo`) et un invité ne peut pas prendre celui d'un compte (`pseudoDeCompte`).
3. **Le classement de fin** (`LigneClassement`) ne dit pas qui a un compte. Le salon, lui, reste dans l'état du client jusqu'à la sortie de la partie.
4. **Un pseudo admet l'espace et le point**, et « . » ou « .. » sont des pseudos valides (`BORNES_PSEUDO`).
5. **Les requêtes des comptes** passent par `ApiComptes` (`comptes/api.ts`), et les routes par un seul routeur, monté sous `/api/comptes`, qui porte le contrôle d'accès du navigateur, l'absence de cache et la réponse 503 d'un serveur sans base.
6. **L'interface a un modèle de fenêtre unique** (`composants/fenetre.ts`), déjà monté au niveau de l'application pour l'aide, le son et le code de secours.
7. **Le profil écrit « Inscrit le … »**, qui genre le joueur. L'étape 2.7 avait écarté pour la même raison « Vous êtes invité ».

## Décisions de conception

Aucune n'a été soumise au porteur du projet: l'étude, qu'il a validée le 25 septembre 2026, fixe le contenu, et ce qui suit en découle. Chacune est signalée au handoff.

1. **La route est `GET /api/comptes/joueur?pseudo=…`, et non `/api/joueurs/:pseudo`.** Un pseudo peut valoir « .. »: dans un chemin, le navigateur le lit comme un retour au dossier parent, même encodé (`%2E%2E`), et la demande partirait ailleurs. Un paramètre de requête n'a pas ce défaut. Et la route rejoint le routeur des comptes, dont elle hérite le contrôle d'accès, l'absence de cache et le 503 sans base.
2. **Réservée aux comptes connectés** (décision 2 de l'étude): sans session valable, 401. Un pseudo mal formé est refusé en 400 par `validerPseudo`, avant toute requête. Un pseudo sans compte rend 404, « Aucun compte ne porte ce pseudo. »: l'inscription le dit déjà (étude, 4.6).
3. **Une limite de lecture par compte**, 30 d'un coup puis une par seconde (`LIMITES_COMPTES.ficheParCompte`). Chaque lecture est une agrégation sur tout l'historique: un compte ne doit pas pouvoir la faire tourner en boucle. Le profil n'en a pas: il ne lit que soi.
4. **Le contenu de la fiche** (`FicheJoueur`): le pseudo, la date d'inscription (le jour), le niveau, l'identifiant du palier, et les statistiques. Ni l'XP ni les points de ligue exacts: le niveau et le palier en disent assez, et le profil les garde pour soi. Jamais les pièces, l'identifiant du compte, le code de secours ni les dernières parties.
5. **Une seule agrégation, par mode** (`StatistiquesDeJoueur`): pour chaque mode joué, dans l'ordre de `MODES`, les parties jouées, les parties à plusieurs, les victoires, le meilleur score et le meilleur score joué seul; et, pour l'ensemble, les parties jouées, les parties à plusieurs, les victoires et le mode préféré. Une requête `group by` sur `resultats` joint à `parties`; la déduction (totaux, ordre, mode préféré) est une fonction pure du serveur, testée sans base, que les comptes en mémoire des tests réutilisent.
6. **Les victoires se lisent sur les parties à plusieurs**: « 12 victoires sur 40 parties à plusieurs ». Une partie jouée seul n'est pas une victoire (`JOUEURS_POUR_UNE_VICTOIRE`), elle ne compte donc pas dans le dénominateur.
7. **Le mode préféré** est le plus joué, départagé par la partie la plus récente (étude, 3.3). La date sert au calcul et ne sort pas du serveur: elle dirait quand le joueur a joué (décision 7 de l'étude).
8. **Le record seul devient une colonne du tableau** (étude, 3.3: « un cas du même tableau au lieu d'une exception »): chaque mode joué seul au moins une fois a son meilleur score seul. Le record en Massacre solo de l'étape 7.4 en est la ligne Massacre, et `recordMassacreSolo` disparaît.
9. **Le profil passe à la même agrégation.** Il perd son meilleur score global et sa tuile de record en Massacre, gagne le mode préféré et le tableau par mode, garde les pièces, les points de ligue et les dernières parties.
10. **La fiche est une fenêtre par-dessus l'écran**, pas un écran: le salon et la fin sont des écrans de partie qu'on ne quitte pas pour lire une fiche. Elle est montée par l'application, comme la fenêtre du code de secours, et vit dans l'état du client (`fiche`), lue à chaque ouverture. Elle se ferme d'elle-même quand l'écran change (la partie se lance) ou que la session redevient celle d'un invité.
11. **On l'ouvre d'un clic sur le pseudo**, au salon et dans le tableau du classement de fin, pour une ligne qui a un compte, quand on a soi-même un compte. Sa propre ligne aussi: on y voit ce que les autres voient. Un invité ne voit aucun bouton. À la fin, une ligne a un compte si son joueur est encore au salon avec un compte: un joueur parti avant la fin n'a pas de bouton.
12. **Sa forme laisse la place aux succès** (décision 8 de l'étude): la réponse est un objet à champs nommés, où un champ `succes` s'ajoutera, et la fenêtre une suite de sections, où une section « Succès » s'insérera. Rien ne se construit d'avance.
13. **Règle 7: « Inscrit le » devient « Membre depuis le »**, au profil comme sur la fiche.

## Périmètre

1. **Paquet partagé**: la route, le paramètre, les types `FicheJoueur`, `StatistiquesDeJoueur` et `StatistiquesDUnMode`; `ProfilDuCompte.statistiques` change de type; la limite de lecture.
2. **Base**: l'agrégation par mode (`statistiquesParMode`), qui remplace `statistiquesDuCompte`; la lecture d'un compte et de sa progression par pseudo.
3. **Serveur**: la déduction pure, `Authentification.ficheJoueur`, le motif de refus `joueurInconnu` (404), la route.
4. **Client**: la requête, l'état de la fiche, ses actions et ses commandes, les modèles de la fiche et des statistiques, la fenêtre, les boutons du salon et de la fin, le profil aligné, les styles.
5. **Outils de test**: les comptes en mémoire lisent la fiche et le profil avec la même déduction.
6. **Aucun changement** de `packages/sim`, du transport, du schéma de la base (aucune migration) ni des règles de jeu.

## Hors périmètre

- La présence, les parties jouées ensemble et le face-à-face: étape `3.6` et `2.8`.
- Une recherche de joueur par pseudo dans une page à part: l'écran Amis de l'étape `3.6` l'apportera.
- Le lien d'ami `?ami=Pseudo` (étude, 3.2).
- Les succès: étapes `3.7` et `3.8`.

## Tests requis

- TU de la déduction: totaux, ordre des modes, mode préféré départagé par la date, meilleur score seul absent sans partie seul, compte qui n'a jamais joué.
- TU des routes: 200, 400, 401, 404, 429 et 503 de la route de la fiche, pseudo avec espace et point.
- TI (base): agrégats par mode et mode préféré sur un jeu de parties connu, victoires sur parties à plusieurs, meilleur score seul; fiche refusée sans session et pour un pseudo inconnu; pseudo retrouvé quelle que soit son écriture; profil aligné.
- TU du client: requête (adresse encodée, jeton), réduction (ouverte, reçue, refusée, réponse périmée ignorée, fermée au changement d'écran et en invité), commandes de session.
- TU des modèles: fiche (chargement, échec, chargée, sans partie), statistiques par mode, profil aligné, boutons du salon et de la fin selon la session et le compte du joueur.
- TU des écrans: fenêtre de la fiche, boutons du salon et de la fin, profil.
- Bout en bout (bureau): Alice et Bob, chacun avec un compte, jouent une partie courte; à la fin, Alice ouvre la fiche de Bob depuis le classement et y lit une partie jouée en Horde.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un compte lit la fiche d'un autre depuis le classement de fin, vérifié de bout en bout.
2. Un invité n'a ni bouton ni fiche, et la route le refuse.
3. Le profil montre les statistiques par mode, sans meilleur score global.
4. `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-3-5-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée), le cadrage (section du profil) et l'étude des amis. Prochaine action exacte: l'étape `3.6`, les amis. Commiter.
