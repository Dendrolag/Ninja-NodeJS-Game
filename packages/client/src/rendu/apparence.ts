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

import type { TypeBonus, TypeMalus, TypeZone } from '@neon-ninja/shared';

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
    libelle: 'Zone repulsive',
    fond: { couleur: 0x4040ff, alpha: 0.2 },
    bordure: { couleur: 0x4040ff, alpha: 0.6 },
  },
  attraction: {
    libelle: 'Zone attractive',
    fond: { couleur: 0x40ff40, alpha: 0.2 },
    bordure: { couleur: 0x40ff40, alpha: 0.6 },
  },
  invisibilite: {
    libelle: "Zone d'invisibilite",
    fond: { couleur: 0x800080, alpha: 0.2 },
    bordure: { couleur: 0x800080, alpha: 0.6 },
  },
};

/** Couleur et libelle de chaque bonus et de chaque malus, portage des tables du client d'origine. */
export const APPARENCE_OBJET: Readonly<
  Record<TypeBonus | TypeMalus, { readonly libelle: string; readonly couleur: number }>
> = {
  vitesse: { libelle: 'Boost', couleur: 0x00ff00 },
  invincibilite: { libelle: 'Invincibilite', couleur: 0xffd700 },
  revelation: { libelle: 'Revelation', couleur: 0xff00ff },
  controlesInverses: { libelle: 'Controles inverses', couleur: 0xff4444 },
  flou: { libelle: 'Vision floue', couleur: 0x44aaff },
  negatif: { libelle: 'Vision negative', couleur: 0xaa44ff },
};

/** Rayon du halo pose sous un objet ramassable. */
export const RAYON_HALO_OBJET = 22;

/** Taille d'affichage de l'icone d'un objet ramassable. */
export const TAILLE_OBJET = 30;

/** Cadence du clignotement d'un objet sur le point de disparaitre, en radians par milliseconde. */
export const CADENCE_CLIGNOTEMENT = 0.01;

/**
 * Reglage de la lueur neon, appliquee en filtre GPU sur le calque des entites.
 *
 * C'EST LE CHANGEMENT DE FOND DE CETTE ETAPE. Le jeu d'origine obtenait sa lueur
 * en posant un shadowBlur sur le contexte 2D avant chaque trace, ce qui la fait
 * recalculer par le processeur une fois PAR ENTITE, a chaque image. A cent
 * entites, c'etait la depense dominante de la boucle de rendu. Ici la lueur est
 * une passe GPU sur le calque entier: son cout ne depend plus du nombre
 * d'entites, mais de la surface de l'ecran.
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

/** Largeur et hauteur de reference du cadrage mobile, plus serre. */
export const CADRAGE_MOBILE = { largeur: 600, hauteur: 451 } as const;
