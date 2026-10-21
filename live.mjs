// Supabase Realtime protocol 1.0: one public, read-only Postgres subscription.
export function applyPatch(current,patch){
  if(!current||patch.baseRevision!==current.revision)return null;
  const quests=new Map(current.document.data.quests.map(q=>[q.id,q]));
  for(const id of patch.removed||[])quests.delete(id);
  for(const q of patch.quests||[])quests.set(q.id,q);
  return {revision:patch.revision,document:{...current.document,modified:patch.modified,data:{...patch.data,quests:[...quests.values()]}}};
}
export function watchProgress(config,onSnapshot,onError){
  let current=null,socket=null,heartbeat=null,reconnect=null,stopped=false,ref=0,retry=1000,fetching=null,lastBeat=0;
  const topic='realtime:witcher-progress';
  const headers={apikey:config.publishableKey};
  const get=async path=>{const r=await fetch(config.url+'/rest/v1/'+path,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Progress unavailable');return r.json();};
  async function refresh(){if(fetching)return fetching;fetching=(async()=>{const rows=await get('witcher_state?channel=eq.flex1ka&select=revision,document');if(!rows[0])throw Error('No snapshot');if(!current||rows[0].revision>=current.revision){current=rows[0];onSnapshot(current.document);}})().catch(()=>onError()).finally(()=>fetching=null);return fetching;}
  async function receive(patch){if(current&&patch.revision<=current.revision)return;const next=applyPatch(current,patch);if(next){current=next;onSnapshot(next.document);}else await refresh();}
  const send=(event,payload={},target=topic)=>{if(socket?.readyState===1)socket.send(JSON.stringify({topic:target,event,payload,ref:String(++ref),join_ref:'1'}));};
  function connect(){if(stopped)return;socket=new WebSocket(config.url.replace('https:','wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(config.publishableKey)+'&vsn=1.0.0');
    socket.onopen=()=>{ref=0;lastBeat=Date.now();send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[{event:'*',schema:'public',table:'witcher_updates',filter:'channel=eq.flex1ka'}],private:false}});heartbeat=setInterval(()=>{if(Date.now()-lastBeat>60000){socket.close();return;}send('heartbeat',{},'phoenix');},25000);};
    socket.onmessage=async e=>{let m;try{m=JSON.parse(e.data);}catch{return;}lastBeat=Date.now();
      if(m.event==='phx_reply'&&m.ref==='1'){if(m.payload.status==='ok'){retry=1000;await refresh();}else socket.close();}
      if(m.event==='system'&&m.payload?.status==='ok')await refresh();
      if(m.event==='postgres_changes'&&m.payload?.data?.record?.patch)await receive(m.payload.data.record.patch);
      if(m.event==='phx_error'||m.event==='phx_close')socket.close();
    };
    socket.onerror=()=>socket.close();socket.onclose=()=>{clearInterval(heartbeat);if(!stopped){onError();reconnect=setTimeout(connect,retry);retry=Math.min(30000,retry*2);}};
  }
  // Low-bandwidth recovery check also handles tab suspension and missed messages.
  const fallback=setInterval(async()=>{try{const rows=await get('witcher_updates?channel=eq.flex1ka&select=revision,patch');if(rows[0]&&(!current||rows[0].revision>current.revision))await receive(rows[0].patch);}catch{onError();}},30000);
  refresh();connect();
  return ()=>{stopped=true;clearInterval(fallback);clearInterval(heartbeat);clearTimeout(reconnect);socket?.close();};
}
