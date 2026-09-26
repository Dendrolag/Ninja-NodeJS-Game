/**
 * Tests des regles des amities (etape 3.6), sans base.
 *
 * Chaque geste depuis chaque relation, les demandes croisees, les bornes, soi-meme, et
 * le blocage silencieux dans les deux sens. Que la base applique ces decisions sous
 * verrou est verifie dans tests/base/amis.test.ts.
 */

import type { GesteDAmitie } from '@neon-ninja/shared';
import { BORNES_AMITIES, GESTES_D_AMITIE } from '@neon-ninja/shared';
import { describe, expect, it } from 'vitest';

import type { DecisionDAmitie, EcritureDAmitie, FaitsDAmitie } from './amities.js';
import {
  AMI_DE_SOI,
  AUCUNE_DEMANDE,
  DEBLOQUER_D_ABORD,
  GESTE_SUR_SOI,
  MES_AMIS_AU_COMPLET,
  SES_AMIS_AU_COMPLET,
  TROP_DE_DEMANDES,
  deciderDuGeste,
  faitsApres,
  relationVue,
} from './amities.js';

/** Deux comptes qui ne sont rien l'un pour l'autre. */
const AUCUN_LIEN: FaitsDAmitie = {
  soi: false,
  amis: false,
  demandeEnvoyee: false,
  demandeRecue: false,
  jeBloque: false,
  ilMeBloque: false,
  mesAmis: 0,
  sesAmis: 0,
  mesDemandesEnAttente: 0,
};

/** Des faits, a partir d'aucun lien. */
function faits(ecart: Partial<FaitsDAmitie> = {}): FaitsDAmitie {
  return { ...AUCUN_LIEN, ...ecart };
}

/** Les ecritures d'une decision permise, ou un echec de test explicite. */
function ecritures(decision: DecisionDAmitie): readonly EcritureDAmitie[] {
  if (!decision.permis) {
    throw new Error(`Attendu permis, recu refuse: ${decision.motif}`);
  }

  return decision.ecritures;
}

/** Le motif d'une decision refusee, ou un echec de test explicite. */
function motif(decision: DecisionDAmitie): string {
  if (decision.permis) {
    throw new Error(`Attendu refuse, recu permis: ${decision.ecritures.join(', ')}`);
  }

  return decision.motif;
}

/** La relation apres un geste permis, vue de celui qui le fait. */
function relationApres(geste: GesteDAmitie, avant: FaitsDAmitie) {
  const decision = deciderDuGeste(geste, avant);

  return relationVue(faitsApres(avant, ecritures(decision)));
}

describe('relationVue', () => {
  it('dit soi, aucune, ami, demande envoyee, demande recue et bloque', () => {
    expect(relationVue(faits({ soi: true }))).toBe('soi');
    expect(relationVue(faits())).toBe('aucune');
    expect(relationVue(faits({ amis: true }))).toBe('ami');
    expect(relationVue(faits({ demandeEnvoyee: true }))).toBe('demandeEnvoyee');
    expect(relationVue(faits({ demandeRecue: true }))).toBe('demandeRecue');
    expect(relationVue(faits({ jeBloque: true }))).toBe('bloque');
  });

  it('ne montre jamais au bloque qu il l est', () => {
    expect(relationVue(faits({ ilMeBloque: true }))).toBe('aucune');
    // Sa demande faite depuis le blocage se montre comme toute demande qui attend.
    expect(relationVue(faits({ ilMeBloque: true, demandeEnvoyee: true }))).toBe('demandeEnvoyee');
  });

  it('montre au bloqueur le blocage, meme si une demande ignoree attend', () => {
    expect(relationVue(faits({ jeBloque: true, demandeRecue: true }))).toBe('bloque');
  });
});

describe('deciderDuGeste: soi-meme', () => {
  it('refuse tous les gestes sur son propre compte', () => {
    for (const geste of GESTES_D_AMITIE) {
      expect(motif(deciderDuGeste(geste, faits({ soi: true })))).toBe(
        geste === 'demander' ? AMI_DE_SOI : GESTE_SUR_SOI,
      );
    }
  });
});

