/**
 * Le mode Chasse: des traqueurs infectent les proies qu'ils attrapent, et les proies
 * doivent tenir jusqu'au bout.
 *
 * Etape 7.3. Aucune version du jeu d'origine n'avait ce mode: ses regles sont celles que
 * le porteur du projet a tranchees le 16 septembre 2026 (docs/plan/etape-7-3.md).
 *
 * QUI EST TRAQUEUR, ET DEPUIS QUAND. L'etat d'une Chasse lancee porte une table des
 * traqueurs, avec le temps de jeu ecoule quand chacun l'est devenu (EtatPartie.chasse).
 * Un joueur qui n'y figure pas est une proie. La couleur des traqueurs le dit a l'ecran,
 * et le moteur s'en sert deja: deux joueurs de meme couleur ne se capturent pas. La table
 * et la couleur s'ecrivent ensemble, dans devenirTraqueur, et nulle part ailleurs.
 *
 * CE QUI SE DECIDE ICI:
 *
 *   - Au lancement, un traqueur par tranche de cinq joueurs, tire au sort.
 *   - Un traqueur qui touche une proie l'infecte: elle devient traqueur sur place. Un
 *     nouveau traqueur ne capture qu'au bout de trois secondes.
 *   - Si plus aucun traqueur n'est la, une proie tiree au sort le devient.
 *   - Un malus frappe l'autre camp.
 *   - Le score d'un joueur est son temps de survie, et la partie est decidee quand il ne
 *     reste plus aucune proie.
 *
 * Les ninjas de la carte servent de camouflage: un joueur ne les repeint pas, et il n'y a
 * pas de bots noirs, que les reglages imposes par le mode retirent
 * (imposerLesReglagesDuMode, dans packages/shared).
 */

import { CHASSE, COULEUR_DES_TRAQUEURS, entier } from '@neon-ninja/shared';

import { captureAutorisee, inscrireAuJournal } from './capture.js';
import type { EtatPartie, IdentifiantEntite, Joueur } from './etat.js';
import type { Entrees } from './moteur.js';
import type { VictimeDuMalus } from './objets.js';

/** Ce joueur est-il un traqueur ? Faux pour une proie, et dans une Chasse pas encore lancee. */
export function estTraqueur(etat: EtatPartie, id: IdentifiantEntite): boolean {
  return etat.chasse?.[id] !== undefined;
}

/**
 * Fait d'un joueur un traqueur: il en prend la couleur, et le moment est retenu.
 *
 * C'est la seule fonction qui ecrit l'une ou l'autre, pour que la couleur et la table des
 * traqueurs ne puissent jamais se contredire. Rend l'etat inchange pour un joueur absent
 * de la partie, ou deja traqueur: il garde son moment d'origine.
 */
export function devenirTraqueur(etat: EtatPartie, id: IdentifiantEntite): EtatPartie {
  const joueur = etat.joueurs[id];

  if (joueur === undefined || estTraqueur(etat, id)) {
    return etat;
  }

  return {
    ...etat,
    joueurs: { ...etat.joueurs, [id]: { ...joueur, couleur: COULEUR_DES_TRAQUEURS } },
    chasse: { ...etat.chasse, [id]: etat.tempsEcouleMs },
  };
}

/**
 * Ce traqueur a-t-il passe son delai de nouveau traqueur ?
 *
 * Trois secondes, comparees en inegalite stricte comme le delai entre deux captures: a
 * trois secondes pile, il ne capture pas encore. Faux pour une proie.
 */
export function traqueurPret(etat: EtatPartie, id: IdentifiantEntite): boolean {
  const depuis = etat.chasse?.[id];

  return depuis !== undefined && etat.tempsEcouleMs - depuis > CHASSE.DELAI_NOUVEAU_TRAQUEUR_MS;
}

/**
 * Tire les premiers traqueurs d'une Chasse qui se lance.
 *
 * Un traqueur par tranche de cinq joueurs, arrondi au-dessus: un de deux a cinq joueurs,
 * deux de six a dix (decision 6 du porteur du projet). Le tirage se fait parmi les joueurs
 * dans leur ordre dans l'etat, par le generateur a graine. Ils deviennent traqueurs au temps
 * de jeu present, zero au lancement: leur delai de trois secondes coincide avec la
 * protection d'apparition que chaque proie porte deja depuis le salon.
 *
 * La table des traqueurs est posee meme vide: c'est elle qui dit qu'une Chasse est lancee.
 */
export function lancerLaChasse(etat: EtatPartie): EtatPartie {
  const candidats = Object.keys(etat.joueurs);
  const nombre = Math.ceil(candidats.length / CHASSE.JOUEURS_PAR_TRAQUEUR);
  let courant: EtatPartie = { ...etat, chasse: {} };

  for (let tire = 0; tire < nombre; tire += 1) {
    const tirage = entier(courant.alea, candidats.length);
    const [elu] = candidats.splice(tirage.valeur, 1);

    courant = devenirTraqueur({ ...courant, alea: tirage.alea }, elu as IdentifiantEntite);
  }

  return courant;
}

