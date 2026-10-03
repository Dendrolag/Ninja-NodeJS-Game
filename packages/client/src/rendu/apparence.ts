/**
 * L'apparence du jeu: les couleurs, les tailles et les cadences de l'affichage.
 *
 * TOUT CE QUI EST ICI EST DE LA PRESENTATION, ET RIEN QUE DE LA PRESENTATION.
 * Aucune de ces valeurs n'a d'effet sur une regle de jeu: on peut toutes les
 * changer sans qu'une capture se resolve differemment. C'est ce qui justifie
 * qu'elles vivent dans le client et non dans @neon-ninja/shared, ou elles
 * voyageraient jusqu'au moteur, qui n'a que faire d'une couleur de bordure.
 *
 * Le jeu d'origine melangeait les deux: son serveur envoyait vingt fois par
 * seconde une couleur de remplissage et une couleur de bordure pour chaque zone
 * (ZONE_TYPES, server.js:187), donnees d'affichage que le client aurait pu
 * connaitre seul. Elles sont ici, et elles ne prennent plus de bande passante.
 *
 * LES VALEURS VIENNENT DU JEU D'ORIGINE. Elles sont reglees depuis deux ans et
 * on ne les redecide pas a l'occasion d'un portage: le nouveau traitement visuel
 * se discutera avec les maquettes, pas dans un fichier de constantes.
 */

import type { NatureObjet, TypeBonus, TypeZone } from '@neon-ninja/shared';
import { RACINE_RESSOURCES, cheminObjet } from '@neon-ninja/shared';

/** Une couleur d'affichage et son opacite, separees pour PixiJS qui les veut ainsi. */
export interface Teinte {
  /** Couleur au format hexadecimal, sans opacite. */
  readonly couleur: number;
  /** Opacite, de zero a un. */
  readonly alpha: number;
}

/** Couleur du vide autour de la carte. Portage du fond du canevas d'origine. */
export const COULEUR_FOND = 0x2c3e50;

/** Le trait blanc qui marque les limites du terrain. */
export const BORDURE_TERRAIN = {
  couleur: 0xffffff,
  alpha: 0.5,
  epaisseur: 4,
} as const;

/** Taille d'affichage d'une entite, en pixels de la carte. */
export const TAILLE_SPRITE = 32;

/**
 * La marge autour de ce que la camera montre, en pixels de la carte, en deca de laquelle
 * un personnage est encore mis a jour (etape 5.7). Au-dela, il est cache et ne coute plus
 * rien.
 *
 * Un personnage est repere par son centre. Il faut donc que la marge couvre ce qui en
 * depasse: la demi-diagonale d'un sprite couche en biais (un cadavre du Massacre, 23
 * pixels), plus la plus forte secousse du katana, qui decale le monde sans deplacer la
 * camera (8,5 pixels). Deux sprites entiers laissent de quoi voir venir: rien n'apparait
 * d'un coup au bord de l'ecran.
 */
export const MARGE_HORS_CHAMP_PX = 2 * TAILLE_SPRITE;

/**
 * Densite de pixels maximale du rendu.
 *
 * Au-dela, l'oeil ne gagne rien et le telephone paie tout: a densite 3, chaque image
 * et la lueur qui la recouvre coutent neuf fois les pixels d'un ecran ordinaire, et
 * la partie saccadait sur iPhone (recette de l'etape 5.4). Le jeu d'origine dessinait
 * a densite 1.
 */
export const DENSITE_MAXIMALE = 2;

/**
 * Quand l'affichage d'une partie qui commence est juge fluide (stabilite.ts).
 *
 * Mesure de la recette de l'etape 5.4, sur un telephone simule: les premieres images
 * dessinees portaient des taches longues de 100 a 150 millisecondes (le decor envoye a
 * la carte graphique, la lueur preparee), puis l'affichage tenait soixante images par
 * seconde. L'ecran de preparation reste pose tant que l'affichage n'est pas fluide, et
 * jamais plus de trois secondes: au-dela, le joueur voit la partie meme si elle rame,
 * plutot qu'un ecran qui ne se leve pas.
 *
 * RESSERRE A L'ETAPE 8.5, SUR MESURE DU VRAI TELEPHONE. La regle d'origine, trois images
 * d'affilee sous 100 millisecondes, se levait trop tot: sur un iPhone 14 Pro, les trois
 * releves de la recette portent une image de 131 a 257 millisecondes vers 0,15 a 0,26 s,
 * PixiJS envoyant encore une texture (jusqu'a 52 ms de son temps), apres trois images
 * rapides. Le joueur voyait donc la partie se figer a son tout debut. On exige desormais
 * une demi-seconde d'images fluides: trente d'affilee, chacune sous deux images a 60 Hz.
 */
export const STABILITE = {
  imagesRapidesRequises: 30,
  dureeImageRapideMs: 34,
  attenteMaximaleMs: 3000,
} as const;

