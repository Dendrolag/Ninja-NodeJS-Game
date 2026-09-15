# Fiche étape 2.6 - Lien perdu hors partie

Brief de session. Objectif unique: hors d'une partie en cours, une page qui perd son lien avec le serveur le rétablit d'elle-même, sans rechargement, et dit au joueur ce qui se passe.

Fiche rédigée le 15 septembre 2026 selon le cas de repli du PROTOCOLE, à partir de l'entrée 2.6 du ROADMAP (section 4), des handoffs 2.5 et 3.4, et de l'état réel du dépôt. Les trois décisions de l'entrée (ce qui est dit au joueur, le sort de sa place dans un salon, et la durée des essais) ont été tranchées par le porteur du projet au début de la session.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 3.4, puis cette fiche. Au besoin: le journal de `docs/design/README.md` (entrées du 18 août 2026 sur la reconnexion automatique coupée, du 14 septembre sur le réveil du serveur, du 15 septembre sur la place gardée en partie).

## Pourquoi

L'étape 2.5 garde la place d'un joueur dont le lien tombe en pleine partie. Partout ailleurs, une page qui perd son lien revient à l'accueil, affiche « La connexion au serveur a été perdue » et propose de recharger la page. Un téléphone qui change de réseau, un onglet mis en veille, une page privée de processeur ou une mise en ligne qui redémarre le serveur suffisent. C'est aussi ce qui a fait échouer des parcours de bout en bout sous charge (handoffs 5.4 et 2.5), et ce que vit une page coupée parce que la session de son compte a été fermée (handoff 3.4).

## État du dépôt au départ (15 septembre 2026)

1. **Un seul endroit décide de la perte du lien**: `retour.ts`. En pleine partie avec un jeton de retour, il tente de revenir. Sinon, et au bout du délai de retour, il oublie la place et applique `connexionPerdue`: retour à l'accueil, état remis à zéro, « Recharger la page ».
2. **Le réveil** (`reveil.ts`, étape 5.3) réessaie toutes les trois secondes pendant quatre-vingt-dix secondes un lien qui n'a jamais abouti, en disant que le serveur démarre. Il se tait pendant un retour en partie.
3. **Seul l'accueil dit où en est le lien.** L'écran des parties montre « Connexion au serveur… » tant que le lien n'est pas établi; la création, le salon, la fin, le profil et la connexion ne disent rien.
4. **Le serveur retrouve une partie par son code (privée) ou son identifiant (publique seulement).** Dans le salon, une déconnexion est un départ immédiat, et un hôte seul qui part détruit la partie.
5. **Le transport garde les messages émis sans lien.** Socket.IO (4.8.3) les met en file et les envoie à l'ouverture du lien suivant, avant de prévenir de la connexion. Le fichier `reseauSocketIo.ts` affirme pourtant « pas de file d'attente de messages ». Défaut relevé en préparant l'étape, traité selon la règle 7 (décision 8).

## Décisions du porteur du projet (15 septembre 2026)

1. **Dans le salon, retour automatique.** La page rouvre le lien et redemande d'elle-même à entrer dans la même partie: par son code si elle est privée, par son identifiant sinon. Le serveur ne change pas: le joueur revient comme un nouvel arrivant, et l'hôte a pu passer la main. Écartés: revenir à l'accueil en demandant au joueur de rentrer à la main; garder la place dans le salon côté serveur, déjà écarté à l'étape 2.5 (place fantôme qui bloque capacité et hôte).
2. **Hors partie, le joueur reste sur son écran.** Il garde ce qu'il y a saisi. Une ligne d'état discrète dit « Connexion perdue. Reconnexion… », et les boutons qui ont besoin du serveur attendent. Écartés: revenir à l'accueil; ne rien dire les premières secondes.
3. **Quatre-vingt-dix secondes d'essais, puis un bouton.** Un essai aussitôt, puis toutes les trois secondes pendant une minute et demie à compter de la perte, comme le réveil. Ensuite « La connexion au serveur a été perdue. » avec « Réessayer », sans rechargement. La page réessaie aussi d'elle-même quand elle revient au premier plan ou que le navigateur retrouve le réseau. Écarté: des essais sans limite.