describe('deciderDuGeste: demander', () => {
  it('enregistre une demande entre deux comptes sans lien', () => {
    expect(ecritures(deciderDuGeste('demander', faits()))).toEqual(['creerDemandeEnvoyee']);
    expect(relationApres('demander', faits())).toBe('demandeEnvoyee');
  });

  it('ne fait rien pour un ami, ou une demande deja envoyee', () => {
    expect(ecritures(deciderDuGeste('demander', faits({ amis: true })))).toEqual([]);
    expect(ecritures(deciderDuGeste('demander', faits({ demandeEnvoyee: true })))).toEqual([]);
  });

  it('fait une demande croisee valoir acceptation', () => {
    expect(ecritures(deciderDuGeste('demander', faits({ demandeRecue: true })))).toEqual([
      'supprimerDemandeRecue',
      'creerAmitie',
    ]);
    expect(relationApres('demander', faits({ demandeRecue: true }))).toBe('ami');
  });

  it('refuse de demander un compte qu on bloque', () => {
    expect(motif(deciderDuGeste('demander', faits({ jeBloque: true })))).toBe(DEBLOQUER_D_ABORD);
  });

  it('enregistre la demande a un compte qui me bloque, sans rien en laisser voir', () => {
    const avant = faits({ ilMeBloque: true });

    expect(ecritures(deciderDuGeste('demander', avant))).toEqual(['creerDemandeEnvoyee']);
    expect(relationApres('demander', avant)).toBe('demandeEnvoyee');
  });

  it('refuse au-dela de 200 amis, ou de 50 demandes en attente', () => {
    const plein = BORNES_AMITIES.amisMaximum;
    const attente = BORNES_AMITIES.demandesEnAttenteMaximum;

    expect(motif(deciderDuGeste('demander', faits({ mesAmis: plein })))).toBe(MES_AMIS_AU_COMPLET);
    expect(motif(deciderDuGeste('demander', faits({ mesDemandesEnAttente: attente })))).toBe(
      TROP_DE_DEMANDES,
    );
    expect(ecritures(deciderDuGeste('demander', faits({ mesAmis: plein - 1 })))).toEqual([
      'creerDemandeEnvoyee',
    ]);
    expect(
      ecritures(deciderDuGeste('demander', faits({ mesDemandesEnAttente: attente - 1 }))),
    ).toEqual(['creerDemandeEnvoyee']);
  });

  it('laisse demander un compte qui a deja 200 amis: c est lui qui ne pourra pas accepter', () => {
    expect(
      ecritures(deciderDuGeste('demander', faits({ sesAmis: BORNES_AMITIES.amisMaximum }))),
    ).toEqual(['creerDemandeEnvoyee']);
  });

  it('refuse une demande croisee si l un des deux est au complet', () => {
    const plein = BORNES_AMITIES.amisMaximum;

    expect(motif(deciderDuGeste('demander', faits({ demandeRecue: true, mesAmis: plein })))).toBe(
      MES_AMIS_AU_COMPLET,
    );
    expect(motif(deciderDuGeste('demander', faits({ demandeRecue: true, sesAmis: plein })))).toBe(
      SES_AMIS_AU_COMPLET,
    );
  });
});

describe('deciderDuGeste: accepter', () => {
  it('fait l amitie a partir de sa demande', () => {
    expect(ecritures(deciderDuGeste('accepter', faits({ demandeRecue: true })))).toEqual([
      'supprimerDemandeRecue',
      'creerAmitie',
    ]);
    expect(relationApres('accepter', faits({ demandeRecue: true }))).toBe('ami');
  });

  it('ne fait rien pour un ami deja accepte', () => {
    expect(ecritures(deciderDuGeste('accepter', faits({ amis: true })))).toEqual([]);
  });

  it('refuse sans demande, ou pour une demande ignoree parce qu on le bloque', () => {
    expect(motif(deciderDuGeste('accepter', faits()))).toBe(AUCUNE_DEMANDE);
    expect(motif(deciderDuGeste('accepter', faits({ demandeEnvoyee: true })))).toBe(AUCUNE_DEMANDE);
    expect(motif(deciderDuGeste('accepter', faits({ demandeRecue: true, jeBloque: true })))).toBe(
      AUCUNE_DEMANDE,
    );
  });

  it('refuse si l un des deux a deja 200 amis', () => {
    const plein = BORNES_AMITIES.amisMaximum;

    expect(motif(deciderDuGeste('accepter', faits({ demandeRecue: true, mesAmis: plein })))).toBe(
      MES_AMIS_AU_COMPLET,
    );
    expect(motif(deciderDuGeste('accepter', faits({ demandeRecue: true, sesAmis: plein })))).toBe(
      SES_AMIS_AU_COMPLET,
    );
    expect(
      ecritures(
        deciderDuGeste('accepter', faits({ demandeRecue: true, mesAmis: plein - 1, sesAmis: 199 })),
      ),
    ).toEqual(['supprimerDemandeRecue', 'creerAmitie']);
  });
});

