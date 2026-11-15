// keel: src/keel/motion.js (`node test/motion.test.js`), in a fake window
// whose elements record what they're asked to animate.
const assert = require("assert");
const path = require("path");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

const FILE = path.join(__dirname, "../src/keel/motion.js");
function load({ reduced = false, desk = false, linear = true } = {}) {
  const vars = {}, listeners = {}, queries = [];
  const root = { dataset: {}, style: { setProperty: (k, v) => { vars[k] = v; } } };
  global.document = {
    documentElement: root,
    body: { appendChild() {} },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
  global.window = {
    CSS: { supports: (p) => (p === "clip-path" ? true : linear) },
    matchMedia: (q) => { queries.push(q); return { matches: /reduced/.test(q) ? reduced : desk, addEventListener() {} }; },
    addEventListener() {}, removeEventListener() {},
  };
  global.CSS = window.CSS;
  global.matchMedia = window.matchMedia;
  global.innerWidth = 400; global.innerHeight = 800;
  global.getComputedStyle = () => ({ borderTopLeftRadius: "12px" });
  delete require.cache[FILE];
  require(FILE);
  return { Keel: window.Keel.motion, vars, listeners, root, queries };
}
function el(r = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 }) {
  const calls = [];
  return {
    calls, offsetWidth: r.width, style: {}, classList: { add() {}, remove() {} },
    getBoundingClientRect: () => r,
    closest: function () { return this; },
    animate(frames, opts) {
      let cancelled = false;
      const a = { frames, opts, finished: Promise.resolve(), cancel: () => { cancelled = true; }, effect: { getComputedTiming: () => ({ progress: 0.5 }) }, get cancelled() { return cancelled; } };
      calls.push(a);
      return a;
    },
  };
}

