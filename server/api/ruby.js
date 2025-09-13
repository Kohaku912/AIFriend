import { getTokenizer, specialReadings, kataToHira } from '../lib/tokenizer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  let tokenizer;
  try {
    tokenizer = await getTokenizer();
  } catch (e) {
    console.error('Tokenizer get error:', e);
    res.status(500).json({ error: 'Tokenizer initialization failed' });
    return;
  }
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const tokens = tokenizer.tokenize(text);
  let result = '';
  for (const token of tokens) {
    const surface = token.surface_form;
    let reading = kataToHira(token.reading);
    if (specialReadings[surface]) {
      reading = specialReadings[surface];
    }
    if (reading && /[\u4e00-\u9faf]/.test(surface)) {
      result += `<ruby>${surface}<rt>${reading}</rt></ruby>`;
    } else {
      result += surface;
    }
  }
  res.status(200).json({ ruby: result });
}