/**
 * Quelle part de chaque pixel du sprite de ninja prend la couleur de son proprietaire.
 *
 * LE SPRITE EST DESSINE EN ROUGE, pas en niveaux de gris, et son corps est adouci vers
 * son contour presque noir: un pixel de bord est un melange du rouge pur et d'un detail
 * neutre (contour, gris, blanc des yeux). Pour un fond neutre, la part de rouge vaut
 * exactement (rouge - max(vert, bleu)) / 255 (recoloration.ts).
 *
 * Le jeu d'origine repeignait en entier tout pixel a moins de 140 du rouge pur, et
 * laissait les autres intacts (TARGET_COLOR et COLOR_TOLERANCE, legacy/client.js:493):
 * le bord adouci devenait un escalier borde de rouge. Ecart voulu, au rendu seul, de
 * l'etape 4.8 (docs/plan/etape-4-8.md).
 *
 * Deux seuils, cales sur les dix-sept images du jeu:
 *
 *   - ecartNeutre: au-dela de cet ecart entre le vert et le bleu, le pixel n'est pas un
 *     melange avec un neutre. La peau (249, 202, 157) et ses ombres brunes restent des
 *     details intacts.
 *   - excesMinimum: en deca de cet exces du rouge sur le vert et le bleu, le pixel est un
 *     neutre. Le contour (31, 29, 25) n'est pas teint.
 */
export const REPEINTE_DU_NINJA = {
  ecartNeutre: 18,
  excesMinimum: 8,
} as const;

/**
 * Cadence d'alternance des deux images de marche, en millisecondes.
 *
 * Le gestionnaire de sprites d'origine changeait d'image toutes les 150
 * millisecondes.
 */
export const CADENCE_MARCHE_MS = 150;

/**
 * En dessous de cette distance parcourue entre deux battements, une entite est
 * consideree immobile et affiche son image d'attente.
 *
 * Le jeu d'origine comparait la position a la precedente avec un seuil de 0,1
 * pixel. On garde l'idee, avec un seuil exprime par battement.
 */
export const SEUIL_IMMOBILITE_PX = 0.1;

/**
 * Au-dela de cette distance entre deux battements, on ne lisse pas: on saute.
 *
 * Un joueur capture reapparait a l'autre bout de la carte. Interpoler ce saut le
 * ferait glisser en ligne droite a travers les murs pendant un cinquantieme de
 * seconde, ce qui se voit et se comprend mal. La valeur est large devant ce
 * qu'une entite peut parcourir en un battement (un joueur avance de 7,5 pixels
 * en 50 millisecondes, 15 avec le bonus de vitesse) et petite devant un
 * deplacement d'apparition.
 */
export const SEUIL_SAUT_PX = 150;

/** Aspect d'un halo pose sous une entite ou un objet. */
export interface Halo {
  /** Rayon au repos, en pixels de la carte. */
  readonly rayon: number;
  /** Amplitude de la pulsation, en pixels. */
  readonly amplitude: number;
  /** Vitesse de la pulsation, en radians par milliseconde. */
  readonly cadence: number;
  readonly teinte: Teinte;
}

/**
 * Les halos que porte notre propre personnage quand un bonus est actif.
 *
 * Valeurs du jeu d'origine (drawEntities, client.js:3298 et suivantes).
 */
export const HALO_BONUS: Readonly<Record<TypeBonus, Halo>> = {
  vitesse: {
    rayon: 25,
    amplitude: 5,
    cadence: 0.006,
    teinte: { couleur: 0x00ff00, alpha: 0.2 },
  },
  invincibilite: {
    rayon: 20,
    amplitude: 5,
    cadence: 0.004,
    teinte: { couleur: 0xffd700, alpha: 0.3 },
  },
  revelation: {
    rayon: 15,
    amplitude: 3,
    cadence: 0.005,
    teinte: { couleur: 0xff00ff, alpha: 0.2 },
  },
};

/**
 * Le halo magenta pose sur les AUTRES joueurs pendant une revelation.
 *
 * C'est tout l'interet du bonus: distinguer les vrais joueurs des faux ninjas.
 */
export const HALO_REVELATION_AUTRUI: Halo = {
  rayon: 25,
  amplitude: 3,
  cadence: 0.005,
  teinte: { couleur: 0xff00ff, alpha: 0.2 },
};

/** Le halo rouge pulsant d'un bot noir, qui signale le danger de loin. */
export const HALO_BOT_NOIR: Halo = {
  rayon: 13,
  amplitude: 2,
  cadence: 0.01,
  teinte: { couleur: 0xff0000, alpha: 0.5 },
};

/** Le disque rouge diffus qui montre le rayon de detection d'un bot noir. */
export const TEINTE_DETECTION_BOT_NOIR: Teinte = { couleur: 0xff0000, alpha: 0.1 };

/**
 * Les yeux rouges du Black Ninja (etape 5.8, marque A de la planche
 * docs/design/etape-5-8/1-couleurs-et-black-ninja.png): les reflets clairs et neutres de son
 * masque, plus clairs que la clarte sur chaque composante et d'un ecart entre composantes
 * plus petit que l'ecart, prennent la couleur; une lueur rouge pale, sous sa tete, les fait
 * briller, sans filtre.
 */