## Décisions de conception

1. **Un module du rétablissement** (`packages/client/src/retablissement.ts`), à côté du retour et du réveil. `retour.ts` reste le seul à décider de la perte du lien; hors d'une partie en cours, il oublie la place et passe la main au rétablissement.
2. **Un nouvel état du lien, `retablissement`.** Le réveil se tait pendant ce temps, comme pendant un retour. Un refus du serveur lui-même (session fermée, autre version) arrête les essais et se dit, comme aujourd'hui; il ne se rabat jamais en invité en silence (décision du 11 septembre 2026).
3. **Le lien se rouvre avec la session gardée, sans la relire.** Comme le retour, le rétablissement présente le jeton gardé au serveur, qui le vérifie à l'ouverture: une session fermée fait refuser le lien. Relire la progression à chaque essai ferait des requêtes vers un serveur injoignable, sans délai de garde.
4. **Quand le délai de retour en partie s'écoule, la place est perdue mais le lien continue d'être rétabli**, jusqu'à quatre-vingt-dix secondes à compter de la coupure. La page revient à l'accueil et dit que la partie n'a pas pu être reprise à temps.
5. **Le salon reste affiché pendant le rétablissement**, avec la ligne d'état « Connexion perdue. Retour dans le salon… ». Lancer, régler et écrire sont suspendus, et le compte à rebours affiché s'efface. Au retour du lien, la demande d'entrée part; l'état reste en rétablissement jusqu'à la réponse. Acceptée, le salon neuf remplace l'ancien. Refusée, l'accueil dit que le salon n'a pas pu être retrouvé, avec le motif du serveur. Si le joueur quitte le salon entre-temps, rien n'est redemandé, et une réponse tardive ne compte plus. Au bout des quatre-vingt-dix secondes, ou si le serveur refuse le lien, le salon est oublié et la page revient à l'accueil.
6. **L'écran de fin reste affiché**: le classement est déjà là. « Rejouer » attend le lien. Un refus du lien ramène à l'accueil, où se choisit la suite (réessayer, continuer en invité, recharger).
7. **Une ligne d'état commune** (`interface/modeles/lien.ts`, `interface/composants/lien.ts`) dit où en est le lien sur tous les écrans hors de l'accueil et du jeu, avec les mêmes textes et les mêmes boutons que l'accueil, qui la calcule de la même façon. Elle remplace le « Connexion au serveur… » propre à l'écran des parties. De retour sur l'écran des parties, la liste se redemande.
8. **Un message émis sans lien est perdu**, comme le transport le promettait déjà. Sans quoi une commande émise pendant une coupure (lancer, régler, écrire, quitter) partirait sur le lien suivant, avant la demande d'entrée ou de retour. Seul le cas légitime, la liste des parties demandée avant la première connexion, est repris: elle se demande à l'établissement du lien.

## Périmètre

1. **Transport**: `emettre` sans lien établi n'envoie rien, dans le vrai transport comme dans le banc d'essai.
2. **Client**: le rétablissement (essais, durée, premier plan et réseau retrouvé, retour au salon, abandon, refus); le passage de la main par `retour.ts`; « Réessayer » qui relance les essais après un abandon; la liste des parties redemandée à l'établissement du lien.
3. **État**: l'état `retablissement`; les actions de la perte du lien hors partie et du retour au salon; une perte définitive ou un refus qui ne quitte que les écrans de partie.
4. **Interface**: la ligne d'état commune; l'accueil (« Connexion perdue. Reconnexion… », « Réessayer » à la place de « Recharger la page »); le salon et la fin qui suspendent ce qui a besoin du lien.
5. **Page**: les signaux du premier plan et du réseau retrouvé, branchés dans `principal.ts`.

## Hors périmètre

- Garder la place dans le salon côté serveur, ou y rendre l'hôte à qui revient.
- Montrer aux autres joueurs qu'un joueur a perdu son lien.
- Raccourcir les battements de Socket.IO pour constater plus tôt une coupure silencieuse (limite relevée au handoff 2.5).
- Revenir en partie après une coupure plus longue que le délai de retour.

