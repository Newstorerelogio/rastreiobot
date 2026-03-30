// pages/index.js
import { useState, useEffect } from "react";

const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const STATUS_CONFIG = {
  em_transito:  { bg:"#dbeafe", color:"#1d4ed8", icon:"🚚", label:"Em trânsito" },
  entregue:     { bg:"#dcfce7", color:"#15803d", icon:"✅", label:"Entregue" },
  saiu_entrega: { bg:"#fef9c3", color:"#a16207", icon:"📬", label:"Saiu p/ entrega" },
  aguardando:   { bg:"#f1f5f9", color:"#475569", icon:"⏳", label:"Aguardando" },
  problema:     { bg:"#fee2e2", color:"#dc2626", icon:"⚠️", label:"Problema" },
  desconhecido: { bg:"#f1f5f9", color:"#64748b", icon:"❓", label:"Sem info" },
  erro:         { bg:"#fee2e2", color:"#ef4444", icon:"❌", label:"Erro" },
};

const EMPTY_FORM = { name:"", phone:"", email:"", tracking:"" };
const STORAGE_KEY = "rastreiobot_customers";
const DAYS_KEY    = "rastreiobot_days";

// Chama nossa própria API (servidor Next.js) — sem CORS, ~1 segundo
async function consultarRastreio(codigo) {
  const res = await fetch(`/api/rastrear?codigo=${codigo}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}

export default function App() {
  const [customers, setCustomers]       = useState([]);
  const [tab, setTab]                   = useState("dashboard");
  const [checkingAll, setCheckingAll]   = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [scheduleDays, setScheduleDays] = useState([1,3,5]);
  const [toast, setToast]               = useState(null);

  // Persistência local (localStorage no servidor próprio)
  useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_KEY);
      if (c) setCustomers(JSON.parse(c));
      const d = localStorage.getItem(DAYS_KEY);
      if (d) setScheduleDays(JSON.parse(d));
    } catch(_) {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(customers)); } catch(_) {}
  }, [customers]);

  useEffect(() => {
    try { localStorage.setItem(DAYS_KEY, JSON.stringify(scheduleDays)); } catch(_) {}
  }, [scheduleDays]);

  const notify = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addCustomer = () => {
    if (!form.name.trim() || !form.tracking.trim()) return;
    setCustomers(prev => [...prev, {
      id:Date.now(), ...form,
      tracking:form.tracking.trim().toUpperCase(),
      status:null, lastEvent:null, lastLocation:null,
      lastDate:null, resumo:null, lastCheck:null, erroMsg:null, checking:false
    }]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    notify("Cliente adicionado!");
  };

  const removeCustomer = (id) =>
    setCustomers(prev => prev.filter(c => c.id !== id));

  const fetchTracking = async (customer) => {
    setCustomers(prev => prev.map(c =>
      c.id === customer.id ? { ...c, checking:true, erroMsg:null } : c
    ));
    try {
      const p = await consultarRastreio(customer.tracking);
      setCustomers(prev => prev.map(c => c.id === customer.id ? {
        ...c, checking:false,
        status:      p.status  || "desconhecido",
        lastEvent:   p.evento  || "Sem informações",
        lastLocation:p.local   || null,
        lastDate:    p.data    || null,
        resumo:      p.resumo  || null,
        erroMsg:     null,
        lastCheck:   new Date().toLocaleString("pt-BR")
      } : c));
    } catch(e) {
      setCustomers(prev => prev.map(c => c.id === customer.id ? {
        ...c, checking:false, status:"erro",
        lastEvent:"Não foi possível consultar.", erroMsg:e.message
      } : c));
    }
  };

  // Todos em paralelo
  const checkAll = async () => {
    if (!customers.length) return;
    setCheckingAll(true);
    await Promise.all(customers.map(c => fetchTracking(c)));
    setCheckingAll(false);
    notify("Todos os rastreios atualizados!");
  };

  const sendWhatsApp = (c) => {
    const msg = c.resumo
      ? `Olá ${c.name}! 📦 Atualização do pedido (${c.tracking}):\n\n${c.resumo}${c.lastDate?"\n📅 "+c.lastDate:""}${c.lastLocation?"\n📍 "+c.lastLocation:""}\n\nQualquer dúvida estamos à disposição!`
      : `Olá ${c.name}! Ainda não há atualizações para o pedido (${c.tracking}).`;
    window.open(`https://wa.me/55${c.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendEmail = (c) => {
    const subj = `📦 Atualização do seu pedido — ${c.tracking}`;
    const body = c.resumo
      ? `Olá ${c.name},\n\n${c.resumo}${c.lastLocation?"\nLocal: "+c.lastLocation:""}${c.lastDate?"\nData: "+c.lastDate:""}\n\nAtenciosamente`
      : `Olá ${c.name},\n\nSeu pedido ${c.tracking} não tem atualizações.\n\nAtenciosamente`;
    window.open(`mailto:${c.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`);
  };

  const card = { background:"#fff", borderRadius:14, padding:16, boxShadow:"0 1px 6px rgba(0,0,0,0.07)", marginBottom:12 };
  const btn  = (bg, color, extra={}) => ({ background:bg, color, border:"none", borderRadius:8, padding:"7px 13px", fontSize:12, fontWeight:600, cursor:"pointer", ...extra });
  const inp  = { width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:14, boxSizing:"border-box", outline:"none" };

  const isToday = scheduleDays.includes(new Date().getDay());
  const stats = [
    { label:"Total",       val:customers.length,                                                               icon:"📦", bg:"#eff6ff", col:"#2563eb" },
    { label:"Entregues",   val:customers.filter(c=>c.status==="entregue").length,                              icon:"✅", bg:"#f0fdf4", col:"#16a34a" },
    { label:"Em trânsito", val:customers.filter(c=>["em_transito","saiu_entrega"].includes(c.status)).length,  icon:"🚚", bg:"#fefce8", col:"#ca8a04" },
  ];

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh", background:"#f1f5f9" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {toast && (
        <div style={{ position:"fixed", top:16, right:16, zIndex:999, background:toast.type==="success"?"#16a34a":"#dc2626", color:"#fff", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)", padding:"18px 20px 0", color:"#fff" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, maxWidth:720, margin:"0 auto 14px" }}>
          <span style={{ fontSize:26 }}>📦</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18 }}>RastreioBot</div>
            <div style={{ fontSize:11, opacity:.8 }}>Correios • WhatsApp • E-mail</div>
          </div>
          {isToday && <span style={{ background:"rgba(255,255,255,.2)", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>📅 Dia de envio!</span>}
        </div>
        <div style={{ display:"flex", gap:6, maxWidth:720, margin:"0 auto" }}>
          {[["dashboard","📊 Dashboard"],["clientes","👥 Clientes"],["config","⚙️ Config"]].map(([t,lbl]) => (
            <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?"#fff":"transparent", color:tab===t?"#1e3a5f":"#fff", border:"none", borderRadius:"8px 8px 0 0", padding:"8px 16px", fontSize:13, fontWeight:tab===t?700:400, cursor:"pointer" }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 16px", maxWidth:720, margin:"0 auto" }}>

        {/* DASHBOARD */}
        {tab==="dashboard" && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:"14px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:24, fontWeight:800, color:s.col }}>{s.val}</div>
                <div style={{ fontSize:11, color:s.col, opacity:.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <button onClick={checkAll} disabled={checkingAll||!customers.length}
            style={{ ...btn(checkingAll||!customers.length?"#94a3b8":"linear-gradient(135deg,#1e3a5f,#2563eb)","#fff"), width:"100%", padding:13, fontSize:14, fontWeight:700, borderRadius:12, marginBottom:16 }}>
            {checkingAll ? "⏳ Consultando em paralelo…" : "🔄 Atualizar Todos os Rastreios"}
          </button>

          {!customers.length ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"#94a3b8" }}>
              <div style={{ fontSize:44 }}>📭</div>
              <p style={{ margin:"12px 0 16px" }}>Nenhum cliente cadastrado ainda.</p>
              <button onClick={()=>setTab("clientes")} style={btn("#2563eb","#fff",{ padding:"10px 24px", fontSize:14, borderRadius:10 })}>+ Adicionar Cliente</button>
            </div>
          ) : customers.map(c => {
            const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG["desconhecido"];
            return (
              <div key={c.id} style={card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:"#64748b", fontFamily:"monospace", letterSpacing:1 }}>{c.tracking}</div>
                  </div>
                  {c.status && <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"3px 11px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{sc.icon} {sc.label}</span>}
                </div>

                {c.checking && <div style={{ background:"#eff6ff", borderRadius:8, padding:"8px 12px", marginBottom:8, fontSize:12, color:"#2563eb" }}>🔍 Consultando Correios…</div>}

                {!c.checking && c.lastEvent && (
                  <div style={{ background:"#f8fafc", borderRadius:8, padding:"8px 10px", marginBottom:8, fontSize:12, color:"#475569" }}>
                    📍 <strong>{c.lastEvent}</strong>
                    {c.lastLocation && ` — ${c.lastLocation}`}
                    {c.lastDate && <span style={{ color:"#94a3b8", marginLeft:6 }}>{c.lastDate}</span>}
                  </div>
                )}

                {c.resumo && !c.checking && <div style={{ fontSize:12, color:"#334155", marginBottom:8, lineHeight:1.5 }}>💬 {c.resumo}</div>}

                {c.erroMsg && !c.checking && (
                  <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:8, padding:"8px 10px", marginBottom:8, fontSize:11, color:"#be123c" }}>
                    ⚠️ <strong>Erro:</strong> {c.erroMsg}
                  </div>
                )}

                {c.lastCheck && !c.checking && <div style={{ fontSize:10, color:"#94a3b8", marginBottom:10 }}>Consultado: {c.lastCheck}</div>}

                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  <button onClick={()=>fetchTracking(c)} disabled={c.checking} style={btn(c.checking?"#f1f5f9":"#e0e7ff","#334155")}>
                    {c.checking?"⏳":"🔄"} Consultar
                  </button>
                  {c.phone && <button onClick={()=>sendWhatsApp(c)} disabled={!c.resumo} style={btn(c.resumo?"#dcfce7":"#f1f5f9",c.resumo?"#15803d":"#94a3b8")}>📲 WhatsApp</button>}
                  {c.email && <button onClick={()=>sendEmail(c)} disabled={!c.status||c.status==="erro"} style={btn(c.status&&c.status!=="erro"?"#dbeafe":"#f1f5f9",c.status&&c.status!=="erro"?"#1d4ed8":"#94a3b8")}>📧 E-mail</button>}
                </div>
              </div>
            );
          })}
        </>)}

        {/* CLIENTES */}
        {tab==="clientes" && (<>
          <button onClick={()=>setShowForm(f=>!f)} style={btn(showForm?"#fee2e2":"#2563eb",showForm?"#dc2626":"#fff",{ padding:"10px 20px", fontSize:14, borderRadius:10, marginBottom:14 })}>
            {showForm?"✕ Cancelar":"+ Novo Cliente"}
          </button>

          {showForm && (
            <div style={card}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>➕ Novo Cliente</div>
              {[["name","👤 Nome *","text","Nome completo"],["tracking","📦 Código de Rastreio *","text","Ex: AA123456789BR"],["phone","📲 WhatsApp","tel","Ex: 21999998888"],["email","📧 E-mail","email","cliente@email.com"]].map(([f,lbl,type,ph]) => (
                <div key={f} style={{ marginBottom:11 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:"#475569", display:"block", marginBottom:4 }}>{lbl}</label>
                  <input type={type} placeholder={ph} value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} style={inp} />
                </div>
              ))}
              <button onClick={addCustomer} disabled={!form.name.trim()||!form.tracking.trim()}
                style={btn(form.name&&form.tracking?"#2563eb":"#94a3b8","#fff",{width:"100%",padding:11,fontSize:14,borderRadius:10,marginTop:4})}>
                💾 Salvar Cliente
              </button>
            </div>
          )}

          {!customers.length
            ? <div style={{ textAlign:"center", padding:"40px 20px", color:"#94a3b8" }}><div style={{ fontSize:44 }}>👥</div><p style={{marginTop:12}}>Nenhum cliente ainda.</p></div>
            : customers.map(c => (
              <div key={c.id} style={{ ...card, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontWeight:700 }}>{c.name}</div>
                  <div style={{ fontSize:11, fontFamily:"monospace", color:"#64748b" }}>{c.tracking}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{c.phone&&`📲 ${c.phone}  `}{c.email&&`📧 ${c.email}`}</div>
                </div>
                <button onClick={()=>removeCustomer(c.id)} style={btn("#fee2e2","#dc2626",{fontSize:16})}>🗑️</button>
              </div>
            ))
          }
        </>)}

        {/* CONFIG */}
        {tab==="config" && (<>
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>📅 Dias de Envio</div>
            <p style={{ fontSize:12, color:"#64748b", margin:"8px 0 14px" }}>Nos dias marcados, aparece um lembrete no dashboard.</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {DAYS.map((d,i) => (
                <button key={i} onClick={()=>setScheduleDays(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}
                  style={{ background:scheduleDays.includes(i)?"#2563eb":"#f1f5f9", color:scheduleDays.includes(i)?"#fff":"#475569", border:"none", borderRadius:9, padding:"10px 16px", cursor:"pointer", fontWeight:scheduleDays.includes(i)?700:400, fontSize:14 }}>
                  {d}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:"#94a3b8", marginTop:12 }}>Selecionados: {scheduleDays.map(i=>DAYS[i]).join(", ")||"nenhum"}</p>
          </div>

          <div style={{ ...card, background:"#f0fdf4", border:"1px solid #bbf7d0" }}>
            <div style={{ fontWeight:700, color:"#15803d", marginBottom:6 }}>⚡ Rastreio ultrarrápido</div>
            <p style={{ fontSize:12, color:"#166534", lineHeight:1.8 }}>
              Nesta versão hospedada, o rastreio vai direto na <strong>API oficial dos Correios</strong> pelo servidor — sem IA, sem CORS. Tempo: <strong>~1 segundo</strong>. Todos os clientes consultados em paralelo.
            </p>
          </div>

          <div style={{ ...card, background:"#fefce8", border:"1px solid #fde047" }}>
            <div style={{ fontWeight:700, color:"#854d0e", marginBottom:6 }}>🚀 Próximos passos</div>
            <p style={{ fontSize:12, color:"#713f12", lineHeight:1.6 }}>
              Com o app no ar, é possível adicionar <strong>WhatsApp automático</strong> via Evolution API (gratuita) e <strong>agendamento automático</strong> sem precisar clicar. Só me pedir!
            </p>
          </div>
        </>)}
      </div>
    </div>
  );
}
