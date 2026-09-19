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
 * seconde. L'ecran de preparation reste pose tant que trois images d'affilee ne sont
 * pas passees sous 100 millisecondes, et jamais plus de trois secondes: au-dela, le
 * joueur voit la partie meme si elle rame, plutot qu'un ecran qui ne se leve pas.
 */
export const STABILITE = {
  imagesRapidesRequises: 3,
  dureeImageRapideMs: 100,
  attenteMaximaleMs: 3000,
} as const;

/**
 * Quels pixels du sprite de ninja prennent la couleur de son proprietaire.
 *
 * LE SPRITE EST DESSINE EN ROUGE, pas en niveaux de gris. Le jeu d'origine
 * repeignait tout pixel dont chaque composante est a moins de la tolerance du
 * rouge pur, et laissait les autres intacts: le contour, les yeux, les ombres
 * gardent leurs couleurs (TARGET_COLOR et COLOR_TOLERANCE, legacy/client.js:493).
 */
export const REPEINTE_DU_NINJA = {
  cible: { r: 255, v: 0, b: 0 },
  tolerance: 140,
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

/** L'ombre portee sous notre personnage, qui aide a le retrouver. */
export const OMBRE_JOUEUR = {
  rayon: 12,
  decalageY: 10,
  teinte: { couleur: 0x000000, alpha: 0.2 },
} as const;

/** Opacite de notre personnage quand il est cache dans une zone d'invisibilite. */
export const ALPHA_INVISIBLE = 0.3;

/** Couleurs et libelle de chaque zone speciale, portage de ZONE_TYPES. */
export const APPARENCE_ZONE: Readonly<
  Record<TypeZone, { readonly libelle: string; readonly fond: Teinte; readonly bordure: Teinte }>
> = {
  chaos: {
    libelle: 'Zone de chaos',
    fond: { couleur: 0xff4040, alpha: 0.2 },
    bordure: { couleur: 0xff4040, alpha: 0.6 },
  },
  repulsion: {
    libelle: 'Zone répulsive',
    fond: { couleur: 0x4040ff, alpha: 0.2 },
    bordure: { couleur: 0x4040ff, alpha: 0.6 },
  },
  attraction: {
    libelle: 'Zone attractive',
    fond: { couleur: 0x40ff40, alpha: 0.2 },
    bordure: { couleur: 0x40ff40, alpha: 0.6 },
  },
  invisibilite: {
    libelle: "Zone d'invisibilité",
    fond: { couleur: 0x800080, alpha: 0.2 },
    bordure: { couleur: 0x800080, alpha: 0.6 },
  },
};

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
};

/**
 * Les quatre fleches qui designent notre personnage quand on le cherche.
 *
 * Valeurs du jeu d'origine (drawPlayerLocator, client.js:3498): des triangles
 * rouges cernes de blanc, poses a quatre-vingts pixels du personnage et pointes
 * vers lui, qui respirent de huit pixels.
 */
export const REPERE_LOCALISATION = {
  /** Distance entre le personnage et la base de chaque fleche, en pixels de la carte. */
  distance: 80,
  /** Longueur d'une fleche, de sa base a sa pointe. */
  longueur: 40,
  /** Moitie de la largeur de la base. */
  demiLargeur: 30,
  /** Amplitude de la respiration, en pixels. */
  amplitude: 8,
  /** Vitesse de la respiration, en radians par milliseconde. */
  cadence: 0.004,
  remplissage: 0xff1e1e,
  contour: 0xffffff,
  epaisseur: 3,
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
