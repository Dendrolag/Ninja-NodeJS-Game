/**
 * Tests de la boucle de rendu.
 *
 * La boucle ne calcule rien elle-meme: elle fait se rencontrer l'etat, la scene,
 * la saisie et le son. Ce qu'on verifie ici, c'est donc le CABLAGE: que chaque
 * morceau recoit ce qu'il doit recevoir, une fois et une seule. Les calculs
 * eux-memes sont couverts par les tests de la scene, des controles et des sons.
 *
 * Aucun navigateur, aucun GPU: le rendu est remplace par un objet qui note ce
 * qu'on lui demande de dessiner, et les images sont jouees a la main.
 */

import type {
  EntiteVue,
  InfosSalon,
  InstantanePartie,
  NomDeSon,
  TypeBonus,
} from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { Controles } from '../controles/controles.js';
import type { HorlogeClientManuelle } from '../horloge.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { LecteurDeSons } from '../sons/lecteur.js';
import type { Boucle } from './boucle.js';
import { lancerLaBoucle } from './boucle.js';
import type { Rendu } from './pixi.js';
import type { Scene } from './scene.js';

/** Un joueur pose a un endroit. */
function joueur(id: string, x: number, y: number): EntiteVue {
  return {
    type: 'joueur',
    id,
    x,
    y,
    couleur: '#FF0000',
    direction: 'sud',
    pseudo: id,
    invincible: false,
    protege: false,
  };
}

/** Un instantane de partie, avec les entites voulues. */
function instantane(tick: number, entites: readonly EntiteVue[]): InstantanePartie {
  return {
    tick,
    tempsRestantMs: 120_000,
    enPause: false,
    entites,
    objets: [],
    zones: [],
    classement: [],
  };
}

/** Le salon d'une partie dont nous sommes l'hote. */
const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Un rendu qui ne dessine rien et retient les scenes recues. */
function renduDEssai(): Rendu & { scenes: Scene[] } {
  const scenes: Scene[] = [];

  return {
    scenes,
    application: undefined as never,
    chargerLeDecor: async () => undefined,
    dessiner: (scene) => {
      scenes.push(scene);
    },
    redimensionner: () => undefined,
    detruire: () => undefined,
  };
}

/** Un lecteur de sons muet qui retient ce qu'on lui demande. */
function sonsDEssai(): LecteurDeSons & {
  joues: NomDeSon[];
  boucles: Set<TypeBonus>;
  arrets: number;
} {
  const joues: NomDeSon[] = [];
  const boucles = new Set<TypeBonus>();
  const lecteur = {
    joues,
    boucles,
    arrets: 0,
    jouer: (nom: NomDeSon) => {
      joues.push(nom);
    },
    jouerUnPas: () => undefined,
    demarrerLaBoucle: (bonus: TypeBonus) => {
      boucles.add(bonus);
    },
    arreterLaBoucle: (bonus: TypeBonus) => {
      boucles.delete(bonus);
    },
    demarrerLaMusique: () => undefined,
    arreterLaMusique: () => undefined,
    toutArreter: () => {
      lecteur.arrets += 1;
    },
    reglerLeVolumeDesSons: () => undefined,
    reglerLeVolumeDeLaMusique: () => undefined,
    couperLeSon: () => undefined,
  };

  return lecteur;
}

let reseau: ReseauFactice;
let horloge: HorlogeClientManuelle;
let client: Client;
let rendu: ReturnType<typeof renduDEssai>;
let sons: ReturnType<typeof sonsDEssai>;
let controles: Controles;
let boucle: Boucle;
let instant: number;

/** Joue une image, cinquante millisecondes apres la precedente. */
function uneImage(): void {
  instant += 50;
  horloge.avancerDe(50);
  boucle.uneImage(instant);
}

