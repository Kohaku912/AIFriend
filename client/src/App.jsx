import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
const defaultPersonalities = [
  { id: 'p1', name: '言葉（ことは）', tone: '言葉に敏感で感受性豊か。文学や詩のようにロマンチックで、ちょっと感傷的。人の気持ちを読むのが得意だけど、たまに自分の世界に入り込みがち。', extra: 'よく古風な言い回しを使ったり、漢字の豆知識を語ったりする', color: '#8E44AD', bgColor: '#F4F1FB', lightColor: '#E8DAEF', genre: '国語', subfields: ['漢字', '文法', '読解', '語彙'] },
  { id: 'p2', name: '数十（かずと）', tone: '几帳面で合理的、整理整頓が大好き。計算やパズルに強く、物事をきっちり白黒つけたがる', extra: '「え、それだと答え合わないよ」とすぐに突っ込みを入れる。融通が利かないこともあるけど、信頼できるタイプ', color: '#2E86AB', bgColor: '#F0F6FA', lightColor: '#D4EFFA', genre: '数学', subfields: ['算数基礎', '図形', '文章題', '式と方程式'] },
  { id: 'p3', name: '社一（しゃいち）', tone: '博識でおしゃべり。歴史の逸話や地理の豆知識を次から次へと話す情報マシン。ちょっとおじさんっぽい雰囲気もある。', extra: '「昔はなぁ…」が口癖。地図を持ち歩いていたり、古い出来事を今のことのように語る。', color: '#B8860B', bgColor: '#FDFBF3', lightColor: '#F5E8A3', genre: '社会', subfields: ['日本史', '世界史', '地理', '公民'] },
  { id: 'p4', name: '理花（りか）', tone: '好奇心旺盛で実験好き。ちょっとドジで爆発騒ぎを起こすこともある。新しいものを発見すると目をキラキラさせる。', extra: 'いつも試験管や虫眼鏡を持っていて、話しながら観察を始める。子どもっぽいワクワク感を忘れない。', color: '#E67E22', bgColor: '#FDF2E9', lightColor: '#FADBD8', genre: '理科', subfields: ['生物', '化学', '物理', '地学'] },
  { id: 'p5', name: '英美（えいみ）', tone: '明るくフレンドリー。ノリが良く、カタカナ英語やスラングを混ぜて喋る。みんなを盛り上げるムードメーカー。', extra: "「OK!」「Let's go!」などとよく言う。外来語を多用しすぎる。", color: '#E91E63', bgColor: '#FDF2F8', lightColor: '#FCE4EC', genre: '英語', subfields: ['語彙', '文法', 'リスニング', '英会話'] },
];

const fontSizeOptions = [{ id: 'xs', name: '極小', multiplier: 0.8 }, { id: 'sm', name: '小', multiplier: 0.9 }, { id: 'md', name: '標準', multiplier: 1.0 }, { id: 'lg', name: '大', multiplier: 1.1 }, { id: 'xl', name: '特大', multiplier: 1.3 }];

const rubyDictionary = { "言葉": "ことは", "数十": "かずと", "社一": "しゃいち", "理花": "りか", "英美": "えいみ" };
const DAILY_LIMIT = 40;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const applyRubyDictionary = (text) => {
  let result = text;
  for (const [kanji, yomi] of Object.entries(rubyDictionary)) {
    const regex = new RegExp(kanji, "g");
    result = result.replace(regex, `<ruby>${kanji}<rt>${yomi}</rt></ruby>`);
  }
  return result;
};

const LoadingDots = ({ color, fontSize }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: `${4 * fontSize}px`, height: `${4 * fontSize}px`, backgroundColor: color || '#666', borderRadius: '50%', animation: `bounce 1.4s infinite ease-in-out`, animationDelay: `${i * 0.16}s`, animationFillMode: 'both' }} />
      ))}
      <style jsx>{`@keyframes bounce { 0%,80%,100% { transform: scale(0.8); opacity:0.5 } 40% { transform: scale(1.2); opacity:1 } }`}</style>
    </div>
  );
};

// --- Helpers for quiz parsing and storage ---
function parseQuizFromText(text) {
  const start = text.indexOf('<<QUIZ>>');
  const end = text.indexOf('<<ENDQUIZ>>');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonText = text.substring(start + '<<QUIZ>>'.length, end).trim();
    try {
      const obj = JSON.parse(jsonText);
      const remaining = (text.substring(0, start) + text.substring(end + '<<ENDQUIZ>>'.length)).trim();
      return { quiz: obj, cleanText: remaining };
    } catch (e) {
      console.warn('Quiz JSON parse failed', e);
      return null;
    }
  }
  return null;
}

