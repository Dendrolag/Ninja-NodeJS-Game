# Fiche étape 5.4 - Recette fonctionnelle

Brief de session. Objectif unique : vérifier en jouant, écran par écran et règle par règle, que tout ce que la réécriture a construit fonctionne comme prévu, et comme le jeu d'origine là où il fait foi ; corriger ce qui ne va pas.

## Origine de l'étape

Ajoutée le 14 septembre 2026, à la fin de l'étape 5.3, à la demande du porteur du projet. Il a cru voir des manques ou des défauts, dont **l'attribution aléatoire des couleurs, qui ne fonctionnerait pas**. Les tests automatiques couvrent le moteur, le serveur et les parcours principaux, mais aucune étape n'a déroulé une recette complète du jeu tel qu'un joueur le vit. Elle se place avant 6.1 : on ne retire pas la version d'origine sans avoir vérifié que la nouvelle la remplace.

## Réconciliation du 14 septembre 2026

- **L'hypothèse de départ était fausse, le défaut réel plus large.** L'attribution aléatoire des couleurs fonctionnait : tirage dans la palette du legacy, graine propre à chaque partie. C'est leur affichage qui était faux : le sprite du ninja est rouge, et le rendu le teintait en entier. Tout le monde paraissait rouge ou noir, et plus aucune capture ne se voyait.
- **La recette et les corrections n'ont pas eu à être coupées en deux étapes.** Les défauts se sont corrigés au fil de la grille, chacun avec son test.
- **Deux manques connus sont devenus des étapes** (2.5 et 3.4 du ROADMAP), les autres ont été traités ici.

## Rituel de début de session

Lire CLAUDE.md (dont « Comportements à préserver »), le handoff de l'étape 5.3, cette fiche, puis `docs/design/cadrage.md` (sections 3 et 4 : écrans et contrat de réglages) et `docs/deploiement.md`.

## Références

- **Le jeu d'origine**, là où il fait foi sur le gameplay : `legacy/` (v0.8.6), les tests de `tests/caracterisation/`, et la section « Comportements à préserver » de CLAUDE.md. Il tourne encore en ligne sur https://to-the-point.onrender.com (service Render « To The Point », branche `master`, déployé le 9 avril 2025) : vérifier que ce déploiement correspond bien à la v0.8.6 avant de s'en servir de référence.
- **Les écarts voulus**, qui ne sont pas des défauts : le journal de `docs/design/README.md`, les défauts de l'audit corrigés par conception (`docs/audit/AUDIT-EXISTANT.md`), la liste des événements du legacy non portés en fin de `packages/shared/src/evenements.ts`.
- **La réécriture** : en local (`pnpm dev`, http://localhost:3000) et en production (https://neon-ninja-jeu.vercel.app).
- **Pour les couleurs** : `couleurUnique` dans `packages/sim/src/couleurs.ts` et ses appelants ; dans le legacy, `getRandomColor` et le filtre des couleurs libres (`legacy/server.js`, vers les lignes 1512 à 1531) ; la diffusion de couleur entre bots (comportement à préserver 11).

## Périmètre

1. **Recueillir d'abord ce que le porteur du projet a observé**, avec les circonstances : quel écran, local ou production, seul ou à plusieurs, quel navigateur ou appareil. Au minimum : les couleurs.
2. **Lui présenter les manques connus** listés au handoff 5.3 (reconnexion en cours de partie, gestion du mot de passe, liste des parties qui ne se rafraîchit pas, enregistrement de fin non retenté, session laissée ouverte en continuant en invité, mise en ligne qui coupe les parties, scénarios de bout en bout instables). Il décide lesquels deviennent des étapes, lesquels sont traités dans celle-ci, et lesquels sont acceptés tels quels.
3. **Écrire la grille de recette**, `docs/recette/recette-5-4.md` : pour chaque cas, l'attendu et sa source, l'observé, le verdict. Domaines, au minimum :
   - accueil et pseudo, partie rapide, liste des parties, entrée par code, création publique et privée avec tous les réglages ;
   - salon : joueurs, couleurs, hôte et transfert de propriété, réglages, chat, compte à rebours et son annulation, lancement ;
   - jeu : déplacement au clavier et au tactile, capture de faux ninjas, capture d'un joueur et transfert de tous ses bots, score en stock, protection de 3 secondes, délai de 1 seconde, bots noirs (perte de 50 pour cent, 15 points), bonus cumulés, malus qui frappent les autres, zones, diffusion des couleurs entre bots, pause, quitter, minimap, localisation, sons et musique ;
   - fin de partie : classement, rejouer, récapitulatif de progression ;
   - comptes : inscription, connexion, session gardée et expirée, déconnexion, profil, historique, XP, pièces et points de ligue ;
   - mode Tactique ; les trois cartes, en normal et en miroir ;
   - plusieurs joueurs dans une partie, plusieurs parties à la fois et leur isolation ;
   - fenêtre mobile ; production (réveil du serveur, version, page d'une autre version).
4. **Dérouler la grille** : dans le navigateur, avec plusieurs onglets pour le multijoueur, en local puis en production ; comparer au jeu d'origine sur chaque règle où il fait foi.
5. **Corriger chaque défaut**, test d'abord : un test qui échoue et reproduit le défaut, puis la correction. Un défaut trop gros pour l'étape devient une étape planifiée dans le ROADMAP (règle 7), avec l'accord du porteur du projet.

## Hors périmètre

- Les fonctionnalités reportées : autres modes, pass de saison, skins, clans, défis.
- Les manques connus que le porteur du projet n'a pas retenus pour cette étape.
- Le retrait du legacy et la fusion dans `master` : étape 6.1.

## Tests requis

- Chaque défaut corrigé a un test qui échouait avant la correction, dans la couche qui convient : unitaire, intégration ou bout en bout.
- Un parcours que la recette trouve fragile, et qu'aucun scénario de bout en bout ne couvre, reçoit son scénario.
- La grille est complète, chaque cas avec son verdict, en local et en production.

## Définition de terminé

Conditions de ROADMAP réunies, plus :

1. La grille de recette est complète, en local et en production.
2. Le défaut des couleurs signalé est instruit : reproduit et corrigé, ou expliqué au porteur du projet s'il s'agit du comportement voulu.
3. Tout défaut trouvé est corrigé et testé, ou planifié comme étape avec l'accord du porteur du projet.
4. La production est à jour, CI verte.

Si l'étape déborde, la couper en deux (recette, puis corrections), avec un handoff partiel.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-4-handoff.md` : la grille et ses verdicts, les défauts trouvés et leur sort, les décisions du porteur du projet sur les manques connus. Prochaine action exacte : l'étape suivante de la section 3 du ROADMAP (6.1). Commiter.
