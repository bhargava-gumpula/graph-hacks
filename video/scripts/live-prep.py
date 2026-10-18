import json,sys,re,datetime,os
# Usage: python3 live-prep.py <dir with take/> <out live.json>. take/ holds the raw transcripts, hook log, feed and events.
L=sys.argv[1]; T=L+'/take'; out=sys.argv[2]
iso=lambda s: int(datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
rel=lambda p: p.replace('/Users/bhargavagumpula/switchboard-demo/','')
first=lambda s,n=2: ' '.join(re.split(r'(?<=[.!?])\s+',s.strip())[:n])
claude=[]
hook=[l for l in open(T+'/hooklog.txt')]
for l in open(T+'/claude-session-transcript.jsonl'):
  d=json.loads(l); ty=d.get('type'); ts=d.get('timestamp')
  if not ts: continue
  t=iso(ts)
  if ty=='user':
    c=d['message']['content']
    if isinstance(c,str): claude.append({'t':t,'k':'user','s':c})
    else:
      for x in c:
        if x.get('type')=='text': claude.append({'t':t,'k':'user','s':x['text']})
        elif x.get('type')=='tool_result':
          r=x.get('content'); r=r if isinstance(r,str) else json.dumps(r)
          if 'released' in r: claude.append({'t':t,'k':'ok','s':'⎿  '+r})
  elif ty=='assistant':
    for c in d['message']['content']:
      if c['type']=='text': claude.append({'t':t,'k':'text','s':first(c['text'],3)})
      elif c['type']=='tool_use':
        n=c['name']; i=c['input']
        if n=='ToolSearch': continue
        if n.startswith('mcp__switchboard__'): claude.append({'t':t,'k':'tool','s':'switchboard - %s (MCP)(paths: %s)'%(n.split('__')[-1],json.dumps(i.get('paths')))})
        else: claude.append({'t':t,'k':'tool','s':'%s(%s)'%(n,rel(i.get('file_path','')))})
  elif ty=='attachment' and d['attachment'].get('type')=='hook_additional_context':
    s=json.dumps(d['attachment'])
    if 'is waiting on' in s:
      m=re.search(r'(cursor@main is waiting on .*?Ending your session releases it too\.)',json.loads(json.dumps(d['attachment'])).__str__())
      txt=m.group(1).replace("\\'","'") if m else ''
      txt=re.sub(r'\\+"','"',txt)
      claude.append({'t':t,'k':'notice','s':'Switchboard: '+txt})
for l in hook:
  m=re.match(r'(\S+) claude pre allow (\S+) for (\S+) \((\w+)\)',l)
  if m: claude.append({'t':iso(m.group(1)),'k':'ok','s':'⎿  Switchboard: allowed, %s %s %s'%(m.group(3),m.group(4),m.group(2))})
claude.sort(key=lambda x:x['t'])
cursor=[]
def cur(fn):
  for l in open(T+'/'+fn):
    d=json.loads(l); ty=d.get('type'); t=d.get('timestamp_ms')
    if ty=='user':
      cursor.append({'t':None,'k':'user','s':d['message']['content'][0]['text'],'fn':fn})
    elif ty=='assistant': cursor.append({'t':int(t) if t else None,'k':'text','s':first(d['message']['content'][0]['text'],3)})
    elif ty=='tool_call' and d.get('subtype')=='completed':
      tc=d['tool_call']; k=list(tc)[0]; a=tc[k].get('args',{}); r=tc[k].get('result',{}); t=int(t)
      if k=='readToolCall': cursor.append({'t':t,'k':'tool','s':'Read '+rel(a['path'])})
      elif k=='grepToolCall': cursor.append({'t':t,'k':'tool','s':'Grep '+a['pattern']})
      elif k=='globToolCall': cursor.append({'t':t,'k':'tool','s':'Glob '+a['globPattern']})
      elif k=='getMcpToolsToolCall': cursor.append({'t':t,'k':'tool','s':'List MCP tools: switchboard'})
      elif k=='editToolCall': cursor.append({'t':t,'k':'edit','s':'Edit '+rel(a['path'])+('  ✓' if 'success' in r else '  ✗')})
      elif k=='shellToolCall': cursor.append({'t':t,'k':'tool','s':'$ '+a['command'][:60]})
      elif k=='mcpToolCall':
        n=a['toolName']; args=json.dumps(a.get('args',{}).get('paths') or a.get('args',{}).get('args') or {})
        txt=''
        try: txt=r['success']['content'][0]['text']['text']
        except Exception: pass
        if n=='claim':
          cursor.append({'t':t,'k':'tool','s':'switchboard.claim(%s)'%json.dumps(a['args']['paths'])})
          cursor.append({'t':t,'k':'deny' if txt.startswith('CONFLICT') else 'ok','s':txt})
        elif n=='release':
          cursor.append({'t':t,'k':'tool','s':'switchboard.release(%s)'%json.dumps(a['args'].get('paths'))})
        else: cursor.append({'t':t,'k':'tool','s':'switchboard.'+n})
cur('cursor1.jsonl'); cur('cursor2.jsonl')
ev={l.split()[1]:int(l.split()[0]) for l in open(T+'/events.txt')}
us=[c for c in cursor if c['k']=='user']
us[0]['t']=ev['cursor_prompt1']; us[1]['t']=ev['cursor_prompt2']
# keep transcript order; times monotone
last=0
for c in cursor:
  if c['t'] is None or c['t']<last: c['t']=last
  last=c['t']
for c in cursor: c.pop('fn',None)
feed=json.load(open(T+'/feed.json'))
t0=json.load(open(T+'/t0.json'))['pageCreated']
F=lambda k:[e['at'] for e in feed if e['kind']==k]
anchors={'start':min(x['t'] for x in claude if x['k']=='user')-1500,'cursor':ev['cursor_prompt1']-500,'refused':F('conflict')[0]+2500,'released':F('release')[0]+1200,'end':max(c['t'] for c in cursor)+2500}
json.dump({'t0':t0,'anchors':anchors,'claude':claude,'cursor':cursor},open(out,'w'),indent=1,ensure_ascii=False)
print(anchors, {k:(v-anchors['start'])/1000 for k,v in anchors.items()})
for x in claude: print('C', (x['t']-anchors['start'])/1000, x['k'], x['s'][:110])
for x in cursor: print('K', (x['t']-anchors['start'])/1000, x['k'], x['s'][:110])