export const YEUX_DU_BLACK_NINJA = {
  couleur: 0xff3232,
  clarte: 110,
  ecart: 40,
  lueur: { decalageY: -2, rayon: 15, alpha: 0.4, amplitude: 0.15, cadence: 0.006 },
} as const;

/**
 * L'aura de fumee du Black Ninja (etape 5.8, marque C de la planche): des volutes sombres
 * violacees qui tournent autour de lui, sous les personnages. Chaque volute a sa distance et
 * sa taille, de trois sortes, et le tout fait un tour en tourMs.
 */
export const AURA_DU_BLACK_NINJA = {
  volutes: 9,
  couleur: 0x3a1056,
  alpha: [0.6, 0.48, 0.36],
  distance: [17, 20, 23],
  rayon: [6, 7, 8],
  /** Les volutes s'ecrasent en hauteur, et montent avec leur sorte. */
  ecrasement: 0.6,
  montee: 3,
  tourMs: 5600,
} as const;

/** L'ombre portee sous notre personnage, qui aide a le retrouver. */
export const OMBRE_JOUEUR = {
  rayon: 12,
  decalageY: 10,
  teinte: { couleur: 0x000000, alpha: 0.2 },
} as const;

/** Opacite de notre personnage quand il est cache dans une zone d'invisibilite. */
export const ALPHA_INVISIBLE = 0.3;

/**
 * Le libelle et la couleur de chaque zone speciale.
 *
 * Les libelles sont ceux du jeu d'origine (ZONE_TYPES); ils ne s'ecrivent plus sur la zone
 * depuis l'etape 7.12, mais nomment les zones dans l'aide et les reglages. Les couleurs sont
 * les teintes d'origine poussees en neon, choisies sur la planche
 * docs/design/etape-7-12/1-zones.png: rouge du chaos, bleu de la repulsion, vert de
 * l'attraction, violet de l'invisibilite. La mine de zone qui cache une zone en a la couleur.
 */
export const APPARENCE_ZONE: Readonly<
  Record<TypeZone, { readonly libelle: string; readonly couleur: number }>
> = {
  chaos: { libelle: 'Zone de chaos', couleur: 0xff4d4d },
  repulsion: { libelle: 'Zone répulsive', couleur: 0x4f7dff },
  attraction: { libelle: 'Zone attractive', couleur: 0x3ddc6a },
  invisibilite: { libelle: "Zone d'invisibilité", couleur: 0xb05cff },
};

/**
 * Le rendu des zones ouvertes (etape 7.12): le rendu B de la planche
 * docs/design/etape-7-12/1-zones.png, un motif vivant qui montre l'effet, choisi par le
 * porteur du projet le 2 octobre 2026. Les durees sont en millisecondes, les tailles en
 * pixels de la carte. Voir zones.ts, dans ce dossier.
 */
export const APPARENCE_ZONES = {
  /** Le fond du disque, a peine teinte. */
  fond: 0.14,
  /** Le bord neon, et le halo plus large et plus pale qui le fait rayonner. */
  bord: { alpha: 0.95, epaisseur: 5 },
  halo: { alpha: 0.3, epaisseur: 14 },
  /** Les traits du motif. */
  motif: { alpha: 0.85, epaisseur: 3 },
  /** Les trois dernieres secondes, la zone palit et son bord clignote. */
  fin: { dureeMs: 3000, palit: 0.45, clignotementMs: 250 },
  /** Le pictogramme, pose sur le bord, en haut: un disque blanc cerne, le dessin en noir. */
  pictogramme: { rayon: 20, fond: 0xf4f6fb, cerne: 0x111111, dessin: 0x111111, trait: 3 },
  /** Chaos: des eclairs qui crepitent, renouveles a chaque periode, a des places au hasard. */
  chaos: { eclairs: 12, tailleMin: 22, tailleMax: 38, periodeMs: 180 },
  /** Repulsion et attraction: des ondes qui partent du centre ou y reviennent, et des chevrons. */
  ondes: { nombre: 3, periodeMs: 2400, chevrons: 8, place: 0.8, taille: 16, course: 0.06 },
  /** Invisibilite: un voile plus dense, et des lignes de brume qui ondulent. */
  voile: { fond: 0.22, ecart: 30, amplitude: 7, longueurDOnde: 60, periodeMs: 3000 },
} as const;

/**
 * La mine de zone (etape 7.12), rendus choisis par le porteur du projet sur la planche
 * docs/design/etape-7-12/2-mine-de-zone.png: A, B, B. Posee, la mine ronde de l'etape 7.11,
 * plus grande, l'anneau a la couleur de la zone qu'elle cache et son pictogramme au centre;
 * armee, le bord de la zone se trace en 3 secondes; ouverte, la zone gonfle depuis la mine.
 */
