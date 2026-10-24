// Node tests for poker.js. Run: node test.js
// No dependencies. A failure prints the assertion and exits non-zero.
const P = require('./poker.js');
let n = 0;
function ok(cond, msg) { n++; if (!cond) { console.error('FAIL:', msg); process.exit(1); } }
function C(s) { return P.card(s[0], { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' }[s[1]]); }
function hand(...ss) { return ss.map(C); }
function cmp(a, b) { return P.compareScore(P.bestScore(a), P.bestScore(b)); }

// Evaluator: categories and tiebreaks
ok(cmp(hand('As', 'Ks', 'Qs', 'Js', 'Ts', '2c', '3d'), hand('Ks', 'Qs', 'Js', 'Ts', '9s', '2c', '3d')) > 0, 'royal beats straight flush');
ok(cmp(hand('As', '2s', '3s', '4s', '5s', '9c', 'Kd'), hand('Ks', 'Qs', 'Js', 'Ts', '9s', '2c', '3d')) < 0, 'wheel straight flush loses to K-high');
ok(P.bestScore(hand('As', '2d', '3c', '4h', '5s', '9c', 'Kd'))[0] === 4, 'wheel counts as straight');
ok(cmp(hand('As', 'Ad', 'Ac', 'Ks', 'Kd', '2c', '3d'), hand('Ks', 'Kd', 'Kc', 'As', 'Ad', '2c', '3d')) > 0, 'aces full beats kings full');
ok(cmp(hand('As', 'Ks', 'Qs', 'Js', '9s', '2c', '3d'), hand('As', 'Ks', 'Qs', 'Js', '8s', '2c', '3d')) > 0, 'flush kicker decides');
ok(cmp(hand('As', 'Ad', 'Ks', 'Qd', '2c', '3d', '4h'), hand('As', 'Ad', 'Ks', 'Jd', '2c', '3d', '4h')) > 0, 'pair kicker decides');
ok(cmp(hand('As', 'Kd', 'Qc', 'Jh', 'Ts', '2c', '3d'), hand('As', 'Kd', 'Qc', 'Jh', 'Ts', '2c', '3d')) === 0, 'identical hands split');
ok(P.prettyHandName(P.bestScore(hand('As', 'Ad', 'Kc', 'Qd', '2c', '3d', '9h'))) === 'Pair of Aces', 'pretty name pair');

// Deterministic deck: seed the RNG so a scripted hand is reproducible.
function seededRand(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

// Game flow: blinds, button first preflop, fold wins, button alternates.
{
  const g = new P.Game({ rand: seededRand(42) });
  ok(g.phase === 'preflop', 'starts preflop');
  ok(g.contributed[0] === 10 && g.contributed[1] === 20, 'button posts SB, other posts BB');
  ok(g.turn === 0, 'button acts first preflop');
  ok(g.legalActions(0).includes('call') && g.legalActions(0).includes('raise'), 'button can call/raise');
  let r = g.act(0, { type: 'call' }); ok(r.ok, 'button calls');
  ok(g.turn === 1, 'turn passes to BB');
  r = g.act(1, { type: 'check' }); ok(r.ok, 'BB checks, flop dealt');
  ok(g.phase === 'flop' && g.community.length === 3, 'flop after both act with equal bets');
  ok(g.turn === 1, 'non-button acts first postflop');
  // Total chips must be conserved through a folded hand
  // (stacks + money already in the pot).
  const before = g.stacks[0] + g.stacks[1] + (g.potTotal || 0) + g.contributed[0] + g.contributed[1];
  g.act(1, { type: 'check' }); g.act(0, { type: 'fold' });
  ok(g.phase === 'handEnd' && g.winner === 1, 'fold gives pot to other player');
  ok(g.stacks[0] + g.stacks[1] === before, 'chips conserved on fold');
  const btn = g.button; g.nextHand();
  ok(g.button === 1 - btn, 'button alternates');
}

// Raise / min-raise enforcement.
{
  const g = new P.Game({ rand: seededRand(7) });
  let r = g.act(0, { type: 'raise', amount: 25 }); // current bet 20, min raise to 40
  ok(!r.ok, 'short raise rejected');
  r = g.act(0, { type: 'raise', amount: 40 }); ok(r.ok, 'min raise accepted');
  ok(g.toCall[1] === 20, 'BB must call 20 more to reach the 40 raise');
}

// All-in short call: chips conserved, hand reaches showdown/next street.
{
  const g = new P.Game({ rand: seededRand(99), stackSize: 100 });
  // Force a short stack scenario: button (seat 0) has 100, BB 100, blinds 10/20.
  g.act(0, { type: 'raise', amount: 100 }); // button all-in
  ok(g.allIn[0], 'button all-in');
  let r = g.act(1, { type: 'call' }); ok(r.ok, 'BB calls all-in');
  const total = g.stacks[0] + g.stacks[1];
  ok(g.phase === 'handEnd' || g.phase === 'showdown' || g.community.length === 5, 'all-in hand runs out');
  if (g.phase === 'handEnd') ok(total === 200, 'chips conserved after all-in showdown, got ' + total);
}

// Showdown with a known board: force cards and verify the winner.
// Deal a rigged deck by replacing hole/community after construction is
// awkward (deck is private-ish), so instead test the evaluator end-to-end
// on a full board: player 0 has a flush, player 1 has a pair.
{
  const board = hand('As', 'Ks', 'Qs', '2d', '3c');
  const s0 = P.bestScore(hand('Js', '9s').concat(board));
  const s1 = P.bestScore(hand('Ad', 'Ac').concat(board));
  ok(P.compareScore(s0, s1) > 0, 'flush on board beats pair of aces');
}

// Bot never returns an illegal action.
{
  for (let i = 0; i < 200; i++) {
    const g = new P.Game({ rand: seededRand(1000 + i) });
    const seat = g.turn;
    const a = P.botAction(g, seat);
    ok(g.legalActions(seat).includes(a.type), 'bot action legal: ' + JSON.stringify(a) + ' legal=' + g.legalActions(seat));
    if (a.type === 'raise') ok(a.amount >= g.minRaiseTo(seat) || a.amount === g.maxRaiseTo(seat), 'bot raise meets min');
  }
}

console.log('All ' + n + ' poker tests passed.');
