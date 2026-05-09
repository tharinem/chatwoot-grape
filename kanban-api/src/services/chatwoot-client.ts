/**
 * Server-to-server Chatwoot API client.
 *
 * Uses each tenant's admin-provided API access token (stored encrypted in
 * Account.chatwootApiToken). Isolated from the user auth flow: we never
 * re-use a user's login token for server enrichment.
 */

export interface ChatwootContact {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
  thumbnail: string | null;
  custom_attributes: Record<string, unknown> | null;
  additional_attributes: Record<string, unknown> | null;
}

export interface ChatwootConversation {
  id: number;
  status: string;
  inbox_id: number;
  contact_id: number;
  assignee_id: number | null;
  channel: string | null;
  custom_attributes: Record<string, unknown> | null;
  additional_attributes: Record<string, unknown> | null;
}

interface FetchOpts {
  baseUrl: string;
  accountId: number;
  apiToken: string;
}

async function chatwootFetch<T>(path: string, opts: FetchOpts): Promise<T | null> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/v1/accounts/${opts.accountId}${path}`;
  try {
    const res = await fetch(url, {
      headers: { api_access_token: opts.apiToken },
    });
    if (!res.ok) {
      // 404 = contact/conversation no longer exists (orphan case).
      // 401 = token rejected (admin needs to refresh).
      // Caller should handle nulls gracefully.
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function fetchContact(contactId: number, opts: FetchOpts): Promise<ChatwootContact | null> {
  return chatwootFetch<ChatwootContact>(`/contacts/${contactId}`, opts);
}

export function fetchConversation(conversationId: number, opts: FetchOpts): Promise<ChatwootConversation | null> {
  return chatwootFetch<ChatwootConversation>(`/conversations/${conversationId}`, opts);
}

/** Quick connectivity/auth check for the Settings UI validation step. */
export async function pingChatwoot(opts: FetchOpts): Promise<{ ok: boolean; status?: number }> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/v1/profile`;
  try {
    const res = await fetch(url, {
      headers: { api_access_token: opts.apiToken },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

/**
 * Marker used in content_attributes to identify messages originated from the
 * Kanban side. Lets the webhook handler skip echo-back to prevent infinite loops.
 */
export const KANBAN_NOTE_SOURCE = 'grape_kanban';

/**
 * Create a private note on a Chatwoot conversation. Used by the Kanban "add note"
 * flow to mirror notes back to Chatwoot. Best-effort: returns null on any failure.
 */
export async function createPrivateNote(
  conversationId: number,
  content: string,
  opts: FetchOpts,
): Promise<{ id: number } | null> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/v1/accounts/${opts.accountId}/conversations/${conversationId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        api_access_token: opts.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        message_type: 'outgoing',
        private: true,
        content_attributes: { source: KANBAN_NOTE_SOURCE },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id: number };
    return { id: data.id };
  } catch {
    return null;
  }
}