describe('deciderDuGeste: refuser, annuler, retirer', () => {
  it('efface la demande recue, sans rien d autre', () => {
    expect(ecritures(deciderDuGeste('refuser', faits({ demandeRecue: true })))).toEqual([
      'supprimerDemandeRecue',
    ]);
    expect(relationApres('refuser', faits({ demandeRecue: true }))).toBe('aucune');
  });

  it('efface sa propre demande', () => {
    expect(ecritures(deciderDuGeste('annuler', faits({ demandeEnvoyee: true })))).toEqual([
      'supprimerDemandeEnvoyee',
    ]);
    expect(relationApres('annuler', faits({ demandeEnvoyee: true }))).toBe('aucune');
  });

  it('defait l amitie', () => {
    expect(ecritures(deciderDuGeste('retirer', faits({ amis: true })))).toEqual([
      'supprimerAmitie',
    ]);
    expect(relationApres('retirer', faits({ amis: true, mesAmis: 1, sesAmis: 1 }))).toBe('aucune');
  });

  it('ne fait rien et ne refuse rien quand il n y a rien a defaire', () => {
    for (const geste of ['refuser', 'annuler', 'retirer'] as const) {
      expect(ecritures(deciderDuGeste(geste, faits()))).toEqual([]);
    }
  });
});

describe('deciderDuGeste: bloquer et debloquer', () => {
  it('defait l amitie et les demandes dans les deux sens, puis bloque', () => {
    expect(ecritures(deciderDuGeste('bloquer', faits({ amis: true })))).toEqual([
      'supprimerAmitie',
      'creerBlocage',
    ]);
    expect(ecritures(deciderDuGeste('bloquer', faits({ demandeEnvoyee: true })))).toEqual([
      'supprimerDemandeEnvoyee',
      'creerBlocage',
    ]);
    expect(ecritures(deciderDuGeste('bloquer', faits({ demandeRecue: true })))).toEqual([
      'supprimerDemandeRecue',
      'creerBlocage',
    ]);
    expect(relationApres('bloquer', faits({ amis: true, mesAmis: 1, sesAmis: 1 }))).toBe('bloque');
  });

  it('ne fait rien pour un compte deja bloque', () => {
    expect(ecritures(deciderDuGeste('bloquer', faits({ jeBloque: true })))).toEqual([]);
  });

  it('bloque aussi un compte qui me bloque deja', () => {
    expect(ecritures(deciderDuGeste('bloquer', faits({ ilMeBloque: true })))).toEqual([
      'creerBlocage',
    ]);
  });

  it('efface au deblocage les demandes ignorees pendant le blocage', () => {
    expect(ecritures(deciderDuGeste('debloquer', faits({ jeBloque: true })))).toEqual([
      'supprimerBlocage',
    ]);
    expect(
      ecritures(deciderDuGeste('debloquer', faits({ jeBloque: true, demandeRecue: true }))),
    ).toEqual(['supprimerBlocage', 'supprimerDemandeRecue']);
    expect(relationApres('debloquer', faits({ jeBloque: true, demandeRecue: true }))).toBe(
      'aucune',
    );
  });

  it('ne fait rien pour debloquer un compte qu on ne bloque pas', () => {
    expect(ecritures(deciderDuGeste('debloquer', faits({ demandeRecue: true })))).toEqual([]);
  });
});

describe('faitsApres', () => {
  it('suit les nombres d amis et de demandes en attente', () => {
    const apres = faitsApres(
      faits({ demandeRecue: true, mesAmis: 3, sesAmis: 7, mesDemandesEnAttente: 2 }),
      ['supprimerDemandeRecue', 'creerAmitie'],
    );

    expect(apres).toMatchObject({ amis: true, demandeRecue: false, mesAmis: 4, sesAmis: 8 });
    expect(
      faitsApres(faits({ mesDemandesEnAttente: 2 }), ['creerDemandeEnvoyee']).mesDemandesEnAttente,
    ).toBe(3);
    expect(
      faitsApres(faits({ amis: true, mesAmis: 4, sesAmis: 8 }), ['supprimerAmitie']),
    ).toMatchObject({ amis: false, mesAmis: 3, sesAmis: 7 });
    expect(
      faitsApres(faits({ demandeEnvoyee: true, mesDemandesEnAttente: 3 }), [
        'supprimerDemandeEnvoyee',
      ]).mesDemandesEnAttente,
    ).toBe(2);
  });

  it('ne compte pas deux fois ce qui existe deja, ni ne retire ce qui n existe pas', () => {
    const ami = faits({ amis: true, mesAmis: 1, sesAmis: 1 });

    expect(faitsApres(ami, ['creerAmitie'])).toEqual(ami);
    expect(faitsApres(faits(), ['supprimerAmitie', 'supprimerDemandeEnvoyee'])).toEqual(faits());
    expect(faitsApres(faits({ demandeEnvoyee: true }), ['creerDemandeEnvoyee'])).toEqual(
      faits({ demandeEnvoyee: true }),
    );
  });

  it('pose et retire le blocage', () => {
    expect(faitsApres(faits(), ['creerBlocage']).jeBloque).toBe(true);
    expect(faitsApres(faits({ jeBloque: true }), ['supprimerBlocage']).jeBloque).toBe(false);
  });
});
