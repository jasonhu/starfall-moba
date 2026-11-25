#!/usr/bin/env node
/**
 * 浏览器全局 stub（Node 里加载内核用）
 * -----------------------------------
 * 内核顶层会创建 HUD DOM、注册 AudioContext 等，Node 环境需要这些替身。
 * 由 tools/engine-smoke.cjs 与 tools/check-vfx-templates.cjs 共用。
 * 注意：只提供「能跑起来」的最小面，不做任何真实渲染。
 */
function installDomStub() {
  const noop = () => {}
  const fakeEl = () => {
    const el = {
      style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      addEventListener: noop, removeEventListener: noop, appendChild: noop, insertBefore: noop,
      removeChild: noop, replaceChild: noop, cloneNode: () => fakeEl(),
      setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
      querySelector: () => fakeEl(), querySelectorAll: () => [],
      getContext: () => null, focus: noop, blur: noop, click: noop,
      innerHTML: '', outerHTML: '', textContent: '', value: '', dataset: {},
      children: [], childNodes: [], parentNode: null, firstChild: null,
      ownerDocument: null, width: 800, height: 600, offsetWidth: 800, offsetHeight: 600,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
    }
    return el
  }
  global.document = {
    createElement: fakeEl, createElementNS: fakeEl, createTextNode: () => fakeEl(),
    getElementById: () => fakeEl(), querySelector: () => fakeEl(), querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop,
    body: fakeEl(), head: fakeEl(), documentElement: fakeEl(), hidden: false,
  }
  global.window = {
    addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 720,
    location: { href: 'http://localhost/', search: '', hash: '' },
    setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a),
    setInterval: (...a) => setInterval(...a), clearInterval: (...a) => clearInterval(...a),
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
  }
  global.location = { href: 'http://localhost/', search: '', hash: '', protocol: 'http:', host: 'localhost' }
  global.navigator = { userAgent: 'node-engine-smoke' }
  global.HTMLCanvasElement = class {}
  global.HTMLImageElement = class {}
  global.Image = class {}
  global.self = global
  global.requestAnimationFrame = () => 0
  global.cancelAnimationFrame = noop
  global.AudioContext = global.webkitAudioContext = class {
    constructor() { this.destination = {}; this.currentTime = 0; this.state = 'running' }
    createGain() { return { gain: { value: 1, setValueAtTime: noop, linearRampToValueAtTime: noop }, connect: noop } }
    createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime: noop }, connect: noop, start: noop, stop: noop } }
    createBuffer() { return { getChannelData: () => new Float32Array(1) } }
    createBufferSource() { return { buffer: null, connect: noop, start: noop, stop: noop } }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: noop } }
    createConvolver() { return { buffer: null, connect: noop } }
    resume() { return Promise.resolve() }
  }
}

module.exports = { installDomStub }
