declare module "sql.js" {
  interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  interface Statement {
    run(params?: Array<string | number | null>): void;
    free(): void;
  }

  interface Database {
    run(sql: string, params?: Array<string | number | null>): void;
    exec(sql: string, params?: Array<string | number | null>): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
