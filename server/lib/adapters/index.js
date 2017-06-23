import * as postgres from "./postgres";
import * as mysql from "./mysql";
import * as filesystem from "./filesystem";
import * as s3 from "./s3";

const redshift = postgres;

export { mysql };
export { redshift };
export { postgres };
export { filesystem };
export { s3 };
