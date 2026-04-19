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
