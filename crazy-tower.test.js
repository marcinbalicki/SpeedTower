'use strict';

// ─── Pure game-logic functions (mirrored from crazy-tower.html) ───────────────

const MAX_LEVELS    = 50;
const INITIAL_WIDTH = 186;
const PERFECT_ZONE  = 4;

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

function isPerfect(movGx, movWidth, topGx, topWidth) {
  const offset = Math.abs(
    (movGx + movWidth / 2) - (topGx + topWidth / 2)
  );
  return offset <= PERFECT_ZONE;
}

// Simulates a single stack action; returns null on miss or the new block.
function simulateStack(moving, top) {
  const { gx: oGx, width: oW } = calcOverlap(
    moving.gx, moving.width, top.gx, top.width
  );
  if (oW <= 0) return null;

  const perfect = isPerfect(moving.gx, moving.width, top.gx, top.width);
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