function saveQuizAttempt(attempt) {
  const raw = localStorage.getItem('quizAttempts');
  const arr = raw ? JSON.parse(raw) : [];
  const exists = arr.some(a => a.quizId === attempt.quizId && a.personaId === attempt.personaId);
  if (exists) return;
  arr.push(attempt);
  localStorage.setItem('quizAttempts', JSON.stringify(arr));
}

function loadQuizAttempts() {
  try {
    return JSON.parse(localStorage.getItem('quizAttempts') || '[]');
  } catch (e) { return []; }
}

function computeStats(attempts) {
  const byGenre = {};
  for (const a of attempts) {
    const g = a.genre || '未分類';
    byGenre[g] = byGenre[g] || { total: 0, correct: 0 };
    byGenre[g].total += 1;
    if (a.correct) byGenre[g].correct += 1;
  }
  const genres = Object.keys(byGenre).map(g => ({ genre: g, total: byGenre[g].total, correct: byGenre[g].correct, accuracy: byGenre[g].total ? Math.round(byGenre[g].correct / byGenre[g].total * 100) : 0 }));
  genres.sort((a, b) => a.accuracy - b.accuracy);
  return { byGenre: genres, weakest: genres[0] || null, strongest: genres[genres.length - 1] || null };
}

function computeSubfieldStats(attempts, genre) {
  const bySub = {};
  for (const a of attempts) {
    if ((a.genre || '未分類') !== genre) continue;
    const s = a.subfield || '未分類';
    bySub[s] = bySub[s] || { total: 0, correct: 0 };
    bySub[s].total += 1;
    if (a.correct) bySub[s].correct += 1;
  }
  const arr = Object.keys(bySub).map(s => ({ subfield: s, total: bySub[s].total, correct: bySub[s].correct, accuracy: bySub[s].total ? Math.round(bySub[s].correct / bySub[s].total * 100) : 0 }));
  arr.sort((a, b) => b.total - a.total || b.accuracy - a.accuracy);
  return arr;
}

