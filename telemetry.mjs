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
  d.quests=d.quests.map(q=>({id:String(q.id),title:String(q.title).slice(0,1000),type:Number(q.type),world:String(q.world||''),status:['active','completed','failed','inactive'].includes(q.status)?q.status:'inactive'}));
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
