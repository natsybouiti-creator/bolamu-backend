// ============================================================
// BOLAMU — Génération d'images côté serveur (carte cadeau Bon Zora)
// sharp/librsvg (rendu SVG + texte via fontconfig, voir render.yaml
// FONTCONFIG_FILE) + qrcode (buffer PNG). Aucune dépendance DB/WhatsApp —
// fonction pure : données structurées en entrée, Buffer PNG en sortie.
//
// Un seul poids de police (700) pour tout le texte Plus Jakarta Sans —
// hiérarchie visuelle par la taille uniquement, jamais par l'épaisseur.
// Décision du 8 juillet 2026 : mélanger plusieurs poids d'un même variable
// font dans un même rendu SVG (sharp/librsvg/pango) fait échouer la
// résolution d'au moins un des poids (police de repli, reproductible) ;
// remplacer par des fichiers statiques par poids a ouvert un autre
// problème de résolution non résolu — un seul poids évite les deux.
// ============================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');

const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'landing', '01-logo-navbarronds.png');

const CARD_W = 600;
const CARD_H = 800;
const NAVY = '#0A2463';
const TOP_ZONE_H = CARD_H - 340; // hauteur de la zone navy avant le bloc blanc

const PARTNER_MAX_CHARS = 24;
const OFFER_MAX_CHARS_PER_LINE = 32;
const OFFER_MAX_LINES = 2;

// Layout du bloc blanc (bas de carte) — constantes nommées pour éviter
// tout chevauchement silencieux entre QR / code / badge / instruction.
const QR_SIZE = 210;
const QR_TOP_PAD = 18;
const CODE_GAP = 32;       // QR bottom -> baseline du code
const BADGE_GAP = 15;      // baseline du code -> haut du badge
const BADGE_H = 27;
const BADGE_TEXT_OFFSET = 18; // haut du badge -> baseline du texte badge
const INSTRUCTION_GAP = 22;   // bas du badge -> baseline de l'instruction

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tronque une chaîne à maxChars en coupant au dernier mot entier,
 * ajoute "…" si tronqué. Coupure dure seulement si un seul mot dépasse maxChars.
 */
function truncateAtWord(text, maxChars) {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace <= 0) return truncated.slice(0, maxChars - 1) + '…';
  return truncated.slice(0, lastSpace) + '…';
}

/**
 * Découpe un texte en au plus maxLines lignes de maxCharsPerLine caractères,
 * par mots entiers. Si le texte ne tient pas, tronque la dernière ligne avec "…".
 * Retourne un tableau de lignes (jamais plus de maxLines, jamais de ligne vide en fin).
 */
function wrapText(text, maxCharsPerLine, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine ? currentLine + ' ' + word : word;

    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    // La ligne courante est pleine — on la pousse et on repart avec ce mot
    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (lines.length >= maxLines) {
      // Plus de place : le mot courant devient le reliquat à tronquer plus bas
      currentLine = word;
      break;
    }

    if (word.length > maxCharsPerLine) {
      // Mot seul trop long : coupure dure
      lines.push(truncateAtWord(word, maxCharsPerLine));
      currentLine = '';
    } else {
      currentLine = word;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
    currentLine = '';
  }

  // Reliquat de mots non placés → la dernière ligne doit être tronquée avec "…"
  const consumedWords = lines.join(' ').split(/\s+/).length;
  const hasLeftover = consumedWords < words.length || currentLine;
  if (hasLeftover && lines.length > 0) {
    const lastIdx = lines.length - 1;
    if (!lines[lastIdx].endsWith('…')) {
      lines[lastIdx] = truncateAtWord(lines[lastIdx] + (currentLine ? ' ' + currentLine : ' x'), maxCharsPerLine);
    }
  }

  return lines.slice(0, maxLines);
}

/**
 * Génère la carte cadeau Bon Zora en PNG.
 * @param {{ partnerName: string, offerDescription: string|null, code: string, zoraCost: number }} params
 * @returns {Promise<Buffer>}
 */
async function generateBonZoraCard({ partnerName, offerDescription, code, zoraCost }) {
  const logoBase64 = fs.readFileSync(LOGO_PATH).toString('base64');

  const qrBuffer = await QRCode.toBuffer(code, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: '#0A2463', light: '#FFFFFF' }
  });
  const qrBase64 = qrBuffer.toString('base64');

  const partnerLine = truncateAtWord(String(partnerName || ''), PARTNER_MAX_CHARS);
  const offerLines = wrapText(offerDescription, OFFER_MAX_CHARS_PER_LINE, OFFER_MAX_LINES);
  const hasOffer = offerLines.length > 0;

  // Position du nom partenaire : ancré en haut si offre présente,
  // recentré verticalement dans la zone navy si pas d'offre.
  const partnerY = hasOffer ? 140 : Math.round(TOP_ZONE_H / 2);

  const offerTspans = offerLines
    .map((line, i) => `<tspan x="40" dy="${i === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`)
    .join('');

  // Layout bloc blanc — dérivé des constantes nommées, jamais de chevauchement.
  const qrY = TOP_ZONE_H + QR_TOP_PAD;
  const qrBottom = qrY + QR_SIZE;
  const codeY = qrBottom + CODE_GAP;
  const badgeTop = codeY + BADGE_GAP;
  const badgeBottom = badgeTop + BADGE_H;
  const badgeTextY = badgeTop + BADGE_TEXT_OFFSET;
  const instructionY = badgeBottom + INSTRUCTION_GAP;

  const svg = `
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          .partner { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 34px; fill: #ffffff; }
          .offer { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 24px; fill: #ffffff; }
          .brand { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 24px; fill: #ffffff; }
          .badge { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 16px; fill: #0A2463; }
          .code { font-family: monospace; font-weight: 700; font-size: 22px; fill: #0A2463; }
          .instruction { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 13px; fill: #6B6E80; }
        </style>
      </defs>

      <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${NAVY}"/>

      <image x="40" y="24" width="56" height="56" href="data:image/png;base64,${logoBase64}"/>
      <text x="110" y="58" class="brand">Bolamu</text>

      <text x="40" y="${partnerY}" class="partner">${escapeXml(partnerLine)}</text>
      ${hasOffer ? `<text x="40" y="${partnerY + 40}" class="offer">${offerTspans}</text>` : ''}

      <rect x="0" y="${TOP_ZONE_H}" width="${CARD_W}" height="${CARD_H - TOP_ZONE_H}" fill="#ffffff"/>
      <image x="${(CARD_W - QR_SIZE) / 2}" y="${qrY}" width="${QR_SIZE}" height="${QR_SIZE}" href="data:image/png;base64,${qrBase64}"/>
      <text x="${CARD_W / 2}" y="${codeY}" text-anchor="middle" class="code">${escapeXml(code)}</text>
      <rect x="${CARD_W / 2 - 90}" y="${badgeTop}" width="180" height="${BADGE_H}" rx="14" fill="#EEF2FF"/>
      <text x="${CARD_W / 2}" y="${badgeTextY}" text-anchor="middle" class="badge">${escapeXml(zoraCost)} Zora utilisés</text>
      <text x="${CARD_W / 2}" y="${instructionY}" text-anchor="middle" class="instruction">Présentez ce QR chez le partenaire</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateBonZoraCard };
