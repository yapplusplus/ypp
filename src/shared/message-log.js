/**
 * What Message Logger remembers.
 *
 * It lives in sessionStorage, as the old plugin had it: the log survives Yapin' reloading itself,
 * and is gone for good when the app closes. Deleted messages are never written to disk.
 */

const AUTHOR = '__author__';

export class MessageLog {
  /** Messages kept at once. The oldest are dropped first. */
  static LIMIT = 500;

  #key;

  constructor(key = 'yapplus.messagelog') {
    this.#key = key;
  }

  #read() {
    try {
      return JSON.parse(sessionStorage.getItem(this.#key) ?? '{}');
    } catch {
      return {};
    }
  }

  #write(data) {
    const messages = Object.entries(data).filter(([key]) => !key.startsWith(AUTHOR));
    if (messages.length > MessageLog.LIMIT) {
      const oldest = messages
        .sort((a, b) => String(a[1]?.created_at).localeCompare(String(b[1]?.created_at)))
        .slice(0, messages.length - MessageLog.LIMIT);
      for (const [key] of oldest) delete data[key];
    }
    try {
      sessionStorage.setItem(this.#key, JSON.stringify(data));
    } catch {
      // Out of room; the next write drops more and tries again.
    }
  }

  /** Every message we know about, newest last. */
  entries() {
    return Object.entries(this.#read())
      .filter(([key]) => !key.startsWith(AUTHOR))
      .map(([, value]) => value)
      .filter(Boolean);
  }

  get(id) {
    return this.#read()[id] ?? null;
  }

  /** The messages that were deleted in one channel. */
  deletedIn(channelId) {
    return this.entries().filter((row) => row.deleted && row.channel_id === channelId);
  }

  /** Remembers a message. `key` is its id, or a temporary one for a message still being sent. */
  record(key, direction, row) {
    if (!key) return;
    const data = this.#read();
    const author = data[AUTHOR + row.author_id];
    data[key] = {
      id: row.id ?? null,
      direction,
      content: row.content,
      channel_id: row.channel_id,
      author_id: row.author_id,
      created_at: row.created_at ?? new Date().toISOString(),
      deleted: false,
      edited: false,
      author_username: author?.username,
      author_avatar: author?.avatar,
      author_avatar_style: author?.avatar_style,
    };
    this.#write(data);
  }

  /** Files a message we sent under the id the server gave it. */
  rekey(temporaryKey, id) {
    const data = this.#read();
    const row = data[temporaryKey];
    if (!row || !id) return;
    row.id = id;
    data[id] = row;
    delete data[temporaryKey];
    this.#write(data);
  }

  /** Marks a message deleted. Returns it, or null when it was never seen or is already marked. */
  markDeleted(id) {
    const data = this.#read();
    const row = data[id];
    if (!row || row.deleted) return null;
    row.deleted = true;
    row.deleted_at = new Date().toISOString();
    this.#write(data);
    return row;
  }

  markEdited(id, content) {
    const data = this.#read();
    const row = data[id];
    if (!row || typeof content !== 'string') return;
    row.edits = [...(row.edits ?? []), { at: new Date().toISOString(), content }];
    row.edited = true;
    this.#write(data);
  }

  /** Keeps the name and picture of whoever we've seen, to draw deleted messages with later. */
  cacheAuthors(rows) {
    const data = this.#read();
    let changed = false;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const id = row.id ?? row.user_id ?? row.author_id;
      const username = row.username ?? row.display_name ?? row.name ?? row.handle;
      const avatar = row.avatar_url ?? row.avatar ?? row.profile_picture ?? row.pfp;
      if (!id || (!username && !avatar)) continue;
      data[AUTHOR + id] = { id, username, avatar, avatar_style: data[AUTHOR + id]?.avatar_style };
      changed = true;
    }
    if (changed) this.#write(data);
  }

  author(id) {
    return this.#read()[AUTHOR + id] ?? null;
  }

  /** Fills in a name and picture read off a message that is still on screen. */
  remember(id, { username, avatar, avatarStyle }) {
    const data = this.#read();
    const row = data[id];
    if (!row) return false;
    let changed = false;
    if (username && !row.author_username) {
      row.author_username = username;
      changed = true;
    }
    if (avatar && !row.author_avatar) {
      row.author_avatar = avatar;
      row.author_avatar_style = avatarStyle ?? '';
      changed = true;
    }
    if (changed && row.author_id) {
      data[AUTHOR + row.author_id] = {
        id: row.author_id,
        username: row.author_username,
        avatar: row.author_avatar,
        avatar_style: row.author_avatar_style,
      };
    }
    if (changed) this.#write(data);
    return changed;
  }

  /** A deleted message, shaped the way Yapin' expects a message from its API. */
  static toRow(row) {
    return {
      id: row.id,
      channel_id: row.channel_id,
      author_id: row.author_id,
      content: row.content,
      created_at: row.created_at,
      edited_at: null,
      attachment_path: null,
      attachment_width: null,
      attachment_height: null,
      reply_to_id: null,
      pinned_at: null,
      pinned_by: null,
    };
  }
}
