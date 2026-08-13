# Handoff : Neon Ninja — refonte complète (parties privées/publiques, modes, progression)

## Overview
Refonte complète du jeu web multijoueur **Neon Ninja** (arène où l'on capture les vrais Ninjas cachés parmi des leurres).
La refonte couvre **tout le parcours joueur** en 7 écrans et introduit :
- un système de **parties publiques / privées** (navigateur de salons + code d'invitation) ;
- **6 modes de jeu** et **4 cartes** ;
- des **parties personnalisées** (durée, densité de faux ninjas, bonus/malus/zones) ;
- un **système de progression complet** pour la rétention : niveaux + XP, pass de saison, défis quotidiens, skins, ligues classées, succès.

## About the Design Files
Les fichiers de ce paquet sont des **références de design réalisées en HTML** — des prototypes qui montrent l'apparence et le comportement voulus, **pas du code de production à copier tel quel**.

La tâche consiste à **recréer ces designs dans l'environnement existant du codebase cible** (React, Vue, Svelte, etc.) en suivant ses patterns et bibliothèques établis. Si aucun environnement front n'existe encore, choisir le framework le plus approprié au projet et y implémenter les designs.

Le prototype utilise un petit runtime de composants maison : **ne pas le porter**. Seuls comptent la structure, les styles, les données et les interactions décrits ci-dessous.

## Fidelity
**Haute fidélité (hifi).** Couleurs, typographie, espacements, rayons, ombres et interactions sont définitifs. L'UI doit être recréée fidèlement, avec les bibliothèques et conventions du codebase cible.

Réserve : les visuels de cartes, d'avatars et de skins sont des **placeholders** (dégradés + picto). Ils doivent être remplacés par les vrais assets du jeu.

---

## Design Tokens

### Couleurs
| Rôle | Hex |
|---|---|
| Fond application | `#06080E` |
| Fond panneau / carte sombre | `#0D111B` |
| Surface (carte) | `rgba(255,255,255,.03)` |
| Surface hover | `rgba(255,255,255,.05)` |
| Bordure standard | `rgba(255,255,255,.08)` |
| Bordure hover | `rgba(255,255,255,.14)` — `.18` sur éléments actifs |
| Texte principal | `#EAF0FF` |
| Texte secondaire | `#9AA6C2` |
| Texte tertiaire | `#828FAD` |
| Texte faible / labels | `#6B7793` |
| Texte désactivé | `#4D586F` |
| **Accent primaire (cyan)** | `#2DE6E0` (dégradé vers `#13B6C9`) |
| Accent primaire — texte sur fond cyan | `#04141A` |
| Accent rose (privé, danger, alerte) | `#FF2E7E` (clair : `#FF6BA3`) |
| Accent violet (miroir, malus, ligue) | `#8B7BFF` |
| Accent or (premium, or, 1re place) | `#FFB23E` |
| Accent vert (prêt, succès, équipes) | `#4DF08A` |
| Accent magenta (chaos) | `#FF5BD0` |

Convention d'opacité sur les accents (notation hex 8 chiffres) : fond `XX1F` / `XX26`, bordure `XX40`–`XX44`, survol `XX88`.

**Ping** : < 35 ms → `#4DF08A` · 35–55 ms → `#FFB23E` · > 55 ms → `#FF2E7E`.

### Fonds d'ambiance (superposés, `position:fixed`, non cliquables)
1. Halos : `radial-gradient(1100px 700px at 14% -8%, rgba(45,230,224,.10), transparent 60%)`, `radial-gradient(900px 650px at 92% 8%, rgba(255,46,126,.10), transparent 58%)`, `radial-gradient(800px 800px at 60% 120%, rgba(139,123,255,.08), transparent 60%)`
2. Grille : lignes `rgba(255,255,255,.035)` à `46px`, `opacity:.5`, masquée par `radial-gradient(circle at 50% 30%, #000 0%, transparent 80%)`

### Typographie
- **Chakra Petch** (500/600/700) — titres, boutons, noms, chiffres de niveau
- **Space Grotesk** (400/500/600/700) — texte courant, descriptions, UI
- **Space Mono** (400/700) — données, labels techniques, scores, timers, codes

Échelle : hero 52px/1.0 (700, letter-spacing −.01em) · titre écran 34px (700) · titre salon 28px (700) · section 18px (600) · sous-section 15–16px (600) · corps 13–14px · secondaire 12–12.5px · label mono 10–11px (letter-spacing .12–.20em, souvent MAJUSCULES).

### Espacements
Base 4px. Valeurs courantes : 6, 8, 10, 12, 14, 16, 20, 22, 24, 26, 30, 44.
Padding page : `30px 44px 60px`, largeur max contenu `1280px`, centré.

### Rayons
Pastille/tag 5–8px · petit bouton 9–11px · contrôle 12–13px · carte 14–16px · grande carte 18px · panneau 20–24px · rond 50%.

### Ombres
- Bouton primaire : `0 12px 30px rgba(45,230,224,.4)` (variante compacte `0 8px 22px rgba(45,230,224,.3)`)
- Bouton premium : `0 8px 20px rgba(255,178,62,.3)`
- Logo : `0 8px 22px rgba(45,230,224,.35)`
- Glow ponctuel : `0 0 8px <accent>` / `filter: drop-shadow(0 0 8px #2DE6E0)`

### Transitions & animations
- Transitions UI : `all .15s–.18s ease`
- Survol carte/bouton : `translateY(-2px)` ou `(-3px)`
- `nnPulse` 1.6s — opacité .55↔1 (point « live »)
- `nnFloat` 3s — translateY 0↔−7px (récompense, ninja mis en avant : 2.4s)
- `nnScan` 4s linéaire — bandeau lumineux qui descend (HUD)
- `nnGridMove` 6s linéaire — grille qui défile (bannière accueil)
- `nnSpin` 8s linéaire — cercle pointillé rotatif (HUD)

---

## Iconographie
**Aucun emoji.** Tous les pictos sont des **SVG sur mesure**, style ligne, `viewBox="0 0 24 24"`, `stroke-width:1.8`, `stroke-linecap/linejoin:round`, couleur héritée (`currentColor` par défaut). Quelques glyphes sont pleins (`fill`, sans stroke) : `play`, `bolt`, `star`, `sparkle`, `stop`.

Jeu complet (~35 glyphes) — voir `Icon.dc.html` pour les tracés exacts :
`play`, `globe`, `plus`, `diamond`, `ninja` (shuriken), `mirror`, `target`, `royale`, `swords`, `tornado`, `coin`, `gem`, `key`, `gear`, `chat`, `send`, `arrowLeft`, `check`, `shield`, `eye`, `bolt`, `swirl`, `zone`, `crown`, `lock`, `star`, `replay`, `stop`, `keyboard`, `palette`, `sparkle`, `emote`, `banner`, `gift`, `flame`, `medal`, `trophy`, `copy`, `chevron`.

Tailles usuelles : 11–13px (badge en ligne), 15–17px (bouton/label), 20–23px (nav, carte), 26–30px (HUD), 40–74px (décoratif, faible opacité).

**À faire côté implémentation** : exporter ces tracés en sprite SVG ou en composants d'icônes, avec une API `{ glyph, size, color, strokeWidth }`.

---

## Ossature commune (présente sur tous les écrans)

### Barre latérale — largeur fixe 84px
`background: rgba(10,13,21,.72)`, `backdrop-filter: blur(12px)`, bordure droite `rgba(255,255,255,.07)`, `padding: 20px 0`, colonne centrée, `gap: 8px`.
- **Logo** 46×46, rayon 13px, dégradé `135deg #2DE6E0 → #13B6C9`, glyphe 忍 (Chakra Petch 700, 22px, `#04141A`), `margin-bottom:14px` → retour Accueil.
- **4 entrées de nav** 54×54, rayon 15px : Jouer (`play`), Parties (`globe`), Créer (`plus`), Profil (`diamond`).
  - Actif : fond `rgba(45,230,224,.12)`, bordure `rgba(45,230,224,.30)`, icône `#EAF0FF`, **barre latérale gauche** 3×26px, `#2DE6E0`, `box-shadow: 0 0 10px #2DE6E0`, positionnée `left:-9px`, centrée verticalement.
  - Inactif : transparent, icône `#818EAC` ; survol → fond `rgba(255,255,255,.06)`, icône `#EAF0FF`.
- **Bas** (`margin-top:auto`) : réglages (`gear`, 44×44, `#818EAC`) puis avatar 46×46 rond, anneau dégradé `135deg #FF2E7E → #8B7BFF` (padding 2px) avec disque `#0D111B` et initiales ; survol `scale(1.06)`.

### En-tête de contenu
Ligne `space-between`, `margin-bottom:30px`.
- **Gauche** : « NEON » + « NINJA » (`#2DE6E0`), Chakra Petch 700, 18px, letter-spacing .16em ; séparateur 1×18px `rgba(255,255,255,.14)` ; libellé d'écran en Space Mono 11px, letter-spacing .18em, `#818EAC` (ACCUEIL / PARTIES / CRÉER / SALON / EN JEU / RÉSULTATS / PROFIL).
- **Droite** : pastille pièces (`coin`, or, fond `rgba(255,178,62,.08)`, bordure `.22`) · pastille gemmes (`gem`, cyan) · carte joueur cliquable → Profil : anneau de progression `conic-gradient(#2DE6E0 <xp>deg, rgba(255,255,255,.10) 0)` 38px avec niveau au centre, nom (Chakra Petch 600, 13px) et rang (11px, `#818EAC`).

Zone principale : `height:100vh`, `overflow-y:auto`.

---

## Écrans

### 1. Accueil — `01-accueil.png`
**But** : lancer une partie en un clic, montrer la saison en cours et donner envie de revenir (défis + pass).

**Bannière** (rayon 24px, `padding:40px 44px`) : fond `linear-gradient(105deg,#0C1726 0%,#10141F 55%,#1A0E1C 100%)`, grille cyan animée (`nnGridMove`), 忍 géant décoratif en haut à droite (280px, `opacity:.06`, `#2DE6E0`).
- Pastille saison : point rose pulsant + « SAISON 4 · NÉON TOKYO · 23 JOURS RESTANTS » (Space Mono 11px, `#FF6BA3`).
- Titre : « Prêt à frapper / **dans l'ombre ?** » (2e ligne `#2DE6E0`), 52px.
- Accroche : « Rejoins une arène, traque les vrais Ninjas et grimpe les ligues. 6 modes, 4 cartes, des parties 100% personnalisables. »
- Boutons : **▶ PARTIE RAPIDE** (primaire cyan, `padding:17px 34px`) → Salon · **＋ Créer une partie** · **🌐 Parcourir** (secondaires `rgba(255,255,255,.05)`, bordure `.16`).

**Colonne gauche — Modes de jeu** : grille 2 colonnes, cartes rayon 18px. Icône 42×42 teintée, nom (Chakra Petch 600, 15px), capacité (Space Mono 10px, couleur du mode), description (12.5px, `#828FAD`), icône géante 74px en filigrane (`opacity:.12`). Survol : bordure = couleur du mode + `translateY(-3px)`. Clic → Créer.

**Colonne droite** :
- *Défis du jour* — compte à rebours « ↻ 14:22:09 », 3 défis avec barre de progression cyan (hauteur 7px, rayon 6px) et gain XP en cyan.
- *Pass de saison* — carte dégradée rose/violet, « PASS DE SAISON · PALIER 24 », « Skin Élite débloqué », « Encore 2 580 XP avant le palier 25 », couronne flottante 40px. Clic → Profil.

### 2. Parties publiques — `02-parties-publiques.png`
**But** : trouver et rejoindre un salon, ou entrer un code privé.

- Titre + « ● 1 248 joueurs en ligne · 86 salons ouverts » (point `#4DF08A`).
- **Code privé** : champ Space Mono 700, letter-spacing .2em, MAJUSCULES, `maxlength=6`, placeholder « CODE PRIVÉ », bouton **JOINDRE** cyan intégré (hauteur totale 48px).
- **＋ Créer** : bouton primaire 48px.
- **Filtres** : « Tous les modes » (actif : fond cyan .14, bordure .30, texte `#2DE6E0`) + une puce par mode avec son icône ; survol → bordure = couleur du mode.
- **Tableau** (in-tête Space Mono 10.5px, .12em) : Hôte/Salon (flex:1) · Mode (140px) · Carte (120px) · Joueurs (90px, centré) · Ping (70px, centré) · action (96px).
  - Ligne : rayon 15px, `padding:15px 20px`, survol fond `.05` + bordure `.14`.
  - Icône de mode 42×42 · « Salon de {hôte} » · statut avec point vert (En attente) ou or (En jeu).
  - Joueurs `{cur}/{max}` en Space Mono 700 ; **plein → `#FF2E7E`**.
  - Bouton **REJOINDRE** (cyan) ou **PLEIN** (grisé, `#6B7793`, non actionnable).

Jeu de données de démo : 7 salons (KageOni, Vyper_99, Akumu, NeoBlade, Sora.exe, GhostByte, Zenith), 3–13 joueurs, ping 18–62 ms, 2 en jeu.

### 3. Créer une partie — `03-creer-partie.png`
**But** : configurer une partie sur mesure et ouvrir le salon.

Grille `1fr 360px`. Étapes numérotées en Space Mono (« 01 · MODE DE JEU »).
1. **Mode** — grille 3 colonnes, carte rayon 15px avec radio 16px en haut à droite ; sélection : fond `<accent>14`, bordure 1.5px pleine.
2. **Carte** — grille 4 colonnes ; vignette 78px (dégradé de l'accent + hachures `repeating-linear-gradient(45deg,…)`, 忍 en filigrane, label « MAP »), puis nom + sous-titre.
3. **Visibilité** — 2 cartes : **Publique** (cyan, « Visible par tous dans le navigateur de parties. ») / **Privée** (rose, « Accessible uniquement via un code d'invitation. »).
4. **Réglages avancés** — panneau repliable (chevron pivotant 180°) : curseur *Durée* 60→600s pas 30 (défaut 180) · curseur *Faux Ninjas* 10→80 pas 5 (défaut 40) · interrupteur *Black Ninjas* (rose, 34×19px) · pastilles d'état *Bonus 3/3* (cyan), *Malus 3/3* (violet), *Zones spéciales 4/4* (or). `accent-color:#2DE6E0` sur les curseurs.

**Panneau récapitulatif** (sticky, `top:10px`) : bandeau 130px (dégradé carte+mode, grille 24px, icône du mode 54px à `opacity:.4`), « RÉSUMÉ DU SALON », « {Mode} · {Carte} », lignes Visibilité / Durée / Faux Ninjas / Capacité, puis **CRÉER LE SALON →** pleine largeur.

### 4. Salon (lobby) — `04-salon-lobby.png`
**But** : rassembler les joueurs, discuter, se déclarer prêt, lancer.

- Retour (flèche 42×42) + « Salon de ShadowFox » + ligne méta : « 🔒 Privée · Code : **NX7K2P** » (Space Mono 700, cyan, .2em) + icône copier.
- À droite : pastille mode/carte + bouton **⚙ Réglages** (→ Créer).
- **Grille joueurs** 2 colonnes, 8 emplacements, hauteur min 74px :
  - occupé — avatar 42px (fond `<accent>26`, bordure 2px pleine, initiales), nom, badge **HÔTE** (or, Space Mono 9px) si hôte, « Niveau {n} », état **✓ PRÊT** (`#4DF08A`) ou « ... » ; bordure verte `.30` si prêt ;
  - libre — bordure **pointillée** `rgba(255,255,255,.1)`, rond pointillé avec `+`, « Place libre » (`#4D586F`).
- Compteur : « {n} prêts · en attente de l'hôte ».
- Actions : **SE DÉCLARER PRÊT** (bascule ; actif → fond vert `.16`, bordure `.4`, texte `#4DF08A`, coche) et **▶ LANCER LA PARTIE** (primaire, `flex:1.4`).
- **Chat** (340px, hauteur 520px) : en-tête, liste défilante (messages alignés à droite si les siens, bulle cyan `.14` ; sinon `rgba(255,255,255,.05)`), pseudo coloré en Space Mono 10.5px, champ + bouton d'envoi cyan 42px. **Envoi fonctionnel** (Entrée ou clic).

### 5. HUD en jeu — `05-hud-en-jeu.png`
**But** : jouer — lisibilité maximale, superpositions non intrusives.

Scène 600px, rayon 20px, fond `radial-gradient(120% 120% at 50% 0%, #0B1B2A, #07101C 55%, #0A0712)`, grille cyan 38px, bandeau de scan animé (`nnScan`), ninjas répartis (opacités .5→1, celui mis en avant avec glow rose + `nnFloat`), bonus (`bolt`) et gemme, cercle pointillé rotatif (`nnSpin`).

Superpositions — toutes en `rgba(7,12,20,.72)` + `backdrop-filter: blur(8px)` :
- **Timer** (haut centre) : « TEMPS RESTANT » + **02:14** (Chakra Petch 700, 30px, cyan), bordure cyan `.30`.
- **Classement** (haut gauche, 212px) : rang (1er en or), pastille de couleur, nom (le joueur en cyan gras), score en Space Mono.
- **Bonus actifs** (bas gauche) : *Invincibilité* (bouclier cyan, « 04s restantes ») · *Révélation* (œil violet, « prêt »).
- **Minimap** (bas droite, 148×148) : grille 18px, points colorés, joueur en cyan avec glow.
- **Haut droite** : rappel touches « ZQSD · **F** localiser » + bouton **⏹ TERMINER** (rose).

### 6. Résultats — `06-resultats.png`
**But** : récompenser, montrer la progression, relancer une partie.

- En-tête centré : « PARTIE TERMINÉE · CLASSIQUE · RAINY TOKYO » puis « 2ᵉ place — **Bien joué !** ».
- **Podium** (grille `1.3fr 1fr`) : ordre 2–1–3, colonnes 120px, hauteurs **150 / 200 / 112px**, médaille, avatar rond, nom (cyan si joueur), score, socle `linear-gradient(180deg,<accent>40,<accent>0A)` avec rang en gros.
- **Progression** : « +820 XP », barre NIV 27 → NIV 28 remplie à 71%, « 6 420 / 9 000 XP ».
- **Gains** : 2 cartes — 🪙 **+140** Pièces (or) · 🏅 **+3** Points de ligue (violet).
- **Défi accompli** : bandeau vert « Défi accompli : Activez 10 bonus » / « Récompense +200 XP réclamée ».
- Actions : **↻ REJOUER** (primaire) · **ACCUEIL** (secondaire).

### 7. Profil & progression — `07-profil-progression.png`
**But** : cœur de la rétention — montrer ce qui est gagné et ce qui reste à débloquer.

- **En-tête profil** : avatar 96px avec anneau `conic-gradient(#2DE6E0 257deg,…)` et badge de niveau **27** ; nom + badge **💎 DIAMANT II** ; « Membre depuis la Saison 1 · Clan ⟨KAGE⟩ » ; barre XP (max 440px) ; 2 cartes de stats : **437** Victoires, **#312** Rang mondial.
- **Pass de saison** (dégradé rose/violet) : « PASS DE SAISON 4 · NÉON TOKYO », « Palier 24 / 50 », bouton **✦ PASSER PREMIUM** (or). Rail horizontal de paliers 18→25, colonnes 110px : numéro (or si courant, préfixe ▸ ; cyan si débloqué), **case gratuite** (cyan, coche si débloquée) et **case premium** (or, ✦ ou 🔒), chacune 74px avec icône 20px + libellé 11px. Légende Gratuit / Premium.
- **Collection de skins** : grille 3 colonnes, « 3/6 débloqués ». Vignette 108px avec ninja teinté (grisé + `brightness(.6)` si verrouillé), badge de rareté en haut à gauche, badge **ÉQUIPÉ** en haut à droite. Bouton **Équiper** / **Équipé** (grisé) / **🪙 {prix}** (or).
  Données : Kitsune (Légendaire, équipé), Oni Rouge (Épique), Spectre (Épique), Glacier (Rare, 1 200), Sakura (Rare, 1 200), Void (Légendaire, 2 500).
- **Statistiques** : grille 3 colonnes — Parties jouées 1 284 · Victoires 437 · Ratio V/D 1.94 · Ninjas capturés 8 612 · Meilleure série 12 · Temps de jeu 214h.
- **Succès** (colonne droite) : 6 entrées, icône 42×42 ; débloqué → fond cyan `.06`, bordure `.20`, « ✓ Débloqué » ; verrouillé → gris `#6B7793` / `#4D586F`.

---

## Interactions & Behavior
- **Navigation** : barre latérale (Accueil / Parties / Créer / Profil) + chemins contextuels — Accueil → *Partie rapide* → Salon ; Parties → *Rejoindre* → Salon ; Créer → *Créer le salon* → Salon ; Salon → *Lancer* → Jeu ; Jeu → *Terminer* → Résultats ; Résultats → *Rejouer* (Salon) / *Accueil*. Le défilement de la zone principale est remis à zéro à chaque changement d'écran.
- **Survols** : cartes et boutons montent de 2–3px ; les bordures prennent la couleur d'accent du contexte ; les entrées de nav s'éclaircissent.
- **Formulaires** : filtres de mode (sélection unique), sélection mode/carte/visibilité (radio), curseurs durée et faux ninjas (valeur affichée en direct), interrupteur Black Ninjas, chat (Entrée ou bouton, champ vidé après envoi, message vide ignoré).
- **Bouton Prêt** : bascule, met à jour le compteur « n prêts » du salon.
- **États à prévoir côté implémentation** (non maquettés) : chargement de la liste des salons, salon plein / code invalide, perte de connexion, erreurs de validation du formulaire de création.
- **Responsive** : les maquettes ciblent le desktop (contenu max 1280px). Points de rupture à définir — les grilles 2/3/4 colonnes doivent se réduire, et le panneau récapitulatif sticky passer sous le formulaire.

## State Management
| État | Type | Défaut | Rôle |
|---|---|---|---|
| `screen` | enum | `home` | écran courant (home, browse, create, lobby, game, results, profile) |
| `createMode` | enum | `classic` | mode sélectionné à la création |
| `createMap` | enum | `rainy` | carte sélectionnée |
| `createPrivacy` | `public` \| `private` | `public` | visibilité du salon |
| `advOpen` | bool | `false` | panneau de réglages avancés ouvert |
| `duration` | number | `180` | durée en secondes (60–600, pas 30) |
| `fakeNinjas` | number | `40` | faux ninjas au départ (10–80, pas 5) |
| `blackNinjas` | bool | `true` | activation des Black Ninjas |
| `browseFilter` | `all` \| id de mode | `all` | filtre du navigateur de parties |
| `joinCode` | string | `''` | code de partie privée (6 caractères) |
| `lobbyReady` | bool | `false` | état « prêt » du joueur |
| `chat` | message[] | 3 messages | fil de discussion du salon |
| `chatDraft` | string | `''` | message en cours de saisie |

**Données à brancher côté serveur** : liste des salons (hôte, mode, carte, joueurs, ping, statut, visibilité), joueurs du salon et état « prêt », classement live, profil (niveau, XP, rang, monnaies), paliers du pass, skins possédés/équipés, défis et leur progression, succès, statistiques.

## Modes de jeu
| id | Nom | Capacité | Icône | Couleur | Description |
|---|---|---|---|---|---|
| `classic` | Classique | 4-12 J | `ninja` | `#2DE6E0` | Capturez les vrais Ninjas cachés parmi les leurres. |
| `mirror` | Miroir | 4-8 J | `mirror` | `#8B7BFF` | Carte et contrôles inversés en symétrie parfaite. |
| `hunt` | Chasse | 5-10 J | `target` | `#FF2E7E` | Un traqueur, des proies. Survivez jusqu'au bout. |
| `royale` | Battle Royale | 8-16 J | `royale` | `#FFB23E` | La zone se rétrécit. Dernier Ninja debout gagne. |
| `teams` | Équipes | 2x4 J | `swords` | `#4DF08A` | Deux clans s'affrontent pour le contrôle du territoire. |
| `chaos` | Chaos | 6-12 J | `tornado` | `#FF5BD0` | Tous les bonus et malus, intensité maximale. |

*Classique* et *Miroir* existent déjà dans le jeu ; les quatre autres sont des propositions à valider.

## Cartes
| id | Nom | Sous-titre | Couleur |
|---|---|---|---|
| `rainy` | Rainy Tokyo | Néon · Pluie | `#2DE6E0` |
| `tokyo` | Tokyo | Urbain · Nuit | `#FF2E7E` |
| `spirit` | Spirit & Time | Vide · Infini | `#8B7BFF` |
| `shibuya` | Shibuya Cross | Foule · Chaos | `#FFB23E` |

## Système de progression (rétention)
1. **Niveaux + XP** — XP à chaque partie (+820 dans la maquette), anneau de progression visible dans l'en-tête et sur le profil.
2. **Pass de saison** — 50 paliers, piste gratuite et piste premium ; saison thématique datée (« Saison 4 · Néon Tokyo · 23 jours restants ») pour créer l'urgence.
3. **Défis quotidiens** — 3 par jour, compte à rebours de renouvellement, récompense en XP, mis en avant dès l'accueil.
4. **Skins** — 4 raretés implicites (Rare / Épique / Légendaire), achat en pièces, un seul équipé à la fois.
5. **Ligues classées** — rang affiché partout (Diamant II), points de ligue gagnés en fin de partie, rang mondial.
6. **Succès** — objectifs long terme, débloqués ou verrouillés.
7. **Monnaies** — pièces (gains de partie) et gemmes (premium).

## Assets
- **Polices** : Chakra Petch, Space Grotesk, Space Mono — Google Fonts.
- **Icônes** : SVG sur mesure définis dans `Icon.dc.html` (aucune dépendance externe, aucun emoji).
- **Placeholders à remplacer** : vignettes de cartes (dégradé + hachures + 忍), avatars joueurs (initiales sur fond coloré), visuels de skins (picto ninja teinté), scène de jeu du HUD (fond dégradé + pictos positionnés).
- Le caractère 忍 est utilisé comme motif décoratif (logo, filigranes) — à conserver ou remplacer par le vrai logo du jeu.

## Files
| Fichier | Contenu |
|---|---|
| `Neon Ninja.html` | **Prototype autonome** — s'ouvre directement dans un navigateur, hors ligne, tous les écrans navigables. À utiliser comme référence visuelle et comportementale. |
| `Neon Ninja.dc.html` | Source du prototype (structure + logique + données de démo). |
| `Icon.dc.html` | Définition des ~35 pictos SVG sur mesure (tracés exacts). |
| `screenshots/01…07-*.png` | Captures pleine taille de chaque écran (2×, 2840px de large). |

## Screens / Views — récapitulatif
| # | Écran | Capture | Rôle |
|---|---|---|---|
| 1 | Accueil | `01-accueil.png` | Lancer une partie, saison, défis, pass |
| 2 | Parties publiques | `02-parties-publiques.png` | Trouver/rejoindre un salon, code privé |
| 3 | Créer une partie | `03-creer-partie.png` | Mode, carte, visibilité, réglages avancés |
| 4 | Salon | `04-salon-lobby.png` | Joueurs, prêt, chat, lancement |
| 5 | HUD en jeu | `05-hud-en-jeu.png` | Timer, classement, bonus, minimap |
| 6 | Résultats | `06-resultats.png` | Podium, XP, récompenses |
| 7 | Profil & progression | `07-profil-progression.png` | Niveau, pass, skins, stats, succès |
