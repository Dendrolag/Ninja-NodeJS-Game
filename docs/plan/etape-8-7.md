# Fiche étape 8.7 - Les scénarios Tactique au pouce

Brief de session. Objectif unique: **que les deux scénarios de `tests/e2e/tactique.spec.ts` passent à coup sûr dans le cadrage téléphone de la CI**, sans relance, en corrigeant la cause et non en élargissant les délais.

## Origine de cette fiche

Planifiée le 25 septembre 2026 au titre de la règle 7 (section 3 du ROADMAP). Rédigée au début de l'étape selon le cas de repli du PROTOCOLE, à partir de l'entrée du ROADMAP, du rapport Playwright de la CI (run `36137763523`, commit `66b49ca`, première tentative) et de l'état du dépôt au commit `3803152`, avec la fiche 8.6 prise comme modèle.

## Ce qu'on croyait en entrant, et ce qui est faux

L'entrée du ROADMAP dit: « le ninja piloté au pouce reste immobile, position identique au pixel près pendant deux secondes ». **C'est une mauvaise lecture du message d'échec.** Les trois échecs du premier scénario montrent, sous la position figée, `ecran fin`: la tentative citée par le message est la dernière, jouée **après la fin de la partie** de 90 secondes, quand plus personne ne bouge. Le message de `toPass` ne garde que la dernière erreur; les tentatives précédentes, pendant la partie, sont dans la trace.

## Ce que disent la trace de la CI et la reproduction

1. **La page du téléphone dessine environ trois images par seconde en CI** (Pixel 7 émulé, canevas à densité 2, rendu logiciel sans carte graphique): 15 images de la trace toutes les 5 secondes pendant la partie, et « 6 images en 2 s » dans l'échec du second scénario. C'est vrai dans tous les modes, pas seulement en Tactique (mesure locale: 4 à 4,5 images par seconde en Horde, en Tactique et en Massacre, sur quatre processeurs).
2. **Chaque contact envoyé par le protocole de Chromium attend que la page l'ait traité**, donc une ou deux images: environ **1 seconde** par contact en CI. Le pilote, qui voulait corriger sa direction toutes les 100 ms, ne le fait plus qu'une fois par seconde.
3. **`locator.tap()` sur le bouton Capturer prend environ 5 secondes en CI** (4,8 à 6,4 s dans la trace): Playwright attend que le bouton soit stable sur deux images, puis envoie deux contacts.
4. **Le tir part donc environ 6 secondes après que le pilote a vu un faux ninja dans le cône**: une seconde pour lever le pouce, cinq pour le tap. Un faux ninja va à 150 pixels par seconde depuis l'étape 7.5, et marche une à trois secondes d'affilée; le cône porte à 100 pixels. **Le tir manque presque toujours**: dans la trace, trois approches réussies, trois tirs sans effet, puis la partie se termine.
5. **Reproduit en local en limitant le jeu à deux processeurs** (`taskset -c 0,1`, la machine de CI en a deux): 2 images par seconde, 1,1 s par contact, 4,6 s par tap, et **deux échecs sur deux** du premier scénario, avec la même signature que la CI. Sans limite, il passe: c'est pourquoi il n'avait jamais été reproduit.
6. **Le second scénario** (ramasser un bonus) souffre de la même lenteur par un autre chemin: la ruée du pilote, qui doit durer le temps de parcourir la distance, se compte depuis l'instant d'avant l'envoi de la direction. Quand cet envoi prend deux secondes (poser le pouce, puis le glisser), la ruée est déjà finie quand elle commence.

## Décisions prises par cette fiche