function BarChart({ items, width = 280, height = 24, max = 100 }) {
  return (
    <div style={{ width }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 80, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
          <div style={{ flex: 1, background: '#f1f3f5', borderRadius: 8, height }}>
            <div style={{ width: `${Math.min(100, Math.max(0, it.value))}%`, height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, boxSizing: 'border-box', background: '#6c5ce7', color: 'white', fontSize: 12 }}>{it.value}%</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [messagesByPersona, setMessagesByPersona] = useState(() => JSON.parse(localStorage.getItem('messagesByPersona') || '{}'));
  const [text, setText] = useState('');
  const [personality, setPersonality] = useState(defaultPersonalities[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRuby, setShowRuby] = useState(() => JSON.parse(localStorage.getItem('showRuby') || 'false'));
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'md');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [rateInfo, setRateInfo] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('rateInfo') || 'null'); if (saved && saved.date === todayKey()) return saved; } catch (e) { } return { count: 0, limit: DAILY_LIMIT, resetAt: null, date: todayKey() }; });
  const [limitReached, setLimitReached] = useState(false);
  const lastMessageRef = useRef(null);
  const [quizModal, setQuizModal] = useState(null);
  const [attempts, setAttempts] = useState(() => loadQuizAttempts());
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [detailGenre, setDetailGenre] = useState(null);

  // 新規: 設定モーダルの表示
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('volume') || 80)); // 0-100
  const [kanjiLevel, setKanjiLevel] = useState(() => localStorage.getItem('kanjiLevel') || '中学生以上');

  // --- 追加: TTS 用の hook / helpers ---
  const ttsVoicesRef = useRef([]);
  useEffect(() => {
    function loadVoices() {
      const v = speechSynthesis.getVoices();
      if (v && v.length) {
        ttsVoicesRef.current = v;
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => localStorage.setItem('messagesByPersona', JSON.stringify(messagesByPersona)), [messagesByPersona]);
  useEffect(() => localStorage.setItem('showRuby', JSON.stringify(showRuby)), [showRuby]);
  useEffect(() => localStorage.setItem('fontSize', fontSize), [fontSize]);
  useEffect(() => { localStorage.setItem('rateInfo', JSON.stringify(rateInfo)); setLimitReached(rateInfo.count >= (rateInfo.limit || DAILY_LIMIT)); }, [rateInfo]);
  useEffect(() => { if (lastMessageRef.current) lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messagesByPersona, personality?.id, isLoading]);
  useEffect(() => localStorage.setItem('volume', String(volume)), [volume]);
  useEffect(() => localStorage.setItem('kanjiLevel', kanjiLevel), [kanjiLevel]);

  const currentFontSize = fontSizeOptions.find(f => f.id === fontSize) || fontSizeOptions[2];

  function playTTS(text, lang = 'en-US') {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    const voices = ttsVoicesRef.current || speechSynthesis.getVoices() || [];
    let chosen = voices.find(v => /en(-|_)?/i.test(v.lang)) || voices.find(v => /english/i.test(v.name)) || voices[0];
    if (chosen) utter.voice = chosen;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    // volume: convert 0-100 to 0-1
    utter.volume = Math.max(0, Math.min(1, volume / 100));
    window.speechSynthesis.speak(utter);
  }

  function isListeningQuiz(quiz) {
    if (!quiz) return false;
    const sub = (quiz.subfield || '').toString();
    const qtxt = (quiz.question || '').toString();
    const listeningKeywords = /リスニング|聞き取り|listening|聞き取り問題|聞く/;
    return (String(quiz.genre || '') === '英語') && (listeningKeywords.test(sub) || listeningKeywords.test(qtxt));
  }

  async function send() {
    if (!text.trim() || isLoading) return;
    if (limitReached) {
      setMessagesByPersona(prev => { const copy = { ...prev }; copy[personality.id] = [...(copy[personality.id] || []), { role: 'assistant', text: '本日の送信上限に達しています。明日以降お試しください。' }]; return copy; });
      return;
    }
    const userMsg = text.trim();
    setText('');
    setIsLoading(true);
    setMessagesByPersona(prev => { const copy = { ...prev }; copy[personality.id] = [...(copy[personality.id] || []), { role: 'user', text: userMsg }]; return copy; });

    const displayedMessages = messagesByPersona[personality.id] || [];
    const prevForContext = displayedMessages.length ? displayedMessages[displayedMessages.length - 1] : null;

    try {
      const resp = await fetch('http://localhost:4000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, personality: personality, previous: prevForContext, kanjiLevel }) });

      if (resp.status === 429) {
        const data = await resp.json().catch(() => ({}));
        const resetAt = data.reset ? new Date(data.reset) : null;
        setRateInfo(prev => ({ ...prev, count: prev.count >= prev.limit ? prev.limit : prev.count, limit: prev.limit, resetAt, date: todayKey() }));
        setLimitReached(true);
        setMessagesByPersona(prev => { const copy = { ...prev }; copy[personality.id] = [...(copy[personality.id] || []), { role: 'assistant', text: data.message || '本日の送信上限に達しました。' }]; return copy; });
        return;
      }

      const data = await resp.json();
      let reply = data.reply || 'ごめん、応答できなかったよ。';

      let parsed = parseQuizFromText(reply);
      let quizObj = null;
      let replyClean = reply;
      if (parsed && parsed.quiz) {
        parsed.quiz.id = uuidv4();
        quizObj = parsed.quiz;
        replyClean = parsed.cleanText;
      }

      setRateInfo(prev => { const newCount = (prev.date === todayKey() ? prev.count : 0) + 1; const updated = { count: newCount, limit: prev.limit || DAILY_LIMIT, resetAt: prev.resetAt, date: todayKey() }; return updated; });

      setMessagesByPersona(prev => { const copy = { ...prev }; copy[personality.id] = [...(copy[personality.id] || []), { role: 'assistant', text: replyClean, quiz: quizObj }]; return copy; });

    } catch (err) {
      console.error(err);
      setMessagesByPersona(prev => { const copy = { ...prev }; copy[personality.id] = [...(copy[personality.id] || []), { role: 'assistant', text: '通信エラーが発生しました。' }]; return copy; });
    } finally {
      setIsLoading(false);
    }
  }

  function hasAttemptForQuiz(quizId) {
    try {
      const arr = JSON.parse(localStorage.getItem('quizAttempts') || '[]');
      return arr.some(a => a.quizId === quizId);
    } catch (e) {
      return false;
    }
  }
  function handleSubmitQuiz(quiz, userAnswer) {
    if (!quiz || !quiz.id) return;
    if (hasAttemptForQuiz(quiz.id)) {
      setMessagesByPersona(prev => {
        const copy = { ...prev };
        copy[personality.id] = [...(copy[personality.id] || []), { role: 'assistant', text: 'この問題は既に回答済みです。' }];
        return copy;
      });
      return;
    }

    const correct = (() => {
      if (quiz.type === 'mcq') {
        return Number(userAnswer) === Number(quiz.answerIndex);
      } else if (quiz.type === 'text') {
        return String(userAnswer || '').trim().toLowerCase() === String(quiz.answer || '').trim().toLowerCase();
      }
      return false;
    })();

    const attempt = {
      quizId: quiz.id || `${personality.id}_${Date.now()}`,
      personaId: personality.id,
      genre: quiz.genre || personality.genre || '未分類',
      subfield: quiz.subfield || null,
      question: quiz.question,
      userAnswer,
      correct,
      timestamp: Date.now()
    };

    saveQuizAttempt(attempt);
    const newAttempts = loadQuizAttempts();
    setAttempts(newAttempts);

    setMessagesByPersona(prev => {
      const copy = { ...prev };
      copy[personality.id] = (copy[personality.id] || []).map(m => {
        if (m.quiz && m.quiz.id === quiz.id) {
          if (m.quizResult) return m;
          return { ...m, quizResult: attempt };
        }
        return m;
      });
      return copy;
    });
  }

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const RubyText = ({ text }) => {
    const [rubyText, setRubyText] = useState(text);
    useEffect(() => { let mounted = true; (async () => { if (!showRuby) return setRubyText(text); const applied = applyRubyDictionary(text); if (applied !== text) return mounted && setRubyText(applied); try { const resp = await fetch('http://localhost:4000/api/ruby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); const data = await resp.json(); mounted && setRubyText(data.ruby || text); } catch (e) { mounted && setRubyText(text); } })(); return () => { mounted = false; } }, [text, showRuby, kanjiLevel]);
    return <span dangerouslySetInnerHTML={{ __html: rubyText }} />;
  };

  const displayedMessages = messagesByPersona[personality.id] || [];
  const messagesForDisplay = [...displayedMessages];
  if (isLoading) messagesForDisplay.push({ role: 'assistant', text: '', isLoading: true });

  const stats = computeStats(attempts);
  const subfieldDataForDetail = detailGenre ? computeSubfieldStats(attempts, detailGenre) : [];
  const overallForDetail = detailGenre ? stats.byGenre.find(g => g.genre === detailGenre) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 0, overflow: 'hidden' }}>
      <style>{`@keyframes bounce { 0%,80%,100% { transform: scale(0.8); opacity:0.5 } 40% { transform: scale(1.2); opacity:1 } }`}</style>
      <div style={{ background: 'white', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: personality.color, color: 'white', padding: '15px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {/* 学習統計アイコン（左上） */}
          <div style={{ position: 'absolute', left: 20 }}>
            <button onClick={() => setShowStatsPanel(s => !s)} aria-label="学習統計" title="学習統計" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, color: 'white', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18 }}>📊</span>
            </button>
          </div>

          <h1 style={{ margin: 0, fontSize: `${20 * currentFontSize.multiplier}px`, fontWeight: 600 }}>✨ まなとも ✨</h1>

          {/* 設定アイコン（右上） */}
          <div style={{ position: 'absolute', right: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowSettings(true)} aria-label="設定" title="設定" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 16, color: 'white', padding: '8px 12px', cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>

        {/* キャラ選択 */}
        <div style={{ padding: '12px 15px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {defaultPersonalities.map(p => (
              <button key={p.id} onClick={() => setPersonality(p)} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', border: personality.id === p.id ? `2px solid ${p.color}` : '1px solid #e9ecef', borderRadius: 20, background: personality.id === p.id ? p.bgColor : 'white', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                <img src={`/icons/${p.id}.png`} alt={p.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ marginLeft: 8, fontWeight: 600 }}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* キャラクター情報 */}
        <div style={{ padding: '10px 20px', background: personality.lightColor, borderBottom: '1px solid #e9ecef', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: personality.color }}>{personality.name}と会話中</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{personality.tone}</div>
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>{personality.genre}</div>
          </div>
        </div>

        {/* チャット領域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#fafafa' }}>
          {limitReached && (<div style={{ background: '#fff4f4', border: '1px solid #ffd6d6', padding: '8px 12px', marginBottom: 10, borderRadius: 12, color: '#b00020', textAlign: 'center' }}>⚠️ 本日の送信上限（{rateInfo.limit}回）に達しました。{rateInfo.resetAt && <span> リセット: {new Date(rateInfo.resetAt).toLocaleString()}</span>}</div>)}

          {messagesForDisplay.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '30px 20px' }}>
              <div style={{ fontSize: 40 }}>💭</div>
              <div>{personality.name}と会話を始めてみましょう！</div>
              <div style={{ marginTop: 10, fontSize: 12 }}>{personality.extra}</div>
            </div>
          ) : (
            messagesForDisplay.map((m, i) => (
              <div key={i} ref={i === messagesForDisplay.length - 1 ? lastMessageRef : null} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={{ maxWidth: '75%', display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  {m.role === 'user' ? (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#007bff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>You</div>
                  ) : (
                    <img src={`/icons/${personality.id}.png`} alt={personality.name} style={{ width: 24, height: 24, borderRadius: '50%' }} onClick={() => setSelectedPersona(personality)} />
                  )}

                  <div style={{ padding: '10px 14px', borderRadius: 16, background: m.role === 'user' ? '#007bff' : 'white', color: m.role === 'user' ? 'white' : '#333', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {m.isLoading ? <LoadingDots color={personality.color} fontSize={currentFontSize.multiplier} /> : <RubyText text={m.text} />}
                    {m.quiz && (
                      <div style={{ marginTop: 10 }}>
                        {m.quiz.subfield && <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>分野: {m.quiz.subfield}</div>}
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {m.quiz.subfield === '漢字' ? m.quiz.question : <RubyText text={m.quiz.question} />}
                        </div>

                        {/* リスニング問題ならスピーカーボタンを表示 */}
                        {isListeningQuiz(m.quiz) && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => {
                                const toPlay = String(m.quiz.audioText || m.quiz.answer || '');
                                if (!toPlay) {
                                  playTTS(String(m.quiz.question || ''), 'en-US');
                                } else {
                                  playTTS(toPlay, 'en-US');
                                }
                                const input = document.getElementById(`text-answer-${i}`);
                                if (input) input.focus();
                              }}
                              style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid #eee', cursor: 'pointer' }}
                            >
                              🔊 再生
                            </button>
                            <div style={{ fontSize: 12, color: '#666' }}>押して英語を聴き、聞こえた単語を入力してください。</div>
                          </div>
                        )}

                        {m.quiz.type === 'mcq' ? (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {m.quiz.choices.map((c, idx) => {
                              const already = m.quizResult || hasAttemptForQuiz(m.quiz.id);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSubmitQuiz(m.quiz, idx)}
                                  disabled={already}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 12,
                                    border: '1px solid #eee',
                                    cursor: already ? 'not-allowed' : 'pointer',
                                    opacity: already ? 0.6 : 1
                                  }}
                                >
                                  {c}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <input
                              type='text'
                              placeholder={isListeningQuiz(m.quiz) ? '聞こえた単語を入力' : '解答を入力'}
                              id={`text-answer-${i}`}
                              disabled={m.quizResult || hasAttemptForQuiz(m.quiz.id)}
                            />
                            <button
                              onClick={() => {
                                const val = document.getElementById(`text-answer-${i}`).value;
                                handleSubmitQuiz(m.quiz, val);
                              }}
                              disabled={m.quizResult || hasAttemptForQuiz(m.quiz.id)}
                            >
                              解答
                            </button>
                          </div>
                        )}

                        {m.quizResult && (
                          <div style={{ marginTop: 8, color: m.quizResult.correct ? 'green' : 'crimson' }}>
                            {m.quizResult.correct ? '正解！' : `不正解。正答: ${m.quiz.answer ?? (m.quiz.choices ? m.quiz.choices[m.quiz.answerIndex] : '')}`}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 入力エリア */}
        <div style={{ padding: '15px', background: 'white', borderTop: '1px solid #e9ecef' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyPress={handleKeyPress} placeholder={`${personality.name}にメッセージを送る...`} disabled={isLoading} style={{ flex: 1, padding: '10px 14px', border: '2px solid #e9ecef', borderRadius: 16, resize: 'none', fontSize: 13, minHeight: 18, maxHeight: 80 }} />
            <button onClick={send} disabled={!text.trim() || isLoading} style={{ padding: '10px 16px', background: (text.trim() && !isLoading) ? personality.color : '#ccc', color: 'white', border: 'none', borderRadius: 16 }}>{isLoading ? '送信中...' : '送信 ✈️'}</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#888', textAlign: 'center' }}>Enterで送信 • ルビを自動生成</div>
        </div>

        {/* 学習統計パネル（トグル表示） */}
        {showStatsPanel && (
          <div style={{ position: 'fixed', left: 20, top: 80, width: 360, maxHeight: '70vh', overflowY: 'auto', background: 'white', borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', padding: 16, zIndex: 2000 }}>
            <h3 style={{ marginTop: 0 }}>学習統計</h3>
            <div style={{ fontSize: 12, color: '#666' }}>累計問題数: {attempts.length}</div>
            <div style={{ marginTop: 8 }}>
              {stats.byGenre.length === 0 ? <div style={{ color: '#888' }}>問題を解くとここにジャンル別の成績が表示されます。</div> : stats.byGenre.map(g => (
                <div key={g.genre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>{g.genre}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{g.correct}/{g.total}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13 }}>{g.accuracy}%</div>
                    <button onClick={() => setDetailGenre(g.genre)} style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}>詳細</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12 }}>得意: {stats.strongest ? `${stats.strongest.genre} (${stats.strongest.accuracy}%)` : '—'}</div>
              <div style={{ fontSize: 12 }}>苦手: {stats.weakest ? `${stats.weakest.genre} (${stats.weakest.accuracy}%)` : '—'}</div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => { localStorage.removeItem('quizAttempts'); setAttempts([]); }} style={{ padding: '8px 10px', borderRadius: 8 }}>成績リセット</button>
              <button onClick={() => { const w = window.open(); w.document.write('<pre>' + JSON.stringify(attempts, null, 2) + '</pre>'); }} style={{ padding: '8px 10px', borderRadius: 8 }}>生データ表示</button>
            </div>
          </div>
        )}

        {/* 詳細モーダル: ジャンルごとのサブフィールド表示 */}
        {detailGenre && (
          <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setDetailGenre(null)}>
            <div style={{ width: 520, maxHeight: '80vh', overflowY: 'auto', background: 'white', borderRadius: 12, padding: 18 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{detailGenre} の詳細</h3>
                <button onClick={() => setDetailGenre(null)} style={{ padding: '6px 10px', borderRadius: 8 }}>閉じる</button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, color: '#666' }}>累計: {overallForDetail ? `${overallForDetail.correct}/${overallForDetail.total} (${overallForDetail.accuracy}%)` : 'データ無し'}</div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>サブフィールド別の正答率</div>
                  {subfieldDataForDetail.length === 0 ? <div style={{ color: '#888' }}>まだ十分なデータがありません。</div> : (
                    <BarChart items={subfieldDataForDetail.map(s => ({ label: `${s.subfield} (${s.total})`, value: s.accuracy }))} width={480} />
                  )}
                </div>

                {subfieldDataForDetail.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                          <th style={{ padding: '6px 4px' }}>サブフィールド</th>
                          <th style={{ padding: '6px 4px' }}>正答/累計</th>
                          <th style={{ padding: '6px 4px' }}>正答率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subfieldDataForDetail.map(s => (
                          <tr key={s.subfield}>
                            <td style={{ padding: '8px 4px' }}>{s.subfield}</td>
                            <td style={{ padding: '8px 4px' }}>{s.correct}/{s.total}</td>
                            <td style={{ padding: '8px 4px' }}>{s.accuracy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* 設定モーダル */}
        {showSettings && (
          <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }} onClick={() => setShowSettings(false)}>
            <div style={{ width: 420, background: 'white', borderRadius: 12, padding: 18 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>設定</h3>
                <button onClick={() => setShowSettings(false)} style={{ padding: '6px 10px', borderRadius: 8 }}>閉じる</button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>フォントサイズ</div>
                  <select value={fontSize} onChange={e => setFontSize(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8 }}>
                    {fontSizeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>ルビ表示</div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={showRuby} onChange={e => setShowRuby(e.target.checked)} /> ルビを有効にする
                  </label>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>音量（TTS）: {volume}</div>
                  <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>漢字レベル</div>
                  <select value={kanjiLevel} onChange={e => setKanjiLevel(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8 }}>
                    <option>中学生以上</option>
                    <option>小学6年</option>
                    <option>小学5年</option>
                    <option>小学4年</option>
                    <option>小学3年</option>
                    <option>小学2年</option>
                    <option>小学1年</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setVolume(80); setKanjiLevel('中学生以上'); setFontSize('md'); setShowRuby(false); }} style={{ padding: '8px 10px', borderRadius: 8 }}>デフォルトに戻す</button>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>※ 漢字レベルはサーバー送信やルビ生成に使用されます。</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
