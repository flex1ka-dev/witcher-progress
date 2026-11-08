const factions=['Королевства Севера','Нильфгаард','Скоя’таэли','Чудовища','Скеллиге'];
const rows={
  leader:['Лидеры','♛'],melee:['Ближний бой','⚔'],ranged:['Дальний бой','➶'],
  siege:['Осадный ряд','◆'],agile:['Проворные отряды','↔'],special:['Особые карты','✦']
};
let mode='decks', selected=null, previous='';
const cardText=text=>text.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?(?:i|b|em|strong|font)(?:\s[^>]*)?>/gi,'');

function element(tag,text,cls){
  const node=document.createElement(tag);
  if(text)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}

function button(text,active,onClick){
  const node=element('button',text,active?'selected':'');
  node.type='button';
  node.setAttribute('aria-pressed',String(active));
  node.onclick=onClick;
  return node;
}

function cardTile(card,count){
  const tile=element('details','','gwent-card');
  const label=element('summary');
  const description=cardText(card.description||'');
  if(description)label.title=description;
  const badge=element('span',rows[card.row][1],'gwent-symbol');
  badge.setAttribute('aria-hidden','true');
  label.append(badge,element('strong',cardText(card.title)),element('small',card.row==='leader'?'Лидер':(card.row!=='special'?'Сила '+card.power+' · ':'')+'×'+count));
  tile.append(label);
  if(description)tile.append(element('p',description,'gwent-description'));
  else tile.append(element('p','Описание отсутствует в данных игры.','gwent-description'));
  return tile;
}

function groups(cards,counts){
  const result=[];
  for(const [row,[title]] of Object.entries(rows)){
    const matching=cards.filter(card=>card.row===row&&counts.has(card.id));
    if(!matching.length)continue;
    const section=element('section','','gwent-group');
    const grid=element('div','','gwent-grid');
    grid.append(...matching.map(card=>cardTile(card,counts.get(card.id))));
    section.append(element('h2',title),grid);
    result.push(section);
  }
  return result;
}

export function renderGwent(data){
  const root=document.getElementById('gwent-content');
  if(!root)return;
  const gwent=data?.gwent;
  const revision=JSON.stringify([mode,selected,gwent]);
  if(revision===previous)return;
  previous=revision;
  root.replaceChildren();
  if(!gwent){
    root.append(element('p','Колоды появятся, когда игра передаст первый снимок Гвинта.','panel gwent-empty'));
    return;
  }
  const switchMode=next=>{mode=next;renderGwent(data);root.querySelector('.gwent-modes .selected')?.focus();};
  const modes=element('div','','tabs gwent-modes');
  modes.append(button('Мои колоды',mode==='decks',()=>switchMode('decks')),button('Коллекция',mode==='collection',()=>switchMode('collection')));
  root.append(modes);
  const collection=gwent.collection;
  if(mode==='collection'){
    root.append(element('p','Уникальных карт · '+collection.length,'muted'));
    root.append(...groups(collection,new Map(collection.map(card=>[card.id,card.copies]))));
    if(!collection.length)root.append(element('p','Коллекция пока пуста.','panel gwent-empty'));
    return;
  }
  const deck=gwent.decks.find(item=>item.faction===selected)||gwent.decks.find(item=>item.faction===gwent.active)||gwent.decks[0];
  if(!deck){
    root.append(element('p','Пока нет открытых колод.','panel gwent-empty'));
    return;
  }
  const deckTabs=element('div','','tabs gwent-factions');
  for(const item of gwent.decks)deckTabs.append(button(factions[item.label],item===deck,()=>{
    selected=item.faction;renderGwent(data);root.querySelector('.gwent-factions .selected')?.focus();
  }));
  const counts=new Map();
  for(const id of deck.cards)counts.set(id,(counts.get(id)||0)+1);
  if(deck.leader)counts.set(deck.leader,1);
  root.append(deckTabs,element('p','Карт в колоде · '+deck.cards.length+(deck.faction===gwent.active?' · Выбрана в игре':''),'muted'));
  root.append(...groups(collection,counts));
}
