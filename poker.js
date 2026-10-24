// poker.js — pure Texas Hold'em heads-up logic for the Spain trip game.
// No DOM, no network here on purpose: index.html wires this to the screen
// and to WebRTC, and test.js exercises it under Node. The same file runs
// in a browser (window.Poker) and in Node (module.exports).
//
// Trust note, stated plainly in the README too: in a 2-phone game one
// phone has to deal. The host deals, so the host's device technically
// knows both hands. That is fine for a couples bragging-rights game and
// is NOT a design you would ever play for money.
(function (root) {
  'use strict';

  var SUITS = ['♠', '♥', '♦', '♣'];
  var SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  var RANK_VALUE = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  var RANK_NAME = { '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', 'T': '10', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace' };

  function card(rank, suit) { return { rank: rank, suit: suit, value: RANK_VALUE[rank], label: rank + suit }; }
  function newDeck() {
    var d = [];
    RANKS.forEach(function (r) { SUITS.forEach(function (s) { d.push(card(r, s)); }); });
    return d;
  }
  function shuffle(deck, rand) {
    rand = rand || Math.random;
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }
  function cardStr(c) { return c ? c.label : '?'; }

  // ---- Hand evaluation -------------------------------------------------
  // Evaluate exactly 5 cards. Returns [category, ...tiebreakers] where a
  // higher array (lexicographically) always wins. Categories:
  // 8 straight flush, 7 four of a kind, 6 full house, 5 flush,
  // 4 straight, 3 three of a kind, 2 two pair, 1 pair, 0 high card.
  function eval5(cards) {
    var values = cards.map(function (c) { return c.value; }).sort(function (a, b) { return b - a; });
    var flush = cards.every(function (c) { return c.suit === cards[0].suit; });
    var uniq = [];
    values.forEach(function (v) { if (uniq.indexOf(v) === -1) uniq.push(v); });
    var straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
    }
    var counts = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var groups = Object.keys(counts).map(function (v) {
      return { v: parseInt(v, 10), n: counts[v] };
    }).sort(function (a, b) { return (b.n - a.n) || (b.v - a.v); });

    if (straightHigh && flush) return [8, straightHigh];
    if (groups[0].n === 4) return [7, groups[0].v, groups[1].v];
    if (groups[0].n === 3 && groups[1].n === 2) return [6, groups[0].v, groups[1].v];
    if (flush) return [5].concat(values);
    if (straightHigh) return [4, straightHigh];
    if (groups[0].n === 3) return [3, groups[0].v].concat(groups.filter(function (g) { return g.n === 1; }).map(function (g) { return g.v; }).sort(function (a, b) { return b - a; }));
    if (groups[0].n === 2 && groups[1].n === 2) {
      var pairs = [groups[0].v, groups[1].v].sort(function (a, b) { return b - a; });
      return [2, pairs[0], pairs[1], groups[2].v];
    }
    if (groups[0].n === 2) return [1, groups[0].v].concat(groups.filter(function (g) { return g.n === 1; }).map(function (g) { return g.v; }).sort(function (a, b) { return b - a; }));
    return [0].concat(values);
  }

  function combos(arr, k) {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    var head = arr[0], rest = arr.slice(1);
    return combos(rest, k - 1).map(function (c) { return [head].concat(c); }).concat(combos(rest, k));
  }
  function compareScore(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var av = a[i] || 0, bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }
  // Best 5-card score out of 7 (or fewer, pre-river — still useful for the bot).
  function bestScore(cards) {
    if (cards.length <= 5) return eval5(cards);
    var best = null;
    combos(cards, 5).forEach(function (c) {
      var s = eval5(c);
      if (!best || compareScore(s, best) > 0) best = s;
    });
    return best;
  }
  var CATEGORY_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  function handName(score, cards) {
    var cat = CATEGORY_NAMES[score[0]];
    if (score[0] === 8 && score[1] === 14) return 'Royal flush';
    if (score[0] === 4 || score[0] === 8) return cat + ', ' + RANK_NAME[score[1] === 14 ? 'A' : score[1] === 13 ? 'K' : score[1] === 12 ? 'Q' : score[1] === 11 ? 'J' : score[1] === 10 ? 'T' : String(score[1])] + ' high';
    if (score[0] === 1 || score[0] === 3 || score[0] === 7) return cat + ', ' + RANK_NAME[String(score[1]) === '10' ? 'T' : score[1] === 14 ? 'A' : score[1] === 13 ? 'K' : score[1] === 12 ? 'Q' : score[1] === 11 ? 'J' : String(score[1])] + 's';
    if (score[0] === 5 || score[0] === 0) return cat + ', ' + RANK_NAME[score[1] === 14 ? 'A' : score[1] === 13 ? 'K' : score[1] === 12 ? 'Q' : score[1] === 11 ? 'J' : score[1] === 10 ? 'T' : String(score[1])] + ' high';
    if (score[0] === 2) return 'Two pair';
    if (score[0] === 6) return 'Full house';
    return cat;
  }
  // Friendlier name for the showdown banner: e.g. "Pair of Aces", "Flush".
  function prettyHandName(score) {
    var rankWord = function (v) {
      return { 14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' }[v] || String(v);
    };
    switch (score[0]) {
      case 8: return score[1] === 14 ? 'Royal flush' : 'Straight flush';
      case 7: return 'Four of a kind, ' + rankWord(score[1]);
      case 6: return 'Full house';
      case 5: return 'Flush';
      case 4: return 'Straight';
      case 3: return 'Three of a kind, ' + rankWord(score[1]);
      case 2: return 'Two pair';
      case 1: return 'Pair of ' + rankWord(score[1]);
      default: return 'High card';
    }
  }

  // ---- Heads-up game ---------------------------------------------------
  // Players: 0 and 1. Button alternates each hand. Heads-up rule:
  // the button posts the small blind and acts FIRST preflop, SECOND after.
  // Blinds are fixed for v1 (10/20) — no blind clock to argue about mid-trip.
  function Game(opts) {
    opts = opts || {};
    this.stackSize = opts.stackSize || 1000;
    this.smallBlind = opts.smallBlind || 10;
    this.bigBlind = opts.bigBlind || 20;
    this.stacks = [this.stackSize, this.stackSize];
    this.matchWins = [0, 0];
    this.handsPlayed = [0, 0]; // hands won, per player
    this.button = 0;
    this.handNumber = 0;
    this.biggestPot = 0;
    this.rand = opts.rand || Math.random;
    this.newHand();
  }

  Game.prototype.newHand = function () {
    if (this.stacks[0] <= 0 || this.stacks[1] <= 0) { this.phase = 'matchEnd'; return; }
    this.handNumber++;
    this.deck = shuffle(newDeck(), this.rand);
    this.hole = [ [this.deck.pop(), this.deck.pop()], [this.deck.pop(), this.deck.pop()] ];
    this.community = [];
    this.phase = 'preflop';
    this.contributed = [0, 0];
    this.folded = [false, false];
    this.allIn = [false, false];
    this.lastRaiseSize = this.bigBlind;
    this.lastAction = null;
    this.winner = null;
    this.showdown = null;
    this.actedThisRound = [false, false];
    // Blinds: button = small blind, other = big blind.
    var sb = this.button, bb = 1 - this.button;
    this.post(sb, Math.min(this.smallBlind, this.stacks[sb]));
    this.post(bb, Math.min(this.bigBlind, this.stacks[bb]));
    this.toCall = [0, 0];
    this.recalcToCall();
    this.turn = this.button; // button acts first preflop
    this.actedThisRound = [false, false];
  };

  Game.prototype.post = function (seat, amount) {
    amount = Math.min(amount, this.stacks[seat]);
    this.stacks[seat] -= amount;
    this.contributed[seat] += amount;
    if (this.stacks[seat] === 0) this.allIn[seat] = true;
  };
  Game.prototype.recalcToCall = function () {
    var max = Math.max(this.contributed[0], this.contributed[1]);
    this.toCall = [max - this.contributed[0], max - this.contributed[1]];
  };
  Game.prototype.pot = function () { return this.contributed[0] + this.contributed[1]; };
  Game.prototype.currentBet = function () { return Math.max(this.contributed[0], this.contributed[1]); };
  Game.prototype.minRaiseTo = function (seat) {
    // Minimum total contribution after a raise = current bet + last raise size,
    // capped at the raiser's stack + what they already put in.
    var cap = this.contributed[seat] + this.stacks[seat];
    return Math.min(this.currentBet() + this.lastRaiseSize, cap);
  };
  Game.prototype.maxRaiseTo = function (seat) { return this.contributed[seat] + this.stacks[seat]; };

  Game.prototype.legalActions = function (seat) {
    if (this.phase === 'matchEnd' || this.phase === 'handEnd' || this.phase === 'showdown') return [];
    if (this.turn !== seat) return [];
    var acts = ['fold'];
    var call = this.toCall[seat];
    if (call === 0) acts.push('check');
    else acts.push('call');
    if (this.stacks[seat] > 0 && !this.allIn[1 - seat]) {
      // A raise is only meaningful if it can exceed the current bet, and
      // you cannot raise into a player who is already all-in.
      if (this.maxRaiseTo(seat) > this.currentBet()) acts.push('raise');
    }
    return acts;
  };

  // action: {type:'fold'|'check'|'call'|'raise', amount?: total contribution target for raise}
  Game.prototype.act = function (seat, action) {
    if (this.turn !== seat) return { ok: false, error: 'Not your turn' };
    if (this.phase === 'matchEnd' || this.phase === 'handEnd' || this.phase === 'showdown') return { ok: false, error: 'Hand is over' };
    var call = this.toCall[seat];
    var prevBet = this.currentBet();
    if (action.type === 'fold') {
      this.folded[seat] = true;
      this.lastAction = { seat: seat, type: 'fold' };
      return this.endHand(1 - seat, 'fold');
    }
    if (action.type === 'check') {
      if (call !== 0) return { ok: false, error: 'Cannot check, there is a bet to call' };
      this.lastAction = { seat: seat, type: 'check' };
    } else if (action.type === 'call') {
      if (call === 0) return { ok: false, error: 'Nothing to call — check instead' };
      var pay = Math.min(call, this.stacks[seat]);
      this.post(seat, pay);
      this.lastAction = { seat: seat, type: 'call', amount: pay };
    } else if (action.type === 'raise') {
      if (this.allIn[1 - seat]) return { ok: false, error: 'Cannot raise into an all-in player' };
      var target = action.amount;
      if (typeof target !== 'number' || isNaN(target)) return { ok: false, error: 'Raise needs an amount' };
      var min = this.minRaiseTo(seat), max = this.maxRaiseTo(seat);
      var isAllIn = (target === max);
      if (!isAllIn && target < min) return { ok: false, error: 'Minimum raise is to ' + min };
      if (target > max) return { ok: false, error: 'You only have ' + max + ' total to put in' };
      if (target <= prevBet) return { ok: false, error: 'Raise must exceed the current bet' };
      var raiseSize = target - prevBet;
      if (!isAllIn) this.lastRaiseSize = raiseSize;
      this.post(seat, target - this.contributed[seat]);
      this.lastAction = { seat: seat, type: this.stacks[seat] === 0 ? 'all-in' : 'raise', amount: target };
      // A raise reopens action: the other player has not acted on this bet yet.
      this.actedThisRound[1 - seat] = false;
    } else {
      return { ok: false, error: 'Unknown action' };
    }
    this.actedThisRound[seat] = true;
    this.recalcToCall();
    return this.advance();
  };

  Game.prototype.advance = function () {
    // Both all-in: run the board out with no more decisions.
    if (this.allIn[0] && this.allIn[1]) {
      while (this.community.length < 5) this.community.push(this.deck.pop());
      return this.doShowdown();
    }
    // Exactly one all-in: the other player is the only one who can act.
    // If they have nothing to call, the street is done; otherwise it is
    // their turn (they may call a raise or fold to it).
    if (this.allIn[0] || this.allIn[1]) {
      var nonAllIn = this.allIn[0] ? 1 : 0;
      if (this.toCall[nonAllIn] === 0) return this.nextStreet();
      this.turn = nonAllIn;
      return { ok: true, phase: this.phase };
    }
    // Round over when both acted and bets are equal.
    if (this.actedThisRound[0] && this.actedThisRound[1] && this.toCall[0] === 0 && this.toCall[1] === 0) {
      return this.nextStreet();
    }
    this.turn = 1 - this.turn;
    return { ok: true, phase: this.phase };
  };

  Game.prototype.nextStreet = function () {
    this.actedThisRound = [false, false];
    this.lastRaiseSize = this.bigBlind;
    this.contributed = [0, 0];
    this.toCall = [0, 0];
    if (this.phase === 'preflop') {
      this.community = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.phase = 'flop';
    } else if (this.phase === 'flop') {
      this.community.push(this.deck.pop());
      this.phase = 'turn';
    } else if (this.phase === 'turn') {
      this.community.push(this.deck.pop());
      this.phase = 'river';
    } else if (this.phase === 'river') {
      return this.doShowdown();
    }
    // Postflop the non-button acts first.
    this.turn = 1 - this.button;
    if (this.allIn[this.turn]) {
      // Non-button all-in: button is the only actor; if button already
      // matched, just deal on — handled by advance() on the next call.
      // For a clean state, if the acting player is all-in, run to showdown
      // only when the other is also all-in (handled above); otherwise the
      // non-all-in player still needs a chance, so give them the turn.
      this.turn = this.button;
    }
    return { ok: true, phase: this.phase };
  };

  Game.prototype.doShowdown = function () {
    var s0 = bestScore(this.hole[0].concat(this.community));
    var s1 = bestScore(this.hole[1].concat(this.community));
    var cmp = compareScore(s0, s1);
    // Pot accounting (including returning any uncalled excess) lives in
    // endHand only — doing it here too would pay the excess twice.
    this.showdown = { scores: [s0, s1], names: [prettyHandName(s0), prettyHandName(s1)], cmp: cmp };
    this.phase = 'showdown';
    return this.endHand(cmp === 0 ? null : (cmp > 0 ? 0 : 1), 'showdown');
  };

  // NOTE on pot accounting: contributed[] resets each street (standard
  // heads-up bookkeeping: "to call" is per-street). The full pot is
  // accumulated in this.potTotal, reset in newHand, added at each street
  // transition. endHand pays from potTotal + the current street's pot.
  Game.prototype.endHand = function (winner, reason) {
    // Collect the current street's contributions into the pot total.
    // (newHand initialises potTotal; nextStreet must bank it first — see
    // the patched nextStreet below via _bankStreet, kept here for clarity.)
    var streetPot = this.contributed[0] + this.contributed[1];
    var total = (this.potTotal || 0) + streetPot;
    // Uncalled excess: in a showdown the winner can only win the matched part.
    if (reason === 'showdown') {
      var eff = Math.min(this.contributed[0], this.contributed[1]);
      // potTotal already holds completed streets (always matched there),
      // so only this street can have an excess.
      var excess0 = this.contributed[0] - eff, excess1 = this.contributed[1] - eff;
      if (excess0 > 0) { this.stacks[0] += excess0; total -= excess0; }
      if (excess1 > 0) { this.stacks[1] += excess1; total -= excess1; }
    }
    if (total > this.biggestPot) this.biggestPot = total;
    if (winner === null) {
      // Split pot: odd chip to the button (house convention, documented).
      var half = Math.floor(total / 2);
      this.stacks[this.button] += total - half;
      this.stacks[1 - this.button] += half;
    } else {
      this.stacks[winner] += total;
      this.handsPlayed[winner]++;
    }
    this.winner = winner;
    this.winningReason = reason;
    this.winningPot = total;
    this.phase = 'handEnd';
    this.potTotal = 0;
    this.contributed = [0, 0];
    return { ok: true, phase: 'handEnd', winner: winner, reason: reason, pot: total };
  };

  // Patch nextStreet to bank the street pot before resetting contributions.
  // (Defined after endHand so both exist; nextStreet above resets
  // contributed, so we wrap it.)
  var _nextStreetOrig = Game.prototype.nextStreet;
  Game.prototype.nextStreet = function () {
    this.potTotal = (this.potTotal || 0) + this.contributed[0] + this.contributed[1];
    return _nextStreetOrig.call(this);
  };
  // newHand must initialise potTotal — wrap it too.
  var _newHandOrig = Game.prototype.newHand;
  Game.prototype.newHand = function () {
    this.potTotal = 0;
    return _newHandOrig.call(this);
  };

  Game.prototype.nextHand = function () {
    if (this.stacks[0] <= 0 || this.stacks[1] <= 0) {
      var mw = this.stacks[0] > 0 ? 0 : 1;
      this.matchWins[mw]++;
      this.phase = 'matchEnd';
      this.matchWinner = mw;
      return { ok: true, phase: 'matchEnd', winner: mw };
    }
    this.button = 1 - this.button;
    this.newHand();
    return { ok: true, phase: this.phase };
  };
  Game.prototype.rematch = function () {
    this.stacks = [this.stackSize, this.stackSize];
    this.button = 0;
    this.handNumber = 0;
    this.newHand();
    return { ok: true, phase: this.phase };
  };

  // Public view for one seat. Hole cards of the opponent are hidden
  // unless the hand reached showdown (then both hands are shown).
  Game.prototype.view = function (seat) {
    var opp = 1 - seat;
    var showOpp = (this.phase === 'showdown' || this.phase === 'handEnd') && this.winningReason === 'showdown';
    return {
      phase: this.phase,
      handNumber: this.handNumber,
      button: this.button,
      stacks: this.stacks.slice(),
      contributed: this.contributed.slice(),
      pot: (this.potTotal || 0) + this.contributed[0] + this.contributed[1],
      community: this.community.map(cardStr),
      myCards: this.hole[seat].map(cardStr),
      oppCards: showOpp ? this.hole[opp].map(cardStr) : [null, null],
      oppCardCount: 2,
      turn: this.turn,
      myTurn: this.turn === seat,
      toCall: this.toCall[seat],
      currentBet: this.currentBet(),
      minRaiseTo: this.minRaiseTo(seat),
      maxRaiseTo: this.maxRaiseTo(seat),
      legal: this.legalActions(seat),
      lastAction: this.lastAction,
      winner: this.winner,
      matchWinner: this.matchWinner || null,
      winningReason: this.winningReason,
      winningPot: this.winningPot,
      showdown: this.showdown ? { names: this.showdown.names, cmp: this.showdown.cmp } : null,
      matchWins: this.matchWins.slice(),
      handsWon: this.handsPlayed.slice(),
      biggestPot: this.biggestPot,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      allIn: this.allIn.slice(),
      folded: this.folded.slice()
    };
  };

  // ---- Simple bot (solo practice only) --------------------------------
  function botAction(game, seat) {
    var call = game.toCall[seat];
    var pot = (game.potTotal || 0) + game.contributed[0] + game.contributed[1];
    var myCards = game.hole[seat];
    var strength = 0;
    if (game.phase === 'preflop') {
      var a = myCards[0], b = myCards[1];
      var hi = Math.max(a.value, b.value), lo = Math.min(a.value, b.value);
      if (a.value === b.value) strength = 0.55 + hi / 40; // pair: 0.60–0.90
      else {
        strength = hi / 28 + (a.suit === b.suit ? 0.06 : 0) + (hi - lo === 1 ? 0.05 : 0);
        if (hi >= 13) strength += 0.12;
      }
    } else {
      var score = bestScore(myCards.concat(game.community));
      strength = 0.15 + score[0] * 0.09 + (score[1] || 0) / 100;
      if (score[0] >= 5) strength += 0.15;
    }
    strength += (game.rand() - 0.5) * 0.15; // a little human wobble
    var legal = game.legalActions(seat);
    if (legal.indexOf('raise') !== -1 && strength > 0.72) {
      var target = Math.min(game.maxRaiseTo(seat), Math.max(game.minRaiseTo(seat), Math.floor(pot * 0.75) + game.currentBet()));
      return { type: 'raise', amount: target };
    }
    if (call === 0) {
      if (strength > 0.45 && legal.indexOf('raise') !== -1 && game.rand() < 0.3) {
        return { type: 'raise', amount: Math.min(game.maxRaiseTo(seat), game.currentBet() + Math.max(game.bigBlind * 2, Math.floor(pot / 2))) };
      }
      return { type: 'check' };
    }
    // Facing a bet: call if the price is reasonable for the strength.
    var price = call / (pot + call + 1);
    if (strength > price + 0.15 || call >= game.stacks[seat]) return { type: 'call' };
    if (game.rand() < 0.15) return { type: 'call' }; // occasional curiosity call
    return { type: 'fold' };
  }

  var api = {
    SUITS: SUITS, RANKS: RANKS, card: card, newDeck: newDeck, shuffle: shuffle,
    eval5: eval5, bestScore: bestScore, compareScore: compareScore,
    prettyHandName: prettyHandName, handName: handName,
    Game: Game, botAction: botAction, cardStr: cardStr
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Poker = api;
})(typeof window !== 'undefined' ? window : globalThis);
