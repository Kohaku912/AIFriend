import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { buildPrompt, extractQuizJsonFromText, buildQuizPrompt } from '../lib/prompt.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY');
  // Note: ここではレスポンスで 500 を返す
}

const ai = new GoogleGenAI({ apiKey });

// 簡易レート制限ストア（メモリ保持、インスタンス共有される可能性あり）
const ipRequestCounts = {};
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
  if (xff && typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing GEMINI_API_KEY' });
  }

  const { message, personality = {}, previous, kanjiLevel } = req.body;
  if (!message) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  const ip = getClientIp(req);
  const today = getTodayString();
  if (!ipRequestCounts[ip] || ipRequestCounts[ip].date !== today) {
    ipRequestCounts[ip] = { date: today, count: 0 };
  }

  if (ipRequestCounts[ip].count >= DAILY_LIMIT) {
    res.setHeader('X-RateLimit-Limit', DAILY_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    return res.status(429).json({
      error: `1日あたりのリクエスト上限に達しました（上限: ${DAILY_LIMIT} 回）。明日になったら再度お試しください。`
    });
  }

  ipRequestCounts[ip].count += 1;
  const remaining = Math.max(0, DAILY_LIMIT - ipRequestCounts[ip].count);
  res.setHeader('X-RateLimit-Limit', DAILY_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  const resetAt = new Date();
  resetAt.setHours(24, 0, 0, 0);
  res.setHeader('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));

  const prompt = buildPrompt(personality, message, previous, kanjiLevel);

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

  let extracted = extractQuizJsonFromText(replyText);
  if (extracted && extracted.quiz) {
    const q = extracted.quiz;
    const missing = [];
    if (!q.genre) missing.push('genre');
    if (!q.subfield) missing.push('subfield');
    if (!q.type) missing.push('type');
    if (!q.question) missing.push('question');
    if (q.type === 'mcq' && (!Array.isArray(q.choices) || q.choices.length < 2)) missing.push('choices');
    if (q.type === 'mcq' && (typeof q.answerIndex === 'undefined')) missing.push('answerIndex');
    if (typeof q.answer === 'undefined' || q.answer === null) missing.push('answer');

    if (missing.length > 0) {
      console.warn('Quiz JSON missing fields:', missing);
      try {
        const regen = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: buildQuizPrompt(personality, message),
        });
        const regenText = (regen?.text) || (Array.isArray(regen?.outputs) && regen.outputs[0]?.content) || '';
        if (regenText) {
          replyText = regenText;
          const reex = extractQuizJsonFromText(replyText);
          if (!reex || !reex.quiz) {
            console.warn('Regeneration did not produce valid quiz JSON.');
          }
        }
      } catch (err) {
        console.error('Regeneration error:', err);
      }
    }

    // メモリ上の会話履歴保存（簡易的）
    // インスタンス永続性がサーバーレス関数では保証されないのであくまで参考
    // フロント側で previous を管理することを推奨
    res.status(200).json({ reply: replyText });
    return;
  } else {
    // クイズフォーマットが含まれていない場合も普通に返信
    res.status(200).json({ reply: replyText });
    return;
  }
}
