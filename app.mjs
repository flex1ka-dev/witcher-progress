import {parseTelemetry,decodeTelemetry,parseScriptLog} from './telemetry.mjs';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
let state=null,folder=null,modified=0,lastStamp=null,lastSignal=0,mode='waiting',filter='active',events=[],busy=false,view='overview';
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
const isViewer=document.documentElement.dataset.audience==='viewers';
const isGitHub=document.documentElement.dataset.platform==='github';
const stateEndpoint=document.documentElement.dataset.stateEndpoint||'/api/state';
const typeName=t=>({0:'Основной сюжет',1:'Основной сюжет',2:'Дополнительный квест',3:'Ведьмачий заказ',4:'Поиск сокровищ',6:'Каменные сердца',7:'Кровь и вино'})[t]||'Квест';
const worlds={AN_NMLandNovigrad:'Велен и Новиград',AN_Velen:'Велен',AN_Kaer_Morhen:'Каэр Морхен',AN_Prologue_Village:'Белый Сад',AN_Prologue_Village_Winter:'Белый Сад',AN_Wyzima:'Вызима',AN_Skellige_ArdSkellig:'Скеллиге',AN_Bob:'Туссент',AN_Undefined:'Континент',novigrad:'Новиград',velen:'Велен',skellige:'Скеллиге',kaer_morhen:'Каэр Морхен',white_orchard:'Белый Сад',prolog_village:'Белый Сад',prolog_village_winter:'Белый Сад',bob:'Туссент',wyzima:'Вызима',no_mans_land:'Велен и Новиград'};
const worldName=w=>worlds[w]||w||'Континент';
const statusName=s=>({active:'В процессе',completed:'Завершён',failed:'Провален',inactive:'Неактивен'})[s]||s;
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,5500);}
function navigate(next){view=next;document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==next+'-view');document.querySelectorAll('.nav').forEach(e=>e.classList.toggle('active',e.dataset.view===next));$('view-name').textContent=({overview:'Обзор пути',quests:'Журнал квестов',character:'Персонаж',connection:'Подключение'})[next];if(next==='quests')renderQuests();if(next==='character')renderCharacter();window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-view]').forEach(e=>e.onclick=()=>navigate(e.dataset.view));
document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>navigate(e.dataset.go));
$('settings').onclick=()=>navigate('connection');
function addEvent(text){events.unshift({text,time:new Date()});events=events.slice(0,30);}
function accept(data,mtime,source){
  if(data.stamp!==lastStamp){lastSignal=Math.min(Date.now(),mtime);lastStamp=data.stamp;}
  if(state&&mode!=='demo'&&source!=='demo'&&source!=='public'){
    if(data.level!==state.level)addEvent(`Уровень Геральта: ${data.level}`);
    const prev=new Map(state.quests.map(q=>[q.id,q]));
    for(const q of data.quests){const old=prev.get(q.id);if(old&&old.status!==q.status)addEvent(`${statusName(q.status)}: ${q.title}`);else if(!old&&q.status==='active')addEvent(`Новый квест: ${q.title}`);}
  }else if(source!=='demo'&&source!=='public'&&!state)addEvent('Получен первый снимок из игры');
  state=data;modified=mtime;mode=source;render();
}
function bar(id,value,max){$(id).style.width=`${Math.min(100,Math.max(0,max>0?value/max*100:0))}%`;}
function render(){
  if(!state){renderConnection();return;}
  const d=state,done=d.quests.filter(q=>q.status==='completed').length,active=d.quests.filter(q=>q.status==='active').length;
  $('level').textContent=fmt(d.level);$('xp-label').textContent=`${fmt(d.xp)} / ${fmt(d.xpNext)} XP`;bar('xp-bar',d.xp,d.xpNext);
  $('completed').textContent=fmt(done);$('active').textContent=fmt(active);$('crowns').textContent=fmt(d.crowns);$('skills').textContent=fmt(d.skillPoints);$('nav-count').textContent=active;
  $('quest-summary').textContent=`Из ${fmt(d.quests.length)} открытых в журнале`;
  $('hero-description').textContent=mode==='demo'?'Демонстрация интерфейса · вымышленные данные':isViewer?'Прохождение flex1ka · хроника для чата':'Твоя история продолжается';
  const tracked=d.quests.find(q=>q.id===d.trackedId);
  $('hero-location').textContent='◇ '+worldName(tracked?.world);$('hero-source').textContent=mode==='demo'?'◇ Демо · не данные твоей игры':'⌁ Телеметрия из игры';
  $('tracked-title').textContent=tracked?.title||'Нет отслеживаемого квеста';$('tracked-world').textContent=tracked?worldName(tracked.world):'Выбери задание в журнале игры.';$('tracked-type').textContent=tracked?typeName(tracked.type).toUpperCase():'ТЕКУЩАЯ ЦЕЛЬ';
  $('objectives').replaceChildren(...(tracked?d.objectives:[]).map(t=>el('li','',t)));
  for(const k of ['health','stamina','toxicity']){$(k+'-label').textContent=`${fmt(d[k])} / ${fmt(d[k+'Max'])}`;bar(k+'-bar',d[k],d[k+'Max']);}
  const list=events.slice(0,6).map(e=>{const row=el('div','event');row.append(el('span','',e.text),el('small','',e.time.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})));return row;});
  if(list.length)$('events').replaceChildren(...list);
  if(view==='quests')renderQuests();if(view==='character')renderCharacter();renderConnection();
}
function renderConnection(){
  const freshness=isGitHub?15*60*1000:12000;
  const age=Date.now()-modified,stale=Date.now()-lastSignal>freshness||age>freshness;
  const live=!!state&&mode!=='demo'&&mode!=='file'&&!stale;
  $('connection-badge').className='badge'+(live?' live':mode==='demo'?' demo':'');
  $('connection-badge').textContent=mode==='demo'?'◇ Демо-режим':mode==='file'?'◇ Снимок из файла':live?(isGitHub?'● Недавний снимок':'● Игра обновляется'):state?(isViewer?'◌ Последний прогресс':'◌ Нет свежего сигнала'):'● Ожидание игры';
  $('setup-state').textContent=mode==='demo'?'Сейчас открыт пример':live?'Связь с игрой установлена':state?'Последний снимок сохранён':'Ожидаю первый сигнал';
  $('setup-detail').textContent=live?'Уровень, статистика и квесты обновляются автоматически.':mode==='demo'?'Это вымышленные данные для знакомства с интерфейсом. Подключи свою игру ниже.':state?'Загрузи игру или выйди из паузы. Статистика на экране относится к последнему полученному снимку.':'Загрузи сохранение с модом Witcher Path. Сайт начнёт получать данные автоматически.';
  $('last-update').textContent=mode==='demo'?'Демо · вымышленные данные':modified?`Снимок: ${new Date(modified).toLocaleString('ru-RU')} ${stale?'· устарел':''}`:'Ещё нет данных из игры';
  $('demo').textContent=mode==='demo'?'Выйти из примера ↗':'Посмотреть пример ↗';
  $('disconnect').hidden=!folder;$('connect').textContent=folder?'Выбрать другую папку →':'Выбрать папку The Witcher 3 →';
}
function renderQuests(){
  const query=$('search').value.toLocaleLowerCase('ru'),type=$('type-filter').value;
  const quests=(state?.quests||[]).filter(q=>(filter==='all'||q.status===filter)&&q.title.toLocaleLowerCase('ru').includes(query)&&(type==='all'||type==='main'&&[0,1].includes(q.type)||String(q.type)===type));
  if(!quests.length){$('quest-list').replaceChildren(el('div','empty-state',state?'Подходящих квестов нет. Попробуй другой фильтр.':'Подключи игру, чтобы открыть свой журнал.'));return;}
  $('quest-list').replaceChildren(...quests.map(q=>{const row=el('article','quest-row'),copy=el('div');copy.append(el('h4','',(q.id===state.trackedId?'◇ ':'')+q.title),el('small','',typeName(q.type)+' · '+worldName(q.world)));row.append(copy,el('span','status '+q.status,statusName(q.status)));return row;}));
}
document.querySelectorAll('[data-filter]').forEach(e=>e.onclick=()=>{filter=e.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===e));renderQuests();});
$('search').oninput=renderQuests;$('type-filter').onchange=renderQuests;
function renderCharacter(){
  const d=state;
  const stats=[['Уровень',d?.level,'Школа Волка'],['Опыт',d?`${fmt(d.xp)} / ${fmt(d.xpNext)}`:null,'До следующего уровня'],['Кроны',d?.crowns,'Кошель Геральта'],['Здоровье',d?`${fmt(d.health)} / ${fmt(d.healthMax)}`:null,'Текущий запас жизненной силы'],['Энергия',d?`${fmt(d.stamina)} / ${fmt(d.staminaMax)}`:null,'Для знаков и действий'],['Очки умений',d?.skillPoints,'Свободны для распределения']];
  $('character-details').replaceChildren(...stats.map(([title,value,note])=>{const card=el('article','panel');card.append(el('span','stat-label',title),el('strong','',value==null?'—':typeof value==='number'?fmt(value):value),el('small','',note));return card;}));
}
async function poll(){
  if(busy||mode==='demo'||mode==='file')return;busy=true;
  try{
    if(folder){
      let firstError,found=false;
      for(const name of ['WitcherPath.ini','scriptslog.txt','scriptlog.txt']){
        try{
          let h;
          try{h=await folder.getFileHandle(name);}
          catch(error){
            if(typeof folder.values!=='function')throw error;
            for await(const entry of folder.values())if(entry.kind==='file'&&entry.name.toLowerCase()===name.toLowerCase()){h=entry;break;}
            if(!h)throw error;
          }
          const f=await h.getFile(),isLog=name.endsWith('.txt');
          if(!isLog&&f.size>4*1024*1024)throw Error('Слишком большой файл телеметрии');
          const bytes=new Uint8Array(await (isLog?f.slice(Math.max(0,f.size-512*1024)):f).arrayBuffer());
          const data=isLog?parseScriptLog(decodeTelemetry(bytes)):parseTelemetry(decodeTelemetry(bytes));
          accept(data,f.lastModified,'folder');$('connect-message').textContent='Данные читаются из '+name+'. Папка: '+folder.name;found=true;break;
        }catch(error){firstError??=error;}
      }
      if(!found)throw firstError;
    }
    else if(isLocal||isViewer){const r=await fetch(stateEndpoint,{cache:'no-store',signal:AbortSignal.timeout(4500)});const body=await r.json();if(r.ok&&body.data){if(isViewer&&Array.isArray(body.events))events=body.events.map(e=>({text:String(e.text),time:new Date(e.time)}));accept(body.data,body.modified,isViewer?'public':'local');}else $('connect-message').textContent=body.error;}
  }catch(e){
    if(folder&&e.name==='NotFoundError')$('connect-message').textContent='WitcherPath.ini ещё не появился. Загрузи сохранение с включённым модом.';
    else if(folder&&e.name==='NotAllowedError'){$('connect-message').textContent='Доступ к папке закрыт. Выбери её ещё раз.';folder=null;}
    else if(folder&&/name is not allowed/i.test(e.message)){$('connect-message').textContent='Браузер не разрешил открыть WitcherPath.ini в выбранной папке. Попробуй обычный Chrome или Edge либо локальную версию через start.cmd.';folder=null;lastSignal=0;}
    else if(e.name!=='TimeoutError')$('connect-message').textContent=isLocal?'Локальный помощник недоступен. Запусти start.cmd.':e.message;
  }finally{busy=false;renderConnection();}
}
$('connect').onclick=async()=>{
  if(!window.showDirectoryPicker){$('connect-message').textContent='Выбор папки доступен в Chrome и Edge. Открой сайт в одном из них или используй локальную версию.';return;}
  try{const selected=await window.showDirectoryPicker({mode:'read',id:'witcher-path',startIn:'documents'});folder=selected;mode='waiting';lastStamp=null;modified=0;$('connect-message').textContent='Папка подключена: '+selected.name;await poll();}catch(e){if(e.name!=='AbortError')$('connect-message').textContent=e.message;}
};
$('disconnect').onclick=()=>{folder=null;mode=isLocal?'waiting':'disconnected';lastSignal=0;renderConnection();$('connect-message').textContent='Папка отключена. Последний снимок остаётся на экране.';};
$('import-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const isLog=f.name.toLowerCase().endsWith('.txt');if(!isLog&&f.size>4*1024*1024)throw Error('Слишком большой файл');const text=decodeTelemetry(new Uint8Array(await (isLog?f.slice(Math.max(0,f.size-512*1024)):f).arrayBuffer()));accept(isLog?parseScriptLog(text):parseTelemetry(text),f.lastModified,'file');notify('Открыт снимок из файла. Для живых обновлений подключи папку.');}catch(err){notify('Не удалось прочитать телеметрию: '+err.message);}e.target.value='';};
const demoData={version:1,stamp:1,level:24,xp:1240,xpNext:2000,health:4320,healthMax:5100,stamina:100,staminaMax:100,toxicity:18,toxicityMax:100,crowns:6842,skillPoints:3,trackedId:'1',objectives:['Найти следы пропавшего ведьмака в деревне.','Осмотреть место нападения с помощью ведьмачьего чутья.'],quests:[{id:'1',title:'По следам охотника',type:2,world:'velen',status:'active'},{id:'2',title:'Контракт: тень в лесу',type:3,world:'velen',status:'active'},{id:'3',title:'Старый друг',type:2,world:'novigrad',status:'completed'},{id:'4',title:'Сокровища забытой башни',type:4,world:'skellige',status:'active'},{id:'5',title:'Дорога к морю',type:0,world:'novigrad',status:'completed'},{id:'6',title:'Последний шанс',type:2,world:'velen',status:'failed'}]};
let beforeDemo=null;
$('demo').onclick=()=>{
  if(mode==='demo'){
    ({state,mode,modified,lastStamp,lastSignal,events}=beforeDemo);beforeDemo=null;
    if(state)render();else location.reload();poll();return;
  }
  beforeDemo={state,mode,modified,lastStamp,lastSignal,events};state=null;events=[];accept(structuredClone(demoData),Date.now(),'demo');notify('Демо-режим: все значения и задания вымышлены.');
};
if(isGitHub){document.querySelector('.page-heading p').textContent='Прохождение flex1ka · обновление примерно раз в 10 минут.';document.querySelector('.panel-note').textContent='Показатели относятся к последнему опубликованному снимку.';}
renderQuests();renderCharacter();renderConnection();poll();setInterval(poll,isGitHub?60000:isViewer?5000:2000);setInterval(renderConnection,1000);
