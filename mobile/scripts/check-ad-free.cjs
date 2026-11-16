const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, modules, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', '__DEV__', ...Object.keys(globals), code)(module, module.exports,
    name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; }, false, ...Object.values(globals));
  return module.exports;
}
const policy = load('src/services/InterstitialPolicy.ts', {});
const now = Date.UTC(2026, 10, 16, 12);
const empty = { day: '', count: 0, lastShown: 0 };
assert.equal(policy.canShowBookCloseAd(empty, now, 599999), false);
assert.equal(policy.canShowBookCloseAd(empty, now, 600000), true);
const first = policy.recordBookCloseAd(empty, now);
assert.equal(policy.canShowBookCloseAd(first, now + 1199999, 600000), false);
const second = policy.recordBookCloseAd(first, now + 1200000);
assert.equal(policy.canShowBookCloseAd(second, now + 7200000, 600000), false);
assert.equal(policy.canShowBookCloseAd(second, now + 86400000, 600000), true);
assert.equal(policy.canShowBookCloseAd(first, now - 1, 600000), false);

function interstitialHarness() {
  let time = now;
  const state = { currentState: 'active' };
  const ads = [];
  const stored = [];
  class Clock extends Date { static now() { return time; } }
  const { libraryInterstitial: service } = load('src/services/LibraryInterstitial.ts', {
    'react-native': { AppState: state, Platform: { OS: 'android' } },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async (...args) => { stored.push(args); } },
    'expo-constants': { expoConfig: { extra: { adsTestMode: true } } },
    './InterstitialPolicy': policy,
    'react-native-google-mobile-ads': {
      AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed' }, TestIds: { INTERSTITIAL: 'test' },
      InterstitialAd: { createForAdRequest: unit => {
        assert.equal(unit, 'test');
        const listeners = {};
        const ad = { shown: 0, loaded: 0, listeners,
          addAdEventListener: (event, fn) => { listeners[event] = fn; return () => delete listeners[event]; },
          load: () => { ad.loaded++; }, show: async () => { ad.shown++; } };
        ads.push(ad); return ad;
      } },
    },
  }, { Date: Clock });
  return { service, ads, stored, state, advance: ms => { time += ms; } };
}

function billingHarness() {
  let cursor = 0, dirty = true, effects = [], value, answer = { active: false, pending: false };
  let billingError = false;
  const slots = [], callbacks = {}, gates = [];
  const React = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props) => { if (type === 'Provider') value = props.value; },
    useRef: initial => { const n = cursor++; return slots[n] ||= { current: initial }; },
    useState: initial => { const n = cursor++; slots[n] ||= { value: initial }; return [slots[n].value, next => {
      slots[n].value = typeof next === 'function' ? next(slots[n].value) : next; dirty = true;
    }]; },
    useCallback: fn => { const n = cursor++; return slots[n] ||= fn; },
    useEffect: fn => { const n = cursor++; if (!slots[n]) { slots[n] = {}; effects.push(() => { slots[n].cleanup = fn(); }); } },
  };
  const billing = { status: async () => { if (billingError) throw new Error('offline'); return answer; },
    products: async () => [], purchase: async () => { answer = { active: true, pending: false }; return 'active'; } };
  const { AdFreeProvider } = load('src/services/AdFree.tsx', {
    react: React,
    'react-native': { Platform: { OS: 'android' }, NativeModules: { ReadFlowAdFree: billing },
      AppState: { currentState: 'active', addEventListener: (_e, fn) => { callbacks.foreground = fn; return { remove() {} }; } },
      NativeEventEmitter: class { addListener(_e, fn) { callbacks.purchase = fn; return { remove() {} }; } } },
    './LibraryInterstitial': { libraryInterstitial: { setFreeUser: v => gates.push(v), pauseRequests: () => gates.push(false) } },
  }, { setInterval: () => 1, clearInterval: () => {} });
  async function flush() {
    for (let n = 0; n < 30; n++) {
      if (dirty) { cursor = 0; effects = []; dirty = false; AdFreeProvider({ children: null }); effects.forEach(fn => fn()); }
      await Promise.resolve();
    }
  }
  return { flush, get value() { return value; }, answer(v) { answer = v; }, error(v) { billingError = v; },
    callbacks, gates, close() { slots.forEach(slot => slot.cleanup?.()); } };
}

(async () => {
  const h = interstitialHarness();
  h.service.prepare(); assert.equal(h.ads.length, 0, 'No request before entitlement and consent');
  h.service.setFreeUser(true); h.service.prepare(); assert.equal(h.ads.length, 0);
  h.service.setConsent(true); h.service.prepare(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.ads.length, 1);
  assert.equal(h.service.showAfterBookClose(600000, () => true), false, 'Not loaded: skip, never queue');
  h.ads[0].listeners.loaded();
  assert.equal(h.service.showAfterBookClose(600000, () => false), false, 'Reader/modal guard');
  h.state.currentState = 'background';
  assert.equal(h.service.showAfterBookClose(600000, () => true), false);
  h.state.currentState = 'active';
  assert.equal(h.service.showAfterBookClose(600000, () => true), true);
  assert.equal(h.service.showAfterBookClose(600000, () => true), false, 'No double presentation');
  assert.equal(h.ads[0].shown, 1);
  h.ads[0].listeners.closed(); h.service.prepare(); h.ads[1].listeners.loaded();
  assert.equal(h.service.showAfterBookClose(600000, () => true), false, 'Cooldown');
  h.advance(1200000); h.service.setFreeUser(false);
  assert.equal(h.service.showAfterBookClose(600000, () => true), false, 'Subscription clears loaded ads');
  h.service.prepare(); assert.equal(h.ads.length, 2, 'Subscribers never preload');
  assert.equal(h.stored.length, 1);

  const b = billingHarness(); await b.flush();
  assert.equal(b.value.canShowAds, true);
  b.answer({ active: true, pending: false }); await b.value.refresh(); await b.flush();
  assert.equal(b.value.status, 'active'); assert.equal(b.value.canShowAds, false);
  b.error(true); await b.value.refresh(); await b.flush();
  assert.equal(b.value.status, 'unavailable'); assert.equal(b.value.canShowAds, false, 'Errors never expose subscribers to ads');
  b.error(false); b.answer({ active: false, pending: true }); await b.value.refresh(); await b.flush();
  assert.equal(b.value.pending, true); assert.equal(b.value.status, 'free', 'Pending does not grant paid entitlement');
  await b.value.purchase('monthly'); await b.flush(); assert.equal(b.value.status, 'active');
  b.answer({ active: false, pending: false }); b.callbacks.foreground('active'); await b.flush();
  assert.equal(b.value.status, 'free', 'Expired subscription updates on foreground'); b.close();
  console.log('Ad-free and interstitial policy/controller checks passed with mocked Play/AdMob; no device billing test.');
})().catch(error => { console.error(error); process.exitCode = 1; });
