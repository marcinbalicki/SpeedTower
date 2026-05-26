'use strict';

// ─── Pure game-logic functions (mirrored from crazy-tower.html) ───────────────

const MAX_LEVELS    = 50;
const INITIAL_WIDTH = 130;
const PERFECT_ZONE  = 4;
const MIN_DIMENSION = 50;

function calcOverlap(movGx, movWidth, topGx, topWidth) {
  const oL = Math.max(movGx, topGx);
  const oR = Math.min(movGx + movWidth, topGx + topWidth);
  return { gx: oL, width: oR - oL };
}

function blockSpeed(level) {
  return 2.4 + level * 0.17;
}

function blockHue(level) {
  return (level * 19 + 195) % 360;
}

function getLevel(score) {
  return Math.min(score + 1, MAX_LEVELS);
}

function getDir(blocksLength) {
  return blocksLength % 2 === 1 ? 1 : -1;
}

// Simulates a single stack action; mirrors doStack() logic from crazy-tower.html.
// Uses gx/width as the axis being checked (works for both x and z axes).
// Returns null on miss, or the new block { gx, width }.
function simulateStack(moving, top) {
  const { gx: oGx, width: oW } = calcOverlap(moving.gx, moving.width, top.gx, top.width);
  if (oW <= 0) return null;

  const off = Math.abs((moving.gx + moving.width / 2) - (top.gx + top.width / 2));
  const perfect = off <= PERFECT_ZONE;

  // Exit side only: miss if less than half the block is still over the base.
  // Entry side (moving.gx < top.gx): any overlap is valid — always slices.
  if (!perfect && moving.gx >= top.gx && oW < moving.width / 2) return null;

  return {
    gx:    perfect ? top.gx    : oGx,
    width: perfect ? top.width : oW,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calcOverlap — geometry', () => {
  test('perfect alignment returns full block', () => {
    const r = calcOverlap(-50, 100, -50, 100);
    expect(r.gx).toBe(-50);
    expect(r.width).toBe(100);
  });

  test('moving block shifted right by 30 — overlap 70', () => {
    const r = calcOverlap(-20, 100, -50, 100);
    // moving: -20..80   top: -50..50   overlap: -20..50 => 70
    expect(r.gx).toBe(-20);
    expect(r.width).toBe(70);
  });

  test('moving block shifted left by 30 — overlap 70', () => {
    const r = calcOverlap(-80, 100, -50, 100);
    // moving: -80..20   top: -50..50   overlap: -50..20 => 70
    expect(r.gx).toBe(-50);
    expect(r.width).toBe(70);
  });

  test('total miss to the right returns non-positive width', () => {
    const r = calcOverlap(60, 100, -50, 100);
    // moving: 60..160   top: -50..50   overlap: 60..50 => -10
    expect(r.width).toBeLessThanOrEqual(0);
  });

  test('total miss to the left returns non-positive width', () => {
    const r = calcOverlap(-160, 100, -50, 100);
    // moving: -160..-60   top: -50..50   overlap: -50..-60 => -10
    expect(r.width).toBeLessThanOrEqual(0);
  });

  test('touching edge — zero-width overlap', () => {
    // moving right edge exactly meets top left edge
    const r = calcOverlap(-150, 100, -50, 100);
    // moving: -150..-50   top: -50..50   overlap: -50..-50 => 0
    expect(r.width).toBe(0);
  });

  test('moving block wider than top — clips to top width', () => {
    const r = calcOverlap(-90, 200, -50, 100);
    // overlap: -50..50 => 100 (fully contained)
    expect(r.gx).toBe(-50);
    expect(r.width).toBe(100);
  });
});

