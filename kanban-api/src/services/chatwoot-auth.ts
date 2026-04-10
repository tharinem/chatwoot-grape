export interface ChatwootProfile {
  id: number;
  account_id: number;
  name: string;
  email: string;
  role: string;
  accounts: Array<{ id: number; name: string; role: string; status: string }>;
}

export async function validateChatwootToken(
  token: string
): Promise<ChatwootProfile | null> {
  try {
    const response = await fetch(
      `${process.env.CHATWOOT_BASE_URL}/api/v1/profile`,
      {
        headers: { api_access_token: token },
      }
    );
    if (!response.ok) return null;
    return (await response.json()) as ChatwootProfile;
  } catch {
    return null;
  }
}
