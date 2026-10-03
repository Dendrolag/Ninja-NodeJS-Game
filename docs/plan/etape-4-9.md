# Fiche étape 4.9 - Le numéro de version et la note de version

Brief de session. Objectif unique: le jeu porte un numéro de version lisible, et une note de version annonce une fois à chaque joueur les nouveautés majeures.

## Origine de cette fiche

Demande du porteur du projet, le 2 octobre 2026, à la fin de l'étape 8.8: « Revoir le format du numéro de version (du style V1.X.X - jjmmaa - numéro de commit). Ajouter une modale de Note de version pour annoncer les nouveautés majeures (nouvelles features qui incrémentent le numéro de version de 0.X). La modale s'affiche une première fois et ne s'affiche plus une fois fermée par l'utilisateur. » Les propositions ci-dessous ont été faites dans la même conversation et acceptées par le porteur du projet le même jour.

Rédigée le 2 octobre 2026 dans la conversation de l'étape 8.8, pour qu'une session neuve n'ait besoin que du numéro. **Numéro**: 4.9, dans la phase du client et de l'interface. L'étape 8.4 a mis la version dans le pied de l'accueil; celle-ci lui ajoute un numéro et une note.

## Ce qu'est la version aujourd'hui

- Depuis l'étape 8.4, le pied de l'accueil dit « Version du 2 octobre 2026, 22h47 · 8f2a8df »: la date du commit servi, en toutes lettres, et sept caractères d'empreinte. En développement, « Version de développement ». Code: `packages/shared/src/version.ts` (`LIBELLE_DE_DEVELOPPEMENT`, le libellé ligne 133), lu par l'accueil (`packages/client/src/interface/ecrans/accueil.ts`).
- Le serveur reçoit le commit par `VERSION_DU_JEU` (`packages/server/src/principal.ts`), et refuse une page d'un autre commit.
- Aucun numéro de version n'existe. La version d'origine était la v0.8.6.
- Le pied de l'accueil porte aussi le bouton « Crédits » (étape 4.7), qui ouvre une fenêtre: c'est le modèle à suivre pour la note.

## Décisions prises avec le porteur du projet (2 octobre 2026)

1. **Format**: `V1.5.0 · 02/10/2026 · 8f2a8df`. Le numéro, la date du commit en jj/mm/aaaa, l'empreinte courte. « jjmmaa » a été écarté, ambigu (021026). L'heure disparaît du libellé, l'infobulle peut garder la date complète et l'empreinte entière.
2. **Le numéro part de 1.5.0**, celui que le porteur du projet a donné.
3. **Règle d'avancement**, écrite dans le code à côté du numéro:
   - mineur (1.X.0): une nouveauté majeure, qui s'accompagne toujours d'une note de version;
   - correctif (1.5.X): une correction ou un réglage, sans note.
     Le numéro se fixe à la main, à un seul endroit (`packages/shared`), à la fin d'une étape qui le justifie. Un test exige qu'un numéro mineur ait sa note.
4. **La note s'affiche une fois par navigateur et par version.** Fermée, la note 1.5 ne revient plus; la note 1.6 s'affichera à son tour. Le souvenir se garde dans le stockage du navigateur. S'il est indisponible (navigation privée, stockage bloqué), la note ne doit jamais bloquer l'accueil.
5. **Sur l'accueil seulement**, jamais pendant une partie ni par-dessus un salon.
6. **Un joueur tout nouveau ne la voit pas**: tout est nouveau pour lui. Critère à préciser dans l'étape (par exemple: aucune version déjà vue n'est connue de ce navigateur, et aucune préférence enregistrée). Il retient quand même la version courante comme vue.
7. **Le numéro du pied de l'accueil rouvre la note** d'un clic, comme « Crédits ».
8. **Le texte de la note 1.5**, accepté par le porteur du projet:

> **Nouveautés de la version 1.5**
>
> **Objets, poche et mines**
>
> - **La poche.** Elle garde un objet ramassé jusqu'à ce que vous vous en serviez, avec la touche E ou le bouton de poche sur téléphone.
> - **La fumée.** Vous disparaissez dans un nuage et réapparaissez loin de toute menace. De quoi semer un poursuivant et tromper l'adversaire.
> - **La mine.** Posez-la sous vos pieds. Un adversaire qui marche dessus l'arme et elle saute une seconde et demie plus tard, en lui coûtant une partie de ses ninjas. Elle détruit aussi un Black Ninja.
> - **Les mines de zone.** Les zones à effet ne surgissent plus seules. Elles dorment sous des mines visibles de tous et s'ouvrent quand quelqu'un marche dessus. À vous de choisir le bon moment.
>
> **L'Évadé**
>
> - Un ninja rayé rouge et blanc surgit une fois par partie. Il court plus vite que vous et repart au bout de 45 secondes. Qui l'attrape double son score jusqu'à la fin… à moins de se faire capturer à son tour.

