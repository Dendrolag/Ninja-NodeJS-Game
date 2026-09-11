# Fiche étape 5.2 - Optimisations validées par la mesure

Brief de session. Objectif unique: appliquer les optimisations utiles, et seulement celles que les mesures de l'étape 5.1 justifient. Cette fiche pose la méthode et les candidates, pas une liste d'optimisations décidées d'avance. Optimiser sans avoir mesuré serait une erreur.

## Rituel de début de session

Lire CLAUDE.md, le handoff et le rapport de mesures de l'étape 5.1 (où le serveur sature en premier), puis cette fiche.

## Méthode (non négociable)

Pour chaque optimisation envisagée: partir d'un point chaud identifié par la mesure, appliquer le changement, mesurer à nouveau dans les mêmes conditions, et ne conserver que si le gain est réel. À chaque fois, les tests unitaires du moteur restent au vert, pour prouver que le comportement n'a pas changé. Une optimisation qui modifie le comportement de jeu est rejetée.

## Candidates (à activer selon la mesure, pas par défaut)

1. Partitionnement spatial: si la détection de collisions et de capture sature avec le nombre d'entités, introduire une grille spatiale en phase large. L'envelopper autour de CollisionMap de sorte que les fonctions existantes l'utilisent et renvoient un résultat identique. Aucun changement de gameplay.
2. Niveau de détail d'IA: si le calcul des bots sature, faire tourner une IA plus simple ou moins fréquente pour les bots éloignés de tout joueur. Vérifier que le comportement observable reste acceptable.
3. Points chauds résiduels: retirer tout journal synchrone restant dans les chemins exécutés à chaque tick, et toute allocation inutile par tick repérée par le profilage.
4. Diffusion: si la bande passante sature et que la carte est plus grande que la zone visible, envisager un filtrage par zone d'intérêt. Sans intérêt si toutes les entités sont visibles à l'écran.

## Apport de la mesure de l'étape 5.1 (11 septembre 2026)

Rapport complet: `docs/mesures/charge-serveur.md`. Harnais: `pnpm charge`, qui rejoue les mêmes conditions pour la comparaison avant après. Quatre points chauds mesurés, dans l'ordre où ils limitent le serveur.

