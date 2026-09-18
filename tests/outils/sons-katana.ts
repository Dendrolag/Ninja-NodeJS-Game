/**
 * Fabrique les deux sons du katana du mode Massacre (etape 7.4): un balayage de lame et un
 * impact tranchant, enregistres dans assets/sons.
 *
 * POURQUOI UN SCRIPT PLUTOT QU'UN FICHIER TROUVE EN LIGNE. Decision du porteur du projet du
 * 16 septembre 2026: les sons sont synthetises ici, sans rien telecharger, et restent des
 * fichiers ordinaires. Un vrai son peut les remplacer plus tard sous le meme nom, sans
 * toucher au code.
 *
 * COMMENT ILS SONT FAITS. Tout part d'un bruit blanc tire d'un generateur a graine: le meme
 * script rend toujours les memes octets.
 *
 *   - Le balayage est un souffle qui monte puis retombe en 180 millisecondes, filtre par un
 *     passe-bande dont la frequence glisse du grave vers l'aigu: c'est ce glissement que
 *     l'oreille entend comme une lame qui fend l'air.
 *   - L'impact est un claquement bref et sec, du bruit tres aigu qui s'eteint en 30
 *     millisecondes, pose sur une note grave et amortie qui donne le poids de la chair
 *     tranchee.
 *
 * Mode d'emploi, depuis la racine du depot:
 *
 *   node --disable-warning=ExperimentalWarning tests/outils/sons-katana.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { creerAlea, reel } from '../../packages/shared/dist/index.js';

/** Frequence d'echantillonnage, en echantillons par seconde. */
const FREQUENCE = 44_100;

/** Un generateur de bruit blanc reproductible, entre moins un et un. */
function bruit(graine: number): () => number {
  let alea = creerAlea(graine);

  return () => {
    const tirage = reel(alea, -1, 1);
    alea = tirage.alea;
    return tirage.valeur;
  };
}

/**
 * Un filtre passe-bande a etat variable, dont la frequence peut changer a chaque
 * echantillon: c'est ce qui fait glisser le souffle du balayage.
 */
function passeBande(): (entree: number, frequenceHz: number, resonance: number) => number {
  let bas = 0;
  let bande = 0;

  return (entree, frequenceHz, resonance) => {
    const f = 2 * Math.sin((Math.PI * frequenceHz) / FREQUENCE);
    bas += f * bande;
    const haut = entree - bas - resonance * bande;
    bande += f * haut;
    return bande;
  };
}

/** Le balayage de lame: un souffle qui glisse de 600 a 5 000 hertz en 180 millisecondes. */
function balayage(): Float32Array {
  const duree = Math.round(FREQUENCE * 0.18);
  const echantillons = new Float32Array(duree);
  const souffle = bruit(7);
  const filtre = passeBande();

  for (let rang = 0; rang < duree; rang += 1) {
    const avancee = rang / duree;
    // L'enveloppe monte vite puis retombe: le coup part, fend l'air, et s'eteint.
    const enveloppe = Math.sin(Math.PI * Math.min(avancee * 1.6, 1)) * (1 - avancee) ** 0.6;
    const frequence = 600 + 4400 * avancee ** 1.5;
    echantillons[rang] = filtre(souffle(), frequence, 0.35) * enveloppe * 0.9;
  }

  return echantillons;
}

/** L'impact: un claquement aigu de 30 millisecondes sur une note grave amortie. */
function impact(): Float32Array {
  const duree = Math.round(FREQUENCE * 0.16);
  const echantillons = new Float32Array(duree);
  const claquement = bruit(11);
  const filtre = passeBande();

  for (let rang = 0; rang < duree; rang += 1) {
    const secondes = rang / FREQUENCE;
    const sec = filtre(claquement(), 3200, 0.5) * Math.exp(-secondes / 0.012);
    const grave = Math.sin(2 * Math.PI * 95 * secondes) * Math.exp(-secondes / 0.045);
    echantillons[rang] = sec * 1.1 + grave * 0.6;
  }

  return echantillons;
}

/**
 * Met des echantillons au format WAV, en 16 bits mono, apres les avoir ramenes a un niveau
 * commun: le plus fort des echantillons touche 90 pour cent de la pleine echelle.
 */
function enWav(echantillons: Float32Array): Buffer {
  const crete = echantillons.reduce((plus, valeur) => Math.max(plus, Math.abs(valeur)), 0);
  const gain = crete === 0 ? 0 : 0.9 / crete;
  const donnees = Buffer.alloc(echantillons.length * 2);

  echantillons.forEach((valeur, rang) => {
    donnees.writeInt16LE(Math.round(Math.max(-1, Math.min(1, valeur * gain)) * 32_767), rang * 2);
  });

  const entete = Buffer.alloc(44);
  entete.write('RIFF', 0);
  entete.writeUInt32LE(36 + donnees.length, 4);
  entete.write('WAVE', 8);
  entete.write('fmt ', 12);
  entete.writeUInt32LE(16, 16);
  entete.writeUInt16LE(1, 20);
  entete.writeUInt16LE(1, 22);
  entete.writeUInt32LE(FREQUENCE, 24);
  entete.writeUInt32LE(FREQUENCE * 2, 28);
  entete.writeUInt16LE(2, 32);
  entete.writeUInt16LE(16, 34);
  entete.write('data', 36);
  entete.writeUInt32LE(donnees.length, 40);

  return Buffer.concat([entete, donnees]);
}

const dossier = join(import.meta.dirname, '..', '..', 'assets', 'sons');

writeFileSync(join(dossier, 'katana-swing.wav'), enWav(balayage()));
writeFileSync(join(dossier, 'katana-hit.wav'), enWav(impact()));

console.log(`Sons du katana ecrits dans ${dossier}.`);
