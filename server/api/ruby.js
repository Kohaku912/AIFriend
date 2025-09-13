import TinySegmenter from 'tiny-segmenter';
import { toHiragana } from 'wanakana';

// 特殊読み仮名
const specialReadings = {
  言葉: 'ことは',
  数十: 'かずと',
};

const segmenter = new TinySegmenter();

export default async function handler(req, res) {
  // --- CORS 対応 ---
  res.setHeader('Access-Control-Allow-Origin', '*'); // 必要に応じて特定ドメインに変更
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // プリフライトリクエストに 200 で応答
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  // TinySegmenter で分かち書き
  const tokens = segmenter.segment(text);

  let result = '';
  for (const token of tokens) {
    let reading = toHiragana(token); // カタカナ→ひらがな
    if (specialReadings[token]) reading = specialReadings[token];

    // 漢字なら ruby タグを付与
    if (/[一-龯]/.test(token)) {
      result += `<ruby>${token}<rt>${reading}</rt></ruby>`;
    } else {
      result += token;
    }
  }

  res.status(200).json({ ruby: result });
}
