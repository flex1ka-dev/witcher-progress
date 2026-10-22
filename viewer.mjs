import {watchProgress} from './live.mjs?v=8754103ed963';
import liveConfig from './live-config.mjs?v=8754103ed963';
import {renderCharacter} from './character.mjs?v=8754103ed963';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
let state=null,filter='active',view='overview',busy=false;
const types={0:'Основные задания',1:'Основные задания',2:'Дополнительные задания',3:'Ведьмачьи заказы',4:'Поиск сокровищ',6:'Каменные сердца',7:'Кровь и вино'};
const worlds={AN_NMLandNovigrad:'Велен и Новиград',AN_Velen:'Велен',AN_Kaer_Morhen:'Каэр Морхен',AN_Prologue_Village:'Белый Сад',AN_Wyzima:'Вызима',AN_Skellige_ArdSkellig:'Скеллиге',AN_Bob:'Туссент',AN_Undefined:'Континент'};
const names={active:'В процессе',completed:'Завершено',failed:'Провалено',inactive:'Неактивно'};
const plain=t=>String(t||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'');
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function world(q){return worlds[q?.world]||'Континент';}
function navigate(next){view=next;document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!==next+'-view');document.querySelectorAll('.nav').forEach(n=>{n.classList.toggle('active',n.dataset.view===next);n.setAttribute('aria-current',n.dataset.view===next?'page':'false');});$('view-name').textContent=({overview:'Обзор пути',quests:'Журнал квестов',character:'Персонаж'})[next];window.scrollTo(0,0);}
document.querySelectorAll('[data-view]').forEach(n=>n.onclick=()=>navigate(n.dataset.view));document.querySelectorAll('[data-go]').forEach(n=>n.onclick=()=>navigate(n.dataset.go));
document.querySelectorAll('[data-filter]').forEach(n=>n.onclick=()=>{filter=n.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b===n);b.setAttribute('aria-pressed',String(b===n));});renderQuests();});
$('search').oninput=renderQuests;$('type-filter').onchange=renderQuests;
function tasks(list){const ul=el('ul','task-list');for(const t of list||[])ul.append(el('li',typeof t==='string'?'active':t.status,plain(typeof t==='string'?t:t.title)));return ul;}
function renderQuests(){
 const open=new Set([...document.querySelectorAll('.quest-entry[open]')].map(n=>n.dataset.id));
 const query=$('search').value.toLocaleLowerCase('ru'),type=$('type-filter').value;
 const rows=(state?.quests||[]).filter(q=>(filter==='all'||q.status===filter)&&q.title.toLocaleLowerCase('ru').includes(query)&&(type==='all'||type==='main'&&[0,1].includes(q.type)||String(q.type)===type));
 const groups=new Map();for(const q of rows){const title=types[q.type]||'Другие задания';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(q);}
 const sections=[];for(const [title,quests] of [...groups].sort((a,b)=>['Основные задания','Дополнительные задания','Ведьмачьи заказы','Поиск сокровищ','Каменные сердца','Кровь и вино'].indexOf(a[0])-['Основные задания','Дополнительные задания','Ведьмачьи заказы','Поиск сокровищ','Каменные сердца','Кровь и вино'].indexOf(b[0]))){const section=el('section','quest-section'),h=el('h2','',title);h.append(el('span','',String(quests.length)));section.append(h);
 quests.sort((a,b)=>(b.id===state.trackedId)-(a.id===state.trackedId)||(a.level??999)-(b.level??999));
 for(const q of quests){const entry=el('details','quest-entry'+(q.id===state.trackedId?' tracked':''));entry.dataset.id=q.id;entry.open=open.has(q.id);const summary=el('summary'),level=el('span','quest-level'+(q.level>state.level+5?' high':''),q.level==null?'—':String(q.level));level.append(el('small','','УРОВЕНЬ'));const copy=el('span'),name=el('span','quest-title',(q.id===state.trackedId?'◇ ':'')+q.title);copy.append(name,el('span','quest-meta',world(q)+' · '+names[q.status]+(q.id===state.trackedId?' · Отслеживается':'')));summary.append(level,copy);entry.append(summary);const body=el('div','quest-body');
 if(q.description)body.append(el('p','',plain(q.description)));
 const list=q.objectives?.length?q.objectives:q.id===state.trackedId?state.objectives:[];
 if(list?.length){body.append(el('h3','','Задачи'),tasks(list));}
 if(!q.description&&!q.objectives)body.append(el('p','waiting','Подробности этого задания ещё не получены из игры.'));
 entry.append(body);section.append(entry);}sections.push(section);}
 $('quest-list').replaceChildren(...(sections.length?sections:[el('div','empty-state',state?'Нет заданий по выбранным фильтрам.':'Журнал загружается…')]));
}
function buildSection(title,items,kind){const section=el('section','panel build-section');section.append(el('h2','',title));if(!items){section.append(el('p','waiting','Данные появятся после следующей загрузки сохранения с обновлённым модом.'));return section;}if(!items.length){section.append(el('p','waiting','Ничего не выбрано.'));return section;}const grid=el('div','build-grid');for(const item of items){const card=el('article','build-item '+String(item.color||''));card.append(el('small','',kind==='equipment'?item.slot:'Группа '+item.group),el('strong','',item.title));if(item.level)card.append(el('small','','Уровень '+item.level+(item.maxLevel?' / '+item.maxLevel:'')));grid.append(card);}section.append(grid);return section;}
function render(){const d=state,tracked=d.quests.find(q=>q.id===d.trackedId);$('level').textContent=fmt(d.level);$('xp-label').textContent=fmt(d.xp)+' / '+fmt(d.xpNext)+' XP';$('xp-bar').style.width=Math.min(100,d.xp/Math.max(1,d.xpNext)*100)+'%';
 $('hero-description').textContent='Уровень и опыт Геральта';$('hero-location').textContent='◇ '+world(tracked);$('hero-source').textContent='';
 for(const [id,value] of [['completed',d.quests.filter(q=>q.status==='completed').length],['active',d.quests.filter(q=>q.status==='active').length],['crowns',d.crowns],['skills',d.skillPoints]])$(id).textContent=fmt(value);
 $('quest-summary').textContent='Из '+d.quests.length+' открытых заданий';$('nav-count').textContent=d.quests.filter(q=>q.status==='active').length;
 $('tracked-title').textContent=tracked?.title||'Задание не выбрано';$('tracked-type').textContent=tracked?(types[tracked.type]||'Задание'):'ТЕКУЩАЯ ЦЕЛЬ';$('tracked-world').textContent=tracked?world(tracked)+(tracked.level?' · Уровень '+tracked.level:''):'В игровом журнале нет отслеживаемого задания.';$('objectives').replaceChildren(...(d.objectives||[]).map(t=>el('li','',plain(t))));
 for(const b of document.querySelectorAll('[data-filter]')){const n=b.dataset.filter;b.textContent=({active:'Активные',completed:'Завершённые',failed:'Проваленные',all:'Все'})[n]+' · '+d.quests.filter(q=>n==='all'||q.status===n).length;}
 renderCharacter(d);renderQuests();}