describe('simulateStack — game result', () => {
  test('perfect alignment → block kept at full width', () => {
    const top = { gx: -50, width: 100 };
    const mov = { gx: -50, width: 100 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(100);
    expect(result.gx).toBe(-50);
  });

  test('near-perfect (within zone) → full width preserved', () => {
    const top = { gx: -50, width: 100 };
    const mov = { gx: -48, width: 100 }; // center offset = 2, within PERFECT_ZONE=4
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(100);
  });

  test('outside perfect zone → block is trimmed', () => {
    const top = { gx: -50, width: 100 };
    const mov = { gx: -40, width: 100 }; // center offset = 5 > PERFECT_ZONE
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBeLessThan(100);
  });

  test('miss returns null', () => {
    const top = { gx: -50, width: 100 };
    const mov = { gx: 60,  width: 100 };
    expect(simulateStack(mov, top)).toBeNull();
  });
});

describe('Tower shrinkage', () => {
  test('each off-center stack reduces width by the shift amount', () => {
    let block = { gx: -INITIAL_WIDTH / 2, width: INITIAL_WIDTH };
    const shift = 15;
    for (let i = 0; i < 5; i++) {
      const mov = { gx: block.gx + shift, width: block.width };
      block = simulateStack(mov, block);
      expect(block).not.toBeNull();
    }
    expect(block.width).toBe(INITIAL_WIDTH - 5 * shift);
  });

  test('ten perfect stacks keep original width', () => {
    let block = { gx: -INITIAL_WIDTH / 2, width: INITIAL_WIDTH };
    for (let i = 0; i < 10; i++) {
      const mov = { gx: block.gx, width: block.width };
      block = simulateStack(mov, block);
    }
    expect(block.width).toBe(INITIAL_WIDTH);
  });

  test('block width is always positive after a non-miss stack', () => {
    let block = { gx: -50, width: 100 };
    for (let i = 0; i < 8; i++) {
      const shift = 10;
      const mov = { gx: block.gx + shift, width: block.width };
      const next = simulateStack(mov, block);
      if (next === null) break;
      expect(next.width).toBeGreaterThan(0);
      block = next;
    }
  });
});

describe('Speed scaling', () => {
  test('starts at 2.4 at level 0', () => {
    expect(blockSpeed(0)).toBeCloseTo(2.4);
  });

  test('strictly increases with level', () => {
    for (let i = 1; i < MAX_LEVELS; i++) {
      expect(blockSpeed(i)).toBeGreaterThan(blockSpeed(i - 1));
    }
  });

  test('max speed at level 49 is ~10.73', () => {
    expect(blockSpeed(49)).toBeCloseTo(2.4 + 49 * 0.17, 5);
  });

  test('speed never exceeds a sane upper bound', () => {
    expect(blockSpeed(MAX_LEVELS - 1)).toBeLessThan(20);
  });
});

describe('Level / HUD helpers', () => {
  test('level display is score + 1', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(1)).toBe(2);
    expect(getLevel(30)).toBe(31);
  });

  test('level display caps at MAX_LEVELS', () => {
    expect(getLevel(49)).toBe(50);
    expect(getLevel(50)).toBe(50);
    expect(getLevel(99)).toBe(50);
  });

  test('win condition: score >= MAX_LEVELS', () => {
    expect(50 >= MAX_LEVELS).toBe(true);
    expect(49 >= MAX_LEVELS).toBe(false);
  });
});

describe('Block direction alternation', () => {
  test('first moving block comes from the left (dir +1)', () => {
    expect(getDir(1)).toBe(1);
  });

  test('second moving block comes from the right (dir -1)', () => {
    expect(getDir(2)).toBe(-1);
  });

  test('directions strictly alternate for 50 levels', () => {
    let prev = getDir(1);
    for (let i = 2; i <= MAX_LEVELS; i++) {
      const cur = getDir(i);
      expect(cur).toBe(-prev);
      prev = cur;
    }
  });
});

