# Handoff - Étape 7.22 Among Ninjas, les sabotages (partiel)

Date: 10 octobre 2026
Auteur: session Claude Code
Statut: en cours, interrompue par la limite d'usage. Rien n'est poussé.

## Fait

- Fiche `docs/plan/etape-7-22.md`: règles, réponses du porteur du projet (carte, commandes inversées sur les proies seulement, surchauffe qui fait gagner les assassins, tout sous la 1.9.0), retours d'essai, rendus choisis (1A, 2C, 3B, 4A, 5A, 6A, 7C). Planche `docs/design/etape-7-22/1-planche.png`.
- Retours d'essai corrigés (`30b7c8d`): tâches toutes différentes dans une liste (7 par proie au plus), lettres de déplacement dans le chat, carte et repère bloqués hors de la phase de jeu.
- Lots A et B (`5ac10dd`): sabotages et malédiction dans le moteur et le serveur, testés, empreinte des parties de référence identique, couverture de sim 99,84. Puis la recharge de la malédiction remonte à 15 s au début de chaque tour (remplace le test du temps du tour, même effet).
- Lot C, commit « lot C en cours »: annonces, sons provisoires, panneau des sabotages et des malédictions dans la carte (choix de la station du nuage), alerte de panne et de surchauffe dans le HUD, geste « Réparer », gong retenu pendant la surchauffe, boîtier et consoles en néon, volutes du nuage, disque et voile de la panne, flèches vers les postes, exécution au katana (7C), fin par la surchauffe, aide. Compile; les 1 599 tests existants de la page passent.

## Reste à faire

1. **Tests de la page du lot C** (pas encore écrits): `hud/among` (alerte, geste réparer, gong, panneau, postes de la mini-carte), `rendu/among` (vision et voile en panne, postes, nuage selon le rôle, flèches), annonces et sons des sabotages, composant de la carte (boutons, nuage puis station), surcouche (alerte), fin (surchauffe), exécution.
2. Vérifier dans le navigateur, bureau et téléphone en portrait: panneau, alerte, flèches, nuage, exécution; captures dans `docs/design/etape-7-22/`.
3. Lot D: scénario de bout en bout (un assassin sabote les néons depuis la carte, une proie répare), `tests/e2e/among.spec.ts` lit encore `.among-egout-texte` (garde ce nom); banc (section 31 de `docs/mesures/charge-serveur.md`); note de la 1.9.0 complétée; journal, ROADMAP, étude (section 23); section « Réconciliation » de la fiche.
4. Écarts à consigner: « Un fantôme vous maudit » (vouvoiement du jeu, la planche disait « te »); son du nuage seulement chez assassins et fantômes; alarme de surchauffe jouée une fois, pas en boucle; flèches posées autour du joueur à 185 px plutôt qu'au bord exact de l'écran.

## Prochaine action exacte

Reprendre l'étape 7.22 au point 1 ci-dessus, sans pousser `master`.
