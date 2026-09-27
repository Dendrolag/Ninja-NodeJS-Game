// @vitest-environment jsdom
/**
 * Tests de l'ecran du profil, dans un document.
 *
 * Le client est celui d'un compte, relie au banc d'essai du transport et a des
 * comptes d'essai. L'ecran est monte par l'application entiere, pour que la lecture
 * du profil parte comme en jeu: a l'arrivee sur l'ecran.
 */

import type { ProfilDuCompte } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import type { ApiComptesFactice } from '../../comptes/api.js';
import { JETON_DESSAI, creerApiComptesFactice, profilDEssai } from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import { creerReseauFactice } from '../../reseau.js';
import type { Application } from '../application.js';
import { monterApplication } from '../application.js';
import { boutonObligatoire, estCache, jeuDEssai, obligatoire } from '../essais.js';

const PROFIL: ProfilDuCompte = {
  ...profilDEssai('Alice'),
  xpTotale: 150,
  niveau: 2,
  pointsLigue: 120,
  statistiques: {
    partiesJouees: 2,
    partiesAPlusieurs: 2,
    victoires: 1,
    modePrefere: 'classique',
    parMode: [
      {
        mode: 'classique',
        partiesJouees: 2,
        partiesAPlusieurs: 2,
        victoires: 1,
        meilleurScore: 42,
      },
    ],
  },
  dernieresParties: [
    {
      mode: 'classique',
      carte: 'map2',
      modeMiroir: false,
      placement: 1,
      nombreJoueurs: 3,
      points: 42,
      xpGagnee: 120,
      piecesGagnees: 12,
      variationPointsLigue: 20,
      termineeLe: '2026-09-11T12:00:00.000Z',
    },
  ],
};

let hote: HTMLElement;
let api: ApiComptesFactice;
let client: Client;
let application: Application;

/** Laisse les reponses des comptes d'essai arriver. */
async function laisserRepondre(): Promise<void> {
  await new Promise((resoudre) => setTimeout(resoudre, 0));
}

beforeEach(async () => {
  document.body.replaceChildren();
  hote = document.createElement('div');
  document.body.append(hote);

  const reseau = creerReseauFactice();
  api = creerApiComptesFactice();
  const coffre = creerCoffreDeJeton();
  coffre.garder(JETON_DESSAI);
  client = creerClient({ reseau, comptes: api, coffre, horloge: creerHorlogeClientManuelle() });

  application = monterApplication({
    hote,
    client,
    horloge: creerHorlogeClientManuelle(),
    monterLeJeu: jeuDEssai().monteur,
    recharger: () => undefined,
  });

  client.ouvrir();
  await laisserRepondre();
  reseau.simulerConnexion();
});

afterEach(() => {
  application.demonter();
  client.fermer();
});

