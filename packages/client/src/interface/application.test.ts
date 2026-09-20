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

import type { InfosSalon, LigneClassement, ReglagesPartie } from '@neon-ninja/shared';
import { LIBELLE_DE_DEVELOPPEMENT, REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
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
  boutonNomme,
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
/** Les reglages de chaque partie dont le prechargement a ete demande. */
let precharges: ReglagesPartie[];

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
  boutonObligatoire(hote, 'Partie rapide').click();
}

/** Se connecte, entre, et recoit l'accord du serveur. */
function entrerDansLeSalon(): void {
  reseau.simulerConnexion();
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
  precharges = [];

  application = monterApplication({
    hote,
    client,
    sons,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeu.monteur,
    prechargerLeJeu: (reglages) => {
      precharges.push(reglages);
    },
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
    expect(boutonObligatoire(hote, 'Partie rapide').disabled).toBe(true);
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe('Connexion au serveur…');
  });

  it('montre franchement ou en est la connexion, et quand elle est etablie (etape 5.5)', () => {
    // La connexion etait trop discrete: un petit texte gris, rien une fois etablie.
    const etat = obligatoire(hote, '.accueil-lien');

    expect(etat.dataset['lien']).toBe('enCours');
    expect(boutonObligatoire(hote, 'Partie rapide').hasAttribute('data-attente')).toBe(true);

    reseau.simulerConnexion();

    expect(etat.dataset['lien']).toBe('etabli');
    expect(etat.textContent).toBe('Connecté au serveur');
    expect(etat.hidden).toBe(false);
    expect(boutonObligatoire(hote, 'Partie rapide').hasAttribute('data-attente')).toBe(false);
  });

  it('annonce les cinq modes, et plus seulement le Classique (etape 5.5)', () => {
    expect(obligatoire(hote, '.surtitre').textContent).toBe('5 modes · 3 cartes');
  });

  it('dit en pied de page de quand date la version servie (etape 8.4)', () => {
    // La page de ce test n'est construite d'aucun commit: elle le dit, plutot que de
    // laisser une ligne vide qui ferait croire a une page cassee.
    expect(obligatoire(hote, '.accueil-pied').textContent).toBe(LIBELLE_DE_DEVELOPPEMENT);
  });

  it('porte la date du commit, et son empreinte entiere en infobulle (etape 8.4)', () => {
    const page = document.createElement('div');
    document.body.append(page);

    const autre = monterApplication({
      hote: page,
      client: creerClient({ reseau: creerReseauFactice(), horloge: creerHorlogeClientManuelle() }),
      horloge: creerHorlogeClientManuelle(),
      monterLeJeu: jeuDEssai().monteur,
      recharger: () => undefined,
      version: 'ee181518d887796fb7dd012e7e91e6a88740e2ed',
      horodatage: '2026-09-20T19:44:10+02:00',
    });

    const pied = obligatoire(page, '.accueil-pied span');

    expect(pied.textContent).toBe('Version du 20 septembre 2026, 19h44 · ee18151');
    // L'empreinte entiere ne se lit pas en pied de page, mais elle reste a portee de
    // souris: c'est elle qu'on colle dans un « git show ».
    expect(pied.getAttribute('title')).toBe('Commit ee181518d887796fb7dd012e7e91e6a88740e2ed');

    autre.demonter();
    page.remove();
  });

  it('refuse d envoyer un pseudo invalide, et dit pourquoi', () => {
    reseau.simulerConnexion();
    saisir(champPseudo(), 'Al<ice>');

    const erreur = obligatoire(hote, '.accueil-erreur');

    expect(estCache(erreur)).toBe(false);
    expect(erreur.textContent).toContain("n'accepte que");
    expect(boutonObligatoire(hote, 'Partie rapide').disabled).toBe(true);

    obligatoire<HTMLFormElement>(hote, '.accueil-formulaire').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(emis()).not.toContain('rejoindre');
  });

  it('ne laisse pas redemander pendant que la demande attend sa reponse', () => {
    reseau.simulerConnexion();
    demanderAEntrer('Alice');

    expect(reseau.dernier('rejoindre')?.[0]).toEqual({ pseudo: 'Alice' });
    expect(boutonObligatoire(hote, 'Partie rapide').disabled).toBe(true);
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe('Entrée dans une partie…');
  });

  it('montre le refus du serveur sous le pseudo, sans quitter l accueil', () => {
    reseau.simulerConnexion();
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
    expect(reseau.dernier('rejoindre')?.[0]).toEqual({
      pseudo: 'Alice',
      mode: 'classique',
      reglages: SALON.reglages,
    });

    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(ecranAffiche()).toBe('salon');
  });

  it('quitte le salon pour l accueil', () => {
    entrerDansLeSalon();

    boutonObligatoire(hote, 'Quitter le salon').click();

    expect(emis().at(-1)).toBe('quitter');
    expect(ecranAffiche()).toBe('accueil');
  });

  it('garde le salon quand la connexion tombe, le dit, suspend ce qui a besoin du lien, et y revient (etape 2.6)', () => {
    reseau.simulerConnexion();
    demanderAEntrer('Alice');
    reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'R'.repeat(43) });
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    const ligne = obligatoire(hote, '.ligne-lien');
    const message = obligatoire<HTMLInputElement>(hote, 'input[name="message"]');
    expect(estCache(ligne)).toBe(true);
    boutonObligatoire(hote, 'Lancer la partie');

    reseau.simulerDeconnexion();

    expect(ecranAffiche()).toBe('salon');
    expect(estCache(ligne)).toBe(false);
    expect(ligne.textContent).toContain('Connexion perdue. Retour dans le salon…');
    expect(boutonNomme(hote, 'Lancer la partie')).toBeUndefined();
    expect(boutonObligatoire(hote, 'Réglages').disabled).toBe(true);
    expect(message.disabled).toBe(true);

    reseau.simulerConnexion();
    reseau.recevoir('placeAttribuee', { joueur: 'moi', jetonDeRetour: 'N'.repeat(43) });
    reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });

    expect(ecranAffiche()).toBe('salon');
    expect(estCache(ligne)).toBe(true);
    boutonObligatoire(hote, 'Lancer la partie');
    expect(boutonObligatoire(hote, 'Réglages').disabled).toBe(false);
    expect(message.disabled).toBe(false);
    expect(recharges).toBe(0);
  });

  it('dit sur l accueil que la connexion est perdue, et la retablit sans recharger (etape 2.6)', () => {
    reseau.simulerConnexion();
    reseau.simulerDeconnexion();

    expect(ecranAffiche()).toBe('accueil');
    expect(obligatoire(hote, '.accueil-lien').textContent).toBe('Connexion perdue. Reconnexion…');
    expect(boutonNomme(hote, 'Recharger la page')).toBeUndefined();
    expect(boutonObligatoire(hote, 'Partie rapide').disabled).toBe(true);

    reseau.simulerConnexion();
    saisir(champPseudo(), 'Alice');

    expect(boutonObligatoire(hote, 'Partie rapide').disabled).toBe(false);
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

  // Recette de l'etape 5.4: le decor de la carte ne se telechargeait qu'au lancement,
  // pendant que la partie tournait deja. Il se precharge des le compte a rebours.
  it('precharge la partie des le compte a rebours, une seule fois, avec ses reglages', () => {
    entrerDansLeSalon();
    expect(precharges).toEqual([]);

    reseau.recevoir('compteARebours', { secondesRestantes: 5, annulable: true });
    reseau.recevoir('compteARebours', { secondesRestantes: 4, annulable: true });

    expect(precharges).toEqual([REGLAGES_PAR_DEFAUT]);
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

describe('la presentation statique de la page (etape 5.6)', () => {
  it('cede sa place a l application qui se monte', () => {
    const page = document.createElement('div');
    page.innerHTML =
      '<main class="presentation"><h1>Le ninja, c’est vous.</h1><p>Chargement du jeu…</p></main>';
    document.body.append(page);

    const autre = monterApplication({
      hote: page,
      client: creerClient({ reseau: creerReseauFactice(), horloge: creerHorlogeClientManuelle() }),
      horloge: creerHorlogeClientManuelle(),
      monterLeJeu: jeuDEssai().monteur,
      recharger: () => undefined,
    });

    expect(page.querySelector('.presentation')).toBeNull();
    expect(page.children).toHaveLength(1);
    expect(obligatoire(page, '.application').dataset['ecran']).toBe('accueil');

    autre.demonter();
  });
});
