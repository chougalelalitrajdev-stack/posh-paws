// Local development settings. `ng serve` swaps this in for environment.ts.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  // Serve API calls from core/mocks until the backend is live. Set to false to use the FastAPI server.
  useMocks: true,
  // Areas the real backend (backend/, http://localhost:8000) already serves; everything else stays on core/mocks.
  // Add an area when its backend module is done (backend/PLAN.md).
  liveApi: ['/auth', '/team', '/settings', '/templates', '/slot-board/week'],
};
