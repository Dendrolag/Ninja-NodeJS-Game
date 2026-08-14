# Handoff - Étape 1.6 Durcissement et autorité serveur

Date: 14 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Rendre le moteur et son futur hôte insensibles aux entrées malveillantes ou aberrantes, et poser les contrats de validation que la couche réseau appliquera à l'étape 2.2. **Cette étape clôt la phase 1.**

## Ce qui a été fait

- Le contrat d'entrée du joueur descend dans `packages/shared`: une intention de déplacement, une identité de session, un message de chat signé. Le moteur le republie sous son nom local `EntreeJoueur`, sans qu'aucun appelant existant ait eu à changer.
- Les schémas de validation existent: pseudo, message de chat, intention de déplacement, réglages de partie. Chacun rend un verdict typé qui oblige l'appelant à traiter le refus.
- Les bornes du jeu sont rassemblées en données dans `bornes.ts`, y compris celles que le salon du legacy imposait dans son HTML et que le serveur ne vérifiait pas.
- La limitation de débit est décidée en données et applicable: un seau à jetons pur, à qui le temps est fourni comme au moteur.
- Le moteur refuse une intention de déplacement non finie, et avance correctement malgré un vecteur de norme gigantesque.
- Deux défauts hors périmètre corrigés au titre de la règle 7: X20 (la contagion du blanc, tranchée par le porteur du projet) et X30 (la contagion du noir, régression du portage découverte en séance).
- Cinquante-cinq tests ajoutés. 551 tests passent, couverture globale à 99,73 pour cent.

## Ce que la frontière garantit, en une page

### Une règle unique

**Le message d'un joueur ne contient que son intention, jamais son état.** Une direction, un texte, un choix de réglage. L'identité vient de la session, les effets viennent du moteur, la distance vient de dt.

### Les quatre schémas

```ts
validerPseudo(brut: unknown): ResultatValidation<string>
validerMessageChat(session: SessionJoueur, brut: unknown): ResultatValidation<MessageChat>
validerIntentionDeplacement(brut: unknown): ResultatValidation<IntentionDeplacement>
validerReglages(brut: unknown): ResultatValidation<ReglagesPartie>
```

`ResultatValidation<T>` est une union discriminée: `{ valide: true, valeur }` ou `{ valide: false, erreurs }`. Chaque erreur porte le chemin du champ fautif (`bonus.types.vitesse.dureeS`) et un motif rédigé en français, destiné à être montré au joueur. Les réglages rendent **toutes** leurs erreurs d'un coup, pour que l'écran de réglages du salon puisse les afficher ensemble.

### Ce qui est refusé, et ce qui est ignoré

- **Refusé**: un pseudo hors de la liste blanche de caractères, un pseudo ou un message hors bornes, un réglage hors bornes ou non entier, une carte inconnue, une coordonnée non finie, un groupe de réglages qui n'est pas un objet.
- **Ignoré**: tout champ inconnu. Un client qui joint `speedBoostActive` ou `isMobile` à son message n'obtient rien, parce que ces champs ne sont jamais lus. Les réglages ne recopient que les clés connues, ce qui interdit au passage de glisser une clé spéciale du langage dans un objet fourni par un client.
- **Jamais rogné en silence**: un réglage hors bornes est refusé, pas ramené à la borne. Un message de 201 caractères est refusé, là où le legacy le tronquait sans le dire.

### Le pseudo passe par une liste blanche

Lettres de toutes les langues et leurs accents, chiffres, espace, tiret, tiret bas, point. Un à vingt caractères après normalisation, le maximum étant celui du champ de saisie du legacy. Sont donc refusés: le balisage, les guillemets, les apostrophes et les emoji.