export const APPARENCE_MINE_DE_ZONE = {
  rayon: 11,
  rayonAnneau: 7.6,
  epaisseurAnneau: 2.6,
  /** Le disque blanc du pictogramme, au centre. */
  rayonPictogramme: 4.6,
  /** Le halo a la couleur de la zone, qui respire posee et clignote armee. */
  rayonHalo: 16,
  halo: 0.3,
  /** Armee: le bord de la zone a venir, pale en entier, et trace a mesure du decompte. */
  bordAVenir: { alpha: 0.25, epaisseur: 1.5 },
  bordTrace: { alpha: 0.95, epaisseur: 3 },
  /** Un sommet du trace tous les tant de radians. */
  pasDuTrace: Math.PI / 48,
  /** Ouverte: la zone gonfle jusqu'a son rayon en tant de millisecondes. */
  gonflementMs: 300,
} as const;

/**
 * Les couleurs des trois familles d'objets du Tactique (etape 7.7): le tir (Rafale et Tir
 * unique), la recharge, et la visee, qui reprend le violet pale du cone.
 */
export const COULEURS_TACTIQUES = {
  tir: 0xffae2e,
  recharge: 0x3ee6ff,
  visee: 0xcc99ff,
} as const;

/**
 * Couleur et libelle de chaque bonus et de chaque malus, portage des tables du client d'origine.
 *
 * Les libelles sont lus par le joueur: ils portent leurs accents. L'etape 4.2 les
 * avait ecrits sans, ce qui ne se voyait pas tant qu'aucune page ne les affichait.
 */
export const APPARENCE_OBJET: Readonly<
  Record<NatureObjet, { readonly libelle: string; readonly couleur: number }>
> = {
  vitesse: { libelle: 'Boost', couleur: 0x00ff00 },
  invincibilite: { libelle: 'Invincibilité', couleur: 0xffd700 },
  revelation: { libelle: 'Révélation', couleur: 0xff00ff },
  controlesInverses: { libelle: 'Contrôles inversés', couleur: 0xff4444 },
  flou: { libelle: 'Vision floue', couleur: 0x44aaff },
  negatif: { libelle: 'Vision négative', couleur: 0xaa44ff },
  // Les objets du Tactique (etape 7.7): une couleur par paire, un bonus et son contraire,
  // decision du porteur du projet du 19 septembre 2026. La couleur dit ce qui change,
  // le pictogramme dans quel sens.
  rafale: { libelle: 'Rafale', couleur: COULEURS_TACTIQUES.tir },
  tirUnique: { libelle: 'Tir unique', couleur: COULEURS_TACTIQUES.tir },
  rechargeRapide: { libelle: 'Recharge rapide', couleur: COULEURS_TACTIQUES.recharge },
  rechargeLente: { libelle: 'Recharge lente', couleur: COULEURS_TACTIQUES.recharge },
  viseeLarge: { libelle: 'Visée large', couleur: COULEURS_TACTIQUES.visee },
  viseeEtroite: { libelle: 'Visée étroite', couleur: COULEURS_TACTIQUES.visee },
  // La fumee (etape 7.10): un gris de brume, qui tranche sur les neons sans leur ressembler.
  fumee: { libelle: 'Fumée', couleur: 0xb8c4d6 },
  // La mine (etape 7.11): le rouge orange de sa diode et de son explosion.
  mine: { libelle: 'Mine', couleur: 0xff5a3c },
};

/**
 * Le nuage de la fumee (etape 7.10), rendu C de la planche docs/design/etape-7-10/, choisi par
 * le porteur du projet: un nuage cerne comme les sprites, qui gonfle, cache le ninja, puis se
 * dissipe en bouffees qui montent. Un au depart, un plus petit a l'arrivee.
 *
 * Les lobes et les bouffees sont en pixels du sprite (32 de cote), a l'echelle du depart.
 */
export const APPARENCE_FUMEE = {
  /**
   * Duree de vie du nuage de depart, en millisecondes. Il traine sur place, la ou les
   * poursuivants ont perdu le ninja (allongee de 600 a 1800 a la recette de l'etape 7.10).
   */
  dureeDepartMs: 1800,
  /** Duree de vie du nuage d'arrivee, un peu plus courte: le ninja doit en sortir vite. */
  dureeArriveeMs: 900,
  /** Le nuage d'arrivee, plus petit que celui du depart: le ninja y reparait. */
  echelleArrivee: 0.8,
  /**
   * Le nuage gonfle pendant ce temps, en millisecondes, quelle que soit sa duree de vie: le
   * pouf reste vif, c'est sa tenue qui s'allonge.
   */
  gonflementMs: 180,
  /** Il reste plein jusqu'a cette part de sa vie, puis palit. */
  partPleine: 0.55,
  /** Les bouffees montent a partir de cette part de sa vie. */
  partDesBouffees: 0.35,
  /** Combien de pixels de la carte vaut un pixel du dessin, au depart. */
  echelle: 0.77,
  brume: 0xb8c4d6,
  clair: 0xeef2fa,
  cerne: 0x6f7c96,
  /** Les lobes: decalage en x, en y, et rayon. */
  lobes: [
    [-12, 2, 10],
    [-5, -7, 11],
    [6, -8, 11],
    [13, 1, 10],
    [6, 9, 10],
    [-6, 9, 10],
    [0, 0, 12],
  ],
  /** Les bouffees qui montent a la fin: decalage en x, et rayon. */
  bouffees: [
    [-8, 4],
    [3, 5],
    [12, 3.5],
  ],
} as const;

