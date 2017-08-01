import * as postgres from "./postgres";
import * as mysql from "./mysql";
import * as s3 from "./s3";
import * as mssql from "./mssql";

const redshift = postgres;

export { mysql };
export { redshift };
export { postgres };
export { filesystem };
export { s3 };
export { mssql };
