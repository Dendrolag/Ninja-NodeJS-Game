# Handoff - Étape 4.9 Le numéro de version et la note de version

Date: 3 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Le jeu porte un numéro de version lisible, et une note de version annonce une fois à chaque joueur les nouveautés majeures.

## Ce qui a été fait

- **Le numéro**: `NUMERO_DE_VERSION = '1.5.0'`, écrit à un seul endroit (`packages/shared/src/version.ts`), avec sa règle d'avancement en commentaire: le deuxième chiffre pour une nouveauté majeure, toujours avec une note; le troisième pour une correction ou un réglage, sans note.
- **Le libellé du pied**: `V1.5.0 · 02/10/2026 · 8f2a8df`; sans date, `V1.5.0 · 8f2a8df`; en développement, `V1.5.0 · développement`. La date se lit telle qu'écrite dans le commit, sans conversion de fuseau. L'infobulle garde la date complète, heure comprise, et l'empreinte entière.
- **La note 1.5**, en données (`interface/modeles/notesDeVersion.ts`), le texte de la fiche mot pour mot. La fenêtre suit le modèle des crédits: titre de la note, sections en titres de niveau trois et listes, bouton « Compris », croix, Echap, clic à côté.
- **Le souvenir** (`interface/souvenirDeVersion.ts`): la dernière version mineure vue, sous `neon-ninja.version-vue`. Lu une fois au montage de l'application. La note s'ouvre au premier affichage de l'accueil d'un joueur qui revient et ne l'a pas lue; elle est retenue lue à sa fermeture. Un joueur tout nouveau (aucune version vue, ni session de compte, ni réglage du son ou du sang) ne la voit pas et retient la version. Stockage refusé ou absent: la note ne s'ouvre pas d'elle-même, rien ne lève.
- **Le numéro du pied rouvre la note**: c'est un bouton quand une note existe, avec la même voix que « Crédits » (classe commune `accueil-pied-bouton`).
- **Ni par-dessus une invitation, ni hors de l'accueil**: la fenêtre appartient à l'écran d'accueil, et ne s'ouvre pas d'elle-même quand le joueur arrive par un lien d'invitation.
- **Défaut corrigé en route**: ouverte pendant le montage de l'accueil, avant que l'écran soit dans la page, la fenêtre ne prenait pas le focus. Elle s'ouvre désormais au premier affichage. Trouvé par le test d'application.
- **PROTOCOLE**: la fin d'étape demande désormais s'il faut avancer le numéro, et écrire une note.
- Captures: `docs/design/etape-4-9/note-ordinateur.png` et `note-telephone.png`, produites par le scénario de bout en bout.

## Fichiers créés ou modifiés

- `packages/shared/src/version.ts`: `NUMERO_DE_VERSION`, `versionMineure`, `dateCourteDeVersion`, `infobulleDeVersion`, libellé au nouveau format. `index.ts`: exports. `version.test.ts`: tests du numéro, de la date courte, du libellé et de l'infobulle.
- `packages/client/src/interface/modeles/notesDeVersion.ts` (créé) et son test: les notes, la règle « un numéro mineur a sa note ».
- `packages/client/src/interface/souvenirDeVersion.ts` (créé) et son test: la décision et le souvenir.
- `packages/client/src/interface/composants/noteDeVersion.ts` (créé) et son test: la fenêtre.
- `packages/client/src/interface/ecrans/accueil.ts`: le numéro en bouton, la fenêtre, l'ouverture au premier affichage. `ecrans/types.ts`: `infobulleDeVersion` remplace `version`, `souvenirDeVersion` ajouté.
- `packages/client/src/interface/application.ts`: lit le souvenir au montage, compose l'infobulle; option `notesDeVersion` pour les tests. `application.test.ts`: libellé et infobulle au nouveau format. `application.note.test.ts` (créé): la note dans l'application.
- `packages/client/src/interface/essais.ts`: `stockageEnMemoire` et `stockageRefuse`, déplacés depuis `comptes/coffre.test.ts`, qui les importe.
- `packages/client/page/styles/ecrans.css`: style de la note, classe commune des boutons du pied.
- `tests/e2e/note-de-version.spec.ts` (créé); `tests/e2e/credits.spec.ts`: le pied dit le numéro.
- Documentation: fiche 4.9 (réconciliation), ROADMAP, PROTOCOLE, journal de conception, ce handoff.

Aucune modification de `legacy/`, de `tests/caracterisation/`, de `packages/sim` ni du serveur.

## Tests

- Ajoutés: format du numéro, version mineure, date courte indépendante du fuseau, libellé avec et sans commit ou date, infobulle; note de la version servie exigée, une note par version, pas de texte vide, texte de la 1.5; décision de la note (revient, lue, nouveau joueur, sans note); souvenir sur stockage en mémoire, refusé, absent; fenêtre (titre, sections, puces, trois façons de fermer); application (ouverture et focus, pas de retour après fermeture, retour tant qu'elle n'est pas fermée, réouverture par le pied et focus rendu, nouveau joueur, sans stockage, invitation, hors de l'accueil). Bout en bout, bureau et mobile: un habitué la lit, la ferme, elle ne revient pas au rechargement, le numéro la rouvre, Echap la ferme; un joueur neuf ne la voit pas, ni au rechargement.
- Résultat: 3 527 tests unitaires et d'intégration au vert en local, types, linter et formatage compris; tests de la base sautés en local. Bout en bout: note, crédits, navigation, parcours solo, lien, retour et compte au vert dans les deux cadrages.
- Couverture de packages/sim: inchangée, il n'est pas touché.
- État de la CI: voir la section ajoutée après la poussée.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche. En bref: libellé de développement `V1.5.0 · développement`; critère du nouveau joueur sur trois clés du stockage; sans stockage, la note ne s'ouvre pas d'elle-même; pas d'ouverture par-dessus une invitation (ajout à l'exécution); note retenue lue à toute fermeture. Le texte de la note n'a pas été reconfirmé auprès du porteur du projet.

## Problèmes connus et dette

- **Conséquence assumée**: un invité d'avant cette étape qui n'a jamais rien réglé est pris pour un nouveau joueur, et ne verra pas la note 1.5; il verra la 1.6.
- Sous Windows, `pnpm format` laisse des fichiers marqués modifiés par `git status` sans différence de contenu (conversion des fins de ligne): ne commiter que les fichiers de l'étape.
- Rien d'autre.

## Prochaine action exacte

Aucune étape planifiée ne reste ouverte. Attendre la prochaine demande du porteur du projet. Au porteur du projet: relire la note 1.5 en ligne (numéro du pied de l'accueil), et jouer une partie sur Spirit & Time (dette de l'étape 8.8).

## Étape suivante

Fiche à lire: aucune, à rédiger à la prochaine demande.
