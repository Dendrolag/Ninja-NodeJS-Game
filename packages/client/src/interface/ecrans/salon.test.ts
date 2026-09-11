// @vitest-environment jsdom
/**
 * Tests de l'ecran du salon, dans un document: le test exige par la fiche 4.3.
 *
 * Affichage des joueurs, badge de l'hote, lancement reserve a l'hote, compte a
 * rebours, chat. Ils verifient aussi que tout texte venu d'un joueur est pose
 * comme du texte: c'est la regression de la faille S1 que ces ecrans doivent
 * rendre impossible.
 */

import type { InfosSalon } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ArgumentsDescendants, NomDescendant, ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import {
  boutonNomme,
  boutonObligatoire,
  contexteDEssai,
  estCache,
  obligatoire,
  saisir,
  soumettre,
} from '../essais.js';
import { monterSalon } from './salon.js';
import type { EcranAffiche } from './types.js';

/** Un salon a deux joueurs, dont l'hote est designe. */
function salon(hote: 'moi' | 'bob', pseudoDeBob = 'Bob'): InfosSalon {
  return {
    idRoom: 'room-1',
    statut: 'salon',
    mode: 'classique',
    visibilite: 'publique',
    capacite: 12,
    joueurs: [
      { id: 'moi', pseudo: 'Alice', hote: hote === 'moi' },
      { id: 'bob', pseudo: pseudoDeBob, hote: hote === 'bob' },
    ],
    reglages: REGLAGES_PAR_DEFAUT,
  };
}

let reseau: ReseauFactice;
let client: Client;
let ecran: EcranAffiche;

/** Entre dans ce salon et monte l'ecran. */
function monter(infos: InfosSalon): void {
  reseau.simulerConnexion('moi');
  client.rejoindre('Alice');
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: infos });

  ecran = monterSalon(contexteDEssai(client));
  document.body.append(ecran.racine);
  ecran.afficher(client.etat);
}

/** Recoit un message du serveur, et remet l'ecran a jour comme le ferait l'application. */
function recevoir<Nom extends NomDescendant>(
  nom: Nom,
  ...arguments_: ArgumentsDescendants<Nom>
): void {
  reseau.recevoir(nom, ...arguments_);
  ecran.afficher(client.etat);
}

beforeEach(() => {
  document.body.replaceChildren();
  reseau = creerReseauFactice();
  client = creerClient({ reseau, horloge: creerHorlogeClientManuelle() });
});

afterEach(() => {
  ecran.demonter();
  client.fermer();
});

describe('les joueurs du salon', () => {
  it('affiche chaque joueur, marque l hote et nous-memes', () => {
    monter(salon('bob'));

    const cartes = [...document.querySelectorAll<HTMLElement>('[data-joueur]')];

    expect(cartes.map((carte) => carte.dataset['joueur'])).toEqual(['moi', 'bob']);
    expect(obligatoire(document, '[data-joueur="bob"] .badge-hote').textContent).toBe('Hôte');
    expect(document.querySelector('[data-joueur="moi"] .badge-hote')).toBeNull();
    expect(obligatoire(document, '[data-joueur="moi"]').classList.contains('moi')).toBe(true);
    expect(obligatoire(document, '.salon-effectif').textContent).toBe('2 joueurs');
  });

  it('pose un pseudo comme du texte, jamais comme du balisage', () => {
    // Le serveur refuse un tel pseudo depuis l'etape 1.6. Si un jour il passait,
    // l'affichage ne doit toujours pas l'interpreter.
    monter(salon('moi', '<img src=x onerror=alert(1)>'));

    expect(obligatoire(document, '[data-joueur="bob"] .carte-joueur-pseudo').textContent).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(document.querySelector('.salon-joueurs img')).toBeNull();
  });

  it('montre le niveau d un compte, et rien de tel pour un invite', () => {
    const infos = salon('bob');

    monter({
      ...infos,
      joueurs: [
        { id: 'moi', pseudo: 'Alice', hote: false },
        { id: 'bob', pseudo: 'Bob', hote: true, compte: { niveau: 4 } },
      ],
    });

    expect(obligatoire(document, '[data-joueur="bob"] .carte-joueur-niveau').textContent).toBe(
      'Niveau 4',
    );
    expect(document.querySelector('[data-joueur="moi"] .carte-joueur-niveau')).toBeNull();
  });

  it('suit le transfert de l hote', () => {
    monter(salon('bob'));
    expect(boutonNomme(document, 'Lancer la partie')).toBeUndefined();

    recevoir('salon', salon('moi'));

    expect(boutonNomme(document, 'Lancer la partie')).toBeDefined();
  });
});

