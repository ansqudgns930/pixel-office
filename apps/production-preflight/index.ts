import { validateProductionEnvironment } from "../../packages/production-preflight/src/index.js";
const result=validateProductionEnvironment();console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
