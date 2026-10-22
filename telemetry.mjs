export function parseTelemetry(input){
  const text=input.replace(/^\uFEFF/,'');
  const line=text.split(/\r?\n/).find(x=>/^\s*snapshot\s*=/.test(x));
  if(!line)throw Error('В файле пока нет данных. Загрузи сохранение в игре.');
  const start=line.indexOf('{'),end=line.lastIndexOf('}');
  if(start<0||end<start)throw Error('Телеметрия ещё не поступила из игры');
  const d=JSON.parse(line.slice(start,end+1));
  if(d.version!==1 || !Array.isArray(d.quests)||d.quests.length>10000)throw Error('Неподдерживаемый формат телеметрии');
  for(const key of ['stamp','level','xp','xpNext','health','healthMax','stamina','staminaMax','crowns','skillPoints','toxicity','toxicityMax']){
    if(typeof d[key]!=='number'||!Number.isFinite(d[key]))throw Error('Некорректное поле '+key);
  }
  if(d.level<1||d.level>10000)throw Error('Некорректный уровень');
  const tasks=list=>list.slice(0,200).map(t=>({title:String(t.title||'').slice(0,2000),status:['active','completed','failed'].includes(t.status)?t.status:'active'}));
  d.quests=d.quests.map(q=>({id:String(q.id),title:String(q.title).slice(0,1000),type:Number(q.type),world:String(q.world||''),status:['active','completed','failed','inactive'].includes(q.status)?q.status:'inactive',...(Number.isFinite(q.level)&&q.level>0?{level:q.level}:{}),...(typeof q.description==='string'?{description:q.description.slice(0,30000)}:{}),...(Array.isArray(q.objectives)?{objectives:tasks(q.objectives)}:{})}));
  if(d.build&&typeof d.build==='object'){
    const clean=list=>Array.isArray(list)?list.slice(0,400).map(x=>{
      const item={title:String(x.title||'').slice(0,1000),slot:String(x.slot||'').slice(0,100),color:['red','green','blue','yellow'].includes(x.color)?x.color:'',group:Number.isFinite(x.group)?x.group:0,level:Number.isFinite(x.level)?x.level:0,maxLevel:Number.isFinite(x.maxLevel)?x.maxLevel:0};
      for(const k of ['id','icon','description','primaryLabel','primaryValue','weight'])if(x[k]!==undefined)item[k]=String(x[k]).slice(0,k==='description'?16000:500);
      for(const k of ['slotId','row','column','links','quality','durability','socketCount'])if(Number.isFinite(x[k]))item[k]=x[k];
      if(typeof x.active==='boolean')item.active=x.active;
      if(Array.isArray(x.stats))item.stats=x.stats.slice(0,80).map(s=>({label:String(s.label||'').slice(0,1000),value:String(s.value||'').slice(0,500)}));
      if(Array.isArray(x.sockets))item.sockets=x.sockets.slice(0,20).map(s=>String(s).slice(0,500));
      return item;
    }):[];
    const build=d.build;
    d.build={skills:clean(build.skills),mutagens:clean(build.mutagens),equipment:clean(build.equipment)};
    if(build.detailsVersion===2)d.build.detailsVersion=2;
    if(Array.isArray(build.slots))d.build.slots=build.slots.slice(0,60).map(s=>({id:Number(s.id)||0,skillId:String(s.skillId),group:Number(s.group)||0,unlocked:s.unlocked===true,unlockAt:Number(s.unlockAt)||0}));
  }else delete d.build;
  d.objectives=Array.isArray(d.objectives)?d.objectives.map(x=>String(x).slice(0,2000)):[];
  return d;
}
export function decodeTelemetry(bytes){
  return new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':'utf-8').decode(bytes);
}
export function parseScriptLog(text){
  const marker='WITCHER_PATH_SNAPSHOT=';
  const lines=text.split(/\r?\n/);
  for(let i=lines.length-1;i>=0;i--){
    const at=lines[i].indexOf(marker);
    if(at<0)continue;
    try{return parseTelemetry('snapshot='+lines[i].slice(at+marker.length));}catch{}
  }
  throw Error('В журнале пока нет снимка Witcher Path');
}
