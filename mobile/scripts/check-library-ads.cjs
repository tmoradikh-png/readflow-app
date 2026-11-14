const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/components/LibraryAds.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

// Exercise the component's hooks with controlled native callbacks, not live ad requests.
function createHarness(options = {}) {
  const slots = [];
  const listeners = new Set();
  const calls = { update: 0, form: 0, info: 0, initialize: 0, privacy: 0, config: null };
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  let available = options.available !== false;
  let info = { canRequestAds: options.allowed !== false, privacyOptionsRequirementStatus: 'REQUIRED' };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      slots[index] ||= { value: initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(value) {
      const index = cursor++;
      slots[index] ||= { current: value };
      return slots[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          slots[index].cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };
  const modules = {
    react: React,
    'react-native': {
      AppState: { currentState: 'active', addEventListener: (_name, listener) => {
        listeners.add(listener); return { remove: () => listeners.delete(listener) };
      } },
      Linking: { openURL: async () => {} },
      Platform: { OS: options.platform || 'android' },
      Pressable: 'Pressable', Text: 'Text', View: 'View',
    },
    'expo-constants': { expoConfig: { extra: { adsTestMode: false, admobBannerId: 'live-unit' } } },
    '../theme': { useAppTheme: () => ({ colors: {}, fonts: {} }) },
    'react-native-google-mobile-ads': {
      __esModule: true,
      default: () => ({
        setRequestConfiguration: async config => { calls.config = config; },
        initialize: async () => {
          calls.initialize++;
          if (options.initError && calls.initialize === 1) throw new Error('SDK unavailable');
        },
        setAppMuted: () => {},
      }),
      AdsConsent: {
        requestInfoUpdate: async () => {
          calls.update++;
          if (options.updateError) throw new Error('Offline');
          if (options.updateWait) await options.updateWait;
          return info;
        },
        loadAndShowConsentFormIfRequired: async () => {
          calls.form++;
          if (options.formError) throw new Error('Form unavailable');
        },
        getConsentInfo: async () => {
          calls.info++;
          if (options.infoError) throw new Error('No consent state');
          return info;
        },
        showPrivacyOptionsForm: async () => { calls.privacy++; info = { ...info, canRequestAds: false }; },
      },
      AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
      BannerAd: 'BannerAd', BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'adaptive' },
      MaxAdContentRating: { PG: 'PG' }, TestIds: { BANNER: 'test-banner' },
    },
  };
  const module = { exports: {} };
  new Function('exports', 'module', 'require', '__DEV__', compiled)(
    module.exports, module, id => {
      assert.ok(id in modules, `Unexpected import: ${id}`);
      return modules[id];
    }, false,
  );
  function render() {
    cursor = 0; dirty = false; effects = [];
    tree = module.exports.LibraryAds({ available });
    effects.forEach(effect => effect());
  }
  async function flush() {
    for (let i = 0; i < 24; i++) { if (dirty) render(); await Promise.resolve(); }
    assert.equal(dirty, false, 'Component settles within the bounded microtask run');
  }
  function find(type, node = tree) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type) return node;
    return (node.children || []).flat(Infinity).map(child => find(type, child)).find(Boolean);
  }
  return {
    calls, flush, find,
    layout(width) { find('View')?.props.onLayout({ nativeEvent: { layout: { width } } }); },
    state(value) { listeners.forEach(listener => listener(value)); },
    available(value) { available = value; dirty = true; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

(async () => {
  for (const options of [{ allowed: false }, { allowed: false, updateError: true }, { infoError: true }, { available: false }]) {
    const h = createHarness(options);
    await h.flush(); h.layout(320); await h.flush();
    assert.equal(h.find('BannerAd'), undefined);
    assert.equal(h.calls.initialize, 0, 'No SDK initialization without SDK permission');
    h.unmount();
  }
  for (const options of [{}, { updateError: true }, { formError: true }]) {
    const h = createHarness(options);
    await h.flush();
    assert.equal(h.find('BannerAd'), undefined, 'Wait for measured width');
    h.layout(319.9); await h.flush();
    const ad = h.find('BannerAd');
    assert.equal(ad.props.width, 319);
    assert.equal(ad.props.size, 'adaptive');
    assert.equal(h.calls.config.maxAdContentRating, 'PG');
    assert.equal(ad.props.onAdFailedToLoad, undefined, 'No failure callback unmounts the native banner');
    await h.flush();
    assert.equal(h.find('BannerAd').props.key, ad.props.key);
    h.state('background'); await h.flush();
    assert.equal(h.find('BannerAd'), undefined);
    h.state('active'); await h.flush();
    assert.ok(h.find('BannerAd'));
    h.layout(680); await h.flush();
    assert.equal(h.find('BannerAd').props.width, 680);
    h.available(false); await h.flush();
    assert.equal(h.find('BannerAd'), undefined);
    h.unmount();
  }
  const privacy = createHarness();
  await privacy.flush(); privacy.layout(320); await privacy.flush();
  const pendingPrivacy = privacy.find('Pressable').props.onPress();
  await privacy.flush(); await pendingPrivacy; await privacy.flush();
  assert.equal(privacy.calls.privacy, 1);
  assert.equal(privacy.find('BannerAd'), undefined, 'Revoked permission removes the ad');
  privacy.unmount();

  let resolveUpdate;
  const pending = createHarness({ updateWait: new Promise(resolve => { resolveUpdate = resolve; }) });
  await pending.flush(); pending.state('background'); await pending.flush();
  resolveUpdate(); await pending.flush();
  assert.equal(pending.calls.form, 0, 'No late form after backgrounding');
  assert.equal(pending.calls.initialize, 0);
  pending.unmount();

  const retry = createHarness({ initError: true });
  await retry.flush(); retry.layout(320); await retry.flush();
  assert.equal(retry.find('BannerAd'), undefined);
  retry.state('background'); await retry.flush(); retry.state('active'); await retry.flush();
  assert.ok(retry.find('BannerAd'), 'A later lifecycle can retry failed SDK initialization');
  retry.unmount();
  assert.doesNotMatch(source, /setInterval|setTimeout|\.load\(/, 'No competing JS ad refresh loop');
  console.log('Library ad regression checks passed (mocked native SDK; no device/ad/revenue verification).');
})().catch(error => { console.error(error); process.exitCode = 1; });
