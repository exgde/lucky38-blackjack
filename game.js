const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const INTRO = 'BLACKJACK PAGA 3:2 · DEALER PARA NO 17';
const $ = id => document.getElementById(id);
const money = n => '$' + n.toLocaleString('en-US');

// --- Persistence: preferences + stats only (balance resets on reload by design) ---
function load(key, fallback) {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return { ...fallback }; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const STATS0 = { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, best: 1000, streak: 0, bestStreak: 0 };
const settings = load('l38-settings', { sound: true, fast: false, timer: true, back: 'lucky' });
let stats = load('l38-stats', STATS0);

let deck = newDeck(), player = [], dealer = [], chips = [];
let bank = 1000, bet = 0, hands = 0, busy = false, holeHidden = false, started = Date.now();

const speed = () => (settings.fast ? .5 : 1);
const sleep = ms => new Promise(r => setTimeout(r, ms * speed()));
const inPhase = p => !busy && !$(p + '-controls').hidden;

function newDeck() {
  const d = SUITS.flatMap(s => RANKS.map(r => ({ r, s })));
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const draw = () => (deck.length ? deck : (deck = newDeck())).pop();
const value = c => c.r === 'A' ? 11 : isNaN(c.r) ? 10 : +c.r;

function total(hand) {
  let t = 0, aces = 0;
  for (const c of hand) { t += value(c); if (c.r === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
const score = hand => total(hand).t;
console.assert(score([{ r: 'A' }, { r: 'A' }, { r: '9' }]) === 21 && score([{ r: 'K' }, { r: 'Q' }, { r: 'A' }]) === 21, 'score() broken');

// ponytail: simplified basic strategy (no split/surrender), enough for a hint button
function bestMove() {
  const { t, soft } = total(player), up = value(dealer[0]);
  const canDouble = player.length === 2 && bank >= bet;
  const dbl = canDouble ? 'double' : 'hit';
  if (soft) {
    if (t >= 19) return 'stand';
    if (t === 18) return up >= 9 ? 'hit' : up >= 3 && up <= 6 && canDouble ? 'double' : 'stand';
    return up >= 4 && up <= 6 ? dbl : 'hit';
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return up <= 6 ? 'stand' : 'hit';
  if (t === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (t === 11) return dbl;
  if (t === 10) return up <= 9 ? dbl : 'hit';
  if (t === 9) return up >= 3 && up <= 6 ? dbl : 'hit';
  return 'hit';
}

// --- Sound (Web Audio, no files) ---
let ctx;
const audio = () => (ctx ??= new AudioContext());

function tone(freq, dur, type = 'sine', vol = .12, when = 0) {
  if (!settings.sound) return;
  const a = audio(), t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

function swish() {
  if (!settings.sound) return;
  const a = audio(), len = a.sampleRate * .12, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass';
  f.frequency.value = 2500;
  g.gain.value = .4;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

const sfx = {
  card: swish,
  chip: () => { tone(1800, .05, 'square', .04); tone(2400, .04, 'square', .03, .03); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .15, i * .09)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, .3, 'sawtooth', .05, i * .15)),
  push: () => tone(440, .25, 'triangle'),
};

// --- Croupier: each face is a set of SVG parts to show ---
const FACES = {
  happy:   'brow-n eye-n mouth-grin arm-thumb',
  wink:    'brow-n eye-wink mouth-grin arm-thumb',
  focus:   'brow-n eye-down mouth-focus arm-hip',
  cheer:   'brow-up eye-happy mouth-open arm-thumb',
  shock:   'brow-up eye-wide mouth-o arm-thumb sparkles',
  smug:    'brow-smug eye-wink mouth-smirk arm-hip',
  yikes:   'brow-up eye-wide mouth-grimace arm-scratch sweat',
  nervous: 'brow-sad eye-n mouth-wavy arm-scratch sweat',
  meh:     'brow-n eye-n mouth-flat arm-hip',
  sad:     'brow-sad eye-down mouth-sad arm-scratch',
};
const REACT = {
  welcome:    ['happy', ['Bem-vindo ao Lucky 38!', 'Façam suas apostas!', 'As mesas mais quentes da cidade!']],
  bigbet:     ['wink', ['Apostando alto, hein?', 'Agora sim, parceiro!']],
  deal:       ['focus', ['Cartas na mesa...', 'Vamos ver o que o baralho diz.']],
  turn:       ['happy', ['Sua vez, parceiro.', 'Pede ou para?']],
  dealer:     ['focus', ['Minha vez.', 'Deixa comigo...']],
  win:        ['cheer', ['Belo jogo, parceiro!', 'A sorte sorri pra você!', 'Mandou bem!']],
  blackjack:  ['shock', ['BLACKJACK! Uau!', 'Inacreditável!']],
  houseBJ:    ['smug', ['Blackjack da casa!', 'Desculpa, parceiro.']],
  lose:       ['smug', ['A casa agradece!', 'Mais sorte na próxima.', 'O Sr. House manda lembranças.']],
  bust:       ['yikes', ['Ai! Passou do ponto.', 'Essa doeu...']],
  dealerBust: ['nervous', ['Opa... estourei.', 'O chefe não vai gostar disso.']],
  push:       ['meh', ['Empate. Ninguém sai ferido.', 'Fica tudo como está.']],
  broke:      ['sad', ['Sem fichas? A casa dá uma mãozinha.']],
  newgame:    ['happy', ['Mesa nova, sorte nova!']],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
let bubbleTimer;

function croupier(face, line) {
  const on = FACES[face].split(' ');
  document.querySelectorAll('#croupier [data-p]').forEach(el => { el.style.display = on.includes(el.dataset.p) ? '' : 'none'; });
  document.querySelector('.croupier-wrap').animate(
    [{ transform: 'none' }, { transform: 'translateY(-6px) rotate(-2deg)' }, { transform: 'none' }],
    { duration: 300 }
  );
  if (!line) return;
  const b = $('bubble');
  b.textContent = line;
  b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 3200);
}
const react = key => croupier(REACT[key][0], pick(REACT[key][1]));

// --- Rendering ---
function cardEl(c, down) {
  const el = document.createElement('div');
  const color = c.s === '♥' || c.s === '♦' ? 'red' : 'black';
  const face = 'JQK'.includes(c.r);
  el.className = 'card' + (down ? ' down' : '');
  el.innerHTML = `<div class="inner"><div class="front ${color}">
    <div class="corner tl">${c.r}<br>${c.s}</div>
    <div class="pip${face ? ' face' : ''}">${face ? c.r + c.s : c.s}</div>
    <div class="corner br">${c.r}<br>${c.s}</div>
  </div><div class="back"></div></div>`;
  return el;
}

async function give(hand, id, down = false) {
  const c = draw();
  hand.push(c);
  const el = cardEl(c, down);
  $(id).appendChild(el);
  const from = $('shoe').getBoundingClientRect(), to = el.getBoundingClientRect();
  el.animate(
    [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) rotate(-10deg)` }, { transform: 'none' }],
    { duration: 380 * speed(), easing: 'cubic-bezier(.2,.8,.3,1)' }
  );
  sfx.card();
  ui();
  await sleep(320);
}

function ui() {
  $('bank').textContent = money(bank);
  $('bet').textContent = money(bet);
  $('hands').textContent = hands;
  $('player-score').textContent = player.length ? score(player) : '';
  $('dealer-score').textContent = dealer.length ? score(holeHidden ? dealer.slice(0, 1) : dealer) : '';
  $('t-undo').disabled = !inPhase('bet') || !chips.length;
  $('t-hint').disabled = !inPhase('play');
}

function msg(text, tone = '') {
  $('msg').textContent = text;
  $('msg').dataset.tone = tone;
}

function phase(p) {
  $('bet-controls').hidden = p !== 'bet';
  $('play-controls').hidden = p !== 'play';
}

function lock(on) {
  busy = on;
  document.querySelectorAll('#play-controls button').forEach(b => { b.disabled = on; });
  if (!on) $('double').disabled = player.length !== 2 || bank < bet;
  ui();
}

function tween(el, from, to) {
  const t0 = performance.now(), dur = 600;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = money(Math.round(from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showDelta(n) {
  if (!n) return;
  const d = $('delta');
  d.textContent = (n > 0 ? '+' : '−') + money(Math.abs(n));
  d.className = n > 0 ? 'up' : 'down';
  d.animate([
    { opacity: 0, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'none', offset: .15 },
    { opacity: 1, offset: .8 },
    { opacity: 0, transform: 'translateY(-8px)' },
  ], { duration: 2000 });
}

// --- Game flow ---
function addChip(v) {
  if (!inPhase('bet') || v > bank) return;
  bank -= v;
  bet += v;
  chips.push(v);
  sfx.chip();
  if (v === 500) react('bigbet');
  ui();
}

function undo() {
  if (!inPhase('bet') || !chips.length) return;
  const v = chips.pop();
  bank += v;
  bet -= v;
  sfx.chip();
  ui();
}

function clearBet() {
  if (!inPhase('bet')) return;
  bank += bet;
  bet = 0;
  chips = [];
  ui();
}

async function deal() {
  if (!inPhase('bet')) return;
  if (!bet) return msg('APOSTE ANTES DE DISTRIBUIR');
  if (deck.length < 15) deck = newDeck();
  player = []; dealer = []; holeHidden = true;
  $('player').innerHTML = $('dealer').innerHTML = '';
  msg('');
  react('deal');
  phase('play');
  lock(true);
  await give(player, 'player');
  await give(dealer, 'dealer');
  await give(player, 'player');
  await give(dealer, 'dealer', true);
  if (score(player) === 21 || score(dealer) === 21) return endRound(false);
  react('turn');
  lock(false);
}

async function hit() {
  if (!inPhase('play')) return;
  lock(true);
  croupier('focus');
  await give(player, 'player');
  const p = score(player);
  if (p > 21) return endRound(false);
  if (p === 21) return endRound(true);
  croupier('happy');
  lock(false);
}

function stand() {
  if (!inPhase('play')) return;
  lock(true);
  endRound(true);
}

async function double() {
  if (!inPhase('play') || player.length !== 2 || bank < bet) return;
  lock(true);
  bank -= bet;
  bet *= 2;
  await give(player, 'player');
  endRound(score(player) <= 21);
}

async function endRound(dealerPlays) {
  holeHidden = false;
  $('dealer').children[1].classList.remove('down');
  sfx.card();
  ui();
  if (dealerPlays) react('dealer');
  await sleep(500);
  if (dealerPlays) while (score(dealer) < 17) await give(dealer, 'dealer');
  settle();
}

function settle() {
  const p = score(player), d = score(dealer);
  const pBJ = p === 21 && player.length === 2, dBJ = d === 21 && dealer.length === 2;
  let pay = 0, text, key;
  if (p > 21) { text = 'ESTOUROU! A CASA LEVA.'; key = 'bust'; }
  else if (pBJ && !dBJ) { pay = bet * 2.5; text = 'BLACKJACK! PAGA 3:2'; key = 'blackjack'; }
  else if (dBJ && !pBJ) { text = 'BLACKJACK DO DEALER.'; key = 'houseBJ'; }
  else if (d > 21) { pay = bet * 2; text = 'DEALER ESTOUROU! VOCÊ GANHA.'; key = 'dealerBust'; }
  else if (p > d) { pay = bet * 2; text = 'VOCÊ GANHA!'; key = 'win'; }
  else if (p === d) { pay = bet; text = 'EMPATE (PUSH).'; key = 'push'; }
  else { text = 'A CASA VENCE.'; key = 'lose'; }

  const net = pay - bet, before = bank;
  bank += pay;
  hands++;
  stats.hands++;
  if (net > 0) {
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    if (pBJ) stats.blackjacks++;
  } else if (net < 0) {
    stats.losses++;
    stats.streak = 0;
  } else stats.pushes++;
  stats.best = Math.max(stats.best, bank);
  save('l38-stats', stats);

  sfx[net > 0 ? 'win' : net < 0 ? 'lose' : 'push']();
  if (bank < 10) { bank = 1000; text += ' SEM FICHAS — A CASA REPÕE $1,000.'; key = 'broke'; }
  react(key);
  msg(text, net > 0 ? 'win' : '');
  bet = 0;
  chips = [];
  phase('bet');
  busy = false;
  ui();
  tween($('bank'), before, bank);
  showDelta(net);
}

function hint() {
  if (!inPhase('play')) return;
  const move = bestMove();
  msg('DICA: ' + move.toUpperCase());
  croupier('wink', `Psst... eu daria ${move.toUpperCase()}.`);
  $(move).animate(
    [{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: '0 0 26px 6px #ffd27a' }, { boxShadow: '0 0 0 0 transparent' }],
    { duration: 700, iterations: 3 }
  );
}

function ask(text) {
  const d = $('dlg-confirm');
  $('confirm-text').textContent = text;
  d.returnValue = '';
  d.showModal();
  return new Promise(r => d.addEventListener('close', () => r(d.returnValue === 'ok'), { once: true }));
}

async function newGame() {
  if (busy) return;
  if ((hands || bet || !$('play-controls').hidden) && !(await ask('Abandonar a sessão atual e recomeçar com $1,000?'))) return;
  bank = 1000; bet = 0; hands = 0; chips = [];
  player = []; dealer = [];
  deck = newDeck();
  started = Date.now();
  $('player').innerHTML = $('dealer').innerHTML = '';
  msg(INTRO);
  react('newgame');
  phase('bet');
  ui();
}

function renderStats() {
  const s = stats, pct = s.hands ? Math.round(s.wins / s.hands * 100) : 0;
  const rows = [
    ['Mãos jogadas', s.hands], ['Vitórias', s.wins], ['Derrotas', s.losses], ['Empates', s.pushes],
    ['% de vitórias', pct + '%'], ['Blackjacks', s.blackjacks], ['Maior saldo', money(s.best)],
    ['Sequência atual', s.streak], ['Melhor sequência', s.bestStreak],
  ];
  $('stats-grid').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// --- Settings ---
function apply() {
  document.body.dataset.back = settings.back;
  $('t-sound').setAttribute('aria-pressed', settings.sound);
  $('time-stat').hidden = !settings.timer;
  for (const k of ['sound', 'fast', 'timer']) $('opt-' + k).checked = settings[k];
  document.querySelector(`input[name="back"][value="${settings.back}"]`).checked = true;
  save('l38-settings', settings);
}

function toggleSound() {
  settings.sound = !settings.sound;
  apply();
}

for (const k of ['sound', 'fast', 'timer']) $('opt-' + k).onchange = e => { settings[k] = e.target.checked; apply(); };
document.querySelectorAll('input[name="back"]').forEach(r => { r.onchange = () => { settings.back = r.value; apply(); }; });

setInterval(() => {
  const s = Math.floor((Date.now() - started) / 1000);
  $('time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}, 1000);

// --- Menus, toolbar, dialogs ---
const ACTIONS = {
  new: newGame,
  undo,
  hint,
  sound: toggleSound,
  stats: () => { renderStats(); $('dlg-stats').showModal(); },
  deck: () => $('dlg-deck').showModal(),
  options: () => $('dlg-options').showModal(),
  help: () => $('dlg-help').showModal(),
  about: () => $('dlg-about').showModal(),
};

document.querySelectorAll('[data-act]').forEach(b => {
  b.onclick = () => {
    b.closest('[popover]')?.hidePopover();
    ACTIONS[b.dataset.act]();
  };
});

// Anchor each dropdown under its menu button
document.querySelectorAll('[popover]').forEach(p => p.addEventListener('beforetoggle', e => {
  if (e.newState !== 'open') return;
  const r = document.querySelector(`[popovertarget="${p.id}"]`).getBoundingClientRect();
  p.style.left = r.left + 'px';
  p.style.top = r.bottom + 4 + 'px';
}));

$('reset-stats').onclick = () => {
  stats = { ...STATS0 };
  save('l38-stats', stats);
  renderStats();
};

// --- Table controls + keyboard ---
document.querySelectorAll('.chip').forEach(b => { b.onclick = () => addChip(+b.dataset.v); });
$('clear').onclick = clearBet;
$('deal').onclick = deal;
$('hit').onclick = hit;
$('stand').onclick = stand;
$('double').onclick = double;

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (e.key === 'F2') { e.preventDefault(); newGame(); }
  else if (e.key === 'F1') { e.preventDefault(); ACTIONS.help(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
  else if (e.ctrlKey || e.metaKey || e.altKey) return;
  else if ('1234'.includes(k)) document.querySelectorAll('.chip')[k - 1].click();
  else if (k === 'enter' && !e.target.closest?.('button')) deal();
  else if (k === 'h') hit();
  else if (k === 's') stand();
  else if (k === 'd') double();
  else if (k === 't') hint();
  else if (k === 'm') toggleSound();
});

apply();
ui();
phase('bet');
react('welcome');
