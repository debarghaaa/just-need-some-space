import { OFFICIAL } from './palette';

/**
 * Explorer icon, 25 x 32: the supplied voxel astronaut (front view, one hand raised in a wave,
 * life-support pack on the back) redrawn as flat pixel art in the official colour system. Suit
 * Icy Blue with Porcelain highlights and Sapphire shade, Prussian Blue outline, Ink Black visor
 * with a Porcelain glint, Apricot Cream trim, one Cream patch, Electric Aqua lights on the pack.
 * Glyph characters: s suit, i highlight, b shade, n outline, k visor, d visor shade, w glint,
 * o orange trim, a amber patch, c cyan light, . transparent.
 */
export const ASTRONAUT_ICON_ROWS: readonly string[] = [
  '.........nnnnnnnnn.......',
  '........nsssssssssn......',
  '......nssiisssssssbbn....',
  '......nsiissssssssbbn....',
  '......nsiooooooooobbn....',
  '......nsskwwkkkkkdbbn....',
  '......nsskwkkkkkkdbbn....',
  '......nsskkkkkkkkdbbn....',
  '......nsskkkkkkkddbbn....',
  '.nnnn.nssdddddddddbbn....',
  'niiin.nssbbbbbbbbbbbn.nnn',
  'niiin..nbbbbbbbbbbbn..bbn',
  'niisnnn.nnnnnnnnnnnnnnnbn',
  '.nnssssssssssssssbnsssbnn',
  '..nssssssssssssssbnsssbnn',
  '..nooossssaassossbnsssbnn',
  '..nsssssssaasssssbnsssbnn',
  '..nbbbbssssssssssbnsssbnn',
  '...nnnnssssssssssbnoooonn',
  '......nssssssssssbnsssbnn',
  '......nooooooooooonsssbnn',
  '......nssssssssssbnbbbbnn',
  '......nssssssssssbnbbbbn.',
  '......nbbbbbbbbbbbnnnnn..',
  '.......nnnnnnnnnnnn......',
  '......nssssbnnsssbbn.....',
  '......nssssbnnsssbbn.....',
  '......nooooonnooooon.....',
  '......nssssbnnsssbbn.....',
  '......nbbbbbnnbbbbbn.....',
  '......nbbbbbnnbbbbbn.....',
  '.......nnnnn..nnnnnn.....',
];

export const ASTRONAUT_ICON_MAP: Record<string, string> = {
  s: OFFICIAL.icyBlue,
  i: OFFICIAL.porcelain,
  b: OFFICIAL.sapphire,
  n: OFFICIAL.prussianBlue,
  k: OFFICIAL.inkBlack,
  d: OFFICIAL.prussianBlue,
  w: OFFICIAL.porcelain,
  o: OFFICIAL.apricotCream,
  a: OFFICIAL.cream,
  c: OFFICIAL.electricAqua,
};

export const ASTRONAUT_ICON_W = 25;
export const ASTRONAUT_ICON_H = 32;