## Tests requis

- TU du rétablissement: lien tombé sur un écran de menu, qui y reste et se rouvre aussitôt; essais toutes les trois secondes, puis perte au bout de quatre-vingt-dix secondes sans essai planifié; « Réessayer » et page revenue au premier plan qui relancent; refus du serveur qui arrête tout; réveil muet; salon redemandé par son code ou son identifiant, sous le bon pseudo, accepté ou refusé, lien retombé pendant la demande, salon quitté pendant la coupure; fin qui reste affichée; partie perdue au bout du délai de retour qui continue le rétablissement; fermeture qui n'oublie aucun essai.
- TU de l'état, des écrans et des modèles: accueil, ligne d'état commune, salon et fin suspendus, liste des parties redemandée.
- TI client contre un vrai serveur: lien coupé par le serveur sur l'accueil puis rétabli; lien coupé dans un salon privé, retour dans le même salon; salon disparu, retour à l'accueil avec l'avis; un message émis sans lien ne part pas sur le lien suivant.
- Bout en bout: sur l'accueil, serveur arrêté puis relancé sur le même port; la page dit la perte, rétablit le lien sans rechargement, et entre dans une partie.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Un lien coupé sur l'accueil se rétablit sans recharger la page, vérifié de bout en bout.
2. Un lien coupé dans un salon ramène le joueur dans le même salon, vérifié en intégration.
3. Le retour en partie de l'étape 2.5 est inchangé: ses tests passent.
4. Classique inchangé: aucun changement du moteur ni du serveur attendu, la couverture de `packages/sim` ne baisse pas.

## Réconciliation en cours d'exécution (15 septembre 2026)

Écarts entre cette fiche et ce qui a été construit. Le code et le journal de `docs/design/README.md` font foi.

1. **L'arrêt du serveur est corrigé, hors du périmètre prévu.** À la vérification à l'écran, l'arrêt du serveur de test restait suspendu tant qu'une page était ouverte. Reproduit en Node: une connexion ouverte sans requête, comme un navigateur en ouvre d'avance, retient `server.close()` jusqu'à son expiration, et `io.close()` de Socket.IO ne rend la main qu'après. En production, l'arrêt d'une mise en ligne aurait attendu le délai de l'hébergeur, sans fermer la base. Traité selon la règle 7 dans `packages/server/src/serveur.ts`, avec ses tests (`serveur.arret.test.ts`). La définition de terminé disait « aucun changement du serveur attendu »: c'est le seul, et il ne touche pas au jeu.
2. **Le banc d'essai du transport perd lui aussi les messages sans lien**, pour rester fidèle au vrai: deux tests des contrôles établissent désormais le lien avant d'appuyer sur une touche.
3. **Une session qui rouvre le lien pendant un rétablissement ne l'interrompt pas** (connexion ou inscription réussie depuis un menu pendant la coupure): l'état reste en rétablissement, et ses essais continuent avec la nouvelle session.
4. **La ligne d'état commune** se nomme `ligne-lien` (`monterLigneDuLien`); elle se montre aussi pendant l'établissement du lien et le réveil du serveur, que les écrans hors de l'accueil ne disaient pas.
5. **Le scénario de bout en bout éteint et rallume le serveur** sur le même port (`harnais/serveur-de-jeu.ts`), plutôt que de couper le lien d'une page: la page vit ainsi des essais sur un serveur injoignable, comme lors d'une mise en ligne. Le retour dans le salon est vérifié en intégration, où le serveur coupe une seule connexion.
6. **La vérification à l'écran** s'est faite par un script Playwright temporaire sur le serveur de test sans base, supprimé ensuite: le serveur de développement local parle à la base de production (question du handoff 3.4).

## Rituel de fin de session

Écrire `docs/handoffs/etape-2-6-handoff.md`. Consigner les décisions au journal de `docs/design/README.md`, mettre à jour le ROADMAP (étape terminée) et la grille de recette 5.4. Prochaine action exacte: les fonctionnalités reportées, dont l'ordre se décide avec le porteur du projet. Commiter.
