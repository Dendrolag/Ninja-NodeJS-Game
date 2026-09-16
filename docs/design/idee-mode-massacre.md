# Idée - Le mode Massacre (ou Bain de sang)

Note de préparation du 16 septembre 2026, écrite après l'étape 7.3 à partir des échanges avec le porteur du projet. **Ce n'est pas une fiche**: aucune règle n'est tranchée. La prochaine conversation tranche les règles avec le porteur du projet, puis rédige la fiche selon le cas de repli du PROTOCOLE.

## L'intention du porteur du projet

- Un mode qui se joue **aussi bien seul qu'à plusieurs**.
- **Plus de capture**: les bots touchés **meurent**.
- **Une effusion de sang à chaque mort**, dans l'esprit de Hotline Miami, et des **traces de pas de sang** quand un joueur marche dedans.
- Massacrer le plus de bots **dans le temps imparti**, avec des **combos de points** quand les morts s'enchaînent.
- **Une attaque propre au mode**: un coup de katana qui balaie devant le joueur. Le tir du Tactique est « un fusil à pompe »; le katana est un arc large et court.
- Nom à choisir: « Massacre » ou « Bain de sang ».

## Ce qui a été étudié, et ce qui est proposé

### Le coup de katana

- **Géométrie**: le test de `dansLeCone` (`packages/sim/src/tactique.ts`) sert, une fois l'angle et la portée rendus réglables par mode (aujourd'hui figés sur ceux du Tactique, 90 degrés et 100 pixels). Ordre de grandeur proposé: un arc de 150 à 180 degrés sur 50 à 70 pixels. Le Tactique ne doit pas changer: l'empreinte des parties le vérifie.
- **Résolution proposée**: tout le coup se résout dans un seul battement du moteur; la page montre le balayage sur 100 à 150 ms. Un vrai balayage réparti sur plusieurs battements (2 ou 3 à 20 battements par seconde) est plus compliqué pour un gain imperceptible.
- **Cibles proposées**: tout ce qui est dans l'arc est tranché (c'est ce qui rend les combos jouissifs), à l'inverse de la Chasse où seule l'entité la plus proche compte.
- **Cadence proposée**: pas de charges, un court délai entre deux coups (300 à 500 ms).
- **Direction**: celle du dernier déplacement (8 directions), comme le cône du Tactique, avec le même bouton et la même touche. La visée à la souris est un autre sujet.

### Le sang, tout en code

- **Faisable sans asset**: une éclaboussure procédurale (tache centrale irrégulière, gouttes projetées dans la direction du coup, traînées étirées, rouge légèrement varié), tirée au hasard pour chaque mort.
- **Accumulation**: les taches sont imprimées une fois sur un calque de sol persistant (une texture de rendu PixiJS), et ne coûtent plus rien ensuite. À demi-résolution, environ 6 Mo de mémoire graphique pour map3 (3 000 sur 2 000), au lieu de 24.
- **Architecture**: le sang est purement visuel et vit dans la page. Le moteur annonce seulement la mort d'un bot, sa position et la direction du coup; la pureté et le déterminisme de `packages/sim` ne sont pas touchés. Pour que tous les joueurs voient les mêmes taches, le tirage du dessin se dérive de l'identifiant du bot tué.
- **Le cadavre**: le sprite du ninja couché, assombri, qui s'efface, sans asset.
- **Assets possibles plus tard**: 5 à 10 petites images de taches, tournées, agrandies et teintées par le code, pour un style plus « artisanal »; ou une image de ninja mort.
- **Lisibilité**: sur un sol sombre et néon, un rouge un peu lumineux, voire une légère lueur.

### Les traces de pas

- **Tout en code**: la page retient les taches fraîches; un joueur qui passe dessus se charge de sang, et imprime sur le calque de sol une empreinte tous les quelques pas, orientée, gauche et droite en alternance, de plus en plus pâle, pendant une dizaine de pas.

### L'animation du coup

- **En code**: une traînée lumineuse en croissant qui balaie l'arc puis s'efface, un éclat sur chaque bot tranché, un micro-arrêt de 30 à 50 ms à l'impact, une légère secousse de caméra, une traînée plus vive quand le combo monte.
- **Assets en option**: des poses d'attaque du ninja (8 directions, 2 ou 3 images, dans le style des sprites de 32 pixels actuels, teintées par le code), une traînée dessinée à la main.
- **Sons**: le seul point où un fichier est recommandé d'emblée, un balayage de lame et un impact tranchant. Les sons du jeu sont tous des fichiers (`assets/sons`).

### Recommandation retenue pour démarrer

Tout en code (sang, traces de pas, traînée, éclat, micro-arrêt, secousse), plus deux sons en fichier. Les poses d'attaque viennent ensuite si le personnage paraît trop statique pendant le coup.

## Questions à trancher avec le porteur du projet

1. Le nom du mode: Massacre ou Bain de sang.
2. L'arc et sa portée; le délai entre deux coups.
3. Les combos: la fenêtre de temps entre deux morts, le barème, un plafond de multiplicateur.
4. Ce que deviennent les bots tués: réapparition (à quel rythme), ou une carte qui se vide et une fin quand tout est tué.
5. Le multijoueur: chacun son score, en compétition ou en coopération; un joueur peut-il en trancher un autre.
6. Le solo: une partie à un seul joueur, lancée depuis le salon comme les autres modes, et ce qu'elle rapporte en progression (règle actuelle: deux joueurs au moins pour la ligue).
7. Les Black Ninjas, les bonus, les malus et les zones: gardés, adaptés ou retirés.
8. Une option pour couper ou atténuer le sang (normal, discret, désactivé), et où elle se règle.
9. Les sons: qui les fournit, ou lesquels chercher.
10. La capacité du mode.
