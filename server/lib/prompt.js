// lib/prompt.js

export function buildPrompt(personality, userMessage, previous, kanjiLevel) {
  const system = `あなたは「${personality?.name ?? '友達AI'}」という友達AIです。
口調: ${personality?.tone ?? 'フレンドリー'}。
常に${personality?.extra ?? 'その教科や趣味の視点'}を会話に絡めてください。
友達の口調でユーザーを励まし、短く（目安150文字以内）答えてください。
ユーザーの漢字、問題のレベルは「${kanjiLevel ?? '中学生以上'}」です。
subfieldの種類は「${personality?.subfields?.join(', ') ?? '未分類'}」です。
**重要**: もしクイズ（確認問題）を出す場合は、必ず以下のフォーマットで最後に付けてください。

<<QUIZ>>JSON<<ENDQUIZ>>

JSON のスキーマ（必須フィールド）:
{
  "genre": "${personality?.genre ?? '未分類'}",
  "subfield": "例えば '漢字' など（1つ選んで入れてください）",
  "type": "mcq|text",
  "question": "問題文",
  "choices": ["A","B","C"],      // type==='mcq' の場合
  "answerIndex": 1,              // type==='mcq' の場合（0始まり）
  "answer": "正解の文字列（必ず入れてください）"
}

出力上の注意:
- JSON は <<QUIZ>> と <<ENDQUIZ>> の中に **厳密に**入れること。JSON の前に短い導入文は1文のみ許可。
- JSON のフィールドは必ず揃えてください（特に subfield, answer を必須）。
- subfield はそのジャンルの細かい分野を AI 自身で1つ選んで文字列で入れること。
- リスニング用に発音する内容を渡す場合は "audioText" を入れてください（例: "audioText":"apple"）。

それでは、以下のユーザーの入力に対して返信してください。
`;

  let ctx = '';
  if (previous && previous.role && previous.text) {
    ctx = `前回のやり取り（直前1件）:\n${previous.role === 'user' ? 'User' : 'Assistant'}: ${previous.text}\n\n`;
  }

  return `${system}${ctx}User: ${userMessage}\nAssistant:`;
}

export function extractQuizJsonFromText(text) {
  const start = text.indexOf('<<QUIZ>>');
  const end = text.indexOf('<<ENDQUIZ>>');
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonText = text.substring(start + '<<QUIZ>>'.length, end).trim();
  try {
    const obj = JSON.parse(jsonText);
    return { quiz: obj, full: text };
  } catch (e) {
    return null;
  }
}

export function buildQuizPrompt(personality, userMessage) {
  // 再生成時用に JSON のみを返すようにするよう強調した prompt
  return `${buildPrompt(personality, userMessage, null, null)}\nただし、**問題形式を含む JSON のみ**を <<QUIZ>>...<<ENDQUIZ>> の中に出力してください。`;
}