Le nouveau décor de Spirit & Time n'y figure pas (il garde son badge « Prototype »), et les modes ne sont pas nommés: posé en question au porteur du projet, laissé tel quel faute d'avis contraire. À reconfirmer en ouvrant l'étape si la session en a l'occasion, sans en faire un blocage.

9. **Les notes sont des données**: une table par version (numéro, titre, sections, puces), dans `packages/shared` ou le client, que la fenêtre affiche. Ajouter une note ne touche pas au code de la fenêtre.

## Périmètre

### Lot A. Le numéro

1. La constante du numéro et la règle d'avancement; le libellé au nouveau format, en développement compris (à décider: « V1.5.0 · développement »).
2. Tests du libellé: avec et sans commit, sans dépendre de la langue ni du fuseau de la machine (comme à l'étape 8.4).

### Lot B. La note

1. Les notes en données, la note 1.5.
2. La fenêtre, sur le modèle de celle des crédits: titre, sections, puces, un bouton pour fermer; clavier et lecteur d'écran compris.
3. Le souvenir par version, et la règle du nouveau joueur.
4. Le numéro du pied qui rouvre la note.

### Lot C. Documentation

1. Journal de conception, ROADMAP, handoff. La règle d'avancement du numéro aussi dans `docs/plan/PROTOCOLE.md` (fin d'étape: faut-il avancer le numéro, et écrire une note?).

## Hors périmètre

- Un historique de toutes les notes dans une page à part.
- Garder le souvenir sur le compte, côté serveur.
- Toute modification de `legacy/`, de `tests/caracterisation/`, de `packages/sim` ou du serveur.

## Tests requis

- **Partagé ou client (TU)**: le libellé au nouveau format; un numéro mineur a sa note; la note s'affiche à un joueur qui n'a pas vu cette version, pas à celui qui l'a fermée, pas à un nouveau joueur; le stockage indisponible ne casse rien.
- **Bout en bout**: la note s'ouvre à l'accueil d'un joueur qui revient, se ferme, ne revient pas au rechargement, se rouvre par le numéro du pied; elle ne s'ouvre pas pour un joueur neuf.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le pied de l'accueil dit `V1.5.0 · jj/mm/aaaa · empreinte` en production, vérifié sur la page en ligne.
2. Captures de la note, sur ordinateur et sur téléphone.

## Réconciliation (3 octobre 2026, à l'exécution)

1. **Le libellé de développement**: `V1.5.0 · développement`, comme proposé. Sans date, une page de production dit `V1.5.0 · 8f2a8df`.
2. **L'infobulle** garde la date complète, heure comprise, et l'empreinte entière: « Version du 2 octobre 2026, 22h47 · commit … ».
3. **Le critère du nouveau joueur**: aucune version vue, et aucune des clés `neon-ninja.session`, `neon-ninja.son`, `neon-ninja.sang` dans le stockage. Il est lu une fois, au montage de l'application. Conséquence assumée: un invité d'avant l'étape qui n'a jamais rien réglé est pris pour un nouveau joueur, et ne lira que les notes suivantes.
4. **Stockage indisponible**: la note ne s'ouvre pas d'elle-même (elle reviendrait à chaque visite), mais le numéro du pied la rouvre.
5. **Pas par-dessus une invitation**: un joueur arrivé par un lien d'invitation vient rejoindre une partie; la note attend son prochain passage par l'accueil. Ajouté à l'exécution, dans l'esprit du point 5.
6. **La note est retenue lue à sa fermeture**, quelle qu'en soit la façon (bouton « Compris », croix, Echap, clic à côté). Rechargée sans être fermée, elle revient.
7. **Les notes vivent dans le client** (`interface/modeles/notesDeVersion.ts`), le numéro dans `packages/shared`. Un correctif rouvre la note de sa version mineure.
8. Le texte de la note n'a pas été reconfirmé: le porteur du projet n'était pas joignable pendant l'étape, et la fiche ne le demandait pas comme blocage.

## Rituel de fin de session

Écrire `docs/handoffs/etape-4-9-handoff.md`. Commiter, pousser, vérifier la CI et la mise en ligne.
