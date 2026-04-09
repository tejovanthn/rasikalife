/**
 * Generate dynamic OG images as base64-encoded SVG
 */

// Browser-compatible base64 encoding for UTF-8 strings
function base64Encode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    // Server-side (Node.js)
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  // Client-side (browser)
  return btoa(unescape(encodeURIComponent(str)));
}

export function generateCompositionOGImage(composition: {
  title: string;
  composer: { name: string };
}): string {
  const svg = `
     <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <style>
           .title { font-family: Arial, sans-serif; font-size: 48px; fill: white; text-anchor: middle; }
           .subtitle { font-family: Arial, sans-serif; font-size: 24px; fill: #cccccc; text-anchor: middle; }
         </style>
       </defs>
       <rect width="1200" height="630" fill="#1a1a1a"/>
       <text x="600" y="300" class="title">${escapeXml(composition.title)}</text>
       <text x="600" y="360" class="subtitle">by ${escapeXml(composition.composer.name)}</text>
       <text x="600" y="420" class="subtitle" font-size="18">Rasika.life - Indian Classical Music</text>
     </svg>
   `.trim();

  return `data:image/svg+xml;base64,${base64Encode(svg)}`;
}

export function generateArtistOGImage(artist: {
  name: string;
}): string {
  const svg = `
     <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <style>
           .title { font-family: Arial, sans-serif; font-size: 48px; fill: white; text-anchor: middle; }
           .subtitle { font-family: Arial, sans-serif; font-size: 24px; fill: #cccccc; text-anchor: middle; }
         </style>
       </defs>
       <rect width="1200" height="630" fill="#1a1a1a"/>
       <text x="600" y="300" class="title">${escapeXml(artist.name)}</text>
       <text x="600" y="360" class="subtitle">Indian Classical Music Artist</text>
       <text x="600" y="420" class="subtitle" font-size="18">Rasika.life - Classical Music Database</text>
     </svg>
   `.trim();

  return `data:image/svg+xml;base64,${base64Encode(svg)}`;
}

export function generateRagaOGImage(raga: { name: string }): string {
  const svg = `
     <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <style>
           .title { font-family: Arial, sans-serif; font-size: 48px; fill: white; text-anchor: middle; }
           .subtitle { font-family: Arial, sans-serif; font-size: 24px; fill: #cccccc; text-anchor: middle; }
         </style>
       </defs>
       <rect width="1200" height="630" fill="#1a1a1a"/>
       <text x="600" y="300" class="title">${escapeXml(raga.name)}</text>
       <text x="600" y="360" class="subtitle">Indian Classical Raga</text>
       <text x="600" y="420" class="subtitle" font-size="18">Rasika.life - Indian Classical Music</text>
     </svg>
   `.trim();

  return `data:image/svg+xml;base64,${base64Encode(svg)}`;
}

/**
 * Escape XML entities for SVG text content
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
