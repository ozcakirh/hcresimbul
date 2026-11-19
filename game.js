(() => {
  const pictures = [
    ['🍋','#fff8d9'],['🍓','#fff0f1'],['🍉','#e8faed'],['🍇','#f3edff'],['🍊','#fff1df'],['🍍','#fff8db'],
    ['🥑','#eff8e7'],['🍒','#fff0f1'],['🥕','#fff2e7'],['🌽','#fff9dd'],['🍄','#fff0eb'],['🥦','#eaf8e9'],
    ['🐱','#f5f0ff'],['🐶','#fff1e8'],['🐸','#eaf9ee'],['🦊','#fff0e5'],['🐼','#f0f2f6'],['🐧','#eaf6ff']
  ];
  const $ = s => document.querySelector(s);
  const board = $('#board'), overlay = $('#overlay'), overlayIcon = $('#overlay-icon'),
    overlayTitle = $('#overlay-title'), overlayText = $('#overlay-text'), startButton = $('#start'),
    hint = $('#hint'), matchLabel = $('#matches'), moveLabel = $('#moves'), timerLabel = $('#timer'),
    scoreList = $('#score-list'), lastPlayed = $('#last-played'), lastPlayedSub = $('#last-played-sub'),
    soundButton = $('#sound'), soundIcon = $('#sound-icon'), soundText = $('#sound-text');
  let deck = [], first = null, locked = true, moves = 0, matches = 0, seconds = 0,
    clock = null, previewTimeout = null, missTimeout = null;

  /* ---------- Depolama (kapalıysa sessizce atla) ---------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  };
  let scores = store.get('resimbul-scores', []);
  let soundOn = store.get('resimbul-sound', true);

  /* ---------- Sesler (Web Audio, dosya gerekmez) ---------- */
  let ctx = null;
  function audio() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, type = 'sine', vol = 0.15) {
    const c = audio(); if (!c || !soundOn) return;
    const t = c.currentTime + start, osc = c.createOscillator(), gain = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination); osc.start(t); osc.stop(t + dur + 0.02);
  }
  const sounds = {
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.16)); },
    flip()  { tone(620, 0, 0.06, 'square', 0.05); },
    right() { tone(659, 0, 0.14, 'sine', 0.17); tone(880, 0.1, 0.28, 'sine', 0.17); },
    wrong() { tone(220, 0, 0.18, 'sawtooth', 0.09); tone(165, 0.14, 0.28, 'sawtooth', 0.09); },
    win()   { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.17)); }
  };
  function renderSound() {
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Sesi kapat' : 'Sesi aç');
    soundIcon.textContent = soundOn ? '🔊' : '🔇';
    soundText.textContent = soundOn ? 'Ses açık' : 'Ses kapalı';
  }
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn; store.set('resimbul-sound', soundOn); renderSound();
    if (soundOn) sounds.flip();
  });

  /* ---------- Skorlar ---------- */
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  function ago(ts) {
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 60) return 'az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
  const better = (a, b) => a.moves < b.moves || (a.moves === b.moves && a.seconds < b.seconds);
  function renderScores() {
    scoreList.replaceChildren();
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'score-empty'; li.textContent = 'Henüz skor yok. Bir oyunu bitir, burada görünsün.';
      scoreList.append(li);
      lastPlayed.textContent = 'Henüz oynamadın';
      lastPlayedSub.textContent = 'İlk oyununu bitirince burada görünecek.';
      return;
    }
    const best = scores.reduce((a, b) => (better(b, a) ? b : a));
    scores.forEach(s => {
      const li = document.createElement('li');
      li.className = 'score-item' + (s === best ? ' is-best' : '');
      li.innerHTML = `<span class="score-main">${s.moves} <small>hamle</small></span><span class="score-time">${fmt(s.seconds)}</span><span class="score-when">${ago(s.at)}</span>${s === best ? '<span class="score-badge">★ En iyi</span>' : '<span></span>'}`;
      scoreList.append(li);
    });
    const last = scores[0];
    lastPlayed.textContent = ago(last.at);
    lastPlayedSub.textContent = new Date(last.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }
  function saveScore() {
    scores = [{ moves, seconds, at: Date.now() }, ...scores].slice(0, 6);
    store.set('resimbul-scores', scores); renderScores();
  }
  $('#clear-scores').addEventListener('click', () => {
    if (!scores.length || !confirm('Son 6 skor silinsin mi?')) return;
    scores = []; store.set('resimbul-scores', scores); renderScores();
  });
  setInterval(renderScores, 30000);

  /* ---------- Oyun ---------- */
  function shuffledCards() {
    const cards = pictures.flatMap((p, pairId) => [0, 1].map(copy => ({ pairId, emoji: p[0], color: p[1], copy })));
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function renderBoard(preview = false) {
    board.replaceChildren();
    board.classList.toggle('is-preview', preview);
    deck.forEach((card, index) => {
      const button = document.createElement('button');
      button.className = 'tile' + (preview || card.open ? ' is-open' : '') + (card.matched ? ' is-matched' : '') + (card.wrong ? ' is-wrong' : '');
      button.type = 'button';
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', card.matched ? `Eşleşen ${card.emoji}` : card.open || preview ? `${card.emoji}, kart ${index + 1}` : `Kapalı kart ${index + 1}`);
      button.style.setProperty('--tile-bg', card.color);
      button.disabled = locked || card.matched || card.open;
      button.innerHTML = `<span class="tile-inner"><span class="tile-face tile-back" aria-hidden="true"></span><span class="tile-face tile-front" aria-hidden="true">${card.emoji}</span></span>`;
      button.addEventListener('click', () => chooseCard(index));
      board.append(button);
    });
  }
  function updateStats() {
    matchLabel.innerHTML = `${matches} <small>/ 18</small>`;
    moveLabel.textContent = moves;
    timerLabel.textContent = fmt(seconds);
  }
  function stopClock() { if (clock) clearInterval(clock); clock = null; }
  function startClock() { if (clock) return; clock = setInterval(() => { seconds++; updateStats(); }, 1000); }
  function showOverlay(icon, title, text, buttonText) {
    overlayIcon.textContent = icon; overlayTitle.textContent = title; overlayText.textContent = text;
    startButton.innerHTML = `${buttonText} <span aria-hidden="true">→</span>`;
    overlay.classList.remove('is-hidden');
  }
  function beginGame() {
    clearTimeout(previewTimeout); clearTimeout(missTimeout); stopClock();
    deck = shuffledCards().map(card => ({ ...card, open: false, matched: false, wrong: false }));
    first = null; locked = true; moves = 0; matches = 0; seconds = 0; updateStats();
    hint.textContent = 'Resimleri dikkatlice incele; 3 saniye sonra kartlar kapanacak.';
    renderBoard(true); overlay.classList.add('is-hidden');
    sounds.start();
    previewTimeout = setTimeout(() => {
      locked = false; renderBoard();
      hint.textContent = 'Bir kart aç, sonra hafızanı kullanıp eşini bul.'; startClock();
    }, 3000);
  }
  function chooseCard(index) {
    if (locked || deck[index].matched || deck[index].open) return;
    deck[index].open = true; renderBoard(); sounds.flip();
    if (first === null) { first = index; hint.textContent = 'Güzel! Şimdi bu resmin eşini bul.'; return; }
    moves++; locked = true; const second = index; updateStats();
    if (deck[first].pairId === deck[second].pairId) {
      deck[first].matched = deck[second].matched = true; matches++; first = null; locked = false;
      updateStats(); renderBoard();
      if (matches === 18) {
        stopClock(); saveScore(); setTimeout(() => sounds.win(), 250);
        hint.textContent = 'Harika, bütün çiftleri buldun!';
        showOverlay('🎉', 'Hepsini buldun!', `${moves} hamlede ve ${timerLabel.textContent} sürede tamamladın. Bir tur daha oynamak ister misin?`, 'Tekrar oyna');
      } else {
        sounds.right(); hint.textContent = 'Eşleşti! Bir sonraki çifti bul.';
      }
    } else {
      const a = first; first = null;
      deck[a].wrong = deck[second].wrong = true; renderBoard(); sounds.wrong();
      hint.textContent = 'Eşleşmedi. Yerlerini aklında tut!';
      missTimeout = setTimeout(() => {
        deck[a].open = deck[second].open = false; deck[a].wrong = deck[second].wrong = false;
        locked = false; renderBoard(); hint.textContent = 'Bir kart aç, sonra hafızanı kullanıp eşini bul.';
      }, 850);
    }
  }
  startButton.addEventListener('click', beginGame);
  $('#restart').addEventListener('click', beginGame);
  renderSound(); renderScores(); renderBoard(); updateStats();
})();
