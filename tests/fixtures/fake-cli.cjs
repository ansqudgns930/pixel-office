const args=process.argv.slice(2),joined=args.join(" ");
if(joined.includes("AUTH_FAIL")){process.stderr.write("Not logged in. Login required.");process.exit(1);}
if(joined.includes("SLOW")){setTimeout(()=>process.stdout.write("late"),5000);}
else if(joined.includes("LARGE"))process.stdout.write("x".repeat(2048));
else if((args[0]==="-p"&&args[1]==="--model")||args.at(-1)==="-"){let input="";process.stdin.setEncoding("utf8");process.stdin.on("data",chunk=>input+=chunk);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({args,stdinLength:input.length,tail:input.slice(-8)})));}
else process.stdout.write(JSON.stringify(args));
