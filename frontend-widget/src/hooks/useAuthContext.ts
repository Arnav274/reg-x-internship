export interface AuthContext {
  username: string;
  email: string;
  token: string;
}

const MOCK_AUTH: AuthContext = {
  username: "johndoe",
  email: "johndoe@example.com",
  token: "mock-jwt-token",
};

export function useAuthContext(): AuthContext {
  return MOCK_AUTH;
}
