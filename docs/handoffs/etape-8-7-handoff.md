# Handoff - Étape 8.7 Les scénarios Tactique au pouce

Date: 25 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Que les deux scénarios de `tests/e2e/tactique.spec.ts` passent à coup sûr dans le cadrage téléphone de la CI, sans relance, en corrigeant la cause.

## Ce qui a été fait

- **La cause, lue dans la trace de la CI** (run `36137763523`, commit `66b49ca`, première tentative) et **reproduite en local en limitant le jeu à deux processeurs** (`taskset -c 0,1`), deux échecs sur deux. Sans carte graphique, la page du téléphone dessine environ trois images par seconde. Chaque contact tactile envoyé par le protocole de Chromium attend alors près d'une seconde, et `locator.tap()` environ cinq. Le tir partait six secondes après que le pilote avait vu un faux ninja dans le cône, et le faux ninja (150 px/s) en était sorti. Tous les tirs manquaient jusqu'à la fin de la partie.
- **La description du ROADMAP était une mauvaise lecture**: le « ninja immobile au pixel près » du message d'échec était la dernière tentative de `toPass`, jouée après la fin de la partie (écran de fin). Corrigée au ROADMAP.
- **Le second doigt**: le tir part d'un appui posé directement par le protocole, au centre du bouton, pouce tenu, sans `locator.tap()`.
- **L'affût**: le joueur lève le pouce dès qu'une cible en ligne droite, devant lui, est à mi-portée de l'arme plus sa glissade après le lever (mesurée à chaque arrêt), pour s'arrêter face à elle. Il guette quatre secondes. Il ne frappe que si un faux ninja **sera** dans son arme à l'arrivée du coup, prévu dans l'état du serveur (pause restante, cap). Le délai du coup est mesuré sur le coup précédent.
- **Les bonus atteignables**: la mission de ramassage ne vise que les bonus dont la vie restante couvre le trajet.
- **La ruée se compte depuis la réception de la direction**, et non d'avant son envoi.
- **Le scénario Massacre au pouce**, même défaut en latence (échec une fois sur deux à deux processeurs), reçoit la même correction, et une partie de 150 secondes au lieu de 120: son katana ne porte qu'à 60 pixels, moins que l'incertitude de la glissade, et une prise sur cinq demandait près de cent secondes.
- **Un piège du protocole de Chromium, vérifié sur une page nue**: un doigt absent d'un glissement n'est pas levé. Seule une fin (`touchEnd`) qui le cite le lève. Documenté dans `commandes.ts`.

Le jeu ne change pas: rien dans `packages/`.

## Fichiers créés ou modifiés

