const s = { resolution() {
  return 1e6;
}, now() {
  return BigInt(Math.floor(performance.now() * 1e6));
}, subscribeInstant(o) {
  o = BigInt(o);
  const n = this.now();
  return o <= n ? this.subscribeDuration(0) : this.subscribeDuration(o - n);
}, subscribeDuration(o) {
  o = BigInt(o), console.log("[monotonic-clock] subscribe");
} }, r = { now() {
  let o = Date.now();
  const n = BigInt(Math.floor(o / 1e3)), e = o % 1e3 * 1e6;
  return { seconds: n, nanoseconds: e };
}, resolution() {
  return { seconds: 0n, nanoseconds: 1e6 };
} };
export {
  s as monotonicClock,
  r as wallClock
};
