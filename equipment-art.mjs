import {files,ids,names} from './equipment-icons.mjs?v=73c5378b9bf7';

const normalize=value=>String(value??'').trim().normalize('NFC').toLowerCase();
const chunks=new Map();

export function equipmentIconKey(item){
  const id=normalize(item.id), name=normalize(item.slot)+'|'+normalize(item.title);
  return Object.hasOwn(ids,id)?ids[id]:Object.hasOwn(names,name)?names[name]:null;
}

export async function loadEquipmentIcon(item){
  const entry=equipmentIconKey(item);
  if(!entry)return null;
  const [group,key]=entry;
  if(!chunks.has(group)){
    chunks.set(group,import(`./assets/equipment/${files[group]}`).catch(()=>{chunks.delete(group);return null;}));
  }
  return (await chunks.get(group))?.default[key]??null;
}
