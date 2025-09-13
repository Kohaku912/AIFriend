// api/ruby.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
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

  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'Missing Yahoo! Client ID' });
    return;
  }

  try {
    const response = await fetch('https://jlp.yahooapis.jp/MAService/V2/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ruby-api',
        jsonrpc: '2.0',
        method: 'jlp.maservice.parse',
        params: { q: text },
      }),
    });

    const data = await response.json();
    if (data.error) {
      res.status(500).json({ error: data.error.message });
      return;
    }

    const rubyText = data.result.tokens
      .map(([surface, reading]) => {
        if (reading && /[一-龯々〆〤]/.test(surface)) {
          return `<ruby>${surface}<rt>${reading}</rt></ruby>`;
        }
        return surface;
      })
      .join('');

    res.status(200).json({ ruby: rubyText });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
