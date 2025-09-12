// server-for-quiz.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { GoogleGenAI } from '@google/genai';
import kuromoji from 'kuromoji';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
// --- kuromoji 初期化（ルビAPI用） ---
let tokenizer = null;
kuromoji.builder({ dicPath: join(__dirname, 'node_modules/kuromoji/dict') }).build((err, _tokenizer) => {
  if (err) {
    console.error('kuromoji初期化エラー:', err);
    return;
  }
  tokenizer = _tokenizer;
  console.log('kuromoji tokenizer ready');
});

// --- Gemini API キー確認 ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in environment');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

// --- レート制限用（IPごと、簡易実装） ---
const ipRequestCounts = {}; // { ip: { date: 'YYYY-MM-DD', count: N } }
const DAILY_LIMIT = 40;

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff && typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// --- ルビ用特殊読み --- 
const specialReadings = {
  '言葉': 'ことは',
  '数十': 'かずと',
};

// カタカナをひらがなに変換
function kataToHira(katakana) {
  if (!katakana) return katakana;
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function buildPrompt(personality, userMessage, previous, kanjiLevel) {
  const system = `あなたは「${personality?.name ?? '友達AI'}」という友達AIです。
口調: ${personality?.tone ?? 'フレンドリー'}。
常に${personality?.extra ?? 'その教科や趣味の視点'}を会話に絡めてください。
友達の口調でユーザーを励まし、短く（目安150文字以内）答えてください。
ユーザーの漢字、問題のレベルは「${kanjiLevel ?? '中学生以上'}」です。

**重要**: もしクイズ（確認問題）を出す場合は、必ず以下のフォーマットで最後に付けてください。

<<QUIZ>>JSON<<ENDQUIZ>>

JSON のスキーマ（必須フィールド）:
{
  "genre": "${personality?.genre ?? '未分類'}",
  "subfield": "例えば '読解' など（AIが1つ選んで入れてください）",
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

function extractQuizJsonFromText(text) {
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
app.post('/api/ruby', (req, res) => {
  if (!tokenizer) return res.status(500).json({ error: 'Tokenizer not ready' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const tokens = tokenizer.tokenize(text);
  let result = '';
  tokens.forEach(token => {
    const surface = token.surface_form;
    let reading = kataToHira(token.reading);
    if (specialReadings[surface]) reading = specialReadings[surface];
    if (reading && /[\u4e00-\u9faf]/.test(surface)) {
      result += `<ruby>${surface}<rt>${reading}</rt></ruby>`;
    } else {
      result += surface;
    }
  });
  res.json({ ruby: result });
});

// クイズを含む場合は <<QUIZ>>...<<ENDQUIZ>> が本文に含まれる。
app.post('/api/chat', async (req, res) => {
  try {
    const { message, personality = {}, previous, kanjiLevel } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const ip = getClientIp(req);
    const today = getTodayString();
    if (!ipRequestCounts[ip] || ipRequestCounts[ip].date !== today) {
      ipRequestCounts[ip] = { date: today, count: 0 };
    }

    // レート制限チェック
    if (ipRequestCounts[ip].count >= DAILY_LIMIT) {
      res.setHeader('X-RateLimit-Limit', DAILY_LIMIT.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: `1日あたりのリクエスト上限に達しました（上限: ${DAILY_LIMIT} 回）。明日になったら再度お試しください。`
      });
    }

    // カウントを進める（成功/失敗問わず消費）
    ipRequestCounts[ip].count += 1;
    const remaining = Math.max(0, DAILY_LIMIT - ipRequestCounts[ip].count);
    res.setHeader('X-RateLimit-Limit', DAILY_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    // reset は簡易的に翌日 0 時をセット（必要なら厳密化）
    const resetAt = new Date();
    resetAt.setHours(24, 0, 0, 0);
    res.setHeader('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));

    // --- 会話履歴（簡易ストレージ） ---
    const personaId = personality?.id || 'global';
    app.locals.conversations = app.locals.conversations || {};
    app.locals.conversations[personaId] = app.locals.conversations[personaId] || [];

    const prompt = buildPrompt(personality, message, previous, kanjiLevel);

    // 呼び出し
    let aiResponse;
    try {
      aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
    } catch (err) {
      console.error('AI generateContent error:', String(err));
      return res.status(500).json({ error: 'AI generation error', details: String(err) });
    }

    let replyText = (aiResponse?.text) || (Array.isArray(aiResponse?.outputs) && aiResponse.outputs[0]?.content) || '';

    // --- クイズ JSON を検査し、必須項目が欠けているなら1回だけリジェネ ---
    let extracted = extractQuizJsonFromText(replyText);
    if (extracted && extracted.quiz) {
      const q = extracted.quiz;
      const needs = [];
      if (!q.genre) needs.push('genre');
      if (!q.subfield) needs.push('subfield');
      if (!q.type) needs.push('type');
      if (!q.question) needs.push('question');
      if (q.type === 'mcq' && (!Array.isArray(q.choices) || q.choices.length < 2)) needs.push('choices');
      if (q.type === 'mcq' && (typeof q.answerIndex === 'undefined')) needs.push('answerIndex');
      if (typeof q.answer === 'undefined' || q.answer === null) needs.push('answer');

      if (needs.length > 0) {
        console.warn('Quiz JSON missing fields:', needs);
        // 再生成を1回だけ試みる（より厳密なプロンプトで JSON のみを返すように要求）
        try {
          const regen = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: buildQuizPrompt(personality, message),
          });
          const regenText = (regen?.text) || (Array.isArray(regen?.outputs) && regen.outputs[0]?.content) || '';
          // 置き換え
          replyText = regenText || replyText;
          // 再抽出
          const reex = extractQuizJsonFromText(replyText);
          if (!reex || !reex.quiz) {
            console.warn('Regeneration did not produce valid quiz JSON.');
          }
        } catch (err) {
          console.error('Regeneration error:', err);
        }
      }
      // サーバー側で簡易的に会話保存
      app.locals.conversations[personaId].push({ role: 'user', text: message });
      app.locals.conversations[personaId].push({ role: 'assistant', text: replyText });
      if (app.locals.conversations[personaId].length > 200) {
        app.locals.conversations[personaId].splice(0, app.locals.conversations[personaId].length - 200);
      }

      // そのままフロントへ渡す（フロントが <<QUIZ>>... を検知して処理）
      return res.json({ reply: replyText });
    }
  } catch (err) {
    console.error('server error:', err);
    return res.status(500).json({ error: 'server error', details: String(err) });
  }
});

// --- サーバ起動 ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