/**
 * La mine posee (etape 7.11), rendus choisis par le porteur du projet sur la planche
 * docs/design/etape-7-11/1-mine.png: la mine ronde A, le reflet A pour les adversaires, le
 * rayon B une fois armee, la boule de feu B a l'explosion.
 *
 * Les mesures sont en pixels de la carte.
 */
export const APPARENCE_MINE = {
  /** Le disque de metal, cerne comme les sprites. */
  rayon: 9,
  metal: 0x2b3142,
  metalClair: 0x4a5470,
  cerne: 0x111111,
  /** L'anneau a la couleur du poseur. */
  rayonAnneau: 6.2,
  epaisseurAnneau: 2.2,
  /** La diode au centre: allumee, eteinte, et son halo. */
  diode: 0xff2d3a,
  diodeEteinte: 0x5a1a22,
  rayonDiode: 2.2,
  rayonHaloDiode: 6,
  /** Posee et vue de son camp, la diode respire lentement: une periode, en millisecondes. */
  respirationMs: 1600,
  /** Le reflet que voient les adversaires: toutes les periodeMs, pendant dureeMs. */
  reflet: { periodeMs: 2000, dureeMs: 200, taille: 7 },
  /** La Revelation cerne la mine de son violet. */
  revelation: { couleur: 0xb98cff, rayon: 13, epaisseur: 2, alpha: 0.9 },
  /**
   * Armee: la diode clignote de plus en plus vite, d'une periode de depart a une periode
   * d'arrivee, et un cercle pointille rouge marque le rayon de l'explosion.
   */
  clignotement: { departMs: 400, arriveeMs: 70 },
  rayonArme: {
    remplissage: { couleur: 0xff2d3a, alpha: 0.08 },
    trait: 0xff2d3a,
    alpha: 0.75,
    epaisseur: 2,
    /** Les pointilles: un tiret, puis un vide, en pixels. */
    tiret: 10,
    vide: 8,
  },
  /** La boule de feu: elle remplit le rayon, puis se dissipe. */
  explosion: {
    dureeMs: 450,
    gonflementMs: 220,
    /** Orange au debut, puis rouge. */
    orangeMs: 120,
    orange: 0xffb347,
    rouge: 0xff5a3c,
    clair: 0xffe28a,
    cerne: 0x111111,
    /** Les lobes: decalage en x, en y, et rayon, pour un rayon d'explosion de 130 pixels. */
    lobes: [
      [0, 0, 55],
      [-60, -20, 45],
      [55, -30, 45],
      [-40, 45, 42],
      [45, 45, 42],
      [0, -65, 40],
      [-75, 25, 30],
      [78, 18, 30],
    ],
  },
} as const;

/**
 * L'Evade (etape 7.9): ses rayures, son halo, et la marque du joueur qui porte son x2.
 *
 * Rendus choisis par le porteur du projet sur la planche docs/design/etape-7-9/: le skin C,
 * rayures larges et halo pulse rouge et blanc, qui le fait reperer dans la foule; la marque
 * C, un anneau raye autour du porteur et un badge « x2 » au-dessus de sa tete, visibles de
 * tous.
 */
export const APPARENCE_EVADE = {
  /** Les deux couleurs de ses rayures, et de tout ce qui le rappelle. */
  rouge: 0xe3262e,
  blanc: 0xf6f6f6,
  /** L'epaisseur d'une bande de son corps, en lignes de pixels du sprite. */
  bande: 2,
  /** Son halo: un disque blanc qui pulse... */
  halo: {
    rayon: 20,
    amplitude: 4,
    cadence: 0.008,
    teinte: { couleur: 0xf6f6f6, alpha: 0.28 },
  } satisfies Halo,
  /** ...cerne de rouge. */
  cerne: { couleur: 0xe3262e, alpha: 0.75, epaisseur: 2 },
  /** La marque du porteur du x2. */
  marque: {
    /** Rayon de l'anneau, en pixels de la carte. */
    rayon: 19,
    /** Epaisseur de l'anneau. */
    epaisseur: 2.4,
    /** Nombre de segments de l'anneau, alternativement rouges et blancs. */
    segments: 16,
    /** Duree d'un tour complet de l'anneau, en millisecondes. */
    tourMs: 4000,
    /** Le badge au-dessus de la tete: sa taille, et son ecart au centre du ninja. */
    badge: { largeur: 20, hauteur: 11, hauteurAuDessus: 26 },
  },
} as const;

