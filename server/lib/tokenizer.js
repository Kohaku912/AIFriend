// api/ruby.js
import TinySegmenter from 'tiny-segmenter';
import { toHiragana } from 'wanakana';

const segmenter = new TinySegmenter();
const specialReadings = { 言葉: 'ことは', 数十: 'かずと' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const tokens = segmenter.segment(text);
  let result = '';
  for (const token of tokens) {
    let reading = toHiragana(token);
    if (specialReadings[token]) reading = specialReadings[token];
    if (/[一-龯]/.test(token)) {
      result += `<ruby>${token}<rt>${reading}</rt></ruby>`;
    } else {
      result += token;
    }
  }

  res.status(200).json({ ruby: result });
}


export function kataToHira(katakana) {
  if (!katakana) return katakana;
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