beforeEach(() => {
  reseau = creerReseauFactice();
  horloge = creerHorlogeClientManuelle();
  client = creerClient({ reseau, horloge });
  rendu = renduDEssai();
  sons = sonsDEssai();
  controles = new Controles();
  instant = 0;

  reseau.simulerConnexion('moi');
  client.rejoindre('Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

  boucle = lancerLaBoucle({
    client,
    rendu,
    controles,
    horloge,
    sons,
    carte: { largeur: 2_000, hauteur: 1_500 },
    taille: () => ({ largeur: 1_280, hauteur: 720 }),
    // Les images sont jouees a la main: la boucle ne doit pas s'en demander.
    demanderUneImage: () => 1,
    annulerUneImage: () => undefined,
  });
});

describe('lancerLaBoucle', () => {
  it('dessine a chaque image autant d entites que l etat en contient', () => {
    reseau.recevoir('partieLancee');
    reseau.recevoir('etat', instantane(1, [joueur('moi', 100, 100), joueur('autre', 300, 300)]));

    uneImage();

    expect(rendu.scenes.at(-1)?.entites).toHaveLength(2);
  });

  it('lit l etat a chaque image, sans attendre un nouveau message', () => {
    reseau.recevoir('partieLancee');
    reseau.recevoir('etat', instantane(1, [joueur('moi', 100, 100)]));

    uneImage();
    uneImage();
    uneImage();

    // Trois images pour un seul message: c'est ce qui decouple la cadence
    // d'affichage de celle du reseau.
    expect(rendu.scenes).toHaveLength(3);
  });

  it('envoie l intention de deplacement une seule fois tant qu elle ne change pas', () => {
    controles.enfoncer('d');

    uneImage();
    uneImage();

    expect(reseau.emis.filter((message) => message.nom === 'deplacer')).toHaveLength(1);
  });

  it('fait entendre le depart de la partie', () => {
    reseau.recevoir('partieLancee');

    uneImage();

    expect(sons.joues).toContain('partieLancee');
  });

  it('joue le son d un fait recu une fois, et ne le rejoue pas a l image suivante', () => {
    reseau.recevoir('partieLancee');
    uneImage();

    reseau.recevoir('captureReussie', { victimePseudo: 'Bob', botsGagnes: 4, capturesTotal: 1 });
    uneImage();
    uneImage();

    expect(sons.joues.filter((nom) => nom === 'joueurCapture')).toHaveLength(1);
  });

  it('demarre la boucle sonore d un bonus et l arrete quand il expire', () => {
    reseau.recevoir('partieLancee');
    reseau.recevoir('bonusActive', { nature: 'vitesse', dureeMs: 200 });

    uneImage();
    expect(sons.boucles.has('vitesse')).toBe(true);

    // Aucun message n'arrive pour signaler la fin du bonus: c'est l'instant qui
    // doit suffire a arreter la boucle.
    uneImage();
    uneImage();
    uneImage();
    uneImage();

    expect(sons.boucles.has('vitesse')).toBe(false);
  });

  it('coupe tous les sons quand on l arrete', () => {
    boucle.arreter();

    expect(sons.arrets).toBe(1);
  });
});

describe('les fleches qui designent notre personnage', () => {
  /** Joue assez d'images pour que des fleches automatiques aient disparu. */
  function laisserPasserLesFleches(): void {
    for (let image = 0; image < 80; image += 1) {
      uneImage();
    }
  }

  beforeEach(() => {
    reseau.recevoir('partieLancee');
    reseau.recevoir('etat', instantane(1, [joueur('moi', 100, 100)]));
  });

  it('apparaissent quand notre personnage apparait', () => {
    uneImage();

    expect(rendu.scenes.at(-1)?.reperes).toHaveLength(4);
  });

  it('disparaissent seules, sans minuterie a annuler', () => {
    laisserPasserLesFleches();

    expect(rendu.scenes.at(-1)?.reperes).toHaveLength(0);
  });

  it('reviennent quand le joueur les demande', () => {
    laisserPasserLesFleches();

    controles.demanderLaLocalisation();
    uneImage();

    expect(rendu.scenes.at(-1)?.reperes).toHaveLength(4);
  });

  it('reviennent apres une capture, qui nous fait reapparaitre ailleurs', () => {
    laisserPasserLesFleches();

    reseau.recevoir('captureSubie', {
      parPseudo: 'Bob',
      nouvelleCouleur: '#00FF00',
      botsPerdus: 2,
    });
    uneImage();

    expect(rendu.scenes.at(-1)?.reperes).toHaveLength(4);
  });

  it('ne servent pas une demande faite avant l apparition de notre personnage', () => {
    // La demande est consommee a chaque image, qu'on puisse la servir ou non: un
    // appui sur F dans le vide ne doit pas ressurgir plus tard.
    controles.demanderLaLocalisation();
    laisserPasserLesFleches();

    expect(rendu.scenes.at(-1)?.reperes).toHaveLength(0);
  });
});
