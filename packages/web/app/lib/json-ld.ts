/**
 * Serialise a JSON-LD payload for embedding in `<script type="application/ld+json">`.
 *
 * A bare `JSON.stringify` is not safe here. The HTML parser does not understand JSON — it
 * only looks for the closing tag — so a `</script>` anywhere inside the payload ends the
 * element early and everything after it is parsed as markup. The artist profile feeds this
 * `sameAs` built from `socialLinks[].url` and `website`, and `z.string().url()` validates
 * without rewriting, so `https://x.com/</script><script>…` is stored exactly as typed and
 * would arrive here intact. `<!--` opens a comment and hides the rest the same way.
 *
 * Escaping `<` as `<` closes both: JSON parsers read the escape as the same character,
 * so crawlers see identical data, and the HTML parser never sees a `<` at all.
 *
 * This is why the helper exists rather than the call being inline — the escape is a security
 * property, and a security property wants a test.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
