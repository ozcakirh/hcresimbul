(() => {
  const pictures = [
    ['🍋','#fff8d9'],['🍓','#fff0f1'],['🍉','#e8faed'],['🍇','#f3edff'],['🍊','#fff1df'],['🍍','#fff8db'],
    ['🥑','#eff8e7'],['🍒','#fff0f1'],['🥕','#fff2e7'],['🌽','#fff9dd'],['🍄','#fff0eb'],['🥦','#eaf8e9'],
    ['🐱','#f5f0ff'],['🐶','#fff1e8'],['🐸','#eaf9ee'],['🦊','#fff0e5'],['🐼','#f0f2f6'],['🐧','#eaf6ff']
  ];
  const board = document.querySelector('#board');
  const overlay = document.querySelector('#overlay');
  const overlayIcon = document.querySelector('#overlay-icon');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayText = document.querySelector('#overlay-text');
  const startButton = document.querySelector('#start');
  const hint = document.querySelector('#hint');
  const matchLabel = document.querySelector('#matches');
  const moveLabel = document.querySelector('#moves');
  const timerLabel = document.querySelector('#timer');
  let deck = [], first = null, locked = true, moves = 0, matches = 0, seconds = 0, clock = null, previewTimeout = null;

  function shuffledCards() {
    const cards = pictures.flatMap((picture, pairId) => [0, 1].map(copy => ({pairId, emoji:picture[0], color:picture[1], copy})));
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
      button.className = 'tile' + (preview || card.open ? ' is-open' : '') + (card.matched ? ' is-matched' : '');
      button.type = 'button';
      button.setAttribute('role','gridcell');
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
    timerLabel.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  function stopClock() { if (clock) clearInterval(clock); clock = null; }
  function startClock() { if (clock) return; clock = setInterval(() => { seconds++; updateStats(); }, 1000); }
  function showOverlay(icon, title, text, buttonText) {
    overlayIcon.textContent = icon; overlayTitle.textContent = title; overlayText.textContent = text; startButton.innerHTML = `${buttonText} <span aria-hidden="true">→</span>`; overlay.classList.remove('is-hidden');
  }
  function beginGame() {
    clearTimeout(previewTimeout); stopClock();
    deck = shuffledCards().map(card => ({...card, open:false, matched:false}));
    first = null; locked = true; moves = 0; matches = 0; seconds = 0; updateStats();
    hint.textContent = 'Resimleri dikkatlice incele; 3 saniye sonra kartlar kapanacak.';
    renderBoard(true); overlay.classList.add('is-hidden');
    previewTimeout = setTimeout(() => {
      board.classList.remove('is-preview'); locked = false; renderBoard(); hint.textContent = 'Bir kart aç, sonra hafızanı kullanıp eşini bul.'; startClock();
    }, 3000);
  }
  function chooseCard(index) {
    if (locked || deck[index].matched || deck[index].open) return;
    deck[index].open = true; renderBoard();
    if (first === null) { first = index; hint.textContent = 'Güzel! Şimdi bu resmin eşini bul.'; return; }
    moves++; locked = true; const second = index; updateStats();
    if (deck[first].pairId === deck[second].pairId) {
      deck[first].matched = deck[second].matched = true; matches++; first = null; locked = false; updateStats(); renderBoard();
      hint.textContent = matches === 18 ? 'Harika, bütün çiftleri buldun!' : 'Eşleşti! Bir sonraki çifti bul.';
      if (matches === 18) {
        stopClock(); showOverlay('🎉','Hepsini buldun!',`${moves} hamlede ve ${timerLabel.textContent} sürede tamamladın. Bir tur daha oynamak ister misin?`,'Tekrar oyna');
      }
    } else {
      hint.textContent = 'Eşleşmedi. Yerlerini aklında tut!';
      setTimeout(() => { deck[first].open = false; deck[second].open = false; first = null; locked = false; renderBoard(); hint.textContent = 'Bir kart aç, sonra hafızanı kullanıp eşini bul.'; }, 850);
    }
  }
  startButton.addEventListener('click', beginGame);
  document.querySelector('#restart').addEventListener('click', beginGame);
  renderBoard(); updateStats();
})();