describe('l ecran du profil', () => {
  it('s ouvre depuis la carte du compte, et montre la lecture en cours', () => {
    api.reponses.profil = () => new Promise(() => undefined);

    obligatoire(hote, '.carte-compte').click();

    expect(obligatoire(hote, '.application').dataset['ecran']).toBe('profil');
    expect(obligatoire(hote, '.marque-ecran').textContent).toBe('Profil');
    expect(estCache(obligatoire(hote, '.profil-chargement'))).toBe(false);
    expect(estCache(obligatoire(hote, '.profil-contenu'))).toBe(true);
    // On ne propose pas d'aller la ou l'on est deja.
    expect(obligatoire<HTMLButtonElement>(hote, '.carte-compte').disabled).toBe(true);
  });

  it('affiche le profil lu: identite, niveau, statistiques et dernieres parties', async () => {
    api.reponses.profil = async () => ({ acceptee: true, valeur: PROFIL });

    client.naviguer('profil');
    await laisserRepondre();

    expect(obligatoire(hote, '.profil-nom h1').textContent).toBe('Alice');
    expect(obligatoire(hote, '.badge-palier').textContent).toBe('Argent');
    expect(obligatoire(hote, '.profil-identite .barre-niveau-xp').textContent).toBe('50 / 200 XP');
    expect(
      [...hote.querySelectorAll('.statistique')].map((statistique) => statistique.textContent),
    ).toEqual([
      '2Parties jouées',
      '1Victoiressur 2 parties à plusieurs',
      'HordeMode préféré',
      '0Pièces',
      '120Points de ligue',
    ]);
    expect(
      [...hote.querySelectorAll('.tableau-par-mode tbody tr')].map((ligne) =>
        [...ligne.children].map((cellule) => cellule.textContent),
      ),
    ).toEqual([['Horde', '2', '1 sur 2', '42', '—']]);
    expect(estCache(obligatoire(hote, '.profil-par-mode'))).toBe(false);

    const cellules = [...hote.querySelectorAll('.tableau-historique tbody td')].map(
      (cellule) => cellule.textContent,
    );

    expect(cellules.slice(1)).toEqual(['Horde · Tokyo', '1re sur 3', '42', '+120', '+12', '+20']);
    expect(estCache(obligatoire(hote, '.profil-vide'))).toBe(true);
  });

  it('montre les succes palier par palier: obtenus dates, les autres avec leur progression', async () => {
    api.reponses.profil = async () => ({
      acceptee: true,
      valeur: {
        ...PROFIL,
        succes: PROFIL.succes.map((succes) => {
          if (succes.id === 'premier-pas') {
            return { ...succes, debloqueLe: '2026-09-11T12:00:00.000Z', rarete: 90 };
          }

          return succes.id === 'habitue'
            ? { ...succes, progression: { actuel: 2, seuil: 25 }, rarete: 10 }
            : succes;
        }),
      },
    });

    client.naviguer('profil');
    await laisserRepondre();

    expect(obligatoire(hote, '.profil-succes h2 .succes-compte').textContent).toBe(
      '1 succès sur 47',
    );
    expect(
      [...hote.querySelectorAll('.succes-palier-bloc h3')].map((titre) => titre.textContent),
    ).toEqual(['Découverte1 sur 8', 'Habitué0 sur 15', 'Expert0 sur 17', 'Légende0 sur 7']);

    const premierPas = obligatoire(hote, '.succes-obtenu');
    expect(obligatoire(premierPas, '.succes-nom').textContent).toBe('Premier pas');
    expect(obligatoire(premierPas, '.succes-date').textContent).toMatch(/^Obtenu le /);
    expect(obligatoire(premierPas, '.succes-rarete').textContent).toBe(
      'Obtenu par 90 % des joueurs',
    );

    const habitue = [...hote.querySelectorAll<HTMLElement>('.succes-verrouille')].find(
      (succes) => succes.querySelector('.succes-nom')?.textContent === 'Habitué',
    );
    expect(habitue?.querySelector('.succes-progression')?.textContent).toBe('2 sur 25');
    expect(habitue?.querySelector('.succes-date')).toBeNull();
  });

  it('dit qu aucune partie n est encore enregistree', async () => {
    client.naviguer('profil');
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.profil-vide'))).toBe(false);
    expect(estCache(obligatoire(hote, '.tableau-historique'))).toBe(true);
    // Sans partie, le tableau par mode n'aurait que ses titres.
    expect(estCache(obligatoire(hote, '.profil-par-mode'))).toBe(true);
  });

  it('dit pourquoi le profil n a pas pu etre lu, et le relit sur demande', async () => {
    api.reponses.profil = async () => ({
      acceptee: false,
      statut: 0,
      erreurs: [{ champ: 'comptes', motif: 'Le serveur ne répond pas.' }],
    });

    client.naviguer('profil');
    await laisserRepondre();

    expect(obligatoire(hote, '.profil-echec').textContent).toContain('Le serveur ne répond pas.');

    api.reponses.profil = async () => ({ acceptee: true, valeur: PROFIL });
    boutonObligatoire(hote, 'Réessayer').click();
    await laisserRepondre();

    expect(estCache(obligatoire(hote, '.profil-contenu'))).toBe(false);
  });

  it('deconnecte, et revient a l accueil en invite', async () => {
    client.naviguer('profil');
    await laisserRepondre();

    boutonObligatoire(hote, 'Se déconnecter').click();

    expect(obligatoire(hote, '.application').dataset['ecran']).toBe('accueil');
    expect(client.etat.session.nature).toBe('invite');
    expect(estCache(obligatoire(hote, '.entete-connexion'))).toBe(false);
  });
});
