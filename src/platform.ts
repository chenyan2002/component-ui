// What the core needs from the JavaScript runtime it runs in, which differs between the browser
// app and Node.
export interface Platform {
  // Imports an ES module from its source code, e.g. the JavaScript jco generates.
  importModule(code: string | Uint8Array<ArrayBuffer>): Promise<any>;
}