describe('Color cycling', () => {
  test('hue is always in [0, 360)', () => {
    for (let i = 0; i < MAX_LEVELS; i++) {
      const h = blockHue(i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  test('consecutive levels have different hues', () => {
    for (let i = 0; i < MAX_LEVELS - 1; i++) {
      expect(blockHue(i)).not.toBe(blockHue(i + 1));
    }
  });

  test('hue cycles — level 0 and 360/gcd differ', () => {
    const h0 = blockHue(0);
    // After enough levels the hue should wrap; just check it stays bounded
    const hN = blockHue(MAX_LEVELS - 1);
    expect(hN).toBeGreaterThanOrEqual(0);
    expect(hN).toBeLessThan(360);
    // They should differ (19 and 360 are coprime so all 50 hues are unique)
    expect(h0).not.toBe(hN);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Build a moving block whose FRONT edge is exactly `frontOffset` units past
// the near edge of `top` (positive = inside, negative = still outside).
function movingAtEntry(top, blockWidth, frontOffset) {
  return { gx: top.gx - blockWidth + frontOffset, width: blockWidth };
}

// Build a moving block whose BACK edge is exactly `backOffset` units past
// the near edge of `top` (used for Phase-3 / exit-side positions).
function movingAtExit(top, blockWidth, backOffset) {
  return { gx: top.gx + backOffset, width: blockWidth };
}

describe('Entry phase — block arriving at near edge (130-unit blocks)', () => {
  // Base block: spans [-65, 65], centre at 0.
  const top = { gx: -65, width: 130 };
  const W   = 130;

  test('block not yet touching near edge → miss (oW = 0)', () => {
    expect(simulateStack(movingAtEntry(top, W, -1), top)).toBeNull();
  });

  test('front exactly at near edge → miss (oW = 0)', () => {
    expect(simulateStack(movingAtEntry(top, W, 0), top)).toBeNull();
  });

  test('1 unit past near edge → slice, width = 1 (any entry overlap is valid)', () => {
    const result = simulateStack(movingAtEntry(top, W, 1), top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(1);
    expect(result.gx).toBe(top.gx);
  });

  test('64 units past near edge → slice, width = 64', () => {
    const result = simulateStack(movingAtEntry(top, W, 64), top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(64);
    expect(result.gx).toBe(top.gx);
  });

  test('65 units past near edge → slice, width = 65 (half the block)', () => {
    const mov = movingAtEntry(top, W, 65);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.gx).toBe(-65);
    expect(result.width).toBe(65);
  });

  test('66 units past near edge → slice, width = 66', () => {
    const mov = movingAtEntry(top, W, 66);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(66);
    expect(result.gx).toBe(-65);
  });

  test('95 units past near edge → chop, width = 95', () => {
    // moving spans [-100, 30], overlap [-65, 30] = 95
    const mov = movingAtEntry(top, W, 95);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(95);
    expect(result.gx).toBe(-65);
  });

  test('125 units past near edge → chop, width = 125 (off = 5, just outside perfect zone)', () => {
    // moving spans [-70, 60], overlap [-65, 60] = 125, off = 5
    const mov = movingAtEntry(top, W, 125);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(125);
  });

  test('126 units past near edge → perfect snap (off = 4 = PERFECT_ZONE)', () => {
    // centre = -4, off = 4
    const mov = movingAtEntry(top, W, 126);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(W);   // full width — snapped to perfect
    expect(result.gx).toBe(top.gx);
  });

  test('result gx is always top.gx during entry phase (back part fell off)', () => {
    // For any valid entry chop, the stacked block is anchored at the near edge
    for (const offset of [65, 80, 100, 115, 125]) {
      const result = simulateStack(movingAtEntry(top, W, offset), top);
      if (result && result.width < W) {   // exclude perfect snaps
        expect(result.gx).toBe(top.gx);
      }
    }
  });
});

describe('Exit phase — block departing past far edge (130-unit blocks)', () => {
  const top = { gx: -65, width: 130 };
  const W   = 130;

  test('back at near edge = perfect position (off = 0)', () => {
    const mov = movingAtExit(top, W, 0);   // moving.gx = -65
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(W);
    expect(result.gx).toBe(top.gx);
  });

  test('back 4 units past near edge → perfect snap (off = 4)', () => {
    const mov = movingAtExit(top, W, 4);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(W);
  });

  test('back 5 units past near edge → chop, front piece falls (off = 5)', () => {
    // overlap = top.gx+top.width - moving.gx = 65 - (-60) = 125
    const mov = movingAtExit(top, W, 5);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(125);
    expect(result.gx).toBe(top.gx + 5);   // anchored at moving block's back
  });

  test('back 50 units past near edge → chop, oW = 80', () => {
    // overlap = 65 - (-15) = 80
    const mov = movingAtExit(top, W, 50);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(80);
    expect(result.gx).toBe(top.gx + 50);
  });

  test('back 64 units past near edge → oW = 66 > W/2(65), still valid', () => {
    // oW = 65 - (-65+64) = 65 - (-1) = 66
    const mov = movingAtExit(top, W, 64);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(66);
  });

  test('back 65 units past near edge → oW = 65 = W/2, still valid (boundary)', () => {
    const mov = movingAtExit(top, W, 65);
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(65);
  });

  test('back 66 units past near edge → oW = 64 < W/2(65) → miss', () => {
    const mov = movingAtExit(top, W, 66);
    expect(simulateStack(mov, top)).toBeNull();
  });

  test('result gx tracks moving block back during exit phase', () => {
    for (const backOffset of [5, 20, 40, 60, 79]) {
      const mov = movingAtExit(top, W, backOffset);
      const result = simulateStack(mov, top);
      if (result && result.width < W) {
        expect(result.gx).toBe(top.gx + backOffset);
      }
    }
  });
});

describe('Shrunk block — entry always slices, exit uses W/2 rule', () => {
  const top = { gx: -40, width: 80 };  // centre at 0
  const W   = 80;

  test('entry: 1 unit past near edge → slice, width = 1', () => {
    const result = simulateStack(movingAtEntry(top, W, 1), top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(1);
  });

  test('entry: 39 units in → slice, width = 39', () => {
    const result = simulateStack(movingAtEntry(top, W, 39), top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(39);
  });

  test('entry: exactly 50% in → slice, width = 40', () => {
    const result = simulateStack(movingAtEntry(top, W, 40), top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(40);
  });

  test('exit: back 40 units past → oW = 40 = W/2 → still valid', () => {
    expect(simulateStack(movingAtExit(top, W, 40), top)).not.toBeNull();
  });

  test('exit: back 41 units past → oW = 39 < W/2 → miss', () => {
    expect(simulateStack(movingAtExit(top, W, 41), top)).toBeNull();
  });
});

describe('Early-press / late-press miss rules', () => {
  // Base block centred at 0: spans [-65, 65], width=130.
  const top = { gx: -65, width: 130 };

  // ── Early-press (entering from the near/left side) ──────────────────────────

  test('1 unit past near edge → slice (entry side always slices)', () => {
    // moving.gx = -194, oW = 1
    const mov = { gx: -194, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(1);
    expect(result.gx).toBe(-65);
  });

  test('center exactly at near edge → slice, width = 65', () => {
    // moving.gx = -130, oW = 65
    const mov = { gx: -130, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(65);
    expect(result.gx).toBe(-65);
  });

  test('center 1 unit past near edge → slice, width = 66', () => {
    const mov = { gx: -129, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(66);
    expect(result.gx).toBe(-65);
  });

  test('well inside but not perfect → chop with back cut', () => {
    // moving spans [-100, 30], top spans [-65, 65]
    // overlap: [-65, 30] → oW = 95
    const mov = { gx: -100, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(95);
    expect(result.gx).toBe(-65);
  });

  // ── Late-press (exiting from the far/right side, Phase 3) ───────────────────

  test('block shifted right — front hangs off far edge, back inside → chop', () => {
    // moving.gx = -40  →  spans [-40, 90], oW = 65 − (−40) = 105
    const mov = { gx: -40, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.gx).toBe(-40);    // starts where moving block's back is
    expect(result.width).toBe(105); // front piece falls off
  });

  test('overlap exactly at W/2 → still a valid chop', () => {
    // oW = 65 = W/2: moving.gx = top.gx + top.width - 65 = 0
    // moving spans [0, 130], overlap [0, 65] = 65
    const mov = { gx: 0, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(65);
  });

  test('overlap one unit below W/2 → miss (pressed too late)', () => {
    // oW = 64: moving.gx = 1
    const mov = { gx: 1, width: 130 };
    expect(simulateStack(mov, top)).toBeNull();
  });

  // ── Perfect zone ─────────────────────────────────────────────────────────────

  test('center offset exactly at PERFECT_ZONE → perfect (full block)', () => {
    // off = 4: moving centre = 4  →  moving.gx = 4 - 65 = -61
    const mov = { gx: -61, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(130);
    expect(result.gx).toBe(-65);
  });

  test('center offset one unit outside PERFECT_ZONE → chop, not perfect', () => {
    // off = 5: moving centre = 5  →  moving.gx = 5 - 65 = -60
    // oW = min(-60+130, 65) − max(-60, -65) = min(70,65)−(−60) = 65+60 = 125
    const mov = { gx: -60, width: 130 };
    const result = simulateStack(mov, top);
    expect(result).not.toBeNull();
    expect(result.width).toBe(125);     // 5-unit back piece cut
    expect(result.width).toBeLessThan(130);
  });

  // ── Symmetry with shrunk blocks ──────────────────────────────────────────────

  test('same rules apply after block has been shrunk by a previous chop', () => {
    // Simulate one chop: top is now narrower
    const smallTop = { gx: -40, width: 80 }; // centre=0, spans [-40,40]

    // Early press: centre of 80-wide mover must reach top.gx=-40
    // too-early: moving.gx=-121, centre=-121+40=-81 < -40 → miss
    const tooEarly = { gx: -121, width: 80 };
    expect(simulateStack(tooEarly, smallTop)).toBeNull();

    // valid: moving.gx=-80, oW=40 = W/2 → chop
    // moving spans [-80, 0], top spans [-40, 40], overlap [-40, 0] = 40
    const valid = { gx: -80, width: 80 };
    const result = simulateStack(valid, smallTop);
    expect(result).not.toBeNull();
    expect(result.width).toBe(40);  // exactly half the block over base
  });
});

describe('Progress bar math', () => {
  test('0 blocks → 0%', () => {
    expect(Math.round((0 / MAX_LEVELS) * 100)).toBe(0);
  });

  test('25 blocks → 50%', () => {
    expect(Math.round((25 / MAX_LEVELS) * 100)).toBe(50);
  });

  test('50 blocks → 100%', () => {
    expect(Math.round((50 / MAX_LEVELS) * 100)).toBe(100);
  });
});
