// @vitest-environment jsdom
/**
 * Tests de navigation entre les ecrans: le test exige par la fiche 4.3.
 *
 * Ils montent l'application entiere dans un document, avec un vrai client relie
 * au banc d'essai de transport, et jouent les gestes d'un joueur: saisir son
 * pseudo, cliquer, recevoir les messages du serveur. Seul l'ecran de jeu est
 * remplace par une piece d'essai, parce qu'il monte PixiJS; il est joue en vrai
 * par le scenario de bout en bout.
 *
 * Ce qu'on verifie a chaque transition, c'est l'ecran reellement present dans la
 * page, pas seulement la valeur de etat.ecran, deja couverte par ecrans.test.ts.
 */

import type { InfosSalon, LigneClassement } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../client.js';
import { creerClient } from '../client.js';
import { creerHorlogeClientManuelle } from '../horloge.js';
import type { ReseauFactice } from '../reseau.js';
import { creerReseauFactice } from '../reseau.js';
import type { Application } from './application.js';
import { monterApplication } from './application.js';
import type { JeuDEssai, SonsDEssai } from './essais.js';
import {
  boutonObligatoire,
  estCache,
  jeuDEssai,
  obligatoire,
  saisir,
  sonsDEssai,
} from './essais.js';

/** Le salon d'une partie ou nous sommes seul, donc hote. */
const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Un classement final a deux joueurs. */
const CLASSEMENT: readonly LigneClassement[] = [
  {
    id: 'moi',
    pseudo: 'Alice',
    couleur: '#FF0000',
    points: 12,
    botsPortes: 12,
    pointsBotsNoirs: 0,
    captures: 1,
    botsNoirsDetruits: 0,
  },
];

let hote: HTMLElement;
let reseau: ReseauFactice;
let client: Client;
let sons: SonsDEssai;
let jeu: JeuDEssai;
let application: Application;
let recharges: number;

/** L'ecran affiche par l'application. */
function ecranAffiche(): string | undefined {
  return obligatoire(hote, '.application').dataset['ecran'];
}

/** Le champ du pseudo, sur l'accueil. */
function champPseudo(): HTMLInputElement {
  return obligatoire<HTMLInputElement>(hote, 'input[name="pseudo"]');
}

/** Saisit un pseudo et clique sur Jouer, sans repondre a la place du serveur. */
function demanderAEntrer(pseudo: string): void {
  saisir(champPseudo(), pseudo);
  boutonObligatoire(hote, 'Jouer').click();
}

/** Se connecte, entre, et recoit l'accord du serveur. */
function entrerDansLeSalon(): void {
  reseau.simulerConnexion('moi');
  demanderAEntrer('Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
}

/** Les noms des messages envoyes au serveur, dans l'ordre. */
function emis(): string[] {
  return reseau.emis.map((message) => message.nom);
}

beforeEach(() => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
  sons = sonsDEssai();
  jeu = jeuDEssai();
  recharges = 0;

  application = monterApplication({
    hote,
    client,
    sons,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeu.monteur,
    recharger: () => {
      recharges += 1;
    },
  });
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l accueil', () => {
  it('s ouvre en attendant la connexion, sans laisser jouer', () => {
    expect(ecranAffiche()).toBe('accueil');
    expect(boutonObligatoire(hote, 'Jouer').disabled).toBe(true);
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe('Connexion au serveur…');
  });

  it('refuse d envoyer un pseudo invalide, et dit pourquoi', () => {
    reseau.simulerConnexion('moi');
    saisir(champPseudo(), 'Al<ice>');

    const erreur = obligatoire(hote, '.accueil-erreur');

    expect(estCache(erreur)).toBe(false);
    expect(erreur.textContent).toContain("n'accepte que");
    expect(boutonObligatoire(hote, 'Jouer').disabled).toBe(true);

    obligatoire<HTMLFormElement>(hote, '.accueil-formulaire').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(emis()).not.toContain('rejoindre');
  });

  it('ne laisse pas redemander pendant que la demande attend sa reponse', () => {
    reseau.simulerConnexion('moi');
    demanderAEntrer('Alice');

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice' });
    expect(boutonObligatoire(hote, 'Jouer').disabled).toBe(true);
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe('Entrée dans une partie…');
  });

  it('montre le refus du serveur sous le pseudo, sans quitter l accueil', () => {
    reseau.simulerConnexion('moi');
    demanderAEntrer('Alice');
    reseau.dernier('rejoindre')?.[1]({
      valide: false,
      erreurs: [{ champ: 'pseudo', motif: 'Ce pseudo est déjà pris dans cette partie.' }],
    });

    expect(ecranAffiche()).toBe('accueil');
    expect(obligatoire(hote, '.accueil-erreur').textContent).toBe(
      'Ce pseudo est déjà pris dans cette partie.',
    );
  });
});

