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
  var _t, _e, _r2, _a2;
  (function() {
    const e = document.createElement("link").relList;
    if (e && e.supports && e.supports("modulepreload")) return;
    for (const a of document.querySelectorAll('link[rel="modulepreload"]')) n(a);
    new MutationObserver((a) => {
      for (const i of a) if (i.type === "childList") for (const d of i.addedNodes) d.tagName === "LINK" && d.rel === "modulepreload" && n(d);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function t(a) {
      const i = {};
      return a.integrity && (i.integrity = a.integrity), a.referrerPolicy && (i.referrerPolicy = a.referrerPolicy), a.crossOrigin === "use-credentials" ? i.credentials = "include" : a.crossOrigin === "anonymous" ? i.credentials = "omit" : i.credentials = "same-origin", i;
    }
    function n(a) {
      if (a.ep) return;
      a.ep = true;
      const i = t(a);
      fetch(a.href, i);
    }
  })();
  const sa = "modulepreload", aa = function(r) {
    return "/component-ui/" + r;
  }, Er = {}, fe = function(e, t, n) {
    let a = Promise.resolve();
    if (t && t.length > 0) {
      document.getElementsByTagName("link");
      const d = document.querySelector("meta[property=csp-nonce]"), f = (d == null ? void 0 : d.nonce) || (d == null ? void 0 : d.getAttribute("nonce"));
      a = Promise.allSettled(t.map((p) => {
        if (p = aa(p), p in Er) return;
        Er[p] = true;
        const o = p.endsWith(".css"), s = o ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${p}"]${s}`)) return;
        const c = document.createElement("link");
        if (c.rel = o ? "stylesheet" : sa, o || (c.as = "script"), c.crossOrigin = "", c.href = p, f && c.setAttribute("nonce", f), document.head.appendChild(c), o) return new Promise((y, A) => {
          c.addEventListener("load", y), c.addEventListener("error", () => A(new Error(`Unable to preload CSS for ${p}`)));
        });
      }));
    }
    function i(d) {
      const f = new Event("vite:preloadError", {
        cancelable: true
      });
      if (f.payload = d, window.dispatchEvent(f), !f.defaultPrevented) throw d;
    }
    return a.then((d) => {
      for (const f of d || []) f.status === "rejected" && i(f.reason);
      return e().catch(i);
    });
  };
  let Lr = 0;
  const Nr = Symbol.dispose || Symbol.for("dispose"), na = class {
    constructor(e) {
      this.msg = e;
    }
    toDebugString() {
      return this.msg;
    }
  };
  let oa = class {
    constructor(e) {
      e || console.trace("no handler"), this.id = ++Lr, this.handler = e;
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
    [Nr]() {
      this.handler.drop && this.handler.drop.call(this);
    }
  }, ia = class {
    constructor(e) {
      e || console.trace("no handler"), this.id = ++Lr, this.open = true, this.handler = e;
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
      const n = Math.min(t, this.checkWrite.call(this)), a = e.read(n);
      return this.write.call(this, a), a.byteLength;
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
    [Nr]() {
    }
  };
  const er = {
    Error: na
  }, Ye = {
    InputStream: oa,
    OutputStream: ia
  };
  class ca {
  }
  function la(r) {
  }
  function ua(r) {
  }
  const da = {
    Pollable: ca,
    pollList: la,
    pollOne: ua
  }, fa = Object.freeze(Object.defineProperty({
    __proto__: null,
    error: er,
    poll: da,
    streams: Ye
  }, Symbol.toStringTag, {
    value: "Module"
  })), { InputStream: pa, OutputStream: ba } = Ye;
  let Mr = "/";
  function tr(r) {
    Mr = r;
  }
  function va(r) {
    rr = r, Xt[0] = new qe(r);
    const e = vt.initialCwd();
    tr(e || "/");
  }
  function ka() {
    return JSON.stringify(rr);
  }
  let rr = {
    dir: {}
  };
  const Fe = {
    seconds: BigInt(0),
    nanoseconds: 0
  };
  function Nt(r, e, t) {
    e === "." && Xt && ma(Xt[0]) === r && (e = Mr, e.startsWith("/") && e !== "/" && (e = e.slice(1)));
    let n = r, a;
    do {
      if (!n || !n.dir) throw "not-directory";
      a = e.indexOf("/");
      const i = a === -1 ? e : e.slice(0, a);
      if (i === "..") throw "no-entry";
      i === "." || i === "" || (!n.dir[i] && t.create ? n = n.dir[i] = t.directory ? {
        dir: {}
      } : {
        source: new Uint8Array([])
      } : n = n.dir[i]), e = e.slice(a + 1);
    } while (a !== -1);
    if (!n) throw "no-entry";
    return n;
  }
  function ot(r) {
    return typeof r.source == "string" && (r.source = new TextEncoder().encode(r.source)), r.source;
  }
  let Fr = class {
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
  }, qe = (_a2 = class {
    constructor(e, t) {
      __privateAdd(this, _t);
      __privateAdd(this, _e);
      __privateAdd(this, _r2, 0);
      t ? __privateSet(this, _t, e) : __privateSet(this, _e, e);
    }
    _getEntry(e) {
      return __privateGet(e, _e);
    }
    readViaStream(e) {
      const t = ot(__privateGet(this, _e));
      let n = Number(e);
      return new pa({
        blockingRead(a) {
          if (n === t.byteLength) throw {
            tag: "closed"
          };
          const i = t.slice(n, n + Number(a));
          return n += i.byteLength, i;
        }
      });
    }
    writeViaStream(e) {
      const t = __privateGet(this, _e);
      let n = Number(e);
      return new ba({
        write(a) {
          const i = new Uint8Array(a.byteLength + t.source.byteLength);
          return i.set(t.source, 0), i.set(a, n), n += a.byteLength, t.source = i, a.byteLength;
        }
      });
    }
    appendViaStream() {
      console.log("[filesystem] APPEND STREAM");
    }
    advise(e, t, n, a) {
      console.log("[filesystem] ADVISE", e, t, n, a);
    }
    syncData() {
      console.log("[filesystem] SYNC DATA");
    }
    getFlags() {
      console.log("[filesystem] FLAGS FOR");
    }
    getType() {
      return __privateGet(this, _t) ? "fifo" : __privateGet(this, _e).dir ? "directory" : __privateGet(this, _e).source ? "regular-file" : "unknown";
    }
    setSize(e) {
      console.log("[filesystem] SET SIZE", e);
    }
    setTimes(e, t) {
      console.log("[filesystem] SET TIMES", e, t);
    }
    read(e, t) {
      const n = ot(__privateGet(this, _e));
      return [
        n.slice(t, t + e),
        t + e >= n.byteLength
      ];
    }
    write(e, t) {
      if (t !== 0) throw "invalid-seek";
      return __privateGet(this, _e).source = e, e.byteLength;
    }
    readDirectory() {
      var _a3;
      if (!((_a3 = __privateGet(this, _e)) == null ? void 0 : _a3.dir)) throw "bad-descriptor";
      return new Fr(Object.entries(__privateGet(this, _e).dir).sort(([e], [t]) => e > t ? 1 : -1));
    }
    sync() {
      console.log("[filesystem] SYNC");
    }
    createDirectoryAt(e) {
      if (Nt(__privateGet(this, _e), e, {
        create: true,
        directory: true
      }).source) throw "exist";
    }
    stat() {
      let e = "unknown", t = BigInt(0);
      if (__privateGet(this, _e).source) {
        e = "regular-file";
        const n = ot(__privateGet(this, _e));
        t = BigInt(n.byteLength);
      } else __privateGet(this, _e).dir && (e = "directory");
      return {
        type: e,
        linkCount: BigInt(0),
        size: t,
        dataAccessTimestamp: Fe,
        dataModificationTimestamp: Fe,
        statusChangeTimestamp: Fe
      };
    }
    statAt(e, t) {
      const n = Nt(__privateGet(this, _e), t, {
        create: false,
        directory: false
      });
      let a = "unknown", i = BigInt(0);
      if (n.source) {
        a = "regular-file";
        const d = ot(n);
        i = BigInt(d.byteLength);
      } else n.dir && (a = "directory");
      return {
        type: a,
        linkCount: BigInt(0),
        size: i,
        dataAccessTimestamp: Fe,
        dataModificationTimestamp: Fe,
        statusChangeTimestamp: Fe
      };
    }
    setTimesAt() {
      console.log("[filesystem] SET TIMES AT");
    }
    linkAt() {
      console.log("[filesystem] LINK AT");
    }
    openAt(e, t, n, a, i) {
      const d = Nt(__privateGet(this, _e), t, n);
      return new _a2(d);
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
  }, _t = new WeakMap(), _e = new WeakMap(), _r2 = new WeakMap(), _a2);
  const ma = qe.prototype._getEntry;
  delete qe.prototype._getEntry;
  let Ur = [
    [
      new qe(rr),
      "/"
    ]
  ], Xt = Ur[0];
  const sr = {
    getDirectories() {
      return Ur;
    }
  }, lt = {
    Descriptor: qe,
    DirectoryEntryStream: Fr
  }, ya = Object.freeze(Object.defineProperty({
    __proto__: null,
    _getFileData: ka,
    _setCwd: tr,
    _setFileData: va,
    filesystemTypes: lt,
    preopens: sr,
    types: lt
  }, Symbol.toStringTag, {
    value: "Module"
  })), { InputStream: Pr, OutputStream: bt } = Ye, ar = Symbol.dispose ?? Symbol.for("dispose");
  let Wr = [], Dr = [], Vr = "/";
  function Aa(r) {
    Wr = Object.entries(r);
  }
  function ha(r) {
    Dr = r;
  }
  function wa(r) {
    tr(Vr = r);
  }
  const vt = {
    getEnvironment() {
      return Wr;
    },
    getArguments() {
      return Dr;
    },
    initialCwd() {
      return Vr;
    }
  };
  class _r extends Error {
    constructor(e) {
      super(`Component exited ${e === 0 ? "successfully" : "with error"}`), this.exitError = true, this.code = e;
    }
  }
  const nr = {
    exit(r) {
      throw new _r(r.tag === "err" ? 1 : 0);
    },
    exitWithCode(r) {
      throw new _r(r);
    }
  };
  function ga(r) {
    zr.handler = r;
  }
  function Ia(r) {
    Zr.handler = r;
  }
  function Ea(r) {
    Hr.handler = r;
  }
  const zr = new Pr({
    blockingRead(r) {
    },
    subscribe() {
    },
    [ar]() {
    }
  });
  let Xr = new TextDecoder();
  const Hr = new bt({
    write(r) {
      r[r.length - 1] == 10 && (r = r.subarray(0, r.length - 1)), console.log(Xr.decode(r));
    },
    blockingFlush() {
    },
    [ar]() {
    }
  }), Zr = new bt({
    write(r) {
      r[r.length - 1] == 10 && (r = r.subarray(0, r.length - 1)), console.error(Xr.decode(r));
    },
    blockingFlush() {
    },
    [ar]() {
    }
  }), or = {
    InputStream: Pr,
    getStdin() {
      return zr;
    }
  }, ir = {
    OutputStream: bt,
    getStdout() {
      return Hr;
    }
  }, cr = {
    OutputStream: bt,
    getStderr() {
      return Zr;
    }
  };
  let lr = class {
  }, Ke = class {
  };
  const _a = new Ke(), Ta = new Ke(), Ba = new lr(), Jr = {
    TerminalInput: lr
  }, Gr = {
    TerminalOutput: Ke
  }, Yr = {
    TerminalOutput: Ke,
    getTerminalStderr() {
      return Ta;
    }
  }, qr = {
    TerminalInput: lr,
    getTerminalStdin() {
      return Ba;
    }
  }, Kr = {
    TerminalOutput: Ke,
    getTerminalStdout() {
      return _a;
    }
  }, Ca = Object.freeze(Object.defineProperty({
    __proto__: null,
    _setArgs: ha,
    _setCwd: wa,
    _setEnv: Aa,
    _setStderr: Ia,
    _setStdin: ga,
    _setStdout: Ea,
    environment: vt,
    exit: nr,
    stderr: cr,
    stdin: or,
    stdout: ir,
    terminalInput: Jr,
    terminalOutput: Gr,
    terminalStderr: Yr,
    terminalStdin: qr,
    terminalStdout: Kr
  }, Symbol.toStringTag, {
    value: "Module"
  })), Mt = 65536;
  let Ft, Tr;
  const ja = {
    getInsecureRandomBytes(r) {
      return be.getRandomBytes(r);
    },
    getInsecureRandomU64() {
      return be.getRandomU64();
    }
  };
  let Qt, Br;
  const $a = {
    insecureSeed() {
      return Qt === void 0 && (Qt = be.getRandomU64(), Br = be.getRandomU64()), [
        Qt,
        Br
      ];
    }
  }, be = {
    getRandomBytes(r) {
      const e = new Uint8Array(Number(r));
      if (r > Mt) for (var t = 0; t < r; t += Mt) crypto.getRandomValues(e.subarray(t, t + Mt));
      else crypto.getRandomValues(e);
      return e;
    },
    getRandomU64() {
      return crypto.getRandomValues(new BigUint64Array(1))[0];
    },
    insecureRandom() {
      return Ft === void 0 && (Ft = be.getRandomU64(), Tr = be.getRandomU64()), [
        Ft,
        Tr
      ];
    }
  }, xa = Object.freeze(Object.defineProperty({
    __proto__: null,
    insecure: ja,
    insecureSeed: $a,
    random: be
  }, Symbol.toStringTag, {
    value: "Module"
  })), { getEnvironment: Oa } = vt, { exit: Sa } = nr, { getStderr: Ra } = cr, { getStdin: La } = or, { getStdout: Na } = ir, { TerminalInput: Ht } = Jr, { TerminalOutput: ut } = Gr, { getTerminalStderr: Ma } = Yr, { getTerminalStdin: Fa } = qr, { getTerminalStdout: Qa } = Kr, { getDirectories: Ua } = sr, { Descriptor: z, DirectoryEntryStream: dt, filesystemErrorCode: Pa } = lt, { Error: ve } = er, { InputStream: Ue, OutputStream: ae } = Ye, { getRandomBytes: Wa } = be, Cr = (r) => WebAssembly.compile(typeof Buffer < "u" ? Buffer.from(r, "base64") : Uint8Array.from(atob(r), (e) => e.charCodeAt(0)));
  let Da = class extends Error {
    constructor(e) {
      const t = typeof e != "string";
      super(t ? `${String(e)} (see error.payload)` : e), Object.defineProperty(this, "payload", {
        value: e,
        enumerable: t
      });
    }
  }, w = [], Ut = new DataView(new ArrayBuffer());
  const u = (r) => Ut.buffer === r.buffer ? Ut : Ut = new DataView(r.buffer), Va = typeof process < "u" && process.versions && process.versions.node;
  let Pt;
  async function jr(r) {
    return Va ? (Pt = Pt || await fe(() => import("./__vite-browser-external-BIHI7g3E.js"), []), WebAssembly.compile(await Pt.readFile(r))) : fetch(r).then(WebAssembly.compileStreaming);
  }
  function P(r) {
    if (r && za.call(r, "payload")) return r.payload;
    if (r instanceof Error) throw r;
    return r;
  }
  const za = Object.prototype.hasOwnProperty, it = WebAssembly.instantiate, J = 1 << 30;
  function Q(r, e) {
    const t = r[0] & -1073741825;
    return t === 0 ? (r.push(0), r.push(e | J), (r.length >> 1) - 1) : (r[0] = r[t << 1], r[t << 1] = 0, r[(t << 1) + 1] = e | J, t);
  }
  function Ne(r, e) {
    const t = r[e << 1], n = r[(e << 1) + 1], a = (n & J) !== 0, i = n & -1073741825;
    if (n === 0 || (t & J) !== 0) throw new TypeError("Invalid handle");
    return r[e << 1] = r[0] | J, r[0] = e | J, {
      rep: i,
      scope: t,
      own: a
    };
  }
  const X = Symbol.for("cabiDispose"), g = Symbol("handle"), j = Symbol.for("cabiRep"), H = Symbol.dispose || Symbol.for("dispose");
  function Xa() {
    throw new TypeError("Wasm uninitialized use `await $init` first");
  }
  const V = (r) => BigInt.asUintN(64, BigInt(r));
  function $e(r) {
    return r >>> 0;
  }
  const je = new TextDecoder(), Ha = new TextEncoder();
  let K = 0;
  function pe(r, e, t) {
    if (typeof r != "string") throw new TypeError("expected a string");
    if (r.length === 0) return K = 0, 1;
    let n = Ha.encode(r), a = e(0, 0, 1, n.length);
    return new Uint8Array(t.buffer).set(n, a), K = n.length, a;
  }
  let C, ue;
  const me = [
    J,
    0
  ], ne = /* @__PURE__ */ new Map();
  let kt = 0;
  function Za() {
    const r = Ra();
    if (!(r instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = r[g];
    if (!e) {
      const t = r[j] || ++kt;
      ne.set(t, r), e = Q(me, t);
    }
    return e;
  }
  const et = [
    J,
    0
  ], Pe = /* @__PURE__ */ new Map();
  let es = 0;
  function Ja() {
    const r = La();
    if (!(r instanceof Ue)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
    var e = r[g];
    if (!e) {
      const t = r[j] || ++es;
      Pe.set(t, r), e = Q(et, t);
    }
    return e;
  }
  function Ga() {
    const r = Na();
    if (!(r instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = r[g];
    if (!e) {
      const t = r[j] || ++kt;
      ne.set(t, r), e = Q(me, t);
    }
    return e;
  }
  function Ya(r) {
    let e;
    switch (r) {
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
    Sa(e);
  }
  let D, l, se;
  function qa(r) {
    var t = Oa(), n = t.length, a = se(0, 0, 4, n * 16);
    for (let c = 0; c < t.length; c++) {
      const y = t[c], A = a + c * 16;
      var [i, d] = y, f = pe(i, se, l), p = K;
      u(l).setInt32(A + 4, p, true), u(l).setInt32(A + 0, f, true);
      var o = pe(d, se, l), s = K;
      u(l).setInt32(A + 12, s, true), u(l).setInt32(A + 8, o, true);
    }
    u(l).setInt32(r + 4, n, true), u(l).setInt32(r + 0, a, true);
  }
  const G = [
    J,
    0
  ], Z = /* @__PURE__ */ new Map();
  let ts = 0;
  function Ka(r, e) {
    var t = r, n = G[(t << 1) + 1] & -1073741825, a = Z.get(n);
    a || (a = Object.create(z.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.getType()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: P(o)
      };
    }
    for (const o of w) o[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        u(l).setInt8(e + 0, 0, true);
        var f = o;
        let s;
        switch (f) {
          case "unknown": {
            s = 0;
            break;
          }
          case "block-device": {
            s = 1;
            break;
          }
          case "character-device": {
            s = 2;
            break;
          }
          case "directory": {
            s = 3;
            break;
          }
          case "fifo": {
            s = 4;
            break;
          }
          case "symbolic-link": {
            s = 5;
            break;
          }
          case "regular-file": {
            s = 6;
            break;
          }
          case "socket": {
            s = 7;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${f}" is not one of the cases of descriptor-type`);
        }
        u(l).setInt8(e + 1, s, true);
        break;
      }
      case "err": {
        const o = d.val;
        u(l).setInt8(e + 0, 1, true);
        var p = o;
        let s;
        switch (p) {
          case "access": {
            s = 0;
            break;
          }
          case "would-block": {
            s = 1;
            break;
          }
          case "already": {
            s = 2;
            break;
          }
          case "bad-descriptor": {
            s = 3;
            break;
          }
          case "busy": {
            s = 4;
            break;
          }
          case "deadlock": {
            s = 5;
            break;
          }
          case "quota": {
            s = 6;
            break;
          }
          case "exist": {
            s = 7;
            break;
          }
          case "file-too-large": {
            s = 8;
            break;
          }
          case "illegal-byte-sequence": {
            s = 9;
            break;
          }
          case "in-progress": {
            s = 10;
            break;
          }
          case "interrupted": {
            s = 11;
            break;
          }
          case "invalid": {
            s = 12;
            break;
          }
          case "io": {
            s = 13;
            break;
          }
          case "is-directory": {
            s = 14;
            break;
          }
          case "loop": {
            s = 15;
            break;
          }
          case "too-many-links": {
            s = 16;
            break;
          }
          case "message-size": {
            s = 17;
            break;
          }
          case "name-too-long": {
            s = 18;
            break;
          }
          case "no-device": {
            s = 19;
            break;
          }
          case "no-entry": {
            s = 20;
            break;
          }
          case "no-lock": {
            s = 21;
            break;
          }
          case "insufficient-memory": {
            s = 22;
            break;
          }
          case "insufficient-space": {
            s = 23;
            break;
          }
          case "not-directory": {
            s = 24;
            break;
          }
          case "not-empty": {
            s = 25;
            break;
          }
          case "not-recoverable": {
            s = 26;
            break;
          }
          case "unsupported": {
            s = 27;
            break;
          }
          case "no-tty": {
            s = 28;
            break;
          }
          case "no-such-device": {
            s = 29;
            break;
          }
          case "overflow": {
            s = 30;
            break;
          }
          case "not-permitted": {
            s = 31;
            break;
          }
          case "pipe": {
            s = 32;
            break;
          }
          case "read-only": {
            s = 33;
            break;
          }
          case "invalid-seek": {
            s = 34;
            break;
          }
          case "text-file-busy": {
            s = 35;
            break;
          }
          case "cross-device": {
            s = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${p}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 1, s, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function en(r, e) {
    var t = r, n = G[(t << 1) + 1] & -1073741825, a = Z.get(n);
    a || (a = Object.create(z.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.metadataHash()
      };
    } catch (s) {
      i = {
        tag: "err",
        val: P(s)
      };
    }
    for (const s of w) s[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const s = d.val;
        u(l).setInt8(e + 0, 0, true);
        var { lower: f, upper: p } = s;
        u(l).setBigInt64(e + 8, V(f), true), u(l).setBigInt64(e + 16, V(p), true);
        break;
      }
      case "err": {
        const s = d.val;
        u(l).setInt8(e + 0, 1, true);
        var o = s;
        let c;
        switch (o) {
          case "access": {
            c = 0;
            break;
          }
          case "would-block": {
            c = 1;
            break;
          }
          case "already": {
            c = 2;
            break;
          }
          case "bad-descriptor": {
            c = 3;
            break;
          }
          case "busy": {
            c = 4;
            break;
          }
          case "deadlock": {
            c = 5;
            break;
          }
          case "quota": {
            c = 6;
            break;
          }
          case "exist": {
            c = 7;
            break;
          }
          case "file-too-large": {
            c = 8;
            break;
          }
          case "illegal-byte-sequence": {
            c = 9;
            break;
          }
          case "in-progress": {
            c = 10;
            break;
          }
          case "interrupted": {
            c = 11;
            break;
          }
          case "invalid": {
            c = 12;
            break;
          }
          case "io": {
            c = 13;
            break;
          }
          case "is-directory": {
            c = 14;
            break;
          }
          case "loop": {
            c = 15;
            break;
          }
          case "too-many-links": {
            c = 16;
            break;
          }
          case "message-size": {
            c = 17;
            break;
          }
          case "name-too-long": {
            c = 18;
            break;
          }
          case "no-device": {
            c = 19;
            break;
          }
          case "no-entry": {
            c = 20;
            break;
          }
          case "no-lock": {
            c = 21;
            break;
          }
          case "insufficient-memory": {
            c = 22;
            break;
          }
          case "insufficient-space": {
            c = 23;
            break;
          }
          case "not-directory": {
            c = 24;
            break;
          }
          case "not-empty": {
            c = 25;
            break;
          }
          case "not-recoverable": {
            c = 26;
            break;
          }
          case "unsupported": {
            c = 27;
            break;
          }
          case "no-tty": {
            c = 28;
            break;
          }
          case "no-such-device": {
            c = 29;
            break;
          }
          case "overflow": {
            c = 30;
            break;
          }
          case "not-permitted": {
            c = 31;
            break;
          }
          case "pipe": {
            c = 32;
            break;
          }
          case "read-only": {
            c = 33;
            break;
          }
          case "invalid-seek": {
            c = 34;
            break;
          }
          case "text-file-busy": {
            c = 35;
            break;
          }
          case "cross-device": {
            c = 36;
            break;
          }
          default:
            throw s instanceof Error && console.error(s), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 8, c, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  const ge = [
    J,
    0
  ], ke = /* @__PURE__ */ new Map();
  let We = 0;
  function tn(r, e) {
    var t = r, n = ge[(t << 1) + 1] & -1073741825, a = ke.get(n);
    a || (a = Object.create(ve.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    const i = Pa(a);
    for (const p of w) p[g] = void 0;
    w = [];
    var d = i;
    if (d == null) u(l).setInt8(e + 0, 0, true);
    else {
      const p = d;
      u(l).setInt8(e + 0, 1, true);
      var f = p;
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
          throw p instanceof Error && console.error(p), new TypeError(`"${f}" is not one of the cases of error-code`);
      }
      u(l).setInt8(e + 1, o, true);
    }
  }
  function rn(r, e, t, n, a) {
    var i = r, d = G[(i << 1) + 1] & -1073741825, f = Z.get(d);
    if (f || (f = Object.create(z.prototype), Object.defineProperty(f, g, {
      writable: true,
      value: i
    }), Object.defineProperty(f, j, {
      writable: true,
      value: d
    })), w.push(f), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var p = {
      symlinkFollow: !!(e & 1)
    }, o = t, s = n, c = je.decode(new Uint8Array(l.buffer, o, s));
    let y;
    try {
      y = {
        tag: "ok",
        val: f.metadataHashAt(p, c)
      };
    } catch (S) {
      y = {
        tag: "err",
        val: P(S)
      };
    }
    for (const S of w) S[g] = void 0;
    w = [];
    var A = y;
    switch (A.tag) {
      case "ok": {
        const S = A.val;
        u(l).setInt8(a + 0, 0, true);
        var { lower: h, upper: v } = S;
        u(l).setBigInt64(a + 8, V(h), true), u(l).setBigInt64(a + 16, V(v), true);
        break;
      }
      case "err": {
        const S = A.val;
        u(l).setInt8(a + 0, 1, true);
        var T = S;
        let _;
        switch (T) {
          case "access": {
            _ = 0;
            break;
          }
          case "would-block": {
            _ = 1;
            break;
          }
          case "already": {
            _ = 2;
            break;
          }
          case "bad-descriptor": {
            _ = 3;
            break;
          }
          case "busy": {
            _ = 4;
            break;
          }
          case "deadlock": {
            _ = 5;
            break;
          }
          case "quota": {
            _ = 6;
            break;
          }
          case "exist": {
            _ = 7;
            break;
          }
          case "file-too-large": {
            _ = 8;
            break;
          }
          case "illegal-byte-sequence": {
            _ = 9;
            break;
          }
          case "in-progress": {
            _ = 10;
            break;
          }
          case "interrupted": {
            _ = 11;
            break;
          }
          case "invalid": {
            _ = 12;
            break;
          }
          case "io": {
            _ = 13;
            break;
          }
          case "is-directory": {
            _ = 14;
            break;
          }
          case "loop": {
            _ = 15;
            break;
          }
          case "too-many-links": {
            _ = 16;
            break;
          }
          case "message-size": {
            _ = 17;
            break;
          }
          case "name-too-long": {
            _ = 18;
            break;
          }
          case "no-device": {
            _ = 19;
            break;
          }
          case "no-entry": {
            _ = 20;
            break;
          }
          case "no-lock": {
            _ = 21;
            break;
          }
          case "insufficient-memory": {
            _ = 22;
            break;
          }
          case "insufficient-space": {
            _ = 23;
            break;
          }
          case "not-directory": {
            _ = 24;
            break;
          }
          case "not-empty": {
            _ = 25;
            break;
          }
          case "not-recoverable": {
            _ = 26;
            break;
          }
          case "unsupported": {
            _ = 27;
            break;
          }
          case "no-tty": {
            _ = 28;
            break;
          }
          case "no-such-device": {
            _ = 29;
            break;
          }
          case "overflow": {
            _ = 30;
            break;
          }
          case "not-permitted": {
            _ = 31;
            break;
          }
          case "pipe": {
            _ = 32;
            break;
          }
          case "read-only": {
            _ = 33;
            break;
          }
          case "invalid-seek": {
            _ = 34;
            break;
          }
          case "text-file-busy": {
            _ = 35;
            break;
          }
          case "cross-device": {
            _ = 36;
            break;
          }
          default:
            throw S instanceof Error && console.error(S), new TypeError(`"${T}" is not one of the cases of error-code`);
        }
        u(l).setInt8(a + 8, _, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function sn(r, e, t) {
    var n = r, a = G[(n << 1) + 1] & -1073741825, i = Z.get(a);
    i || (i = Object.create(z.prototype), Object.defineProperty(i, g, {
      writable: true,
      value: n
    }), Object.defineProperty(i, j, {
      writable: true,
      value: a
    })), w.push(i);
    let d;
    try {
      d = {
        tag: "ok",
        val: i.readViaStream(BigInt.asUintN(64, e))
      };
    } catch (s) {
      d = {
        tag: "err",
        val: P(s)
      };
    }
    for (const s of w) s[g] = void 0;
    w = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const s = f.val;
        if (u(l).setInt8(t + 0, 0, true), !(s instanceof Ue)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
        var p = s[g];
        if (!p) {
          const c = s[j] || ++es;
          Pe.set(c, s), p = Q(et, c);
        }
        u(l).setInt32(t + 4, p, true);
        break;
      }
      case "err": {
        const s = f.val;
        u(l).setInt8(t + 0, 1, true);
        var o = s;
        let c;
        switch (o) {
          case "access": {
            c = 0;
            break;
          }
          case "would-block": {
            c = 1;
            break;
          }
          case "already": {
            c = 2;
            break;
          }
          case "bad-descriptor": {
            c = 3;
            break;
          }
          case "busy": {
            c = 4;
            break;
          }
          case "deadlock": {
            c = 5;
            break;
          }
          case "quota": {
            c = 6;
            break;
          }
          case "exist": {
            c = 7;
            break;
          }
          case "file-too-large": {
            c = 8;
            break;
          }
          case "illegal-byte-sequence": {
            c = 9;
            break;
          }
          case "in-progress": {
            c = 10;
            break;
          }
          case "interrupted": {
            c = 11;
            break;
          }
          case "invalid": {
            c = 12;
            break;
          }
          case "io": {
            c = 13;
            break;
          }
          case "is-directory": {
            c = 14;
            break;
          }
          case "loop": {
            c = 15;
            break;
          }
          case "too-many-links": {
            c = 16;
            break;
          }
          case "message-size": {
            c = 17;
            break;
          }
          case "name-too-long": {
            c = 18;
            break;
          }
          case "no-device": {
            c = 19;
            break;
          }
          case "no-entry": {
            c = 20;
            break;
          }
          case "no-lock": {
            c = 21;
            break;
          }
          case "insufficient-memory": {
            c = 22;
            break;
          }
          case "insufficient-space": {
            c = 23;
            break;
          }
          case "not-directory": {
            c = 24;
            break;
          }
          case "not-empty": {
            c = 25;
            break;
          }
          case "not-recoverable": {
            c = 26;
            break;
          }
          case "unsupported": {
            c = 27;
            break;
          }
          case "no-tty": {
            c = 28;
            break;
          }
          case "no-such-device": {
            c = 29;
            break;
          }
          case "overflow": {
            c = 30;
            break;
          }
          case "not-permitted": {
            c = 31;
            break;
          }
          case "pipe": {
            c = 32;
            break;
          }
          case "read-only": {
            c = 33;
            break;
          }
          case "invalid-seek": {
            c = 34;
            break;
          }
          case "text-file-busy": {
            c = 35;
            break;
          }
          case "cross-device": {
            c = 36;
            break;
          }
          default:
            throw s instanceof Error && console.error(s), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        u(l).setInt8(t + 4, c, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function an(r, e, t) {
    var n = r, a = G[(n << 1) + 1] & -1073741825, i = Z.get(a);
    i || (i = Object.create(z.prototype), Object.defineProperty(i, g, {
      writable: true,
      value: n
    }), Object.defineProperty(i, j, {
      writable: true,
      value: a
    })), w.push(i);
    let d;
    try {
      d = {
        tag: "ok",
        val: i.writeViaStream(BigInt.asUintN(64, e))
      };
    } catch (s) {
      d = {
        tag: "err",
        val: P(s)
      };
    }
    for (const s of w) s[g] = void 0;
    w = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const s = f.val;
        if (u(l).setInt8(t + 0, 0, true), !(s instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var p = s[g];
        if (!p) {
          const c = s[j] || ++kt;
          ne.set(c, s), p = Q(me, c);
        }
        u(l).setInt32(t + 4, p, true);
        break;
      }
      case "err": {
        const s = f.val;
        u(l).setInt8(t + 0, 1, true);
        var o = s;
        let c;
        switch (o) {
          case "access": {
            c = 0;
            break;
          }
          case "would-block": {
            c = 1;
            break;
          }
          case "already": {
            c = 2;
            break;
          }
          case "bad-descriptor": {
            c = 3;
            break;
          }
          case "busy": {
            c = 4;
            break;
          }
          case "deadlock": {
            c = 5;
            break;
          }
          case "quota": {
            c = 6;
            break;
          }
          case "exist": {
            c = 7;
            break;
          }
          case "file-too-large": {
            c = 8;
            break;
          }
          case "illegal-byte-sequence": {
            c = 9;
            break;
          }
          case "in-progress": {
            c = 10;
            break;
          }
          case "interrupted": {
            c = 11;
            break;
          }
          case "invalid": {
            c = 12;
            break;
          }
          case "io": {
            c = 13;
            break;
          }
          case "is-directory": {
            c = 14;
            break;
          }
          case "loop": {
            c = 15;
            break;
          }
          case "too-many-links": {
            c = 16;
            break;
          }
          case "message-size": {
            c = 17;
            break;
          }
          case "name-too-long": {
            c = 18;
            break;
          }
          case "no-device": {
            c = 19;
            break;
          }
          case "no-entry": {
            c = 20;
            break;
          }
          case "no-lock": {
            c = 21;
            break;
          }
          case "insufficient-memory": {
            c = 22;
            break;
          }
          case "insufficient-space": {
            c = 23;
            break;
          }
          case "not-directory": {
            c = 24;
            break;
          }
          case "not-empty": {
            c = 25;
            break;
          }
          case "not-recoverable": {
            c = 26;
            break;
          }
          case "unsupported": {
            c = 27;
            break;
          }
          case "no-tty": {
            c = 28;
            break;
          }
          case "no-such-device": {
            c = 29;
            break;
          }
          case "overflow": {
            c = 30;
            break;
          }
          case "not-permitted": {
            c = 31;
            break;
          }
          case "pipe": {
            c = 32;
            break;
          }
          case "read-only": {
            c = 33;
            break;
          }
          case "invalid-seek": {
            c = 34;
            break;
          }
          case "text-file-busy": {
            c = 35;
            break;
          }
          case "cross-device": {
            c = 36;
            break;
          }
          default:
            throw s instanceof Error && console.error(s), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        u(l).setInt8(t + 4, c, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function nn(r, e) {
    var t = r, n = G[(t << 1) + 1] & -1073741825, a = Z.get(n);
    a || (a = Object.create(z.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.appendViaStream()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: P(o)
      };
    }
    for (const o of w) o[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (u(l).setInt8(e + 0, 0, true), !(o instanceof ae)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var f = o[g];
        if (!f) {
          const s = o[j] || ++kt;
          ne.set(s, o), f = Q(me, s);
        }
        u(l).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        u(l).setInt8(e + 0, 1, true);
        var p = o;
        let s;
        switch (p) {
          case "access": {
            s = 0;
            break;
          }
          case "would-block": {
            s = 1;
            break;
          }
          case "already": {
            s = 2;
            break;
          }
          case "bad-descriptor": {
            s = 3;
            break;
          }
          case "busy": {
            s = 4;
            break;
          }
          case "deadlock": {
            s = 5;
            break;
          }
          case "quota": {
            s = 6;
            break;
          }
          case "exist": {
            s = 7;
            break;
          }
          case "file-too-large": {
            s = 8;
            break;
          }
          case "illegal-byte-sequence": {
            s = 9;
            break;
          }
          case "in-progress": {
            s = 10;
            break;
          }
          case "interrupted": {
            s = 11;
            break;
          }
          case "invalid": {
            s = 12;
            break;
          }
          case "io": {
            s = 13;
            break;
          }
          case "is-directory": {
            s = 14;
            break;
          }
          case "loop": {
            s = 15;
            break;
          }
          case "too-many-links": {
            s = 16;
            break;
          }
          case "message-size": {
            s = 17;
            break;
          }
          case "name-too-long": {
            s = 18;
            break;
          }
          case "no-device": {
            s = 19;
            break;
          }
          case "no-entry": {
            s = 20;
            break;
          }
          case "no-lock": {
            s = 21;
            break;
          }
          case "insufficient-memory": {
            s = 22;
            break;
          }
          case "insufficient-space": {
            s = 23;
            break;
          }
          case "not-directory": {
            s = 24;
            break;
          }
          case "not-empty": {
            s = 25;
            break;
          }
          case "not-recoverable": {
            s = 26;
            break;
          }
          case "unsupported": {
            s = 27;
            break;
          }
          case "no-tty": {
            s = 28;
            break;
          }
          case "no-such-device": {
            s = 29;
            break;
          }
          case "overflow": {
            s = 30;
            break;
          }
          case "not-permitted": {
            s = 31;
            break;
          }
          case "pipe": {
            s = 32;
            break;
          }
          case "read-only": {
            s = 33;
            break;
          }
          case "invalid-seek": {
            s = 34;
            break;
          }
          case "text-file-busy": {
            s = 35;
            break;
          }
          case "cross-device": {
            s = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${p}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 4, s, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  const ur = [
    J,
    0
  ], ft = /* @__PURE__ */ new Map();
  let on = 0;
  function cn(r, e) {
    var t = r, n = G[(t << 1) + 1] & -1073741825, a = Z.get(n);
    a || (a = Object.create(z.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.readDirectory()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: P(o)
      };
    }
    for (const o of w) o[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (u(l).setInt8(e + 0, 0, true), !(o instanceof dt)) throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
        var f = o[g];
        if (!f) {
          const s = o[j] || ++on;
          ft.set(s, o), f = Q(ur, s);
        }
        u(l).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        u(l).setInt8(e + 0, 1, true);
        var p = o;
        let s;
        switch (p) {
          case "access": {
            s = 0;
            break;
          }
          case "would-block": {
            s = 1;
            break;
          }
          case "already": {
            s = 2;
            break;
          }
          case "bad-descriptor": {
            s = 3;
            break;
          }
          case "busy": {
            s = 4;
            break;
          }
          case "deadlock": {
            s = 5;
            break;
          }
          case "quota": {
            s = 6;
            break;
          }
          case "exist": {
            s = 7;
            break;
          }
          case "file-too-large": {
            s = 8;
            break;
          }
          case "illegal-byte-sequence": {
            s = 9;
            break;
          }
          case "in-progress": {
            s = 10;
            break;
          }
          case "interrupted": {
            s = 11;
            break;
          }
          case "invalid": {
            s = 12;
            break;
          }
          case "io": {
            s = 13;
            break;
          }
          case "is-directory": {
            s = 14;
            break;
          }
          case "loop": {
            s = 15;
            break;
          }
          case "too-many-links": {
            s = 16;
            break;
          }
          case "message-size": {
            s = 17;
            break;
          }
          case "name-too-long": {
            s = 18;
            break;
          }
          case "no-device": {
            s = 19;
            break;
          }
          case "no-entry": {
            s = 20;
            break;
          }
          case "no-lock": {
            s = 21;
            break;
          }
          case "insufficient-memory": {
            s = 22;
            break;
          }
          case "insufficient-space": {
            s = 23;
            break;
          }
          case "not-directory": {
            s = 24;
            break;
          }
          case "not-empty": {
            s = 25;
            break;
          }
          case "not-recoverable": {
            s = 26;
            break;
          }
          case "unsupported": {
            s = 27;
            break;
          }
          case "no-tty": {
            s = 28;
            break;
          }
          case "no-such-device": {
            s = 29;
            break;
          }
          case "overflow": {
            s = 30;
            break;
          }
          case "not-permitted": {
            s = 31;
            break;
          }
          case "pipe": {
            s = 32;
            break;
          }
          case "read-only": {
            s = 33;
            break;
          }
          case "invalid-seek": {
            s = 34;
            break;
          }
          case "text-file-busy": {
            s = 35;
            break;
          }
          case "cross-device": {
            s = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${p}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 4, s, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function ln(r, e) {
    var t = r, n = G[(t << 1) + 1] & -1073741825, a = Z.get(n);
    a || (a = Object.create(z.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.stat()
      };
    } catch (x) {
      i = {
        tag: "err",
        val: P(x)
      };
    }
    for (const x of w) x[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const x = d.val;
        u(l).setInt8(e + 0, 0, true);
        var { type: f, linkCount: p, size: o, dataAccessTimestamp: s, dataModificationTimestamp: c, statusChangeTimestamp: y } = x, A = f;
        let b;
        switch (A) {
          case "unknown": {
            b = 0;
            break;
          }
          case "block-device": {
            b = 1;
            break;
          }
          case "character-device": {
            b = 2;
            break;
          }
          case "directory": {
            b = 3;
            break;
          }
          case "fifo": {
            b = 4;
            break;
          }
          case "symbolic-link": {
            b = 5;
            break;
          }
          case "regular-file": {
            b = 6;
            break;
          }
          case "socket": {
            b = 7;
            break;
          }
          default:
            throw f instanceof Error && console.error(f), new TypeError(`"${A}" is not one of the cases of descriptor-type`);
        }
        u(l).setInt8(e + 8, b, true), u(l).setBigInt64(e + 16, V(p), true), u(l).setBigInt64(e + 24, V(o), true);
        var h = s;
        if (h == null) u(l).setInt8(e + 32, 0, true);
        else {
          const U = h;
          u(l).setInt8(e + 32, 1, true);
          var { seconds: v, nanoseconds: T } = U;
          u(l).setBigInt64(e + 40, V(v), true), u(l).setInt32(e + 48, $e(T), true);
        }
        var S = c;
        if (S == null) u(l).setInt8(e + 56, 0, true);
        else {
          const U = S;
          u(l).setInt8(e + 56, 1, true);
          var { seconds: _, nanoseconds: ee } = U;
          u(l).setBigInt64(e + 64, V(_), true), u(l).setInt32(e + 72, $e(ee), true);
        }
        var R = y;
        if (R == null) u(l).setInt8(e + 80, 0, true);
        else {
          const U = R;
          u(l).setInt8(e + 80, 1, true);
          var { seconds: I, nanoseconds: Ee } = U;
          u(l).setBigInt64(e + 88, V(I), true), u(l).setInt32(e + 96, $e(Ee), true);
        }
        break;
      }
      case "err": {
        const x = d.val;
        u(l).setInt8(e + 0, 1, true);
        var le = x;
        let b;
        switch (le) {
          case "access": {
            b = 0;
            break;
          }
          case "would-block": {
            b = 1;
            break;
          }
          case "already": {
            b = 2;
            break;
          }
          case "bad-descriptor": {
            b = 3;
            break;
          }
          case "busy": {
            b = 4;
            break;
          }
          case "deadlock": {
            b = 5;
            break;
          }
          case "quota": {
            b = 6;
            break;
          }
          case "exist": {
            b = 7;
            break;
          }
          case "file-too-large": {
            b = 8;
            break;
          }
          case "illegal-byte-sequence": {
            b = 9;
            break;
          }
          case "in-progress": {
            b = 10;
            break;
          }
          case "interrupted": {
            b = 11;
            break;
          }
          case "invalid": {
            b = 12;
            break;
          }
          case "io": {
            b = 13;
            break;
          }
          case "is-directory": {
            b = 14;
            break;
          }
          case "loop": {
            b = 15;
            break;
          }
          case "too-many-links": {
            b = 16;
            break;
          }
          case "message-size": {
            b = 17;
            break;
          }
          case "name-too-long": {
            b = 18;
            break;
          }
          case "no-device": {
            b = 19;
            break;
          }
          case "no-entry": {
            b = 20;
            break;
          }
          case "no-lock": {
            b = 21;
            break;
          }
          case "insufficient-memory": {
            b = 22;
            break;
          }
          case "insufficient-space": {
            b = 23;
            break;
          }
          case "not-directory": {
            b = 24;
            break;
          }
          case "not-empty": {
            b = 25;
            break;
          }
          case "not-recoverable": {
            b = 26;
            break;
          }
          case "unsupported": {
            b = 27;
            break;
          }
          case "no-tty": {
            b = 28;
            break;
          }
          case "no-such-device": {
            b = 29;
            break;
          }
          case "overflow": {
            b = 30;
            break;
          }
          case "not-permitted": {
            b = 31;
            break;
          }
          case "pipe": {
            b = 32;
            break;
          }
          case "read-only": {
            b = 33;
            break;
          }
          case "invalid-seek": {
            b = 34;
            break;
          }
          case "text-file-busy": {
            b = 35;
            break;
          }
          case "cross-device": {
            b = 36;
            break;
          }
          default:
            throw x instanceof Error && console.error(x), new TypeError(`"${le}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 8, b, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function un(r, e, t, n, a) {
    var i = r, d = G[(i << 1) + 1] & -1073741825, f = Z.get(d);
    if (f || (f = Object.create(z.prototype), Object.defineProperty(f, g, {
      writable: true,
      value: i
    }), Object.defineProperty(f, j, {
      writable: true,
      value: d
    })), w.push(f), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var p = {
      symlinkFollow: !!(e & 1)
    }, o = t, s = n, c = je.decode(new Uint8Array(l.buffer, o, s));
    let y;
    try {
      y = {
        tag: "ok",
        val: f.statAt(p, c)
      };
    } catch (Y) {
      y = {
        tag: "err",
        val: P(Y)
      };
    }
    for (const Y of w) Y[g] = void 0;
    w = [];
    var A = y;
    switch (A.tag) {
      case "ok": {
        const Y = A.val;
        u(l).setInt8(a + 0, 0, true);
        var { type: h, linkCount: v, size: T, dataAccessTimestamp: S, dataModificationTimestamp: _, statusChangeTimestamp: ee } = Y, R = h;
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
            throw h instanceof Error && console.error(h), new TypeError(`"${R}" is not one of the cases of descriptor-type`);
        }
        u(l).setInt8(a + 8, E, true), u(l).setBigInt64(a + 16, V(v), true), u(l).setBigInt64(a + 24, V(T), true);
        var I = S;
        if (I == null) u(l).setInt8(a + 32, 0, true);
        else {
          const Te = I;
          u(l).setInt8(a + 32, 1, true);
          var { seconds: Ee, nanoseconds: le } = Te;
          u(l).setBigInt64(a + 40, V(Ee), true), u(l).setInt32(a + 48, $e(le), true);
        }
        var x = _;
        if (x == null) u(l).setInt8(a + 56, 0, true);
        else {
          const Te = x;
          u(l).setInt8(a + 56, 1, true);
          var { seconds: b, nanoseconds: U } = Te;
          u(l).setBigInt64(a + 64, V(b), true), u(l).setInt32(a + 72, $e(U), true);
        }
        var _e2 = ee;
        if (_e2 == null) u(l).setInt8(a + 80, 0, true);
        else {
          const Te = _e2;
          u(l).setInt8(a + 80, 1, true);
          var { seconds: He, nanoseconds: Ze } = Te;
          u(l).setBigInt64(a + 88, V(He), true), u(l).setInt32(a + 96, $e(Ze), true);
        }
        break;
      }
      case "err": {
        const Y = A.val;
        u(l).setInt8(a + 0, 1, true);
        var Me = Y;
        let E;
        switch (Me) {
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
            throw Y instanceof Error && console.error(Y), new TypeError(`"${Me}" is not one of the cases of error-code`);
        }
        u(l).setInt8(a + 8, E, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function dn(r, e, t, n, a, i, d) {
    var f = r, p = G[(f << 1) + 1] & -1073741825, o = Z.get(p);
    if (o || (o = Object.create(z.prototype), Object.defineProperty(o, g, {
      writable: true,
      value: f
    }), Object.defineProperty(o, j, {
      writable: true,
      value: p
    })), w.push(o), (e & 4294967294) !== 0) throw new TypeError("flags have extraneous bits set");
    var s = {
      symlinkFollow: !!(e & 1)
    }, c = t, y = n, A = je.decode(new Uint8Array(l.buffer, c, y));
    if ((a & 4294967280) !== 0) throw new TypeError("flags have extraneous bits set");
    var h = {
      create: !!(a & 1),
      directory: !!(a & 2),
      exclusive: !!(a & 4),
      truncate: !!(a & 8)
    };
    if ((i & 4294967232) !== 0) throw new TypeError("flags have extraneous bits set");
    var v = {
      read: !!(i & 1),
      write: !!(i & 2),
      fileIntegritySync: !!(i & 4),
      dataIntegritySync: !!(i & 8),
      requestedWriteSync: !!(i & 16),
      mutateDirectory: !!(i & 32)
    };
    let T;
    try {
      T = {
        tag: "ok",
        val: o.openAt(s, A, h, v)
      };
    } catch (R) {
      T = {
        tag: "err",
        val: P(R)
      };
    }
    for (const R of w) R[g] = void 0;
    w = [];
    var S = T;
    switch (S.tag) {
      case "ok": {
        const R = S.val;
        if (u(l).setInt8(d + 0, 0, true), !(R instanceof z)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
        var _ = R[g];
        if (!_) {
          const I = R[j] || ++ts;
          Z.set(I, R), _ = Q(G, I);
        }
        u(l).setInt32(d + 4, _, true);
        break;
      }
      case "err": {
        const R = S.val;
        u(l).setInt8(d + 0, 1, true);
        var ee = R;
        let I;
        switch (ee) {
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
            throw R instanceof Error && console.error(R), new TypeError(`"${ee}" is not one of the cases of error-code`);
        }
        u(l).setInt8(d + 4, I, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function fn(r, e) {
    var t = r, n = ur[(t << 1) + 1] & -1073741825, a = ft.get(n);
    a || (a = Object.create(dt.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.readDirectoryEntry()
      };
    } catch (h) {
      i = {
        tag: "err",
        val: P(h)
      };
    }
    for (const h of w) h[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const h = d.val;
        u(l).setInt8(e + 0, 0, true);
        var f = h;
        if (f == null) u(l).setInt8(e + 4, 0, true);
        else {
          const v = f;
          u(l).setInt8(e + 4, 1, true);
          var { type: p, name: o } = v, s = p;
          let T;
          switch (s) {
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
              throw p instanceof Error && console.error(p), new TypeError(`"${s}" is not one of the cases of descriptor-type`);
          }
          u(l).setInt8(e + 8, T, true);
          var c = pe(o, se, l), y = K;
          u(l).setInt32(e + 16, y, true), u(l).setInt32(e + 12, c, true);
        }
        break;
      }
      case "err": {
        const h = d.val;
        u(l).setInt8(e + 0, 1, true);
        var A = h;
        let v;
        switch (A) {
          case "access": {
            v = 0;
            break;
          }
          case "would-block": {
            v = 1;
            break;
          }
          case "already": {
            v = 2;
            break;
          }
          case "bad-descriptor": {
            v = 3;
            break;
          }
          case "busy": {
            v = 4;
            break;
          }
          case "deadlock": {
            v = 5;
            break;
          }
          case "quota": {
            v = 6;
            break;
          }
          case "exist": {
            v = 7;
            break;
          }
          case "file-too-large": {
            v = 8;
            break;
          }
          case "illegal-byte-sequence": {
            v = 9;
            break;
          }
          case "in-progress": {
            v = 10;
            break;
          }
          case "interrupted": {
            v = 11;
            break;
          }
          case "invalid": {
            v = 12;
            break;
          }
          case "io": {
            v = 13;
            break;
          }
          case "is-directory": {
            v = 14;
            break;
          }
          case "loop": {
            v = 15;
            break;
          }
          case "too-many-links": {
            v = 16;
            break;
          }
          case "message-size": {
            v = 17;
            break;
          }
          case "name-too-long": {
            v = 18;
            break;
          }
          case "no-device": {
            v = 19;
            break;
          }
          case "no-entry": {
            v = 20;
            break;
          }
          case "no-lock": {
            v = 21;
            break;
          }
          case "insufficient-memory": {
            v = 22;
            break;
          }
          case "insufficient-space": {
            v = 23;
            break;
          }
          case "not-directory": {
            v = 24;
            break;
          }
          case "not-empty": {
            v = 25;
            break;
          }
          case "not-recoverable": {
            v = 26;
            break;
          }
          case "unsupported": {
            v = 27;
            break;
          }
          case "no-tty": {
            v = 28;
            break;
          }
          case "no-such-device": {
            v = 29;
            break;
          }
          case "overflow": {
            v = 30;
            break;
          }
          case "not-permitted": {
            v = 31;
            break;
          }
          case "pipe": {
            v = 32;
            break;
          }
          case "read-only": {
            v = 33;
            break;
          }
          case "invalid-seek": {
            v = 34;
            break;
          }
          case "text-file-busy": {
            v = 35;
            break;
          }
          case "cross-device": {
            v = 36;
            break;
          }
          default:
            throw h instanceof Error && console.error(h), new TypeError(`"${A}" is not one of the cases of error-code`);
        }
        u(l).setInt8(e + 4, v, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function pn(r, e, t) {
    var n = r, a = et[(n << 1) + 1] & -1073741825, i = Pe.get(a);
    i || (i = Object.create(Ue.prototype), Object.defineProperty(i, g, {
      writable: true,
      value: n
    }), Object.defineProperty(i, j, {
      writable: true,
      value: a
    })), w.push(i);
    let d;
    try {
      d = {
        tag: "ok",
        val: i.read(BigInt.asUintN(64, e))
      };
    } catch (h) {
      d = {
        tag: "err",
        val: P(h)
      };
    }
    for (const h of w) h[g] = void 0;
    w = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const h = f.val;
        u(l).setInt8(t + 0, 0, true);
        var p = h, o = p.byteLength, s = se(0, 0, 1, o * 1), c = new Uint8Array(p.buffer || p, p.byteOffset, o * 1);
        new Uint8Array(l.buffer, s, o * 1).set(c), u(l).setInt32(t + 8, o, true), u(l).setInt32(t + 4, s, true);
        break;
      }
      case "err": {
        const h = f.val;
        u(l).setInt8(t + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (u(l).setInt8(t + 4, 0, true), !(v instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[g];
            if (!A) {
              const T = v[j] || ++We;
              ke.set(T, v), A = Q(ge, T);
            }
            u(l).setInt32(t + 8, A, true);
            break;
          }
          case "closed": {
            u(l).setInt8(t + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function bn(r, e, t) {
    var n = r, a = et[(n << 1) + 1] & -1073741825, i = Pe.get(a);
    i || (i = Object.create(Ue.prototype), Object.defineProperty(i, g, {
      writable: true,
      value: n
    }), Object.defineProperty(i, j, {
      writable: true,
      value: a
    })), w.push(i);
    let d;
    try {
      d = {
        tag: "ok",
        val: i.blockingRead(BigInt.asUintN(64, e))
      };
    } catch (h) {
      d = {
        tag: "err",
        val: P(h)
      };
    }
    for (const h of w) h[g] = void 0;
    w = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const h = f.val;
        u(l).setInt8(t + 0, 0, true);
        var p = h, o = p.byteLength, s = se(0, 0, 1, o * 1), c = new Uint8Array(p.buffer || p, p.byteOffset, o * 1);
        new Uint8Array(l.buffer, s, o * 1).set(c), u(l).setInt32(t + 8, o, true), u(l).setInt32(t + 4, s, true);
        break;
      }
      case "err": {
        const h = f.val;
        u(l).setInt8(t + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (u(l).setInt8(t + 4, 0, true), !(v instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[g];
            if (!A) {
              const T = v[j] || ++We;
              ke.set(T, v), A = Q(ge, T);
            }
            u(l).setInt32(t + 8, A, true);
            break;
          }
          case "closed": {
            u(l).setInt8(t + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function vn(r, e) {
    var t = r, n = me[(t << 1) + 1] & -1073741825, a = ne.get(n);
    a || (a = Object.create(ae.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.checkWrite()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: P(o)
      };
    }
    for (const o of w) o[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        u(l).setInt8(e + 0, 0, true), u(l).setBigInt64(e + 8, V(o), true);
        break;
      }
      case "err": {
        const o = d.val;
        u(l).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const s = f.val;
            if (u(l).setInt8(e + 8, 0, true), !(s instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var p = s[g];
            if (!p) {
              const c = s[j] || ++We;
              ke.set(c, s), p = Q(ge, c);
            }
            u(l).setInt32(e + 12, p, true);
            break;
          }
          case "closed": {
            u(l).setInt8(e + 8, 1, true);
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
  function kn(r, e, t, n) {
    var a = r, i = me[(a << 1) + 1] & -1073741825, d = ne.get(i);
    d || (d = Object.create(ae.prototype), Object.defineProperty(d, g, {
      writable: true,
      value: a
    }), Object.defineProperty(d, j, {
      writable: true,
      value: i
    })), w.push(d);
    var f = e, p = t, o = new Uint8Array(l.buffer.slice(f, f + p * 1));
    let s;
    try {
      s = {
        tag: "ok",
        val: d.write(o)
      };
    } catch (h) {
      s = {
        tag: "err",
        val: P(h)
      };
    }
    for (const h of w) h[g] = void 0;
    w = [];
    var c = s;
    switch (c.tag) {
      case "ok": {
        c.val, u(l).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const h = c.val;
        u(l).setInt8(n + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (u(l).setInt8(n + 4, 0, true), !(v instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[g];
            if (!A) {
              const T = v[j] || ++We;
              ke.set(T, v), A = Q(ge, T);
            }
            u(l).setInt32(n + 8, A, true);
            break;
          }
          case "closed": {
            u(l).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function mn(r, e, t, n) {
    var a = r, i = me[(a << 1) + 1] & -1073741825, d = ne.get(i);
    d || (d = Object.create(ae.prototype), Object.defineProperty(d, g, {
      writable: true,
      value: a
    }), Object.defineProperty(d, j, {
      writable: true,
      value: i
    })), w.push(d);
    var f = e, p = t, o = new Uint8Array(l.buffer.slice(f, f + p * 1));
    let s;
    try {
      s = {
        tag: "ok",
        val: d.blockingWriteAndFlush(o)
      };
    } catch (h) {
      s = {
        tag: "err",
        val: P(h)
      };
    }
    for (const h of w) h[g] = void 0;
    w = [];
    var c = s;
    switch (c.tag) {
      case "ok": {
        c.val, u(l).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const h = c.val;
        u(l).setInt8(n + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (u(l).setInt8(n + 4, 0, true), !(v instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[g];
            if (!A) {
              const T = v[j] || ++We;
              ke.set(T, v), A = Q(ge, T);
            }
            u(l).setInt32(n + 8, A, true);
            break;
          }
          case "closed": {
            u(l).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function yn(r, e) {
    var t = r, n = me[(t << 1) + 1] & -1073741825, a = ne.get(n);
    a || (a = Object.create(ae.prototype), Object.defineProperty(a, g, {
      writable: true,
      value: t
    }), Object.defineProperty(a, j, {
      writable: true,
      value: n
    })), w.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.blockingFlush()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: P(o)
      };
    }
    for (const o of w) o[g] = void 0;
    w = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        d.val, u(l).setInt8(e + 0, 0, true);
        break;
      }
      case "err": {
        const o = d.val;
        u(l).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const s = f.val;
            if (u(l).setInt8(e + 4, 0, true), !(s instanceof ve)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var p = s[g];
            if (!p) {
              const c = s[j] || ++We;
              ke.set(c, s), p = Q(ge, c);
            }
            u(l).setInt32(e + 8, p, true);
            break;
          }
          case "closed": {
            u(l).setInt8(e + 4, 1, true);
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
  function An(r, e) {
    var n = Wa(BigInt.asUintN(64, r)), a = n.byteLength, i = se(0, 0, 1, a * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, a * 1);
    new Uint8Array(l.buffer, i, a * 1).set(d), u(l).setInt32(e + 4, a, true), u(l).setInt32(e + 0, i, true);
  }
  function hn(r) {
    var t = Ua(), n = t.length, a = se(0, 0, 4, n * 12);
    for (let s = 0; s < t.length; s++) {
      const c = t[s], y = a + s * 12;
      var [i, d] = c;
      if (!(i instanceof z)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      var f = i[g];
      if (!f) {
        const A = i[j] || ++ts;
        Z.set(A, i), f = Q(G, A);
      }
      u(l).setInt32(y + 0, f, true);
      var p = pe(d, se, l), o = K;
      u(l).setInt32(y + 8, o, true), u(l).setInt32(y + 4, p, true);
    }
    u(l).setInt32(r + 4, n, true), u(l).setInt32(r + 0, a, true);
  }
  const rs = [
    J,
    0
  ], Zt = /* @__PURE__ */ new Map();
  let wn = 0;
  function gn(r) {
    var t = Fa();
    if (t == null) u(l).setInt8(r + 0, 0, true);
    else {
      const a = t;
      if (u(l).setInt8(r + 0, 1, true), !(a instanceof Ht)) throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
      var n = a[g];
      if (!n) {
        const i = a[j] || ++wn;
        Zt.set(i, a), n = Q(rs, i);
      }
      u(l).setInt32(r + 4, n, true);
    }
  }
  const dr = [
    J,
    0
  ], pt = /* @__PURE__ */ new Map();
  let ss = 0;
  function In(r) {
    var t = Qa();
    if (t == null) u(l).setInt8(r + 0, 0, true);
    else {
      const a = t;
      if (u(l).setInt8(r + 0, 1, true), !(a instanceof ut)) throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
      var n = a[g];
      if (!n) {
        const i = a[j] || ++ss;
        pt.set(i, a), n = Q(dr, i);
      }
      u(l).setInt32(r + 4, n, true);
    }
  }
  function En(r) {
    var t = Ma();
    if (t == null) u(l).setInt8(r + 0, 0, true);
    else {
      const a = t;
      if (u(l).setInt8(r + 0, 1, true), !(a instanceof ut)) throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
      var n = a[g];
      if (!n) {
        const i = a[j] || ++ss;
        pt.set(i, a), n = Q(dr, i);
      }
      u(l).setInt32(r + 4, n, true);
    }
  }
  let _n, q, as;
  function Tn(r) {
    const e = Ne(ur, r);
    if (e.own) {
      const t = ft.get(e.rep);
      t ? (t[H] && t[H](), ft.delete(e.rep)) : dt[X] && dt[X](e.rep);
    }
  }
  function Bn(r) {
    const e = Ne(me, r);
    if (e.own) {
      const t = ne.get(e.rep);
      t ? (t[H] && t[H](), ne.delete(e.rep)) : ae[X] && ae[X](e.rep);
    }
  }
  function Cn(r) {
    const e = Ne(ge, r);
    if (e.own) {
      const t = ke.get(e.rep);
      t ? (t[H] && t[H](), ke.delete(e.rep)) : ve[X] && ve[X](e.rep);
    }
  }
  function jn(r) {
    const e = Ne(et, r);
    if (e.own) {
      const t = Pe.get(e.rep);
      t ? (t[H] && t[H](), Pe.delete(e.rep)) : Ue[X] && Ue[X](e.rep);
    }
  }
  function $n(r) {
    const e = Ne(G, r);
    if (e.own) {
      const t = Z.get(e.rep);
      t ? (t[H] && t[H](), Z.delete(e.rep)) : z[X] && z[X](e.rep);
    }
  }
  function xn(r) {
    const e = Ne(rs, r);
    if (e.own) {
      const t = Zt.get(e.rep);
      t ? (t[H] && t[H](), Zt.delete(e.rep)) : Ht[X] && Ht[X](e.rep);
    }
  }
  function On(r) {
    const e = Ne(dr, r);
    if (e.own) {
      const t = pt.get(e.rep);
      t ? (t[H] && t[H](), pt.delete(e.rep)) : ut[X] && ut[X](e.rep);
    }
  }
  let ns;
  function Sn(r, e) {
    os || Xa();
    var t = q(0, 0, 4, 84), n = r, a = n.byteLength, i = q(0, 0, 1, a * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, a * 1);
    new Uint8Array(l.buffer, i, a * 1).set(d), u(l).setInt32(t + 4, a, true), u(l).setInt32(t + 0, i, true);
    var { name: f, noTypescript: p, instantiation: o, importBindings: s, map: c, compat: y, noNodejsCompat: A, base64Cutoff: h, tlaCompat: v, validLiftingOptimization: T, tracing: S, noNamespacedExports: _, guest: ee, multiMemory: R, asyncMode: I } = e, Ee = pe(f, q, l), le = K;
    u(l).setInt32(t + 12, le, true), u(l).setInt32(t + 8, Ee, true);
    var x = p;
    if (x == null) u(l).setInt8(t + 16, 0, true);
    else {
      const B = x;
      u(l).setInt8(t + 16, 1, true), u(l).setInt8(t + 17, B ? 1 : 0, true);
    }
    var b = o;
    if (b == null) u(l).setInt8(t + 18, 0, true);
    else {
      const B = b;
      u(l).setInt8(t + 18, 1, true);
      var U = B;
      switch (U.tag) {
        case "async": {
          u(l).setInt8(t + 19, 0, true);
          break;
        }
        case "sync": {
          u(l).setInt8(t + 19, 1, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(U.tag)}\` (received \`${U}\`) specified for \`InstantiationMode\``);
      }
    }
    var _e2 = s;
    if (_e2 == null) u(l).setInt8(t + 20, 0, true);
    else {
      const B = _e2;
      u(l).setInt8(t + 20, 1, true);
      var He = B;
      switch (He.tag) {
        case "js": {
          u(l).setInt8(t + 21, 0, true);
          break;
        }
        case "hybrid": {
          u(l).setInt8(t + 21, 1, true);
          break;
        }
        case "optimized": {
          u(l).setInt8(t + 21, 2, true);
          break;
        }
        case "direct-optimized": {
          u(l).setInt8(t + 21, 3, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(He.tag)}\` (received \`${He}\`) specified for \`BindingsMode\``);
      }
    }
    var Ze = c;
    if (Ze == null) u(l).setInt8(t + 24, 0, true);
    else {
      const B = Ze;
      u(l).setInt8(t + 24, 1, true);
      var Me = B, Y = Me.length, E = q(0, 0, 4, Y * 16);
      for (let F = 0; F < Me.length; F++) {
        const W = Me[F], Ae = E + F * 16;
        var [Te, Ts] = W, Bs = pe(Te, q, l), Cs = K;
        u(l).setInt32(Ae + 4, Cs, true), u(l).setInt32(Ae + 0, Bs, true);
        var js = pe(Ts, q, l), $s = K;
        u(l).setInt32(Ae + 12, $s, true), u(l).setInt32(Ae + 8, js, true);
      }
      u(l).setInt32(t + 32, Y, true), u(l).setInt32(t + 28, E, true);
    }
    var It = y;
    if (It == null) u(l).setInt8(t + 36, 0, true);
    else {
      const B = It;
      u(l).setInt8(t + 36, 1, true), u(l).setInt8(t + 37, B ? 1 : 0, true);
    }
    var Et = A;
    if (Et == null) u(l).setInt8(t + 38, 0, true);
    else {
      const B = Et;
      u(l).setInt8(t + 38, 1, true), u(l).setInt8(t + 39, B ? 1 : 0, true);
    }
    var _t2 = h;
    if (_t2 == null) u(l).setInt8(t + 40, 0, true);
    else {
      const B = _t2;
      u(l).setInt8(t + 40, 1, true), u(l).setInt32(t + 44, $e(B), true);
    }
    var Tt = v;
    if (Tt == null) u(l).setInt8(t + 48, 0, true);
    else {
      const B = Tt;
      u(l).setInt8(t + 48, 1, true), u(l).setInt8(t + 49, B ? 1 : 0, true);
    }
    var Bt = T;
    if (Bt == null) u(l).setInt8(t + 50, 0, true);
    else {
      const B = Bt;
      u(l).setInt8(t + 50, 1, true), u(l).setInt8(t + 51, B ? 1 : 0, true);
    }
    var Ct = S;
    if (Ct == null) u(l).setInt8(t + 52, 0, true);
    else {
      const B = Ct;
      u(l).setInt8(t + 52, 1, true), u(l).setInt8(t + 53, B ? 1 : 0, true);
    }
    var jt = _;
    if (jt == null) u(l).setInt8(t + 54, 0, true);
    else {
      const B = jt;
      u(l).setInt8(t + 54, 1, true), u(l).setInt8(t + 55, B ? 1 : 0, true);
    }
    var $t = ee;
    if ($t == null) u(l).setInt8(t + 56, 0, true);
    else {
      const B = $t;
      u(l).setInt8(t + 56, 1, true), u(l).setInt8(t + 57, B ? 1 : 0, true);
    }
    var xt = R;
    if (xt == null) u(l).setInt8(t + 58, 0, true);
    else {
      const B = xt;
      u(l).setInt8(t + 58, 1, true), u(l).setInt8(t + 59, B ? 1 : 0, true);
    }
    var Ot = I;
    if (Ot == null) u(l).setInt8(t + 60, 0, true);
    else {
      const B = Ot;
      u(l).setInt8(t + 60, 1, true);
      var at = B;
      switch (at.tag) {
        case "sync": {
          u(l).setInt8(t + 64, 0, true);
          break;
        }
        case "jspi": {
          const F = at.val;
          u(l).setInt8(t + 64, 1, true);
          var { imports: xs, exports: Os } = F, St = xs, kr = St.length, mr = q(0, 0, 4, kr * 8);
          for (let W = 0; W < St.length; W++) {
            const Ae = St[W], Je = mr + W * 8;
            var Ss = pe(Ae, q, l), Rs = K;
            u(l).setInt32(Je + 4, Rs, true), u(l).setInt32(Je + 0, Ss, true);
          }
          u(l).setInt32(t + 72, kr, true), u(l).setInt32(t + 68, mr, true);
          var Rt = Os, yr = Rt.length, Ar = q(0, 0, 4, yr * 8);
          for (let W = 0; W < Rt.length; W++) {
            const Ae = Rt[W], Je = Ar + W * 8;
            var Ls = pe(Ae, q, l), Ns = K;
            u(l).setInt32(Je + 4, Ns, true), u(l).setInt32(Je + 0, Ls, true);
          }
          u(l).setInt32(t + 80, yr, true), u(l).setInt32(t + 76, Ar, true);
          break;
        }
        default:
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(at.tag)}\` (received \`${at}\`) specified for \`AsyncMode\``);
      }
    }
    const te = ns(t);
    let Lt;
    switch (u(l).getUint8(te + 0, true)) {
      case 0: {
        var Ms = u(l).getInt32(te + 8, true), Fs = u(l).getInt32(te + 4, true), hr = [];
        for (let B = 0; B < Ms; B++) {
          const F = Fs + B * 16;
          var Qs = u(l).getInt32(F + 0, true), Us = u(l).getInt32(F + 4, true), Ps = je.decode(new Uint8Array(l.buffer, Qs, Us)), wr = u(l).getInt32(F + 8, true), Ws = u(l).getInt32(F + 12, true), Ds = new Uint8Array(l.buffer.slice(wr, wr + Ws * 1));
          hr.push([
            Ps,
            Ds
          ]);
        }
        var Vs = u(l).getInt32(te + 16, true), zs = u(l).getInt32(te + 12, true), gr = [];
        for (let B = 0; B < Vs; B++) {
          const F = zs + B * 8;
          var Xs = u(l).getInt32(F + 0, true), Hs = u(l).getInt32(F + 4, true), Zs = je.decode(new Uint8Array(l.buffer, Xs, Hs));
          gr.push(Zs);
        }
        var Js = u(l).getInt32(te + 24, true), Gs = u(l).getInt32(te + 20, true), Ir = [];
        for (let B = 0; B < Js; B++) {
          const F = Gs + B * 12;
          var Ys = u(l).getInt32(F + 0, true), qs = u(l).getInt32(F + 4, true), Ks = je.decode(new Uint8Array(l.buffer, Ys, qs));
          let W;
          switch (u(l).getUint8(F + 8, true)) {
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
          Ir.push([
            Ks,
            W
          ]);
        }
        Lt = {
          tag: "ok",
          val: {
            files: hr,
            imports: gr,
            exports: Ir
          }
        };
        break;
      }
      case 1: {
        var ea = u(l).getInt32(te + 4, true), ta = u(l).getInt32(te + 8, true), ra = je.decode(new Uint8Array(l.buffer, ea, ta));
        Lt = {
          tag: "err",
          val: ra
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    const nt = Lt;
    if (as(te), typeof nt == "object" && nt.tag === "err") throw new Da(nt.val);
    return nt.val;
  }
  let os = false;
  const Rn = (() => {
    let r = function* () {
      const f = jr(new URL("/component-ui/assets/js-component-bindgen-component.core-DjGiHRyQ.wasm", import.meta.url)), p = jr(new URL("/component-ui/assets/js-component-bindgen-component.core2-0cWI-1I7.wasm", import.meta.url)), o = Cr("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwADJiUHCAkCAgQEAgIKAgsBAQAAAAUDAwAAAAUMAAMDAAYGAA0BAQEBBAUBcAElJQe7ASYBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABACMTcAEQIxOAASAjE5ABMCMjAAFAIyMQAVAjIyABYCMjMAFwIyNAAYAjI1ABkCMjYAGgIyNwAbAjI4ABwCMjkAHQIzMAAeAjMxAB8CMzIAIAIzMwAhAjM0ACICMzUAIwIzNgAkCCRpbXBvcnRzAQAK+QMlGQAgACABIAIgAyAEIAUgBiAHIAhBABEHAAsRACAAIAEgAiADIARBAREIAAsRACAAIAEgAiADIARBAhEJAAsLACAAIAFBAxECAAsLACAAIAFBBBECAAsPACAAIAEgAiADQQURBAALDwAgACABIAIgA0EGEQQACwsAIAAgAUEHEQIACwsAIAAgAUEIEQIACwkAIABBCREKAAsLACAAIAFBChECAAsNACAAIAEgAkELEQsACwkAIABBDBEBAAsJACAAQQ0RAQALCwAgACABQQ4RAAALCwAgACABQQ8RAAALCwAgACABQRARAAALEQAgACABIAIgAyAEQRERBQALDQAgACABIAJBEhEDAAsNACAAIAEgAkETEQMACwsAIAAgAUEUEQAACwsAIAAgAUEVEQAACwsAIAAgAUEWEQAACxEAIAAgASACIAMgBEEXEQUACxUAIAAgASACIAMgBCAFIAZBGBEMAAsLACAAIAFBGREAAAsNACAAIAEgAkEaEQMACw0AIAAgASACQRsRAwALCwAgACABQRwRAAALDwAgACABIAIgA0EdEQYACw8AIAAgASACIANBHhEGAAsLACAAIAFBHxEAAAsLACAAIAFBIBENAAsJACAAQSERAQALCQAgAEEiEQEACwkAIABBIxEBAAsJACAAQSQRAQALAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yMjUuMA"), s = Cr("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAJf39/f39+fn9/AX9gBX9/f35/AX9gBX9/f39/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwAC5AEmAAEwAAcAATEACAABMgAJAAEzAAIAATQAAgABNQAEAAE2AAQAATcAAgABOAACAAE5AAoAAjEwAAIAAjExAAsAAjEyAAEAAjEzAAEAAjE0AAAAAjE1AAAAAjE2AAAAAjE3AAUAAjE4AAMAAjE5AAMAAjIwAAAAAjIxAAAAAjIyAAAAAjIzAAUAAjI0AAwAAjI1AAAAAjI2AAMAAjI3AAMAAjI4AAAAAjI5AAYAAjMwAAYAAjMxAAAAAjMyAA0AAjMzAAEAAjM0AAEAAjM1AAEAAjM2AAEACCRpbXBvcnRzAXABJSUJKwEAQQALJQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjIyNS4w");
      ({ exports: C } = yield it(yield o)), { exports: ue } = yield it(yield f, {
        wasi_snapshot_preview1: {
          environ_get: C[7],
          environ_sizes_get: C[8],
          fd_close: C[9],
          fd_filestat_get: C[4],
          fd_prestat_dir_name: C[11],
          fd_prestat_get: C[10],
          fd_read: C[5],
          fd_readdir: C[1],
          fd_write: C[6],
          path_filestat_get: C[2],
          path_open: C[0],
          proc_exit: C[12],
          random_get: C[3]
        }
      }), { exports: D } = yield it(yield p, {
        __main_module__: {
          cabi_realloc: ue.cabi_realloc
        },
        env: {
          memory: ue.memory
        },
        "wasi:cli/environment@0.2.3": {
          "get-environment": C[13]
        },
        "wasi:cli/exit@0.2.3": {
          exit: Ya
        },
        "wasi:cli/stderr@0.2.3": {
          "get-stderr": Za
        },
        "wasi:cli/stdin@0.2.3": {
          "get-stdin": Ja
        },
        "wasi:cli/stdout@0.2.3": {
          "get-stdout": Ga
        },
        "wasi:cli/terminal-input@0.2.3": {
          "[resource-drop]terminal-input": xn
        },
        "wasi:cli/terminal-output@0.2.3": {
          "[resource-drop]terminal-output": On
        },
        "wasi:cli/terminal-stderr@0.2.3": {
          "get-terminal-stderr": C[36]
        },
        "wasi:cli/terminal-stdin@0.2.3": {
          "get-terminal-stdin": C[34]
        },
        "wasi:cli/terminal-stdout@0.2.3": {
          "get-terminal-stdout": C[35]
        },
        "wasi:filesystem/preopens@0.2.3": {
          "get-directories": C[33]
        },
        "wasi:filesystem/types@0.2.3": {
          "[method]descriptor.append-via-stream": C[20],
          "[method]descriptor.get-type": C[14],
          "[method]descriptor.metadata-hash": C[15],
          "[method]descriptor.metadata-hash-at": C[17],
          "[method]descriptor.open-at": C[24],
          "[method]descriptor.read-directory": C[21],
          "[method]descriptor.read-via-stream": C[18],
          "[method]descriptor.stat": C[22],
          "[method]descriptor.stat-at": C[23],
          "[method]descriptor.write-via-stream": C[19],
          "[method]directory-entry-stream.read-directory-entry": C[25],
          "[resource-drop]descriptor": $n,
          "[resource-drop]directory-entry-stream": Tn,
          "filesystem-error-code": C[16]
        },
        "wasi:io/error@0.2.3": {
          "[resource-drop]error": Cn
        },
        "wasi:io/streams@0.2.3": {
          "[method]input-stream.blocking-read": C[27],
          "[method]input-stream.read": C[26],
          "[method]output-stream.blocking-flush": C[31],
          "[method]output-stream.blocking-write-and-flush": C[30],
          "[method]output-stream.check-write": C[28],
          "[method]output-stream.write": C[29],
          "[resource-drop]input-stream": jn,
          "[resource-drop]output-stream": Bn
        },
        "wasi:random/random@0.2.3": {
          "get-random-bytes": C[32]
        }
      }), l = ue.memory, se = D.cabi_import_realloc, { exports: _n } = yield it(yield s, {
        "": {
          $imports: C.$imports,
          0: D.path_open,
          1: D.fd_readdir,
          10: D.fd_prestat_get,
          11: D.fd_prestat_dir_name,
          12: D.proc_exit,
          13: qa,
          14: Ka,
          15: en,
          16: tn,
          17: rn,
          18: sn,
          19: an,
          2: D.path_filestat_get,
          20: nn,
          21: cn,
          22: ln,
          23: un,
          24: dn,
          25: fn,
          26: pn,
          27: bn,
          28: vn,
          29: kn,
          3: D.random_get,
          30: mn,
          31: yn,
          32: An,
          33: hn,
          34: gn,
          35: In,
          36: En,
          4: D.fd_filestat_get,
          5: D.fd_read,
          6: D.fd_write,
          7: D.environ_get,
          8: D.environ_sizes_get,
          9: D.fd_close
        }
      }), q = ue.cabi_realloc, as = ue.cabi_post_generate, ue["cabi_post_generate-types"], os = true, ns = ue.generate, ue["generate-types"];
    }(), e, t, n;
    function a(d) {
      try {
        let f;
        do
          ({ value: d, done: f } = r.next(d));
        while (!(d instanceof Promise) && !f);
        if (f) if (t) t(d);
        else return d;
        e || (e = new Promise((p, o) => (t = p, n = o))), d.then(a, n);
      } catch (f) {
        if (n) n(f);
        else throw f;
      }
    }
    const i = a(null);
    return e || i;
  })();
  async function Ln() {
    return await Rn, Sn.apply(this, arguments);
  }
  class mt {
    visitType(e, t) {
      throw new Error("Not implemented");
    }
    visitNull(e, t) {
      return this.visitType(e, t);
    }
    visitBool(e, t) {
      return this.visitType(e, t);
    }
    visitString(e, t) {
      return this.visitType(e, t);
    }
    visitNumber(e, t) {
      return this.visitType(e, t);
    }
    visitFixedNat(e, t) {
      return this.visitNumber(e, t);
    }
    visitFixedInt(e, t) {
      return this.visitNumber(e, t);
    }
    visitFixedFloat(e, t) {
      return this.visitNumber(e, t);
    }
    visitOpt(e, t, n) {
      return this.visitType(e, n);
    }
    visitVec(e, t, n) {
      return this.visitType(e, n);
    }
    visitRecord(e, t, n) {
      return this.visitType(e, n);
    }
    visitTuple(e, t, n) {
      return this.visitType(e, n);
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
    visitResource(e, t) {
      return this.visitType(e, t);
    }
    visitRec(e, t, n) {
      return this.visitType(e, n);
    }
  }
  class M {
  }
  class is extends M {
    accept(e, t) {
      return e.visitNull(this, t);
    }
    get name() {
      return "_";
    }
  }
  class fr extends M {
    accept(e, t) {
      return e.visitBool(this, t);
    }
    get name() {
      return "bool";
    }
  }
  class cs extends M {
    accept(e, t) {
      return e.visitString(this, t);
    }
    get name() {
      return "string";
    }
  }
  class tt extends M {
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
  class rt extends M {
    constructor(e) {
      super(), this._bits = e;
    }
    accept(e, t) {
      return e.visitFixedInt(this, t);
    }
    get name() {
      return `s${this._bits}`;
    }
  }
  class pr extends M {
    constructor(e) {
      super(), this._bits = e;
    }
    accept(e, t) {
      return e.visitFixedFloat(this, t);
    }
    get name() {
      return `f${this._bits}`;
    }
  }
  class yt extends M {
    constructor(e) {
      super(), this._ty = e;
    }
    accept(e, t) {
      return e.visitOpt(this, this._ty, t);
    }
    get name() {
      return `option&lt;${this._ty.name}&gt;`;
    }
    maybe_null() {
      return this._ty instanceof yt ? !this._ty.maybe_null() : false;
    }
  }
  class ls extends M {
    constructor(e) {
      super(), this._ty = e;
    }
    accept(e, t) {
      return e.visitVec(this, this._ty, t);
    }
    get name() {
      return `list&lt;${this._ty.name}&gt;`;
    }
  }
  class br extends M {
    constructor(e) {
      super(), this._fields = e;
    }
    accept(e, t) {
      return e.visitRecord(this, this._fields, t);
    }
    get name() {
      return `record { ${Object.entries(this._fields).map(([e, t]) => `${e}: ${t.name}`).join(", ")} }`;
    }
  }
  class us extends M {
    constructor(e) {
      super(), this._components = e;
    }
    accept(e, t) {
      return e.visitTuple(this, this._components, t);
    }
    get name() {
      return `tuple&lt;${this._components.map((e) => e.name).join(", ")}&gt;`;
    }
  }
  class ds extends M {
    constructor(e) {
      super(), this._fields = e;
    }
    accept(e, t) {
      return e.visitVariant(this, this._fields, t);
    }
    get name() {
      return `variant { ${Object.entries(this._fields).map(([e, t]) => e + (t.name === "_" ? "" : `(${t.name})`)).join(", ")} }`;
    }
  }
  class fs extends M {
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
  const _st = class _st extends M {
    constructor() {
      super(...arguments);
      __publicField(this, "_id", _st._counter++);
      __publicField(this, "_type");
    }
    accept(e, t) {
      if (!this._type) throw new Error("Recursive type uninitialized");
      return e.visitRec(this, this._type, t);
    }
    fill(e) {
      this._type = e;
    }
    get_type() {
      return this._type;
    }
    get name() {
      return this._type ? this._type.name : `rec_${this._id}`;
    }
  };
  __publicField(_st, "_counter", 0);
  let st = _st;
  class ps extends M {
    constructor(e, t, n = "") {
      super(), this._args = e, this._ret = t, this._kind = n;
    }
    accept(e, t) {
      return e.visitFunc(this, t);
    }
    get name() {
      return `func(${this._args.map((e) => `${e[0]}: ${e[1].name}`).join(", ")}) -> (${this._ret.map((e) => e.name).join(", ")})`;
    }
  }
  class At extends M {
    constructor(e, t) {
      super();
      __publicField(this, "instances", {});
      __publicField(this, "_counter", 0);
      this._name = e, this._fields = t;
    }
    accept(e, t) {
      return e.visitResource(this, t);
    }
    get name() {
      return `resource ${this._name}`;
    }
    get_static_funcs() {
      return Object.entries(this._fields).filter(([e, t]) => t._kind.endsWith("static") || t._kind.endsWith("constructor"));
    }
    get_method_funcs() {
      return Object.entries(this._fields).filter(([e, t]) => t._kind.endsWith("method"));
    }
    add_instance(e) {
      const t = `${this._name.toLowerCase()}_${this._counter++}`;
      return this.instances[t] = e, t;
    }
  }
  class bs extends M {
    constructor(e) {
      super(), this._ty = e;
    }
    accept(e, t) {
      return this._ty.accept(e, t);
    }
    get name() {
      return `${this._ty.name}`;
    }
  }
  class vs extends M {
    constructor(e) {
      super(), this._ty = e;
    }
    accept(e, t) {
      return this._ty.accept(e, t);
    }
    get name() {
      return `borrow&lt;${this._ty.name}&gt;`;
    }
  }
  class ks extends M {
    constructor(e, t, n = {}) {
      super(), this._name = e, this._fields = t, this._vars = n;
      for (const [a, i] of Object.entries(n)) this[a] = i;
    }
    accept(e, t) {
      return e.visitInterface(this, t);
    }
    get name() {
      return `interface ${this._name}`;
    }
    get_resources() {
      return Object.entries(this._vars).filter(([e, t]) => t instanceof st && t.get_type() instanceof At).map(([e, t]) => t.get_type());
    }
  }
  const ms = new is(), ys = new fr(), Nn = new cs(), Mn = new tt(8), Fn = new tt(16), Qn = new tt(32), Un = new tt(64), Pn = new rt(8), Wn = new rt(16), Dn = new rt(32), Vn = new rt(64), zn = new pr(32), Xn = new pr(64);
  function As(r) {
    return new yt(r);
  }
  function Hn(r) {
    return new ls(r);
  }
  function Zn(r) {
    return new br(r);
  }
  function Jn(r) {
    return new br(Object.fromEntries(r.map((e) => [
      e,
      ys
    ])));
  }
  function Gn(r) {
    return new us(r);
  }
  function Yn(r) {
    return new fs(r);
  }
  function qn(r) {
    return new ds(r);
  }
  function Kn(r, e, t) {
    return new ps(r, e, t);
  }
  function eo(r, e, t) {
    return new ks(r, e, t);
  }
  function to(r, e) {
    return new At(r, e);
  }
  function ro() {
    return new st();
  }
  function so(r) {
    return new bs(r);
  }
  function ao(r) {
    return new vs(r);
  }
  const no = Object.freeze(Object.defineProperty({
    __proto__: null,
    Bool: ys,
    BoolClass: fr,
    Borrow: ao,
    BorrowClass: vs,
    Enum: Yn,
    EnumClass: fs,
    F32: zn,
    F64: Xn,
    FixedFloatClass: pr,
    FixedIntClass: rt,
    FixedNatClass: tt,
    Flags: Jn,
    Func: Kn,
    FuncClass: ps,
    Interface: eo,
    InterfaceClass: ks,
    Null: ms,
    NullClass: is,
    Opt: As,
    OptClass: yt,
    Owned: so,
    OwnedClass: bs,
    Rec: ro,
    RecClass: st,
    Record: Zn,
    RecordClass: br,
    Resource: to,
    ResourceClass: At,
    S16: Wn,
    S32: Dn,
    S64: Vn,
    S8: Pn,
    String: Nn,
    StringClass: cs,
    Tuple: Gn,
    TupleClass: us,
    Type: M,
    U16: Fn,
    U32: Qn,
    U64: Un,
    U8: Mn,
    Variant: qn,
    VariantClass: ds,
    Vec: Hn,
    VecClass: ls,
    Visitor: mt
  }, Symbol.toStringTag, {
    value: "Module"
  }));
  class oo {
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
          const n = this.ui.parse(this.idl, e, t);
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
  class De {
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
  class io extends De {
    constructor(e, t) {
      super(t), this.fields = e, this.ui = t;
    }
    generateForm() {
      this.form = this.fields.map(([e, t]) => {
        const n = this.ui.render(t);
        return this.ui.labelMap && this.ui.labelMap.hasOwnProperty(e) ? n.label = this.ui.labelMap[e] + " " : n.label = e + " ", n;
      });
    }
    parse(e) {
      const t = {};
      if (this.fields.forEach(([n, a], i) => {
        const d = this.form[i].parse(e);
        t[n] = d;
      }), !this.form.some((n) => n.isRejected())) return t;
    }
  }
  class co extends De {
    constructor(e, t) {
      super(t), this.components = e, this.ui = t;
    }
    generateForm() {
      this.form = this.components.map((e) => this.ui.render(e));
    }
    parse(e) {
      const t = [];
      if (this.components.forEach((n, a) => {
        const i = this.form[a].parse(e);
        t.push(i);
      }), !this.form.some((n) => n.isRejected())) return t;
    }
  }
  class lo extends De {
    constructor(e, t) {
      super(t), this.fields = e, this.ui = t;
    }
    generateForm() {
      const e = this.ui.open.selectedIndex, [t, n] = this.fields[e], a = this.ui.render(n);
      this.form = [
        a
      ];
    }
    parse(e) {
      const t = this.ui.open, n = t.options[t.selectedIndex].value, a = this.form[0].parse(e);
      return a === void 0 ? void 0 : {
        tag: n,
        val: a
      };
    }
  }
  class uo extends De {
    constructor(e, t) {
      super(t), this.fields = e, this.ui = t;
    }
    generateForm() {
      this.form = [
        this.ui.render(ms)
      ];
    }
    parse(e) {
      const t = this.ui.open;
      if (e.random && t.selectedIndex === -1) {
        const a = Math.floor(Math.random() * this.fields.length);
        return t.selectedIndex = a, this.ui.open.dispatchEvent(new Event("change")), this.fields[a];
      }
      return t.options[t.selectedIndex].value;
    }
  }
  class fo extends De {
    constructor(e, t) {
      super(t), this.ty = e, this.ui = t;
    }
    generateForm() {
      if (this.ui.open.checked) {
        const e = this.ui.render(this.ty);
        this.form = [
          e
        ];
      } else this.form = [];
    }
    parse(e) {
      if (this.form.length === 0) return this.shrinkValue({
        tag: "none"
      });
      {
        const t = this.form[0].parse(e);
        return t === void 0 ? void 0 : this.shrinkValue({
          tag: "some",
          val: t
        });
      }
    }
    shrinkValue(e) {
      return As(this.ty).maybe_null() ? e : e.tag === "some" ? e.val : null;
    }
  }
  class po extends De {
    constructor(e, t) {
      super(t), this.ty = e, this.ui = t;
    }
    generateForm() {
      const e = +this.ui.open.value;
      this.form = [];
      for (let t = 0; t < e; t++) {
        const n = this.ui.render(this.ty);
        this.form.push(n);
      }
    }
    parse(e) {
      const t = this.form.map((n) => n.parse(e));
      if (!this.form.some((n) => n.isRejected())) return t;
    }
  }
  const bo = {
    parse: Eo
  }, Ve = {
    render: vr
  }, de = (r, e) => new oo(r, {
    ...bo,
    ...e
  }), vo = (r, e) => new io(r, {
    ...Ve,
    ...e
  }), ko = (r, e) => new co(r, {
    ...Ve,
    ...e
  }), mo = (r, e) => new lo(r, {
    ...Ve,
    ...e
  }), yo = (r, e) => new uo(r, {
    ...Ve,
    ...e
  }), Ao = (r, e) => new fo(r, {
    ...Ve,
    ...e
  }), ho = (r, e) => new po(r, {
    ...Ve,
    ...e
  });
  class wo extends mt {
    visitType(e, t) {
      const n = document.createElement("input");
      return n.classList.add("argument"), n.placeholder = e.name, de(e, {
        input: n
      });
    }
    visitNull(e, t) {
      return de(e, {});
    }
    visitBool(e, t) {
      const n = document.createElement("input");
      return n.type = "checkbox", n.classList.add("open"), n.value = "true", de(e, {
        input: n
      });
    }
    visitVec(e, t, n) {
      const a = document.createElement("input");
      a.type = "number", a.min = "0", a.max = "100", a.placeholder = "len", a.classList.add("open");
      const i = document.createElement("div");
      i.classList.add("popup-form");
      const d = ho(t, {
        open: a,
        event: "change",
        container: i
      });
      return de(e, {
        form: d
      });
    }
    visitOpt(e, t, n) {
      const a = document.createElement("input");
      a.type = "checkbox", a.classList.add("open");
      const i = Ao(t, {
        open: a,
        event: "change"
      });
      return de(e, {
        form: i
      });
    }
    visitRecord(e, t, n) {
      let a = {};
      const i = Object.entries(t);
      if (i.length > 1) {
        const f = document.createElement("div");
        f.classList.add("popup-form"), a = {
          container: f
        };
      }
      const d = vo(i, a);
      return de(e, {
        form: d
      });
    }
    visitTuple(e, t, n) {
      let a = {};
      if (t.length > 1) {
        const d = document.createElement("div");
        d.classList.add("popup-form"), a = {
          container: d
        };
      }
      const i = ko(t, a);
      return de(e, {
        form: i
      });
    }
    visitVariant(e, t, n) {
      const a = Object.entries(t), i = document.createElement("select");
      for (const [p, o] of a) {
        const s = new Option(p);
        i.add(s);
      }
      i.selectedIndex = -1, i.classList.add("open");
      const f = mo(a, {
        open: i,
        event: "change"
      });
      return de(e, {
        form: f
      });
    }
    visitEnum(e, t, n) {
      const a = document.createElement("select");
      for (const f of t) {
        const p = new Option(f);
        a.add(p);
      }
      a.selectedIndex = -1, a.classList.add("open");
      const d = yo(t, {
        open: a,
        event: "change"
      });
      return de(e, {
        form: d
      });
    }
    visitRec(e, t, n) {
      return vr(t);
    }
  }
  class go extends mt {
    visitNull(e, t) {
      return null;
    }
    visitBool(e, t) {
      return t.checked;
    }
    visitString(e, t) {
      return t.value;
    }
    visitFixedNat(e, t) {
      return e._bits <= 32 ? parseInt(t.value, 10) : BigInt(t.value);
    }
    visitFixedInt(e, t) {
      return e._bits <= 32 ? parseInt(t.value, 10) : BigInt(t.value);
    }
    visitFixedFloat(e, t) {
      return parseFloat(t.value);
    }
    visitResource(e, t) {
      const n = e.instances[t.value];
      if (n === void 0) throw new Error(`Resource not found: ${t.value}`);
      return n;
    }
  }
  class Io extends mt {
    visitNull(e, t) {
      return null;
    }
    visitBool(e, t) {
      return Math.random() < 0.5;
    }
    visitString(e, t) {
      return Math.random().toString(36).substring(6);
    }
    visitFixedNat(e, t) {
      const n = this.generateNumber(false);
      return e._bits <= 32 ? n : BigInt(n);
    }
    visitFixedInt(e, t) {
      const n = this.generateNumber(true);
      return e._bits <= 32 ? n : BigInt(n);
    }
    visitFixedFloat(e, t) {
      return Math.random() * 100;
    }
    visitResource(e, t) {
      const n = Object.keys(e.instances);
      if (n.length === 0) throw new Error(`No resource ${e._name} available`);
      return e.instances[n[Math.floor(Math.random() * n.length)]];
    }
    generateNumber(e) {
      const t = Math.floor(Math.random() * 100);
      return e && Math.random() < 0.5 ? -t : t;
    }
  }
  function Eo(r, e, t) {
    return e.random && (r instanceof fr || r instanceof At || t.value === "") ? r.accept(new Io(), t) : r.accept(new go(), t);
  }
  function vr(r) {
    return r.accept(new wo(), null);
  }
  const { getEnvironment: _o } = vt, { exit: To } = nr, { getStderr: Bo } = cr, { getStdin: Co } = or, { getStdout: jo } = ir, { getDirectories: $o } = sr, { Descriptor: Oe, filesystemErrorCode: xo } = lt, { Error: Se } = er, { InputStream: Jt, OutputStream: oe } = Ye, { getRandomBytes: Oo } = be, $r = (r) => WebAssembly.compile(typeof Buffer < "u" ? Buffer.from(r, "base64") : Uint8Array.from(atob(r), (e) => e.charCodeAt(0)));
  class So extends Error {
    constructor(e) {
      const t = typeof e != "string";
      super(t ? `${String(e)} (see error.payload)` : e), Object.defineProperty(this, "payload", {
        value: e,
        enumerable: t
      });
    }
  }
  let O = [], Wt = new DataView(new ArrayBuffer());
  const m = (r) => Wt.buffer === r.buffer ? Wt : Wt = new DataView(r.buffer), Ro = typeof process < "u" && process.versions && process.versions.node;
  let Dt;
  async function xr(r) {
    return Ro ? (Dt = Dt || await fe(() => import("./__vite-browser-external-BIHI7g3E.js"), []), WebAssembly.compile(await Dt.readFile(r))) : fetch(r).then(WebAssembly.compileStreaming);
  }
  function Ie(r) {
    if (r && Lo.call(r, "payload")) return r.payload;
    if (r instanceof Error) throw r;
    return r;
  }
  const Lo = Object.prototype.hasOwnProperty, ct = WebAssembly.instantiate, re = 1 << 30;
  function ce(r, e) {
    const t = r[0] & -1073741825;
    return t === 0 ? (r.push(0), r.push(e | re), (r.length >> 1) - 1) : (r[0] = r[t << 1], r[t << 1] = 0, r[(t << 1) + 1] = e | re, t);
  }
  function ht(r, e) {
    const t = r[e << 1], n = r[(e << 1) + 1], a = (n & re) !== 0, i = n & -1073741825;
    if (n === 0 || (t & re) !== 0) throw new TypeError("Invalid handle");
    return r[e << 1] = r[0] | re, r[0] = e | re, {
      rep: i,
      scope: t,
      own: a
    };
  }
  const he = Symbol.for("cabiDispose"), $ = Symbol("handle"), N = Symbol.for("cabiRep"), we = Symbol.dispose || Symbol.for("dispose"), Qe = (r) => BigInt.asUintN(64, BigInt(r));
  function Vt(r) {
    return r >>> 0;
  }
  const Or = new TextDecoder(), No = new TextEncoder();
  let Ge = 0;
  function Gt(r, e, t) {
    if (typeof r != "string") throw new TypeError("expected a string");
    if (r.length === 0) return Ge = 0, 1;
    let n = No.encode(r), a = e(0, 0, 1, n.length);
    return new Uint8Array(t.buffer).set(n, a), Ge = n.length, a;
  }
  let L, Be;
  const ye = [
    re,
    0
  ], ie = /* @__PURE__ */ new Map();
  let wt = 0;
  function Mo() {
    const r = Bo();
    if (!(r instanceof oe)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = r[$];
    if (!e) {
      const t = r[N] || ++wt;
      ie.set(t, r), e = ce(ye, t);
    }
    return e;
  }
  const hs = [
    re,
    0
  ], Yt = /* @__PURE__ */ new Map();
  let Fo = 0;
  function Qo() {
    const r = Co();
    if (!(r instanceof Jt)) throw new TypeError('Resource error: Not a valid "InputStream" resource.');
    var e = r[$];
    if (!e) {
      const t = r[N] || ++Fo;
      Yt.set(t, r), e = ce(hs, t);
    }
    return e;
  }
  function Uo() {
    const r = jo();
    if (!(r instanceof oe)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
    var e = r[$];
    if (!e) {
      const t = r[N] || ++wt;
      ie.set(t, r), e = ce(ye, t);
    }
    return e;
  }
  function Po(r) {
    let e;
    switch (r) {
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
    To(e);
  }
  let Ce, k, xe;
  function Wo(r) {
    var t = _o(), n = t.length, a = xe(0, 0, 4, n * 16);
    for (let c = 0; c < t.length; c++) {
      const y = t[c], A = a + c * 16;
      var [i, d] = y, f = Gt(i, xe, k), p = Ge;
      m(k).setInt32(A + 4, p, true), m(k).setInt32(A + 0, f, true);
      var o = Gt(d, xe, k), s = Ge;
      m(k).setInt32(A + 12, s, true), m(k).setInt32(A + 8, o, true);
    }
    m(k).setInt32(r + 4, n, true), m(k).setInt32(r + 0, a, true);
  }
  const ze = [
    re,
    0
  ], Re = /* @__PURE__ */ new Map();
  let gt = 0;
  function Do(r, e) {
    var t = r, n = ze[(t << 1) + 1] & -1073741825, a = Re.get(n);
    a || (a = Object.create(Se.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    const i = xo(a);
    for (const p of O) p[$] = void 0;
    O = [];
    var d = i;
    if (d == null) m(k).setInt8(e + 0, 0, true);
    else {
      const p = d;
      m(k).setInt8(e + 0, 1, true);
      var f = p;
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
          throw p instanceof Error && console.error(p), new TypeError(`"${f}" is not one of the cases of error-code`);
      }
      m(k).setInt8(e + 1, o, true);
    }
  }
  const Xe = [
    re,
    0
  ], Le = /* @__PURE__ */ new Map();
  let Vo = 0;
  function zo(r, e, t) {
    var n = r, a = Xe[(n << 1) + 1] & -1073741825, i = Le.get(a);
    i || (i = Object.create(Oe.prototype), Object.defineProperty(i, $, {
      writable: true,
      value: n
    }), Object.defineProperty(i, N, {
      writable: true,
      value: a
    })), O.push(i);
    let d;
    try {
      d = {
        tag: "ok",
        val: i.writeViaStream(BigInt.asUintN(64, e))
      };
    } catch (s) {
      d = {
        tag: "err",
        val: Ie(s)
      };
    }
    for (const s of O) s[$] = void 0;
    O = [];
    var f = d;
    switch (f.tag) {
      case "ok": {
        const s = f.val;
        if (m(k).setInt8(t + 0, 0, true), !(s instanceof oe)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var p = s[$];
        if (!p) {
          const c = s[N] || ++wt;
          ie.set(c, s), p = ce(ye, c);
        }
        m(k).setInt32(t + 4, p, true);
        break;
      }
      case "err": {
        const s = f.val;
        m(k).setInt8(t + 0, 1, true);
        var o = s;
        let c;
        switch (o) {
          case "access": {
            c = 0;
            break;
          }
          case "would-block": {
            c = 1;
            break;
          }
          case "already": {
            c = 2;
            break;
          }
          case "bad-descriptor": {
            c = 3;
            break;
          }
          case "busy": {
            c = 4;
            break;
          }
          case "deadlock": {
            c = 5;
            break;
          }
          case "quota": {
            c = 6;
            break;
          }
          case "exist": {
            c = 7;
            break;
          }
          case "file-too-large": {
            c = 8;
            break;
          }
          case "illegal-byte-sequence": {
            c = 9;
            break;
          }
          case "in-progress": {
            c = 10;
            break;
          }
          case "interrupted": {
            c = 11;
            break;
          }
          case "invalid": {
            c = 12;
            break;
          }
          case "io": {
            c = 13;
            break;
          }
          case "is-directory": {
            c = 14;
            break;
          }
          case "loop": {
            c = 15;
            break;
          }
          case "too-many-links": {
            c = 16;
            break;
          }
          case "message-size": {
            c = 17;
            break;
          }
          case "name-too-long": {
            c = 18;
            break;
          }
          case "no-device": {
            c = 19;
            break;
          }
          case "no-entry": {
            c = 20;
            break;
          }
          case "no-lock": {
            c = 21;
            break;
          }
          case "insufficient-memory": {
            c = 22;
            break;
          }
          case "insufficient-space": {
            c = 23;
            break;
          }
          case "not-directory": {
            c = 24;
            break;
          }
          case "not-empty": {
            c = 25;
            break;
          }
          case "not-recoverable": {
            c = 26;
            break;
          }
          case "unsupported": {
            c = 27;
            break;
          }
          case "no-tty": {
            c = 28;
            break;
          }
          case "no-such-device": {
            c = 29;
            break;
          }
          case "overflow": {
            c = 30;
            break;
          }
          case "not-permitted": {
            c = 31;
            break;
          }
          case "pipe": {
            c = 32;
            break;
          }
          case "read-only": {
            c = 33;
            break;
          }
          case "invalid-seek": {
            c = 34;
            break;
          }
          case "text-file-busy": {
            c = 35;
            break;
          }
          case "cross-device": {
            c = 36;
            break;
          }
          default:
            throw s instanceof Error && console.error(s), new TypeError(`"${o}" is not one of the cases of error-code`);
        }
        m(k).setInt8(t + 4, c, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Xo(r, e) {
    var t = r, n = Xe[(t << 1) + 1] & -1073741825, a = Le.get(n);
    a || (a = Object.create(Oe.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.appendViaStream()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: Ie(o)
      };
    }
    for (const o of O) o[$] = void 0;
    O = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        if (m(k).setInt8(e + 0, 0, true), !(o instanceof oe)) throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
        var f = o[$];
        if (!f) {
          const s = o[N] || ++wt;
          ie.set(s, o), f = ce(ye, s);
        }
        m(k).setInt32(e + 4, f, true);
        break;
      }
      case "err": {
        const o = d.val;
        m(k).setInt8(e + 0, 1, true);
        var p = o;
        let s;
        switch (p) {
          case "access": {
            s = 0;
            break;
          }
          case "would-block": {
            s = 1;
            break;
          }
          case "already": {
            s = 2;
            break;
          }
          case "bad-descriptor": {
            s = 3;
            break;
          }
          case "busy": {
            s = 4;
            break;
          }
          case "deadlock": {
            s = 5;
            break;
          }
          case "quota": {
            s = 6;
            break;
          }
          case "exist": {
            s = 7;
            break;
          }
          case "file-too-large": {
            s = 8;
            break;
          }
          case "illegal-byte-sequence": {
            s = 9;
            break;
          }
          case "in-progress": {
            s = 10;
            break;
          }
          case "interrupted": {
            s = 11;
            break;
          }
          case "invalid": {
            s = 12;
            break;
          }
          case "io": {
            s = 13;
            break;
          }
          case "is-directory": {
            s = 14;
            break;
          }
          case "loop": {
            s = 15;
            break;
          }
          case "too-many-links": {
            s = 16;
            break;
          }
          case "message-size": {
            s = 17;
            break;
          }
          case "name-too-long": {
            s = 18;
            break;
          }
          case "no-device": {
            s = 19;
            break;
          }
          case "no-entry": {
            s = 20;
            break;
          }
          case "no-lock": {
            s = 21;
            break;
          }
          case "insufficient-memory": {
            s = 22;
            break;
          }
          case "insufficient-space": {
            s = 23;
            break;
          }
          case "not-directory": {
            s = 24;
            break;
          }
          case "not-empty": {
            s = 25;
            break;
          }
          case "not-recoverable": {
            s = 26;
            break;
          }
          case "unsupported": {
            s = 27;
            break;
          }
          case "no-tty": {
            s = 28;
            break;
          }
          case "no-such-device": {
            s = 29;
            break;
          }
          case "overflow": {
            s = 30;
            break;
          }
          case "not-permitted": {
            s = 31;
            break;
          }
          case "pipe": {
            s = 32;
            break;
          }
          case "read-only": {
            s = 33;
            break;
          }
          case "invalid-seek": {
            s = 34;
            break;
          }
          case "text-file-busy": {
            s = 35;
            break;
          }
          case "cross-device": {
            s = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${p}" is not one of the cases of error-code`);
        }
        m(k).setInt8(e + 4, s, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ho(r, e) {
    var t = r, n = Xe[(t << 1) + 1] & -1073741825, a = Le.get(n);
    a || (a = Object.create(Oe.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.getType()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: Ie(o)
      };
    }
    for (const o of O) o[$] = void 0;
    O = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        m(k).setInt8(e + 0, 0, true);
        var f = o;
        let s;
        switch (f) {
          case "unknown": {
            s = 0;
            break;
          }
          case "block-device": {
            s = 1;
            break;
          }
          case "character-device": {
            s = 2;
            break;
          }
          case "directory": {
            s = 3;
            break;
          }
          case "fifo": {
            s = 4;
            break;
          }
          case "symbolic-link": {
            s = 5;
            break;
          }
          case "regular-file": {
            s = 6;
            break;
          }
          case "socket": {
            s = 7;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${f}" is not one of the cases of descriptor-type`);
        }
        m(k).setInt8(e + 1, s, true);
        break;
      }
      case "err": {
        const o = d.val;
        m(k).setInt8(e + 0, 1, true);
        var p = o;
        let s;
        switch (p) {
          case "access": {
            s = 0;
            break;
          }
          case "would-block": {
            s = 1;
            break;
          }
          case "already": {
            s = 2;
            break;
          }
          case "bad-descriptor": {
            s = 3;
            break;
          }
          case "busy": {
            s = 4;
            break;
          }
          case "deadlock": {
            s = 5;
            break;
          }
          case "quota": {
            s = 6;
            break;
          }
          case "exist": {
            s = 7;
            break;
          }
          case "file-too-large": {
            s = 8;
            break;
          }
          case "illegal-byte-sequence": {
            s = 9;
            break;
          }
          case "in-progress": {
            s = 10;
            break;
          }
          case "interrupted": {
            s = 11;
            break;
          }
          case "invalid": {
            s = 12;
            break;
          }
          case "io": {
            s = 13;
            break;
          }
          case "is-directory": {
            s = 14;
            break;
          }
          case "loop": {
            s = 15;
            break;
          }
          case "too-many-links": {
            s = 16;
            break;
          }
          case "message-size": {
            s = 17;
            break;
          }
          case "name-too-long": {
            s = 18;
            break;
          }
          case "no-device": {
            s = 19;
            break;
          }
          case "no-entry": {
            s = 20;
            break;
          }
          case "no-lock": {
            s = 21;
            break;
          }
          case "insufficient-memory": {
            s = 22;
            break;
          }
          case "insufficient-space": {
            s = 23;
            break;
          }
          case "not-directory": {
            s = 24;
            break;
          }
          case "not-empty": {
            s = 25;
            break;
          }
          case "not-recoverable": {
            s = 26;
            break;
          }
          case "unsupported": {
            s = 27;
            break;
          }
          case "no-tty": {
            s = 28;
            break;
          }
          case "no-such-device": {
            s = 29;
            break;
          }
          case "overflow": {
            s = 30;
            break;
          }
          case "not-permitted": {
            s = 31;
            break;
          }
          case "pipe": {
            s = 32;
            break;
          }
          case "read-only": {
            s = 33;
            break;
          }
          case "invalid-seek": {
            s = 34;
            break;
          }
          case "text-file-busy": {
            s = 35;
            break;
          }
          case "cross-device": {
            s = 36;
            break;
          }
          default:
            throw o instanceof Error && console.error(o), new TypeError(`"${p}" is not one of the cases of error-code`);
        }
        m(k).setInt8(e + 1, s, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Zo(r, e) {
    var t = r, n = Xe[(t << 1) + 1] & -1073741825, a = Le.get(n);
    a || (a = Object.create(Oe.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.stat()
      };
    } catch (x) {
      i = {
        tag: "err",
        val: Ie(x)
      };
    }
    for (const x of O) x[$] = void 0;
    O = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const x = d.val;
        m(k).setInt8(e + 0, 0, true);
        var { type: f, linkCount: p, size: o, dataAccessTimestamp: s, dataModificationTimestamp: c, statusChangeTimestamp: y } = x, A = f;
        let b;
        switch (A) {
          case "unknown": {
            b = 0;
            break;
          }
          case "block-device": {
            b = 1;
            break;
          }
          case "character-device": {
            b = 2;
            break;
          }
          case "directory": {
            b = 3;
            break;
          }
          case "fifo": {
            b = 4;
            break;
          }
          case "symbolic-link": {
            b = 5;
            break;
          }
          case "regular-file": {
            b = 6;
            break;
          }
          case "socket": {
            b = 7;
            break;
          }
          default:
            throw f instanceof Error && console.error(f), new TypeError(`"${A}" is not one of the cases of descriptor-type`);
        }
        m(k).setInt8(e + 8, b, true), m(k).setBigInt64(e + 16, Qe(p), true), m(k).setBigInt64(e + 24, Qe(o), true);
        var h = s;
        if (h == null) m(k).setInt8(e + 32, 0, true);
        else {
          const U = h;
          m(k).setInt8(e + 32, 1, true);
          var { seconds: v, nanoseconds: T } = U;
          m(k).setBigInt64(e + 40, Qe(v), true), m(k).setInt32(e + 48, Vt(T), true);
        }
        var S = c;
        if (S == null) m(k).setInt8(e + 56, 0, true);
        else {
          const U = S;
          m(k).setInt8(e + 56, 1, true);
          var { seconds: _, nanoseconds: ee } = U;
          m(k).setBigInt64(e + 64, Qe(_), true), m(k).setInt32(e + 72, Vt(ee), true);
        }
        var R = y;
        if (R == null) m(k).setInt8(e + 80, 0, true);
        else {
          const U = R;
          m(k).setInt8(e + 80, 1, true);
          var { seconds: I, nanoseconds: Ee } = U;
          m(k).setBigInt64(e + 88, Qe(I), true), m(k).setInt32(e + 96, Vt(Ee), true);
        }
        break;
      }
      case "err": {
        const x = d.val;
        m(k).setInt8(e + 0, 1, true);
        var le = x;
        let b;
        switch (le) {
          case "access": {
            b = 0;
            break;
          }
          case "would-block": {
            b = 1;
            break;
          }
          case "already": {
            b = 2;
            break;
          }
          case "bad-descriptor": {
            b = 3;
            break;
          }
          case "busy": {
            b = 4;
            break;
          }
          case "deadlock": {
            b = 5;
            break;
          }
          case "quota": {
            b = 6;
            break;
          }
          case "exist": {
            b = 7;
            break;
          }
          case "file-too-large": {
            b = 8;
            break;
          }
          case "illegal-byte-sequence": {
            b = 9;
            break;
          }
          case "in-progress": {
            b = 10;
            break;
          }
          case "interrupted": {
            b = 11;
            break;
          }
          case "invalid": {
            b = 12;
            break;
          }
          case "io": {
            b = 13;
            break;
          }
          case "is-directory": {
            b = 14;
            break;
          }
          case "loop": {
            b = 15;
            break;
          }
          case "too-many-links": {
            b = 16;
            break;
          }
          case "message-size": {
            b = 17;
            break;
          }
          case "name-too-long": {
            b = 18;
            break;
          }
          case "no-device": {
            b = 19;
            break;
          }
          case "no-entry": {
            b = 20;
            break;
          }
          case "no-lock": {
            b = 21;
            break;
          }
          case "insufficient-memory": {
            b = 22;
            break;
          }
          case "insufficient-space": {
            b = 23;
            break;
          }
          case "not-directory": {
            b = 24;
            break;
          }
          case "not-empty": {
            b = 25;
            break;
          }
          case "not-recoverable": {
            b = 26;
            break;
          }
          case "unsupported": {
            b = 27;
            break;
          }
          case "no-tty": {
            b = 28;
            break;
          }
          case "no-such-device": {
            b = 29;
            break;
          }
          case "overflow": {
            b = 30;
            break;
          }
          case "not-permitted": {
            b = 31;
            break;
          }
          case "pipe": {
            b = 32;
            break;
          }
          case "read-only": {
            b = 33;
            break;
          }
          case "invalid-seek": {
            b = 34;
            break;
          }
          case "text-file-busy": {
            b = 35;
            break;
          }
          case "cross-device": {
            b = 36;
            break;
          }
          default:
            throw x instanceof Error && console.error(x), new TypeError(`"${le}" is not one of the cases of error-code`);
        }
        m(k).setInt8(e + 8, b, true);
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Jo(r, e) {
    var t = r, n = ye[(t << 1) + 1] & -1073741825, a = ie.get(n);
    a || (a = Object.create(oe.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.checkWrite()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: Ie(o)
      };
    }
    for (const o of O) o[$] = void 0;
    O = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        const o = d.val;
        m(k).setInt8(e + 0, 0, true), m(k).setBigInt64(e + 8, Qe(o), true);
        break;
      }
      case "err": {
        const o = d.val;
        m(k).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const s = f.val;
            if (m(k).setInt8(e + 8, 0, true), !(s instanceof Se)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var p = s[$];
            if (!p) {
              const c = s[N] || ++gt;
              Re.set(c, s), p = ce(ze, c);
            }
            m(k).setInt32(e + 12, p, true);
            break;
          }
          case "closed": {
            m(k).setInt8(e + 8, 1, true);
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
  function Go(r, e, t, n) {
    var a = r, i = ye[(a << 1) + 1] & -1073741825, d = ie.get(i);
    d || (d = Object.create(oe.prototype), Object.defineProperty(d, $, {
      writable: true,
      value: a
    }), Object.defineProperty(d, N, {
      writable: true,
      value: i
    })), O.push(d);
    var f = e, p = t, o = new Uint8Array(k.buffer.slice(f, f + p * 1));
    let s;
    try {
      s = {
        tag: "ok",
        val: d.write(o)
      };
    } catch (h) {
      s = {
        tag: "err",
        val: Ie(h)
      };
    }
    for (const h of O) h[$] = void 0;
    O = [];
    var c = s;
    switch (c.tag) {
      case "ok": {
        c.val, m(k).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const h = c.val;
        m(k).setInt8(n + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (m(k).setInt8(n + 4, 0, true), !(v instanceof Se)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[$];
            if (!A) {
              const T = v[N] || ++gt;
              Re.set(T, v), A = ce(ze, T);
            }
            m(k).setInt32(n + 8, A, true);
            break;
          }
          case "closed": {
            m(k).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Yo(r, e) {
    var t = r, n = ye[(t << 1) + 1] & -1073741825, a = ie.get(n);
    a || (a = Object.create(oe.prototype), Object.defineProperty(a, $, {
      writable: true,
      value: t
    }), Object.defineProperty(a, N, {
      writable: true,
      value: n
    })), O.push(a);
    let i;
    try {
      i = {
        tag: "ok",
        val: a.blockingFlush()
      };
    } catch (o) {
      i = {
        tag: "err",
        val: Ie(o)
      };
    }
    for (const o of O) o[$] = void 0;
    O = [];
    var d = i;
    switch (d.tag) {
      case "ok": {
        d.val, m(k).setInt8(e + 0, 0, true);
        break;
      }
      case "err": {
        const o = d.val;
        m(k).setInt8(e + 0, 1, true);
        var f = o;
        switch (f.tag) {
          case "last-operation-failed": {
            const s = f.val;
            if (m(k).setInt8(e + 4, 0, true), !(s instanceof Se)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var p = s[$];
            if (!p) {
              const c = s[N] || ++gt;
              Re.set(c, s), p = ce(ze, c);
            }
            m(k).setInt32(e + 8, p, true);
            break;
          }
          case "closed": {
            m(k).setInt8(e + 4, 1, true);
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
  function qo(r, e, t, n) {
    var a = r, i = ye[(a << 1) + 1] & -1073741825, d = ie.get(i);
    d || (d = Object.create(oe.prototype), Object.defineProperty(d, $, {
      writable: true,
      value: a
    }), Object.defineProperty(d, N, {
      writable: true,
      value: i
    })), O.push(d);
    var f = e, p = t, o = new Uint8Array(k.buffer.slice(f, f + p * 1));
    let s;
    try {
      s = {
        tag: "ok",
        val: d.blockingWriteAndFlush(o)
      };
    } catch (h) {
      s = {
        tag: "err",
        val: Ie(h)
      };
    }
    for (const h of O) h[$] = void 0;
    O = [];
    var c = s;
    switch (c.tag) {
      case "ok": {
        c.val, m(k).setInt8(n + 0, 0, true);
        break;
      }
      case "err": {
        const h = c.val;
        m(k).setInt8(n + 0, 1, true);
        var y = h;
        switch (y.tag) {
          case "last-operation-failed": {
            const v = y.val;
            if (m(k).setInt8(n + 4, 0, true), !(v instanceof Se)) throw new TypeError('Resource error: Not a valid "Error" resource.');
            var A = v[$];
            if (!A) {
              const T = v[N] || ++gt;
              Re.set(T, v), A = ce(ze, T);
            }
            m(k).setInt32(n + 8, A, true);
            break;
          }
          case "closed": {
            m(k).setInt8(n + 4, 1, true);
            break;
          }
          default:
            throw new TypeError(`invalid variant tag value \`${JSON.stringify(y.tag)}\` (received \`${y}\`) specified for \`StreamError\``);
        }
        break;
      }
      default:
        throw new TypeError("invalid variant specified for result");
    }
  }
  function Ko(r, e) {
    var n = Oo(BigInt.asUintN(64, r)), a = n.byteLength, i = xe(0, 0, 1, a * 1), d = new Uint8Array(n.buffer || n, n.byteOffset, a * 1);
    new Uint8Array(k.buffer, i, a * 1).set(d), m(k).setInt32(e + 4, a, true), m(k).setInt32(e + 0, i, true);
  }
  function ei(r) {
    var t = $o(), n = t.length, a = xe(0, 0, 4, n * 12);
    for (let s = 0; s < t.length; s++) {
      const c = t[s], y = a + s * 12;
      var [i, d] = c;
      if (!(i instanceof Oe)) throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      var f = i[$];
      if (!f) {
        const A = i[N] || ++Vo;
        Le.set(A, i), f = ce(Xe, A);
      }
      m(k).setInt32(y + 0, f, true);
      var p = Gt(d, xe, k), o = Ge;
      m(k).setInt32(y + 8, o, true), m(k).setInt32(y + 4, p, true);
    }
    m(k).setInt32(r + 4, n, true), m(k).setInt32(r + 0, a, true);
  }
  let ti, ws, gs;
  function ri(r) {
    const e = ht(Xe, r);
    if (e.own) {
      const t = Le.get(e.rep);
      t ? (t[we] && t[we](), Le.delete(e.rep)) : Oe[he] && Oe[he](e.rep);
    }
  }
  function si(r) {
    const e = ht(ye, r);
    if (e.own) {
      const t = ie.get(e.rep);
      t ? (t[we] && t[we](), ie.delete(e.rep)) : oe[he] && oe[he](e.rep);
    }
  }
  function ai(r) {
    const e = ht(ze, r);
    if (e.own) {
      const t = Re.get(e.rep);
      t ? (t[we] && t[we](), Re.delete(e.rep)) : Se[he] && Se[he](e.rep);
    }
  }
  function ni(r) {
    const e = ht(hs, r);
    if (e.own) {
      const t = Yt.get(e.rep);
      t ? (t[we] && t[we](), Yt.delete(e.rep)) : Jt[he] && Jt[he](e.rep);
    }
  }
  let Is;
  function oi(r) {
    var e = r, t = e.byteLength, n = ws(0, 0, 1, t * 1), a = new Uint8Array(e.buffer || e, e.byteOffset, t * 1);
    new Uint8Array(k.buffer, n, t * 1).set(a);
    const i = Is(n, t);
    let d;
    switch (m(k).getUint8(i + 0, true)) {
      case 0: {
        var f = m(k).getInt32(i + 4, true), p = m(k).getInt32(i + 8, true), o = Or.decode(new Uint8Array(k.buffer, f, p));
        d = {
          tag: "ok",
          val: o
        };
        break;
      }
      case 1: {
        var s = m(k).getInt32(i + 4, true), c = m(k).getInt32(i + 8, true), y = Or.decode(new Uint8Array(k.buffer, s, c));
        d = {
          tag: "err",
          val: y
        };
        break;
      }
      default:
        throw new TypeError("invalid variant discriminant for expected");
    }
    const A = d;
    if (gs(i), typeof A == "object" && A.tag === "err") throw new So(A.val);
    return A.val;
  }
  const ii = (() => {
    let r = function* () {
      const f = xr(new URL("/component-ui/assets/bindgen.core-BCyHSiUD.wasm", import.meta.url)), p = xr(new URL("/component-ui/assets/bindgen.core2-DuTXfUwR.wasm", import.meta.url)), o = $r("AGFzbQEAAAABLghgBH9/f38Bf2ACf38Bf2ABfwBgAX8AYAJ/fwBgA39+fwBgBH9/f38AYAJ+fwADEhEAAQEBAgMEBQQEBAQGBAYHAwQFAXABEREHVxIBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABAIJGltcG9ydHMBAArVAREPACAAIAEgAiADQQARAAALCwAgACABQQERAQALCwAgACABQQIRAQALCwAgACABQQMRAQALCQAgAEEEEQIACwkAIABBBREDAAsLACAAIAFBBhEEAAsNACAAIAEgAkEHEQUACwsAIAAgAUEIEQQACwsAIAAgAUEJEQQACwsAIAAgAUEKEQQACwsAIAAgAUELEQQACw8AIAAgASACIANBDBEGAAsLACAAIAFBDREEAAsPACAAIAEgAiADQQ4RBgALCwAgACABQQ8RBwALCQAgAEEQEQMACwAvCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BzAuMjIwLjEA9QcEbmFtZQATEndpdC1jb21wb25lbnQ6c2hpbQHYBxEAJWFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfd3JpdGUBJ2FkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtcmFuZG9tX2dldAIoYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX2dldAMuYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX3NpemVzX2dldAQmYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wcm9jX2V4aXQFM2luZGlyZWN0LXdhc2k6Y2xpL2Vudmlyb25tZW50QDAuMi4wLWdldC1lbnZpcm9ubWVudAY6aW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLWZpbGVzeXN0ZW0tZXJyb3ItY29kZQdIaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLVttZXRob2RdZGVzY3JpcHRvci53cml0ZS12aWEtc3RyZWFtCElpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLmFwcGVuZC12aWEtc3RyZWFtCUBpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLmdldC10eXBlCjxpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtW21ldGhvZF1kZXNjcmlwdG9yLnN0YXQLQGluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uY2hlY2std3JpdGUMOmluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGUNQ2luZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctZmx1c2gOTWluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1bbWV0aG9kXW91dHB1dC1zdHJlYW0uYmxvY2tpbmctd3JpdGUtYW5kLWZsdXNoDzJpbmRpcmVjdC13YXNpOnJhbmRvbS9yYW5kb21AMC4yLjAtZ2V0LXJhbmRvbS1ieXRlcxA3aW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3ByZW9wZW5zQDAuMi4wLWdldC1kaXJlY3Rvcmllcw"), s = $r("AGFzbQEAAAABLghgBH9/f38Bf2ACf38Bf2ABfwBgAX8AYAJ/fwBgA39+fwBgBH9/f38AYAJ+fwACbBIAATAAAAABMQABAAEyAAEAATMAAQABNAACAAE1AAMAATYABAABNwAFAAE4AAQAATkABAACMTAABAACMTEABAACMTIABgACMTMABAACMTQABgACMTUABwACMTYAAwAIJGltcG9ydHMBcAEREQkXAQBBAAsRAAECAwQFBgcICQoLDA0ODxAALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjIyMC4xABwEbmFtZQAVFHdpdC1jb21wb25lbnQ6Zml4dXBz");
      ({ exports: L } = yield ct(yield o)), { exports: Be } = yield ct(yield f, {
        wasi_snapshot_preview1: {
          environ_get: L[2],
          environ_sizes_get: L[3],
          fd_write: L[0],
          proc_exit: L[4],
          random_get: L[1]
        }
      }), { exports: Ce } = yield ct(yield p, {
        __main_module__: {
          cabi_realloc: Be.cabi_realloc
        },
        env: {
          memory: Be.memory
        },
        "wasi:cli/environment@0.2.0": {
          "get-environment": L[5]
        },
        "wasi:cli/exit@0.2.0": {
          exit: Po
        },
        "wasi:cli/stderr@0.2.0": {
          "get-stderr": Mo
        },
        "wasi:cli/stdin@0.2.0": {
          "get-stdin": Qo
        },
        "wasi:cli/stdout@0.2.0": {
          "get-stdout": Uo
        },
        "wasi:filesystem/preopens@0.2.0": {
          "get-directories": L[16]
        },
        "wasi:filesystem/types@0.2.0": {
          "[method]descriptor.append-via-stream": L[8],
          "[method]descriptor.get-type": L[9],
          "[method]descriptor.stat": L[10],
          "[method]descriptor.write-via-stream": L[7],
          "[resource-drop]descriptor": ri,
          "filesystem-error-code": L[6]
        },
        "wasi:io/error@0.2.0": {
          "[resource-drop]error": ai
        },
        "wasi:io/streams@0.2.0": {
          "[method]output-stream.blocking-flush": L[13],
          "[method]output-stream.blocking-write-and-flush": L[14],
          "[method]output-stream.check-write": L[11],
          "[method]output-stream.write": L[12],
          "[resource-drop]input-stream": ni,
          "[resource-drop]output-stream": si
        },
        "wasi:random/random@0.2.0": {
          "get-random-bytes": L[15]
        }
      }), k = Be.memory, xe = Ce.cabi_import_realloc, { exports: ti } = yield ct(yield s, {
        "": {
          $imports: L.$imports,
          0: Ce.fd_write,
          1: Ce.random_get,
          10: Zo,
          11: Jo,
          12: Go,
          13: Yo,
          14: qo,
          15: Ko,
          16: ei,
          2: Ce.environ_get,
          3: Ce.environ_sizes_get,
          4: Ce.proc_exit,
          5: Wo,
          6: Do,
          7: zo,
          8: Xo,
          9: Ho
        }
      }), ws = Be.cabi_realloc, gs = Be["cabi_post_generate-ast"], Is = Be["generate-ast"];
    }(), e, t, n;
    function a(d) {
      try {
        let f;
        do
          ({ value: d, done: f } = r.next(d));
        while (!(d instanceof Promise) && !f);
        if (f) if (t) t(d);
        else return d;
        e || (e = new Promise((p, o) => (t = p, n = o))), d.then(a, n);
      } catch (f) {
        if (n) n(f);
        else throw f;
      }
    }
    const i = a(null);
    return e || i;
  })();
  await ii;
  let Es = [];
  async function ci(r) {
    const t = await Ln(r, {
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
    const n = oi(r);
    return console.log(n), Es = (await import(URL.createObjectURL(new Blob([
      n
    ], {
      type: "text/javascript"
    }))).then(async (m2) => {
      await m2.__tla;
      return m2;
    })).Factory({
      IDL: no
    }), t;
  }
  const _s = {};
  let qt;
  async function li(r) {
    const e = {
      "@bytecodealliance/preview2-shim/cli": await fe(() => Promise.resolve().then(() => Ca), []),
      "@bytecodealliance/preview2-shim/filesystem": await fe(() => Promise.resolve().then(() => ya), void 0),
      "@bytecodealliance/preview2-shim/io": await fe(() => Promise.resolve().then(() => fa), void 0),
      "@bytecodealliance/preview2-shim/random": await fe(() => Promise.resolve().then(() => xa), void 0),
      "@bytecodealliance/preview2-shim/sockets": await fe(() => import("./sockets-DbnWBWvo.js"), []),
      "@bytecodealliance/preview2-shim/http": await fe(() => import("./http-DxoFz0p7.js"), []),
      "@bytecodealliance/preview2-shim/clocks": await fe(() => import("./clocks-CO9M1dfe.js"), [])
    };
    for (const d of r.imports) if (!d.startsWith("@bytecodealliance/preview2-shim/")) {
      const f = _s[d], o = await import(URL.createObjectURL(new Blob([
        f.value
      ], {
        type: "text/javascript"
      }))).then(async (m2) => {
        await m2.__tla;
        return m2;
      });
      e[d] = o;
    }
    const t = r.files.find(([d, f]) => d === "test.js")[1], n = URL.createObjectURL(new Blob([
      t
    ], {
      type: "text/javascript"
    })), { instantiate: a } = await import(n).then(async (m2) => {
      await m2.__tla;
      return m2;
    });
    let i = await a((d) => {
      const f = r.files.find((o) => o[0] === d)[1];
      return WebAssembly.compile(f);
    }, e);
    console.log(i), qt = i;
  }
  async function ui(r) {
    if (r instanceof File) return new Promise((e, t) => {
      const n = new FileReader();
      n.onload = (a) => {
        a.target && a.target.result ? e(new Uint8Array(a.target.result)) : t(new Error("Failed to read file."));
      }, n.onerror = (a) => {
        t(a);
      }, n.readAsArrayBuffer(r);
    });
    {
      const e = new URL("/component-ui/" + r, window.location.origin);
      return new Uint8Array(await (await fetch(e)).arrayBuffer());
    }
  }
  async function zt(r) {
    const e = await ui(r), t = await ci(e);
    bi(t);
  }
  function di() {
    document.querySelector("#preselectedWasmFile").addEventListener("change", async (t) => {
      const n = t.target;
      zt(n.value);
    }), document.getElementById("wasmFileInput").addEventListener("change", async (t) => {
      const n = t.target;
      if (n.files && n.files.length > 0) {
        const a = n.files[0];
        zt(a);
      }
    }), document.addEventListener("dragover", (t) => {
      t.preventDefault();
    }), document.addEventListener("drop", async (t) => {
      var _a3;
      t.preventDefault();
      const n = (_a3 = t.dataTransfer) == null ? void 0 : _a3.files;
      if (n && n.length > 0) {
        const a = n[0];
        a.type === "application/wasm" ? zt(a) : console.error("Please drop a valid .wasm file.");
      }
    });
  }
  function fi() {
    const r = document.getElementById("exports");
    r.innerHTML = "";
    for (const e of Es) {
      const t = e._name, n = document.createElement("div");
      n.innerHTML = `Interface ${t}`, r.appendChild(n);
      for (const a of e.get_resources()) {
        const i = document.createElement("li");
        r.appendChild(i), i.innerHTML = `<div>Resource ${a._name}</div>`;
        const d = document.createElement("ul");
        i.appendChild(d);
        const f = {
          resource: a,
          container: d
        };
        for (const [p, o] of a.get_static_funcs()) {
          const s = document.createElement("li");
          d.appendChild(s), Kt(s, t, p, o, f);
        }
      }
      for (const [a, i] of Object.entries(e._fields)) {
        const d = document.createElement("li");
        r.appendChild(d), Kt(d, t, a, i);
      }
    }
  }
  function pi(r, e) {
    const { resource: t, container: n } = r, a = t.add_instance(e), i = document.createElement("li");
    n.appendChild(i), i.innerHTML = `<div>Instance ${a}</div>`;
    const d = document.createElement("ul");
    i.appendChild(d);
    for (const [f, p] of t.get_method_funcs()) {
      const o = document.createElement("li");
      d.appendChild(o), Kt(o, "UNNAMED", f, p, {
        instance: a,
        ...r
      });
    }
  }
  function Kt(r, e, t, n, a) {
    r.innerHTML = `<div class="signature">
  ${t}: func(${n._args.map((o) => `${o[0]}: ${o[1].name}`).join(", ")})` + (n._ret.length === 0 ? "" : ` -> ${n._ret.map((o) => o.name).join(", ")}`) + "</div>";
    const i = document.createElement("div");
    i.className = "input-container", r.appendChild(i);
    const d = [];
    n._args.forEach(([o, s]) => {
      const c = vr(s);
      c.label = `${o} `, d.push(c), c.render(i);
    });
    const f = document.createElement("div"), p = document.createElement("button");
    if (p.innerText = "Call", f.appendChild(p), r.appendChild(f), p.addEventListener("click", async () => {
      const o = d.map((c) => c.parse());
      d.some((c) => c.isRejected()) || await Sr(e, t, o, n._kind, a);
    }), n._args.length > 0) {
      const o = document.createElement("button");
      o.innerText = "Random", f.appendChild(o), o.addEventListener("click", async () => {
        const s = d.map((y) => y.parse({
          random: true
        }));
        d.some((y) => y.isRejected()) || await Sr(e, t, s, n._kind, a);
      });
    }
  }
  async function Sr(r, e, t, n, a) {
    const i = document.getElementById("logs");
    let d = qt;
    r !== "UNNAMED" && (d = qt[r]);
    const f = t.map((p) => Rr(p)).join(", ");
    try {
      let p;
      if (n.endsWith("constructor")) {
        const o = a.resource._name;
        i.innerHTML += `<div>\u203A new ${o}(${f})</div>`, p = new d[o](...t), pi(a, p);
      } else if (n.endsWith("static")) {
        const o = a.resource._name;
        i.innerHTML += `<div>\u203A ${o}.${e}(${f})</div>`, p = d[o][e](...t);
      } else if (n.endsWith("method")) {
        const { resource: o, instance: s } = a;
        d = o.instances[s], i.innerHTML += `<div>\u203A ${s}.${e}(${f})</div>`, p = d[e](...t);
      } else i.innerHTML += `<div>\u203A ${e}(${f})</div>`, p = await d[e](...t);
      i.innerHTML += `<div>${Rr(p)}</div>`;
    } catch (p) {
      i.innerHTML += `<div class="error">${p.message}</div>`, console.error(p);
    }
  }
  function bi(r) {
    const e = document.querySelector("#app");
    e.innerHTML = `
  <div id="imports"></div>
  <div><button id="instantiate">Instantiate</button></div>
  <div id="container">
   <div id="main-content">
    <ul id="exports"></ul>
   </div>
   <div id="logs"></div>
  </div>
  `;
    const t = document.getElementById("imports"), n = document.getElementById("instantiate");
    for (const a of r.imports) {
      const i = document.createElement("div");
      if (t.appendChild(i), !a.startsWith("@bytecodealliance/preview2-shim/")) {
        i.innerHTML = `<li>Provide import ${a}</li>`;
        const d = document.createElement("textarea");
        d.style.width = "28em", d.style.height = "3em", a === "docs:adder/add" && (d.value = "export function add(a, b) { return a + b }"), _s[a] = d, i.appendChild(d);
      }
    }
    n.onclick = async () => {
      await li(r), fi();
    };
  }
  function Rr(r) {
    const e = JSON.stringify(r, (t, n) => typeof n == "function" || typeof n == "bigint" || typeof n == "symbol" ? n.toString() : n instanceof Uint8Array ? Array.from(n) : n, 2);
    return e === "{}" && r.constructor && r.constructor.name ? `[object ${r.constructor.name}]` : e;
  }
  di();
})();
