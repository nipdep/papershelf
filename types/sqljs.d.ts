declare module "sql.js" {
  export interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  export interface Statement {
    run(params?: Array<string | number | null>): void;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: Array<string | number | null>): void;
    exec(sql: string, params?: Array<string | number | null>): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}

declare module "sql.js/dist/sql-asm.js" {
  export { default } from "sql.js";
  export * from "sql.js";
}