describe('la navigation entre les ecrans', () => {
  it('passe au salon quand le serveur accepte l entree', () => {
    entrerDansLeSalon();

    expect(ecranAffiche()).toBe('salon');
    expect(obligatoire(hote, '.salon-titre').textContent).toBe('Salon de Alice');
  });

  it('monte le jeu au lancement, le demonte a la fin, et change de musique', () => {
    entrerDansLeSalon();
    reseau.recevoir('partieLancee');

    expect(ecranAffiche()).toBe('jeu');
    expect(jeu.montages).toBe(1);
    expect(sons.joues).toContain('partieLancee');
    expect(sons.musiques.at(-1)).toBe('jeu');

    reseau.recevoir('partieTerminee', { classement: CLASSEMENT });

    expect(ecranAffiche()).toBe('fin');
    expect(jeu.demontages).toBe(1);
    expect(sons.joues).toContain('partieTerminee');
    expect(sons.musiques.at(-1)).toBe('menu');
  });

  it('revient a l accueil depuis la fin, en quittant la partie', () => {
    entrerDansLeSalon();
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', { classement: CLASSEMENT });

    boutonObligatoire(hote, 'Accueil').click();

    expect(emis().at(-1)).toBe('quitter');
    expect(ecranAffiche()).toBe('accueil');
    // Le pseudo est repropose: le joueur n'a pas a le ressaisir.
    expect(champPseudo().value).toBe('Alice');
  });

  it('rejoue en quittant la partie finie puis en redemandant a entrer, sous le meme pseudo', () => {
    entrerDansLeSalon();
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', { classement: CLASSEMENT });
    const avant = reseau.emis.length;

    boutonObligatoire(hote, 'Rejouer').click();

    expect(reseau.emis.slice(avant).map((message) => message.nom)).toEqual([
      'quitter',
      'rejoindre',
    ]);
    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice' });

    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(ecranAffiche()).toBe('salon');
  });

  it('quitte le salon pour l accueil', () => {
    entrerDansLeSalon();

    boutonObligatoire(hote, 'Quitter le salon').click();

    expect(emis().at(-1)).toBe('quitter');
    expect(ecranAffiche()).toBe('accueil');
  });

  it('revient a l accueil quand la connexion tombe, et propose de recharger la page', () => {
    entrerDansLeSalon();
    reseau.simulerDeconnexion();

    expect(ecranAffiche()).toBe('accueil');
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe(
      'La connexion au serveur a été perdue.',
    );

    boutonObligatoire(hote, 'Recharger la page').click();

    expect(recharges).toBe(1);
  });

  it('n empile jamais deux ecrans', () => {
    entrerDansLeSalon();
    reseau.recevoir('partieLancee');
    reseau.recevoir('partieTerminee', { classement: CLASSEMENT });
    boutonObligatoire(hote, 'Accueil').click();

    expect(hote.querySelectorAll('.ecran')).toHaveLength(1);
  });
});

describe('ce qui accompagne les ecrans', () => {
  it('annonce l arrivee d un joueur', () => {
    entrerDansLeSalon();
    reseau.recevoir('joueurArrive', { id: 'bob', pseudo: 'Bob', hote: false });

    expect([...hote.querySelectorAll('.annonce')].map((annonce) => annonce.textContent)).toEqual([
      'Bob a rejoint la partie',
    ]);
  });

  it('fait entendre le compte a rebours dans le salon', () => {
    entrerDansLeSalon();
    reseau.recevoir('compteARebours', { secondesRestantes: 5, annulable: true });

    expect(sons.joues).toContain('compteARebours');
  });

  it('fait entendre le clic des boutons', () => {
    boutonObligatoire(hote, 'Aide et commandes').click();

    expect(sons.joues).toContain('clic');
  });

  it('ouvre l aide, et la ferme avec la touche Echap', () => {
    boutonObligatoire(hote, 'Aide et commandes').click();
    const aide = obligatoire(hote, '.fenetre-aide');

    expect(estCache(aide)).toBe(false);

    aide.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(estCache(aide)).toBe(true);
  });

  it('se demonte sans rien laisser dans la page', () => {
    application.demonter();

    expect(hote.children).toHaveLength(0);

    // Un second demontage par afterEach ne doit rien casser.
    application = { demonter: () => undefined };
  });
});
