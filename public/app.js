const QUESTIONS = [
  {
    ar: 'مَنْ رَبُّكَ؟',
    id: 'Siapa Tuhanmu?',
    speak: 'Siapa Tuhanmu? Jawablah dengan iman.',
    accept: ['rabbiyallah', 'rabbiy allah', 'tuhan saya allah', 'allah tuhan saya', 'allah'],
    ideal: 'Rabbiyallah',
  },
  {
    ar: 'مَا دِينُكَ؟',
    id: 'Apa agamamu?',
    speak: 'Apa agamamu?',
    accept: ['islam', 'agama saya islam', 'din islam'],
    ideal: 'Islam',
  },
  {
    ar: 'مَنْ نَبِيُّكَ؟',
    id: 'Siapa nabimu?',
    speak: 'Siapa nabimu?',
    accept: ['muhammad', 'nabi muhammad', 'muhammad shallallahu alaihi wa sallam', 'rasulullah'],
    ideal: 'Muhammad shallallahu alaihi wa sallam',
  },
];

const DARK_LINES = [
  'Anda sendirian. Cahaya dunia telah lenyap.',
  'Suara langkah dan bisikan tak dikenal menggema di sempit tanah.',
  'Inilah saat yang diperingatkan dalam hadits: kegelapan, sempit, atau lapang sesuai amal.',
];

const state = {
  scene: 'intro',
  qIndex: 0,
  score: [],
  deepgram: false,
  ttsProvider: 'edge',
  ttsModel: '',
  tension: 35,
  bgmReady: false,
  bgmLevel: 0.28,
  bgmDuck: 0.1,
};

const bgmEl = () => $('#backsound-audio');

async function initBacksound() {
  try {
    const r = await fetch('/api/backsound-status');
    const d = await r.json();
    if (!d.ok || !d.url) return;
    const el = bgmEl();
    el.src = d.url;
    el.volume = state.bgmLevel;
    el.loop = true;
    state.bgmReady = true;
  } catch {
    /* no file yet */
  }
}

function startBacksound() {
  if (!state.bgmReady) return;
  bgmEl().play().catch(() => {});
}

function duckBacksound() {
  if (state.bgmReady) bgmEl().volume = state.bgmDuck;
}

function unduckBacksound() {
  if (state.bgmReady) bgmEl().volume = state.bgmLevel;
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAnswer(text, q) {
  const n = norm(text);
  if (!n) return false;
  return q.accept.some((a) => n.includes(norm(a)) || norm(a).includes(n));
}

function showScene(name) {
  state.scene = name;
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.scene === name));
  const labels = {
    intro: 'Persiapan',
    learn: 'Jawaban',
    burial: 'Penguburan',
    darkness: 'Kegelapan',
    question: 'Pertanyaan',
    barzakh: 'Barzakh',
    outro: 'Muhasabah',
  };
  $('#phase-label').textContent = labels[name] || name;
}

async function checkHealth() {
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    state.deepgram = !!d.deepgram;
    state.ttsProvider = d.tts === 'deepgram' ? 'deepgram' : 'edge';
    state.ttsModel = d.ttsVoice || '';
    const pill = $('#dg-status');
    const ttsLabel = d.ttsVoice ? `Suara: ${d.ttsVoice.replace('id-ID-', '')}` : 'Suara: Indonesia';
    pill.textContent = d.tts === 'edge' ? ttsLabel : (state.deepgram ? 'Voice: Deepgram' : 'Voice: browser');
    pill.classList.toggle('off', !state.deepgram && d.tts !== 'edge');
    $('#foot-note').textContent = state.deepgram
      ? 'TTS bahasa Indonesia (Edge); STT jawaban via Deepgram.'
      : 'TTS Indonesia aktif; STT butuh DEEPGRAM_API_KEY di .env.';
  } catch {
    $('#dg-status').textContent = 'Voice: server offline';
    $('#dg-status').classList.add('off');
  }
}

async function speak(text) {
  const audio = $('#voice-audio');
  duckBacksound();
  const onEnd = () => {
    unduckBacksound();
    audio.removeEventListener('ended', onEnd);
  };
  audio.addEventListener('ended', onEnd);
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider: state.ttsProvider,
        ...(state.ttsModel ? { model: state.ttsModel } : {}),
      }),
    });
    if (!r.ok) throw new Error('TTS gagal');
    const blob = await r.blob();
    audio.src = URL.createObjectURL(blob);
    await audio.play();
    return;
  } catch {
    /* fallback */
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      return (
        voices.find((v) => v.lang === 'id-ID') ||
        voices.find((v) => v.lang && v.lang.startsWith('id')) ||
        voices[0]
      );
    };
    u.voice = pick();
    u.lang = 'id-ID';
    u.rate = 0.92;
    u.onend = () => unduckBacksound();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return;
  }
  unduckBacksound();
}

let mediaRecorder = null;
let chunks = [];

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mediaRecorder.start();
  $('#btn-mic').classList.add('recording');
  $('#mic-label').textContent = 'Merekam… lepas untuk kirim';
}

async function stopMic() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      $('#btn-mic').classList.remove('recording');
      $('#mic-label').textContent = 'Tahan untuk jawab';
      const blob = new Blob(chunks, { type: 'audio/webm' });
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      if (!state.deepgram) {
        $('#transcript').textContent = '(Butuh Deepgram untuk transkripsi suara)';
        resolve('');
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'answer.webm');
      fd.append('language', 'id');
      try {
        const r = await fetch('/api/stt', { method: 'POST', body: fd });
        const d = await r.json();
        const t = d.transcript || '';
        $('#transcript').textContent = t ? `Anda: ${t}` : '(Tidak terdengar jelas)';
        $('#answer-input').value = t;
        resolve(t);
      } catch (e) {
        $('#transcript').textContent = 'Gagal transkripsi';
        resolve('');
      }
    };
    mediaRecorder.stop();
  });
}

