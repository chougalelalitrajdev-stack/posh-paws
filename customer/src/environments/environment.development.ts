// Local development settings. `ng serve` swaps this in for environment.ts.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  // Serve API calls from core/mocks until the backend is live. Set to false to use the FastAPI server.
  useMocks: true,
};
