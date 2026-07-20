import {resolve} from "node:path";
import {SQLiteStateStore} from "../../packages/persistence/src/index.js";
import {OperationalStore} from "../../packages/operations/src/index.js";

const [command,...args]=process.argv.slice(2);
if(command==="backup"){
 const [dbPath,backupPath]=args;if(!dbPath||!backupPath)throw new Error("Usage: ops:backup -- <db-path> <backup-path>");
 const state=new SQLiteStateStore(resolve(dbPath));try{const result=await new OperationalStore(state.db,resolve(dbPath)).createBackup(resolve(backupPath));console.log(JSON.stringify(result));}finally{state.close();}
}else if(command==="restore"){
 const [backupPath,targetPath]=args;if(!backupPath||!targetPath)throw new Error("Usage: ops:restore -- <backup-path> <new-target-path>");
 console.log(JSON.stringify(OperationalStore.restore(resolve(backupPath),resolve(targetPath))));
}else throw new Error("Command must be backup or restore");
