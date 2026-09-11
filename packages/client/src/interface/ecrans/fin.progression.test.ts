// @vitest-environment jsdom
/**
 * Tests de la progression sur l'ecran de fin, dans un document.
 *
 * Le test exige par la fiche de la reprise des ecrans du jalon 3: les donnees de
 * progression affichees correspondent au recapitulatif recu. Le client est celui
 * d'un compte, relie au banc d'essai du transport: le classement arrive, puis le
 * recapitulatif, comme le serveur les envoie.
 */

import type { InfosSalon, LigneClassement, ProgressionEnregistree } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT } from '@neon-ninja/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Client } from '../../client.js';
import { creerClient } from '../../client.js';
import { JETON_DESSAI, creerApiComptesFactice } from '../../comptes/api.js';
import { creerCoffreDeJeton } from '../../comptes/coffre.js';
import { creerHorlogeClientManuelle } from '../../horloge.js';
import type { ReseauFactice } from '../../reseau.js';
import { creerReseauFactice } from '../../reseau.js';
import { contexteDEssai, estCache, obligatoire } from '../essais.js';
import { formaterNombre } from '../modeles/progression.js';
import { monterFin } from './fin.js';
import type { EcranAffiche } from './types.js';

const CLASSEMENT: readonly LigneClassement[] = [
  {
    id: 'moi',
    pseudo: 'Alice',
    couleur: '#00FFFF',
    points: 30,
    botsPortes: 30,
    pointsBotsNoirs: 0,
    captures: 1,
    botsNoirsDetruits: 0,
  },
];

const SALON: InfosSalon = {
  idRoom: 'room-1',
  statut: 'salon',
  mode: 'classique',
  visibilite: 'publique',
  capacite: 12,
  joueurs: [{ id: 'moi', pseudo: 'Alice', hote: true, compte: { niveau: 1 } }],
  reglages: REGLAGES_PAR_DEFAUT,
};

/** Une partie qui fait passer du niveau 1 au niveau 2, et de Bronze a Argent. */
const RECAPITULATIF: ProgressionEnregistree = {
  enregistree: true,
  placement: 1,
  nombreJoueurs: 4,
  xpGagnee: 210,
  piecesGagnees: 1021,
  variationPointsLigue: 20,
  avant: { xpTotale: 0, niveau: 1, pieces: 0, pointsLigue: 90, palier: 'bronze' },
  apres: { xpTotale: 210, niveau: 2, pieces: 1021, pointsLigue: 110, palier: 'argent' },
};

let reseau: ReseauFactice;
let client: Client;
let ecran: EcranAffiche;
let desabonner: () => void;

/** Le texte d'un element du panneau de progression. */
function texte(selecteur: string): string | null {
  return obligatoire(document, `.fin-progression ${selecteur}`).textContent;
}

beforeEach(async () => {
  document.body.replaceChildren();
  reseau = creerReseauFactice();
  const coffre = creerCoffreDeJeton();
  coffre.garder(JETON_DESSAI);
  client = creerClient({
    reseau,
    comptes: creerApiComptesFactice(),
    coffre,
    horloge: creerHorlogeClientManuelle(),
  });

  client.ouvrir();
  await new Promise((resoudre) => setTimeout(resoudre, 0));
  reseau.simulerConnexion('moi');
  client.rejoindre(undefined);
  reseau.dernier('rejoindre')?.[1]({ valide: true, valeur: SALON });
  reseau.recevoir('partieLancee');
  reseau.recevoir('partieTerminee', { classement: CLASSEMENT });

  ecran = monterFin(contexteDEssai(client));
  document.body.append(ecran.racine);
  desabonner = client.abonner((etat) => {
    ecran.afficher(etat);
  });
  ecran.afficher(client.etat);
});

afterEach(() => {
  desabonner();
  ecran.demonter();
  client.fermer();
});

describe('la progression sur l ecran de fin', () => {
  it('dit que la partie s enregistre, tant que le recapitulatif n est pas arrive', () => {
    expect(estCache(obligatoire(document, '.fin-progression'))).toBe(false);
    expect(estCache(obligatoire(document, '.fin-attente'))).toBe(false);
    expect(estCache(obligatoire(document, '.fin-progression-details'))).toBe(true);
  });

  it('affiche exactement le recapitulatif recu', () => {
    reseau.recevoir('progressionDeFin', RECAPITULATIF);

    expect(estCache(obligatoire(document, '.fin-attente'))).toBe(true);
    expect(texte('.fin-xp')).toBe('+210 XP');
    expect(texte('.barre-niveau-xp')).toBe('110 / 200 XP');
    expect(texte('.fin-passage')).toBe('Niveau 2 atteint !');
    expect(texte('.gain-pieces strong')).toBe(`+${formaterNombre(1021)}`);
    expect(texte('.gain-ligue strong')).toBe('+20');
    expect(texte('.gain-palier')).toBe('Argent · 110 points');
    expect(texte('.gain-changement')).toBe('Bronze → Argent');
    expect(obligatoire(document, '.barre-remplie').style.getPropertyValue('--remplissage')).toBe(
      '55%',
    );
  });

  it('dit pourquoi une partie n a pas ete enregistree', () => {
    reseau.recevoir('progressionDeFin', {
      enregistree: false,
      motif: "Cette partie n'a pas pu être enregistrée.",
    });

    expect(texte('.fin-non-enregistree')).toBe("Cette partie n'a pas pu être enregistrée.");
    expect(estCache(obligatoire(document, '.fin-progression-details'))).toBe(true);
    expect(estCache(obligatoire(document, '.fin-xp'))).toBe(true);
  });

  it('met a jour la progression du compte, que l en-tete lit, sans rien redemander', () => {
    reseau.recevoir('progressionDeFin', RECAPITULATIF);

    const session = client.etat.session;

    expect(session.nature === 'compte' ? session.progression : undefined).toMatchObject({
      xpTotale: 210,
      niveau: 2,
      pieces: 1021,
      pointsLigue: 110,
    });
  });

  it('oublie le recapitulatif a la partie suivante', () => {
    reseau.recevoir('progressionDeFin', RECAPITULATIF);
    reseau.recevoir('partieLancee');

    expect(client.etat.progressionDeFin).toBeUndefined();
  });
});