(async () => {
  await test("a spring settles at 1 and the edge spring never passes it", () => {
    const { Keel } = load();
    const s = Keel.spring(400, 32), e = Keel.edge(s);
    assert.strictEqual(s.pts[0], 0);
    assert.strictEqual(s.pts[s.pts.length - 1], 1);
    assert.ok(Math.max(...s.pts) > 1, "400/32 overshoots");
    assert.ok(Math.max(...e.pts) <= 1);
    assert.ok(Math.max(...Keel.spring(700, "critical").pts) <= 1.0001, "critically damped doesn't overshoot");
    assert.ok(s.ms > 200 && s.ms < 1000, s.ms + " ms");
    assert.ok(/^linear\(0, /.test(s.curve));
  });

  await test("nothing passed: Waypage's springs, and the CSS variables set", () => {
    const { Keel, vars } = load();
    const M = Keel.create();
    assert.strictEqual(M.springs.touch.sheet.curve, Keel.spring(400, 32).curve);
    assert.strictEqual(M.springs.touch.control.curve, Keel.spring(600, 40).curve);
    assert.strictEqual(M.springs.desktop.sheet.curve, Keel.spring(700, 2 * Math.sqrt(700)).curve);
    assert.strictEqual(vars["--spring-sheet"], M.springs.touch.sheet.curve);
    assert.strictEqual(vars["--spring-sheet-ms"], M.springs.touch.sheet.ms + "ms");
    assert.strictEqual(vars["--spring-control-edge"], M.springs.touch.controlEdge.curve);
  });

  await test("an app's own springs, prefix, and no desktop tier", () => {
    const { Keel, vars, queries } = load({ desk: true });
    const M = Keel.create({ touch: { sheet: [300, 20], control: [500, 30] }, desktop: null, cssPrefix: "--mo" });
    assert.strictEqual(M.desk(), false);
    assert.ok(!queries.some((q) => /min-width/.test(q)));
    assert.strictEqual(vars["--mo-sheet"], Keel.spring(300, 20).curve);
    assert.strictEqual(vars["--spring-sheet"], undefined);
    assert.strictEqual(M.timing("control").easing, Keel.spring(500, 30).curve);
    const { Keel: K2, vars: v2 } = load();
    K2.create({ cssPrefix: null });
    assert.deepStrictEqual(v2, {});
  });

  await test("the desktop tier on a desktop, and the fallback curve without linear()", () => {
    const { Keel } = load({ desk: true });
    const M = Keel.create();
    assert.strictEqual(M.timing("sheet").easing, M.springs.desktop.sheet.curve);
    const { Keel: K2 } = load({ linear: false });
    assert.ok(/^cubic-bezier/.test(K2.create().timing("sheet").easing));
  });

  await test("moves run on their spring; edge moves on the clipped one; busy() counts", async () => {
    const { Keel } = load();
    const M = Keel.create();
    const a = el(), under = el();
    const p = M.push(a, under);
    assert.strictEqual(M.busy(), true);
    await p;
    assert.strictEqual(M.busy(), false);
    assert.strictEqual(a.calls[0].opts.easing, M.springs.touch.sheetEdge.curve);
    assert.strictEqual(under.calls.length, 1, "what's under drifts on touch");
    assert.ok(a.calls[0].cancelled, "the fill is dropped once it's done");
    const b = el();
    await M.sink(b);
    assert.strictEqual(b.calls[0].opts.easing, M.springs.touch.sheet.curve);
  });

  await test("reduced motion: every move is one fade of reducedMs, or nothing", async () => {
    const { Keel } = load({ reduced: true });
    const M = Keel.create({ reducedMs: 90 });
    for (const move of ["push", "rise", "appear", "edgeIn", "slideIn", "dialogIn", "popFrom"]) {
      const a = el(), under = el();
      await M[move](a, under);
      assert.strictEqual(a.calls.length, 1, move);
      assert.deepStrictEqual(a.calls[0].frames, [{ opacity: 0 }, { opacity: 1 }], move);
      assert.strictEqual(a.calls[0].opts.duration, 90, move);
      assert.strictEqual(under.calls.length, 0, move);
    }
    const out = el();
    await M.sink(out);
    assert.deepStrictEqual(out.calls[0].frames, [{ opacity: 1 }, { opacity: 0 }]);
    const s = el();
    await M.settle(s, 40);
    assert.strictEqual(s.calls.length, 0, "a spring back has no fade");
  });

  await test("Animations off: nothing moves, and the end still runs", async () => {
    const { Keel, root } = load();
    const M = Keel.create();
    M.setStill(true);
    assert.strictEqual(root.dataset.motion, "off");
    assert.ok(M.still() && M.reduced());
    const a = el();
    await Promise.all([M.push(a), M.dialogIn(a), M.flip(new Map([[a, { left: 50, top: 0 }]]))]);
    let ended = false;
    await M.shrink(a, { left: 0, top: 0, width: 10, height: 10 }, 16, null, () => { ended = true; });
    assert.strictEqual(a.calls.length, 0);
    assert.ok(ended);
    M.setStill(false);
    assert.strictEqual(root.dataset.motion, undefined);
  });

  await test("press: a dip by pixels, back on the control spring, unwired cleanly", async () => {
    const { Keel, listeners } = load();
    const M = Keel.create();
    const off = M.press("button", { skip: (n) => n.skipMe });
    const b = el({ left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40 });
    listeners.pointerdown[0]({ button: 0, target: b });
    assert.deepStrictEqual(b.calls[0].frames, [{ scale: 1 }, { scale: 0.9 }]);
    listeners.pointerdown[0]({ button: 0, target: el({ width: 400, height: 50 }) });
    assert.ok(b.calls[0].cancelled, "a new press lets the last one go");
    assert.deepStrictEqual(b.calls[1].frames, [{ scale: 0.95 }, { scale: 1 }]);
    assert.strictEqual(b.calls[1].opts.easing, M.springs.touch.control.curve);
    const s = el(); s.skipMe = true;
    listeners.pointerdown[0]({ button: 0, target: s });
    assert.strictEqual(s.calls.length, 0);
    off();
    assert.strictEqual(listeners.pointerdown.length, 0);
  });

  console.log(passed + " passed");
})();
