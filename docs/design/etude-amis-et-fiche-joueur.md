# Étude - Les amis et la fiche joueur

Date: 25 septembre 2026
Statut: étude close. Décisions prises par le porteur du projet le 25 septembre 2026 (section 7): les recommandations sont retenues, sauf le temps de jeu, écarté. Les quatre étapes sont inscrites au ROADMAP. La première, `2.7` le lien d'invitation, est construite depuis le 26 septembre 2026 (`docs/plan/etape-2-7.md`); les trois autres ne le sont pas.

## 1. La demande

Pouvoir ajouter un joueur en ami, par son pseudo ou par un code de partage, pour l'inviter facilement aux parties et suivre ses statistiques. Une liste d'amis, et une fiche par ami qui remonte ses statistiques principales: niveau, parties jouées, parties gagnées ou ratio victoires sur défaites, mode préféré, plus haut score, temps de jeu total. La demande invite à challenger cette liste.

## 2. Ce que le jeu a déjà

Constats vérifiés dans le code le 25 septembre 2026, parce qu'ils décident de ce qui coûte peu et de ce qui coûte cher.

- **Le compte est optionnel** (voie B, décision du 11 septembre 2026). On joue en invité avec un simple pseudo. Un invité ne laisse aucun résultat en base. Une amitié ne peut donc lier que deux comptes.
- **Le pseudo d'un compte est unique et ne change jamais.** Unicité tenue par la base (`comptes.repere_pseudo`, règle `reperePseudo` du salon), et aucune route de renommage n'existe. Le pseudo est donc déjà un identifiant stable et public: il s'affiche dans les salons et les classements.
- **Une partie privée se rejoint par un code de six caractères**, fabriqué par le serveur (étape 2.4), qui se copie en un clic au salon. Il n'existe aucun lien direct: l'invité doit ouvrir le jeu, aller dans « Parties » et taper le code.
- **La page garde un lien Socket.IO ouvert hors partie** (étape 2.6), rattaché au compte par son jeton (`socket.data.compteId`). Le serveur sait donc, en mémoire, quels comptes ont une page ouverte, et peut leur envoyer un message sans rien ajouter au transport.
- **Le serveur de production est un seul processus** (Render, offre gratuite, qui s'endort après quinze minutes sans trafic). Les parties vivent déjà en mémoire de ce processus (`RoomManager`).
- **Le profil existe, pour soi seulement**: `GET /api/comptes/profil` rend le niveau, l'XP, le palier et les points de ligue, les pièces, trois statistiques déduites des résultats (`statistiquesDuCompte`: parties jouées, victoires, meilleur score, plus le record en Massacre joué seul) et les dix dernières parties. Personne ne peut consulter le profil d'un autre.
- **Une victoire est une première place dans une partie d'au moins deux joueurs** (`JOUEURS_POUR_UNE_VICTOIRE`). En Équipes, tous les vainqueurs sont placés premiers.
- **Le temps passé en partie est connu à la fin mais n'est pas enregistré.** `tempsJoueMs` sert au calcul de l'XP, puis se perd: `resultats` n'a pas de colonne pour lui, et `parties.duree_s` est la durée réglée, pas la durée réelle (une Chasse ou un Massacre peuvent finir avant).
- **Le cadrage avait masqué du profil**, le 11 septembre 2026: le ratio, la meilleure série, le temps de jeu et les ninjas capturés au total (`docs/design/cadrage.md`, section 3.7). La demande en rouvre deux, le ratio et le temps de jeu.
- **Les limites de débit existent** (`comptes/limiteur.ts`), et le schéma prévoyait que toute fonctionnalité nouvelle s'ajoute par des tables qui référencent le compte.

## 3. Challenge de la demande

### 3.1 Le besoin réel est de rejouer ensemble, et un lien y répond mieux qu'une liste d'amis

L'ambition du jeu est « un jeu entre amis ». Ces amis se coordonnent aujourd'hui hors du jeu, par messagerie, en se passant le code. Une liste d'amis n'aide que si l'ami a une page du jeu ouverte au même moment. Sinon l'invitation ne lui parvient pas, et il faut de toute façon passer par la messagerie.

Ce qui manque vraiment, c'est un **lien d'invitation**: `…/?partie=K7XM3Q`, qui ouvre le jeu directement sur l'entrée dans la partie. Sur téléphone, le bouton de partage du système (`navigator.share`) l'envoie dans n'importe quelle messagerie. Ce lien sert aussi les invités, que la liste d'amis exclut, et ne touche ni à la base ni au transport.

Recommandation: faire le lien en premier, comme une étape à part. Il livre l'essentiel de « inviter facilement » pour une fraction du coût. La liste d'amis vient ensuite, pour ce qu'elle seule apporte: voir qui est en ligne, l'inviter d'un geste, suivre ses statistiques.

### 3.2 Ajouter un ami: le pseudo suffit, le code de partage est de trop

Le pseudo d'un compte est unique, stable et déjà public. Un code de partage serait un second identifiant pour la même chose, à fabriquer, stocker, afficher et renouveler, sans rien protéger: le pseudo s'affiche déjà dans chaque salon.

Deux chemins valent mieux qu'un code:

- **Depuis la fin de partie et le salon.** C'est là qu'on rencontre les joueurs qu'on voudra retrouver. Un bouton « Ajouter en ami » sur la ligne d'un joueur qui a un compte. C'est le chemin le plus naturel dans un jeu, et le seul qui ne demande rien de taper.
- **Par le pseudo**, dans l'écran des amis, pour quelqu'un qu'on connaît hors du jeu.

Si un partage sans saisie est voulu, un **lien d'ami** (`…/?ami=Pseudo`) fait ce que ferait le code, sans rien stocker, et réutilise le mécanisme du lien d'invitation.

### 3.3 Les statistiques, une par une

| Statistique demandée | Disponible aujourd'hui | Verdict | Raison |
| --- | --- | --- | --- |
| Niveau | Oui, déduit de l'XP | Garder | Déjà public dans les salons. |
| Parties jouées | Oui | Garder | |
| Parties gagnées | Oui | Garder, par mode | Une victoire ne veut pas dire la même chose en Horde à douze et en Chasse. |
| Ratio victoires sur défaites | Non, et à écarter | **Remplacer** | Voir ci-dessous. |
| Mode préféré | Non, mais se déduit | Garder | Le mode le plus joué, départagé par la partie la plus récente. Un regroupement sur `resultats`, sans stockage. |
| Plus haut score | Oui, mais toutes modes confondus | **Garder, par mode** | Voir ci-dessous. |
| Temps de jeu total | Non, non enregistré | **Écarté** | Décision du 25 septembre 2026. Voir ci-dessous. |

**Le ratio victoires sur défaites se lit mal dans ce jeu.** Les parties se jouent jusqu'à douze, chacun pour soi dans la plupart des modes. Gagner une partie sur quatre à huit joueurs est une performance, et donne un ratio de 0,33 qui se lit comme un échec. Le ratio dépend davantage de la taille des salons que du niveau du joueur. À la place: « 12 victoires en 40 parties à plusieurs », et le palier de ligue, qui mesure déjà la performance en tenant compte de la place et du nombre de joueurs.

**Un plus haut score toutes modes confondus compare des choses différentes.** Une proie de Chasse marque en parcourant la carte, un joueur de Massacre au combo, et le x2 de l'Évadé double le score de son porteur. Le maximum global finit par être toujours le même mode. C'est déjà le cas du profil actuel, qui affiche ce maximum global. Proposition: un meilleur score par mode, qui remplace aussi celui du profil, et le record en Massacre solo y devient un cas du même tableau au lieu d'une exception.

**Le temps de jeu total** aurait coûté une colonne `temps_joue_s` dans `resultats`, et n'aurait compté qu'à partir de sa mise en ligne: les parties déjà enregistrées ne le connaissent pas, et rien ne permet de le retrouver de façon fiable (l'XP d'un abandon vaut zéro, et `duree_s` est la durée réglée). **Écarté par le porteur du projet le 25 septembre 2026**: le masquage du cadrage tient toujours.

### 3.4 Ce que la demande ne dit pas et qu'il faut trancher

- **Les parties jouées ensemble, et le face-à-face.** « 14 parties ensemble, devant lui 9 fois. » C'est la seule statistique propre à une amitié, et la plus parlante entre amis. Elle se déduit des résultats (deux comptes, même partie, placements comparés, sans compter les égalités, qui sont les coéquipiers vainqueurs en Équipes). Recommandée.
- **Le consentement.** Une amitié permet d'envoyer des invitations qui s'affichent chez l'autre. Elle doit donc être acceptée, pas imposée.
- **Qui voit la fiche.** Un ami seulement, tout compte connecté, ou tout le monde. Voir la décision 2.
- **Se protéger d'un importun.** Refuser une demande, retirer un ami, bloquer un compte.
- **Les dernières parties d'un ami**: la demande ne les cite pas. Elles disent quand quelqu'un joue. À réserver aux amis, ou à laisser au profil de chacun.

## 4. Conception proposée

### 4.1 L'amitié

- **Mutuelle, par demande acceptée.** A demande, B accepte ou refuse. Deux demandes croisées valent acceptation.
- **Refuser est silencieux.** A ne l'apprend pas, sa demande disparaît simplement.
- **Retirer un ami** défait l'amitié des deux côtés, sans prévenir l'autre.
- **Bloquer** un compte défait l'amitié, supprime les demandes dans les deux sens, et empêche toute nouvelle demande ou invitation de sa part. Le bloqué ne l'apprend pas: ses demandes sont acceptées par le serveur puis ignorées.
- **Bornes**, à loger dans `packages/shared/src/bornes.ts`: 200 amis au plus, 50 demandes envoyées en attente au plus, 10 demandes par minute et par compte.

### 4.2 Les données

Trois tables nouvelles qui référencent le compte, conformément au schéma de l'étape 3.1. Aucune colonne n'est ajoutée aux tables existantes.

- `amities (compte_a, compte_b, creee_le)`: une ligne par amitié, avec `compte_a < compte_b` imposé par une contrainte. Une amitié est symétrique: la stocker une fois, dans un ordre fixe, rend un doublon impossible par construction. Clé primaire sur le couple, index sur `compte_b` pour lire les amis d'un compte dans les deux sens.
- `demandes_d_ami (de, pour, creee_le)`: dirigée. Clé primaire sur le couple, contrainte `de <> pour`, index sur `pour` pour lire les demandes reçues. Accepter supprime la demande et crée l'amitié dans une même transaction.
- `blocages (bloqueur, bloque, cree_le)`: dirigée, clé primaire sur le couple.
- Toutes en `on delete cascade` sur `comptes`.

Aucune de ces données ne touche `packages/sim`: les amis et la présence sont l'affaire du serveur et de la page.

### 4.3 La fiche joueur

- **Route** `GET /api/joueurs/:pseudo`, retrouvée par `reperePseudo`, avec un format de réponse et une lecture vérifiée dans `packages/shared`, comme `ProfilDuCompte`.
- **Contenu**: pseudo, date d'inscription, niveau, palier de ligue, parties jouées, victoires sur parties à plusieurs, mode préféré, meilleur score par mode. Pour un ami: la présence, les parties jouées ensemble et le face-à-face.
- **Jamais**: les pièces, le code de secours, l'identifiant du compte, ni les dernières parties (décision 7).
- **Les succès, plus tard.** Le porteur du projet veut que la fiche montre les trophées et succès débloqués, quand ils existeront. Ils ne sont pas construits: c'est un point d'extension du cadrage (section 5, « succès et défis du jour »), sans étape au ROADMAP. La fiche s'y prépare sans rien construire d'avance: sa réponse est un objet à champs nommés, où un champ `succes` s'ajoutera, et son écran une suite de sections, où une section « Succès » s'insérera. L'étape qui construira les succès les affichera sur la fiche, avec la même visibilité que les statistiques.
- **Requêtes**: une agrégation par mode sur `resultats` joint à `parties`, et, pour le face-à-face, une jointure de `resultats` sur lui-même par `partie_id`, que la clé primaire `(partie_id, compte_id)` et l'index `resultats_par_compte` servent déjà. Aux volumes du jeu, rien à mettre en cache.
- **Le profil réutilise la même agrégation**: il gagne le meilleur score par mode et le mode préféré, au lieu d'avoir sa propre requête.

### 4.4 La présence et les invitations

- **La présence vit en mémoire**, dans une instance possédée par la couche réseau, comme le `RoomManager`, jamais dans un état global de module (règle 5). Elle est alimentée par les liens ouverts et fermés, et par l'entrée et la sortie d'une partie. Rien ne s'écrit en base.
- **Quatre états**, vus des seuls amis: hors ligne, en ligne, dans un salon, en partie. Pour une partie publique, le mode et les places, avec « Rejoindre ». Pour une partie privée, seulement « dans une partie privée »: la présence ne divulgue jamais un code.
- **Inviter** un ami en ligne envoie un message à toutes ses pages ouvertes: « Léa t'invite, Horde, 4 sur 12 », avec Rejoindre et Ignorer. L'invitation porte un droit d'entrée tenu par le serveur, valable deux minutes et tant que la partie accepte des entrées: elle ouvre une partie privée **sans montrer le code**. Les règles d'entrée de chaque mode ne changent pas (la Chasse lancée refuse toujours).
- **En partie, une invitation ne s'affiche pas**: elle attend le retour aux menus, si elle vaut encore. Une notification en plein jeu ferait perdre la partie.
- **Un ami hors ligne ne reçoit rien.** C'est le lien d'invitation qui couvre ce cas, d'où son rang dans l'ordre.
- **Une demande d'ami reçue** se garde en base et se signale par une pastille à la visite suivante, en direct si la page est ouverte.
- **Limite connue**: présence et invitations supposent un seul processus serveur. C'est déjà le cas des parties elles-mêmes: le jour où le jeu passera à plusieurs processus, parties, présence et invitations devront partager un même registre. Aucune contrainte nouvelle, mais une de plus à déplacer ce jour-là.

### 4.5 L'interface

- **Une cinquième destination « Amis »** dans la navigation latérale, avec une pastille pour les demandes reçues. Sur téléphone, la barre du bas passe de quatre à cinq entrées, ce qui tient à 360 pixels. Alternative: un onglet de l'écran Profil, moins visible.
- **L'écran Amis**: champ « Ajouter par pseudo », demandes reçues (Accepter, Refuser), demandes envoyées (Annuler), amis triés par présence puis par pseudo, avec Inviter quand on est soi-même dans un salon.
- **La fiche** s'ouvre depuis la liste d'amis, la liste des joueurs du salon et le classement de fin, pour les lignes qui ont un compte. Un invité n'a pas de fiche.
- **Un invité** qui ouvre « Amis » est mené à la connexion, comme pour le profil. C'est une raison de plus de créer un compte, sans rien retirer à l'invité.

### 4.6 Sécurité et abus

- Savoir si un pseudo a un compte n'est pas une fuite nouvelle: l'inscription le dit déjà (« Ce pseudo est déjà pris »).
- Demandes et invitations passent par le limiteur existant et par les bornes de 4.1. Une invitation se limite par destinataire (une par minute vers le même ami).
- Toute décision se prend au serveur: le client ne dit jamais « nous sommes amis », le serveur le vérifie avant chaque invitation ou lecture réservée aux amis.
- Le pseudo reçu dans l'URL est validé par `validerPseudo` avant toute requête, comme n'importe quelle saisie.

### 4.7 Tests

- Base (projet `base`, branche Neon): contraintes des trois tables, acceptation transactionnelle, demandes croisées, blocage, cascade à la suppression d'un compte, agrégats par mode et face-à-face sur un jeu de parties connu.
- Serveur: présence et invitations sans base (liens ouverts et fermés, droit d'entrée expiré, partie privée rejointe sans code, invitation refusée d'un bloqué).
- Page: modèles de l'écran Amis et de la fiche, lecture du lien d'invitation.
- Bout en bout: deux comptes deviennent amis, l'un invite, l'autre rejoint. Un invité ouvre un lien d'invitation et entre dans la partie privée.
- `packages/sim` n'est pas touché: sa couverture ne bouge pas.

## 5. Découpage en étapes

Chaque étape livre quelque chose d'utile seule. On peut s'arrêter après n'importe laquelle.

| Étape | Contenu | Taille | Dépend de |
| --- | --- | --- | --- |
| `2.7` Le lien d'invitation | `?partie=CODE` ouvre l'entrée dans la partie, pseudo demandé à un invité. Bouton « Partager » au salon (`navigator.share`, copie du lien à défaut). | Petite | Rien |
| `3.5` La fiche joueur | Route par pseudo, agrégats par mode, mode préféré, profil aligné sur la même agrégation. Ouverture depuis le salon et la fin de partie. | Moyenne | Rien |
| `3.6` Les amis | Tables, demandes, acceptation, retrait, blocage, écran Amis, ajout par pseudo et depuis la fin de partie, face-à-face sur la fiche. | Moyenne à grande | `3.5` |
| `2.8` Présence et invitations | Registre de présence, invitation poussée, droit d'entrée sans code, « Rejoindre » une partie publique d'un ami. | Moyenne à grande | `3.6` |

Les numéros suivent la carte thématique: le réseau en phase 2, les comptes en phase 3. L'ordre d'exécution est celui du tableau. Les quatre étapes sont inscrites à la section 3 du ROADMAP le 25 septembre 2026, après `8.7`, déjà planifiée au titre de la règle 7. Leurs fiches se rédigent au début de chacune, selon le cas de repli du PROTOCOLE, à partir de cette étude.

## 6. Ce qui est écarté, et pourquoi

- **Le code de partage d'ami**: doublon du pseudo (3.2).
- **Le ratio victoires sur défaites**: trompeur dans des parties à plusieurs (3.3).
- **Le plus haut score global**: remplacé par un meilleur score par mode (3.3).
- **Le temps de jeu total**: décision du porteur du projet (3.3).
- **Le suivi à sens unique**, façon abonnement: il permettrait d'inviter quelqu'un qui n'a rien accepté.
- **Une messagerie entre amis**: modération, stockage et abus pour un besoin que les joueurs couvrent déjà ailleurs. Le chat du salon reste le seul.
- **Les invitations persistantes hors ligne**: le lien d'invitation fait mieux, sans stockage.

## 7. Décisions du porteur du projet, le 25 septembre 2026

1. **L'ordre**: le lien d'invitation (`2.7`) en premier, indépendant de la liste d'amis. Retenu.
2. **La visibilité de la fiche**: tout compte connecté voit les statistiques, la présence et le face-à-face sont réservés aux amis. Un invité ne voit pas de fiche. Retenu.
3. **Le temps de jeu**: écarté. Rien ne s'ajoute à `resultats`.
4. **Le ratio remplacé** par les victoires sur parties à plusieurs et le palier de ligue. Retenu.
5. **Le meilleur score par mode**, qui remplace aussi le meilleur score global du profil actuel. Retenu.
6. **L'écran Amis** est une cinquième destination de la navigation. Retenu.
7. **Les dernières parties d'un ami** ne figurent pas sur sa fiche: les parties ensemble suffisent. Retenu.
8. **Les succès**, ajout du porteur du projet: la fiche montrera les trophées et succès débloqués quand la fonctionnalité existera (section 4.3). Rien ne se construit d'avance.