/**
 * L'adresse de l'icone d'un objet, telle que la page la demande.
 *
 * UN SEUL ENDROIT pour l'aide, le HUD et les annonces (etape 4.6): l'objet se montre partout
 * avec la meme icone que sur la carte. Le fichier est une planche de deux images; qui
 * l'affiche n'en montre qu'une a la fois.
 */
export function adresseDeLIcone(nature: NatureObjet): string {
  return `${RACINE_RESSOURCES}/${cheminObjet(nature)}`;
}

/**
 * Le repere qui designe notre personnage quand on le cherche: une onde qui se referme.
 *
 * Etape 7.8, rendu A des maquettes (docs/design/etape-7-8/), choisi par le porteur du
 * projet le 20 septembre 2026. Deux anneaux a notre couleur, cernes de blanc, se
 * resserrent sur le ninja, decales d'un demi-cycle, et un anneau d'ancrage discret reste
 * autour de lui.
 *
 * AVANT, C'ETAIENT QUATRE TRIANGLES ROUGES cernes de blanc, poses a quatre-vingts pixels et
 * pointes vers le personnage (drawPlayerLocator du jeu d'origine, client.js:3498). Le rouge
 * ne tenait pas dans la palette du jeu, et se confondait avec le halo des Black Ninjas.
 */
export const REPERE_LOCALISATION = {
  /** Rayon d'un anneau au depart de sa course, en pixels de la carte. */
  rayonDeDepart: 78,
  /** Rayon a la fin de sa course, juste autour du personnage. */
  rayonDArrivee: 30,
  /** Duree d'une onde, en millisecondes. */
  cycleMs: 900,
  /** Avance du second anneau sur le premier, en part de cycle. */
  decalage: 0.5,
  /** Rayon de l'anneau d'ancrage, qui ne bouge pas. */
  rayonDAncrage: 26,
  /** Opacite de l'anneau d'ancrage. */
  alphaDAncrage: 0.35,
  /** Epaisseur de l'anneau d'ancrage. */
  epaisseurDAncrage: 1.5,
  /** Epaisseur du trait de notre couleur. */
  epaisseur: 2.5,
  /** Epaisseur du trait blanc pose dessous, qui cerne le premier. */
  epaisseurDuCerne: 4.5,
  /** Opacite du trait blanc, rapportee a celle de l'anneau. */
  alphaDuCerne: 0.5,
  /** Opacite d'un anneau au depart de sa course. Elle tombe a zero a l'arrivee. */
  alphaAuDepart: 0.85,
  /** Couleur du cerne. */
  cerne: 0xffffff,
} as const;

/**
 * Combien de temps les fleches restent visibles, en millisecondes, fondu compris.
 *
 * Valeurs du jeu d'origine: deux secondes a la demande du joueur, trois secondes
 * et demie a l'entree en partie et apres une capture, avec une demi-seconde de
 * fondu dans les deux cas.
 */
export const DUREES_LOCALISATION = {
  demandeeMs: 2000,
  automatiqueMs: 3500,
  fonduMs: 500,
} as const;

/** Rayon du halo pose sous un objet ramassable. */
export const RAYON_HALO_OBJET = 22;

/** Taille d'affichage de l'icone d'un objet ramassable. */
export const TAILLE_OBJET = 30;

/** Cadence du clignotement d'un objet sur le point de disparaitre, en radians par milliseconde. */
export const CADENCE_CLIGNOTEMENT = 0.01;

/**
 * Duree de chaque image de l'icone animee d'un objet, en millisecondes.
 *
 * Le jeu d'origine animait ses icones a huit images par seconde (BONUS_SPRITES et
 * MALUS_SPRITES, legacy/client.js:2888).
 */
export const CADENCE_OBJET_MS = 125;

/**
 * La pluie de Tokyo, quand la partie la fait tomber (reglage pluie, etape 7.6).
 *
 * Valeurs du jeu d'origine (RainEffect, legacy/js/MapManager.js): une image toutes
 * les cent millisecondes, posee par-dessus le fond a trente pour cent d'opacite.
 */
export const PLUIE = {
  /** Duree de chaque image de la planche, en millisecondes. */
  cadenceMs: 100,
  /** Opacite de la pluie posee sur le fond. */
  opacite: 0.3,
} as const;

/**
 * Le lointain d'une carte, qui glisse moins vite que le terrain (etape 8.8).
 *
 * L'AMPLITUDE EST UNE MESURE, PAS UN GOUT. Le lointain de Spirit & Time a un trou
 * noir en son centre, cache par le toit-terrasse; le premier pixel par ou l'on voit
 * le lointain en est a 139 pixels. Tant que le lointain ne s'ecarte pas de plus de
 * 138 pixels de sa place, le trou reste cache: un test le verifie sur les images
 * livrees (parallaxe.test.ts). 120 garde une marge.
 */
