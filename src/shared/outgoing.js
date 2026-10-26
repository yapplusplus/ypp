import { isMessagesRequest, requestMethod, requestURL } from './yapper.js';

/**
 * Adds `suffix` to every message you send, by editing the body of the request on its way out.
 *
 * Several plugins can do this at once: each one is its own patch, and they apply in turn.
 */
export function appendToOutgoingMessages(ctx, suffix) {
  ctx.patch.before(window, 'fetch', (args) => {
    const [input, init] = args;
    if (requestMethod(input, init) !== 'POST' || !isMessagesRequest(requestURL(input))) return;
    if (typeof init?.body !== 'string') return;
    try {
      const body = JSON.parse(init.body);
      if (typeof body.content !== 'string') return;
      body.content += suffix;
      args[1] = { ...init, body: JSON.stringify(body) };
    } catch {
      // Not a message we understand; leave it exactly as it was.
    }
  });
}