/**
 * Ce que la Chasse fait a chaque battement, avant le releve des contacts: remplacer les
 * traqueurs partis.
 *
 * Decision 11 du porteur du projet: si tous les traqueurs ont quitte la partie, une proie
 * tiree au sort devient traqueur, avec son delai de trois secondes, et la partie continue.
 * Il faut deux joueurs au moins: seul, un joueur reste proie jusqu'au terme. Un traqueur
 * dont le lien est tombe (etape 2.5) est encore dans l'etat, et compte.
 *
 * Une Chasse qui n'est pas lancee n'a pas de traqueurs a remplacer: rien ne se passe.
 */
export function agirEnChasse(etat: EtatPartie, _entrees: Entrees, _dtMs: number): EtatPartie {
  if (etat.chasse === undefined) {
    return etat;
  }

  const joueurs = Object.keys(etat.joueurs);

  if (joueurs.length < CHASSE.JOUEURS_MINIMUM || joueurs.some((id) => estTraqueur(etat, id))) {
    return etat;
  }

  const tirage = entier(etat.alea, joueurs.length);

  return devenirTraqueur({ ...etat, alea: tirage.alea }, joueurs[tirage.valeur] as string);
}

/**
 * Un traqueur infecte une proie.
 *
 * La proie devient traqueur sur place, sans reapparaitre ailleurs: son delai de trois
 * secondes laisse aux proies voisines le temps de s'eloigner. Aucun ninja ne change de
 * main. Les compteurs et le journal des captures avancent comme pour toute capture, et
 * l'evenement de capture le dit, avec la couleur des traqueurs pour nouvelle couleur.
 *
 * Renvoie l'etat inchange, le meme objet, si l'infection n'est pas permise: l'attaquant
 * n'est pas un traqueur pret, la victime n'est pas une proie, ou les verifications
 * communes a toutes les captures la refusent (protection, invincibilite, delai d'une
 * seconde entre deux captures).
 */
export function infecter(
  etat: EtatPartie,
  traqueurId: IdentifiantEntite,
  proieId: IdentifiantEntite,
): EtatPartie {
  const traqueur = etat.joueurs[traqueurId];
  const proie = etat.joueurs[proieId];

  if (
    traqueur === undefined ||
    proie === undefined ||
    !traqueurPret(etat, traqueurId) ||
    estTraqueur(etat, proieId) ||
    !captureAutorisee(traqueur, proie)
  ) {
    return etat;
  }

  const infecte = devenirTraqueur(etat, proieId);
  const devenue = infecte.joueurs[proieId] as Joueur;

  return {
    ...infecte,
    joueurs: {
      ...infecte.joueurs,
      [traqueurId]: {
        ...traqueur,
        captures: traqueur.captures + 1,
        joueursCaptures: inscrireAuJournal(traqueur.joueursCaptures, proieId, proie.pseudo),
        tempsDepuisDerniereCaptureMs: 0,
      },
      [proieId]: {
        ...devenue,
        capturesSubies: inscrireAuJournal(proie.capturesSubies, traqueurId, traqueur.pseudo),
      },
    },
    evenements: [
      ...infecte.evenements,
      {
        type: 'captureJoueur',
        attaquant: traqueurId,
        victime: proieId,
        botsTransferes: 0,
        nouvelleCouleurVictime: COULEUR_DES_TRAQUEURS,
        position: proie.position,
      },
    ],
  };
}

/**
 * Qui subit un malus, en Chasse: l'autre camp.
 *
 * Le camp se lit a la couleur, la seule chose que la question recoit: un traqueur porte
 * toujours la couleur des traqueurs, et une proie jamais.
 */
export const malusEnChasse: VictimeDuMalus = (ramasseur, autre) =>
  (ramasseur.couleur === COULEUR_DES_TRAQUEURS) !== (autre.couleur === COULEUR_DES_TRAQUEURS);

/**
 * Le temps de survie d'un joueur, en millisecondes: le temps de jeu ecoule pour une proie,
 * le moment ou il est devenu traqueur pour un traqueur.
 */
export function tempsDeSurvieMs(etat: EtatPartie, id: IdentifiantEntite): number {
  return etat.chasse?.[id] ?? etat.tempsEcouleMs;
}

/**
 * La Chasse est-elle decidee avant le terme ?
 *
 * Oui des qu'une Chasse lancee n'a plus aucune proie, qu'elle soit tombee ou partie
 * (decision 8 du porteur du projet). Une Chasse au salon ne l'est jamais.
 */
export function chasseDecidee(etat: EtatPartie): boolean {
  return (
    etat.chasse !== undefined && Object.keys(etat.joueurs).every((id) => estTraqueur(etat, id))
  );
}