function loadQuestion() {
  const q = QUESTIONS[state.qIndex];
  $('#q-ar').textContent = q.ar;
  $('#q-id').textContent = q.id;
  $('#answer-input').value = '';
  $('#transcript').textContent = '';
  $('#feedback').textContent = '';
  $('#feedback').className = 'feedback';
  setTimeout(() => speak(q.speak), 400);
}

async function submitAnswer() {
  const q = QUESTIONS[state.qIndex];
  const text = $('#answer-input').value.trim();
  const ok = matchAnswer(text, q);
  const fb = $('#feedback');
  if (ok) {
    state.score.push({ q: q.id, ok: true });
    state.tension = Math.max(10, state.tension - 15);
    fb.textContent = 'Jawaban selaras dengan yang diajarkan ulama. Cahaya sedikit terasa.';
    fb.className = 'feedback ok';
    await speak('Jawabanmu benar. Istighfar dan teguhkan iman.');
    state.qIndex += 1;
    if (state.qIndex < QUESTIONS.length) {
      setTimeout(loadQuestion, 1200);
    } else {
      setTimeout(goBarzakh, 1500);
    }
  } else {
    state.tension = Math.min(95, state.tension + 20);
    fb.textContent = `Belum tepat. Jawaban yang diamalkan: ${q.ideal}. Coba lagi.`;
    fb.className = 'feedback bad';
    await speak('Perbaiki jawabanmu. Ingat ilmu yang telah kamu pelajari.');
  }
  $('#tension-bar').style.width = `${state.tension}%`;
}

function goBarzakh() {
  const good = state.score.filter((s) => s.ok).length;
  const harsh = good < 2;
  showScene('barzakh');
  const el = $('#barzakh-visual');
  el.classList.toggle('harsh', harsh);
  $('#barzakh-text').textContent = harsh
    ? 'Dalam simulasi ini, ketidaksiapan jawaban mempertegas pentingnya belajar dan mengamalkan sebelum waktu tiba. Mohon ampun dan perbanyak amal.'
    : 'Dalam simulasi ini, jawaban yang benar membawa ketenangan di barzakh. Teruslah menjaga shalat, ilmu, dan akhlak.';
  speak(harsh ? 'Perbanyak istighfar dan amal saleh.' : 'Semoga Allah memberi ketenangan dan cahaya.');
}

function finishOutro() {
  showScene('outro');
  const ul = $('#score-list');
  ul.innerHTML = '';
  QUESTIONS.forEach((q, i) => {
    const li = document.createElement('li');
    const hit = state.score[i]?.ok;
    li.textContent = `${q.id}: ${hit ? 'Baik' : 'Perlu ulang belajar'}`;
    ul.appendChild(li);
  });
}

function runBurial() {
  showScene('burial');
  const cap = $('#burial-caption');
  const lines = [
    'Tubuh diturunkan ke liang kubur…',
    'Tanah menutup…',
    'Shalat jenazah telah dilaksanakan oleh kaum muslimin.',
  ];
  let i = 0;
  cap.textContent = lines[0];
  const iv = setInterval(() => {
    i += 1;
    if (i < lines.length) cap.textContent = lines[i];
    else {
      clearInterval(iv);
      $('#btn-enter-grave').classList.remove('hidden');
    }
  }, 1800);
}

function runDarkness() {
  showScene('darkness');
  let i = 0;
  $('#dark-text').textContent = DARK_LINES[0];
  const iv = setInterval(() => {
    i += 1;
    if (i < DARK_LINES.length) {
      $('#dark-text').textContent = DARK_LINES[i];
      state.tension = Math.min(90, state.tension + 12);
      $('#tension-bar').style.width = `${state.tension}%`;
    } else clearInterval(iv);
  }, 2200);
}

function bindActions() {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'start') {
      showScene('learn');
      startBacksound();
    }
    if (a === 'learn') showScene('learn');
    if (a === 'to-burial') {
      startBacksound();
      runBurial();
    }
    if (a === 'enter-grave') runDarkness();
    if (a === 'angels-come') {
      showScene('question');
      state.qIndex = 0;
      state.score = [];
      loadQuestion();
    }
    if (a === 'finish') finishOutro();
    if (a === 'restart') {
      state.qIndex = 0;
      state.score = [];
      state.tension = 35;
      $('#tension-bar').style.width = '35%';
      showScene('intro');
    }
  });

  $('#btn-submit-answer').addEventListener('click', () => submitAnswer());
  $('#answer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });
  $('#btn-hint').addEventListener('click', () => {
    const q = QUESTIONS[state.qIndex];
    $('#feedback').textContent = `Petunjuk: ${q.ideal}`;
    $('#feedback').className = 'feedback';
  });

  const mic = $('#btn-mic');
  let hold = false;
  mic.addEventListener('mousedown', async () => {
    hold = true;
    try {
      await startMic();
    } catch {
      $('#transcript').textContent = 'Izin mikrofon ditolak';
    }
  });
  mic.addEventListener('mouseup', async () => {
    if (!hold) return;
    hold = false;
    await stopMic();
  });
  mic.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mic.dispatchEvent(new Event('mousedown'));
  });
  mic.addEventListener('touchend', (e) => {
    e.preventDefault();
    mic.dispatchEvent(new Event('mouseup'));
  });
}

bindActions();
initBacksound().then(checkHealth);