export interface FileDiff { path:string; patch:string; additions:number; deletions:number }

export function splitUnifiedDiff(patch:string):FileDiff[]{
  if(!patch.trim())return[];const lines=patch.split(/\r?\n/),groups:Array<{path:string;lines:string[]}>=[];let current:{path:string;lines:string[]}|null=null;
  for(const line of lines){const match=line.match(/^diff --git a\/(.+) b\/(.+)$/);if(match){current={path:match[2]!,lines:[line]};groups.push(current);}else if(current)current.lines.push(line);}
  if(!groups.length)return[{path:"전체 변경",patch,additions:lines.filter(line=>line.startsWith("+")&&!line.startsWith("+++")).length,deletions:lines.filter(line=>line.startsWith("-")&&!line.startsWith("---")).length}];
  return groups.map(group=>({path:group.path,patch:group.lines.join("\n"),additions:group.lines.filter(line=>line.startsWith("+")&&!line.startsWith("+++")).length,deletions:group.lines.filter(line=>line.startsWith("-")&&!line.startsWith("---")).length}));
}
