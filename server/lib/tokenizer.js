import kuromoji from 'kuromoji';
import { join } from 'path';

let tokenizer = null;

export function getTokenizer() {
  if (tokenizer) return Promise.resolve(tokenizer);

  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: join(process.cwd(), 'lib/kuromoji_dict') }).build((err, _tokenizer) => {
      if (err) {
        console.error('kuromoji 初期化エラー:', err);
        reject(err);
      } else {
        tokenizer = _tokenizer;
        resolve(tokenizer);
      }
    });
  });
}