describe('le lancement', () => {
  it('est propose a l hote, et demande le demarrage au serveur', () => {
    monter(salon('moi'));

    boutonObligatoire(document, 'Lancer la partie').click();

    expect(reseau.emis.at(-1)?.nom).toBe('demarrer');
  });

  it('n est pas propose a un invite, ni les reglages', () => {
    monter(salon('bob'));

    expect(boutonNomme(document, 'Lancer la partie')).toBeUndefined();
    expect(boutonNomme(document, 'Réglages')).toBeUndefined();
    expect(obligatoire(document, '.salon-consigne').textContent).toBe(
      'En attente de Bob, qui lancera la partie.',
    );
  });

  it('montre le compte a rebours, et laisse l hote l annuler tant qu il est temps', () => {
    monter(salon('moi'));
    recevoir('compteARebours', { secondesRestantes: 4, annulable: true });

    expect(estCache(obligatoire(document, '.compte-a-rebours'))).toBe(false);
    expect(obligatoire(document, '.compte-nombre').textContent).toBe('4');
    expect(boutonNomme(document, 'Lancer la partie')).toBeUndefined();

    boutonObligatoire(document, 'Annuler le lancement').click();
    expect(reseau.emis.at(-1)?.nom).toBe('annulerDemarrage');

    recevoir('compteARebours', { secondesRestantes: 2, annulable: false });
    expect(boutonNomme(document, 'Annuler le lancement')).toBeUndefined();
  });

  it('ne propose pas l annulation a un invite', () => {
    monter(salon('bob'));
    recevoir('compteARebours', { secondesRestantes: 4, annulable: true });

    expect(estCache(obligatoire(document, '.compte-a-rebours'))).toBe(false);
    expect(boutonNomme(document, 'Annuler le lancement')).toBeUndefined();
  });

  it('enregistre les reglages de l hote aupres du serveur', () => {
    monter(salon('moi'));

    boutonObligatoire(document, 'Réglages').click();
    const panneau = obligatoire(document, '.fenetre-reglages');
    saisir(obligatoire<HTMLInputElement>(panneau, '[data-chemin="dureePartieS"]'), '60');
    boutonObligatoire(panneau, 'Enregistrer').click();

    const envoye = reseau.dernier('reglages')?.[0];

    expect(envoye?.dureePartieS).toBe(60);
    expect(estCache(panneau)).toBe(true);
  });
});

describe('le chat', () => {
  it('envoie le message saisi, et vide le champ', () => {
    monter(salon('bob'));
    const champ = obligatoire<HTMLInputElement>(document, 'input[name="message"]');

    saisir(champ, '  on lance ?  ');
    soumettre(obligatoire<HTMLFormElement>(document, '.chat-formulaire'));

    expect(reseau.dernier('chat')?.[0]).toEqual({ texte: 'on lance ?' });
    expect(champ.value).toBe('');
  });

  it('ignore un message vide, et refuse un message trop long avant de l envoyer', () => {
    monter(salon('bob'));
    const champ = obligatoire<HTMLInputElement>(document, 'input[name="message"]');
    const formulaire = obligatoire<HTMLFormElement>(document, '.chat-formulaire');

    saisir(champ, '   ');
    soumettre(formulaire);
    saisir(champ, 'a'.repeat(201));
    soumettre(formulaire);

    expect(reseau.dernier('chat')).toBeUndefined();
    expect(obligatoire(document, '.chat-erreur').textContent).toBe(
      'Un message fait au plus 200 caractères.',
    );
  });

  it('affiche les messages recus comme du texte, et distingue les notres', () => {
    monter(salon('bob'));
    recevoir('chat', { auteur: 'bob', pseudo: 'Bob', texte: '<b>salut</b>' });
    recevoir('chat', { auteur: 'moi', pseudo: 'Alice', texte: 'go' });

    const messages = [...document.querySelectorAll('.chat-message')];

    expect(messages.map((message) => message.querySelector('.chat-texte')?.textContent)).toEqual([
      '<b>salut</b>',
      'go',
    ]);
    expect(document.querySelector('.chat-messages b')).toBeNull();
    expect(messages.map((message) => message.classList.contains('moi'))).toEqual([false, true]);
  });
});
