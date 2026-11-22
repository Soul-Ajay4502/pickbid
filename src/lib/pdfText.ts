export function fitPdfText(
  text: string,
  maxWidth: number,
  fontSize: number,
  minFontSize: number,
  measure: (text: string, fontSize: number) => number,
): { text: string; fontSize: number } {
  while (fontSize > minFontSize && measure(text, fontSize) > maxWidth) {
    fontSize = Math.max(minFontSize, fontSize - 0.25);
  }
  if (measure(text, fontSize) <= maxWidth) return { text, fontSize };

  const segments = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.segment);
  while (segments.length && measure(`${segments.join('').trimEnd()}…`, fontSize) > maxWidth) segments.pop();
  return { text: measure('…', fontSize) <= maxWidth ? `${segments.join('').trimEnd()}…` : '', fontSize };
}