export const LOINTAIN = {
  /** Le plus grand ecart du lointain a sa place, en pixels de carte, sur chaque axe. */
  amplitudePx: 120,
  /**
   * La plus grande part du mouvement de la camera que le lointain suit. Au-dela de la
   * moitie, sur une vue a peine plus petite que la carte, il paraitrait colle a l'ecran.
   */
  partMaximale: 0.5,
} as const;

/**
 * Le vaisseau qui survole la Station lunaire (etape 8.9), et son ombre.
 *
 * Sa course se calcule dans vaisseau.ts; ce sont ici ses reglages, a juger en jouant. Les
 * distances sont en pixels de carte, les durees en millisecondes.
 */
export const VAISSEAU = {
  /** La taille affichee, en part de l'image livree (683 sur 769): 478 sur 538 au sol. */
  echelle: 0.7,
  /**
   * Son altitude, en part de son ecart a la camera: il se dessine ecarte d'autant du centre
   * de l'ecran, et grandi d'autant, comme ce qui est plus pres de l'oeil. C'est ce qui le
   * separe de son ombre quand la camera bouge.
   */
  altitude: 0.15,
  /** Sa vitesse pendant le survol, a peu pres: le nombre de points de passage s'y adapte. */
  vitesseDeSurvolPxParS: 20,
  /** La duree de l'arrivee et celle du depart, au plus. */
  dureeDeManoeuvreMs: 20_000,
  /** La part de la partie que chaque manoeuvre prend au plus, sur une partie courte. */
  partMaximaleDeManoeuvre: 0.2,
  /**
   * Jusqu'ou hors de la carte il entre et sort: plus que sa demi-diagonale affichee,
   * altitude comprise, pour n'etre vu ni naitre ni disparaitre.
   */
  margeHorsCartePx: 450,
  /** Ou ses points de passage se tirent: le milieu de la carte, la station. */
  zoneDeSurvol: { minimum: 0.2, maximum: 0.8 },
  /** L'ecart minimum entre deux points de passage, pour une course sans lacet. */
  ecartMinimumPx: 300,
  /** Combien de points de courbe entre deux points de passage. */
  finesseDeLaCourbe: 24,
  /**
   * Le decalage de son ombre au sol: le soleil vient d'en haut a gauche, comme le dit
   * l'ombre de la station dans le decor de jour. En miroir, il change de cote avec le decor.
   */
  soleil: { x: 110, y: 80 },
  /** L'opacite de l'ombre, de jour. De nuit, il n'y en a pas. */
  opaciteDeLOmbre: 0.35,
  /** Le flou du bord de l'ombre, en pixels de l'image livree. */
  flouDeLOmbrePx: 6,
  /** La teinte du vaisseau de nuit: assombri, pour ne pas briller sur un decor eteint. */
  teinteDeNuit: 0x8a93b0,
  /**
   * Son opacite quand il passe au-dessus de notre ninja: assez pour qu'on s'y voie toujours
   * (critere 11 de la competence des cartes). Il cache les autres, pas nous.
   */
  opaciteAuDessusDeNous: 0.4,
  /** Le rayon, autour de son centre affiche, ou il s'efface au-dessus de nous. */
  rayonDEffacementPx: 230,
  /** La bande ou il passe de transparent a opaque, au bord de ce rayon. */
  fonduPx: 80,
} as const;

/**
 * Le cone du mode Tactique (etape 7.1): notre visee, et l'eclair d'un tir.
 *
 * Valeurs de la version 0.9.0 du jeu d'origine (drawCaptureRange): un violet pale,
 * a peine visible pour la visee et franc pour un tir reussi, rouge pour un tir sans
 * effet, et une animation de 300 millisecondes ou le cone grandit de moitie en
 * s'effacant. La visee palit quand il ne reste aucune charge.
 */
export const APPARENCE_TIR = {
  visee: {
    remplissage: { couleur: 0xcc99ff, alpha: 0.08 },
    contour: { couleur: 0xcc99ff, alpha: 0.25, epaisseur: 1 },
  },
  viseeDesarmee: {
    remplissage: { couleur: 0x808080, alpha: 0.04 },
    contour: { couleur: 0x808080, alpha: 0.15, epaisseur: 1 },
  },
  reussi: 0xcc99ff,
  manque: 0xff4444,
  dureeMs: 300,
  agrandissement: 0.5,
} as const;

/**
 * L'impact d'un tir sur un bot noir, dans le mode Tactique (revision du 3 octobre 2026 de l'etape 7.1): un eclat blanc au
 * coeur et un anneau qui s'elargit en s'effacant, pour confirmer que le tir a porte sans
 * que le bot noir ne tombe. Le deuxieme coup, qui le laisse a un tir de la fin, est plus
 * large et plus vif que le premier.
 */
export const APPARENCE_IMPACT_BOT_NOIR = {
  dureeMs: 420,
  eclat: 0xffffff,
  anneau: 0xff3b3b,
  /** Rayon de l'anneau au depart et a la fin, en pixels, pour le premier coup. */
  rayonDepart: 10,
  rayonFin: 34,
  /** Ce que chaque coup de plus ajoute au rayon final, en proportion. */
  gainParCoup: 0.35,
  epaisseurAnneau: 3,
} as const;

