(() => {
  const R = window.ResimBul; if (!R) return;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const mpOverlay = $('#mp-overlay'), bar = $('#mp-bar'), stats = $('.stats'), restart = $('#restart'),
    board = R.board, hint = $('#hint'), errBox = $('#mp-error'), restartHtml = restart.innerHTML;
  let me = null, timer = null, busy = false, lastSeq = 0, lastKey = '', fails = 0, state = null;

  const setView = v => { $$('#mp-overlay [data-view]').forEach(s => s.hidden = s.dataset.view !== v); mpOverlay.classList.remove('is-hidden'); };
  const showError = m => { errBox.textContent = m || ''; errBox.hidden = !m; };
  function setMode(on) {
    stats.hidden = on; bar.hidden = !on;
    restart.innerHTML = on ? '<span aria-hidden="true">←</span> Ayrıl' : restartHtml;
    restart.setAttribute('aria-label', on ? 'Oyundan ayrıl' : 'Oyunu yeniden başlat');
  }
  async function call(action, extra = {}) {
    try {
      const res = await fetch('mp.php', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(me ? { code: me.code, token: me.token } : {}), ...extra }) });
      return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
    } catch { return { ok: false, status: 0, data: {} }; }
  }
  function reset(msg) {
    clearInterval(timer); timer = null; me = null; state = null; lastSeq = 0; lastKey = ''; fails = 0; busy = false;
    mpOverlay.classList.add('is-hidden'); showError(''); setMode(false); board.classList.remove('is-locked');
    R.exitMulti(); if (msg) hint.textContent = msg;
  }
  async function leave() {
    if (state && state.phase === 'play' && !confirm('Oyundan ayrılırsan rakip kazanır. Emin misin?')) return;
    if (me && (!state || state.phase !== 'finished')) await call('leave');
    reset();
  }
  R.onLeave = leave;

  function drawBoard(s) {
    board.replaceChildren(); board.classList.remove('is-preview');
    const myTurn = !!s && s.phase === 'play' && s.turn === me.seat && !s.resolving;
    board.classList.toggle('is-locked', !!s && s.phase === 'play' && !myTurn);
    for (let i = 0; i < 36; i++) {
      const c = s ? s.cards[i] : { s: 'c' }, pic = c.p !== undefined ? R.pictures[c.p] : null, open = c.s !== 'c';
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'gridcell');
      b.className = 'tile' + (open ? ' is-open' : '') + (c.s === 'm' ? ' is-matched ' + (c.o === me.seat ? 'is-mine' : 'is-theirs') : '') + (c.s === 'o' && s.resolving ? ' is-wrong' : '');
      b.style.setProperty('--tile-bg', pic ? pic[1] : '#fff');
      b.setAttribute('aria-label', pic ? `${pic[0]}, kart ${i + 1}` : `Kapalı kart ${i + 1}`);
      b.disabled = !(myTurn && c.s === 'c');
      b.innerHTML = `<span class="tile-inner"><span class="tile-face tile-back" aria-hidden="true"></span><span class="tile-face tile-front" aria-hidden="true">${pic ? pic[0] : ''}</span></span>`;
      b.addEventListener('click', () => flip(i));
      board.append(b);
    }
  }
  function drawBar(s) {
    const my = s.scores[me.seat], op = s.scores[me.seat === 'p1' ? 'p2' : 'p1'], mine = s.turn === me.seat;
    let pill = '';
    if (s.phase === 'play') pill = `<span class="mp-turn ${mine ? 'is-mine' : ''}">${mine ? 'Sıra sende' : 'Rakibin sırası'} · ${s.resolving ? '…' : s.turnLeft + ' sn'}</span>`;
    else if (s.phase === 'preview') pill = `<span class="mp-turn">Ezberle · ${s.previewLeft} sn</span>`;
    else pill = '<span class="mp-turn">Oyun bitti</span>';
    bar.innerHTML = `<span class="mp-score is-mine"><small>SEN</small><strong>${my}</strong></span>${pill}<span class="mp-score"><small>RAKİP</small><strong>${op}</strong></span>`;
  }
  function playEvents(s) {
    const base = lastSeq;
    s.evs.filter(e => e.seq > base).forEach(e => {
      lastSeq = Math.max(lastSeq, e.seq);
      if (e.type === 'start') R.sounds.start();
      else if (e.type === 'flip' && e.seat !== me.seat) R.sounds.flip();
      else if (e.type === 'match') R.sounds.right();
      else if (e.type === 'miss') R.sounds.wrong();
      else if ((e.type === 'turn' || e.type === 'timeout') && s.turn === me.seat) R.sounds.turn();
      else if (e.type === 'end') (s.winner === me.seat || s.winner === 'draw') ? setTimeout(R.sounds.win, 200) : R.sounds.wrong();
    });
  }
  function apply(s) {
    state = s; me.seat = s.seat; showError('');
    if (s.phase === 'closed') return reset('Oda kapandı.');
    playEvents(s);
    if (s.phase === 'waiting') { $('#mp-show-code').textContent = s.code; setView('wait'); return; }
    const key = JSON.stringify([s.phase, s.turn, s.resolving, s.cards.map(c => c.s + (c.p ?? '') + (c.o ?? ''))]);
    if (key !== lastKey) { lastKey = key; drawBoard(s); }
    drawBar(s);
    const mine = s.turn === me.seat;
    if (s.phase === 'preview') hint.textContent = 'Kartları ezberle! Biraz sonra kapanacak.';
    else if (s.phase === 'play') hint.textContent = s.resolving ? 'Eşleşmedi. Sıra değişiyor…' : mine ? 'Sıra sende — bir kart aç. Eşleşirse devam edersin!' : 'Rakibin sırası. Hamlesini izle, yerleri aklında tut.';
    if (s.phase === 'finished') {
      const my = s.scores[me.seat], op = s.scores[me.seat === 'p1' ? 'p2' : 'p1'], win = s.winner === me.seat, draw = s.winner === 'draw';
      $('#mp-r-icon').textContent = draw ? '🤝' : win ? '🎉' : '😅';
      $('#mp-r-title').textContent = draw ? 'Berabere!' : win ? 'Kazandın!' : 'Rakip kazandı';
      $('#mp-r-text').textContent = s.reason === 'left' ? (win ? 'Rakip oyundan ayrıldı.' : 'Oyundan ayrıldın.') : `Skor: ${my} – ${op}`;
      const rb = $('#mp-rematch');
      rb.hidden = s.reason === 'left'; rb.disabled = s.rematch.me;
      rb.textContent = s.rematch.me ? 'Rakip bekleniyor…' : s.rematch.opp ? 'Rakip istiyor — Rövanş' : 'Rövanş';
      setView('result'); hint.textContent = 'Oyun bitti.';
    } else if (s.phase !== 'waiting') mpOverlay.classList.add('is-hidden');
  }
  async function tick() {
    if (busy || !me) return;
    busy = true; const r = await call('state'); busy = false;
    if (!me) return;
    if (r.ok) { fails = 0; apply(r.data); }
    else if (r.status === 404 || r.status === 403) reset('Oda kapandı.');
    else if (++fails >= 15) reset('Bağlantı koptu.');
  }
  async function flip(i) {
    if (busy || !state || state.turn !== me.seat) return;
    busy = true; R.sounds.flip(); const r = await call('flip', { index: i }); busy = false;
    if (r.ok && me) apply(r.data);
  }
  function enter(d) {
    me = { code: d.code, token: d.token, seat: d.seat }; lastSeq = 0; lastKey = ''; fails = 0;
    apply(d); clearInterval(timer); timer = setInterval(tick, 1000);
  }

  $('#multi-open').addEventListener('click', () => { R.enterMulti(); setMode(true); bar.innerHTML = ''; drawBoard(null); showError(''); setView('menu'); hint.textContent = 'İki kişilik oyun: oda kur ya da katıl.'; });
  $('#mp-back').addEventListener('click', () => reset());
  $('#mp-join-open').addEventListener('click', () => { showError(''); setView('join'); $('#mp-code').value = ''; $('#mp-code').focus(); });
  $('#mp-join-back').addEventListener('click', () => { showError(''); setView('menu'); });
  $('#mp-create').addEventListener('click', async () => {
    showError(''); const r = await call('create');
    if (r.ok) enter(r.data); else showError(r.status === 429 ? 'Çok fazla deneme, biraz bekle.' : 'Oda kurulamadı. Sunucuya ulaşılamıyor olabilir.');
  });
  async function join() {
    const code = $('#mp-code').value.trim();
    if (!/^\d{4}$/.test(code)) return showError('4 haneli bir kod gir.');
    showError(''); const r = await call('join', { code });
    if (r.ok) enter(r.data);
    else showError(r.status === 429 ? 'Çok fazla deneme, biraz bekle.' : r.status === 404 || r.status === 409 ? 'Böyle bir oda yok ya da oda dolu.' : 'Bağlanılamadı, tekrar dene.');
  }
  $('#mp-join').addEventListener('click', join);
  $('#mp-code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  $('#mp-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  $('#mp-cancel').addEventListener('click', leave);
  $('#mp-exit').addEventListener('click', () => reset());
  $('#mp-rematch').addEventListener('click', async () => { const r = await call('rematch'); if (r.ok && me) apply(r.data); });
  window.addEventListener('pagehide', () => { if (me && state && state.phase !== 'finished') navigator.sendBeacon && navigator.sendBeacon('mp.php', new Blob([JSON.stringify({ action: 'leave', code: me.code, token: me.token })], { type: 'application/json' })); });
})();
