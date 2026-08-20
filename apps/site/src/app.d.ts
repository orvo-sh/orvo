declare global {
  namespace App {
    interface Platform {
      env: {
        GITHUB_CACHE?: {
          get: (key: string) => Promise<string | null>;
          put: (key: string, value: string) => Promise<void>;
        };
      };
    }
  }
}

export {};