/**
 * Le katana du mode Massacre (etape 7.4): la visee, la trainee du coup, l'eclat des morts,
 * les cadavres, le sang discret et la secousse de la camera.
 *
 * Tout en code, sans image (docs/design/idee-mode-massacre.md): une trainee claire en
 * croissant qui balaie l'arc en un peu plus d'un dixieme de seconde puis s'efface, plus vive
 * quand le combo monte; un eclat sur chaque mort; le sprite du ninja couche, assombri, qui
 * s'efface; une legere secousse quand notre coup tranche.
 */
export const APPARENCE_KATANA = {
  visee: {
    remplissage: { couleur: 0xff8a8a, alpha: 0.06 },
    contour: { couleur: 0xff8a8a, alpha: 0.22, epaisseur: 1 },
  },
  viseeEnGarde: {
    remplissage: { couleur: 0x808080, alpha: 0.03 },
    contour: { couleur: 0x808080, alpha: 0.12, epaisseur: 1 },
  },
  /** La trainee du coup: sa duree, sa couleur, et la largeur de la lame qui balaie. */
  trainee: {
    dureeMs: 140,
    couleur: 0xffe8e8,
    /** La couleur quand le multiplicateur a atteint son plafond. */
    couleurDuCombo: 0xff3040,
    demiLargeur: 0.35,
    /** Ce qui reste de l'arc entier, a peine visible, pendant qu'il s'efface. */
    alphaDeLArc: 0.22,
  },
  /** L'eclat d'une mort: un disque clair qui grandit en s'effacant. */
  eclat: { dureeMs: 220, couleur: 0xfff0f0, rayonDeDepart: 6, rayonDArrivee: 26 },
  /**
   * Le cadavre: le ninja couche, dans la couleur du mort assombrie (etape 5.5; une teinte
   * fixe avant), qui s'efface sur sa derniere seconde.
   */
  cadavre: { dureeMs: 3500, effacementMs: 1000, assombrissement: 0.6, alpha: 0.85 },
  /** Le sang discret: une petite tache qui s'efface d'elle-meme. */
  sangDiscret: { dureeMs: 4000, echelle: 0.45 },
  /** Le micro-arret de l'impact: le mouvement affiche se fige, en millisecondes. */
  microArretMs: 40,
  /** La secousse de la camera quand notre coup tranche, en pixels de carte. */
  secousse: { dureeMs: 120, amplitudePx: 2.5, parCran: 0.6 },
} as const;

/**
 * Reglage de la lueur neon, appliquee en filtre GPU sur le calque des reperes.
 *
 * Elle fait rayonner les fleches de localisation, comme le shadowBlur rouge du jeu
 * d'origine (client.js:3556), le seul qu'il posait. Aucun personnage ne rayonne:
 * posee sur le calque des ninjas jusqu'a l'etape 5.4, elle entourait d'un halo
 * tout ninja de couleur claire.
 */
export const LUEUR = {
  /** Force du halo lumineux ajoute autour de ce qui est clair. */
  intensite: 1,
  /** Rayon du flou, en pixels d'ecran. */
  flou: 8,
  /** Seuil de luminosite a partir duquel un pixel se met a rayonner. */
  seuil: 0.35,
} as const;

/** Vitesse de suivi de la camera, en fraction rattrapee par seconde. */
export const VITESSE_CAMERA_PAR_SECONDE = 5;

/**
 * Hauteur de vue visee sur ordinateur, en pixels de la carte.
 *
 * Le zoom s'en deduit: on montre toujours a peu pres la meme portion de terrain,
 * quelle que soit la taille de la fenetre. Valeur du jeu d'origine
 * (initializeCamera, client.js:1216).
 */
export const HAUTEUR_DE_VUE_PX = 900;

/**
 * Hauteur de vue du Tactique sur ordinateur, en pixels de la carte (etape 7.7).
 *
 * Plus proche, pour qu'on voie moins loin et qu'il faille chercher ses cibles: 31 pour
 * cent de la surface visible d'ordinaire. Decision du porteur du projet du 19 septembre
 * 2026, sur la planche docs/design/etape-7-7/4-zoom.png. Le telephone garde son cadrage,
 * deja serre.
 */
export const HAUTEUR_DE_VUE_TACTIQUE_PX = 500;

/**
 * Largeur et hauteur de reference du cadrage mobile, plus serre.
 *
 * ECART VOULU AVEC LE JEU D'ORIGINE, qui montrait 600 par 451 pixels de carte
 * (initializeCamera, client.js:1222). Sur telephone, le porteur du projet l'a juge
 * trop large a la recette de l'etape 5.4, et a choisi 360 pixels de large; la
 * hauteur garde les proportions d'origine.
 */
export const CADRAGE_MOBILE = { largeur: 360, hauteur: 271 } as const;