1. **Le jeu ne change pas.** Sur un vrai téléphone, le dessin est fluide (audit 8.5); la lenteur est celle d'un navigateur sans carte graphique. Tout se corrige dans le harnais des scénarios.
2. **Le tir part d'un second doigt, posé directement par le protocole de Chromium**, au centre du bouton, et non par `locator.tap()`. Le pouce reste sur la manette pendant ce temps, comme un joueur qui court du pouce gauche et tire du pouce droit: la manette doit ignorer ce second doigt, et le scénario le vérifie de fait. Un bouton couvert par autre chose ne recevrait pas le contact, et le scénario échouerait: la vérification que faisait `tap()` reste.
3. **Le joueur tire à l'arrêt, à l'affût, et seulement quand le coup touchera.** Le pilote lève le pouce dès qu'un faux ninja en ligne droite, devant le joueur, est à mi-portée de l'arme plus la glissade du joueur après le lever (mesurée à chaque arrêt), pour s'arrêter face à lui. Puis il guette quatre secondes avant de repartir. Pendant ce temps, il ne frappe que si un faux ninja **sera** dans son arme au moment où le coup arrivera au serveur. Cette prévision se lit dans l'état du serveur: un faux ninja en pause reste en place tant que sa pause dure, un faux ninja en marche suit son cap tant qu'il n'en change pas. Un faux ninja en pause se vise dans toute l'arme, un faux ninja en marche dans les trois quarts. Le délai du coup se mesure sur le coup précédent. La mission s'achève quand le serveur compte sa prise à Alice. Un coup dans le vide ne coûte rien. Voir « Réconciliation » ci-dessous pour les deux essais qui ont mené là.
4. **« Toucher ne capture pas » se vérifie plus fort qu'avant**: le pilote frôle et touche des faux ninjas en chemin, et au moment où le serveur compte le premier faux ninja d'Alice, une charge doit avoir été dépensée. Une capture au contact, sans tir, ferait échouer le scénario.
5. **La ruée se compte depuis l'instant où la page a reçu la direction**, pas depuis l'instant d'avant l'envoi.
6. **Le scénario Massacre au pouce porte le même défaut** (approche, lever du pouce, puis `tap()`), en latence: il passe parce que ses 120 secondes laissent plus d'essais. Il reçoit la même correction (règle 7).
7. **Le second scénario ne vise que les bonus atteignables avant leur disparition.** Un objet vit huit secondes et apparaît n'importe où. Le serveur donne à chaque objet sa vie restante: la mission ne garde que ceux dont elle couvre le trajet (distance allongée de moitié pour les détours, plus deux secondes de retard de la page). Sans bonus atteignable, le joueur attend le suivant sur place.
8. **Les scénarios Tactique et Massacre dessinent à densité de pixels un.** Le Pixel 7 émulé dessine à densité deux, quatre fois plus de pixels, sans carte graphique en CI. Mesuré à deux processeurs: 2 images par seconde à densité deux, 8,5 à densité un; un contact tactile en 1,15 s contre 0,25 s. Ces scénarios vérifient le pouce, le bouton et les règles. Le rendu à densité deux reste exercé par les autres scénarios du cadrage téléphone et par le banc. Décision prise en fin d'étape, voir réconciliation point 9.
9. **Le premier coup mesure le délai au lieu de le supposer**: il part dès qu'un faux ninja est dans l'arme, sans prévision.

## Périmètre

