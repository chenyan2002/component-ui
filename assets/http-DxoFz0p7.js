function p(e) {
  console.log(`[http] Send (browser) ${e.uri}`);
  try {
    const o = new XMLHttpRequest();
    o.open(e.method.toString(), e.uri, false);
    const n = new Headers(e.headers);
    for (let [s, t] of n.entries()) s !== "user-agent" && s !== "host" && o.setRequestHeader(s, t);
    o.send(e.body && e.body.length > 0 ? e.body : null);
    const r = o.response ? new TextEncoder().encode(o.response) : void 0, i = [];
    return o.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((s) => {
      var t = s.split(": "), l = t.shift(), g = t.join(": ");
      i.push([l, g]);
    }), { status: o.status, headers: i, body: r };
  } catch (o) {
    throw new Error(o.message);
  }
}
const c = { handle() {
} }, u = { handle() {
} }, d = { dropFields(e) {
  console.log("[types] Drop fields");
}, newFields(e) {
  console.log("[types] New fields");
}, fieldsGet(e, o) {
  console.log("[types] Fields get");
}, fieldsSet(e, o, n) {
  console.log("[types] Fields set");
}, fieldsDelete(e, o) {
  console.log("[types] Fields delete");
}, fieldsAppend(e, o, n) {
  console.log("[types] Fields append");
}, fieldsEntries(e) {
  console.log("[types] Fields entries");
}, fieldsClone(e) {
  console.log("[types] Fields clone");
}, finishIncomingStream(e) {
  console.log(`[types] Finish incoming stream ${e}`);
}, finishOutgoingStream(e, o) {
  console.log(`[types] Finish outgoing stream ${e}`);
}, dropIncomingRequest(e) {
  console.log("[types] Drop incoming request");
}, dropOutgoingRequest(e) {
  console.log("[types] Drop outgoing request");
}, incomingRequestMethod(e) {
  console.log("[types] Incoming request method");
}, incomingRequestPathWithQuery(e) {
  console.log("[types] Incoming request path with query");
}, incomingRequestScheme(e) {
  console.log("[types] Incoming request scheme");
}, incomingRequestAuthority(e) {
  console.log("[types] Incoming request authority");
}, incomingRequestHeaders(e) {
  console.log("[types] Incoming request headers");
}, incomingRequestConsume(e) {
  console.log("[types] Incoming request consume");
}, newOutgoingRequest(e, o, n, r, i) {
  console.log("[types] New outgoing request");
}, outgoingRequestWrite(e) {
  console.log("[types] Outgoing request write");
}, dropResponseOutparam(e) {
  console.log("[types] Drop response outparam");
}, setResponseOutparam(e) {
  console.log("[types] Drop fields");
}, dropIncomingResponse(e) {
  console.log("[types] Drop incoming response");
}, dropOutgoingResponse(e) {
  console.log("[types] Drop outgoing response");
}, incomingResponseStatus(e) {
  console.log("[types] Incoming response status");
}, incomingResponseHeaders(e) {
  console.log("[types] Incoming response headers");
}, incomingResponseConsume(e) {
  console.log("[types] Incoming response consume");
}, newOutgoingResponse(e, o) {
  console.log("[types] New outgoing response");
}, outgoingResponseWrite(e) {
  console.log("[types] Outgoing response write");
}, dropFutureIncomingResponse(e) {
  console.log("[types] Drop future incoming response");
}, futureIncomingResponseGet(e) {
  console.log("[types] Future incoming response get");
}, listenToFutureIncomingResponse(e) {
  console.log("[types] Listen to future incoming response");
} };
export {
  c as incomingHandler,
  u as outgoingHandler,
  p as send,
  d as types
};
