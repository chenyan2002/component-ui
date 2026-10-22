import { handleIncomingRequest, types } from '@bytecodealliance/preview2-shim/http';

// The HTTP response a WASI HTTP handler sets on a mock outparam, as a host would send it: the
// shim turns the `result` it was set to into a browser `Response`. The body is complete once
// the guest finishes it, which may be after the outparam is set.
export async function sentResponse(result: any): Promise<string> {
  // The request is a placeholder: only the shim's real outparam is needed.
  const response = await handleIncomingRequest(new Request('http://localhost/'), (_request, out) => {
    types.ResponseOutparam.set(out, result);
  });
  const status = `HTTP ${response.status} ${response.statusText}`.trim();
  const headers = [...response.headers].map(([name, value]) => `${name}: ${value}`);
  return [status, ...headers, '', await response.text()].join('\n');
}
