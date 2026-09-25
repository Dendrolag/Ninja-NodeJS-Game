# Étude - Les succès

Date: 25 septembre 2026
Statut: étude, rien n'est construit. Sept décisions attendent le porteur du projet (section 8).

## 1. La demande

Une liste de succès qui se débloquent plus ou moins facilement et rapidement, pour inciter à jouer, retenir les joueurs et récompenser les performances. La fiche joueur les montrera (décision du 25 septembre 2026, `docs/design/etude-amis-et-fiche-joueur.md`).

## 2. Challenge

- **Les succès sont un levier de long terme, pas de retour quotidien.** Ils donnent un cap à qui joue déjà. Ce qui fait revenir un jour donné, ce sont les défis du jour ou de la semaine (point d'extension distinct du cadrage, section 5), et surtout les amis: avec une petite communauté, le premier levier de rétention est de retrouver des gens avec qui jouer. Les succès valent la peine, mais ils ne remplacent ni le lien d'invitation ni les amis, déjà planifiés.
- **On ne sait pas mesurer la rétention aujourd'hui.** Sans mesure, on ne saura pas si les succès changent quelque chose. Pas besoin de pisteur: les résultats en base suffisent pour compter les comptes actifs par semaine et la part de ceux qui reviennent sept jours après leur première partie. À ajouter à l'étape, sous forme d'une requête lancée à la main, relevée avant et un mois après la mise en ligne.
- **Les pièces n'achètent rien.** En donner en récompense ne récompense pas. Donner de l'XP fausserait le niveau, qui mesure aujourd'hui le temps passé et les joueurs devancés, et inciterait à chasser les succès faciles plutôt qu'à jouer. Voir la décision 1.

## 3. Principes de conception

1. **Une courbe, pas une liste plate.** Quatre paliers de difficulté, nommés par le délai attendu pour un joueur régulier:
   - **Découverte**: dans la première heure. Plusieurs dès la première partie, pour que le joueur voie le système fonctionner.
   - **Habitué**: dans la première semaine.
   - **Expert**: en un mois de jeu régulier, ou par un exploit dans une partie.
   - **Légende**: rares, visés par peu de joueurs.

   Ces noms évitent Bronze, Argent et Or, déjà pris par les paliers de ligue.
2. **Trois familles**: les cumuls sur la durée (100 parties), les exploits dans une seule partie (combo x5), la découverte du jeu (chaque mode, chaque carte, le miroir). Les cumuls retiennent, les exploits récompensent la performance, la découverte apprend le jeu.
3. **Une victoire se gagne à plusieurs.** Tout succès de performance reprend la règle existante: une première place dans une partie d'au moins deux joueurs. Rien de ce qui récompense un talent ne s'obtient seul dans une partie privée.
4. **Rien de punitif.** Pas de série de jours consécutifs, qui transforme un jour manqué en perte et pousse à jouer par obligation: « sept jours différents » plutôt que « sept jours de suite ». Pas de succès qui demande de perdre exprès ou de gêner les autres.
5. **Montrer ce qui est proche.** Un cumul affiche sa progression (« 412 sur 500 »). L'écran de fin montre le succès le plus proche (« Plus que 3 victoires pour Dix couronnes »). C'est ce qui donne envie de relancer une partie, pour presque rien.
6. **Montrer la rareté.** « Débloqué par 12 pour cent des joueurs », calculé en base, sans rien stocker de plus. Un succès rare se voit comme tel.
7. **Quelques secrets.** Trois succès cachés, décrits seulement une fois obtenus, pour la surprise et le bouche-à-oreille.
8. **Les seuils se calibrent sur la production.** Les nombres ci-dessous sont des propositions. Au début de l'étape, une requête sur les résultats réels (captures par partie, victoires par compte, parties par semaine) les ajuste pour que chaque palier tienne son délai.

## 4. La liste proposée

Colonne « Source »: **base**, se déduit des résultats et de la progression déjà enregistrés, donc s'attribue aussi aux parties passées. **Partie**, demande un relevé pendant la partie (section 5), donc ne compte qu'à partir de la mise en ligne.

### 4.1 Découverte

| Nom | Condition | Source |
| --- | --- | --- |
| Premier pas | Terminer une partie. | base |
| Première prise | Capturer un joueur. | base |
| Nettoyeur | Détruire un Black Ninja. | base |
| Reflet | Terminer une partie en miroir. | base |
| Sur le podium | Finir dans les trois premiers d'une partie d'au moins quatre joueurs. | base |
| Première couronne | Gagner une partie à plusieurs. | base |
| Cadeau empoisonné | Ramasser un malus, qui frappe les autres. Apprend une règle que les nouveaux ignorent. | partie |

### 4.2 Habitué

| Nom | Condition | Source |
| --- | --- | --- |
| Habitué | Terminer 25 parties. | base |
| Dix couronnes | Gagner 10 parties à plusieurs. | base |
| Pickpocket | Capturer 50 joueurs au total. | base |
| Démineur | Détruire 25 Black Ninjas au total. | base |
| Touriste | Terminer une partie sur trois cartes différentes. | base |
| Touche-à-tout | Terminer une partie dans cinq modes différents. | base |
| Fidèle | Jouer sept jours différents, à l'heure de Paris. | base |
| Recrue | Atteindre le niveau 5. | base |
| Argent | Atteindre le palier Argent. | base |
| Razzia | Récupérer au moins 20 ninjas d'une seule capture. | partie |
| Revanche | Capturer, moins de 30 secondes après, le joueur qui vient de vous capturer. | partie |
| En chaîne | Atteindre le multiplicateur x3 en Horde. | partie |

« Trois cartes différentes » et « cinq modes différents » plutôt que « chaque carte » et « chaque mode »: une carte ou un mode ajouté plus tard ne retire pas un succès obtenu, ni ne change sa condition.

### 4.3 Expert

| Nom | Condition | Source |
| --- | --- | --- |
| Vétéran | Terminer 100 parties. | base |
| Cinquante couronnes | Gagner 50 parties à plusieurs. | base |
| Série | Gagner trois parties à plusieurs d'affilée. | base |
| Solidaires | Gagner 10 parties en Équipes. | base |
| Confirmé | Atteindre le niveau 20. | base |
| Or | Atteindre le palier Or. | base |
| Combo parfait | Atteindre le multiplicateur x5, en Horde ou en Massacre. | partie |
| Intouchable | Gagner une partie de Horde d'au moins quatre joueurs sans jamais être capturé, ni par un joueur ni par un Black Ninja. | partie |
| Coup de filet | Capturer au moins huit ninjas d'un seul tir, en Tactique. | partie |
| Dernière proie | Finir une Chasse d'au moins quatre joueurs comme la dernière proie non infectée. | partie |
| Meute | En Chasse, infecter trois proies dans une même partie. | partie |
| Table rase | Vider la carte en Massacre. | partie |
| Chasseur d'Évadé | Attraper l'Évadé. | partie |
| Main leste | Prendre le x2 à son porteur. | partie |
| Double ou rien | Finir premier d'une partie à plusieurs en portant le x2. | partie |

### 4.4 Légende

| Nom | Condition | Source |
| --- | --- | --- |
| Pilier | Terminer 500 parties. | base |
| Centurion | Gagner 100 parties à plusieurs. | base |
| Grand chelem | Gagner une partie à plusieurs dans cinq modes différents. | base |
| Diamant | Atteindre le palier Diamant. | base |
| Légende | Atteindre le niveau 50. | base |
| Collectionneur de fantômes | Attraper l'Évadé dix fois. | partie |
| Seigneur de la Horde | Rallier 10 000 ninjas en Horde, au total. | partie |

### 4.5 Secrets

| Nom | Condition, cachée jusqu'à l'obtention | Source |
| --- | --- | --- |
| Pas de chance | Être pris trois fois par un Black Ninja dans la même partie. | partie |
| Sur le fil | Capturer un joueur dans la dernière seconde d'une partie. | partie |
| Arroseur arrosé | Se faire capturer moins de trois secondes après avoir capturé. | partie |

### 4.6 Avec les amis, après les étapes 3.6 et 2.8

| Nom | Condition | Source |
| --- | --- | --- |
| En bande | Terminer 10 parties avec le même ami. | base, dès 3.6 |
| Rivalité | Devancer le même ami dans 10 parties. | base, dès 3.6 |
| Rassembleur | Un ami rejoint votre partie sur votre invitation. | partie, dès 2.8 |

Total: 7 Découverte, 12 Habitué, 15 Expert, 7 Légende, 3 secrets, 3 avec les amis. Chaque mode a au moins un succès à lui, et un mode ou une carte ajoutés plus tard apportent les leurs.

Écartés de la maquette: « 1000 Ninjas capturés » tel quel (voir 5.3), « Survivant Royale » (le Battle Royale n'existe pas), « Légende de Tokyo » (sans condition définie), « Maître du Miroir » (le miroir n'est pas un mode, « Reflet » le remplace).

## 5. Conception technique

### 5.1 Ce qui se déduit ne se stocke pas

- **Les définitions vivent dans le code**, dans `packages/shared/src/succes.ts`: un identifiant stable, jamais réutilisé, un nom, une description, un palier, secret ou non, et une condition écrite comme une fonction pure. Ajouter un succès est un changement de code, pas de base. Le client lit les mêmes définitions pour afficher noms, descriptions et progression.
- **Une table `succes_debloques (compte_id, succes, debloque_le, partie_id)`**, clé primaire sur le compte et le succès, en cascade sur le compte. L'identifiant du succès est un texte, pas un type énuméré: un succès retiré reste lisible, et en ajouter un ne demande pas de migration. Un identifiant inconnu du code est ignoré à la lecture.
- **Une table `faits_de_partie (partie_id, compte_id, fait, valeur)`** pour ce que `resultats` ne dit pas: Évadés attrapés, ninjas ralliés, combo le plus haut, malus ramassés. Une ligne par fait non nul. Les cumuls s'en déduisent comme ceux des résultats, et aucune colonne ne s'ajoute à `resultats`, conformément au schéma de l'étape 3.1. Ajouter un fait ne demande pas non plus de migration.
- **La progression d'un cumul se calcule** à la lecture, par les mêmes agrégats que la fiche joueur de l'étape 3.5.
- **La rareté se calcule** à la lecture: comptes qui ont le succès, sur comptes qui ont au moins une partie.

### 5.2 Le relevé de partie, sans toucher au moteur

Le moteur publie déjà, à chaque battement, les faits dont les succès ont besoin: une capture de joueur avec le nombre de ninjas transférés, un tir avec le nombre de captures, un ralliement avec son combo et son multiplicateur, une capture par un Black Ninja, un malus ramassé, l'Évadé attrapé, le x2 volé, la carte vidée. Les instants se lisent au numéro du battement.

Un **relevé d'exploits** les accumule par joueur pendant la partie. C'est une fonction pure du serveur, qui reçoit les faits du battement et rend le relevé suivant, alimentée par `GameRoom` comme le chronomètre du battement. Elle se teste sans monter de serveur. `packages/sim` n'est pas touché.

### 5.3 La seule lacune: les ninjas capturés au contact hors Horde

La maquette proposait « 1000 Ninjas capturés ». Le moteur publie un ralliement pour chaque ninja pris au contact en Horde, un nombre de captures pour chaque tir du Tactique, et compte les ninjas tués au Massacre. Mais une capture de ninja au contact en Équipes ne laisse aucun fait. D'où « Seigneur de la Horde », limité à la Horde. Un succès tous modes confondus demanderait que le moteur publie ce fait, ce qui est pur et permis, mais touche `packages/sim` et son empreinte de parties. Décision 6.

### 5.4 Quand un succès se débloque

- **À la fin de la partie**, dans la transaction qui enregistre la partie et la progression: les conditions s'évaluent sur le relevé de la partie, les résultats et la progression après la partie. Un succès est donc daté et rattaché à la partie qui l'a donné.
- **Pour les seuls comptes**, comme la progression. Un invité ne débloque rien. L'écran de fin peut lui dire ce qu'il aurait débloqué avec un compte: une incitation honnête à s'inscrire.
- **Un abandon** débloque les succès de base, puisque son résultat s'enregistre, mais pas les exploits de partie: il n'a plus d'écran de fin, et quitter ne doit pas être une façon d'en obtenir.
- **Rien pendant la partie.** L'annonce en plein jeu ferait concurrence au grand titre des objets (étape 4.6) et distrairait au pire moment. Le récapitulatif de fin (`progressionDeFin`) gagne la liste des succès débloqués, et le succès le plus proche.
- **Rattrapage à la mise en ligne**: un script, lancé une fois, attribue les succès de source « base » aux comptes qui les ont déjà mérités, datés de leur partie d'origine quand elle se retrouve. Un joueur ancien arrive donc avec ses succès, et non avec une liste vide.

### 5.5 L'affichage

- **Profil**: une section « Succès », palier par palier, obtenus en couleur avec leur date et leur rareté, les autres grisés avec leur progression, les secrets en « ??? ».
- **Fiche joueur** (étape 3.5): les succès obtenus, avec la visibilité des statistiques (tout compte connecté).
- **Fin de partie**: les succès débloqués, puis le plus proche.
- Icônes en SVG, dans le système de la maquette, sans emoji.

### 5.6 Tests

- Chaque condition, en test unitaire sur des relevés et des cumuls construits à la main, juste sous et juste sur son seuil.
- Le relevé d'exploits, sur des suites de faits connues, et sur une partie réelle rejouée par graine.
- En base: attribution dans la transaction de fin, jamais deux fois, rattrapage idempotent, rareté, cascade.
- Bout en bout: une première partie débloque « Premier pas », visible en fin de partie puis au profil.

## 6. Découpage en étapes

| Étape | Contenu | Taille | Dépend de |
| --- | --- | --- | --- |
| `3.7` Les succès, socle | Définitions, table des succès débloqués, attribution en fin de partie, rattrapage, écran de fin, section du profil, mesure de rétention. Les succès de source « base » seulement. | Moyenne à grande | `3.5`, pour afficher sur la fiche |
| `3.8` Les exploits de partie | Relevé d'exploits, table des faits de partie, succès de source « partie », secrets. | Moyenne | `3.7` |

Les succès avec les amis s'ajoutent dans les étapes `3.6` et `2.8`, ou juste après, sans étape à part. Ordre proposé: `2.7`, `3.5`, `3.7`, `3.8`, `3.6`, `2.8`. Les succès passent avant les amis parce qu'ils servent tous les joueurs qui ont un compte, sans attendre qu'ils aient des amis inscrits. L'ordre inverse se défend si le porteur du projet juge l'invitation entre amis plus urgente.

## 7. Ce qui est écarté, et pourquoi

- **Les séries de jours consécutifs**: punitives (principe 4).
- **L'XP et les pièces en récompense**: voir la section 2 et la décision 1.
- **L'annonce pendant la partie**: section 5.4.
- **Les succès qui exigent de nombreux joueurs**: la population est petite, un succès qui demande une partie pleine resterait hors de portée. Le plafond est fixé à quatre joueurs, sauf pour les cumuls.
- **Un classement des chasseurs de succès**: il inciterait à chasser les succès faciles plutôt qu'à jouer.

## 8. Décisions à prendre par le porteur du projet

1. **La récompense**: (a) aucune, le succès et sa rareté suffisent, (b) un titre à choisir parmi ses succès, affiché sous le pseudo au salon et sur la fiche, (c) des pièces, (d) de l'XP. Recommandé: (b), qui récompense par la reconnaissance des autres joueurs, coûte peu, et ne fausse rien.
2. **La liste**: la valider, en retirer ou en ajouter. Les seuils seront calibrés sur la production au début de l'étape.
3. **Le rattrapage** des succès de source « base » pour les comptes existants. Recommandé: oui.
4. **Les secrets**: les garder. Recommandé: oui, trois.
5. **L'ordre**: succès avant les amis (`3.7`, `3.8`, puis `3.6`, `2.8`), ou après. Recommandé: avant.
6. **« 1000 ninjas capturés » tous modes**, qui demande un fait de plus au moteur: le faire, ou s'en tenir à la Horde. Recommandé: s'en tenir à la Horde.
7. **La mesure de rétention**, relevée avant et un mois après: l'ajouter à l'étape `3.7`. Recommandé: oui.