- `tests/e2e/harnais/commandes.ts`: identifiants des doigts, `appuiSur` (second doigt), note sur la levée des doigts.
- `tests/e2e/harnais/pilote.ts`: l'affût (`Mission.affut`), la glissade mesurée, le lever anticipé et la ruée courte d'un joueur qui guette, la ruée comptée après réception.
- `tests/e2e/harnais/parcours.ts`: `prendreUnFauxNinjaDUnCoup` remplace `approcherUnFauxNinja`; la prévision `unFauxNinjaDansLArmeAuCoup`; `ramasserUnBonusTactique` filtre par `tempsPourAtteindreMs`.
- `tests/e2e/tactique.spec.ts`: tir à l'affût, charge dépensée vérifiée au moment de la prise (Rafale et Recharge rapide coupées pour cela), délais bornés par la partie (75 s).
- `tests/e2e/massacre.spec.ts`: la même mission, partie de 150 s, délai borné par la partie (130 s).
- `docs/plan/etape-8-7.md` (créée), `docs/plan/ROADMAP.md` (entrée de clôture, entrée thématique corrigée), ce handoff.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/`.

## Tests

- Ajoutés: aucun test nouveau; trois scénarios de bout en bout réécrits. « Toucher ne capture pas » y est vérifié plus fort: le pilote touche des faux ninjas en chemin, et le premier faux ninja compté à Alice doit lui avoir coûté une charge.
- **À deux processeurs, en local** (plus lent que la CI: 2 images par seconde contre 3):
  - tir Tactique: 0 sur 2 avant l'étape, 9 sur 9 sur la version finale;
  - ramassage Tactique: 2 sur 4 avant le filtre des bonus, 12 sur 12 après;
  - Massacre: 1 sur 2 avant l'étape, 9 sur 9 sur la version finale.
  - Les essais intermédiaires, et leurs taux, sont à la section « Réconciliation » de la fiche.
- **Sur bureau, au clavier**, sans limite: Tactique et Massacre 6 sur 6.
- **Suite de bout en bout complète en local**: 52 scénarios de jeu sur 52, bureau et mobile. Les 3 scénarios du banc échouaient sur une ressource introuvable avec le Chromium complet de la machine, qui demande `favicon.ico`, et passent 3 sur 3 avec le Chromium sans interface qu'utilise la CI. C'est un artefact de l'outil local, pas un défaut.
- `pnpm verify`: 2 556 tests unitaires au vert, 68 sautés (base Neon absente en local), types, linter et formatage verts.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI, sur la branche `claude/etape-8-7-lfnf5y`: **verte**. Quatre passages complets de bout en bout sur quatre versions successives de la correction, 55 scénarios sur 55 chacun, **aucune relance consommée**: runs `36186063392` (`97ce36c`), `36191977417` (`db8a275`), `36193847198` (`ca8d809`) et `36196876234` (`59c5290`, le code final). Pas de mise en ligne: la branche n'est pas `master`.

## Décisions et écarts au plan

1. **Écart de branche**: la session travaillait sur la branche imposée `claude/etape-8-7-lfnf5y`, et non directement sur `master` comme le veut le PROTOCOLE. Le travail n'est pas encore sur `master`. Il ne touche que des scénarios et de la documentation, et ne déclenche donc aucune mise en ligne.
2. Plusieurs essais avant la version finale, consignés dans la section « Réconciliation » de la fiche: tirer en courant (un tir sur quatre), un affût qui n'attendait que des cibles immobiles, une marge de visée appliquée aux faux ninjas en pause, une ruée qui traversait la cible, un arrêt décidé trop tard.
3. **La partie du Massacre allongée** (réconciliation, point 8): de la marge, pas un masque. La cause est corrigée, mais s'arrêter à portée d'un katana tient encore de la chance sur une page à deux images par seconde.
4. Le second scénario échouait pour une autre raison que le premier (bonus lointains qui disparaissent), découverte en cours d'étape et corrigée (décision 7 de la fiche).

## Problèmes connus et dette

- **Fusion dans `master`** à faire (point 1 ci-dessus).
- Le pilote lit l'état du serveur pour prévoir un faux ninja (pause, cap). C'est le rôle d'arbitre qu'il avait déjà. Si le moteur change la façon dont un faux ninja erre, l'affût devra suivre.
- Le Massacre au pouce reste le plus lent des trois (prise en 10 à 100 secondes à deux processeurs). S'il redevenait instable, la piste est de viser les faux ninjas en pause qui durent, plutôt que d'allonger encore la partie.
- Pour rejouer ces scénarios dans un conteneur de Claude Code sur le web: le Chromium préinstallé n'est pas celui qu'attend Playwright 1.62. Il faut passer `executablePath` (`/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, le même type de Chromium que la CI). Le Chromium complet demande `favicon.ico` et fait échouer le banc. Pour imiter la machine de CI, limiter le jeu à deux processeurs: `taskset -c 0,1`.

## Prochaine action exacte

**Au porteur du projet**: fusionner la branche `claude/etape-8-7-lfnf5y` dans `master`. Aucune étape planifiée ne reste ouverte à la section 3 du ROADMAP. La suite se décide avec le porteur du projet, par exemple après la recette de l'Évadé et du HUD (handoff 7.9).

## Étape suivante

Fiche à lire: aucune fiche planifiée. Lire la section 3 de `docs/plan/ROADMAP.md` et la décision du porteur du projet.
