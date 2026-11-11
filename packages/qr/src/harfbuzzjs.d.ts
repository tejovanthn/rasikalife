// harfbuzzjs ships no types for its CommonJS entry; this is the part we call.
declare module 'harfbuzzjs' {
  export interface HbBlob {
    destroy(): void;
  }
  export interface HbFace {
    upem: number;
    destroy(): void;
  }
  export interface HbGlyph {
    /** Glyph id. */
    g: number;
    /** Cluster index into the source text. */
    cl: number;
    /** Horizontal advance, in font units. */
    ax: number;
    ay: number;
    /** Offsets, in font units. */
    dx: number;
    dy: number;
  }
  export interface HbBuffer {
    addText(text: string): void;
    guessSegmentProperties(): void;
    json(): HbGlyph[];
    destroy(): void;
  }
  export interface HbFont {
    /** Path in font units, y pointing up, absolute `M L Q C Z` commands. */
    glyphToPath(glyphId: number): string;
    setVariations(variations: Record<string, number>): void;
    destroy(): void;
  }
  export interface Hb {
    createBlob(data: Uint8Array): HbBlob;
    createFace(blob: HbBlob, index: number): HbFace;
    createFont(face: HbFace): HbFont;
    createBuffer(): HbBuffer;
    shape(font: HbFont, buffer: HbBuffer, features?: string): void;
  }
  const hb: Promise<Hb>;
  export default hb;
}
