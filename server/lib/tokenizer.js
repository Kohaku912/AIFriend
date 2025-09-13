// lib/tokenizer.js
import kuromoji from 'kuromoji';
import { join } from 'path';

let tokenizer = null;
let initializing = false;
let initPromise = null;

export function getTokenizer() {
  if (tokenizer) {
    return Promise.resolve(tokenizer);
  }
  if (initializing) {
    return initPromise;
  }
  initializing = true;
  initPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: join(process.cwd(), 'node_modules/kuromoji/dict') }).build((err, _tokenizer) => {
      if (err) {
        console.error('kuromoji 初期化エラー:', err);
        reject(err);
      } else {
        tokenizer = _tokenizer;
        console.log('kuromoji tokenizer ready');
        resolve(tokenizer);
      }
    });
  });
  return initPromise;
}

export const specialReadings = {
  '言葉': 'ことは',
  '数十': 'かずと',
};

export function kataToHira(katakana) {
  if (!katakana) return katakana;
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
