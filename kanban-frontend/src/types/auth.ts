export interface TokenExchangeRequest {
  chatwoot_token: string;
  account_id: number;
}

export interface TokenExchangeResponse {
  token: string;
  api_key?: string;
}

export interface JwtPayload {
  user_id: number;
  account_id: number;
  role: string;
  exp: number;
  iat: number;
}