La normalisation compose les accents en une seule écriture, supprime les caractères invisibles (dont l'inversion du sens de lecture), ramène les retours à la ligne à des espaces et rogne les bords.

**À retenir pour l'étape 4.3**: valider à l'entrée ne dispense pas d'échapper à l'affichage. Le client pose tout texte venu d'un joueur avec `textContent`, jamais avec `innerHTML`. Les deux sont exigés, ils ne protègent pas de la même chose.

### Le chat est signé, pas vérifié

`validerMessageChat` ne lit que le champ `texte`. L'auteur et le pseudo du résultat viennent de la session, et de nulle part ailleurs. Une fonction qui vérifierait la concordance pourrait être oubliée; une fonction qui ne lit pas le champ ne peut pas l'être.

### Les limites de débit

```ts
LIMITES_DEBIT = {
  deplacement: { parSeconde: 60, rafale: 10 },
  chat: { parSeconde: 1, rafale: 5 },
  reglages: { parSeconde: 5, rafale: 10 },
  autresActions: { parSeconde: 5, rafale: 10 },
};
```

Modèle: un seau contient au plus `rafale` jetons et se remplit de `parSeconde` jetons par seconde. Un message consomme un jeton, un refus n'en consomme aucun. Le déplacement est calibré sur la cadence réelle du client du legacy, un envoi toutes les vingt millisecondes, avec de la marge.

`seauNeuf(limite)` et `consommer(seau, limite, dtMs)` sont des fonctions pures. **L'étape 2.2 tiendra un seau par joueur et par type d'entrée**, et lui passera le temps écoulé depuis le message précédent.

### Les bornes des réglages

Celles du salon du legacy quand elles existaient (durée 30 à 600 s, bots 10 à 150, bots noirs 1 à 5, intervalles et durées d'effets). Six réglages n'avaient aucun équivalent dans le salon et leurs bornes sont des décisions du 14 août 2026: les trois réglages de zone, et les trois réglages de bot noir autres que leur nombre. Tous les nombres sont des entiers. Une seule règle croise deux réglages: la durée minimale d'une zone ne peut pas dépasser sa maximale.

## Écarts de comportement mesurés

La fiche demande que tout écart soit mesuré, expliqué et consigné. Il y en a un seul, et il ne vient pas du durcissement.

**La contagion des couleurs entre bots change.** Seule une entité portant la couleur d'un joueur repeint désormais un bot. Mesure sur vingt parties d'une minute, trois joueurs, trente bots, graines 1 à 20:

|                                       | Avant | Après |
| ------------------------------------- | ----- | ----- |
| Bots portés en fin de partie, cumulés | 111   | 149   |
| Bots restés neutres, cumulés          | 372   | 332   |

Soit environ un tiers de score en plus. Le chiffre couvre les deux corrections à la fois, X20 et X30, qui vivent au même endroit. Les scores montent parce que les bots capturés cessent d'être effacés par les bots que personne n'a capturés.

**Aucun autre écart.** La vitesse des joueurs, celle des bots, les durées d'effets, les captures et le score sont inchangés. Les 93 tests de caractérisation passent sans modification.

L'instantané de référence de `partie.test.ts` a été régénéré: la partie diverge dès le premier contact entre bots, ce qui décale toute la suite des tirages. C'est attendu, et c'est le seul instantané du dépôt.

## Fichiers créés ou modifiés

Créés, dans `packages/shared/src/`

- `entrees.ts`: les contrats d'entrée (`IntentionDeplacement`, `SessionJoueur`, `MessageChat`) et la règle générale de l'étape. Types seuls, donc exclu de la mesure de couverture comme `geometrie.ts`.
- `bornes.ts`: `BORNES_PSEUDO`, `BORNES_CHAT`, `BORNES_REGLAGES`, `LIMITES_DEBIT`. Données seules.
- `validation.ts`: les quatre schémas et leurs briques de lecture.
- `validation.test.ts`: 39 tests. Bornes des deux côtés, failles S1, S2 et S3, clés inconnues.
- `debit.ts`: le seau à jetons.
- `debit.test.ts`: 11 tests. Débit soutenu refusé, rafale tolérée, refus gratuit, cadence du legacy acceptée.

Modifiés

- `packages/shared/src/index.ts`: exporte les nouveaux types et fonctions.
- `packages/sim/src/moteur.ts`: `EntreeJoueur` devient un alias de `IntentionDeplacement`; `intentionExploitable` refuse une coordonnée non finie; commentaires sur ce que la table d'entrées garantit.
- `packages/sim/src/direction.ts`: `norme` passe à `Math.hypot`, contre le débordement.
- `packages/sim/src/capture.ts`: `aUneCouleurADonner`, la règle qui corrige X20 et X30.
- `packages/sim/src/contacts.ts`: le commentaire d'aiguillage dit maintenant la vérité sur les paires de bots.
- `packages/sim/src/moteur.test.ts`: bloc « durcissement des entrées », 6 tests.
- `packages/sim/src/capture.test.ts`: 2 tests sur X20 et X30.
- `packages/sim/src/__snapshots__/partie.test.ts.snap`: régénéré, voir plus haut.
- `vitest.config.ts`: `entrees.ts` exclu de la couverture, comme `geometrie.ts`.
- `CLAUDE.md`: comportement à préserver numéro 11, la contagion des couleurs entre bots.
- `docs/audit/AUDIT-EXISTANT.md`: X30 ajouté, X20 tranché et mesuré, tableau du statut des failles S1 à S5.
- `docs/design/README.md`: six décisions du 14 août 2026.
- `docs/plan/etape-1-6.md`: section « Réconciliation ».

Aucune modification de `legacy/`, ni de `tests/caracterisation/`.

## Tests

- Ajoutés: 55 tests. 39 dans `validation.test.ts`, 11 dans `debit.test.ts`, 6 dans `moteur.test.ts`, 2 dans `capture.test.ts`. Ils couvrent les six tests requis par la fiche, plus le refus d'un débit excessif demandé par ROADMAP.md.
- Résultat: **551 tests Vitest passent, 0 échec** (496 au handoff 1.5).
- Couverture: **99,73 pour cent** des instructions et 99,35 pour cent des branches sur `packages/sim` et `packages/shared` réunis, contre 99,62 et 99,15 au handoff 1.5. Elle monte. `validation.ts` et `debit.ts` sont à 100 pour cent.
- Lignes non couvertes, inchangées depuis 1.5 et toutes défensives: deux dans `bots.ts`, deux dans `couleurs.ts`.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.
- CI: verte au dernier `pnpm verify`.

## Décisions et écarts au plan

Les écarts à la fiche sont dans sa section « Réconciliation ». Les décisions de fond sont au journal de `docs/design/README.md`, datées du 14 août 2026. En résumé:

1. **Le contrat d'entrée vit dans `packages/shared`, pas dans le moteur.** Trois couches doivent en parler: le client qui l'émet, la couche réseau qui le valide, le moteur qui le consomme. `EntreeJoueur` reste le nom local du moteur, et rien de l'existant n'a eu à bouger.

2. **Le moteur se défend lui-même, en plus de la couche réseau.** Deux raisons. Une coordonnée `NaN` ne lève aucune exception: elle se propage à la position, aux distances, aux contacts, et corrompt une partie entière en silence. Et le moteur ne connaît pas ses appelants: un test, un rejeu, un futur mode spectateur ne passeront pas forcément par la validation réseau.

3. **`Math.hypot` plutôt que la racine de la somme des carrés.** Un vecteur de coordonnées énormes donnait une norme infinie, donc un pas ramené à zéro: un client aurait immobilisé son propre joueur en envoyant un vecteur absurde. Détail, mais gratuit à corriger.

4. **Le seau à jetons est écrit ici, pas en 2.2.** La fiche demandait des données seules, ROADMAP.md demandait un test sur le refus d'un débit excessif. Les deux se concilient en écrivant la fonction pure maintenant et en la branchant plus tard.

5. **Le facteur mobile n'est pas porté**, décision définitive. Le moteur avançant proportionnellement au temps écoulé, tous les appareils sont déjà à la même vitesse.

6. **La longueur du vecteur reçu n'est pas validée**, volontairement. Elle n'a aucune importance: le moteur ne lit que l'orientation. La valider aurait donné l'impression fausse qu'elle compte.

7. **Deux défauts hors périmètre corrigés (règle 7).** X20, tranché par le porteur du projet en début de session. X30, découvert en lisant `resoudreUnContact`: une régression du portage, pas un défaut du legacy. La même règle les corrige tous les deux.

## Ce que la prochaine étape doit savoir

- **L'étape 2.2 appelle les schémas de validation à la frontière, avant de toucher à quoi que ce soit.** Rien dans le moteur ne les appelle: il se défend autrement.
- **L'étape 2.2 tient les seaux à jetons**, un par joueur et par type d'entrée, et leur passe le temps écoulé depuis le message précédent.
- **L'étape 2.1 range la dernière intention connue de chaque joueur** et la passe au battement suivant. Recevoir dix messages entre deux battements ne doit produire qu'une entrée dans la table.
- **L'unicité du pseudo n'est pas traitée ici.** C'est une propriété d'un salon, pas d'une chaîne de caractères: elle appartient à l'étape 2.1.
- **L'étape 4.3 échappe tout texte venu d'un joueur à l'affichage**, sans exception, en plus de la validation faite ici.

## Problèmes connus et dette

- **Aucune question de gameplay ne reste ouverte.** X20 était la dernière, elle est tranchée. C'est la première fois depuis l'étape 1.3.
- **La faille S5 de l'audit reste ouverte**, mais sans objet pour le nouveau code: ce sont les douze vulnérabilités des dépendances du legacy, qu'aucun paquet du monorepo ne reprend. À revérifier quand `packages/server` aura ses dépendances réelles, à l'étape 2.1.
- **Les bornes des six réglages sans équivalent dans le salon du legacy sont des choix, pas des mesures.** Zones et bots noirs, hors leur nombre. Elles sont larges à dessein. À confronter à l'écran de réglages de l'étape 4.3.
- **Aucune optimisation spatiale**, inchangé depuis 1.3. Le relevé des contacts reste le premier poste de coût. Grille spatiale à l'étape 5.2, conditionnée à la mesure de 5.1.
- **Le contrôle de blocage des bots échantillonne**, inchangé depuis 1.5: il dépend du découpage du temps. À garder en tête si l'étape 2.1 rend le pas de temps variable.
- **`packages/server` et `packages/client` restent vides.** Normal jusqu'à l'étape 2.1.
- **`tsc --build` peut laisser une compilation périmée.** Inchangé depuis 1.1. `tsc --build --force` corrige. Sans conséquence sur les tests, qui lisent les sources.
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 à 1.5.

## Prochaine action exacte

Dans une conversation neuve: lire `docs/plan/etape-2-1.md`, puis créer `packages/server/src/GameRoom.ts` qui encapsule un `EtatPartie` et sa boucle de battement, en injectant le temps depuis l'extérieur. Point de départ concret: une room créée n'a aucun bot, c'est son lancement qui appelle `peuplerDeBots` (voir le handoff 1.5).

Trois points à avoir en tête dès le début de l'étape 2.1:

1. **La phase 1 est close.** Tout le gameplay est porté, testé et durci. `packages/sim` ne devrait plus bouger que pour des raisons venues du réseau, jamais pour du gameplay.
2. **La room range une intention par joueur, pas une file de messages.** C'est ce qui fait que la vitesse ne dépend pas du débit.
3. **La room porte le terrain**, chargé hors du moteur depuis l'image de collision de la carte. `creerEtatInitial` refuse un terrain aux mauvaises dimensions.

## Étape suivante

Fiche à lire: `docs/plan/etape-2-1.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 2.1 suit bien 1.6.
