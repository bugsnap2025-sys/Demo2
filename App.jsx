import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Code2, AlertOctagon, Box, Shield, CalendarCheck, Users, LineChart, Sparkles,
  Plus, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUp,
  Equal, Building2, AlertTriangle, Layers, UserPlus, Info, MessageSquare,
  ShieldAlert, Repeat2, X, Check, Send, Link2, ExternalLink, RefreshCw,
  AlertCircle, Settings as SettingsIcon, Zap, Plug, ArrowRight, FileText, Star, Copy, LogOut
} from "lucide-react";

/* ───────────────────────── tokens ───────────────────────── */
const T = {
  railBg: "#2E1A57", railActive: "#5A35A9", railIcon: "#A99BD0",
  ink: "#141625", inkSoft: "#3A3F52", label: "#6E7079", muted: "#8A8F9C",
  divider: "#EEEFF3", border: "#E4E6ED", borderDash: "#D3D6DF",
  pillBg: "#F4E7FF", pillInk: "#6F15AA", resolvedBg: "#E7F7EE", resolvedInk: "#1E8E54",
  field: "#F7F8FA", primary: "#7C3AED",
};
const JIRA = "#2684FF";
const SEV = {
  1: { label: "Sev 1", color: "#E5484D", bars: 5 }, 2: { label: "Sev 2", color: "#EE7B3C", bars: 4 },
  3: { label: "Sev 3", color: "#E0A100", bars: 3 }, 4: { label: "Sev 4", color: "#3A7BD5", bars: 2 },
  5: { label: "Sev 5", color: "#7A8194", bars: 1 },
};
const CAT = { todo: { bg: "#EEF0F4", ink: "#5A6072" }, inprogress: { bg: "#E4EEFF", ink: "#2A6BD8" }, done: { bg: "#E7F7EE", ink: "#1E8E54" } };
const PRIORITY = { Highest: { Icon: ChevronsUp, c: "#E5484D" }, High: { Icon: ChevronUp, c: "#EE7B3C" }, Medium: { Icon: Equal, c: "#E0A100" }, Low: { Icon: ChevronDown, c: "#3A7BD5" } };

