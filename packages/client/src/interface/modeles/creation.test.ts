/**
 * Tests du modele de la creation d'une partie.
 *
 * Le test exige par la fiche pour le formulaire de creation porte sur la moitie
 * cliente ici: une configuration invalide est signalee et ne part pas. La moitie
 * serveur (le serveur refuse la meme configuration avec les memes motifs) est dans
 * tests/client/integration/creation-serveur.test.ts.
 */

import type { MaProgression } from '@neon-ninja/shared';
import { REGLAGES_PAR_DEFAUT, completerReglages } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { EtatClient } from '../../etat.js';
import { ETAT_INITIAL } from '../../etat.js';
import { modeleCreation } from './creation.js';
import { valeursDepuisReglages } from './reglages.js';

const VALEURS = valeursDepuisReglages(REGLAGES_PAR_DEFAUT);

/** Un invite relie au serveur, qui a saisi Alice. */
const INVITE: EtatClient = {
  ...ETAT_INITIAL,
  ecran: 'creation',
  connexion: 'connecte',
  moi: 'moi',
  pseudoSaisi: 'Alice',
};

const COMPTE: MaProgression = {
  pseudo: 'Alice',
  niveau: 1,
  xpTotale: 0,
  pieces: 0,
  pointsLigue: 0,
  inscritLe: '2026-09-11T10:00:00.000Z',
};

/** Une partie Classique publique, aux reglages par defaut. */
const PUBLIQUE = { mode: 'classique', visibilite: 'publique', valeurs: VALEURS } as const;

describe('modeleCreation', () => {
  it('prepare la demande d une partie privee, aux reglages saisis', () => {
    const modele = modeleCreation(INVITE, {
      mode: 'classique',
      visibilite: 'privee',
      valeurs: { ...VALEURS, carte: 'map3', modeMiroir: true },
    });

    expect(modele.envoi).toEqual({
      pseudo: 'Alice',
      configuration: {
        mode: 'classique',
        visibilite: 'privee',
        reglages: completerReglages({ carte: 'map3', modeMiroir: true }),
      },
    });
    expect(modele.titre).toBe('Classique · Spirit & Time · Miroir');
    expect(modele.recapitulatif).toEqual([
      { libelle: 'Visibilité', valeur: 'Privée, sur code d’invitation' },
      { libelle: 'Durée', valeur: '3:00' },
      { libelle: 'Faux ninjas', valeur: '50' },
      { libelle: 'Capacité', valeur: '12 joueurs' },
    ]);
  });

  it('prepare la demande d une partie Tactique, au nom et a la capacite de son mode', () => {
    const modele = modeleCreation(INVITE, { ...PUBLIQUE, mode: 'tactique' });

    expect(modele.envoi?.configuration.mode).toBe('tactique');
    expect(modele.titre).toBe('Tactique · Rainy Tokyo');
    expect(modele.recapitulatif[3]).toEqual({ libelle: 'Capacité', valeur: '12 joueurs' });
  });

  it('signale une configuration invalide, et ne la laisse pas partir', () => {
    const modele = modeleCreation(INVITE, {
      ...PUBLIQUE,
      valeurs: { ...VALEURS, dureePartieS: '700' },
    });

    expect(modele.reglagesValides).toBe(false);
    expect(modele.envoi).toBeUndefined();
    expect(modele.recapitulatif[1]).toEqual({ libelle: 'Durée', valeur: '—' });
  });

  it('demande un pseudo valide a un invite', () => {
    const sansPseudo = modeleCreation({ ...INVITE, pseudoSaisi: '' }, PUBLIQUE);
    const invalide = modeleCreation({ ...INVITE, pseudoSaisi: 'Al<b>' }, PUBLIQUE);

    expect(sansPseudo.envoi).toBeUndefined();
    expect(sansPseudo.aidePseudo).toBe('Choisissez un pseudo pour créer une partie.');
    expect(invalide.envoi).toBeUndefined();
    expect(invalide.erreurPseudo).toContain("n'accepte que");
  });

  it('laisse un compte creer sans pseudo', () => {
    const modele = modeleCreation(
      { ...INVITE, pseudoSaisi: '', session: { nature: 'compte', progression: COMPTE } },
      PUBLIQUE,
    );

    expect(modele.pseudoRequis).toBe(false);
    expect(modele.envoi?.pseudo).toBeUndefined();
    expect(modele.envoi?.configuration.visibilite).toBe('publique');
  });

  it('montre le refus de creation du serveur, et non celui d une entree', () => {
    const refus = (action: 'creerPartie' | 'rejoindre'): EtatClient => ({
      ...INVITE,
      refus: {
        action,
        erreurs: [{ champ: 'configuration.mode', motif: "Ce mode de jeu n'existe pas." }],
      },
    });

    expect(modeleCreation(refus('creerPartie'), PUBLIQUE).refus).toBe(
      "Ce mode de jeu n'existe pas.",
    );
    expect(modeleCreation(refus('rejoindre'), PUBLIQUE).refus).toBeUndefined();
  });

  it('n envoie rien sans lien, ni pendant qu une demande attend', () => {
    expect(modeleCreation({ ...INVITE, connexion: 'horsLigne' }, PUBLIQUE).envoi).toBeUndefined();
    expect(modeleCreation({ ...INVITE, entreeEnCours: true }, PUBLIQUE).envoi).toBeUndefined();
  });
});
