/**
 * What Yap++ needs to know about Yapin' itself: which channel is open, which requests are about
 * messages, and what comes over its realtime socket.
 *
 * Yapin' talks to Supabase, so messages arrive as realtime frames on a WebSocket. None of this
 * leaves the computer: it is all read in the page it happens in.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The URL a fetch() call is for, whether it was given a string, URL or Request. */
export function requestURL(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url ?? '';
}

/** The method a fetch() call will use. */
export function requestMethod(input, init) {
  const method = init?.method ?? (input !== null && typeof input === 'object' ? input.method : undefined);
  return String(method ?? 'GET').toUpperCase();
}

/** True for a request to one of Yapin's `messages` REST endpoints. */
export function isMessagesRequest(url) {
  return url.includes('/rest/v1/messages');
}

/** The `id=eq.<uuid>` a REST request names, if any. */
export function idFromQuery(url) {
  return url.match(/id=eq\.([0-9a-f-]+)/i)?.[1] ?? null;
}

/** The channel being looked at: Yapin' puts its id in the address, and remembers it as a fallback. */
export function currentChannelId() {
  const fromURL = location.href.match(UUID);
  if (fromURL) return fromURL[0];
  try {
    return JSON.parse(localStorage.getItem('yapper:place') || '{}').c ?? null;
  } catch {
    return null;
  }
}

/**
 * Calls `handler` for every realtime change Yapin' receives, as
 * `{ table, type, record, oldRecord }` with type INSERT, UPDATE or DELETE.
 *
 * Yapin' listens with both addEventListener and onmessage depending on the version, so both are
 * patched. The handler never changes what Yapin' itself sees.
 */
export function watchMessageFrames(ctx, handler) {
  const read = (data) => {
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      return; // Not JSON: a heartbeat or a binary frame.
    }
    const payload = frame?.payload ?? frame;
    const inner = payload?.data ?? payload;
    const record = inner?.record ?? payload?.record;
    const table = inner?.table ?? payload?.table;
    const type = inner?.type ?? frame?.event;
    if (!record && !inner?.old_record) return;
    handler({ table, type, record: record ?? null, oldRecord: inner?.old_record ?? inner?.old ?? null });
  };

  ctx.patch.before(WebSocket.prototype, 'addEventListener', (args) => {
    if (args[0] !== 'message' || typeof args[1] !== 'function') return;
    const listener = args[1];
    if (listener.__yppWrapped) return;
    const wrapped = function (event) {
      read(event.data);
      return listener.call(this, event);
    };
    wrapped.__yppWrapped = true;
    args[1] = wrapped;
  });

  const descriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  if (descriptor?.set) {
    Object.defineProperty(WebSocket.prototype, 'onmessage', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return descriptor.get.call(this);
      },
      set(fn) {
        if (typeof fn !== 'function') return descriptor.set.call(this, fn);
        const wrapped = function (event) {
          read(event.data);
          return fn.call(this, event);
        };
        return descriptor.set.call(this, wrapped);
      },
    });
    ctx.onStop(() => Object.defineProperty(WebSocket.prototype, 'onmessage', descriptor));
  }
}