const hue = (s) => { let h = 0; for (const c of s || "?") h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatarColor = (n) => `hsl(${hue(n)} 55% 45%)`;
const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ───────────────────────── api ──────────────────────────── */
async function api(path, opts) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ───────────────────────── primitives ───────────────────── */
function JiraMark({ size = 14 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 2 L21 11 L12 20 L3 11 Z" fill={JIRA} /><path d="M12 7 L16 11 L12 15 L8 11 Z" fill="#fff" opacity="0.45" /></svg>);
}
const SeverityMeter = ({ sev }) => { const s = SEV[sev]; return (<span className="sevwrap"><span className="bars">{[0,1,2,3,4].map((i)=><span key={i} className="bar" style={{background:i<s.bars?s.color:"#E7E9EE"}}/>)}</span><span className="sevlabel" style={{color:s.color}}>{s.label}</span></span>); };
const StatusPill = ({ status }) => status === "Resolved"
  ? <span className="pill" style={{background:T.resolvedBg,color:T.resolvedInk}}><Check size={13} strokeWidth={2.5}/> Resolved</span>
  : <span className="pill" style={{background:T.pillBg,color:T.pillInk}}><UserPlus size={13} strokeWidth={2.2}/> {status}</span>;
const Avatar = ({ name, size = 30 }) => <span className="avatar" style={{width:size,height:size,background:avatarColor(name),fontSize:size*0.4}}>{initials(name)}</span>;
const CatChip = ({ cat, name }) => { const c = CAT[cat]||CAT.todo; return <span className="catchip" style={{background:c.bg,color:c.ink}}>{name}</span>; };
const PriorityIcon = ({ level }) => { const p = PRIORITY[level]; if(!p) return null; const I=p.Icon; return <span className="prio" title={level} style={{color:p.c}}><I size={17} strokeWidth={2.4}/></span>; };
const PrimaryTag = () => <span className="jPrimaryTag"><Star size={10} fill="#7C3AED" strokeWidth={0}/> Primary</span>;
const SetPrimaryBtn = ({ onClick }) => <button className="jSetPrimary" onClick={onClick} title="Make this drive the incident's resolution"><Star size={12}/> Set primary</button>;

function ConnPill({ connected, compact }) {
  const m = connected ? { c: T.resolvedInk, bg: T.resolvedBg, t: "Connected" } : { c: "#E5484D", bg: "#FDECEC", t: "Not connected" };
  return <span className="connpill" style={{background:m.bg,color:m.c}}><span className="connDot" style={{background:m.c}}/>{compact?m.t:"Jira · "+m.t}</span>;
}

function Rail() {
  const items = [{icon:AlertOctagon,active:true},{icon:Box},{icon:Shield},{icon:CalendarCheck},{icon:Users},{icon:LineChart},{icon:Sparkles,label:"AI Agents"}];
  return (<nav className="rail"><div className="logo"><Code2 size={22} strokeWidth={2.4}/></div><div className="railItems">{items.map((it,i)=>{const I=it.icon;return <div key={i} className={"railItem"+(it.active?" active":"")}><I size={21} strokeWidth={2}/>{it.label&&<span className="railLabel">{it.label}</span>}</div>;})}</div><div className="railUser">VI</div></nav>);
}

/* ───────────────────────── linked jira ──────────────────── */
function EpicBlock({ ticket, primary, onSetPrimary }) {
  const [open, setOpen] = useState(false);
  const kids = ticket.children || [];
  const done = kids.filter((k) => k.statusCategory === "done").length;
  const pct = kids.length ? Math.round((done / kids.length) * 100) : 0;
  const complete = kids.length > 0 && done === kids.length;
  return (
    <div className={"jEpic"+(primary?" primary":"")}>
      <div className="jEpicHead" onClick={()=>setOpen(o=>!o)}>
        <ChevronDown size={18} className="jChev" style={{transform:open?"none":"rotate(-90deg)"}}/>
        <span className="jEpicTag">EPIC</span>
        {primary ? <PrimaryTag/> : <SetPrimaryBtn onClick={(e)=>{e.stopPropagation();onSetPrimary(ticket.key);}}/>}
        <span className="jKey">{ticket.key}</span>
        <span className="jSummary">{ticket.summary}</span>
        <div className="jRollup">
          <span className="jRollupText" style={complete?{color:T.resolvedInk}:{}}>{done} of {kids.length} resolved</span>
          <span className="jBar"><span className="jBarFill" style={{width:pct+"%"}}/></span>
        </div>
      </div>
      {open && <div className="jKids">{kids.length===0 && <div className="jKidEmpty">No sub-tasks found for this epic.</div>}{kids.map((k)=>(
        <div key={k.key} className="jKidRow"><FileText size={14} className="jKidIcon"/><span className="jKey sm">{k.key}</span><span className="jKidSummary">{k.summary}</span><PriorityIcon level={k.priority}/><Avatar name={k.assignee} size={22}/><CatChip cat={k.statusCategory} name={k.statusName}/></div>
      ))}</div>}
      {primary && kids.length>0 && <div className="jPrimaryNote">Resolves the incident when all {kids.length} sub-tasks are done.</div>}
    </div>
  );
}
function TicketRow({ ticket, primary, onSetPrimary }) {
  if (ticket.broken) return (<div className="jRow broken"><AlertCircle size={17} className="jBrokenIcon"/><span className="jKey muted">{ticket.key}</span><span className="jBrokenMsg">{ticket.summary}</span></div>);
  return (
    <div className={"jRow"+(primary?" primary":"")}>
      <span className="jKey">{ticket.key}</span>
      {primary && <PrimaryTag/>}
      <span className="jSummary">{ticket.summary}</span>
      <PriorityIcon level={ticket.priority}/>
      <Avatar name={ticket.assignee} size={24}/>
      <CatChip cat={ticket.statusCategory} name={ticket.statusName}/>
      {!primary && <SetPrimaryBtn onClick={()=>onSetPrimary(ticket.key)}/>}
    </div>
  );
}

function LinkedJira({ incident, connected, onLinkClick, onRefresh, onSetPrimary }) {
  const tickets = incident.jira || [];
  const linkable = tickets.filter((t) => !t.broken);
  if (!connected) return (
    <div className="jCard"><div className="sectionHead jHead"><span className="jHeadLeft"><JiraMark size={20}/> Linked Jira</span></div>
      <div className="jEmpty"><JiraMark size={28}/><div className="jEmptyTitle">Connect Jira to link tickets</div><div className="jEmptySub">Once connected, link real tickets to track engineering work here.</div><a className="jLinkBtn" href="/auth/login"><Plug size={15}/> Connect to Jira</a></div>
    </div>
  );
  return (
    <div className="jCard">
      <div className="sectionHead jHead">
        <span className="jHeadLeft"><JiraMark size={20}/> Linked Jira</span>
        <span className="jHeadRight"><button className="jMini" onClick={onRefresh}><RefreshCw size={13}/> Refresh</button><button className="jLinkBtn" onClick={onLinkClick}><Link2 size={15}/> Link ticket</button></span>
      </div>
      {linkable.length>1 && <div className="jLegend"><Star size={12} fill="#7C3AED" strokeWidth={0}/> The <b>&nbsp;primary&nbsp;</b> ticket drives resolution. Others are reference links.</div>}
      {tickets.length===0 ? (
        <div className="jEmpty"><JiraMark size={28}/><div className="jEmptyTitle">No Jira tickets linked</div><div className="jEmptySub">Link a real ticket from your Jira to track work for this incident.</div><button className="jLinkBtn" onClick={onLinkClick}><Link2 size={15}/> Link ticket</button></div>
      ) : (
        <div className="jList">
          {tickets.map((t)=> t.isEpic
            ? <EpicBlock key={t.key} ticket={t} primary={t.key===incident.primaryKey} onSetPrimary={onSetPrimary}/>
            : <TicketRow key={t.key} ticket={t} primary={t.key===incident.primaryKey} onSetPrimary={onSetPrimary}/>)}
          <div className="jFootRow"><span className="jSynced">Live from Jira</span></div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── link modal ───────────────────── */
function LinkModal({ incident, onClose, onLink, onCreate, busy }) {
  const [tab, setTab] = useState("existing");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [project, setProject] = useState("");
  const [issueType, setIssueType] = useState("Bug");
  const [summary, setSummary] = useState(incident.title);

  const run = async () => {
    if (!q.trim()) return; setSearching(true);
    try { const d = await api(`/api/jira/search?q=${encodeURIComponent(q)}`); setResults(d.results || []); }
    catch (e) { setResults([]); } finally { setSearching(false); }
  };
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="modalHead"><span className="modalTitle"><JiraMark size={18}/> Link Jira ticket</span><button className="iconBtn" onClick={onClose}><X size={20}/></button></div>
        <div className="modalTabs"><button className={"modalTab"+(tab==="existing"?" on":"")} onClick={()=>setTab("existing")}>Link existing</button><button className={"modalTab"+(tab==="create"?" on":"")} onClick={()=>setTab("create")}>Create new</button></div>
        {tab==="existing" ? (
          <div className="modalBody">
            <div className="searchRow"><div className="searchWrap modalSearch"><Search size={17} className="searchIcon"/><input autoFocus className="searchInput" placeholder="Type a key (OPS-123) or words from the summary" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&run()}/></div><button className="btnPrimary" onClick={run} disabled={searching}>{searching?"Searching…":"Search"}</button></div>
            <div className="resultList">
              {results.length===0 && <div className="noComments">Search your real Jira by key or summary.</div>}
              {results.map((r)=>(<div key={r.key} className="resultRow" onClick={()=>onLink(r.key)}><span className="jKey">{r.key}</span><span className="jSummary">{r.summary}</span><PriorityIcon level={r.priority}/><Avatar name={r.assignee} size={22}/><CatChip cat={r.statusCategory} name={r.statusName}/></div>))}
            </div>
            <div className="modalHint">The first ticket linked becomes the incident's <b>primary</b> — change it anytime with the star.</div>
          </div>
        ) : (
          <div className="modalBody">
            <div className="formGrid">
              <label className="fLabel">Project key</label><input className="input" placeholder="e.g. OPS" value={project} onChange={(e)=>setProject(e.target.value.toUpperCase())}/>
              <label className="fLabel">Issue type</label><select className="input" value={issueType} onChange={(e)=>setIssueType(e.target.value)}><option>Bug</option><option>Task</option><option>Story</option><option>Epic</option></select>
              <label className="fLabel">Summary</label><input className="input" value={summary} onChange={(e)=>setSummary(e.target.value)}/>
            </div>
            <div className="modalHint">Tracking several workstreams? Create an <b>Epic</b> — its sub-tasks roll up and drive resolution together. (Project key must exist in your Jira.)</div>
            <div className="modalActions"><button className="btnGhost" onClick={onClose}>Cancel</button><button className="btnPrimary" disabled={busy||!project||!summary} onClick={()=>onCreate({project,type:issueType,summary})}>{busy?"Creating…":<><Plus size={15}/> Create &amp; link</>}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── list ─────────────────────────── */
function IncidentsList({ state, onOpen, onResolve, onSettings }) {
  const [search, setSearch] = useState("");
  const [statusOpen, setStatusOpen] = useState(true);
  const rows = useMemo(()=> state.incidents.filter((it)=>{
    if (statusOpen && it.status==="Resolved") return false;
    if (search && !it.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [state.incidents, search, statusOpen]);
  return (
    <div className="page">
      {!state.connected && (
        <div className="connectBar"><div><b>Jira isn't connected yet.</b> Connect to link real tickets, resolve them, and sync comments.</div><a className="connectBtn" href="/auth/login"><Plug size={16}/> Connect to Jira</a></div>
      )}
      <div className="topbar">
        <div className="crumb"><span>oppex</span><ChevronRight size={15} className="crumbSep"/><span className="crumbBu"><Building2 size={15}/> Engg BU</span><ChevronRight size={15} className="crumbSep"/><span className="crumbCur">Incidents</span></div>
        <div className="topActions"><ConnPill connected={state.connected}/><button className="ghostBtn" onClick={onSettings}><SettingsIcon size={16}/> Jira integration</button></div>
      </div>
      <div className="headRow">
        <div><h1 className="h1">Incidents</h1><p className="sub">Manage incidents across your services</p></div>
        <div className="searchWrap"><Search size={18} className="searchIcon"/><input className="searchInput" placeholder="Search incidents…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
      </div>
      <div className="chips"><div className="chipWrap"><button className={"chip"+(statusOpen?" chipActive":"")} onClick={()=>setStatusOpen(o=>!o)}><Plus size={16} className="chipPlus"/> Status {statusOpen&&<span className="chipValue">Open</span>}{statusOpen&&<span className="chipX" onClick={(e)=>{e.stopPropagation();setStatusOpen(false);}}><X size={13}/></span>}</button></div></div>
      <div className="tableHead"><span className="cbox"/><span>Incident</span></div>
      <div className="rows">
        {rows.length===0 && <div className="empty">No open incidents. Clear the Status filter to see resolved ones.</div>}
        {rows.map((it)=>{ const tickets=(it.jira||[]).filter(t=>!t.broken); return (
          <div key={it.id} className="row">
            <span className="cbox"/>
            <div className="rowMain" onClick={()=>onOpen(it.id)}>
              <div className="rowTitleLine"><span className="rowTitle">{it.title}</span>{tickets.length>0&&<span className="jiraCount"><JiraMark size={13}/> {tickets.length}</span>}{it.pendingResolve&&<span className="needsAttn">Needs review</span>}</div>
              <div className="rowMeta"><StatusPill status={it.status}/><SeverityMeter sev={it.sev}/><span className="rowService">{it.service}</span><span className="rowTime">{it.source}</span></div>
            </div>
            <div className="rowActions"><button className="resolveBtn" disabled={it.status==="Resolved"} onClick={(e)=>{e.stopPropagation();onResolve(it.id);}}>{it.status==="Resolved"?"Resolved":"Resolve"}</button></div>
          </div>
        );})}
      </div>
    </div>
  );
}

/* ───────────────────────── detail ───────────────────────── */
const Field = ({ label, children }) => <div className="field"><div className="fieldLabel">{label}</div><div className="fieldValue">{children}</div></div>;

function IncidentDetail({ state, incident, onBack, actions }) {
  const [draft, setDraft] = useState("");
  const [showSync, setShowSync] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const tickets = incident.jira || [];
  const primary = tickets.find((t)=>t.key===incident.primaryKey) || tickets.find((t)=>!t.broken);
  const hasTickets = tickets.some((t)=>!t.broken);
  const canOut = ["two-way","oppex-to-jira"].includes(state.settings.syncMode);
  const [postToJira, setPostToJira] = useState(true);
  const comments = state.commentsById[incident.id] || [];
  const events = state.eventsById[incident.id] || [];
  const timeline = [{ tone:"danger", text:`Incident triggered through “${incident.source}”`, time:"start" }, ...events];
  const shown = showSync ? timeline : timeline.filter((e)=>e.tone!=="jira");
  const pending = incident.pendingResolve;

  const submit = async () => { if(!draft.trim())return; await actions.comment(incident.id, draft.trim(), hasTickets&&canOut&&postToJira); setDraft(""); };
  const wrap = (fn) => async (...a) => { setBusy(true); try{ await fn(...a); } finally { setBusy(false); } };

  return (
    <div className="detail">
      {modal && <LinkModal incident={incident} busy={busy} onClose={()=>setModal(false)}
        onLink={wrap(async(key)=>{ await actions.link(incident.id,key); setModal(false); })}
        onCreate={wrap(async(form)=>{ await actions.createTicket(incident.id,form); setModal(false); })}/>}

      <div className="detailTop">
        <button className="backBtn" onClick={onBack}><ChevronLeft size={18}/> Back to Incidents</button>
        <span className="detailDivider"/><span className="detailId">#{incident.id}</span>
        <div className="detailTopRight"><ConnPill connected={state.connected}/></div>
      </div>

      <div className="detailTitleRow"><h1 className="detailTitle">{incident.title}</h1>
        <div className="detailTitleActions"><button className="resolveBtn lg" disabled={incident.status==="Resolved"||busy} onClick={wrap(()=>actions.resolve(incident.id))}>{incident.status==="Resolved"?"Resolved":busy?"Resolving…":"Resolve"}</button></div>
      </div>

      {pending && (
        <div className="resolvePrompt"><span className="rpIcon"><JiraMark size={20}/></span>
          <div className="rpBody"><div className="rpTitle">{pending.reason} in Jira — resolve this incident?</div><div className="rpSub">A change in Jira can close this incident. Because that's the high-impact direction, Oppex asks before it flips state.</div></div>
          <div className="rpBtns"><button className="btnGhost" onClick={wrap(()=>actions.dismissResolve(incident.id))}>Keep open</button><button className="rpResolve" onClick={wrap(()=>actions.confirmResolve(incident.id))}><Check size={15}/> Resolve incident</button></div>
        </div>
      )}

      <div className="detailGrid">
        <div className="detailLeft">
          <div className="sectionHead"><AlertTriangle size={19}/> Incident Details</div>
          <Field label="Incident Type"><span className="withIcon"><Layers size={18} className="dim"/> {incident.type}</span></Field>
          <Field label="Current Status"><StatusPill status={incident.status}/></Field>
          <Field label="Severity"><SeverityMeter sev={incident.sev}/></Field>
          <Field label="Service">{incident.service}</Field>
          <Field label="Source">{incident.source}</Field>

          <div style={{marginTop:26}}/>
          <LinkedJira incident={incident} connected={state.connected} onLinkClick={()=>setModal(true)} onRefresh={wrap(()=>actions.refresh(incident.id))} onSetPrimary={(k)=>actions.setPrimary(incident.id,k)}/>

          <div className="sectionHead mt"><MessageSquare size={19}/> Comments</div>
          <div className="commentList">
            {comments.length===0 && <div className="noComments">No comments yet. Add the first update.</div>}
            {comments.map((c,i)=>(<div key={i} className="comment"><Avatar name={c.author} size={30}/><div className="commentMain"><div className="commentMeta"><b>{c.author}</b>{c.origin==="jira"&&<span className="viaJira"><JiraMark size={11}/> via Jira</span>}<span>{c.time}</span></div><div className="commentBody">{c.text}</div>{c.synced&&<div className="syncedTo"><JiraMark size={11}/> Synced to {c.synced}</div>}</div></div>))}
          </div>
          <div className="commentBox"><input className="commentInput" placeholder="Add a comment…" value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submit()}/><button className="sendBtn" disabled={!draft.trim()} onClick={submit}><Send size={16}/></button></div>
          {hasTickets && <label className={"postToggle"+(canOut?"":" disabled")}><span className={"switch"+(postToJira&&canOut?" on":"")} onClick={()=>canOut&&setPostToJira(p=>!p)}><span className="knob"/></span><JiraMark size={13}/>{canOut?<>Also post this comment to the primary ticket{primary?<> (<b>{primary.key}</b>)</>:""}</>:"Comment sync is off in this mode (Jira → Oppex only)"}</label>}
        </div>

        <div className="detailRight">
          <div className="timelineHead"><div className="tlHeadTop"><div><h2 className="timelineTitle">Activity Timeline</h2><p className="timelineSub">Captures every incident action</p></div><label className="syncToggle"><input type="checkbox" checked={showSync} onChange={(e)=>setShowSync(e.target.checked)}/> Show sync events</label></div></div>
          <div className="timeline">{shown.map((ev,i)=>{const tone=ev.tone==="danger"?{bg:"#FDECEC",c:"#E5484D"}:ev.tone==="jira"?{bg:"#E4EEFF",c:JIRA}:{bg:"#EFE7FF",c:"#7C3AED"};return (
            <div key={i} className="tlItem"><div className="tlLine"><span className="tlDot" style={{background:tone.bg,color:tone.c}}>{ev.tone==="danger"?<ShieldAlert size={18}/>:ev.tone==="jira"?<JiraMark size={17}/>:<Repeat2 size={18}/>}</span>{i<shown.length-1&&<span className="tlConnector"/>}</div><div className="tlBody"><div className="tlText">{ev.text}</div>{ev.sub&&<div className="tlSub">{ev.sub}</div>}</div><div className="tlTime">{ev.time}</div></div>
          );})}</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── settings ─────────────────────── */
function ModeCard({ id, title, desc, sentence, active, onPick }) {
  return (<div className={"modeCard"+(active?" on":"")} onClick={()=>onPick(id)}><div className="modeTop"><span className={"radio"+(active?" on":"")}>{active&&<span className="radioDot"/>}</span><span className="modeTitle">{title}</span></div><div className="modeDesc">{desc}</div>{active&&<div className="modeSentence"><ArrowRight size={14}/> {sentence}</div>}</div>);
}
function Settings({ state, onBack, onSettings }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(state.webhookUrl); setCopied(true); setTimeout(()=>setCopied(false),1500); };
  const sm = state.settings.syncMode;
  return (
    <div className="settings">
      <div className="detailTop"><button className="backBtn" onClick={onBack}><ChevronLeft size={18}/> Back to Incidents</button><span className="detailDivider"/><span className="detailId"><JiraMark size={16}/> Jira integration settings</span><div className="detailTopRight"><ConnPill connected={state.connected}/></div></div>
      <div className="setBody">
        <section className="setSection">
          <h2 className="setH2"><Plug size={19}/> Connection</h2>
          {state.connected ? (
            <div className="connRow"><ConnPill connected/><span className="connMeta">Connected to {state.site}</span><div className="connBtns"><button className="btnGhost" onClick={async()=>{await api("/auth/logout",{method:"POST"});onSettings({});location.reload();}}><LogOut size={14}/> Disconnect</button></div></div>
          ) : (
            <div className="connRow"><ConnPill connected={false}/><span className="connMeta">Connect to start using your real Jira.</span><div className="connBtns"><a className="btnPrimary" href="/auth/login"><Plug size={14}/> Connect to Jira</a></div></div>
          )}
        </section>

        <section className="setSection">
          <h2 className="setH2"><Repeat2 size={19}/> Inbound webhook (Jira → Oppex)</h2>
          <p className="setSub">To let Jira changes flow back (auto-resolve), add this URL as a webhook in your Jira admin settings, for "Issue updated" and "Comment created" events.</p>
          <div className="webhookRow"><code className="webhookUrl">{state.webhookUrl}</code><button className="btnGhost" onClick={copy}><Copy size={14}/> {copied?"Copied":"Copy"}</button></div>
          <div className="setNote"><AlertCircle size={14}/> In Jira: Settings → System → WebHooks → Create. Paste this URL, tick "Issue: updated" and "Comment: created", save. (The deploy guide has click-by-click steps.)</div>
        </section>

        <section className="setSection">
          <h2 className="setH2"><ArrowRight size={19}/> Sync flow mode</h2>
          <p className="setSub">Which system is the source of truth. Resolution is driven by each incident's <b>primary</b> ticket (an Epic resolves when its sub-tasks complete).</p>
          <div className="modeGrid">
            <ModeCard id="two-way" title="Two-way sync" desc="Changes flow both directions." sentence="Resolving in Oppex moves the primary to Done — and closing it in Jira asks Oppex to resolve." active={sm==="two-way"} onPick={(v)=>onSettings({syncMode:v})}/>
            <ModeCard id="jira-to-oppex" title="Jira drives" desc="Jira is the source of truth." sentence="Closing the primary in Jira asks Oppex to resolve. Oppex never writes to Jira." active={sm==="jira-to-oppex"} onPick={(v)=>onSettings({syncMode:v})}/>
            <ModeCard id="oppex-to-jira" title="Oppex drives" desc="Oppex is the source of truth." sentence="Resolving in Oppex moves the primary to Done. Jira changes don't flow back." active={sm==="oppex-to-jira"} onPick={(v)=>onSettings({syncMode:v})}/>
          </div>
        </section>

        <section className="setSection">
          <h2 className="setH2"><Zap size={19}/> Inbound auto-resolve</h2>
          <p className="setSub">When a developer closes the primary ticket in Jira, the high-impact direction:</p>
          <label className="bigToggle"><span className={"switch"+(state.settings.autoResolveConfirm?" on":"")} onClick={()=>onSettings({autoResolveConfirm:!state.settings.autoResolveConfirm})}><span className="knob"/></span>Ask a human before resolving (recommended)</label>
          <div className="setNote"><AlertCircle size={14}/> With this off, a closed primary resolves the incident automatically. With it on, you get a confirm prompt first.</div>
        </section>
      </div>
    </div>
  );
}

/* ───────────────────────── app ──────────────────────────── */
export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState(null);

  const fire = (m) => { setToast(m); setTimeout(()=>setToast(null), 2600); };
  const fail = (e) => { setErr(e.message || String(e)); setTimeout(()=>setErr(null), 4000); };

  const refreshState = useCallback(async () => {
    try { const d = await api("/api/state"); setState(d); } catch (e) { /* keep last */ }
  }, []);

  useEffect(() => { refreshState(); const t = setInterval(refreshState, 4000); return () => clearInterval(t); }, [refreshState]);

  const act = async (fn, okMsg) => { try { await fn(); await refreshState(); if (okMsg) fire(okMsg); } catch (e) { fail(e); await refreshState(); } };

  const actions = {
    link: (id, key) => act(() => api(`/api/incidents/${id}/link`, { method:"POST", body: JSON.stringify({ key }) }), `Linked ${key}`),
    createTicket: (id, form) => act(() => api(`/api/incidents/${id}/create-ticket`, { method:"POST", body: JSON.stringify(form) }), "Created & linked in Jira"),
    setPrimary: (id, key) => act(() => api(`/api/incidents/${id}/primary`, { method:"POST", body: JSON.stringify({ key }) }), `${key} is now primary`),
    refresh: (id) => act(() => api(`/api/incidents/${id}/refresh`, { method:"POST" }), "Refreshed from Jira"),
    resolve: (id) => act(() => api(`/api/incidents/${id}/resolve`, { method:"POST" }), "Resolved"),
    confirmResolve: (id) => act(() => api(`/api/incidents/${id}/confirm-resolve`, { method:"POST" }), "Resolved (confirmed)"),
    dismissResolve: (id) => act(() => api(`/api/incidents/${id}/dismiss-resolve`, { method:"POST" }), "Kept open"),
    comment: (id, text, toJira) => act(() => api(`/api/incidents/${id}/comment`, { method:"POST", body: JSON.stringify({ text, toJira }) })),
  };
  const saveSettings = (patch) => act(() => api("/api/settings", { method:"POST", body: JSON.stringify(patch) }));

  if (!state) return (<div className="app"><style>{CSS}</style><Rail/><main className="content"><div className="loading">Loading Oppex…</div></main></div>);

  const selected = state.incidents.find((i)=>i.id===selectedId);

  return (
    <div className="app">
      <style>{CSS}</style>
      <Rail/>
      <main className="content">
        {view==="list" && <IncidentsList state={state} onOpen={(id)=>{setSelectedId(id);setView("detail");}} onResolve={(id)=>actions.resolve(id)} onSettings={()=>setView("settings")}/>}
        {view==="detail" && selected && <IncidentDetail state={state} incident={selected} onBack={()=>setView("list")} actions={actions}/>}
        {view==="settings" && <Settings state={state} onBack={()=>setView(selectedId?"detail":"list")} onSettings={saveSettings}/>}
      </main>
      {toast && <div className="toast">{toast}</div>}
      {err && <div className="toast err">{err}</div>}
    </div>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.app{display:flex;height:100vh;width:100%;overflow:hidden;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${T.ink};background:#fff;-webkit-font-smoothing:antialiased}
.content{flex:1;overflow-y:auto}
.loading{padding:60px 40px;color:${T.muted};font-size:16px}
.rail{width:80px;flex-shrink:0;background:${T.railBg};display:flex;flex-direction:column;align-items:center;padding:18px 0 16px}
.logo{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#7C4DFF,#5A35A9);display:flex;align-items:center;justify-content:center;color:#fff;margin-bottom:26px}
.railItems{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1}
.railItem{width:48px;height:48px;border-radius:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:${T.railIcon};cursor:pointer;transition:.15s}
.railItem:hover{background:rgba(255,255,255,.07);color:#fff}.railItem.active{background:${T.railActive};color:#fff}
.railLabel{font-size:9px;font-weight:500}
.railUser{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#A78BFA,#7C5CFC);color:#fff;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center}
.page{padding:26px 34px 40px;display:flex;flex-direction:column;min-height:100%}
.connectBar{display:flex;align-items:center;justify-content:space-between;gap:16px;background:#F3EEFF;border:1px solid #E2D4FB;border-radius:14px;padding:14px 20px;margin-bottom:20px;font-size:14.5px;color:${T.inkSoft}}
.connectBtn,.connectBar a{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:10px;background:${JIRA};color:#fff;font-weight:600;font-size:14.5px;text-decoration:none;cursor:pointer}
.connectBtn:hover{background:#1a6fe0}
.topbar{display:flex;justify-content:space-between;align-items:center}
.crumb{display:flex;align-items:center;gap:8px;color:${T.label};font-size:15px;font-weight:500}
.crumbSep{color:#C4C8D2}.crumbBu{display:flex;align-items:center;gap:6px}.crumbCur{color:${T.inkSoft};font-weight:600}
.topActions{display:flex;align-items:center;gap:16px}
.ghostBtn{display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-size:15px;font-weight:600;color:${T.inkSoft};font-family:inherit}
.ghostBtn:hover{color:${JIRA}}
.headRow{display:flex;align-items:flex-start;gap:24px;margin-top:16px}
.h1{font-size:30px;font-weight:700;letter-spacing:-.02em}.sub{color:${T.label};font-size:15px;margin-top:4px}
.searchWrap{flex:1;max-width:560px;position:relative;margin-top:4px}
.searchIcon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:${T.muted}}
.searchInput{width:100%;height:48px;border:1px solid ${T.border};border-radius:12px;padding:0 16px 0 46px;font-size:15px;font-family:inherit;outline:none}
.searchInput:focus{border-color:${T.railActive};box-shadow:0 0 0 3px rgba(90,53,169,.12)}
.chips{display:flex;gap:14px;margin-top:22px}.chipWrap{position:relative}
.chip{display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:1.5px dashed ${T.borderDash};border-radius:12px;background:#fff;font-size:15px;font-weight:500;color:${T.inkSoft};cursor:pointer;font-family:inherit}
.chip:hover{border-color:${T.railActive}}.chipActive{border-style:solid;border-color:${T.border}}.chipPlus{color:${T.muted}}
.chipValue{background:${T.pillBg};color:${T.pillInk};font-weight:600;font-size:13px;padding:3px 10px;border-radius:8px}
.chipX{display:flex;color:${T.muted};border-radius:6px;padding:2px}.chipX:hover{background:#F0F1F4;color:${T.ink}}
.tableHead{display:flex;align-items:center;gap:18px;padding:22px 4px 16px;margin-top:8px;border-bottom:1px solid ${T.divider};color:${T.label};font-size:16px;font-weight:600}
.cbox{width:20px;height:20px;border:1.5px solid ${T.borderDash};border-radius:6px;flex-shrink:0}
.rows{flex:1}
.row{display:flex;align-items:flex-start;gap:18px;padding:22px 4px;border-bottom:1px solid ${T.divider}}
.row:hover{background:#FBFAFE}.rowMain{flex:1;cursor:pointer}
.rowTitleLine{display:flex;align-items:center;gap:12px}
.rowTitle{font-size:18px;font-weight:600;letter-spacing:-.01em}.rowMain:hover .rowTitle{color:${T.railActive}}
.jiraCount{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:${JIRA};background:#EAF2FF;padding:2px 9px;border-radius:7px}
.needsAttn{font-size:12px;font-weight:700;color:#B26A00;background:#FFF4E0;padding:2px 9px;border-radius:7px}
.rowMeta{display:flex;align-items:center;gap:38px;margin-top:13px}
.rowService{color:${T.inkSoft};font-size:15px;min-width:150px}.rowTime{color:${T.inkSoft};font-size:15px}
.rowActions{display:flex;align-items:center;gap:10px;padding-top:2px}
.pill{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 13px;border-radius:999px;font-size:13.5px;font-weight:600}
.sevwrap{display:inline-flex;align-items:center;gap:10px;min-width:96px}.bars{display:inline-flex;gap:3px}.bar{width:6px;height:18px;border-radius:2px}.sevlabel{font-size:15px;font-weight:600}
.avatar{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:600;flex-shrink:0}
.withIcon{display:inline-flex;align-items:center;gap:11px}.dim{color:${T.muted}}
.resolveBtn{height:44px;padding:0 22px;border:1px solid ${T.border};border-radius:11px;background:#fff;font-size:15px;font-weight:600;color:${T.inkSoft};cursor:pointer;font-family:inherit}
.resolveBtn:hover:not(:disabled){border-color:${T.railActive};color:${T.railActive}}
.resolveBtn:disabled{color:${T.resolvedInk};background:${T.resolvedBg};border-color:transparent;cursor:default}
.resolveBtn.lg{height:48px;padding:0 26px}
.empty,.noComments,.jKidEmpty{color:${T.muted};font-size:15px;padding:30px 4px}
.detail{padding:20px 34px 60px}
.detailTop{display:flex;align-items:center;gap:18px;padding-bottom:18px;border-bottom:1px solid ${T.divider}}
.backBtn{display:flex;align-items:center;gap:6px;background:none;border:none;font-size:17px;font-weight:600;color:${T.inkSoft};cursor:pointer;font-family:inherit}
.backBtn:hover{color:${T.railActive}}
.detailDivider{width:1px;height:22px;background:${T.border}}
.detailId{display:inline-flex;align-items:center;gap:8px;font-size:17px;font-weight:600}
.detailTopRight{margin-left:auto;display:flex;align-items:center;gap:10px}
.detailTitleRow{display:flex;align-items:center;gap:24px;padding:26px 0 8px}
.detailTitle{font-size:27px;font-weight:700;letter-spacing:-.02em;flex:1}
.resolvePrompt{display:flex;align-items:center;gap:16px;background:#FFF8EC;border:1px solid #FAE2B5;border-radius:14px;padding:16px 20px;margin:18px 0 4px}
.rpIcon{flex-shrink:0;display:flex}.rpBody{flex:1;min-width:0}
.rpTitle{font-size:16px;font-weight:700}.rpSub{font-size:13.5px;color:${T.inkSoft};margin-top:3px;line-height:1.45}
.rpBtns{display:flex;gap:10px;flex-shrink:0}
.rpResolve{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 18px;border:none;border-radius:10px;background:${T.resolvedInk};color:#fff;font-size:14.5px;font-weight:600;cursor:pointer;font-family:inherit}
.rpResolve:hover{background:#18794a}
.detailGrid{display:grid;grid-template-columns:1.35fr 1fr;gap:54px;margin-top:14px}
.detailLeft{min-width:0}
.sectionHead{display:flex;align-items:center;gap:11px;font-size:20px;font-weight:700;padding:18px 0 8px}.sectionHead.mt{margin-top:30px}
.field{display:grid;grid-template-columns:200px 1fr;align-items:center;padding:18px 0;border-bottom:1px solid ${T.divider}}
.fieldLabel{color:${T.label};font-size:16px}.fieldValue{font-size:16px;font-weight:500}
.jCard{border:1px solid ${T.border};border-radius:16px;padding:6px 20px 20px}
.jHead{justify-content:space-between;display:flex;align-items:center}
.jHeadLeft{display:flex;align-items:center;gap:11px}.jHeadRight{display:flex;align-items:center;gap:10px}
.jMini{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid ${T.border};border-radius:9px;background:#fff;font-size:13px;font-weight:600;color:${T.inkSoft};cursor:pointer;font-family:inherit}
.jMini:hover{border-color:${JIRA};color:${JIRA}}
.jLinkBtn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border:none;border-radius:9px;background:${JIRA};color:#fff;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none}
.jLinkBtn:hover{background:#1a6fe0}
.jLegend{display:flex;align-items:center;gap:5px;font-size:12.5px;color:${T.label};margin:0 0 12px}.jLegend b{color:${T.primary};font-weight:700}
.jList{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.jRow{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid ${T.divider};border-radius:11px;background:${T.field}}
.jRow.primary{border-color:#E0D4FB;background:#FBF9FF;box-shadow:inset 3px 0 0 ${T.primary}}
.jRow.broken{background:#FDF3F3;border-color:#F6D9D9}
.jKey{font-size:14px;font-weight:700;color:${JIRA};white-space:nowrap}.jKey.sm{font-size:13px}.jKey.muted{color:${T.muted}}
.jPrimaryTag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:.05em;color:${T.primary};background:#EFE7FF;padding:3px 8px;border-radius:6px;white-space:nowrap}
.jSetPrimary{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:${T.muted};background:none;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;padding:3px 7px;border-radius:7px}
.jSetPrimary:hover{color:${T.primary};background:#F3EEFF}
.jSummary{flex:1;font-size:14.5px;color:${T.inkSoft};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.prio{display:inline-flex}.catchip{font-size:12px;font-weight:700;padding:4px 10px;border-radius:7px;white-space:nowrap}
.jBrokenIcon{color:#E5484D;flex-shrink:0}.jBrokenMsg{flex:1;font-size:13.5px;color:#B04A4A}
.jEpic{border:1px solid ${T.divider};border-radius:11px;overflow:hidden}
.jEpic.primary{border-color:#E0D4FB;box-shadow:inset 3px 0 0 ${T.primary}}
.jEpicHead{display:flex;align-items:center;gap:11px;padding:12px 14px;background:#F3EEFF;cursor:pointer}
.jChev{color:${T.muted};transition:.18s;flex-shrink:0}
.jEpicTag{font-size:10px;font-weight:800;letter-spacing:.06em;color:#7C3AED;background:#E6DBFF;padding:3px 7px;border-radius:5px}
.jRollup{display:flex;align-items:center;gap:10px;margin-left:auto}
.jRollupText{font-size:12.5px;font-weight:600;color:${T.inkSoft};white-space:nowrap}
.jBar{width:90px;height:7px;border-radius:99px;background:#E2DAF5;overflow:hidden}
.jBarFill{display:block;height:100%;background:${T.resolvedInk};border-radius:99px;transition:width .4s}
.jKids{padding:4px 8px 8px}.jKidRow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px}.jKidRow:hover{background:${T.field}}
.jKidIcon{color:${T.muted};flex-shrink:0}.jKidSummary{flex:1;font-size:13.5px;color:${T.inkSoft};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jPrimaryNote{font-size:12px;color:${T.primary};background:#F6F2FE;padding:8px 14px;border-top:1px solid #EDE6FB;font-weight:500}
.jFootRow{display:flex;align-items:center;justify-content:space-between;margin-top:8px}.jSynced{font-size:12.5px;color:${T.muted}}
.jEmpty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:30px 20px}
.jEmptyTitle{font-size:16px;font-weight:700;margin-top:4px}.jEmptySub{font-size:14px;color:${T.label};max-width:360px;margin-bottom:6px}
.connpill{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:600}
.connDot{width:8px;height:8px;border-radius:50%}
.commentList{display:flex;flex-direction:column;gap:18px;padding:10px 0}
.comment{display:flex;gap:12px}.commentMain{min-width:0}
.commentMeta{display:flex;align-items:center;gap:9px;font-size:14px;color:${T.label}}.commentMeta b{color:${T.ink}}
.viaJira{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${JIRA};background:#EAF2FF;padding:2px 7px;border-radius:6px}
.commentBody{font-size:15px;color:${T.inkSoft};margin-top:4px}
.syncedTo{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${JIRA};margin-top:5px;font-weight:600}
.commentBox{display:flex;gap:10px;margin-top:14px}
.commentInput{flex:1;height:48px;border:1px solid ${T.border};border-radius:12px;padding:0 16px;font-size:15px;font-family:inherit;outline:none}
.commentInput:focus{border-color:${T.railActive};box-shadow:0 0 0 3px rgba(90,53,169,.12)}
.sendBtn{width:48px;height:48px;border-radius:12px;border:none;background:${T.railActive};color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.sendBtn:disabled{opacity:.4;cursor:default}
.postToggle{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:13.5px;color:${T.inkSoft};font-weight:500}
.postToggle.disabled{color:${T.muted}}.postToggle b{color:${JIRA};font-weight:700}
.switch{width:38px;height:22px;border-radius:99px;background:#D6D9E2;position:relative;cursor:pointer;transition:.18s;flex-shrink:0}
.switch.on{background:${JIRA}}.knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}.switch.on .knob{left:18px}
.detailRight{border-left:1px solid ${T.divider};padding-left:54px}
.timelineHead{padding-bottom:22px;border-bottom:1px solid ${T.divider}}
.tlHeadTop{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.timelineTitle{font-size:23px;font-weight:700}.timelineSub{color:${T.label};font-size:15px;margin-top:6px}
.syncToggle{display:flex;align-items:center;gap:7px;font-size:13px;color:${T.inkSoft};font-weight:500;cursor:pointer;white-space:nowrap;margin-top:4px}
.syncToggle input{accent-color:${T.railActive};width:15px;height:15px}
.timeline{padding-top:30px}
.tlItem{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:start}
.tlLine{display:flex;flex-direction:column;align-items:center}
.tlDot{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tlConnector{width:2px;flex:1;min-height:36px;background:${T.border};margin:4px 0}
.tlBody{padding-top:9px;padding-bottom:14px}.tlText{font-size:16px;font-weight:700}.tlSub{font-size:13.5px;color:${T.label};margin-top:4px}
.tlTime{text-align:right;padding-top:9px;font-size:13px;color:${T.muted};white-space:nowrap}
.modalOverlay{position:fixed;inset:0;background:rgba(20,22,37,.45);display:flex;align-items:center;justify-content:center;z-index:60}
.modal{width:620px;max-width:92vw;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(20,22,37,.3);overflow:hidden}
.modalHead{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 16px}
.modalTitle{display:flex;align-items:center;gap:9px;font-size:18px;font-weight:700}
.iconBtn{width:40px;height:40px;border-radius:10px;border:none;background:none;color:${T.muted};display:flex;align-items:center;justify-content:center;cursor:pointer}
.iconBtn:hover{background:${T.field};color:${T.ink}}
.modalTabs{display:flex;gap:6px;padding:0 22px;border-bottom:1px solid ${T.divider}}
.modalTab{background:none;border:none;padding:10px 4px;margin-right:18px;font-size:15px;font-weight:600;color:${T.muted};cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.modalTab.on{color:${T.ink};border-bottom-color:${JIRA}}
.modalBody{padding:20px 22px 24px}
.searchRow{display:flex;gap:10px}.modalSearch{max-width:none;margin-top:0;flex:1}
.resultList{margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto}
.resultRow{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid ${T.divider};border-radius:11px;cursor:pointer}
.resultRow:hover{border-color:${JIRA};background:#F7FAFF}
.formGrid{display:grid;grid-template-columns:130px 1fr;gap:14px 16px;align-items:center}
.fLabel{font-size:14px;color:${T.label};font-weight:500}
.input{height:42px;border:1px solid ${T.border};border-radius:10px;padding:0 12px;font-size:14.5px;font-family:inherit;background:#fff;outline:none;width:100%}
.input:focus{border-color:${T.railActive};box-shadow:0 0 0 3px rgba(90,53,169,.1)}
.modalHint{font-size:12.5px;color:${T.label};margin-top:14px;line-height:1.5;background:${T.field};padding:11px 13px;border-radius:9px}.modalHint b{color:${T.primary}}
.modalActions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.btnGhost{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 18px;border:1px solid ${T.border};border-radius:10px;background:#fff;font-size:14.5px;font-weight:600;color:${T.inkSoft};cursor:pointer;font-family:inherit;text-decoration:none}
.btnGhost:hover{border-color:${T.railActive}}
.btnPrimary{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 18px;border:none;border-radius:10px;background:${JIRA};color:#fff;font-size:14.5px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none}
.btnPrimary:hover{background:#1a6fe0}.btnPrimary:disabled{opacity:.5;cursor:default}
.settings{padding:20px 34px 70px;max-width:1080px}
.setBody{margin-top:8px}.setSection{padding:28px 0;border-bottom:1px solid ${T.divider}}
.setH2{display:flex;align-items:center;gap:11px;font-size:21px;font-weight:700}
.setSub{color:${T.label};font-size:15px;margin-top:7px;max-width:780px;line-height:1.5}
.connRow{display:flex;align-items:center;gap:16px;margin-top:18px;flex-wrap:wrap}.connMeta{font-size:13.5px;color:${T.muted}}.connBtns{display:flex;gap:10px;margin-left:auto}
.webhookRow{display:flex;align-items:center;gap:10px;margin-top:16px}
.webhookUrl{flex:1;font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:13.5px;background:${T.field};border:1px solid ${T.border};border-radius:10px;padding:12px 14px;color:${T.inkSoft};overflow-x:auto;white-space:nowrap}
.setNote{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;color:${T.label};margin-top:14px;max-width:780px;line-height:1.5}
.setNote svg{margin-top:2px;flex-shrink:0;color:#B26A00}
.modeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.modeCard{border:1.5px solid ${T.border};border-radius:14px;padding:18px;cursor:pointer;transition:.15s}
.modeCard:hover{border-color:${JIRA}}.modeCard.on{border-color:${JIRA};box-shadow:0 0 0 3px rgba(38,132,255,.12)}
.modeTop{display:flex;align-items:center;gap:10px}
.radio{width:20px;height:20px;border:2px solid ${T.borderDash};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}.radio.on{border-color:${JIRA}}.radioDot{width:10px;height:10px;border-radius:50%;background:${JIRA}}
.modeTitle{font-size:16px;font-weight:700}.modeDesc{font-size:13.5px;color:${T.label};margin-top:10px;line-height:1.5}
.modeSentence{display:flex;align-items:flex-start;gap:7px;font-size:13.5px;font-weight:600;color:${JIRA};background:#EAF2FF;padding:10px 12px;border-radius:9px;margin-top:14px;line-height:1.45}.modeSentence svg{margin-top:2px;flex-shrink:0}
.bigToggle{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:15.5px;font-weight:600}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:${T.ink};color:#fff;padding:13px 22px;border-radius:12px;font-size:14.5px;font-weight:500;box-shadow:0 10px 30px rgba(20,22,37,.25);z-index:80;max-width:90vw;text-align:center}
.toast.err{background:#B4242A;bottom:78px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
