var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
(async () => {
  var _t2, _e2, _r2, _a;
  (function() {
    const e = document.createElement("link").relList;
    if (e && e.supports && e.supports("modulepreload")) return;
    for (const s of document.querySelectorAll('link[rel="modulepreload"]')) n(s);
    new MutationObserver((s) => {
      for (const u of s) if (u.type === "childList") for (const d of u.addedNodes) d.tagName === "LINK" && d.rel === "modulepreload" && n(d);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function t(s) {
      const u = {};
      return s.integrity && (u.integrity = s.integrity), s.referrerPolicy && (u.referrerPolicy = s.referrerPolicy), s.crossOrigin === "use-credentials" ? u.credentials = "include" : s.crossOrigin === "anonymous" ? u.credentials = "omit" : u.credentials = "same-origin", u;
    }
    function n(s) {
      if (s.ep) return;
      s.ep = true;
      const u = t(s);
      fetch(s.href, u);
    }
  })();
  const Qa = "modulepreload", Ma = function(a) {
    return "/component-ui/" + a;
  }, lr = {}, Xe = function(e, t, n) {
    let s = Promise.resolve();
    if (t && t.length > 0) {
      document.getElementsByTagName("link");
      const d = document.querySelector("meta[property=csp-nonce]"), f = (d == null ? void 0 : d.nonce) || (d == null ? void 0 : d.getAttribute("nonce"));
      s = Promise.allSettled(t.map((b) => {
        if (b = Ma(b), b in lr) return;
        lr[b] = true;
        const o = b.endsWith(".css"), r = o ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${b}"]${r}`)) return;
        const i = document.createElement("link");
        if (i.rel = o ? "stylesheet" : Qa, o || (i.as = "script"), i.crossOrigin = "", i.href = b, f && i.setAttribute("nonce", f), document.head.appendChild(i), o) return new Promise((m, w) => {
          i.addEventListener("load", m), i.addEventListener("error", () => w(new Error(`Unable to preload CSS for ${b}`)));
        });
      }));
    }
    function u(d) {
      const f = new Event("vite:preloadError", {
        cancelable: true
      });
      if (f.payload = d, window.dispatchEvent(f), !f.defaultPrevented) throw d;
    }
    return s.then((d) => {
      for (const f of d || []) f.status === "rejected" && u(f.reason);
      return e().catch(u);
    });
  };
  let mr = 0;
  const yr = Symbol.dispose || Symbol.for("dispose"), Fa = class {
    constructor(e) {
      this.msg = e;
    }
    toDebugString() {
      return this.msg;
    }
  };
  let Ua = class {
    constructor(e) {
      e || console.trace("no handler"), this.id = ++mr, this.handler = e;
    }
    read(e) {
      return this.handler.read ? this.handler.read(e) : this.handler.blockingRead.call(this, e);
    }
    blockingRead(e) {
      return this.handler.blockingRead.call(this, e);
    }
    skip(e) {
      if (this.handler.skip) return this.handler.skip.call(this, e);
      if (this.handler.read) {
        const t = this.handler.read.call(this, e);
        return BigInt(t.byteLength);
      }
      return this.blockingSkip.call(this, e);
    }
    blockingSkip(e) {
      if (this.handler.blockingSkip) return this.handler.blockingSkip.call(this, e);
      const t = this.handler.blockingRead.call(this, e);
      return BigInt(t.byteLength);
    }
    subscribe() {
      console.log(`[streams] Subscribe to input stream ${this.id}`);
    }
    [yr]() {
      this.handler.drop && this.handler.drop.call(this);
    }
  }, Wa = class {
    constructor(e) {
      e || console.trace("no handler"), this.id = ++mr, this.open = true, this.handler = e;
    }
    checkWrite(e) {
      return this.open ? this.handler.checkWrite ? this.handler.checkWrite.call(this, e) : 1000000n : 0n;
    }
    write(e) {
      this.handler.write.call(this, e);
    }
    blockingWriteAndFlush(e) {
      this.handler.write.call(this, e);
    }
    flush() {
      this.handler.flush && this.handler.flush.call(this);
    }
    blockingFlush() {
      this.open = true;
    }
    writeZeroes(e) {
      this.write.call(this, new Uint8Array(Number(e)));
    }
    blockingWriteZeroes(e) {
      this.blockingWrite.call(this, new Uint8Array(Number(e)));
    }
    blockingWriteZeroesAndFlush(e) {
      this.blockingWriteAndFlush.call(this, new Uint8Array(Number(e)));
    }
    splice(e, t) {
      const n = Math.min(t, this.checkWrite.call(this)), s = e.read(n);
      return this.write.call(this, s), s.byteLength;
    }
    blockingSplice(e, t) {
      console.log(`[streams] Blocking splice ${this.id}`);
    }
    forward(e) {
      console.log(`[streams] Forward ${this.id}`);
    }
    subscribe() {
      console.log(`[streams] Subscribe to output stream ${this.id}`);
    }
    [yr]() {
    }
  };
  const Pt = {
    Error: Fa
  }, Ze = {
    InputStream: Ua,
    OutputStream: Wa
  };
  class Pa {
  }
  function Da(a) {
  }
  function za(a) {
  }
  const Xa = {
    Pollable: Pa,
    pollList: Da,
    pollOne: za
  }, Va = Object.freeze(Object.defineProperty({
    __proto__: null,
    error: Pt,
    poll: Xa,
    streams: Ze
  }, Symbol.toStringTag, {
    value: "Module"
  })), { InputStream: Za, OutputStream: Ga } = Ze;
  let wr = "/";
  function Dt(a) {
    wr = a;
  }
  function Ja(a) {
    zt = a, Nt[0] = new Ge(a);
    const e = lt.initialCwd();
    Dt(e || "/");
  }
  function Ha() {
    return JSON.stringify(zt);
  }
  let zt = {
    dir: {}
  };
  const Ne = {
    seconds: BigInt(0),
    nanoseconds: 0
  };
  function jt(a, e, t) {
    e === "." && Nt && Ya(Nt[0]) === a && (e = wr, e.startsWith("/") && e !== "/" && (e = e.slice(1)));
    let n = a, s;
    do {
      if (!n || !n.dir) throw "not-directory";
      s = e.indexOf("/");
      const u = s === -1 ? e : e.slice(0, s);
      if (u === "..") throw "no-entry";
      u === "." || u === "" || (!n.dir[u] && t.create ? n = n.dir[u] = t.directory ? {
        dir: {}
      } : {
        source: new Uint8Array([])
      } : n = n.dir[u]), e = e.slice(s + 1);
    } while (s !== -1);
    if (!n) throw "no-entry";
    return n;
  }
  function Ke(a) {
    return typeof a.source == "string" && (a.source = new TextEncoder().encode(a.source)), a.source;
  }
  let hr = class {
    constructor(e) {
      this.idx = 0, this.entries = e;
    }
    readDirectoryEntry() {
      if (this.idx === this.entries.length) return null;
      const [e, t] = this.entries[this.idx];
      return this.idx += 1, {
        name: e,
        type: t.dir ? "directory" : "regular-file"
      };
    }
  }, Ge = (_a = class {
    constructor(e, t) {
      __privateAdd(this, _t2);
      __privateAdd(this, _e2);
      __privateAdd(this, _r2, 0);
      t ? __privateSet(this, _t2, e) : __privateSet(this, _e2, e);
    }
    _getEntry(e) {
      return __privateGet(e, _e2);
    }
    readViaStream(e) {
      const t = Ke(__privateGet(this, _e2));
      let n = Number(e);
      return new Za({
        blockingRead(s) {
          if (n === t.byteLength) throw {
            tag: "closed"
          };
          const u = t.slice(n, n + Number(s));
          return n += u.byteLength, u;
        }
      });
    }
    writeViaStream(e) {
      const t = __privateGet(this, _e2);
      let n = Number(e);
      return new Ga({
        write(s) {
          const u = new Uint8Array(s.byteLength + t.source.byteLength);
          return u.set(t.source, 0), u.set(s, n), n += s.byteLength, t.source = u, s.byteLength;
        }
      });
    }
    appendViaStream() {
      console.log("[filesystem] APPEND STREAM");
    }
    advise(e, t, n, s) {
      console.log("[filesystem] ADVISE", e, t, n, s);
    }
    syncData() {
      console.log("[filesystem] SYNC DATA");
    }
    getFlags() {
      console.log("[filesystem] FLAGS FOR");
    }
    getType() {
      return __privateGet(this, _t2) ? "fifo" : __privateGet(this, _e2).dir ? "directory" : __privateGet(this, _e2).source ? "regular-file" : "unknown";
    }
    setSize(e) {
      console.log("[filesystem] SET SIZE", e);
    }
    setTimes(e, t) {
      console.log("[filesystem] SET TIMES", e, t);
    }
    read(e, t) {
      const n = Ke(__privateGet(this, _e2));
      return [
        n.slice(t, t + e),
        t + e >= n.byteLength
      ];
    }
    write(e, t) {
      if (t !== 0) throw "invalid-seek";
      return __privateGet(this, _e2).source = e, e.byteLength;
    }
    readDirectory() {
      var _a2;
      if (!((_a2 = __privateGet(this, _e2)) == null ? void 0 : _a2.dir)) throw "bad-descriptor";
      return new hr(Object.entries(__privateGet(this, _e2).dir).sort(([e], [t]) => e > t ? 1 : -1));
    }
    sync() {
      console.log("[filesystem] SYNC");
    }
    createDirectoryAt(e) {
      if (jt(__privateGet(this, _e2), e, {
        create: true,
        directory: true
      }).source) throw "exist";
    }
    stat() {
      let e = "unknown", t = BigInt(0);
      if (__privateGet(this, _e2).source) {
        e = "regular-file";
        const n = Ke(__privateGet(this, _e2));
        t = BigInt(n.byteLength);
      } else __privateGet(this, _e2).dir && (e = "directory");
      return {
        type: e,
        linkCount: BigInt(0),
        size: t,
        dataAccessTimestamp: Ne,
        dataModificationTimestamp: Ne,
        statusChangeTimestamp: Ne
      };
    }
    statAt(e, t) {
      const n = jt(__privateGet(this, _e2), t, {
        create: false,
        directory: false
      });
      let s = "unknown", u = BigInt(0);
      if (n.source) {
        s = "regular-file";
        const d = Ke(n);
        u = BigInt(d.byteLength);
      } else n.dir && (s = "directory");
      return {
        type: s,
        linkCount: BigInt(0),
        size: u,
        dataAccessTimestamp: Ne,
        dataModificationTimestamp: Ne,
        statusChangeTimestamp: Ne
      };
    }
    setTimesAt() {
      console.log("[filesystem] SET TIMES AT");
    }
    linkAt() {
      console.log("[filesystem] LINK AT");
    }
    openAt(e, t, n, s, u) {
      const d = jt(__privateGet(this, _e2), t, n);
      return new _a(d);
    }
    readlinkAt() {
      console.log("[filesystem] READLINK AT");
    }
    removeDirectoryAt() {
      console.log("[filesystem] REMOVE DIR AT");
    }
    renameAt() {
      console.log("[filesystem] RENAME AT");
    }
    symlinkAt() {
      console.log("[filesystem] SYMLINK AT");
    }
    unlinkFileAt() {
      console.log("[filesystem] UNLINK FILE AT");
    }
    isSameObject(e) {
      return e === this;
    }
    metadataHash() {
      let e = BigInt(0);
      return e += BigInt(__privateGet(this, _r2)), {
        upper: e,
        lower: BigInt(0)
      };
    }
    metadataHashAt(e, t) {
      let n = BigInt(0);
      return n += BigInt(__privateGet(this, _r2)), {
        upper: n,
        lower: BigInt(0)
      };
    }
  }, _t2 = new WeakMap(), _e2 = new WeakMap(), _r2 = new WeakMap(), _a);
  const Ya = Ge.prototype._getEntry;
  delete Ge.prototype._getEntry;
  let Ir = [
    [
      new Ge(zt),
      "/"
    ]
  ], Nt = Ir[0];
  const Xt = {
    getDirectories() {
      return Ir;
    }
  }, at = {
    Descriptor: Ge,
    DirectoryEntryStream: hr
  }, qa = Object.freeze(Object.defineProperty({
    __proto__: null,
    _getFileData: Ha,
    _setCwd: Dt,
    _setFileData: Ja,
    filesystemTypes: at,
    preopens: Xt,
    types: at
  }, Symbol.toStringTag, {
    value: "Module"
  })), { InputStream: Er, OutputStream: it } = Ze, Vt = Symbol.dispose ?? Symbol.for("dispose");
  let Br = [], Tr = [], Cr = "/";
  function Ka(a) {
    Br = Object.entries(a);
  }
  function es(a) {
    Tr = a;
  }
  function ts(a) {
    Dt(Cr = a);
  }
  const lt = {
    getEnvironment() {
      return Br;
    },
    getArguments() {
      return Tr;
    },
    initialCwd() {
      return Cr;
    }
  };
  class ur extends Error {
    constructor(e) {
      super(`Component exited ${e === 0 ? "successfully" : "with error"}`), this.exitError = true, this.code = e;
    }
  }
  const Zt = {
    exit(a) {
      throw new ur(a.tag === "err" ? 1 : 0);
    },
    exitWithCode(a) {
      throw new ur(a);
    }
  };
  function rs(a) {
    jr.handler = a;
  }
  function as(a) {
    Sr.handler = a;
  }
  function ss(a) {
    _r.handler = a;
  }
  const jr = new Er({
    blockingRead(a) {
    },
    subscribe() {
    },
    [Vt]() {
    }
  });
  let Or = new TextDecoder();
  const _r = new it({
    write(a) {
      a[a.length - 1] == 10 && (a = a.subarray(0, a.length - 1)), console.log(Or.decode(a));
    },
    blockingFlush() {
    },
    [Vt]() {
    }
  }), Sr = new it({
    write(a) {
      a[a.length - 1] == 10 && (a = a.subarray(0, a.length - 1)), console.error(Or.decode(a));
    },
    blockingFlush() {
    },
    [Vt]() {
    }
  }), Gt = {
    InputStream: Er,
    getStdin() {
      return jr;
    }
  }, Jt = {
    OutputStream: it,
    getStdout() {
      return _r;
    }
  }, Ht = {
    OutputStream: it,
    getStderr() {
      return Sr;
    }
  };
  let Yt = class {
  }, Je = class {
  };
  const ns = new Je(), os = new Je(), cs = new Yt(), xr = {
    TerminalInput: Yt
  }, $r = {
    TerminalOutput: Je
  }, Rr = {
    TerminalOutput: Je,
    getTerminalStderr() {
      return os;
    }
  }, Nr = {
    TerminalInput: Yt,
    getTerminalStdin() {
      return cs;
    }
  }, Lr = {
    TerminalOutput: Je,
    getTerminalStdout() {
      return ns;
    }
  }, is = Object.freeze(Object.defineProperty({
    __proto__: null,
    _setArgs: es,
    _setCwd: ts,
    _setEnv: Ka,
    _setStderr: as,
    _setStdin: rs,
    _setStdout: ss,
    environment: lt,
    exit: Zt,
    stderr: Ht,
    stdin: Gt,
    stdout: Jt,
    terminalInput: xr,
    terminalOutput: $r,
    terminalStderr: Rr,
    terminalStdin: Nr,
    terminalStdout: Lr
  }, Symbol.toStringTag, {
    value: "Module"
  })), Ot = 65536, Qr = {
    getRandomBytes(a) {
      const e = new Uint8Array(Number(a));
      if (a > Ot) for (var t = 0; t < a; t += Ot) crypto.getRandomValues(e.subarray(t, t + Ot));
      else crypto.getRandomValues(e);
      return e;
    }
  }, { getEnvironment: ls } = lt, { exit: us } = Zt, { getStderr: ds } = Ht, { getStdin: fs } = Gt, { getStdout: bs } = Jt, { TerminalInput: Lt } = xr, { TerminalOutput: st } = $r, { getTerminalStderr: ps } = Rr, { getTerminalStdin: ks } = Nr, { getTerminalStdout: vs } = Lr, { getDirectories: As } = Xt, { Descriptor: z, DirectoryEntryStream: nt, filesystemErrorCode: ms } = at, { Error: de } = Pt, { InputStream: Qe, OutputStream: ae } = Ze, { getRandomBytes: ys } = Qr, dr = (a) => WebAssembly.compile(typeof Buffer < "u" ? Buffer.from(a, "base64") : Uint8Array.from(atob(a), (e) => e.charCodeAt(0)));
  let ws = class extends Error {
    constructor(e) {
      const t = typeof e != "string";
      super(t ? `${String(e)} (see error.payload)` : e), Object.defineProperty(this, "payload", {
        value: e,
        enumerable: t
      });
    }
  }, h = [], _t = new DataView(new ArrayBuffer());
  const l = (a) => _t.buffer === a.buffer ? _t : _t = new DataView(a.buffer), hs = typeof process < "u" && process.versions && process.versions.node;
  let St;
  async function fr(a) {
    return hs ? (St = St || await Xe(() => import("./__vite-browser-external-BIHI7g3E.js"), []), WebAssembly.compile(await St.readFile(a))) : fetch(a).then(WebAssembly.compileStreaming);
  }
  function U(a) {
    if (a && gs.call(a, "payload")) return a.payload;
    if (a instanceof Error) throw a;
    return a;
  }
  const gs = Object.prototype.hasOwnProperty, et = WebAssembly.instantiate, G = 1 << 30;
  function M(a, e) {
    const t = a[0] & -1073741825;
    return t === 0 ? (a.push(0), a.push(e | G), (a.length >> 1) - 1) : (a[0] = a[t << 1], a[t << 1] = 0, a[(t << 1) + 1] = e | G, t);
  }
  function xe(a, e) {
    const t = a[e << 1], n = a[(e << 1) + 1], s = (n & G) !== 0, u = n & -1073741825;
    if (n === 0 || (t & G) !== 0) throw new TypeError("Invalid handle");
    return a[e << 1] = a[0] | G, a[0] = e | G, {
      rep: u,
      scope: t,
      own: s
    };
  }
  const X = Symbol.for("cabiDispose"), g = Symbol("handle"), O = Symbol.for("cabiRep"), V = Symbol.dispose || Symbol.for("dispose");
  function Is() {
    throw new TypeError("Wasm uninitialized use `await $init` first");
  }
  const D = (a) => BigInt.asUintN(64, BigInt(a));
  function Te(a) {
    return a >>> 0;
  }
  const Be = new TextDecoder(), Es = new TextEncoder();
  let q = 0;
  function ue(a, e, t) {
    if (typeof a != "string") throw new TypeError("expected a string");
    if (a.length === 0) return q = 0, 1;
    let n = Es.encode(a), s = e(0, 0, 1, n.length);
    return new Uint8Array(t.buffer).set(n, s), q = n.length, s;
  }
  let j, le;
  const be = [
    G,
    0
  ], se = /* @__PURE__ */ new Map();
  let ut = 0;
  function Bs() {
    const a = ds();
    if (!(a instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = a[g];
    if (!e) {
      const t = a[O] || ++ut;
      se.set(t, a), e = M(be, t);
    }
    return e;
  }
  const He = [
    G,
    0
  ], Me = /* @__PURE__ */ new Map();
  let Mr = 0;
  function Ts() {
    const a = fs();
    if (!(a instanceof Qe)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
    var e = a[g];
    if (!e) {
      const t = a[O] || ++Mr;
      Me.set(t, a), e = M(He, t);
    }
    return e;
  }
  function Cs() {
    const a = bs();
    if (!(a instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = a[g];
    if (!e) {
      const t = a[O] || ++ut;
      se.set(t, a), e = M(be, t);
    }
    return e;
  }
  function js(a) {
    let e;
    switch (a) {
      case 0: {
        e = {
          tag: "ok",
          val: void 0
        };
        break;
      }
      case 1: {
        e = {
          tag: "err",
          val: void 0
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    us(e);
  }
  let P, c, re;
  function Os(a) {
    var t = ls(), n = t.length, s = re(0, 0, 4, n * 16);
    for (let i = 0; i < t.length; i++) {
      const m = t[i], w = s + i * 16;
      var [u, d] = m, f = ue(u, re, c), b = q;
      l(c).setInt32(w + 4, b, true), l(c).setInt32(w + 0, f, true);
      var o = ue(d, re, c), r = q;
      l(c).setInt32(w + 12, r, true), l(c).setInt32(w + 8, o, true);
    }
    l(c).setInt32(a + 4, n, true), l(c).setInt32(a + 0, s, true);
  }
  const J = [
    G,
    0
  ], Z = /* @__PURE__ */ new Map();
  let Fr = 0;
  function _s(a, e) {
    var t = a, n = J[(t << 1) + 1] & -1073741825, s = Z.get(n);
    s || (s = Object.create(z.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.getType()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: U(o)
      };
    }
    for (const o of h) o[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        l(c).setInt8(e + 0, 0, true);
        var f = o;
        let r;
        switch (f) {
          case "unknown": {
            r = 0;
            break;
          }
          case "block-device": {
            r = 1;
            break;
          }
          case "character-device": {
            r = 2;
            break;
          }
          case "directory": {
            r = 3;
            break;
          }
          case "fifo": {
            r = 4;
            break;
          }
          case "symbolic-link": {
            r = 5;
            break;
          }
          case "regular-file": {
            r = 6;
            break;
          }
          case "socket": {
            r = 7;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${f}" is not one of the cases of descriptor-type`);
        }
        l(c).setInt8(e + 1, r, true);
        break;
      }
      case "err": {
        const o = d.val;
        l(c).setInt8(e + 0, 1, true);
        var b = o;
        let r;
        switch (b) {
          case "access": {
            r = 0;
            break;
          }
          case "would-block": {
            r = 1;
            break;
          }
          case "already": {
            r = 2;
            break;
          }
          case "bad-descriptor": {
            r = 3;
            break;
          }
          case "busy": {
            r = 4;
            break;
          }
          case "deadlock": {
            r = 5;
            break;
          }
          case "quota": {
            r = 6;
            break;
          }
          case "exist": {
            r = 7;
            break;
          }
          case "file-too-large": {
            r = 8;
            break;
          }
          case "illegal-byte-sequence": {
            r = 9;
            break;
          }
          case "in-progress": {
            r = 10;
            break;
          }
          case "interrupted": {
            r = 11;
            break;
          }
          case "invalid": {
            r = 12;
            break;
          }
          case "io": {
            r = 13;
            break;
          }
          case "is-directory": {
            r = 14;
            break;
          }
          case "loop": {
            r = 15;
            break;
          }
          case "too-many-links": {
            r = 16;
            break;
          }
          case "message-size": {
            r = 17;
            break;
          }
          case "name-too-long": {
            r = 18;
            break;
          }
          case "no-device": {
            r = 19;
            break;
          }
          case "no-entry": {
            r = 20;
            break;
          }
          case "no-lock": {
            r = 21;
            break;
          }
          case "insufficient-memory": {
            r = 22;
            break;
          }
          case "insufficient-space": {
            r = 23;
            break;
          }
          case "not-directory": {
            r = 24;
            break;
          }
          case "not-empty": {
            r = 25;
            break;
          }
          case "not-recoverable": {
            r = 26;
            break;
          }
          case "unsupported": {
            r = 27;
            break;
          }
          case "no-tty": {
            r = 28;
            break;
          }
          case "no-such-device": {
            r = 29;
            break;
          }
          case "overflow": {
            r = 30;
            break;
          }
          case "not-permitted": {
            r = 31;
            break;
          }
          case "pipe": {
            r = 32;
            break;
          }
          case "read-only": {
            r = 33;
            break;
          }
          case "invalid-seek": {
            r = 34;
            break;
          }
          case "text-file-busy": {
            r = 35;
            break;
          }
          case "cross-device": {
            r = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${b}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 1, r, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ss(a, e) {
    var t = a, n = J[(t << 1) + 1] & -1073741825, s = Z.get(n);
    s || (s = Object.create(z.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.metadataHash()
      };
    } catch (r) {
      u = {
        tag: "err",
        val: U(r)
      };
    }
    for (const r of h) r[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const r = d.val;
        l(c).setInt8(e + 0, 0, true);
        var { lower: f, upper: b } = r;
        l(c).setBigInt64(e + 8, D(f), true), l(c).setBigInt64(e + 16, D(b), true);
        break;
      }
      case "err": {
        const r = d.val;
        l(c).setInt8(e + 0, 1, true);
        var o = r;
        let i;
        switch (o) {
          case "access": {
            i = 0;
            break;
          }
          case "would-block": {
            i = 1;
            break;
          }
          case "already": {
            i = 2;
            break;
          }
          case "bad-descriptor": {
            i = 3;
            break;
          }
          case "busy": {
            i = 4;
            break;
          }
          case "deadlock": {
            i = 5;
            break;
          }
          case "quota": {
            i = 6;
            break;
          }
          case "exist": {
            i = 7;
            break;
          }
          case "file-too-large": {
            i = 8;
            break;
          }
          case "illegal-byte-sequence": {
            i = 9;
            break;
          }
          case "in-progress": {
            i = 10;
            break;
          }
          case "interrupted": {
            i = 11;
            break;
          }
          case "invalid": {
            i = 12;
            break;
          }
          case "io": {
            i = 13;
            break;
          }
          case "is-directory": {
            i = 14;
            break;
          }
          case "loop": {
            i = 15;
            break;
          }
          case "too-many-links": {
            i = 16;
            break;
          }
          case "message-size": {
            i = 17;
            break;
          }
          case "name-too-long": {
            i = 18;
            break;
          }
          case "no-device": {
            i = 19;
            break;
          }
          case "no-entry": {
            i = 20;
            break;
          }
          case "no-lock": {
            i = 21;
            break;
          }
          case "insufficient-memory": {
            i = 22;
            break;
          }
          case "insufficient-space": {
            i = 23;
            break;
          }
          case "not-directory": {
            i = 24;
            break;
          }
          case "not-empty": {
            i = 25;
            break;
          }
          case "not-recoverable": {
            i = 26;
            break;
          }
          case "unsupported": {
            i = 27;
            break;
          }
          case "no-tty": {
            i = 28;
            break;
          }
          case "no-such-device": {
            i = 29;
            break;
          }
          case "overflow": {
            i = 30;
            break;
          }
          case "not-permitted": {
            i = 31;
            break;
          }
          case "pipe": {
            i = 32;
            break;
          }
          case "read-only": {
            i = 33;
            break;
          }
          case "invalid-seek": {
            i = 34;
            break;
          }
          case "text-file-busy": {
            i = 35;
            break;
          }
          case "cross-device": {
            i = 36;
            break;
          }
          default:
            throw r instanceof Error && console.error(r), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 8, i, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  const me = [
    G,
    0
  ], fe = /* @__PURE__ */ new Map();
  let Fe = 0;
  function xs(a, e) {
    var t = a, n = me[(t << 1) + 1] & -1073741825, s = fe.get(n);
    s || (s = Object.create(de.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    const u = ms(s);
    for (const b of h) b[g] = void 0;
    h = [];
    var d = u;
    if (d == null) l(c).setInt8(e + 0, 0, true);
    else {
      const b = d;
      l(c).setInt8(e + 0, 1, true);
      var f = b;
      let o;
      switch (f) {
        case "access": {
          o = 0;
          break;
        }
        case "would-block": {
          o = 1;
          break;
        }
        case "already": {
          o = 2;
          break;
        }
        case "bad-descriptor": {
          o = 3;
          break;
        }
        case "busy": {
          o = 4;
          break;
        }
        case "deadlock": {
          o = 5;
          break;
        }
        case "quota": {
          o = 6;
          break;
        }
        case "exist": {
          o = 7;
          break;
        }
        case "file-too-large": {
          o = 8;
          break;
        }
        case "illegal-byte-sequence": {
          o = 9;
          break;
        }
        case "in-progress": {
          o = 10;
          break;
        }
        case "interrupted": {
          o = 11;
          break;
        }
        case "invalid": {
          o = 12;
          break;
        }
        case "io": {
          o = 13;
          break;
        }
        case "is-directory": {
          o = 14;
          break;
        }
        case "loop": {
          o = 15;
          break;
        }
        case "too-many-links": {
          o = 16;
          break;
        }
        case "message-size": {
          o = 17;
          break;
        }
        case "name-too-long": {
          o = 18;
          break;
        }
        case "no-device": {
          o = 19;
          break;
        }
        case "no-entry": {
          o = 20;
          break;
        }
        case "no-lock": {
          o = 21;
          break;
        }
        case "insufficient-memory": {
          o = 22;
          break;
        }
        case "insufficient-space": {
          o = 23;
          break;
        }
        case "not-directory": {
          o = 24;
          break;
        }
        case "not-empty": {
          o = 25;
          break;
        }
        case "not-recoverable": {
          o = 26;
          break;
        }
        case "unsupported": {
          o = 27;
          break;
        }
        case "no-tty": {
          o = 28;
          break;
        }
        case "no-such-device": {
          o = 29;
          break;
        }
        case "overflow": {
          o = 30;
          break;
        }
        case "not-permitted": {
          o = 31;
          break;
        }
        case "pipe": {
          o = 32;
          break;
        }
        case "read-only": {
          o = 33;
          break;
        }
        case "invalid-seek": {
          o = 34;
          break;
        }
        case "text-file-busy": {
          o = 35;
          break;
        }
        case "cross-device": {
          o = 36;
          break;
        }
        default:
          throw b instanceof Error && console.error(b), new TypeError(`"${f}" is not one of the cases of error-code`);
      }
      l(c).setInt8(e + 1, o, true);
    }
  }
  function $s(a, e, t, n, s) {
    var u = a, d = J[(u << 1) + 1] & -1073741825, f = Z.get(d);
    if (f || (f = Object.create(z.prototype), Object.defineProperty(f, g, {
      writable: true,
      value: u
    }), Object.defineProperty(f, O, {
      writable: true,
      value: d
    })), h.push(f), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var b = {
      symlinkFollow: !!(e & 1)
    }, o = t, r = n, i = Be.decode(new Uint8Array(c.buffer, o, r));
    let m;
    try {
      m = {
        tag: "ok",
        val: f.metadataHashAt(b, i)
      };
    } catch ($) {
      m = {
        tag: "err",
        val: U($)
      };
    }
    for (const $ of h) $[g] = void 0;
    h = [];
    var w = m;
    switch (w.tag) {
      case "ok": {
        const $ = w.val;
        l(c).setInt8(s + 0, 0, true);
        var { lower: A, upper: k } = $;
        l(c).setBigInt64(s + 8, D(A), true), l(c).setBigInt64(s + 16, D(k), true);
        break;
      }
      case "err": {
        const $ = w.val;
        l(c).setInt8(s + 0, 1, true);
        var T = $;
        let B;
        switch (T) {
          case "access": {
            B = 0;
            break;
          }
          case "would-block": {
            B = 1;
            break;
          }
          case "already": {
            B = 2;
            break;
          }
          case "bad-descriptor": {
            B = 3;
            break;
          }
          case "busy": {
            B = 4;
            break;
          }
          case "deadlock": {
            B = 5;
            break;
          }
          case "quota": {
            B = 6;
            break;
          }
          case "exist": {
            B = 7;
            break;
          }
          case "file-too-large": {
            B = 8;
            break;
          }
          case "illegal-byte-sequence": {
            B = 9;
            break;
          }
          case "in-progress": {
            B = 10;
            break;
          }
          case "interrupted": {
            B = 11;
            break;
          }
          case "invalid": {
            B = 12;
            break;
          }
          case "io": {
            B = 13;
            break;
          }
          case "is-directory": {
            B = 14;
            break;
          }
          case "loop": {
            B = 15;
            break;
          }
          case "too-many-links": {
            B = 16;
            break;
          }
          case "message-size": {
            B = 17;
            break;
          }
          case "name-too-long": {
            B = 18;
            break;
          }
          case "no-device": {
            B = 19;
            break;
          }
          case "no-entry": {
            B = 20;
            break;
          }
          case "no-lock": {
            B = 21;
            break;
          }
          case "insufficient-memory": {
            B = 22;
            break;
          }
          case "insufficient-space": {
            B = 23;
            break;
          }
          case "not-directory": {
            B = 24;
            break;
          }
          case "not-empty": {
            B = 25;
            break;
          }
          case "not-recoverable": {
            B = 26;
            break;
          }
          case "unsupported": {
            B = 27;
            break;
          }
          case "no-tty": {
            B = 28;
            break;
          }
          case "no-such-device": {
            B = 29;
            break;
          }
          case "overflow": {
            B = 30;
            break;
          }
          case "not-permitted": {
            B = 31;
            break;
          }
          case "pipe": {
            B = 32;
            break;
          }
          case "read-only": {
            B = 33;
            break;
          }
          case "invalid-seek": {
            B = 34;
            break;
          }
          case "text-file-busy": {
            B = 35;
            break;
          }
          case "cross-device": {
            B = 36;
            break;
          }
          default:
            throw $ instanceof Error && console.error($), new TypeError(`"${T}" is not one of the cases of error-code`);
        }
        l(c).setInt8(s + 8, B, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Rs(a, e, t) {
    var n = a, s = J[(n << 1) + 1] & -1073741825, u = Z.get(s);
    u || (u = Object.create(z.prototype), Object.defineProperty(u, g, {
      writable: true,
      value: n
    }), Object.defineProperty(u, O, {
      writable: true,
      value: s
    })), h.push(u);
    let d;
    try {
      d = {
        tag: "ok",
        val: u.readViaStream(BigInt.asUintN(64, e))
      };
    } catch (r) {
      d = {
        tag: "err",
        val: U(r)
      };
    }
    for (const r of h) r[g] = void 0;
    h = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const r = f.val;
        if (l(c).setInt8(t + 0, 0, true), !(r instanceof Qe)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
        var b = r[g];
        if (!b) {
          const i = r[O] || ++Mr;
          Me.set(i, r), b = M(He, i);
        }
        l(c).setInt32(t + 4, b, true);
        break;
      }
      case "err": {
        const r = f.val;
        l(c).setInt8(t + 0, 1, true);
        var o = r;
        let i;
        switch (o) {
          case "access": {
            i = 0;
            break;
          }
          case "would-block": {
            i = 1;
            break;
          }
          case "already": {
            i = 2;
            break;
          }
          case "bad-descriptor": {
            i = 3;
            break;
          }
          case "busy": {
            i = 4;
            break;
          }
          case "deadlock": {
            i = 5;
            break;
          }
          case "quota": {
            i = 6;
            break;
          }
          case "exist": {
            i = 7;
            break;
          }
          case "file-too-large": {
            i = 8;
            break;
          }
          case "illegal-byte-sequence": {
            i = 9;
            break;
          }
          case "in-progress": {
            i = 10;
            break;
          }
          case "interrupted": {
            i = 11;
            break;
          }
          case "invalid": {
            i = 12;
            break;
          }
          case "io": {
            i = 13;
            break;
          }
          case "is-directory": {
            i = 14;
            break;
          }
          case "loop": {
            i = 15;
            break;
          }
          case "too-many-links": {
            i = 16;
            break;
          }
          case "message-size": {
            i = 17;
            break;
          }
          case "name-too-long": {
            i = 18;
            break;
          }
          case "no-device": {
            i = 19;
            break;
          }
          case "no-entry": {
            i = 20;
            break;
          }
          case "no-lock": {
            i = 21;
            break;
          }
          case "insufficient-memory": {
            i = 22;
            break;
          }
          case "insufficient-space": {
            i = 23;
            break;
          }
          case "not-directory": {
            i = 24;
            break;
          }
          case "not-empty": {
            i = 25;
            break;
          }
          case "not-recoverable": {
            i = 26;
            break;
          }
          case "unsupported": {
            i = 27;
            break;
          }
          case "no-tty": {
            i = 28;
            break;
          }
          case "no-such-device": {
            i = 29;
            break;
          }
          case "overflow": {
            i = 30;
            break;
          }
          case "not-permitted": {
            i = 31;
            break;
          }
          case "pipe": {
            i = 32;
            break;
          }
          case "read-only": {
            i = 33;
            break;
          }
          case "invalid-seek": {
            i = 34;
            break;
          }
          case "text-file-busy": {
            i = 35;
            break;
          }
          case "cross-device": {
            i = 36;
            break;
          }
          default:
            throw r instanceof Error && console.error(r), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        l(c).setInt8(t + 4, i, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ns(a, e, t) {
    var n = a, s = J[(n << 1) + 1] & -1073741825, u = Z.get(s);
    u || (u = Object.create(z.prototype), Object.defineProperty(u, g, {
      writable: true,
      value: n
    }), Object.defineProperty(u, O, {
      writable: true,
      value: s
    })), h.push(u);
    let d;
    try {
      d = {
        tag: "ok",
        val: u.writeViaStream(BigInt.asUintN(64, e))
      };
    } catch (r) {
      d = {
        tag: "err",
        val: U(r)
      };
    }
    for (const r of h) r[g] = void 0;
    h = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const r = f.val;
        if (l(c).setInt8(t + 0, 0, true), !(r instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var b = r[g];
        if (!b) {
          const i = r[O] || ++ut;
          se.set(i, r), b = M(be, i);
        }
        l(c).setInt32(t + 4, b, true);
        break;
      }
      case "err": {
        const r = f.val;
        l(c).setInt8(t + 0, 1, true);
        var o = r;
        let i;
        switch (o) {
          case "access": {
            i = 0;
            break;
          }
          case "would-block": {
            i = 1;
            break;
          }
          case "already": {
            i = 2;
            break;
          }
          case "bad-descriptor": {
            i = 3;
            break;
          }
          case "busy": {
            i = 4;
            break;
          }
          case "deadlock": {
            i = 5;
            break;
          }
          case "quota": {
            i = 6;
            break;
          }
          case "exist": {
            i = 7;
            break;
          }
          case "file-too-large": {
            i = 8;
            break;
          }
          case "illegal-byte-sequence": {
            i = 9;
            break;
          }
          case "in-progress": {
            i = 10;
            break;
          }
          case "interrupted": {
            i = 11;
            break;
          }
          case "invalid": {
            i = 12;
            break;
          }
          case "io": {
            i = 13;
            break;
          }
          case "is-directory": {
            i = 14;
            break;
          }
          case "loop": {
            i = 15;
            break;
          }
          case "too-many-links": {
            i = 16;
            break;
          }
          case "message-size": {
            i = 17;
            break;
          }
          case "name-too-long": {
            i = 18;
            break;
          }
          case "no-device": {
            i = 19;
            break;
          }
          case "no-entry": {
            i = 20;
            break;
          }
          case "no-lock": {
            i = 21;
            break;
          }
          case "insufficient-memory": {
            i = 22;
            break;
          }
          case "insufficient-space": {
            i = 23;
            break;
          }
          case "not-directory": {
            i = 24;
            break;
          }
          case "not-empty": {
            i = 25;
            break;
          }
          case "not-recoverable": {
            i = 26;
            break;
          }
          case "unsupported": {
            i = 27;
            break;
          }
          case "no-tty": {
            i = 28;
            break;
          }
          case "no-such-device": {
            i = 29;
            break;
          }
          case "overflow": {
            i = 30;
            break;
          }
          case "not-permitted": {
            i = 31;
            break;
          }
          case "pipe": {
            i = 32;
            break;
          }
          case "read-only": {
            i = 33;
            break;
          }
          case "invalid-seek": {
            i = 34;
            break;
          }
          case "text-file-busy": {
            i = 35;
            break;
          }
          case "cross-device": {
            i = 36;
            break;
          }
          default:
            throw r instanceof Error && console.error(r), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        l(c).setInt8(t + 4, i, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ls(a, e) {
    var t = a, n = J[(t << 1) + 1] & -1073741825, s = Z.get(n);
    s || (s = Object.create(z.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.appendViaStream()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: U(o)
      };
    }
    for (const o of h) o[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (l(c).setInt8(e + 0, 0, true), !(o instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var f = o[g];
        if (!f) {
          const r = o[O] || ++ut;
          se.set(r, o), f = M(be, r);
        }
        l(c).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        l(c).setInt8(e + 0, 1, true);
        var b = o;
        let r;
        switch (b) {
          case "access": {
            r = 0;
            break;
          }
          case "would-block": {
            r = 1;
            break;
          }
          case "already": {
            r = 2;
            break;
          }
          case "bad-descriptor": {
            r = 3;
            break;
          }
          case "busy": {
            r = 4;
            break;
          }
          case "deadlock": {
            r = 5;
            break;
          }
          case "quota": {
            r = 6;
            break;
          }
          case "exist": {
            r = 7;
            break;
          }
          case "file-too-large": {
            r = 8;
            break;
          }
          case "illegal-byte-sequence": {
            r = 9;
            break;
          }
          case "in-progress": {
            r = 10;
            break;
          }
          case "interrupted": {
            r = 11;
            break;
          }
          case "invalid": {
            r = 12;
            break;
          }
          case "io": {
            r = 13;
            break;
          }
          case "is-directory": {
            r = 14;
            break;
          }
          case "loop": {
            r = 15;
            break;
          }
          case "too-many-links": {
            r = 16;
            break;
          }
          case "message-size": {
            r = 17;
            break;
          }
          case "name-too-long": {
            r = 18;
            break;
          }
          case "no-device": {
            r = 19;
            break;
          }
          case "no-entry": {
            r = 20;
            break;
          }
          case "no-lock": {
            r = 21;
            break;
          }
          case "insufficient-memory": {
            r = 22;
            break;
          }
          case "insufficient-space": {
            r = 23;
            break;
          }
          case "not-directory": {
            r = 24;
            break;
          }
          case "not-empty": {
            r = 25;
            break;
          }
          case "not-recoverable": {
            r = 26;
            break;
          }
          case "unsupported": {
            r = 27;
            break;
          }
          case "no-tty": {
            r = 28;
            break;
          }
          case "no-such-device": {
            r = 29;
            break;
          }
          case "overflow": {
            r = 30;
            break;
          }
          case "not-permitted": {
            r = 31;
            break;
          }
          case "pipe": {
            r = 32;
            break;
          }
          case "read-only": {
            r = 33;
            break;
          }
          case "invalid-seek": {
            r = 34;
            break;
          }
          case "text-file-busy": {
            r = 35;
            break;
          }
          case "cross-device": {
            r = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${b}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 4, r, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  const qt = [
    G,
    0
  ], ot = /* @__PURE__ */ new Map();
  let Qs = 0;
  function Ms(a, e) {
    var t = a, n = J[(t << 1) + 1] & -1073741825, s = Z.get(n);
    s || (s = Object.create(z.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.readDirectory()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: U(o)
      };
    }
    for (const o of h) o[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (l(c).setInt8(e + 0, 0, true), !(o instanceof nt)) throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
        var f = o[g];
        if (!f) {
          const r = o[O] || ++Qs;
          ot.set(r, o), f = M(qt, r);
        }
        l(c).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        l(c).setInt8(e + 0, 1, true);
        var b = o;
        let r;
        switch (b) {
          case "access": {
            r = 0;
            break;
          }
          case "would-block": {
            r = 1;
            break;
          }
          case "already": {
            r = 2;
            break;
          }
          case "bad-descriptor": {
            r = 3;
            break;
          }
          case "busy": {
            r = 4;
            break;
          }
          case "deadlock": {
            r = 5;
            break;
          }
          case "quota": {
            r = 6;
            break;
          }
          case "exist": {
            r = 7;
            break;
          }
          case "file-too-large": {
            r = 8;
            break;
          }
          case "illegal-byte-sequence": {
            r = 9;
            break;
          }
          case "in-progress": {
            r = 10;
            break;
          }
          case "interrupted": {
            r = 11;
            break;
          }
          case "invalid": {
            r = 12;
            break;
          }
          case "io": {
            r = 13;
            break;
          }
          case "is-directory": {
            r = 14;
            break;
          }
          case "loop": {
            r = 15;
            break;
          }
          case "too-many-links": {
            r = 16;
            break;
          }
          case "message-size": {
            r = 17;
            break;
          }
          case "name-too-long": {
            r = 18;
            break;
          }
          case "no-device": {
            r = 19;
            break;
          }
          case "no-entry": {
            r = 20;
            break;
          }
          case "no-lock": {
            r = 21;
            break;
          }
          case "insufficient-memory": {
            r = 22;
            break;
          }
          case "insufficient-space": {
            r = 23;
            break;
          }
          case "not-directory": {
            r = 24;
            break;
          }
          case "not-empty": {
            r = 25;
            break;
          }
          case "not-recoverable": {
            r = 26;
            break;
          }
          case "unsupported": {
            r = 27;
            break;
          }
          case "no-tty": {
            r = 28;
            break;
          }
          case "no-such-device": {
            r = 29;
            break;
          }
          case "overflow": {
            r = 30;
            break;
          }
          case "not-permitted": {
            r = 31;
            break;
          }
          case "pipe": {
            r = 32;
            break;
          }
          case "read-only": {
            r = 33;
            break;
          }
          case "invalid-seek": {
            r = 34;
            break;
          }
          case "text-file-busy": {
            r = 35;
            break;
          }
          case "cross-device": {
            r = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${b}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 4, r, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Fs(a, e) {
    var t = a, n = J[(t << 1) + 1] & -1073741825, s = Z.get(n);
    s || (s = Object.create(z.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.stat()
      };
    } catch (S) {
      u = {
        tag: "err",
        val: U(S)
      };
    }
    for (const S of h) S[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const S = d.val;
        l(c).setInt8(e + 0, 0, true);
        var { type: f, linkCount: b, size: o, dataAccessTimestamp: r, dataModificationTimestamp: i, statusChangeTimestamp: m } = S, w = f;
        let p;
        switch (w) {
          case "unknown": {
            p = 0;
            break;
          }
          case "block-device": {
            p = 1;
            break;
          }
          case "character-device": {
            p = 2;
            break;
          }
          case "directory": {
            p = 3;
            break;
          }
          case "fifo": {
            p = 4;
            break;
          }
          case "symbolic-link": {
            p = 5;
            break;
          }
          case "regular-file": {
            p = 6;
            break;
          }
          case "socket": {
            p = 7;
            break;
          }
          default:
            throw f instanceof Error && console.error(f), new TypeError(`"${w}" is not one of the cases of descriptor-type`);
        }
        l(c).setInt8(e + 8, p, true), l(c).setBigInt64(e + 16, D(b), true), l(c).setBigInt64(e + 24, D(o), true);
        var A = r;
        if (A == null) l(c).setInt8(e + 32, 0, true);
        else {
          const F = A;
          l(c).setInt8(e + 32, 1, true);
          var { seconds: k, nanoseconds: T } = F;
          l(c).setBigInt64(e + 40, D(k), true), l(c).setInt32(e + 48, Te(T), true);
        }
        var $ = i;
        if ($ == null) l(c).setInt8(e + 56, 0, true);
        else {
          const F = $;
          l(c).setInt8(e + 56, 1, true);
          var { seconds: B, nanoseconds: K } = F;
          l(c).setBigInt64(e + 64, D(B), true), l(c).setInt32(e + 72, Te(K), true);
        }
        var R = m;
        if (R == null) l(c).setInt8(e + 80, 0, true);
        else {
          const F = R;
          l(c).setInt8(e + 80, 1, true);
          var { seconds: I, nanoseconds: we } = F;
          l(c).setBigInt64(e + 88, D(I), true), l(c).setInt32(e + 96, Te(we), true);
        }
        break;
      }
      case "err": {
        const S = d.val;
        l(c).setInt8(e + 0, 1, true);
        var ie = S;
        let p;
        switch (ie) {
          case "access": {
            p = 0;
            break;
          }
          case "would-block": {
            p = 1;
            break;
          }
          case "already": {
            p = 2;
            break;
          }
          case "bad-descriptor": {
            p = 3;
            break;
          }
          case "busy": {
            p = 4;
            break;
          }
          case "deadlock": {
            p = 5;
            break;
          }
          case "quota": {
            p = 6;
            break;
          }
          case "exist": {
            p = 7;
            break;
          }
          case "file-too-large": {
            p = 8;
            break;
          }
          case "illegal-byte-sequence": {
            p = 9;
            break;
          }
          case "in-progress": {
            p = 10;
            break;
          }
          case "interrupted": {
            p = 11;
            break;
          }
          case "invalid": {
            p = 12;
            break;
          }
          case "io": {
            p = 13;
            break;
          }
          case "is-directory": {
            p = 14;
            break;
          }
          case "loop": {
            p = 15;
            break;
          }
          case "too-many-links": {
            p = 16;
            break;
          }
          case "message-size": {
            p = 17;
            break;
          }
          case "name-too-long": {
            p = 18;
            break;
          }
          case "no-device": {
            p = 19;
            break;
          }
          case "no-entry": {
            p = 20;
            break;
          }
          case "no-lock": {
            p = 21;
            break;
          }
          case "insufficient-memory": {
            p = 22;
            break;
          }
          case "insufficient-space": {
            p = 23;
            break;
          }
          case "not-directory": {
            p = 24;
            break;
          }
          case "not-empty": {
            p = 25;
            break;
          }
          case "not-recoverable": {
            p = 26;
            break;
          }
          case "unsupported": {
            p = 27;
            break;
          }
          case "no-tty": {
            p = 28;
            break;
          }
          case "no-such-device": {
            p = 29;
            break;
          }
          case "overflow": {
            p = 30;
            break;
          }
          case "not-permitted": {
            p = 31;
            break;
          }
          case "pipe": {
            p = 32;
            break;
          }
          case "read-only": {
            p = 33;
            break;
          }
          case "invalid-seek": {
            p = 34;
            break;
          }
          case "text-file-busy": {
            p = 35;
            break;
          }
          case "cross-device": {
            p = 36;
            break;
          }
          default:
            throw S instanceof Error && console.error(S), new TypeError(`"${ie}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 8, p, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Us(a, e, t, n, s) {
    var u = a, d = J[(u << 1) + 1] & -1073741825, f = Z.get(d);
    if (f || (f = Object.create(z.prototype), Object.defineProperty(f, g, {
      writable: true,
      value: u
    }), Object.defineProperty(f, O, {
      writable: true,
      value: d
    })), h.push(f), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var b = {
      symlinkFollow: !!(e & 1)
    }, o = t, r = n, i = Be.decode(new Uint8Array(c.buffer, o, r));
    let m;
    try {
      m = {
        tag: "ok",
        val: f.statAt(b, i)
      };
    } catch (H) {
      m = {
        tag: "err",
        val: U(H)
      };
    }
    for (const H of h) H[g] = void 0;
    h = [];
    var w = m;
    switch (w.tag) {
      case "ok": {
        const H = w.val;
        l(c).setInt8(s + 0, 0, true);
        var { type: A, linkCount: k, size: T, dataAccessTimestamp: $, dataModificationTimestamp: B, statusChangeTimestamp: K } = H, R = A;
        let E;
        switch (R) {
          case "unknown": {
            E = 0;
            break;
          }
          case "block-device": {
            E = 1;
            break;
          }
          case "character-device": {
            E = 2;
            break;
          }
          case "directory": {
            E = 3;
            break;
          }
          case "fifo": {
            E = 4;
            break;
          }
          case "symbolic-link": {
            E = 5;
            break;
          }
          case "regular-file": {
            E = 6;
            break;
          }
          case "socket": {
            E = 7;
            break;
          }
          default:
            throw A instanceof Error && console.error(A), new TypeError(`"${R}" is not one of the cases of descriptor-type`);
        }
        l(c).setInt8(s + 8, E, true), l(c).setBigInt64(s + 16, D(k), true), l(c).setBigInt64(s + 24, D(T), true);
        var I = $;
        if (I == null) l(c).setInt8(s + 32, 0, true);
        else {
          const ge = I;
          l(c).setInt8(s + 32, 1, true);
          var { seconds: we, nanoseconds: ie } = ge;
          l(c).setBigInt64(s + 40, D(we), true), l(c).setInt32(s + 48, Te(ie), true);
        }
        var S = B;
        if (S == null) l(c).setInt8(s + 56, 0, true);
        else {
          const ge = S;
          l(c).setInt8(s + 56, 1, true);
          var { seconds: p, nanoseconds: F } = ge;
          l(c).setBigInt64(s + 64, D(p), true), l(c).setInt32(s + 72, Te(F), true);
        }
        var he = K;
        if (he == null) l(c).setInt8(s + 80, 0, true);
        else {
          const ge = he;
          l(c).setInt8(s + 80, 1, true);
          var { seconds: Pe, nanoseconds: De } = ge;
          l(c).setBigInt64(s + 88, D(Pe), true), l(c).setInt32(s + 96, Te(De), true);
        }
        break;
      }
      case "err": {
        const H = w.val;
        l(c).setInt8(s + 0, 1, true);
        var Re = H;
        let E;
        switch (Re) {
          case "access": {
            E = 0;
            break;
          }
          case "would-block": {
            E = 1;
            break;
          }
          case "already": {
            E = 2;
            break;
          }
          case "bad-descriptor": {
            E = 3;
            break;
          }
          case "busy": {
            E = 4;
            break;
          }
          case "deadlock": {
            E = 5;
            break;
          }
          case "quota": {
            E = 6;
            break;
          }
          case "exist": {
            E = 7;
            break;
          }
          case "file-too-large": {
            E = 8;
            break;
          }
          case "illegal-byte-sequence": {
            E = 9;
            break;
          }
          case "in-progress": {
            E = 10;
            break;
          }
          case "interrupted": {
            E = 11;
            break;
          }
          case "invalid": {
            E = 12;
            break;
          }
          case "io": {
            E = 13;
            break;
          }
          case "is-directory": {
            E = 14;
            break;
          }
          case "loop": {
            E = 15;
            break;
          }
          case "too-many-links": {
            E = 16;
            break;
          }
          case "message-size": {
            E = 17;
            break;
          }
          case "name-too-long": {
            E = 18;
            break;
          }
          case "no-device": {
            E = 19;
            break;
          }
          case "no-entry": {
            E = 20;
            break;
          }
          case "no-lock": {
            E = 21;
            break;
          }
          case "insufficient-memory": {
            E = 22;
            break;
          }
          case "insufficient-space": {
            E = 23;
            break;
          }
          case "not-directory": {
            E = 24;
            break;
          }
          case "not-empty": {
            E = 25;
            break;
          }
          case "not-recoverable": {
            E = 26;
            break;
          }
          case "unsupported": {
            E = 27;
            break;
          }
          case "no-tty": {
            E = 28;
            break;
          }
          case "no-such-device": {
            E = 29;
            break;
          }
          case "overflow": {
            E = 30;
            break;
          }
          case "not-permitted": {
            E = 31;
            break;
          }
          case "pipe": {
            E = 32;
            break;
          }
          case "read-only": {
            E = 33;
            break;
          }
          case "invalid-seek": {
            E = 34;
            break;
          }
          case "text-file-busy": {
            E = 35;
            break;
          }
          case "cross-device": {
            E = 36;
            break;
          }
          default:
            throw H instanceof Error && console.error(H), new TypeError(`"${Re}" is not one of the cases of error-code`);
        }
        l(c).setInt8(s + 8, E, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ws(a, e, t, n, s, u, d) {
    var f = a, b = J[(f << 1) + 1] & -1073741825, o = Z.get(b);
    if (o || (o = Object.create(z.prototype), Object.defineProperty(o, g, {
      writable: true,
      value: f
    }), Object.defineProperty(o, O, {
      writable: true,
      value: b
    })), h.push(o), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var r = {
      symlinkFollow: !!(e & 1)
    }, i = t, m = n, w = Be.decode(new Uint8Array(c.buffer, i, m));
    if ((s & 4294967280) !== 0) throw new TypeError("flags have extraneous bits set");
    var A = {
      create: !!(s & 1),
      directory: !!(s & 2),
      exclusive: !!(s & 4),
      truncate: !!(s & 8)
    };
    if ((u & 4294967232) !== 0) throw new TypeError("flags have extraneous bits set");
    var k = {
      read: !!(u & 1),
      write: !!(u & 2),
      fileIntegritySync: !!(u & 4),
      dataIntegritySync: !!(u & 8),
      requestedWriteSync: !!(u & 16),
      mutateDirectory: !!(u & 32)
    };
    let T;
    try {
      T = {
        tag: "ok",
        val: o.openAt(r, w, A, k)
      };
    } catch (R) {
      T = {
        tag: "err",
        val: U(R)
      };
    }
    for (const R of h) R[g] = void 0;
    h = [];
    var $ = T;
    switch ($.tag) {
      case "ok": {
        const R = $.val;
        if (l(c).setInt8(d + 0, 0, true), !(R instanceof z)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
        var B = R[g];
        if (!B) {
          const I = R[O] || ++Fr;
          Z.set(I, R), B = M(J, I);
        }
        l(c).setInt32(d + 4, B, true);
        break;
      }
      case "err": {
        const R = $.val;
        l(c).setInt8(d + 0, 1, true);
        var K = R;
        let I;
        switch (K) {
          case "access": {
            I = 0;
            break;
          }
          case "would-block": {
            I = 1;
            break;
          }
          case "already": {
            I = 2;
            break;
          }
          case "bad-descriptor": {
            I = 3;
            break;
          }
          case "busy": {
            I = 4;
            break;
          }
          case "deadlock": {
            I = 5;
            break;
          }
          case "quota": {
            I = 6;
            break;
          }
          case "exist": {
            I = 7;
            break;
          }
          case "file-too-large": {
            I = 8;
            break;
          }
          case "illegal-byte-sequence": {
            I = 9;
            break;
          }
          case "in-progress": {
            I = 10;
            break;
          }
          case "interrupted": {
            I = 11;
            break;
          }
          case "invalid": {
            I = 12;
            break;
          }
          case "io": {
            I = 13;
            break;
          }
          case "is-directory": {
            I = 14;
            break;
          }
          case "loop": {
            I = 15;
            break;
          }
          case "too-many-links": {
            I = 16;
            break;
          }
          case "message-size": {
            I = 17;
            break;
          }
          case "name-too-long": {
            I = 18;
            break;
          }
          case "no-device": {
            I = 19;
            break;
          }
          case "no-entry": {
            I = 20;
            break;
          }
          case "no-lock": {
            I = 21;
            break;
          }
          case "insufficient-memory": {
            I = 22;
            break;
          }
          case "insufficient-space": {
            I = 23;
            break;
          }
          case "not-directory": {
            I = 24;
            break;
          }
          case "not-empty": {
            I = 25;
            break;
          }
          case "not-recoverable": {
            I = 26;
            break;
          }
          case "unsupported": {
            I = 27;
            break;
          }
          case "no-tty": {
            I = 28;
            break;
          }
          case "no-such-device": {
            I = 29;
            break;
          }
          case "overflow": {
            I = 30;
            break;
          }
          case "not-permitted": {
            I = 31;
            break;
          }
          case "pipe": {
            I = 32;
            break;
          }
          case "read-only": {
            I = 33;
            break;
          }
          case "invalid-seek": {
            I = 34;
            break;
          }
          case "text-file-busy": {
            I = 35;
            break;
          }
          case "cross-device": {
            I = 36;
            break;
          }
          default:
            throw R instanceof Error && console.error(R), new TypeError(`"${K}" is not one of the cases of error-code`);
        }
        l(c).setInt8(d + 4, I, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ps(a, e) {
    var t = a, n = qt[(t << 1) + 1] & -1073741825, s = ot.get(n);
    s || (s = Object.create(nt.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.readDirectoryEntry()
      };
    } catch (A) {
      u = {
        tag: "err",
        val: U(A)
      };
    }
    for (const A of h) A[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const A = d.val;
        l(c).setInt8(e + 0, 0, true);
        var f = A;
        if (f == null) l(c).setInt8(e + 4, 0, true);
        else {
          const k = f;
          l(c).setInt8(e + 4, 1, true);
          var { type: b, name: o } = k, r = b;
          let T;
          switch (r) {
            case "unknown": {
              T = 0;
              break;
            }
            case "block-device": {
              T = 1;
              break;
            }
            case "character-device": {
              T = 2;
              break;
            }
            case "directory": {
              T = 3;
              break;
            }
            case "fifo": {
              T = 4;
              break;
            }
            case "symbolic-link": {
              T = 5;
              break;
            }
            case "regular-file": {
              T = 6;
              break;
            }
            case "socket": {
              T = 7;
              break;
            }
            default:
              throw b instanceof Error && console.error(b), new TypeError(`"${r}" is not one of the cases of descriptor-type`);
          }
          l(c).setInt8(e + 8, T, true);
          var i = ue(o, re, c), m = q;
          l(c).setInt32(e + 16, m, true), l(c).setInt32(e + 12, i, true);
        }
        break;
      }
      case "err": {
        const A = d.val;
        l(c).setInt8(e + 0, 1, true);
        var w = A;
        let k;
        switch (w) {
          case "access": {
            k = 0;
            break;
          }
          case "would-block": {
            k = 1;
            break;
          }
          case "already": {
            k = 2;
            break;
          }
          case "bad-descriptor": {
            k = 3;
            break;
          }
          case "busy": {
            k = 4;
            break;
          }
          case "deadlock": {
            k = 5;
            break;
          }
          case "quota": {
            k = 6;
            break;
          }
          case "exist": {
            k = 7;
            break;
          }
          case "file-too-large": {
            k = 8;
            break;
          }
          case "illegal-byte-sequence": {
            k = 9;
            break;
          }
          case "in-progress": {
            k = 10;
            break;
          }
          case "interrupted": {
            k = 11;
            break;
          }
          case "invalid": {
            k = 12;
            break;
          }
          case "io": {
            k = 13;
            break;
          }
          case "is-directory": {
            k = 14;
            break;
          }
          case "loop": {
            k = 15;
            break;
          }
          case "too-many-links": {
            k = 16;
            break;
          }
          case "message-size": {
            k = 17;
            break;
          }
          case "name-too-long": {
            k = 18;
            break;
          }
          case "no-device": {
            k = 19;
            break;
          }
          case "no-entry": {
            k = 20;
            break;
          }
          case "no-lock": {
            k = 21;
            break;
          }
          case "insufficient-memory": {
            k = 22;
            break;
          }
          case "insufficient-space": {
            k = 23;
            break;
          }
          case "not-directory": {
            k = 24;
            break;
          }
          case "not-empty": {
            k = 25;
            break;
          }
          case "not-recoverable": {
            k = 26;
            break;
          }
          case "unsupported": {
            k = 27;
            break;
          }
          case "no-tty": {
            k = 28;
            break;
          }
          case "no-such-device": {
            k = 29;
            break;
          }
          case "overflow": {
            k = 30;
            break;
          }
          case "not-permitted": {
            k = 31;
            break;
          }
          case "pipe": {
            k = 32;
            break;
          }
          case "read-only": {
            k = 33;
            break;
          }
          case "invalid-seek": {
            k = 34;
            break;
          }
          case "text-file-busy": {
            k = 35;
            break;
          }
          case "cross-device": {
            k = 36;
            break;
          }
          default:
            throw A instanceof Error && console.error(A), new TypeError(`"${w}" is not one of the cases of error-code`);
        }
        l(c).setInt8(e + 4, k, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ds(a, e, t) {
    var n = a, s = He[(n << 1) + 1] & -1073741825, u = Me.get(s);
    u || (u = Object.create(Qe.prototype), Object.defineProperty(u, g, {
      writable: true,
      value: n
    }), Object.defineProperty(u, O, {
      writable: true,
      value: s
    })), h.push(u);
    let d;
    try {
      d = {
        tag: "ok",
        val: u.read(BigInt.asUintN(64, e))
      };
    } catch (A) {
      d = {
        tag: "err",
        val: U(A)
      };
    }
    for (const A of h) A[g] = void 0;
    h = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const A = f.val;
        l(c).setInt8(t + 0, 0, true);
        var b = A, o = b.byteLength, r = re(0, 0, 1, o * 1), i = new Uint8Array(b.buffer || b, b.byteOffset, o * 1);
        new Uint8Array(c.buffer, r, o * 1).set(i), l(c).setInt32(t + 8, o, true), l(c).setInt32(t + 4, r, true);
        break;
      }
      case "err": {
        const A = f.val;
        l(c).setInt8(t + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (l(c).setInt8(t + 4, 0, true), !(k instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[g];
            if (!w) {
              const T = k[O] || ++Fe;
              fe.set(T, k), w = M(me, T);
            }
            l(c).setInt32(t + 8, w, true);
            break;
          }
          case "closed": {
            l(c).setInt8(t + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function zs(a, e, t) {
    var n = a, s = He[(n << 1) + 1] & -1073741825, u = Me.get(s);
    u || (u = Object.create(Qe.prototype), Object.defineProperty(u, g, {
      writable: true,
      value: n
    }), Object.defineProperty(u, O, {
      writable: true,
      value: s
    })), h.push(u);
    let d;
    try {
      d = {
        tag: "ok",
        val: u.blockingRead(BigInt.asUintN(64, e))
      };
    } catch (A) {
      d = {
        tag: "err",
        val: U(A)
      };
    }
    for (const A of h) A[g] = void 0;
    h = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const A = f.val;
        l(c).setInt8(t + 0, 0, true);
        var b = A, o = b.byteLength, r = re(0, 0, 1, o * 1), i = new Uint8Array(b.buffer || b, b.byteOffset, o * 1);
        new Uint8Array(c.buffer, r, o * 1).set(i), l(c).setInt32(t + 8, o, true), l(c).setInt32(t + 4, r, true);
        break;
      }
      case "err": {
        const A = f.val;
        l(c).setInt8(t + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (l(c).setInt8(t + 4, 0, true), !(k instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[g];
            if (!w) {
              const T = k[O] || ++Fe;
              fe.set(T, k), w = M(me, T);
            }
            l(c).setInt32(t + 8, w, true);
            break;
          }
          case "closed": {
            l(c).setInt8(t + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Xs(a, e) {
    var t = a, n = be[(t << 1) + 1] & -1073741825, s = se.get(n);
    s || (s = Object.create(ae.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.checkWrite()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: U(o)
      };
    }
    for (const o of h) o[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        l(c).setInt8(e + 0, 0, true), l(c).setBigInt64(e + 8, D(o), true);
        break;
      }
      case "err": {
        const o = d.val;
        l(c).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const r = f.val;
            if (l(c).setInt8(e + 8, 0, true), !(r instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var b = r[g];
            if (!b) {
              const i = r[O] || ++Fe;
              fe.set(i, r), b = M(me, i);
            }
            l(c).setInt32(e + 12, b, true);
            break;
          }
          case "closed": {
            l(c).setInt8(e + 8, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(f.tag)}\` (received \`${f}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Vs(a, e, t, n) {
    var s = a, u = be[(s << 1) + 1] & -1073741825, d = se.get(u);
    d || (d = Object.create(ae.prototype), Object.defineProperty(d, g, {
      writable: true,
      value: s
    }), Object.defineProperty(d, O, {
      writable: true,
      value: u
    })), h.push(d);
    var f = e, b = t, o = new Uint8Array(c.buffer.slice(f, f + b * 1));
    let r;
    try {
      r = {
        tag: "ok",
        val: d.write(o)
      };
    } catch (A) {
      r = {
        tag: "err",
        val: U(A)
      };
    }
    for (const A of h) A[g] = void 0;
    h = [];
    var i = r;
    switch (i.tag) {
      case "ok": {
        i.val, l(c).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const A = i.val;
        l(c).setInt8(n + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (l(c).setInt8(n + 4, 0, true), !(k instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[g];
            if (!w) {
              const T = k[O] || ++Fe;
              fe.set(T, k), w = M(me, T);
            }
            l(c).setInt32(n + 8, w, true);
            break;
          }
          case "closed": {
            l(c).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Zs(a, e, t, n) {
    var s = a, u = be[(s << 1) + 1] & -1073741825, d = se.get(u);
    d || (d = Object.create(ae.prototype), Object.defineProperty(d, g, {
      writable: true,
      value: s
    }), Object.defineProperty(d, O, {
      writable: true,
      value: u
    })), h.push(d);
    var f = e, b = t, o = new Uint8Array(c.buffer.slice(f, f + b * 1));
    let r;
    try {
      r = {
        tag: "ok",
        val: d.blockingWriteAndFlush(o)
      };
    } catch (A) {
      r = {
        tag: "err",
        val: U(A)
      };
    }
    for (const A of h) A[g] = void 0;
    h = [];
    var i = r;
    switch (i.tag) {
      case "ok": {
        i.val, l(c).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const A = i.val;
        l(c).setInt8(n + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (l(c).setInt8(n + 4, 0, true), !(k instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[g];
            if (!w) {
              const T = k[O] || ++Fe;
              fe.set(T, k), w = M(me, T);
            }
            l(c).setInt32(n + 8, w, true);
            break;
          }
          case "closed": {
            l(c).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Gs(a, e) {
    var t = a, n = be[(t << 1) + 1] & -1073741825, s = se.get(n);
    s || (s = Object.create(ae.prototype), Object.defineProperty(s, g, {
      writable: true,
      value: t
    }), Object.defineProperty(s, O, {
      writable: true,
      value: n
    })), h.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.blockingFlush()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: U(o)
      };
    }
    for (const o of h) o[g] = void 0;
    h = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        d.val, l(c).setInt8(e + 0, 0, true);
        break;
      }
      case "err": {
        const o = d.val;
        l(c).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const r = f.val;
            if (l(c).setInt8(e + 4, 0, true), !(r instanceof de)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var b = r[g];
            if (!b) {
              const i = r[O] || ++Fe;
              fe.set(i, r), b = M(me, i);
            }
            l(c).setInt32(e + 8, b, true);
            break;
          }
          case "closed": {
            l(c).setInt8(e + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(f.tag)}\` (received \`${f}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Js(a, e) {
    var n = ys(BigInt.asUintN(64, a)), s = n.byteLength, u = re(0, 0, 1, s * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, s * 1);
    new Uint8Array(c.buffer, u, s * 1).set(d), l(c).setInt32(e + 4, s, true), l(c).setInt32(e + 0, u, true);
  }
  function Hs(a) {
    var t = As(), n = t.length, s = re(0, 0, 4, n * 12);
    for (let r = 0; r < t.length; r++) {
      const i = t[r], m = s + r * 12;
      var [u, d] = i;
      if (!(u instanceof z)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      var f = u[g];
      if (!f) {
        const w = u[O] || ++Fr;
        Z.set(w, u), f = M(J, w);
      }
      l(c).setInt32(m + 0, f, true);
      var b = ue(d, re, c), o = q;
      l(c).setInt32(m + 8, o, true), l(c).setInt32(m + 4, b, true);
    }
    l(c).setInt32(a + 4, n, true), l(c).setInt32(a + 0, s, true);
  }
  const Ur = [
    G,
    0
  ], Qt = /* @__PURE__ */ new Map();
  let Ys = 0;
  function qs(a) {
    var t = ks();
    if (t == null) l(c).setInt8(a + 0, 0, true);
    else {
      const s = t;
      if (l(c).setInt8(a + 0, 1, true), !(s instanceof Lt)) throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
      var n = s[g];
      if (!n) {
        const u = s[O] || ++Ys;
        Qt.set(u, s), n = M(Ur, u);
      }
      l(c).setInt32(a + 4, n, true);
    }
  }
  const Kt = [
    G,
    0
  ], ct = /* @__PURE__ */ new Map();
  let Wr = 0;
  function Ks(a) {
    var t = vs();
    if (t == null) l(c).setInt8(a + 0, 0, true);
    else {
      const s = t;
      if (l(c).setInt8(a + 0, 1, true), !(s instanceof st)) throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
      var n = s[g];
      if (!n) {
        const u = s[O] || ++Wr;
        ct.set(u, s), n = M(Kt, u);
      }
      l(c).setInt32(a + 4, n, true);
    }
  }
  function en(a) {
    var t = ps();
    if (t == null) l(c).setInt8(a + 0, 0, true);
    else {
      const s = t;
      if (l(c).setInt8(a + 0, 1, true), !(s instanceof st)) throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
      var n = s[g];
      if (!n) {
        const u = s[O] || ++Wr;
        ct.set(u, s), n = M(Kt, u);
      }
      l(c).setInt32(a + 4, n, true);
    }
  }
  let tn, Y, Pr;
  function rn(a) {
    const e = xe(qt, a);
    if (e.own) {
      const t = ot.get(e.rep);
      t ? (t[V] && t[V](), ot.delete(e.rep)) : nt[X] && nt[X](e.rep);
    }
  }
  function an(a) {
    const e = xe(be, a);
    if (e.own) {
      const t = se.get(e.rep);
      t ? (t[V] && t[V](), se.delete(e.rep)) : ae[X] && ae[X](e.rep);
    }
  }
  function sn(a) {
    const e = xe(me, a);
    if (e.own) {
      const t = fe.get(e.rep);
      t ? (t[V] && t[V](), fe.delete(e.rep)) : de[X] && de[X](e.rep);
    }
  }
  function nn(a) {
    const e = xe(He, a);
    if (e.own) {
      const t = Me.get(e.rep);
      t ? (t[V] && t[V](), Me.delete(e.rep)) : Qe[X] && Qe[X](e.rep);
    }
  }
  function on(a) {
    const e = xe(J, a);
    if (e.own) {
      const t = Z.get(e.rep);
      t ? (t[V] && t[V](), Z.delete(e.rep)) : z[X] && z[X](e.rep);
    }
  }
  function cn(a) {
    const e = xe(Ur, a);
    if (e.own) {
      const t = Qt.get(e.rep);
      t ? (t[V] && t[V](), Qt.delete(e.rep)) : Lt[X] && Lt[X](e.rep);
    }
  }
  function ln(a) {
    const e = xe(Kt, a);
    if (e.own) {
      const t = ct.get(e.rep);
      t ? (t[V] && t[V](), ct.delete(e.rep)) : st[X] && st[X](e.rep);
    }
  }
  let Dr;
  function un(a, e) {
    zr || Is();
    var t = Y(0, 0, 4, 84), n = a, s = n.byteLength, u = Y(0, 0, 1, s * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, s * 1);
    new Uint8Array(c.buffer, u, s * 1).set(d), l(c).setInt32(t + 4, s, true), l(c).setInt32(t + 0, u, true);
    var { name: f, noTypescript: b, instantiation: o, importBindings: r, map: i, compat: m, noNodejsCompat: w, base64Cutoff: A, tlaCompat: k, validLiftingOptimization: T, tracing: $, noNamespacedExports: B, guest: K, multiMemory: R, asyncMode: I } = e, we = ue(f, Y, c), ie = q;
    l(c).setInt32(t + 12, ie, true), l(c).setInt32(t + 8, we, true);
    var S = b;
    if (S == null) l(c).setInt8(t + 16, 0, true);
    else {
      const C = S;
      l(c).setInt8(t + 16, 1, true), l(c).setInt8(t + 17, C ? 1 : 0, true);
    }
    var p = o;
    if (p == null) l(c).setInt8(t + 18, 0, true);
    else {
      const C = p;
      l(c).setInt8(t + 18, 1, true);
      var F = C;
      switch (F.tag) {
        case "async": {
          l(c).setInt8(t + 19, 0, true);
          break;
        }
        case "sync": {
          l(c).setInt8(t + 19, 1, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(F.tag)}\` (received \`${F}\`) specified for \`InstantiationMode\``);
      }
    }
    var he = r;
    if (he == null) l(c).setInt8(t + 20, 0, true);
    else {
      const C = he;
      l(c).setInt8(t + 20, 1, true);
      var Pe = C;
      switch (Pe.tag) {
        case "js": {
          l(c).setInt8(t + 21, 0, true);
          break;
        }
        case "hybrid": {
          l(c).setInt8(t + 21, 1, true);
          break;
        }
        case "optimized": {
          l(c).setInt8(t + 21, 2, true);
          break;
        }
        case "direct-optimized": {
          l(c).setInt8(t + 21, 3, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(Pe.tag)}\` (received \`${Pe}\`) specified for \`BindingsMode\``);
      }
    }
    var De = i;
    if (De == null) l(c).setInt8(t + 24, 0, true);
    else {
      const C = De;
      l(c).setInt8(t + 24, 1, true);
      var Re = C, H = Re.length, E = Y(0, 0, 4, H * 16);
      for (let Q = 0; Q < Re.length; Q++) {
        const W = Re[Q], ke = E + Q * 16;
        var [ge, oa] = W, ca = ue(ge, Y, c), ia = q;
        l(c).setInt32(ke + 4, ia, true), l(c).setInt32(ke + 0, ca, true);
        var la = ue(oa, Y, c), ua = q;
        l(c).setInt32(ke + 12, ua, true), l(c).setInt32(ke + 8, la, true);
      }
      l(c).setInt32(t + 32, H, true), l(c).setInt32(t + 28, E, true);
    }
    var kt = m;
    if (kt == null) l(c).setInt8(t + 36, 0, true);
    else {
      const C = kt;
      l(c).setInt8(t + 36, 1, true), l(c).setInt8(t + 37, C ? 1 : 0, true);
    }
    var vt = w;
    if (vt == null) l(c).setInt8(t + 38, 0, true);
    else {
      const C = vt;
      l(c).setInt8(t + 38, 1, true), l(c).setInt8(t + 39, C ? 1 : 0, true);
    }
    var At = A;
    if (At == null) l(c).setInt8(t + 40, 0, true);
    else {
      const C = At;
      l(c).setInt8(t + 40, 1, true), l(c).setInt32(t + 44, Te(C), true);
    }
    var mt = k;
    if (mt == null) l(c).setInt8(t + 48, 0, true);
    else {
      const C = mt;
      l(c).setInt8(t + 48, 1, true), l(c).setInt8(t + 49, C ? 1 : 0, true);
    }
    var yt = T;
    if (yt == null) l(c).setInt8(t + 50, 0, true);
    else {
      const C = yt;
      l(c).setInt8(t + 50, 1, true), l(c).setInt8(t + 51, C ? 1 : 0, true);
    }
    var wt = $;
    if (wt == null) l(c).setInt8(t + 52, 0, true);
    else {
      const C = wt;
      l(c).setInt8(t + 52, 1, true), l(c).setInt8(t + 53, C ? 1 : 0, true);
    }
    var ht = B;
    if (ht == null) l(c).setInt8(t + 54, 0, true);
    else {
      const C = ht;
      l(c).setInt8(t + 54, 1, true), l(c).setInt8(t + 55, C ? 1 : 0, true);
    }
    var gt = K;
    if (gt == null) l(c).setInt8(t + 56, 0, true);
    else {
      const C = gt;
      l(c).setInt8(t + 56, 1, true), l(c).setInt8(t + 57, C ? 1 : 0, true);
    }
    var It = R;
    if (It == null) l(c).setInt8(t + 58, 0, true);
    else {
      const C = It;
      l(c).setInt8(t + 58, 1, true), l(c).setInt8(t + 59, C ? 1 : 0, true);
    }
    var Et = I;
    if (Et == null) l(c).setInt8(t + 60, 0, true);
    else {
      const C = Et;
      l(c).setInt8(t + 60, 1, true);
      var Ye = C;
      switch (Ye.tag) {
        case "sync": {
          l(c).setInt8(t + 64, 0, true);
          break;
        }
        case "jspi": {
          const Q = Ye.val;
          l(c).setInt8(t + 64, 1, true);
          var { imports: da, exports: fa } = Q, Bt = da, tr = Bt.length, rr = Y(0, 0, 4, tr * 8);
          for (let W = 0; W < Bt.length; W++) {
            const ke = Bt[W], ze = rr + W * 8;
            var ba = ue(ke, Y, c), pa = q;
            l(c).setInt32(ze + 4, pa, true), l(c).setInt32(ze + 0, ba, true);
          }
          l(c).setInt32(t + 72, tr, true), l(c).setInt32(t + 68, rr, true);
          var Tt = fa, ar = Tt.length, sr = Y(0, 0, 4, ar * 8);
          for (let W = 0; W < Tt.length; W++) {
            const ke = Tt[W], ze = sr + W * 8;
            var ka = ue(ke, Y, c), va = q;
            l(c).setInt32(ze + 4, va, true), l(c).setInt32(ze + 0, ka, true);
          }
          l(c).setInt32(t + 80, ar, true), l(c).setInt32(t + 76, sr, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(Ye.tag)}\` (received \`${Ye}\`) specified for \`AsyncMode\``);
      }
    }
    const ee = Dr(t);
    let Ct;
    switch (l(c).getUint8(ee + 0, true)) {
      case 0: {
        var Aa = l(c).getInt32(ee + 8, true), ma = l(c).getInt32(ee + 4, true), nr = [];
        for (let C = 0; C < Aa; C++) {
          const Q = ma + C * 16;
          var ya = l(c).getInt32(Q + 0, true), wa = l(c).getInt32(Q + 4, true), ha = Be.decode(new Uint8Array(c.buffer, ya, wa)), or = l(c).getInt32(Q + 8, true), ga = l(c).getInt32(Q + 12, true), Ia = new Uint8Array(c.buffer.slice(or, or + ga * 1));
          nr.push([
            ha,
            Ia
          ]);
        }
        var Ea = l(c).getInt32(ee + 16, true), Ba = l(c).getInt32(ee + 12, true), cr = [];
        for (let C = 0; C < Ea; C++) {
          const Q = Ba + C * 8;
          var Ta = l(c).getInt32(Q + 0, true), Ca = l(c).getInt32(Q + 4, true), ja = Be.decode(new Uint8Array(c.buffer, Ta, Ca));
          cr.push(ja);
        }
        var Oa = l(c).getInt32(ee + 24, true), _a2 = l(c).getInt32(ee + 20, true), ir = [];
        for (let C = 0; C < Oa; C++) {
          const Q = _a2 + C * 12;
          var Sa = l(c).getInt32(Q + 0, true), xa = l(c).getInt32(Q + 4, true), $a = Be.decode(new Uint8Array(c.buffer, Sa, xa));
          let W;
          switch (l(c).getUint8(Q + 8, true)) {
            case 0: {
              W = "function";
              break;
            }
            case 1: {
              W = "instance";
              break;
            }
            default:
              throw new TypeError("invalid discriminant specified for ExportType");
          }
          ir.push([
            $a,
            W
          ]);
        }
        Ct = {
          tag: "ok",
          val: {
            files: nr,
            imports: cr,
            exports: ir
          }
        };
        break;
      }
      case 1: {
        var Ra = l(c).getInt32(ee + 4, true), Na = l(c).getInt32(ee + 8, true), La = Be.decode(new Uint8Array(c.buffer, Ra, Na));
        Ct = {
          tag: "err",
          val: La
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    const qe = Ct;
    if (Pr(ee), typeof qe == "object" && qe.tag === "err") throw new ws(qe.val);
    return qe.val;
  }
  let zr = false;
  const dn = (() => {
    let a = function* () {
      const f = fr(new URL("/component-ui/assets/js-component-bindgen-component.core-DjGiHRyQ.wasm", import.meta.url)), b = fr(new URL("/component-ui/assets/js-component-bindgen-component.core2-0cWI-1I7.wasm", import.meta.url)), o = dr("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwADJiUHCAkCAgQEAgIKAgsBAQAAAAUDAwAAAAUMAAMDAAYGAA0BAQEBBAUBcAElJQe7ASYBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABACMTcAEQIxOAASAjE5ABMCMjAAFAIyMQAVAjIyABYCMjMAFwIyNAAYAjI1ABkCMjYAGgIyNwAbAjI4ABwCMjkAHQIzMAAeAjMxAB8CMzIAIAIzMwAhAjM0ACICMzUAIwIzNgAkCCRpbXBvcnRzAQAK+QMlGQAgACABIAIgAyAEIAUgBiAHIAhBABEHAAsRACAAIAEgAiADIARBAREIAAsRACAAIAEgAiADIARBAhEJAAsLACAAIAFBAxECAAsLACAAIAFBBBECAAsPACAAIAEgAiADQQURBAALDwAgACABIAIgA0EGEQQACwsAIAAgAUEHEQIACwsAIAAgAUEIEQIACwkAIABBCREKAAsLACAAIAFBChECAAsNACAAIAEgAkELEQsACwkAIABBDBEBAAsJACAAQQ0RAQALCwAgACABQQ4RAAALCwAgACABQQ8RAAALCwAgACABQRARAAALEQAgACABIAIgAyAEQRERBQALDQAgACABIAJBEhEDAAsNACAAIAEgAkETEQMACwsAIAAgAUEUEQAACwsAIAAgAUEVEQAACwsAIAAgAUEWEQAACxEAIAAgASACIAMgBEEXEQUACxUAIAAgASACIAMgBCAFIAZBGBEMAAsLACAAIAFBGREAAAsNACAAIAEgAkEaEQMACw0AIAAgASACQRsRAwALCwAgACABQRwRAAALDwAgACABIAIgA0EdEQYACw8AIAAgASACIANBHhEGAAsLACAAIAFBHxEAAAsLACAAIAFBIBENAAsJACAAQSERAQALCQAgAEEiEQEACwkAIABBIxEBAAsJACAAQSQRAQALAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yMjUuMA"), r = dr("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwAC5AEmAAEwAAcAATEACAABMgAJAAEzAAIAATQAAgABNQAEAAE2AAQAATcAAgABOAACAAE5AAoAAjEwAAIAAjExAAsAAjEyAAEAAjEzAAEAAjE0AAAAAjE1AAAAAjE2AAAAAjE3AAUAAjE4AAMAAjE5AAMAAjIwAAAAAjIxAAAAAjIyAAAAAjIzAAUAAjI0AAwAAjI1AAAAAjI2AAMAAjI3AAMAAjI4AAAAAjI5AAYAAjMwAAYAAjMxAAAAAjMyAA0AAjMzAAEAAjM0AAEAAjM1AAEAAjM2AAEACCRpbXBvcnRzAXABJSUJKwEAQQALJQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjIyNS4w");
      ({ exports: j } = yield et(yield o)), { exports: le } = yield et(yield f, {
        wasi_snapshot_preview1: {
          environ_get: j[7],
          environ_sizes_get: j[8],
          fd_close: j[9],
          fd_filestat_get: j[4],
          fd_prestat_dir_name: j[11],
          fd_prestat_get: j[10],
          fd_read: j[5],
          fd_readdir: j[1],
          fd_write: j[6],
          path_filestat_get: j[2],
          path_open: j[0],
          proc_exit: j[12],
          random_get: j[3]
        }
      }), { exports: P } = yield et(yield b, {
        __main_module__: {
          cabi_realloc: le.cabi_realloc
        },
        env: {
          memory: le.memory
        },
        "wasi:cli/environment@0.2.3": {
          "get-environment": j[13]
        },
        "wasi:cli/exit@0.2.3": {
          exit: js
        },
        "wasi:cli/stderr@0.2.3": {
          "get-stderr": Bs
        },
        "wasi:cli/stdin@0.2.3": {
          "get-stdin": Ts
        },
        "wasi:cli/stdout@0.2.3": {
          "get-stdout": Cs
        },
        "wasi:cli/terminal-input@0.2.3": {
          "[resource-drop]terminal-input": cn
        },
        "wasi:cli/terminal-output@0.2.3": {
          "[resource-drop]terminal-output": ln
        },
        "wasi:cli/terminal-stderr@0.2.3": {
          "get-terminal-stderr": j[36]
        },
        "wasi:cli/terminal-stdin@0.2.3": {
          "get-terminal-stdin": j[34]
        },
        "wasi:cli/terminal-stdout@0.2.3": {
          "get-terminal-stdout": j[35]
        },
        "wasi:filesystem/preopens@0.2.3": {
          "get-directories": j[33]
        },
        "wasi:filesystem/types@0.2.3": {
          "[method]descriptor.append-via-stream": j[20],
          "[method]descriptor.get-type": j[14],
          "[method]descriptor.metadata-hash": j[15],
          "[method]descriptor.metadata-hash-at": j[17],
          "[method]descriptor.open-at": j[24],
          "[method]descriptor.read-directory": j[21],
          "[method]descriptor.read-via-stream": j[18],
          "[method]descriptor.stat": j[22],
          "[method]descriptor.stat-at": j[23],
          "[method]descriptor.write-via-stream": j[19],
          "[method]directory-entry-stream.read-directory-entry": j[25],
          "[resource-drop]descriptor": on,
          "[resource-drop]directory-entry-stream": rn,
          "filesystem-error-code": j[16]
        },
        "wasi:io/error@0.2.3": {
          "[resource-drop]error": sn
        },
        "wasi:io/streams@0.2.3": {
          "[method]input-stream.blocking-read": j[27],
          "[method]input-stream.read": j[26],
          "[method]output-stream.blocking-flush": j[31],
          "[method]output-stream.blocking-write-and-flush": j[30],
          "[method]output-stream.check-write": j[28],
          "[method]output-stream.write": j[29],
          "[resource-drop]input-stream": nn,
          "[resource-drop]output-stream": an
        },
        "wasi:random/random@0.2.3": {
          "get-random-bytes": j[32]
        }
      }), c = le.memory, re = P.cabi_import_realloc, { exports: tn } = yield et(yield r, {
        "": {
          $imports: j.$imports,
          0: P.path_open,
          1: P.fd_readdir,
          10: P.fd_prestat_get,
          11: P.fd_prestat_dir_name,
          12: P.proc_exit,
          13: Os,
          14: _s,
          15: Ss,
          16: xs,
          17: $s,
          18: Rs,
          19: Ns,
          2: P.path_filestat_get,
          20: Ls,
          21: Ms,
          22: Fs,
          23: Us,
          24: Ws,
          25: Ps,
          26: Ds,
          27: zs,
          28: Xs,
          29: Vs,
          3: P.random_get,
          30: Zs,
          31: Gs,
          32: Js,
          33: Hs,
          34: qs,
          35: Ks,
          36: en,
          4: P.fd_filestat_get,
          5: P.fd_read,
          6: P.fd_write,
          7: P.environ_get,
          8: P.environ_sizes_get,
          9: P.fd_close
        }
      }), Y = le.cabi_realloc, Pr = le.cabi_post_generate, le["cabi_post_generate-types"], zr = true, Dr = le.generate, le["generate-types"];
    }(), e, t, n;
    function s(d) {
      try {
        let f;
        do
          ({ value: d, done: f } = a.next(d));
        while (!(d instanceof Promise) && !f);
        if (f) if (t) t(d);
        else return d;
        e || (e = new Promise((b, o) => (t = b, n = o))), d.then(s, n);
      } catch (f) {
        if (n) n(f);
        else throw f;
      }
    }
    const u = s(null);
    return e || u;
  })();
  async function fn() {
    return await dn, un.apply(this, arguments);
  }
  class dt {
    visitType(e, t) {
      throw new Error("Not implemented");
    }
    visitNull(e, t) {
      return this.visitType(e, t);
    }
    visitNumber(e, t) {
      return this.visitType(e, t);
    }
    visitFixedNat(e, t) {
      return this.visitNumber(e, t);
    }
    visitVariant(e, t, n) {
      return this.visitType(e, n);
    }
    visitEnum(e, t, n) {
      return this.visitType(e, n);
    }
    visitFunc(e, t) {
      return this.visitType(e, t);
    }
    visitInterface(e, t) {
      return this.visitType(e, t);
    }
  }
  class $e {
  }
  class Xr extends $e {
    accept(e, t) {
      return e.visitNull(this, t);
    }
    get name() {
      return "null";
    }
  }
  class er extends $e {
    constructor(e) {
      super(), this._bits = e;
    }
    accept(e, t) {
      return e.visitFixedNat(this, t);
    }
    get name() {
      return `u${this._bits}`;
    }
  }
  class Vr extends $e {
    constructor(e) {
      super(), this._fields = e;
    }
    accept(e, t) {
      return e.visitVariant(this, this._fields, t);
    }
    get name() {
      return `variant { ${Object.entries(this._fields).map(([e, t]) => `${e}: ${t.name}`).join(", ")} }`;
    }
  }
  class Zr extends $e {
    constructor(e) {
      super(), this._tags = e;
    }
    accept(e, t) {
      return e.visitEnum(this, this._tags, t);
    }
    get name() {
      return `enum { ${this._tags.join(", ")} }`;
    }
  }
  class Gr extends $e {
    constructor(e, t) {
      super(), this._args = e, this._ret = t;
    }
    accept(e, t) {
      return e.visitFunc(this, t);
    }
    get name() {
      return `func(${this._args.map((e) => e[1].name).join(", ")}) -> (${this._ret.map((e) => e.name).join(", ")})`;
    }
  }
  class Jr extends $e {
    constructor(e, t) {
      super(), this._name = e, this._fields = t;
    }
    accept(e, t) {
      return e.visitInterface(this, t);
    }
    get name() {
      return `interface ${this._name}`;
    }
  }
  const Hr = new Xr(), bn = new er(32), pn = new er(64);
  function kn(a) {
    return new Zr(a);
  }
  function vn(a) {
    return new Vr(a);
  }
  function An(a, e) {
    return new Gr(a, e);
  }
  function mn(a, e) {
    return new Jr(a, e);
  }
  const yn = Object.freeze(Object.defineProperty({
    __proto__: null,
    Enum: kn,
    EnumClass: Zr,
    FixedNatClass: er,
    Func: An,
    FuncClass: Gr,
    Interface: mn,
    InterfaceClass: Jr,
    Null: Hr,
    NullClass: Xr,
    Type: $e,
    U32: bn,
    U64: pn,
    Variant: vn,
    VariantClass: Vr,
    Visitor: dt
  }, Symbol.toStringTag, {
    value: "Module"
  }));
  class wn {
    constructor(e, t) {
      __publicField(this, "status");
      __publicField(this, "label", null);
      __publicField(this, "value");
      this.idl = e, this.ui = t;
      const n = document.createElement("span");
      n.className = "status", this.status = n, t.input && (t.input.addEventListener("blur", () => {
        t.input.value !== "" && this.parse();
      }), t.input.addEventListener("input", () => {
        n.style.display = "none", t.input.classList.remove("reject");
      }));
    }
    isRejected() {
      return this.value === void 0;
    }
    parse(e = {}) {
      if (this.ui.form) {
        const t = this.ui.form.parse(e);
        return this.value = t, t;
      }
      if (this.ui.input) {
        const t = this.ui.input;
        try {
          const n = this.ui.parse(this.idl, e, t.value);
          return this.status.style.display = "none", this.value = n, n;
        } catch (n) {
          t.classList.add("reject"), this.status.style.display = "block", this.status.innerHTML = "InputError: " + n.message, this.value = void 0;
          return;
        }
      }
      return null;
    }
    render(e) {
      const t = document.createElement("span");
      if (this.label) {
        const n = document.createElement("label");
        n.innerText = this.label, t.appendChild(n);
      }
      this.ui.input && (t.appendChild(this.ui.input), t.appendChild(this.status)), this.ui.form && this.ui.form.render(t), e.appendChild(t);
    }
  }
  class Yr {
    constructor(e) {
      __publicField(this, "form", []);
      this.ui = e;
    }
    renderForm(e) {
      this.ui.container ? (this.form.forEach((t) => t.render(this.ui.container)), e.appendChild(this.ui.container)) : this.form.forEach((t) => t.render(e));
    }
    render(e) {
      if (this.ui.open && this.ui.event) {
        e.appendChild(this.ui.open);
        const t = this;
        t.ui.open.addEventListener(t.ui.event, () => {
          if (t.ui.container) t.ui.container.innerHTML = "";
          else {
            const n = t.ui.open.nextElementSibling;
            n && n.parentNode.removeChild(n);
          }
          t.generateForm(), t.renderForm(e);
        });
      } else this.generateForm(), this.renderForm(e);
    }
  }
  class hn extends Yr {
    constructor(e, t) {
      super(t), this.fields = e, this.ui = t;
    }
    generateForm() {
      const e = this.ui.open.selectedIndex, [t, n] = this.fields[e], s = this.ui.render(n);
      this.form = [
        s
      ];
    }
    parse(e) {
      const t = this.ui.open, n = t.options[t.selectedIndex].value, s = this.form[0].parse(e);
      if (s === void 0) return;
      const u = {};
      return u[n] = s, u;
    }
  }
  class gn extends Yr {
    constructor(e, t) {
      super(t), this.fields = e, this.ui = t;
    }
    generateForm() {
      this.form = [
        this.ui.render(Hr)
      ];
    }
    parse(e) {
      const t = this.ui.open;
      if (e.random && t.selectedIndex === -1) {
        const s = Math.floor(Math.random() * this.fields.length);
        return t.selectedIndex = s, this.ui.open.dispatchEvent(new Event("change")), this.fields[s];
      }
      return t.options[t.selectedIndex].value;
    }
  }
  const In = {
    parse: On
  }, qr = {
    render: Kr
  }, tt = (a, e) => new wn(a, {
    ...In,
    ...e
  }), En = (a, e) => new hn(a, {
    ...qr,
    ...e
  }), Bn = (a, e) => new gn(a, {
    ...qr,
    ...e
  });
  class Tn extends dt {
    visitType(e, t) {
      const n = document.createElement("input");
      return n.classList.add("argument"), n.placeholder = e.name, tt(e, {
        input: n
      });
    }
    visitNull(e, t) {
      return tt(e, {});
    }
    visitVariant(e, t, n) {
      const s = Object.entries(t), u = document.createElement("select");
      for (const [b, o] of s) {
        const r = new Option(b);
        u.add(r);
      }
      u.selectedIndex = -1, u.classList.add("open");
      const f = En(s, {
        open: u,
        event: "change"
      });
      return tt(e, {
        form: f
      });
    }
    visitEnum(e, t, n) {
      const s = document.createElement("select");
      for (const f of t) {
        const b = new Option(f);
        s.add(b);
      }
      s.selectedIndex = -1, s.classList.add("open");
      const d = Bn(t, {
        open: s,
        event: "change"
      });
      return tt(e, {
        form: d
      });
    }
  }
  class Cn extends dt {
    visitNull(e, t) {
      return null;
    }
    visitFixedNat(e, t) {
      return e._bits <= 32 ? parseInt(t, 10) : BigInt(t);
    }
    visitNumber(e, t) {
      return BigInt(t);
    }
  }
  class jn extends dt {
    visitNull(e, t) {
      return null;
    }
    visitFixedNat(e, t) {
      const n = this.generateNumber(false);
      return e._bits <= 32 ? n : BigInt(n);
    }
    generateNumber(e) {
      const t = Math.floor(Math.random() * 100);
      return e && Math.random() < 0.5 ? -t : t;
    }
  }
  function On(a, e, t) {
    return e.random && t === "" ? a.accept(new jn(), t) : a.accept(new Cn(), t);
  }
  function Kr(a) {
    return a.accept(new Tn(), null);
  }
  const { getEnvironment: _n } = lt, { exit: Sn } = Zt, { getStderr: xn } = Ht, { getStdin: $n } = Gt, { getStdout: Rn } = Jt, { getDirectories: Nn } = Xt, { Descriptor: je, filesystemErrorCode: Ln } = at, { Error: Oe } = Pt, { InputStream: Mt, OutputStream: ne } = Ze, { getRandomBytes: Qn } = Qr, br = (a) => WebAssembly.compile(typeof Buffer < "u" ? Buffer.from(a, "base64") : Uint8Array.from(atob(a), (e) => e.charCodeAt(0)));
  class Mn extends Error {
    constructor(e) {
      const t = typeof e != "string";
      super(t ? `${String(e)} (see error.payload)` : e), Object.defineProperty(this, "payload", {
        value: e,
        enumerable: t
      });
    }
  }
  let x = [], xt = new DataView(new ArrayBuffer());
  const y = (a) => xt.buffer === a.buffer ? xt : xt = new DataView(a.buffer), Fn = typeof process < "u" && process.versions && process.versions.node;
  let $t;
  async function pr(a) {
    return Fn ? ($t = $t || await Xe(() => import("./__vite-browser-external-BIHI7g3E.js"), []), WebAssembly.compile(await $t.readFile(a))) : fetch(a).then(WebAssembly.compileStreaming);
  }
  function ye(a) {
    if (a && Un.call(a, "payload")) return a.payload;
    if (a instanceof Error) throw a;
    return a;
  }
  const Un = Object.prototype.hasOwnProperty, rt = WebAssembly.instantiate, te = 1 << 30;
  function ce(a, e) {
    const t = a[0] & -1073741825;
    return t === 0 ? (a.push(0), a.push(e | te), (a.length >> 1) - 1) : (a[0] = a[t << 1], a[t << 1] = 0, a[(t << 1) + 1] = e | te, t);
  }
  function ft(a, e) {
    const t = a[e << 1], n = a[(e << 1) + 1], s = (n & te) !== 0, u = n & -1073741825;
    if (n === 0 || (t & te) !== 0) throw new TypeError("Invalid handle");
    return a[e << 1] = a[0] | te, a[0] = e | te, {
      rep: u,
      scope: t,
      own: s
    };
  }
  const ve = Symbol.for("cabiDispose"), _ = Symbol("handle"), L = Symbol.for("cabiRep"), Ae = Symbol.dispose || Symbol.for("dispose"), Le = (a) => BigInt.asUintN(64, BigInt(a));
  function Rt(a) {
    return a >>> 0;
  }
  const kr = new TextDecoder(), Wn = new TextEncoder();
  let Ve = 0;
  function Ft(a, e, t) {
    if (typeof a != "string") throw new TypeError("expected a string");
    if (a.length === 0) return Ve = 0, 1;
    let n = Wn.encode(a), s = e(0, 0, 1, n.length);
    return new Uint8Array(t.buffer).set(n, s), Ve = n.length, s;
  }
  let N, Ie;
  const pe = [
    te,
    0
  ], oe = /* @__PURE__ */ new Map();
  let bt = 0;
  function Pn() {
    const a = xn();
    if (!(a instanceof ne)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = a[_];
    if (!e) {
      const t = a[L] || ++bt;
      oe.set(t, a), e = ce(pe, t);
    }
    return e;
  }
  const ea = [
    te,
    0
  ], Ut = /* @__PURE__ */ new Map();
  let Dn = 0;
  function zn() {
    const a = $n();
    if (!(a instanceof Mt)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
    var e = a[_];
    if (!e) {
      const t = a[L] || ++Dn;
      Ut.set(t, a), e = ce(ea, t);
    }
    return e;
  }
  function Xn() {
    const a = Rn();
    if (!(a instanceof ne)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = a[_];
    if (!e) {
      const t = a[L] || ++bt;
      oe.set(t, a), e = ce(pe, t);
    }
    return e;
  }
  function Vn(a) {
    let e;
    switch (a) {
      case 0: {
        e = {
          tag: "ok",
          val: void 0
        };
        break;
      }
      case 1: {
        e = {
          tag: "err",
          val: void 0
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    Sn(e);
  }
  let Ee, v, Ce;
  function Zn(a) {
    var t = _n(), n = t.length, s = Ce(0, 0, 4, n * 16);
    for (let i = 0; i < t.length; i++) {
      const m = t[i], w = s + i * 16;
      var [u, d] = m, f = Ft(u, Ce, v), b = Ve;
      y(v).setInt32(w + 4, b, true), y(v).setInt32(w + 0, f, true);
      var o = Ft(d, Ce, v), r = Ve;
      y(v).setInt32(w + 12, r, true), y(v).setInt32(w + 8, o, true);
    }
    y(v).setInt32(a + 4, n, true), y(v).setInt32(a + 0, s, true);
  }
  const Ue = [
    te,
    0
  ], _e = /* @__PURE__ */ new Map();
  let pt = 0;
  function Gn(a, e) {
    var t = a, n = Ue[(t << 1) + 1] & -1073741825, s = _e.get(n);
    s || (s = Object.create(Oe.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    const u = Ln(s);
    for (const b of x) b[_] = void 0;
    x = [];
    var d = u;
    if (d == null) y(v).setInt8(e + 0, 0, true);
    else {
      const b = d;
      y(v).setInt8(e + 0, 1, true);
      var f = b;
      let o;
      switch (f) {
        case "access": {
          o = 0;
          break;
        }
        case "would-block": {
          o = 1;
          break;
        }
        case "already": {
          o = 2;
          break;
        }
        case "bad-descriptor": {
          o = 3;
          break;
        }
        case "busy": {
          o = 4;
          break;
        }
        case "deadlock": {
          o = 5;
          break;
        }
        case "quota": {
          o = 6;
          break;
        }
        case "exist": {
          o = 7;
          break;
        }
        case "file-too-large": {
          o = 8;
          break;
        }
        case "illegal-byte-sequence": {
          o = 9;
          break;
        }
        case "in-progress": {
          o = 10;
          break;
        }
        case "interrupted": {
          o = 11;
          break;
        }
        case "invalid": {
          o = 12;
          break;
        }
        case "io": {
          o = 13;
          break;
        }
        case "is-directory": {
          o = 14;
          break;
        }
        case "loop": {
          o = 15;
          break;
        }
        case "too-many-links": {
          o = 16;
          break;
        }
        case "message-size": {
          o = 17;
          break;
        }
        case "name-too-long": {
          o = 18;
          break;
        }
        case "no-device": {
          o = 19;
          break;
        }
        case "no-entry": {
          o = 20;
          break;
        }
        case "no-lock": {
          o = 21;
          break;
        }
        case "insufficient-memory": {
          o = 22;
          break;
        }
        case "insufficient-space": {
          o = 23;
          break;
        }
        case "not-directory": {
          o = 24;
          break;
        }
        case "not-empty": {
          o = 25;
          break;
        }
        case "not-recoverable": {
          o = 26;
          break;
        }
        case "unsupported": {
          o = 27;
          break;
        }
        case "no-tty": {
          o = 28;
          break;
        }
        case "no-such-device": {
          o = 29;
          break;
        }
        case "overflow": {
          o = 30;
          break;
        }
        case "not-permitted": {
          o = 31;
          break;
        }
        case "pipe": {
          o = 32;
          break;
        }
        case "read-only": {
          o = 33;
          break;
        }
        case "invalid-seek": {
          o = 34;
          break;
        }
        case "text-file-busy": {
          o = 35;
          break;
        }
        case "cross-device": {
          o = 36;
          break;
        }
        default:
          throw b instanceof Error && console.error(b), new TypeError(`"${f}" is not one of the cases of error-code`);
      }
      y(v).setInt8(e + 1, o, true);
    }
  }
  const We = [
    te,
    0
  ], Se = /* @__PURE__ */ new Map();
  let Jn = 0;
  function Hn(a, e, t) {
    var n = a, s = We[(n << 1) + 1] & -1073741825, u = Se.get(s);
    u || (u = Object.create(je.prototype), Object.defineProperty(u, _, {
      writable: true,
      value: n
    }), Object.defineProperty(u, L, {
      writable: true,
      value: s
    })), x.push(u);
    let d;
    try {
      d = {
        tag: "ok",
        val: u.writeViaStream(BigInt.asUintN(64, e))
      };
    } catch (r) {
      d = {
        tag: "err",
        val: ye(r)
      };
    }
    for (const r of x) r[_] = void 0;
    x = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const r = f.val;
        if (y(v).setInt8(t + 0, 0, true), !(r instanceof ne)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var b = r[_];
        if (!b) {
          const i = r[L] || ++bt;
          oe.set(i, r), b = ce(pe, i);
        }
        y(v).setInt32(t + 4, b, true);
        break;
      }
      case "err": {
        const r = f.val;
        y(v).setInt8(t + 0, 1, true);
        var o = r;
        let i;
        switch (o) {
          case "access": {
            i = 0;
            break;
          }
          case "would-block": {
            i = 1;
            break;
          }
          case "already": {
            i = 2;
            break;
          }
          case "bad-descriptor": {
            i = 3;
            break;
          }
          case "busy": {
            i = 4;
            break;
          }
          case "deadlock": {
            i = 5;
            break;
          }
          case "quota": {
            i = 6;
            break;
          }
          case "exist": {
            i = 7;
            break;
          }
          case "file-too-large": {
            i = 8;
            break;
          }
          case "illegal-byte-sequence": {
            i = 9;
            break;
          }
          case "in-progress": {
            i = 10;
            break;
          }
          case "interrupted": {
            i = 11;
            break;
          }
          case "invalid": {
            i = 12;
            break;
          }
          case "io": {
            i = 13;
            break;
          }
          case "is-directory": {
            i = 14;
            break;
          }
          case "loop": {
            i = 15;
            break;
          }
          case "too-many-links": {
            i = 16;
            break;
          }
          case "message-size": {
            i = 17;
            break;
          }
          case "name-too-long": {
            i = 18;
            break;
          }
          case "no-device": {
            i = 19;
            break;
          }
          case "no-entry": {
            i = 20;
            break;
          }
          case "no-lock": {
            i = 21;
            break;
          }
          case "insufficient-memory": {
            i = 22;
            break;
          }
          case "insufficient-space": {
            i = 23;
            break;
          }
          case "not-directory": {
            i = 24;
            break;
          }
          case "not-empty": {
            i = 25;
            break;
          }
          case "not-recoverable": {
            i = 26;
            break;
          }
          case "unsupported": {
            i = 27;
            break;
          }
          case "no-tty": {
            i = 28;
            break;
          }
          case "no-such-device": {
            i = 29;
            break;
          }
          case "overflow": {
            i = 30;
            break;
          }
          case "not-permitted": {
            i = 31;
            break;
          }
          case "pipe": {
            i = 32;
            break;
          }
          case "read-only": {
            i = 33;
            break;
          }
          case "invalid-seek": {
            i = 34;
            break;
          }
          case "text-file-busy": {
            i = 35;
            break;
          }
          case "cross-device": {
            i = 36;
            break;
          }
          default:
            throw r instanceof Error && console.error(r), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        y(v).setInt8(t + 4, i, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Yn(a, e) {
    var t = a, n = We[(t << 1) + 1] & -1073741825, s = Se.get(n);
    s || (s = Object.create(je.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.appendViaStream()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: ye(o)
      };
    }
    for (const o of x) o[_] = void 0;
    x = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (y(v).setInt8(e + 0, 0, true), !(o instanceof ne)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var f = o[_];
        if (!f) {
          const r = o[L] || ++bt;
          oe.set(r, o), f = ce(pe, r);
        }
        y(v).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        y(v).setInt8(e + 0, 1, true);
        var b = o;
        let r;
        switch (b) {
          case "access": {
            r = 0;
            break;
          }
          case "would-block": {
            r = 1;
            break;
          }
          case "already": {
            r = 2;
            break;
          }
          case "bad-descriptor": {
            r = 3;
            break;
          }
          case "busy": {
            r = 4;
            break;
          }
          case "deadlock": {
            r = 5;
            break;
          }
          case "quota": {
            r = 6;
            break;
          }
          case "exist": {
            r = 7;
            break;
          }
          case "file-too-large": {
            r = 8;
            break;
          }
          case "illegal-byte-sequence": {
            r = 9;
            break;
          }
          case "in-progress": {
            r = 10;
            break;
          }
          case "interrupted": {
            r = 11;
            break;
          }
          case "invalid": {
            r = 12;
            break;
          }
          case "io": {
            r = 13;
            break;
          }
          case "is-directory": {
            r = 14;
            break;
          }
          case "loop": {
            r = 15;
            break;
          }
          case "too-many-links": {
            r = 16;
            break;
          }
          case "message-size": {
            r = 17;
            break;
          }
          case "name-too-long": {
            r = 18;
            break;
          }
          case "no-device": {
            r = 19;
            break;
          }
          case "no-entry": {
            r = 20;
            break;
          }
          case "no-lock": {
            r = 21;
            break;
          }
          case "insufficient-memory": {
            r = 22;
            break;
          }
          case "insufficient-space": {
            r = 23;
            break;
          }
          case "not-directory": {
            r = 24;
            break;
          }
          case "not-empty": {
            r = 25;
            break;
          }
          case "not-recoverable": {
            r = 26;
            break;
          }
          case "unsupported": {
            r = 27;
            break;
          }
          case "no-tty": {
            r = 28;
            break;
          }
          case "no-such-device": {
            r = 29;
            break;
          }
          case "overflow": {
            r = 30;
            break;
          }
          case "not-permitted": {
            r = 31;
            break;
          }
          case "pipe": {
            r = 32;
            break;
          }
          case "read-only": {
            r = 33;
            break;
          }
          case "invalid-seek": {
            r = 34;
            break;
          }
          case "text-file-busy": {
            r = 35;
            break;
          }
          case "cross-device": {
            r = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${b}" is not one of the cases of error-code`);
        }
        y(v).setInt8(e + 4, r, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function qn(a, e) {
    var t = a, n = We[(t << 1) + 1] & -1073741825, s = Se.get(n);
    s || (s = Object.create(je.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.getType()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: ye(o)
      };
    }
    for (const o of x) o[_] = void 0;
    x = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        y(v).setInt8(e + 0, 0, true);
        var f = o;
        let r;
        switch (f) {
          case "unknown": {
            r = 0;
            break;
          }
          case "block-device": {
            r = 1;
            break;
          }
          case "character-device": {
            r = 2;
            break;
          }
          case "directory": {
            r = 3;
            break;
          }
          case "fifo": {
            r = 4;
            break;
          }
          case "symbolic-link": {
            r = 5;
            break;
          }
          case "regular-file": {
            r = 6;
            break;
          }
          case "socket": {
            r = 7;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${f}" is not one of the cases of descriptor-type`);
        }
        y(v).setInt8(e + 1, r, true);
        break;
      }
      case "err": {
        const o = d.val;
        y(v).setInt8(e + 0, 1, true);
        var b = o;
        let r;
        switch (b) {
          case "access": {
            r = 0;
            break;
          }
          case "would-block": {
            r = 1;
            break;
          }
          case "already": {
            r = 2;
            break;
          }
          case "bad-descriptor": {
            r = 3;
            break;
          }
          case "busy": {
            r = 4;
            break;
          }
          case "deadlock": {
            r = 5;
            break;
          }
          case "quota": {
            r = 6;
            break;
          }
          case "exist": {
            r = 7;
            break;
          }
          case "file-too-large": {
            r = 8;
            break;
          }
          case "illegal-byte-sequence": {
            r = 9;
            break;
          }
          case "in-progress": {
            r = 10;
            break;
          }
          case "interrupted": {
            r = 11;
            break;
          }
          case "invalid": {
            r = 12;
            break;
          }
          case "io": {
            r = 13;
            break;
          }
          case "is-directory": {
            r = 14;
            break;
          }
          case "loop": {
            r = 15;
            break;
          }
          case "too-many-links": {
            r = 16;
            break;
          }
          case "message-size": {
            r = 17;
            break;
          }
          case "name-too-long": {
            r = 18;
            break;
          }
          case "no-device": {
            r = 19;
            break;
          }
          case "no-entry": {
            r = 20;
            break;
          }
          case "no-lock": {
            r = 21;
            break;
          }
          case "insufficient-memory": {
            r = 22;
            break;
          }
          case "insufficient-space": {
            r = 23;
            break;
          }
          case "not-directory": {
            r = 24;
            break;
          }
          case "not-empty": {
            r = 25;
            break;
          }
          case "not-recoverable": {
            r = 26;
            break;
          }
          case "unsupported": {
            r = 27;
            break;
          }
          case "no-tty": {
            r = 28;
            break;
          }
          case "no-such-device": {
            r = 29;
            break;
          }
          case "overflow": {
            r = 30;
            break;
          }
          case "not-permitted": {
            r = 31;
            break;
          }
          case "pipe": {
            r = 32;
            break;
          }
          case "read-only": {
            r = 33;
            break;
          }
          case "invalid-seek": {
            r = 34;
            break;
          }
          case "text-file-busy": {
            r = 35;
            break;
          }
          case "cross-device": {
            r = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${b}" is not one of the cases of error-code`);
        }
        y(v).setInt8(e + 1, r, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Kn(a, e) {
    var t = a, n = We[(t << 1) + 1] & -1073741825, s = Se.get(n);
    s || (s = Object.create(je.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.stat()
      };
    } catch (S) {
      u = {
        tag: "err",
        val: ye(S)
      };
    }
    for (const S of x) S[_] = void 0;
    x = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const S = d.val;
        y(v).setInt8(e + 0, 0, true);
        var { type: f, linkCount: b, size: o, dataAccessTimestamp: r, dataModificationTimestamp: i, statusChangeTimestamp: m } = S, w = f;
        let p;
        switch (w) {
          case "unknown": {
            p = 0;
            break;
          }
          case "block-device": {
            p = 1;
            break;
          }
          case "character-device": {
            p = 2;
            break;
          }
          case "directory": {
            p = 3;
            break;
          }
          case "fifo": {
            p = 4;
            break;
          }
          case "symbolic-link": {
            p = 5;
            break;
          }
          case "regular-file": {
            p = 6;
            break;
          }
          case "socket": {
            p = 7;
            break;
          }
          default:
            throw f instanceof Error && console.error(f), new TypeError(`"${w}" is not one of the cases of descriptor-type`);
        }
        y(v).setInt8(e + 8, p, true), y(v).setBigInt64(e + 16, Le(b), true), y(v).setBigInt64(e + 24, Le(o), true);
        var A = r;
        if (A == null) y(v).setInt8(e + 32, 0, true);
        else {
          const F = A;
          y(v).setInt8(e + 32, 1, true);
          var { seconds: k, nanoseconds: T } = F;
          y(v).setBigInt64(e + 40, Le(k), true), y(v).setInt32(e + 48, Rt(T), true);
        }
        var $ = i;
        if ($ == null) y(v).setInt8(e + 56, 0, true);
        else {
          const F = $;
          y(v).setInt8(e + 56, 1, true);
          var { seconds: B, nanoseconds: K } = F;
          y(v).setBigInt64(e + 64, Le(B), true), y(v).setInt32(e + 72, Rt(K), true);
        }
        var R = m;
        if (R == null) y(v).setInt8(e + 80, 0, true);
        else {
          const F = R;
          y(v).setInt8(e + 80, 1, true);
          var { seconds: I, nanoseconds: we } = F;
          y(v).setBigInt64(e + 88, Le(I), true), y(v).setInt32(e + 96, Rt(we), true);
        }
        break;
      }
      case "err": {
        const S = d.val;
        y(v).setInt8(e + 0, 1, true);
        var ie = S;
        let p;
        switch (ie) {
          case "access": {
            p = 0;
            break;
          }
          case "would-block": {
            p = 1;
            break;
          }
          case "already": {
            p = 2;
            break;
          }
          case "bad-descriptor": {
            p = 3;
            break;
          }
          case "busy": {
            p = 4;
            break;
          }
          case "deadlock": {
            p = 5;
            break;
          }
          case "quota": {
            p = 6;
            break;
          }
          case "exist": {
            p = 7;
            break;
          }
          case "file-too-large": {
            p = 8;
            break;
          }
          case "illegal-byte-sequence": {
            p = 9;
            break;
          }
          case "in-progress": {
            p = 10;
            break;
          }
          case "interrupted": {
            p = 11;
            break;
          }
          case "invalid": {
            p = 12;
            break;
          }
          case "io": {
            p = 13;
            break;
          }
          case "is-directory": {
            p = 14;
            break;
          }
          case "loop": {
            p = 15;
            break;
          }
          case "too-many-links": {
            p = 16;
            break;
          }
          case "message-size": {
            p = 17;
            break;
          }
          case "name-too-long": {
            p = 18;
            break;
          }
          case "no-device": {
            p = 19;
            break;
          }
          case "no-entry": {
            p = 20;
            break;
          }
          case "no-lock": {
            p = 21;
            break;
          }
          case "insufficient-memory": {
            p = 22;
            break;
          }
          case "insufficient-space": {
            p = 23;
            break;
          }
          case "not-directory": {
            p = 24;
            break;
          }
          case "not-empty": {
            p = 25;
            break;
          }
          case "not-recoverable": {
            p = 26;
            break;
          }
          case "unsupported": {
            p = 27;
            break;
          }
          case "no-tty": {
            p = 28;
            break;
          }
          case "no-such-device": {
            p = 29;
            break;
          }
          case "overflow": {
            p = 30;
            break;
          }
          case "not-permitted": {
            p = 31;
            break;
          }
          case "pipe": {
            p = 32;
            break;
          }
          case "read-only": {
            p = 33;
            break;
          }
          case "invalid-seek": {
            p = 34;
            break;
          }
          case "text-file-busy": {
            p = 35;
            break;
          }
          case "cross-device": {
            p = 36;
            break;
          }
          default:
            throw S instanceof Error && console.error(S), new TypeError(`"${ie}" is not one of the cases of error-code`);
        }
        y(v).setInt8(e + 8, p, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function eo(a, e) {
    var t = a, n = pe[(t << 1) + 1] & -1073741825, s = oe.get(n);
    s || (s = Object.create(ne.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.checkWrite()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: ye(o)
      };
    }
    for (const o of x) o[_] = void 0;
    x = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        y(v).setInt8(e + 0, 0, true), y(v).setBigInt64(e + 8, Le(o), true);
        break;
      }
      case "err": {
        const o = d.val;
        y(v).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const r = f.val;
            if (y(v).setInt8(e + 8, 0, true), !(r instanceof Oe)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var b = r[_];
            if (!b) {
              const i = r[L] || ++pt;
              _e.set(i, r), b = ce(Ue, i);
            }
            y(v).setInt32(e + 12, b, true);
            break;
          }
          case "closed": {
            y(v).setInt8(e + 8, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(f.tag)}\` (received \`${f}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function to(a, e, t, n) {
    var s = a, u = pe[(s << 1) + 1] & -1073741825, d = oe.get(u);
    d || (d = Object.create(ne.prototype), Object.defineProperty(d, _, {
      writable: true,
      value: s
    }), Object.defineProperty(d, L, {
      writable: true,
      value: u
    })), x.push(d);
    var f = e, b = t, o = new Uint8Array(v.buffer.slice(f, f + b * 1));
    let r;
    try {
      r = {
        tag: "ok",
        val: d.write(o)
      };
    } catch (A) {
      r = {
        tag: "err",
        val: ye(A)
      };
    }
    for (const A of x) A[_] = void 0;
    x = [];
    var i = r;
    switch (i.tag) {
      case "ok": {
        i.val, y(v).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const A = i.val;
        y(v).setInt8(n + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (y(v).setInt8(n + 4, 0, true), !(k instanceof Oe)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[_];
            if (!w) {
              const T = k[L] || ++pt;
              _e.set(T, k), w = ce(Ue, T);
            }
            y(v).setInt32(n + 8, w, true);
            break;
          }
          case "closed": {
            y(v).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function ro(a, e) {
    var t = a, n = pe[(t << 1) + 1] & -1073741825, s = oe.get(n);
    s || (s = Object.create(ne.prototype), Object.defineProperty(s, _, {
      writable: true,
      value: t
    }), Object.defineProperty(s, L, {
      writable: true,
      value: n
    })), x.push(s);
    let u;
    try {
      u = {
        tag: "ok",
        val: s.blockingFlush()
      };
    } catch (o) {
      u = {
        tag: "err",
        val: ye(o)
      };
    }
    for (const o of x) o[_] = void 0;
    x = [];
    var d = u;
    switch (d.tag) {
      case "ok": {
        d.val, y(v).setInt8(e + 0, 0, true);
        break;
      }
      case "err": {
        const o = d.val;
        y(v).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const r = f.val;
            if (y(v).setInt8(e + 4, 0, true), !(r instanceof Oe)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var b = r[_];
            if (!b) {
              const i = r[L] || ++pt;
              _e.set(i, r), b = ce(Ue, i);
            }
            y(v).setInt32(e + 8, b, true);
            break;
          }
          case "closed": {
            y(v).setInt8(e + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(f.tag)}\` (received \`${f}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function ao(a, e, t, n) {
    var s = a, u = pe[(s << 1) + 1] & -1073741825, d = oe.get(u);
    d || (d = Object.create(ne.prototype), Object.defineProperty(d, _, {
      writable: true,
      value: s
    }), Object.defineProperty(d, L, {
      writable: true,
      value: u
    })), x.push(d);
    var f = e, b = t, o = new Uint8Array(v.buffer.slice(f, f + b * 1));
    let r;
    try {
      r = {
        tag: "ok",
        val: d.blockingWriteAndFlush(o)
      };
    } catch (A) {
      r = {
        tag: "err",
        val: ye(A)
      };
    }
    for (const A of x) A[_] = void 0;
    x = [];
    var i = r;
    switch (i.tag) {
      case "ok": {
        i.val, y(v).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const A = i.val;
        y(v).setInt8(n + 0, 1, true);
        var m = A;
        switch (m.tag) {
          case "last-operation-failed": {
            const k = m.val;
            if (y(v).setInt8(n + 4, 0, true), !(k instanceof Oe)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var w = k[_];
            if (!w) {
              const T = k[L] || ++pt;
              _e.set(T, k), w = ce(Ue, T);
            }
            y(v).setInt32(n + 8, w, true);
            break;
          }
          case "closed": {
            y(v).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(m.tag)}\` (received \`${m}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function so(a, e) {
    var n = Qn(BigInt.asUintN(64, a)), s = n.byteLength, u = Ce(0, 0, 1, s * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, s * 1);
    new Uint8Array(v.buffer, u, s * 1).set(d), y(v).setInt32(e + 4, s, true), y(v).setInt32(e + 0, u, true);
  }
  function no(a) {
    var t = Nn(), n = t.length, s = Ce(0, 0, 4, n * 12);
    for (let r = 0; r < t.length; r++) {
      const i = t[r], m = s + r * 12;
      var [u, d] = i;
      if (!(u instanceof je)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      var f = u[_];
      if (!f) {
        const w = u[L] || ++Jn;
        Se.set(w, u), f = ce(We, w);
      }
      y(v).setInt32(m + 0, f, true);
      var b = Ft(d, Ce, v), o = Ve;
      y(v).setInt32(m + 8, o, true), y(v).setInt32(m + 4, b, true);
    }
    y(v).setInt32(a + 4, n, true), y(v).setInt32(a + 0, s, true);
  }
  let oo, ta, ra;
  function co(a) {
    const e = ft(We, a);
    if (e.own) {
      const t = Se.get(e.rep);
      t ? (t[Ae] && t[Ae](), Se.delete(e.rep)) : je[ve] && je[ve](e.rep);
    }
  }
  function io(a) {
    const e = ft(pe, a);
    if (e.own) {
      const t = oe.get(e.rep);
      t ? (t[Ae] && t[Ae](), oe.delete(e.rep)) : ne[ve] && ne[ve](e.rep);
    }
  }
  function lo(a) {
    const e = ft(Ue, a);
    if (e.own) {
      const t = _e.get(e.rep);
      t ? (t[Ae] && t[Ae](), _e.delete(e.rep)) : Oe[ve] && Oe[ve](e.rep);
    }
  }
  function uo(a) {
    const e = ft(ea, a);
    if (e.own) {
      const t = Ut.get(e.rep);
      t ? (t[Ae] && t[Ae](), Ut.delete(e.rep)) : Mt[ve] && Mt[ve](e.rep);
    }
  }
  let aa;
  function fo(a) {
    var e = a, t = e.byteLength, n = ta(0, 0, 1, t * 1), s = new Uint8Array(e.buffer || e, e.byteOffset, t * 1);
    new Uint8Array(v.buffer, n, t * 1).set(s);
    const u = aa(n, t);
    let d;
    switch (y(v).getUint8(u + 0, true)) {
      case 0: {
        var f = y(v).getInt32(u + 4, true), b = y(v).getInt32(u + 8, true), o = kr.decode(new Uint8Array(v.buffer, f, b));
        d = {
          tag: "ok",
          val: o
        };
        break;
      }
      case 1: {
        var r = y(v).getInt32(u + 4, true), i = y(v).getInt32(u + 8, true), m = kr.decode(new Uint8Array(v.buffer, r, i));
        d = {
          tag: "err",
          val: m
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    const w = d;
    if (ra(u), typeof w == "object" && w.tag === "err") throw new Mn(w.val);
    return w.val;
  }
  const bo = (() => {
    let a = function* () {
      const f = pr(new URL("/component-ui/assets/bindgen.core-ChkdFi2S.wasm", import.meta.url)), b = pr(new URL("/component-ui/assets/bindgen.core2-DuTXfUwR.wasm", import.meta.url)), o = br("AGFzbQEAAAABLghgBH9/f38Bf2ACf38Bf2ABfwBgAX8AYAJ/fwBgA39+fwBgBH9/f38AYAJ+fwADEhEAAQEBAgMEBQQEBAQGBAYHAwQFAXABEREHVxIBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABAIJGltcG9ydHMBAArVAREPACAAIAEgAiADQQARAAALCwAgACABQQERAQALCwAgACABQQIRAQALCwAgACABQQMRAQALCQAgAEEEEQIACwkAIABBBREDAAsLACAAIAFBBhEEAAsNACAAIAEgAkEHEQUACwsAIAAgAUEIEQQACwsAIAAgAUEJEQQACwsAIAAgAUEKEQQACwsAIAAgAUELEQQACw8AIAAgASACIANBDBEGAAsLACAAIAFBDREEAAsPACAAIAEgAiADQQ4RBgALCwAgACABQQ8RBwALCQAgAEEQEQMACwAvCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BzAuMjIwLjEA9QcEbmFtZQATEndpdC1jb21wb25lbnQ6c2hpbQHYBxEAJWFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfd3JpdGUBJ2FkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtcmFuZG9tX2dldAIoYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX2dldAMuYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX3NpemVzX2dldAQmYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wcm9jX2V4aXQFM2luZGlyZWN0LXdhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wLWdldC1lbnZpcm9ubWVudAY6aW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLWZpbGVzeXN0ZW0tZXJyb3ItY29kZQdIaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLVttZXRob2RdZGVzY3JpcHRvci53cml0ZS12aWEtc3RyZWFtCElpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLmFwcGVuZC12aWEtc3RyZWFtCUBpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLmdldC10eXBlCjxpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLnN0YXQLQGluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uY2hlY2std3JpdGUMOmluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUNQ2luZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gOTWluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctd3JpdGUtYW5kLWZsdXNoDzJpbmRpcmVjdC13YXNpOnJhbmRvbS9yYW5kb21AMC4yLjAtZ2V0LXJhbmRvbS1ieXRlcxA3aW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3ByZW9wZW5zQDAuMi4wLWdldC1kaXJlY3Rvcmllcw"), r = br("AGFzbQEAAAABLghgBH9/f38Bf2ACf38Bf2ABfwBgAX8AYAJ/fwBgA39+fwBgBH9/f38AYAJ+fwACbBIAATAAAAABMQABAAEyAAEAATMAAQABNAACAAE1AAMAATYABAABNwAFAAE4AAQAATkABAACMTAABAACMTEABAACMTIABgACMTMABAACMTQABgACMTUABwACMTYAAwAIJGltcG9ydHMBcAEREQkXAQBBAAsRAAECAwQFBgcICQoLDA0ODxAALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjIyMC4xABwEbmFtZQAVFHdpdC1jb21wb25lbnQ6Zml4dXBz");
      ({ exports: N } = yield rt(yield o)), { exports: Ie } = yield rt(yield f, {
        wasi_snapshot_preview1: {
          environ_get: N[2],
          environ_sizes_get: N[3],
          fd_write: N[0],
          proc_exit: N[4],
          random_get: N[1]
        }
      }), { exports: Ee } = yield rt(yield b, {
        __main_module__: {
          cabi_realloc: Ie.cabi_realloc
        },
        env: {
          memory: Ie.memory
        },
        "wasi:cli/environment@0.2.0": {
          "get-environment": N[5]
        },
        "wasi:cli/exit@0.2.0": {
          exit: Vn
        },
        "wasi:cli/stderr@0.2.0": {
          "get-stderr": Pn
        },
        "wasi:cli/stdin@0.2.0": {
          "get-stdin": zn
        },
        "wasi:cli/stdout@0.2.0": {
          "get-stdout": Xn
        },
        "wasi:filesystem/preopens@0.2.0": {
          "get-directories": N[16]
        },
        "wasi:filesystem/types@0.2.0": {
          "[method]descriptor.append-via-stream": N[8],
          "[method]descriptor.get-type": N[9],
          "[method]descriptor.stat": N[10],
          "[method]descriptor.write-via-stream": N[7],
          "[resource-drop]descriptor": co,
          "filesystem-error-code": N[6]
        },
        "wasi:io/error@0.2.0": {
          "[resource-drop]error": lo
        },
        "wasi:io/streams@0.2.0": {
          "[method]output-stream.blocking-flush": N[13],
          "[method]output-stream.blocking-write-and-flush": N[14],
          "[method]output-stream.check-write": N[11],
          "[method]output-stream.write": N[12],
          "[resource-drop]input-stream": uo,
          "[resource-drop]output-stream": io
        },
        "wasi:random/random@0.2.0": {
          "get-random-bytes": N[15]
        }
      }), v = Ie.memory, Ce = Ee.cabi_import_realloc, { exports: oo } = yield rt(yield r, {
        "": {
          $imports: N.$imports,
          0: Ee.fd_write,
          1: Ee.random_get,
          10: Kn,
          11: eo,
          12: to,
          13: ro,
          14: ao,
          15: so,
          16: no,
          2: Ee.environ_get,
          3: Ee.environ_sizes_get,
          4: Ee.proc_exit,
          5: Zn,
          6: Gn,
          7: Hn,
          8: Yn,
          9: qn
        }
      }), ta = Ie.cabi_realloc, ra = Ie["cabi_post_generate-ast"], aa = Ie["generate-ast"];
    }(), e, t, n;
    function s(d) {
      try {
        let f;
        do
          ({ value: d, done: f } = a.next(d));
        while (!(d instanceof Promise) && !f);
        if (f) if (t) t(d);
        else return d;
        e || (e = new Promise((b, o) => (t = b, n = o))), d.then(s, n);
      } catch (f) {
        if (n) n(f);
        else throw f;
      }
    }
    const u = s(null);
    return e || u;
  })();
  await bo;
  let sa = [];
  async function po(a) {
    const t = await fn(a, {
      name: "test",
      noNodejsCompat: true,
      noTypescript: true,
      base64Cutoff: 1e6,
      instantiation: {
        tag: "async"
      },
      map: [
        [
          "wasi:cli/*",
          "@bytecodealliance/preview2-shim/cli#*"
        ],
        [
          "wasi:clocks/*",
          "@bytecodealliance/preview2-shim/clocks#*"
        ],
        [
          "wasi:filesystem/*",
          "@bytecodealliance/preview2-shim/filesystem#*"
        ],
        [
          "wasi:http/*",
          "@bytecodealliance/preview2-shim/http#*"
        ],
        [
          "wasi:io/*",
          "@bytecodealliance/preview2-shim/io#*"
        ],
        [
          "wasi:random/*",
          "@bytecodealliance/preview2-shim/random#*"
        ],
        [
          "wasi:sockets/*",
          "@bytecodealliance/preview2-shim/sockets#*"
        ]
      ]
    });
    console.log(t);
    const n = fo(a);
    return console.log(n), sa = (await import(URL.createObjectURL(new Blob([
      n
    ], {
      type: "text/javascript"
    }))).then(async (m) => {
      await m.__tla;
      return m;
    })).Factory({
      IDL: yn
    }), t;
  }
  const na = {};
  let Wt;
  async function ko(a) {
    const e = {
      "@bytecodealliance/preview2-shim/cli": await Xe(() => Promise.resolve().then(() => is), []),
      "@bytecodealliance/preview2-shim/filesystem": await Xe(() => Promise.resolve().then(() => qa), void 0),
      "@bytecodealliance/preview2-shim/io": await Xe(() => Promise.resolve().then(() => Va), void 0)
    };
    for (const d of a.imports) if (!d.startsWith("@bytecodealliance/preview2-shim/")) {
      const f = na[d], o = await import(URL.createObjectURL(new Blob([
        f.value
      ], {
        type: "text/javascript"
      }))).then(async (m) => {
        await m.__tla;
        return m;
      });
      e[d] = o;
    }
    const t = a.files.find(([d, f]) => d === "test.js")[1], n = URL.createObjectURL(new Blob([
      t
    ], {
      type: "text/javascript"
    })), { instantiate: s } = await import(n).then(async (m) => {
      await m.__tla;
      return m;
    });
    let u = await s((d, f) => {
      const b = a.files.find((r) => r[0] === d)[1];
      return WebAssembly.compile(b);
    }, e);
    console.log(u), Wt = u;
  }
  async function vo(a) {
    if (a instanceof File) return new Promise((e, t) => {
      const n = new FileReader();
      n.onload = (s) => {
        s.target && s.target.result ? e(new Uint8Array(s.target.result)) : t(new Error("Failed to read file."));
      }, n.onerror = (s) => {
        t(s);
      }, n.readAsArrayBuffer(a);
    });
    {
      const e = new URL("/component-ui/" + a, window.location.origin);
      return new Uint8Array(await (await fetch(e)).arrayBuffer());
    }
  }
  async function vr(a) {
    const e = await vo(a), t = await po(e);
    yo(t);
  }
  function Ao() {
    document.querySelector("#preselectedWasmFile").addEventListener("change", async (t) => {
      const n = t.target;
      vr(n.value);
    }), document.getElementById("wasmFileInput").addEventListener("change", async (t) => {
      const n = t.target;
      if (n.files && n.files.length > 0) {
        const s = n.files[0];
        vr(s);
      }
    });
  }
  function mo() {
    const a = document.getElementById("exports");
    a.innerHTML = "";
    for (const e of sa) {
      const t = e._name, n = document.createElement("div");
      n.innerHTML = `Interface ${t}`, a.appendChild(n);
      for (const [s, u] of Object.entries(e._fields)) {
        const d = document.createElement("li");
        a.appendChild(d), d.innerHTML = `<li>${s}: (${u._args.map((m) => m[1].name).join(", ")}) -> (${u._ret.map((m) => m.name).join(", ")})</li>`;
        const f = document.createElement("div");
        d.appendChild(f);
        const b = [];
        u._args.forEach(([m, w]) => {
          const A = Kr(w);
          A.label = `${m} `, b.push(A), A.render(f);
        });
        const o = document.createElement("div"), r = document.createElement("button");
        r.innerText = "Call", o.appendChild(r);
        const i = document.createElement("button");
        i.innerText = "Random", o.appendChild(i), d.appendChild(o), r.addEventListener("click", async () => {
          const m = b.map((A) => A.parse());
          b.some((A) => A.isRejected()) || await Ar(t, s, m);
        }), i.addEventListener("click", async () => {
          const m = b.map((A) => A.parse({
            random: true
          }));
          b.some((A) => A.isRejected()) || await Ar(t, s, m);
        });
      }
    }
  }
  async function Ar(a, e, t) {
    const n = document.getElementById("logs");
    n.innerHTML += `<div>${e}(${t.join(", ")})</div>`;
    let s = Wt;
    a !== "UNNAMED" && (s = Wt[a]);
    const u = await s[e](...t);
    n.innerHTML += `<div>Result: ${u}</div>`;
  }
  function yo(a) {
    const e = document.querySelector("#app");
    e.innerHTML = `
  <div id="imports"></div>
  <div><button id="instantiate">Instantiate</button></div>
  <div>
   <ul id="exports"></ul>
  </div>
  <div id="logs"></div>
  `;
    const t = document.getElementById("imports"), n = document.getElementById("instantiate");
    for (const s of a.imports) {
      const u = document.createElement("div");
      if (t.appendChild(u), !s.startsWith("@bytecodealliance/preview2-shim/")) {
        u.innerHTML = `<li>Provide import ${s}</li>`;
        const d = document.createElement("textarea");
        d.style.width = "28em", d.style.height = "3em", s === "docs:adder/add" && (d.value = "export function add(a, b) { return a + b }"), na[s] = d, u.appendChild(d);
      }
    }
    n.onclick = async () => {
      await ko(a), mo();
    };
  }
  Ao();
})();