function status(text,error=false){const box=$('viewer-status');box.classList.toggle('error',error);box.replaceChildren(el('span','',text));if(error){const retry=el('button','','Повторить');retry.onclick=poll;box.append(retry);}}
async function poll(){if(busy)return;busy=true;try{const r=await fetch(document.documentElement.dataset.stateEndpoint||'progress.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const body=await r.json();if(!body.data||!Array.isArray(body.data.quests))throw Error('Нет данных');state=body.data;render();const date=new Date(body.modified);status('Данные из игры: '+date.toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+'. Обновляются примерно раз в 10 минут во время игры.');}catch{status(state?'Не удалось проверить обновления. Показаны сохранённые данные.':'Не удалось загрузить прохождение. Попробуй ещё раз.',true);}finally{busy=false;}}
document.querySelector('.page-heading p').textContent='Квесты, прокачка и снаряжение — для тех, кто следит за приключением.';
if(document.documentElement.dataset.platform==='github'){
  watchProgress(liveConfig,body=>{state=body.data;render();status('Прогресс обновляется автоматически. После выхода из игры остаются последние данные.');},()=>{status(state?'Показан сохранённый прогресс. Восстанавливаем связь с обновлениями.':'Подключаемся к прохождению…');});
}else{poll();setInterval(poll,5000);}
