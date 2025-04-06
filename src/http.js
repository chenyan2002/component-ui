import { streams } from '@bytecodealliance/preview2-shim/io';
const symbolDispose = Symbol.dispose || Symbol.for("dispose");

class IncomingBody {
  #finished = false;
  #stream = undefined;
  stream() {
    if (!this.#stream) throw undefined;
    const stream = this.#stream;
    this.#stream = null;
    return stream;
  }
  static finish(incomingBody) {
    if (incomingBody.#finished)
      throw new Error("incoming body already finished");
    incomingBody.#finished = true;
    return futureTrailersCreate();
  }
  [symbolDispose]() {}
  static _create(streamId) {
    const incomingBody = new IncomingBody();
    const handler = (() => { console.log(`handler streamId = ${streamId}`) });
    incomingBody.#stream = new streams.InputStream(handler); //inputStreamCreate(HTTP, streamId);
    return incomingBody;
  }
}
const incomingBodyCreate = IncomingBody._create;
delete IncomingBody._create;

class IncomingRequest {
    #method;
    #pathWithQuery;
    #scheme;
    #authority;
    #headers;
    #streamId;
    method() {
      return this.#method;
    }
    pathWithQuery() {
      return this.#pathWithQuery;
    }
    scheme() {
      return this.#scheme;
    }
    authority() {
      return this.#authority;
    }
    headers() {
      return this.#headers;
    }
    consume() {
      return incomingBodyCreate(this.#streamId);
    }
    [symbolDispose]() {}
    static _create(method, pathWithQuery, scheme, authority, headers, streamId) {
      const incomingRequest = new IncomingRequest();
      incomingRequest.#method = method;
      incomingRequest.#pathWithQuery = pathWithQuery;
      incomingRequest.#scheme = scheme;
      incomingRequest.#authority = authority;
      incomingRequest.#headers = headers;
      incomingRequest.#streamId = streamId;
      return incomingRequest;
    }
}
const incomingRequestCreate = IncomingRequest._create;
delete IncomingRequest._create;
  
class ResponseOutparam {
    #setListener;
    static set(param, response) {
      param.#setListener(response);
    }
    static _create(setListener) {
      const responseOutparam = new ResponseOutparam();
      responseOutparam.#setListener = setListener;
      return responseOutparam;
    }
}
const responseOutparamCreate = ResponseOutparam._create;
delete ResponseOutparam._create;

  class Fields {
    #immutable = false;
    /** @type {[string, Uint8Array[]][]} */ #entries = [];
    /** @type {Map<string, [string, Uint8Array[]][]>} */ #table = new Map();
  
    /**
     * @param {[string, Uint8Array[][]][]} entries
     */
    static fromList(entries) {
      const fields = new Fields();
      for (const [key, value] of entries) {
        fields.append(key, value);
      }
      return fields;
    }
    get(name) {
      const tableEntries = this.#table.get(name.toLowerCase());
      if (!tableEntries) return [];
      return tableEntries.map(([, v]) => v);
    }
    set(name, values) {
      if (this.#immutable) throw { tag: "immutable" };
      try {
        validateHeaderName(name);
      } catch {
        throw { tag: "invalid-syntax" };
      }
      for (const value of values) {
        try {
          validateHeaderValue(name, new TextDecoder().decode(value));
        } catch {
          throw { tag: "invalid-syntax" };
        }
        throw { tag: "invalid-syntax" };
      }
      const lowercased = name.toLowerCase();
      if (_forbiddenHeaders.has(lowercased)) throw { tag: "forbidden" };
      const tableEntries = this.#table.get(lowercased);
      if (tableEntries)
        this.#entries = this.#entries.filter(
          (entry) => !tableEntries.includes(entry)
        );
      tableEntries.splice(0, tableEntries.length);
      for (const value of values) {
        const entry = [name, value];
        this.#entries.push(entry);
        tableEntries.push(entry);
      }
    }
    has(name) {
      return this.#table.has(name.toLowerCase());
    }
    delete(name) {
      if (this.#immutable) throw { tag: "immutable" };
      const lowercased = name.toLowerCase();
      const tableEntries = this.#table.get(lowercased);
      if (tableEntries) {
        this.#entries = this.#entries.filter(
          (entry) => !tableEntries.includes(entry)
        );
        this.#table.delete(lowercased);
      }
    }
    append(name, value) {
      if (this.#immutable) throw { tag: "immutable" };
      try {
        validateHeaderName(name);
      } catch {
        throw { tag: "invalid-syntax" };
      }
      try {
        validateHeaderValue(name, new TextDecoder().decode(value));
      } catch {
        throw { tag: "invalid-syntax" };
      }
      const lowercased = name.toLowerCase();
      if (_forbiddenHeaders.has(lowercased)) throw { tag: "forbidden" };
      const entry = [name, value];
      this.#entries.push(entry);
      const tableEntries = this.#table.get(lowercased);
      if (tableEntries) {
        tableEntries.push(entry);
      } else {
        this.#table.set(lowercased, [entry]);
      }
    }
    entries() {
      return this.#entries;
    }
    clone() {
      return fieldsFromEntriesChecked(this.#entries);
    }
    static _lock(fields) {
      fields.#immutable = true;
      return fields;
    }
    // assumes entries are already validated
    static _fromEntriesChecked(entries) {
      const fields = new Fields();
      fields.#entries = entries;
      for (const entry of entries) {
        const lowercase = entry[0].toLowerCase();
        const existing = fields.#table.get(lowercase);
        if (existing) {
          existing.push(entry);
        } else {
          fields.#table.set(lowercase, [entry]);
        }
      }
      return fields;
    }
}
const fieldsLock = Fields._lock;
delete Fields._lock;
const fieldsFromEntriesChecked = Fields._fromEntriesChecked;
delete Fields._fromEntriesChecked;

export const types = {
    IncomingBody,
    IncomingRequest,
    ResponseOutparam,
    Fields,
};
export const incomingRequestMock = (method, pathWithQuery, scheme, authority, headers, streamId) => {
  return incomingRequestCreate(method, pathWithQuery, scheme, authority, headers, streamId);
};
export const responseOutparamMock = (setListener) => {
  return responseOutparamCreate(setListener);
}
export const fieldsMock = (entries) => {
  return fieldsLock(fieldsFromEntriesChecked(entries.map(([key, val]) => [key, TextEncoder.encode(val)])));
}