- `tests/e2e/harnais/commandes.ts`: le second doigt du pouce, et le tir au clavier.
- `tests/e2e/harnais/pilote.ts`: l'affût, et la durée de la ruée.
- `tests/e2e/harnais/parcours.ts`: la mission « prendre un faux ninja d'un coup d'arme », et les bonus atteignables de la mission de ramassage.
- `tests/e2e/tactique.spec.ts`, `tests/e2e/massacre.spec.ts` (densité un, décision 8; partie Massacre de 150 secondes, réconciliation point 8).
- La documentation: le ROADMAP (l'entrée 8.7 corrigée), le handoff.

## Hors périmètre

- Toute règle de jeu, `packages/sim`, `packages/client`, `packages/server`.
- La cadence de dessin de la page sans carte graphique: elle mesure la machine de CI, pas le jeu.
- Les autres scénarios au pouce (`parcours-solo`, `multijoueur`), qui capturent au contact et ne tirent pas.

## Tests requis

- Les deux scénarios Tactique et le scénario Massacre, dans les deux cadrages, passent en local sans relance.
- Les mêmes, **en local limités à deux processeurs**, là où le premier scénario échouait deux fois sur deux: plusieurs passages sans échec.
- En CI: plusieurs exécutions complètes du bout en bout, sans aucune relance consommée sur ces scénarios.

## Définition de terminé

1. La cause est écrite, chiffres de la trace à l'appui.
2. Les scénarios Tactique et Massacre au pouce passent sans relance en local limité à deux processeurs et en CI, sur plusieurs passages.
3. L'entrée du ROADMAP qui décrivait un ninja immobile est corrigée.

## Réconciliation

Écarts entre le plan de départ de cette fiche et ce qui a été fait, découverts en exécutant.

1. **Tirer en courant ne suffisait pas.** Premier essai: le second doigt tirait à chaque instant où un faux ninja était dans le cône, en route. Mesuré à deux processeurs, un tir arrive au serveur 1,3 à 1,7 s après la décision, et Alice a parcouru 200 pixels entre-temps, souvent en changeant de direction: un tir sur quatre touchait, et 4 scénarios sur 9 échouaient encore. D'où l'affût, à l'arrêt, avec une prévision (décision 3).
2. **Un doigt absent d'un glissement n'est pas levé.** Le premier essai levait le second doigt par un glissement qui ne citait plus que le pouce. Chromium le gardait posé, et chaque tir suivant restait sans effet jusqu'au prochain lever du pouce: sept tirs sur onze, dans un passage relevé. Vérifié sur une page nue: une fin (`touchEnd`) lève exactement les doigts qu'elle cite. Corrigé dans `commandes.ts`.
3. **Un affût qui n'attendait que des cibles immobiles n'avait presque jamais lieu**: le pilote ne s'arrêtait que devant une cible restée en place entre deux lectures, une fois en 75 secondes. Une mission qui guette s'arrête désormais devant toute cible en vue, puisque l'affût prévoit le mouvement.
4. **La marge de visée étouffait l'affût.** Réduite à 75 % pour toutes les cibles, l'arme du Tactique (90 degrés, 100 pixels) ne laissait presque aucun tir: deux échecs sur trois. Pour un faux ninja en pause, rien ne bouge pendant le coup: il se vise dans toute l'arme.
5. **La ruée traversait la cible**, et laissait le joueur dos à elle à l'arrêt suivant: un échec sur quatre restait. D'où l'arrêt à mi-portée, glissade comprise (décision 3).
6. **Le second scénario échouait pour une autre raison que le premier**: la poursuite de bonus lointains qui disparaissaient avant l'arrivée (trace du pilote: la cible visée passait de 170 à 800 pixels à chaque disparition). Deux échecs sur quatre à deux processeurs. D'où la décision 7, ajoutée en cours d'étape.
7. **Attendre d'avoir la cible en vue pour lever le pouce la faisait dépasser.** À deux images par seconde, le joueur glisse de 100 à 150 pixels après le lever, plus que les 80 pixels de la visée du pilote: un scénario Massacre a tourné cent secondes autour d'un faux ninja à 15 pixels. D'où le lever anticipé, pour une cible devant le joueur seulement (décision 3).
8. **Le Massacre reçoit de la marge.** Le katana ne porte qu'à 60 pixels, moins que l'incertitude de la glissade à deux images par seconde: une prise sur cinq a demandé près de cent secondes à deux processeurs. La partie du scénario passe de 120 à 150 secondes, la prise à 130 au plus. Le scénario s'arrête à la prise, la marge ne coûte rien.
9. **L'affût seul ne suffisait pas en CI.** Sur le code jugé final (`59c5290`), une CI a été propre (run `36196876234`), la suivante sur le même code a consommé deux relances, tir Tactique et Massacre (run `36198863704`). La page de la CI, à 3 images par seconde, laissait encore trop de place au hasard. D'où la densité un (décision 8), qui rend la page quatre fois plus rapide.
10. **La durée d'un coup était supposée à deux secondes avant le premier.** À densité un, où le geste dure une demi-seconde, cette supposition retenait presque tous les coups: dans un Massacre relevé, trente lectures d'affût avec un faux ninja dans l'arc, aucun coup. D'où la décision 9. Avec les décisions 8 et 9, à deux processeurs: 15 sur 15, prise du Massacre en 16 à 28 secondes le plus souvent (66 au pire), tir Tactique en 14 à 32.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-7-handoff.md`, commiter, pousser, vérifier la CI. La prochaine étape se lit à la section 3 du ROADMAP.
