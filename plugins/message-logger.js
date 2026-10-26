import { definePlugin } from 'yapin.js-client/runtime';
import { MessageLog } from '../src/shared/message-log.js';
import {
  currentChannelId,
  idFromQuery,
  isMessagesRequest,
  requestMethod,
  requestURL,
  watchMessageFrames,
} from '../src/shared/yapper.js';

const PROFILE_REQUEST = /\/rest\/v1\/(profiles|users)|who_online/;

export default definePlugin({
  id: 'message-logger',
  name: 'MessageLogger',
  description: 'You know how messages get deleted right? What if they became **red** instead? (HAS SOME BUGS!)',
  version: '2.0.0',
  authors: [{ name: 'salami' }],
  tags: ['messages'],

  settings: {
    keepOnScreen: {
      type: 'switch',
      label: 'Keep deleted messages on screen',
      description: 'Deleted messages stay where they were, in red, instead of disappearing.',
      default: true,
    },
    announce: {
      type: 'switch',
      label: 'Tell me when a message is deleted',
      default: true,
    },
    summary: {
      type: 'switch',
      label: 'List deleted messages above the composer',
      default: true,
    },
  },

  styles: `
    .msg[data-yp-ghost] { background: transparent; }
    [data-yp-ghost] .msg-author,
    [data-yp-ghost] .msg-text,
    [data-yp-ghost] .msg-text * { color: var(--danger, #ff4b4b) !important; }
    .ypp-ghost-avatar {
      position: relative;
      width: 40px;
      height: 40px;
      background: transparent;
      padding: 0;
      border: none;
      cursor: default;
      border-radius: 50%;
      overflow: hidden;
    }
    .ypp-ghost-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .ypp-ghost-avatar.is-missing {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--danger, #ff4b4b);
      color: #fff;
      font-weight: 700;
    }
    #ypp-ghost-strip {
      padding: 6px 16px;
      font-size: 12px;
      color: var(--danger, #ff4b4b);
      background: rgba(255, 75, 75, 0.08);
      border-top: 1px solid rgba(255, 75, 75, 0.2);
      cursor: pointer;
      user-select: none;
    }
    #ypp-ghost-list {
      max-height: 200px;
      overflow-y: auto;
      padding: 8px 16px;
      font-size: 12px;
      background: rgba(255, 75, 75, 0.04);
      border-top: 1px solid rgba(255, 75, 75, 0.15);
      color: #ffb3b3;
    }
    .ypp-ghost-entry { margin-bottom: 6px; }
    .ypp-ghost-when { color: #ff8a8a; }
    .ypp-ghost-who { color: #ff6b6b; font-weight: 700; }
    .ypp-ghost-what { color: var(--danger, #ff4b4b); }
  `,

  start(ctx) {
    const log = new MessageLog();
    let paintTimer = null;
    let settleTimer = null;
    let stopped = false;

    /* ---------------------------------------------------------------- watching */

    ctx.patch.instead(window, 'fetch', (args, original) => {
      const [input, init] = args;
      const url = requestURL(input);
      const method = requestMethod(input, init);

      if (PROFILE_REQUEST.test(url)) {
        const response = original(...args);
        void response
          .then((result) => result.clone().json())
          .then((rows) => log.cacheAuthors(Array.isArray(rows) ? rows : [rows]))
          .catch(() => {});
        return response;
      }

      if (!isMessagesRequest(url)) return original(...args);

      if (method === 'POST' && typeof init?.body === 'string') {
        // Remember what we sent before the server has given it an id.
        let temporary = null;
        try {
          const body = JSON.parse(init.body);
          temporary = `local-${Date.now()}-${Math.random()}`;
          log.record(temporary, 'outgoing', { ...body, created_at: new Date().toISOString() });
        } catch {
          // Not a message body we understand.
        }
        const response = original(...args);
        if (temporary) {
          void response
            .then((result) => (result.ok ? result.clone().json() : null))
            .then((row) => row?.id && log.rekey(temporary, row.id))
            .catch(() => {});
        }
        return response;
      }

      if (method === 'DELETE') {
        const id = idFromQuery(url);
        const response = original(...args);
        if (id) void response.then((result) => result.ok && onDeleted(id)).catch(() => {});
        return response;
      }

      if (method === 'PATCH' && typeof init?.body === 'string') {
        const id = idFromQuery(url);
        try {
          const body = JSON.parse(init.body);
          if (id && body.content) log.markEdited(id, body.content);
        } catch {
          // Not an edit we understand.
        }
        return original(...args);
      }

      if (method === 'GET') return original(...args).then((result) => withDeleted(result, url));

      return original(...args);
    });

    watchMessageFrames(ctx, ({ table, type, record, oldRecord }) => {
      if (table && table !== 'messages') return;
      if (type === 'INSERT' && record?.id) {
        // recordMany, not record: a replayed INSERT must not clear what we know about a message.
        log.recordMany('incoming', [record]);
        schedulePaint();
      } else if (type === 'UPDATE' && record?.id) {
        log.markEdited(record.id, record.content);
      } else if (type === 'DELETE') {
        const id = oldRecord?.id ?? record?.id;
        if (id) onDeleted(id);
      }
    });

    function onDeleted(id) {
      const row = log.markDeleted(id);
      if (!row) return;
      if (ctx.settings.get('announce')) {
        const who = row.author_username ?? log.author(row.author_id)?.username ?? 'someone';
        ctx.toast(`${who} deleted: ${row.content ?? ''}`.trim(), { type: 'warning', timeout: 8000 });
      }
      schedulePaint();
    }

    /**
     * Reads a channel's history: remembers every message in it, so one deleted later can still be
     * shown, and puts the ones already deleted back in so Yapin' draws them itself.
     */
    async function withDeleted(response, url) {
      const channelId = url.match(/channel_id=eq\.([0-9a-f-]+)/i)?.[1];
      if (!response.ok || !channelId) return response;
      const text = await response.text();
      try {
        const rows = JSON.parse(text);
        if (!Array.isArray(rows)) return new Response(text, response);

        // The old plugin only knew about messages it watched arrive, so deleting anything loaded
        // from history did nothing. Remembering them here is what makes that work.
        log.recordMany('history', rows);
        if (!ctx.settings.get('keepOnScreen')) return new Response(text, response);

        const known = new Set(rows.map((row) => row.id));
        for (const row of log.deletedIn(channelId)) {
          if (!known.has(row.id)) rows.push(MessageLog.toRow(row));
        }
        rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return new Response(JSON.stringify(rows), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return new Response(text, response);
      }
    }

    /* ---------------------------------------------------------------- drawing */

    function schedulePaint() {
      if (stopped) return;
      clearTimeout(paintTimer);
      clearTimeout(settleTimer);
      paintTimer = setTimeout(paint, 120);
      // Yapin' may still be re-rendering the list; look again once it has settled.
      settleTimer = setTimeout(paint, 700);
    }

    function ghostFor(row) {
      const cached = log.author(row.author_id) ?? {};
      const name = `${row.author_username ?? cached.username ?? 'deleted user'} (deleted)`;
      const avatar = row.author_avatar ?? cached.avatar ?? null;

      return ctx.h(
        'div',
        { class: ['msg', 'ypp-ghost'], dataset: { ypGhost: '1', messageId: row.id } },
        ctx.h(
          'div',
          { class: 'msg-gutter' },
          ctx.h(
            'button',
            { type: 'button', class: ['avatar', 'ypp-ghost-avatar', !avatar && 'is-missing'], disabled: true },
            avatar ? ctx.h('img', { src: avatar, alt: '', draggable: false }) : '?',
          ),
        ),
        ctx.h(
          'div',
          { class: 'msg-body' },
          ctx.h(
            'div',
            { class: 'msg-head' },
            ctx.h('span', { class: 'msg-author' }, name),
            ctx.h('span', { class: 'msg-time' }, new Date(row.created_at).toLocaleTimeString()),
          ),
          ctx.h('div', { class: 'msg-text' }, row.content ?? ''),
        ),
        ctx.h('div', { class: 'msg-actions' }),
      );
    }

    function paint() {
      const list = document.querySelector('.messages');
      const channelId = currentChannelId();
      if (!list || !channelId) return;

      const deleted = ctx.settings.get('keepOnScreen') ? log.deletedIn(channelId) : [];
      const wanted = new Set(deleted.map((row) => String(row.id)));

      // Our own stand-ins: drop the ones that aren't wanted, or that Yapin' now draws itself.
      for (const ghost of list.querySelectorAll('.msg.ypp-ghost')) {
        const id = ghost.dataset.messageId;
        if (!wanted.has(id) || list.querySelector(`.msg[data-message-id="${id}"]:not(.ypp-ghost)`)) ghost.remove();
      }

      // Yapin's own elements are only ever marked, never removed.
      for (const marked of list.querySelectorAll('.msg[data-yp-ghost]:not(.ypp-ghost)')) {
        if (!wanted.has(marked.dataset.messageId)) marked.removeAttribute('data-yp-ghost');
      }

      for (const row of deleted) {
        const real = list.querySelector(`.msg[data-message-id="${row.id}"]:not(.ypp-ghost)`);
        if (real) {
          // Yapin' is drawing it, because we put it back into the channel's history: mark it red,
          // and while it's on screen learn the name and picture to draw it with later.
          real.setAttribute('data-yp-ghost', '1');
          const avatar = real.querySelector('.avatar img');
          log.remember(row.id, {
            username: real.querySelector('.msg-author')?.textContent?.trim(),
            avatar: avatar?.getAttribute('src'),
            avatarStyle: avatar?.getAttribute('style') ?? '',
          });
          continue;
        }

        if (list.querySelector(`.msg.ypp-ghost[data-message-id="${row.id}"]`)) continue;

        const ghost = ghostFor(row);
        const after = [...list.querySelectorAll('.msg[data-message-id]')].find((element) => {
          const known = log.get(element.dataset.messageId);
          return known && known.created_at > row.created_at;
        });
        if (after) list.insertBefore(ghost, after);
        else list.append(ghost);
      }

      drawSummary(deleted);
    }

    /* ---------------------------------------------------------------- the strip */

    let strip = null;
    let summary = null;
    let summaryOpen = false;

    function drawSummary(deleted) {
      if (!strip || !summary) return;
      const show = ctx.settings.get('summary') && deleted.length > 0;
      strip.style.display = show ? 'block' : 'none';
      summary.style.display = show && summaryOpen ? 'block' : 'none';
      if (!show) return;

      strip.textContent = `${deleted.length} deleted message${deleted.length === 1 ? '' : 's'} in this channel; click to view`;
      summary.replaceChildren(
        ...[...deleted]
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map((row) =>
            ctx.h(
              'div',
              { class: 'ypp-ghost-entry' },
              ctx.h('span', { class: 'ypp-ghost-when' }, new Date(row.created_at).toLocaleString()),
              ' · ',
              ctx.h('b', { class: 'ypp-ghost-who' }, row.author_username ?? log.author(row.author_id)?.username ?? 'deleted user'),
              ': ',
              ctx.h('span', { class: 'ypp-ghost-what' }, row.content ?? ''),
            ),
          ),
      );
    }

    ctx.observe('.composer', (composer) => {
      strip = ctx.h('div', {
        id: 'ypp-ghost-strip',
        style: { display: 'none' },
        onClick() {
          summaryOpen = !summaryOpen;
          schedulePaint();
        },
      });
      summary = ctx.h('div', { id: 'ypp-ghost-list', style: { display: 'none' } });
      composer.parentNode?.insertBefore(strip, composer);
      composer.parentNode?.insertBefore(summary, composer);
      schedulePaint();
      return () => {
        strip?.remove();
        summary?.remove();
        strip = summary = null;
      };
    });

    /* ---------------------------------------------------------------- keeping up */

    // Repaint as messages come and go, and when the channel changes under us. A message leaving the
    // page is the usual way a deletion shows up, and is what a stand-in has to replace.
    ctx.observe('.messages .msg[data-message-id]', () => {
      schedulePaint();
      return schedulePaint;
    });
    let channel = currentChannelId();
    ctx.setInterval(() => {
      const now = currentChannelId();
      if (now === channel) return;
      channel = now;
      summaryOpen = false;
      schedulePaint();
    }, 500);

    ctx.onStop(() => {
      stopped = true;
      clearTimeout(paintTimer);
      clearTimeout(settleTimer);
      for (const ghost of document.querySelectorAll('.msg.ypp-ghost')) ghost.remove();
      for (const marked of document.querySelectorAll('.msg[data-yp-ghost]')) marked.removeAttribute('data-yp-ghost');
    });

    schedulePaint();
  },
});
