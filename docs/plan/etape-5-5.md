# Fiche étape 5.5 - Peaufinage et débogage

Brief de session. Objectif unique: corriger les défauts et les manques que le porteur du projet a relevés en jouant, ainsi que les limites connues des handoffs qu'il a retenues, dans les cinq modes, sur ordinateur et sur téléphone. Aucune nouvelle fonctionnalité: ce qui en serait une devient une étape à part.

## Origine de cette fiche

Aucune fiche n'existait: le handoff 7.4 et l'entrée 5.5 du ROADMAP (section 4) renvoient à une liste à recueillir en début de session. Elle est rédigée le 18 septembre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir:

- de la liste donnée par le porteur du projet au début de la session, et de deux sons qu'il a fournis (`katana-sound.mp3`, `kill-sound.mp3`);
- des limites connues des handoffs 5.4 à 7.4, présentées au porteur du projet et triées avec lui;
- de l'état du dépôt au commit `0c0aa9d`, et de la fiche 5.4 prise comme modèle.

**Numéro**: 5.5, dans la phase 5, « Charge, performance et durcissement ».

## Réconciliation du 18 septembre 2026

- **Le son perdu du Massacre n'avait rien à voir avec les bonus.** La boucle de rendu lisait le journal des faits à partir de son ancienne longueur, qui ne bouge plus une fois le journal plein (cinquante faits). Au cinquantième fait, tous les sons se taisaient, dans tous les modes, avec les flèches de localisation et le micro-arrêt. Le bonus ramassé tombait simplement vers ce moment-là.
- **Un point ajouté en cours d'étape (14)**: les sons du fusil du mode Tactique, fournis par le porteur du projet.
- **Deux défauts voisins corrigés en route (règle 7)**: un joueur tué en Massacre ne voyait pas les flèches de localisation, alors qu'il réapparaît ailleurs; le surtitre de l'accueil disait encore « Mode classique » avec cinq modes.
- **« Rejouer »** reprend le mode et les réglages de la partie terminée, comme la fiche le prévoyait, après un premier temps où seul le mode suivait. Une partie privée rejouée mène à une partie publique.
- **La barre du haut** ne règle que le haut de la carte: en bas, aucun élément du HUD ne couvre le centre de l'écran.
- **La couleur du cadavre passe par le contrat**: la page ne connaît plus sûrement le mort quand sa mort arrive, et un champ de plus dans une notification ne coûte rien. Seuls les faits du Massacre changent: l'empreinte des parties Classique est identique.
- **Les sons fournis gardent les noms de fichier du jeu** (`katana-swing.mp3`, `katana-hit.mp3`, `shotgun-wave.mp3`, `shotgun-reload.mp3`), plus parlants que ceux d'origine.
- **Le volume sous iOS** est corrigé par conception et vérifié dans Chromium; seul un vrai iPhone le confirme.

## Rituel de début de session

Lire CLAUDE.md (dont « Comportements à préserver »), le dernier handoff (7.4, ou le handoff partiel de cette étape), cette fiche, et `.claude/rules/sim-purity.md` si un point touche `packages/sim`.

## Tri du porteur du projet, 18 septembre 2026

Retenu dans cette étape (voir « Périmètre »): le son des captures en Classique, « Rejouer » qui perd le mode, les sons du Massacre perdus après un bonus, le remplacement des sons du katana, le volume sur iOS, le HUD regroupé en une barre supérieure, l'en-tête des menus qui déborde sur téléphone, la connexion au serveur trop discrète, « Code privé » tronqué, les bonus et malus de « Comment jouer », le serveur tenu éveillé tant qu'une page est ouverte; parmi les limites connues, la flèche de localisation d'une proie infectée et la teinte fixe des cadavres.

Devenu deux étapes à part, planifiées au ROADMAP:

- **7.5, réglages du Classique**: un multiplicateur de combo pour les captures enchaînées, comme en Massacre; des points flottants blancs dont la couleur et la taille montent avec le combo, l'échelle étant à fixer avec le porteur du projet; le renommage du Classique en « Horde », à confirmer; **une vitesse commune aux joueurs et aux bots hors bonus, 150 pixels par seconde**, choisie par le porteur du projet ce jour. Elles changent deux comportements protégés par CLAUDE.md (le score comme stock, les vitesses relatives) et l'empreinte des parties: on les change une seule fois, ensemble.
- **7.6, options de partie**: une seule carte « Tokyo » avec une option pluie, au lieu de Tokyo et Rainy Tokyo, qui ont le même décor; plus de 150 bots, selon le mode ou la carte, d'après une mesure du débit.

Laissé en l'état, pour les raisons données au porteur du projet: le mode spectateur d'un traqueur éliminé (fonctionnalité); ce qui manque au mode Équipes (pseudo au-dessus des coéquipiers, chat par équipe, choix du camp en cours de partie: fonctionnalités) et l'équipe vidée qui n'est plus classée (voulu); l'hôte du salon perdu avec son lien; les 45 secondes avant de constater une coupure silencieuse; la fenêtre du code de secours; les deux incidents jamais reproduits (un point flottant, le test des routes des comptes); les mesures manquantes; l'exploitation (Vercel, limites de tentatives en mémoire); ce qui dépend du porteur du projet (équilibrage, sons et musique, vrai iPhone, base du serveur de développement local).

## Périmètre

Chaque point commence par un test qui échoue et reproduit le défaut, dans la couche qui convient, puis la correction. Un point qui se révèle être une fonctionnalité, ou trop gros, s'arrête et devient une étape, avec l'accord du porteur du projet (règle 7).

### Lot A. Les sons

