/**
 * Les pictogrammes de l'interface.
 *
 * LES TRACES VIENNENT DE LA MAQUETTE (docs/design/Icon.dc.html): des lignes
 * arrondies sur une grille de vingt-quatre, qui prennent la couleur du texte qui
 * les entoure. La tension 9 du journal de conception les jugeait directement
 * reutilisables, et c'est le cas: aucune police d'icones, aucun fichier a charger,
 * aucun emoji. Quatre glyphes manquaient a la maquette et sont dessines dans le
 * meme style: pause, son, sonCoupe et fermer.
 *
 * SEULS LES GLYPHES UTILISES SONT REPRIS. La maquette en compte trente-cinq, dont
 * beaucoup servent des ecrans reportes (pass de saison, boutique, clans).
 *
 * LES ELEMENTS SONT FABRIQUES, PAS ANALYSES. Le dessin est une table de donnees,
 * et chaque forme devient un element SVG cree par le document: aucune chaine de
 * balisage n'est jamais interpretee.
 */

/** Une forme d'un pictogramme. */
type Forme =
  /** Un trace, dans la syntaxe de l'attribut d d'un chemin SVG. */
  | { readonly trace: string }
  /** Un cercle: centre x, centre y, rayon. */
  | { readonly cercle: readonly [number, number, number]; readonly plein?: boolean }
  /** Un rectangle: x, y, largeur, hauteur, arrondi. */
  | { readonly rectangle: readonly [number, number, number, number, number] };

/** Un pictogramme: ses formes, tracees ou pleines. */
interface DefinitionGlyphe {
  /** Le pictogramme est rempli plutot que trace. */
  readonly plein?: boolean;
  readonly formes: readonly Forme[];
}

const GLYPHES = {
  play: { plein: true, formes: [{ trace: 'M8 5l11 7-11 7z' }] },
  pause: {
    plein: true,
    formes: [{ rectangle: [6, 5, 4, 14, 1] }, { rectangle: [14, 5, 4, 14, 1] }],
  },
  stop: { plein: true, formes: [{ rectangle: [6, 6, 12, 12, 2] }] },
  arrowLeft: { formes: [{ trace: 'M19 12H5' }, { trace: 'M12 19l-7-7 7-7' }] },
  fermer: { formes: [{ trace: 'M6 6l12 12' }, { trace: 'M18 6L6 18' }] },
  check: { formes: [{ trace: 'M5 12.5l4.5 4.5L19 7' }] },
  replay: { formes: [{ trace: 'M4 12a8 8 0 1 1 2.5 5.8' }, { trace: 'M4 21v-5h5' }] },
  gear: {
    formes: [
      { cercle: [12, 12, 3.2] },
      { trace: 'M12 2v3' },
      { trace: 'M12 19v3' },
      { trace: 'M2 12h3' },
      { trace: 'M19 12h3' },
      { trace: 'M4.9 4.9l2.1 2.1' },
      { trace: 'M17 17l2.1 2.1' },
      { trace: 'M19.1 4.9l-2.1 2.1' },
      { trace: 'M7 17l-2.1 2.1' },
    ],
  },
  chat: {
    formes: [
      { trace: 'M5 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
    ],
  },
  send: { formes: [{ trace: 'M21 3L10 14' }, { trace: 'M21 3l-7 18-4-8-8-4z' }] },
  keyboard: {
    formes: [
      { rectangle: [3, 7, 18, 10, 1.5] },
      { trace: 'M7 10h.01' },
      { trace: 'M11 10h.01' },
      { trace: 'M15 10h.01' },
      { trace: 'M7 13h10' },
    ],
  },
  crown: { formes: [{ trace: 'M4 8l4 4 4-7 4 7 4-4-1.6 11H5.6z' }, { trace: 'M5 21h14' }] },
  ninja: {
    formes: [
      { trace: 'M12 2.5l2.3 7.2L21.5 12l-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3z' },
      { cercle: [12, 12, 1.8], plein: true },
    ],
  },
  target: {
    formes: [
      { cercle: [12, 12, 8.5] },
      { cercle: [12, 12, 4.5] },
      { cercle: [12, 12, 1.4], plein: true },
    ],
  },
  shield: { formes: [{ trace: 'M12 3l8 3v6c0 5-4 7.7-8 9-4-1.3-8-4-8-9V6z' }] },
  trophy: {
    formes: [
      { trace: 'M7 4h10v5a5 5 0 0 1-10 0z' },
      { trace: 'M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10' },
      { trace: 'M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10' },
      { trace: 'M12 14v3' },
      { trace: 'M8.5 20h7' },
      { trace: 'M10 17h4' },
    ],
  },
  son: {
    formes: [
      { trace: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z' },
      { trace: 'M15.5 9a4 4 0 0 1 0 6' },
      { trace: 'M18 6.5a7.5 7.5 0 0 1 0 11' },
    ],
  },
  sonCoupe: {
    formes: [
      { trace: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z' },
      { trace: 'M16 10l5 5' },
      { trace: 'M21 10l-5 5' },
    ],
  },
} satisfies Readonly<Record<string, DefinitionGlyphe>>;

/** Le nom d'un pictogramme. */
export type Glyphe = keyof typeof GLYPHES;

/** L'espace de noms des elements SVG, sans lequel le document fabrique des elements HTML inertes. */
const ESPACE_SVG = 'http://www.w3.org/2000/svg';

/**
 * Fabrique un pictogramme.
 *
 * Il est decoratif pour les lecteurs d'ecran: le bouton ou le texte qui
 * l'accompagne porte le sens.
 */
export function icone(doc: Document, glyphe: Glyphe, taille = 18): SVGSVGElement {
  const definition: DefinitionGlyphe = GLYPHES[glyphe];
  const plein = definition.plein === true;
  const svg = doc.createElementNS(ESPACE_SVG, 'svg');

  poser(svg, {
    class: 'icone',
    width: String(taille),
    height: String(taille),
    viewBox: '0 0 24 24',
    fill: plein ? 'currentColor' : 'none',
    stroke: plein ? 'none' : 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  for (const forme of definition.formes) {
    svg.append(formeSvg(doc, forme));
  }

  return svg;
}

/** Fabrique l'element SVG d'une forme. */
function formeSvg(doc: Document, forme: Forme): SVGElement {
  if ('trace' in forme) {
    const chemin = doc.createElementNS(ESPACE_SVG, 'path');
    chemin.setAttribute('d', forme.trace);

    return chemin;
  }

  if ('cercle' in forme) {
    const [cx, cy, r] = forme.cercle;
    const cercle = doc.createElementNS(ESPACE_SVG, 'circle');
    poser(cercle, { cx: String(cx), cy: String(cy), r: String(r) });

    if (forme.plein === true) {
      cercle.setAttribute('fill', 'currentColor');
    }

    return cercle;
  }

  const [x, y, largeur, hauteur, arrondi] = forme.rectangle;
  const rectangle = doc.createElementNS(ESPACE_SVG, 'rect');
  poser(rectangle, {
    x: String(x),
    y: String(y),
    width: String(largeur),
    height: String(hauteur),
    rx: String(arrondi),
  });

  return rectangle;
}

/** Pose une serie d'attributs sur un element. */
function poser(element: Element, attributs: Readonly<Record<string, string>>): void {
  for (const [nom, valeur] of Object.entries(attributs)) {
    element.setAttribute(nom, valeur);
  }
}
