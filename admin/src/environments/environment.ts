// Production settings. `ng build` uses this file.
export const environment = {
  production: true,
  apiUrl: '/api',
  // Serve API calls from core/mocks until the backend is live. Set to false (and delete core/mocks) then.
  useMocks: true,
  // Areas the real backend serves; none until it's deployed (development lists them in environment.development.ts).
  liveApi: [] as string[],
};
