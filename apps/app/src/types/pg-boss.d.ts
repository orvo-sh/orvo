declare module "pg-boss" {
  class PgBoss {
    constructor(options: { connectionString: string; migrate?: boolean });
    on(event: "error", handler: (error: Error) => void): void;
    start(): Promise<this>;
    schedule(
      name: string,
      cron: string,
      data?: object | null,
      options?: { key?: string },
    ): Promise<void>;
    work(
      name: string,
      handler: (jobs: Array<{ id: string; data: unknown }>) => Promise<void>,
    ): Promise<string>;
  }

  export { PgBoss };
}
