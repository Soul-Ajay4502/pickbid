import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPdfText } from './pdfText';

const graphemes = (text: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.segment);
const measure = (text: string, size: number) => graphemes(text).length * size;

test('poster names shrink before truncation and fit their available width', () => {
  const fitted = fitPdfText('स्वराज 07', measure('स्वराज 07', 16), 30, 16, measure);
  assert.equal(fitted.text, 'स्वराज 07');
  assert.equal(fitted.fontSize, 16);
  assert.ok(measure(fitted.text, fitted.fontSize) <= measure('स्वराज 07', 16));
});

test('long poster names truncate only at whole graphemes, not inside regional letters', () => {
  for (const name of ['सावकार भाऊ 11', 'தமிழ் அணி', 'ગુજરાતી ટીમ', 'తెలుగు జట్టు', 'A👨‍👩‍👧‍👦BC']) {
    const fitted = fitPdfText(name, 30, 16, 10, measure);
    assert.ok(measure(fitted.text, fitted.fontSize) <= 30);
    assert.equal(fitted.fontSize, 10);
    assert.ok(fitted.text.endsWith('…'));
    assert.deepEqual(graphemes(fitted.text.slice(0, -1)), graphemes(name).slice(0, 2));
  }
  assert.equal(fitPdfText('Long name', 1, 16, 10, measure).text, '');
});
