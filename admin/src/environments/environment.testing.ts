// Unit tests (npm test): like development, but every area stays on core/mocks so the tests never need the backend.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  useMocks: true,
  liveApi: [] as string[],
};