1. **Classique: le son des captures.** Capturer un faux ninja au contact ne fait aucun bruit: le son `botCapture` (`bot-convert.mp3`, celui du jeu d'origine) est dans la table, mais rien ne le déclenche, les captures au contact n'étant pas des notifications. Le jouer quand notre score monte par une capture, avec le point flottant « +1 », sans doubler le son des tirs du Tactique ni ceux du Massacre.
2. **Massacre: plus aucun son de katana après un bonus.** Reproduire d'abord, par un test du lecteur ou des déclencheurs, puis en jouant; la cause n'est pas connue à la rédaction.
3. **Les sons du katana remplacés** par ceux du porteur du projet: `katana-sound.mp3` pour le coup dans le vide, `kill-sound.mp3` pour le coup qui tue. Ils prennent la place des sons synthétiques, sous leurs propres noms, et `assets/README.md` le dit. Le script `tests/outils/sons-katana.ts` n'a plus de raison d'être: le retirer.
4. **Le volume sur téléphone.** Sous iOS, tous les navigateurs sont WebKit, qui ignore le volume réglé sur un élément audio: les curseurs ne font rien. Faire passer les sons et la musique par un nœud de gain Web Audio, qui marche partout, en gardant le lecteur injectable pour les tests. Vérifier à l'écran sur le profil téléphone de Playwright ce qui peut l'être, et demander au porteur du projet une vérification sur son iPhone.

### Lot B. Les défauts d'écran et de jeu

5. **« Rejouer » garde le mode.** Il mène aujourd'hui à la partie rapide, qui est du Classique. Il doit mener à la première partie publique en attente du même mode, ou en créer une du même mode, avec les réglages de la partie terminée.
6. **« Code privé » tronqué sur ordinateur**, dans la liste des parties publiques: on ne lit que « CODE PRI » avant le bouton « Joindre ».
7. **Chasse: une proie infectée ne voit plus la flèche de localisation**, qui suit une capture dans les autres modes alors qu'elle n'a pas bougé.
8. **Massacre: le cadavre prend la couleur du mort.** Elle n'est pas transmise avec sa mort; la page la connaît peut-être déjà par l'état qu'elle a reçu avant la mort. Ne l'ajouter au contrat que si c'est nécessaire.

### Lot C. L'interface

9. **Le HUD en une seule barre supérieure**: le temps au centre, le classement de la partie à gauche, les boutons de pause, de sortie et du son à droite, sur un fond moins opaque qui laisse le jeu lisible. Les éléments propres à un mode (combo et katana du Massacre, charges du Tactique, camp de la Chasse, ninjas restants) y trouvent une place, ou restent où ils sont s'ils ne gênent pas. Règle au passage la limite « en haut ou en bas de la carte, le joueur passe sous le HUD sur téléphone ». Au bureau et sur téléphone, dans les cinq modes.
10. **L'en-tête des menus sur téléphone**: le logo, le niveau, la monnaie, les pictogrammes des contrôles et du son débordent en hauteur. Fixer une largeur maximale, empêcher le zoom de la page, et réduire ces éléments sur téléphone.
11. **La connexion au serveur, plus visible**: aujourd'hui trop discrète. Un état de chargement franc pendant que le serveur se réveille ou que le lien se rétablit, qui dise ce qui se passe.
12. **« Comment jouer »**: un halo clair derrière les bonus et les malus, lisibles sur fond sombre, et les images animées comme en partie, au lieu d'un dessin doublé.

### Lot D. La production

13. **Le serveur tenu éveillé tant qu'une page est ouverte.** En offre gratuite, Render endort le serveur après quinze minutes sans trafic entrant, même si quelqu'un est sur les menus. La page envoie un signal de vie périodique (la route `/sante` par exemple), moins de quinze minutes d'écart, tant qu'elle est ouverte et visible. Vérifier que les heures gratuites suffisent (750 heures par mois, un mois en compte au plus 744) et le consigner dans `docs/deploiement.md`.

### Ajouté en cours d'étape

14. **Tactique: le son d'un fusil.** Demande du porteur du projet du 18 septembre 2026, avec deux sons fournis: `shotgun-wave.mp3` à chacun de nos tirs, qu'il prenne ou non, et `shotgun-reload.mp3` dès qu'une charge revient.

## Hors périmètre

- Les étapes 7.5 et 7.6 ci-dessus, et les fonctionnalités reportées (Battle Royale, Chaos, pass de saison, skins, clans).
- Les limites laissées en l'état par le tri.
- Tout changement de règle du jeu: l'empreinte des quatre parties Classique de référence doit rester identique.

## Tests requis

- Chaque point corrigé a un test qui échouait avant la correction.
- Empreinte des parties de référence identique (`tests/charge`, outil d'empreinte de l'étape 5.2).
- Le bout en bout reste vert; un parcours corrigé qu'aucun scénario ne couvre en reçoit un (Rejouer dans un autre mode, par exemple).
- Les changements visibles sont vérifiés à l'écran, au bureau et au format téléphone.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Les quatorze points sont corrigés et testés, ou devenus une étape avec l'accord du porteur du projet.
2. Empreinte identique, couverture de `packages/sim` qui ne baisse pas.
3. La production est à jour, CI verte.

Si l'étape déborde, la couper par lots, avec un handoff partiel.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-5-handoff.md`: chaque point et son sort, les écarts à cette fiche dans une section « Réconciliation » ajoutée ici, ce qui reste à vérifier par le porteur du projet (volume sur iPhone, sons du katana). Prochaine action exacte: l'étape suivante de la section 3 du ROADMAP (7.5). Commiter.