1. **La cadence du serveur décroche avant que son fil soit plein.** Parties pleines de 150 bots: 16 tiennent, 24 non (18,0 battements par seconde), avec un fil occupé à 73 pour cent seulement; à un seul joueur par partie, 24 décrochent déjà à 62 pour cent. Écartés par la mesure: le ramasse-miettes (2,3 pour cent du temps, pauses de 6,5 ms au plus), la bande passante seule (67 Mbit/s à un joueur par partie), les minuteries seules (un test isolé de 24 à 32 boucles de 50 ms, avec ou sans à-coups de 10 à 20 ms, tient 19,7 Hz jusqu'à 84 pour cent). Piste restante: ce que le serveur fait entre ses battements, recevoir les intentions et écrire les instantanés sur des centaines de connexions. Levier candidat, à valider sur le vrai serveur: une programmation des battements qui vise l'heure prévue au lieu de repartir de l'heure réelle (20,00 Hz dans le test isolé, contre 19,7 pour `setInterval`). **Mesuré sous Windows: remesurer sous Linux avant toute conclusion**, la production y tournant. Valeurs de comparaison: section 7 du rapport.
2. **Une partie plus peuplée que les précédentes coûte 2,6 à 3,6 fois plus cher** dans le même processus, à travail identique. Un vrai serveur y est exposé en permanence (parties à 50 et 150 bots). Probablement un code devenu polymorphe sur la forme des objets (tables de bots indexées par identifiant, recopiées à chaque battement): à diagnostiquer avec les outils de V8 avant d'y toucher.
3. **Le moteur croît presque comme le carré du nombre d'entités** (puissance 1,8; relevé des contacts par paires, `detecterContacts`). Sans enjeu dans les bornes actuelles (0,8 ms à 150 bots); c'est la candidate « partitionnement spatial », à ne retenir que si les bornes du salon doivent monter.
4. **La diffusion à douze joueurs ajoute une dizaine de points d'occupation du fil.** Le poids du flux (21,5 Ko par instantané) relève de l'étape 2.3, justifiée et placée après celle-ci.

La candidate « niveau de détail d'IA » n'est pas désignée par la mesure: les bots (`avancerLesBots`) pèsent peu dans le profil, loin derrière le relevé des contacts.

## Résultat de l'étape (12 septembre 2026)

Rapport: section 11 de `docs/mesures/charge-serveur.md`. Trois optimisations retenues, aucune écartée faute de gain, et aucun changement de jeu (empreinte des parties identique, tests du moteur au vert).

| Optimisation                                             | Point chaud                          | Gain mesuré                                                            |
| -------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| La table des bots copiée une fois par battement          | populations mêlées (point 2)         | banc à 150 bots: 0,772 à 0,670 ms; populations mêlées: × 2,70 à × 1,01 |
| Relevé des contacts sans tableau par entité, tri par axe | moteur en carré (point 3)            | banc à 150 bots: 0,670 à 0,441 ms; à 1000 bots: 16,9 à 7,6 ms          |
| La boucle d'une partie vise l'heure prévue               | cadence avant un fil plein (point 1) | 48 parties pleines: 19,4 à 19,9 Hz; 64 parties mêlées: 19,3 à 20,0 Hz  |

Ensemble: un processus tient 48 parties pleines au lieu de 16, et 64 mêlées au lieu de 24; une partie pleine coûte 0,95 ms sur le vrai serveur au lieu de 1,92. Confirmé sous Linux. Seuils mis à jour: section 11.11 du rapport.

### Réconciliation

1. **Les deux premiers points chauds avaient une cause commune possible, elles étaient distinctes.** Les populations mêlées venaient de `avancerLesBots` (la table recopiée pour chaque bot), et la perte de cadence de `setInterval`. La remarque ci-dessus sur le niveau de détail d'IA reste juste sur le fond, mais `avancerLesBots` pesait bien dans le profil du serveur (8,4 pour cent): par sa recopie, pas par l'intelligence des bots.
2. **Les deux optimisations du moteur relèvent de la candidate 3** (allocations inutiles par battement repérées au profileur), pas de la candidate 1: le relevé des contacts reste en carré, sans grille.
3. **Le coût du client a été mesuré ici**, bien que cette fiche ne le cite pas: le handoff de 5.1 et la section 3.4 du rapport le confiaient à 5.2. Aucune optimisation n'est justifiée (section 11.9 du rapport).
4. **La mesure sous Linux passe par une machine d'intégration**, faute de WSL et de Docker sur la machine de mesure. GitHub n'acceptant le lancement manuel que pour un workflow présent sur `master`, le workflow `charge.yml` se lance en poussant une branche `mesure-charge/`.
5. **Un outil d'empreinte des parties a été ajouté** (`tests/charge/empreinte.ts`), pour prouver en bloc, en plus des tests du moteur, qu'une optimisation ne change rien au jeu.
6. **Le filtrage par zone d'intérêt (candidate 4)** est reporté à la fin de l'étape 2.3, dont le format de flux décide du gain.
7. **Les seuils vérifiés en CI ne changent pas**: la taille des messages est inchangée à l'octet.

## Hors périmètre

- Aucune optimisation non justifiée par une mesure.
- Aucune réécriture de la logique de jeu. Les optimisations enveloppent ou allègent, elles ne changent pas les règles.

## Tests requis

- Pour chaque optimisation retenue, une comparaison avant après chiffrée, dans les mêmes conditions que l'étape 5.1.
- Les tests unitaires du moteur restent au vert après chaque optimisation.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les optimisations retenues sont justifiées par une mesure et documentées avec leur gain.
2. Aucune régression de comportement, tests du moteur au vert.
3. Les seuils de référence sont mis à jour.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-2-handoff.md. Lister les optimisations retenues, leur gain mesuré, et celles écartées faute de gain. Mettre à jour `docs/mesures/charge-serveur.md` avec la mesure d'après, datée. Prochaine action exacte: l'étape 2.3, delta binaire, que la mesure de 5.1 a justifiée et que la section 3 du ROADMAP place juste après celle-ci. Commiter.
