import { useState, useEffect, useCallback } from "react";
import { db } from "./supabase";

const CATEGORIES = {
  income: [
    { id: "salary", label: "เงินเดือน", icon: "💼" },
    { id: "freelance", label: "ฟรีแลนซ์", icon: "🖥️" },
    { id: "investment", label: "ลงทุน", icon: "📈" },
    { id: "business", label: "ธุรกิจ", icon: "🏢" },
    { id: "other_income", label: "อื่นๆ", icon: "💰" },
  ],
  expense: [
    { id: "food", label: "อาหาร", icon: "🍜" },
    { id: "transport", label: "เดินทาง", icon: "🚗" },
    { id: "housing", label: "ที่พัก", icon: "🏠" },
    { id: "health", label: "สุขภาพ", icon: "🏥" },
    { id: "entertainment", label: "บันเทิง", icon: "🎮" },
    { id: "shopping", label: "ช้อปปิ้ง", icon: "🛍️" },
    { id: "education", label: "การศึกษา", icon: "📚" },
    { id: "other_expense", label: "อื่นๆ", icon: "💸" },
  ],
};

const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const DAYS_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const GOLD="#C9A84C",GOLD_LIGHT="#E8C96A",GOLD_DARK="#8B6914",BORDER_GOLD="#3D2E10",
  BG_BASE="#080603",BG_CARD="#0E0B05",BG_SECTION="#120E06",BORDER="#2A2010",
  TEXT_MAIN="#F5ECD7",TEXT_DIM="#7A6840",TEXT_MID="#A08850",GREEN="#4ade80",RED="#f87171";
const CAT_COLORS=["#C9A84C","#4ade80","#60a5fa","#f87171","#a78bfa","#fb923c","#34d399","#f472b6","#facc15","#38bdf8"];

const formatCurrency=(n)=>new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(n);
const formatK=(n)=>{if(Math.abs(n)>=1000000)return(n/1000000).toFixed(1)+"M";if(Math.abs(n)>=1000)return(n/1000).toFixed(1)+"K";return Math.round(n).toString();};
const isOther=(cat)=>cat==="other_income"||cat==="other_expense";
const todayStr=()=>new Date().toISOString().split("T")[0];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [period, setPeriod] = useState("monthly");
  const [entries, setEntries] = useState([]);
  const [targets, setTargets] = useState({});
  const [targetGoal, setTargetGoal] = useState(50000);
  const [editTarget, setEditTarget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type:"income", cat:"salary", amount:"", note:"", date:todayStr() });
  const [editModal, setEditModal] = useState(null);
  const now = new Date();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, targetsData, goal] = await Promise.all([
        db.getEntries(), db.getTargets(), db.getSetting("targetGoal"),
      ]);
      setEntries(Array.isArray(entriesData) ? entriesData : []);
      const tMap = {};
      (Array.isArray(targetsData) ? targetsData : []).forEach(t => tMap[t.date] = t.done);
      setTargets(tMap);
      if (goal) setTargetGoal(parseInt(goal));
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveTargetGoal = async (val) => {
    setTargetGoal(val);
    await db.setSetting("targetGoal", val.toString());
  };

  const addEntry = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    const entry = { date: form.date, type: form.type, cat: form.cat, amount };
    if (isOther(form.cat) && form.note.trim()) entry.note = form.note.trim();
    const result = await db.addEntry(entry);
    if (Array.isArray(result)) setEntries(prev => [...result, ...prev]);
    setForm({ type: form.type, cat: form.cat, amount: "", note: "", date: form.date });
  };

  const deleteEntry = async (id) => {
    await db.deleteEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setEditModal(null);
  };

  const saveEdit = async (id, newEntry) => {
    const result = await db.updateEntry(id, newEntry);
    if (Array.isArray(result) && result[0]) setEntries(prev => prev.map(e => e.id === id ? result[0] : e));
    setEditModal(null);
  };

  const toggleTarget = async (date) => {
    const newVal = !targets[date];
    setTargets(prev => ({ ...prev, [date]: newVal }));
    await db.setTarget(date, newVal);
  };

  const getCatLabel=(key)=>{if(key&&key.startsWith("other::"))return"อื่นๆ: "+key.replace("other::","");const all=[...CATEGORIES.income,...CATEGORIES.expense];return all.find(c=>c.id===key)?.label||key;};
  const getCatIcon=(key)=>{if(key&&key.startsWith("other::"))return"📝";const all=[...CATEGORIES.income,...CATEGORIES.expense];return all.find(c=>c.id===key)?.icon||"💰";};

  const getStats = (filterFn) => {
    const filtered = entries.filter(filterFn);
    const income = filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
    const expense = filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
    const catIncome={}, catExpense={};
    filtered.forEach(e=>{
      const k = isOther(e.cat)&&e.note ? "other::"+e.note : e.cat;
      if(e.type==="income") catIncome[k]=(catIncome[k]||0)+e.amount;
      else catExpense[k]=(catExpense[k]||0)+e.amount;
    });
    return { income, expense, profit: income-expense, catIncome, catExpense };
  };

  const todayStats = getStats(e => e.date === todayStr());
  const monthStats = getStats(e => e.date?.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`));
  const yearStats = getStats(e => e.date?.startsWith(`${now.getFullYear()}`));
  const currentStats = period==="daily" ? todayStats : period==="monthly" ? monthStats : yearStats;

  const entriesByDate = {};
  entries.forEach(e => {
    if (!entriesByDate[e.date]) entriesByDate[e.date] = [];
    entriesByDate[e.date].push(e);
  });

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:BG_BASE}}>
      <div style={{color:GOLD,fontSize:32}}>✦</div>
      <div style={{color:TEXT_DIM,marginTop:12,fontFamily:"'Noto Sans Thai',sans-serif"}}>กำลังโหลด...</div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={S.goldLine}/>
      <div style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.greeting}>Finance ✦</div>
            <div style={S.dateText}>{now.toLocaleDateString("th-TH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
          </div>
          <button style={S.targetBtn} onClick={()=>setEditTarget(!editTarget)}>🎯</button>
        </div>
        {editTarget&&(<div style={S.targetEdit} className="fadeIn">
          <span style={S.targetLabel}>เป้าหมายรายเดือน</span>
          <input style={S.targetInput} type="number" value={targetGoal} onChange={e=>setTargetGoal(+e.target.value)}/>
          <button style={S.saveBtn} onClick={()=>{saveTargetGoal(targetGoal);setEditTarget(false);}}>บันทึก</button>
        </div>)}
      </div>
      <div style={S.cards}>
        <SCard label="รายได้วันนี้" value={todayStats.income} color={GREEN} icon="↑"/>
        <SCard label="รายจ่ายวันนี้" value={todayStats.expense} color={RED} icon="↓"/>
        <SCard label="กำไร/ขาดทุน" value={todayStats.profit} color={todayStats.profit>=0?GREEN:RED} icon="=" big/>
      </div>
      <div style={S.layout}>
        <div style={S.sidebar} className="pc-sidebar">
          {["dashboard","category","add","history"].map(t=>(
            <button key={t} style={{...S.sideBtn,...(view===t?S.sideBtnActive:{})}} onClick={()=>setView(t)}>
              <span style={S.sideBtnIcon}>{t==="dashboard"?"📊":t==="category"?"🗂️":t==="add"?"➕":"📋"}</span>
              <span>{t==="dashboard"?"Dashboard":t==="category"?"หมวดหมู่":t==="add"?"เพิ่มรายการ":"ประวัติ"}</span>
            </button>
          ))}
        </div>
        <div style={S.main}>
          {view==="dashboard"&&<Dashboard period={period} setPeriod={setPeriod} currentStats={currentStats} monthStats={monthStats} todayStats={todayStats} targetGoal={targetGoal} entries={entries} entriesByDate={entriesByDate} now={now} toggleTarget={toggleTarget} targets={targets} getCatLabel={getCatLabel} getCatIcon={getCatIcon}/>}
          {view==="category"&&<CategoryDashboard period={period} setPeriod={setPeriod} currentStats={currentStats} getCatLabel={getCatLabel} getCatIcon={getCatIcon}/>}
          {view==="add"&&<AddEntry form={form} setForm={setForm} addEntry={addEntry}/>}
          {view==="history"&&<History entriesByDate={entriesByDate} now={now} setEditModal={setEditModal} getCatLabel={getCatLabel} getCatIcon={getCatIcon}/>}
        </div>
      </div>
      <div style={S.tabs} className="mobile-tabs">
        {["dashboard","category","add","history"].map(t=>(
          <button key={t} style={{...S.tab,...(view===t?S.tabActive:{})}} onClick={()=>setView(t)}>
            {t==="dashboard"?"📊":t==="category"?"🗂️":t==="add"?"➕":"📋"}
          </button>
        ))}
      </div>
      {editModal&&<EditModal modal={editModal} setEditModal={setEditModal} deleteEntry={deleteEntry} saveEdit={saveEdit}/>}
    </div>
  );
}

function SCard({label,value,color,icon,big}){return(<div style={{...S.card,...(big?S.cardBig:{})}} className="cardHover"><div style={{...S.cardIcon,color}}>{icon}</div><div style={S.cardLabel}>{label}</div><div style={{...S.cardValue,color}}>{formatK(Math.abs(Math.round(value)))}</div></div>);}
function StatBox({label,value,color}){return(<div style={S.statBox}><div style={S.statLabel}>{label}</div><div style={{...S.statValue,color}}>{formatK(Math.round(value))}</div></div>);}
function Dashboard({period,setPeriod,currentStats,monthStats,todayStats,targetGoal,entries,entriesByDate,now,toggleTarget,targets,getCatLabel,getCatIcon}){
  const profitRate=currentStats.income>0?(currentStats.profit/currentStats.income)*100:0;
  const targetRate=Math.min((monthStats.income/targetGoal)*100,100);
  let bars=[];
  if(period==="daily"){for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().split("T")[0];const de=entries.filter(e=>e.date===key);bars.push({label:DAYS_TH[d.getDay()],income:de.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0),expense:de.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0)});}}
  else if(period==="monthly"){for(let m=5;m>=0;m--){const d=new Date(now.getFullYear(),now.getMonth()-m,1);const prefix=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;const me=entries.filter(e=>e.date?.startsWith(prefix));bars.push({label:MONTHS_TH[d.getMonth()],income:me.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0),expense:me.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0)});}}
  else{for(let m=0;m<12;m++){const prefix=`${now.getFullYear()}-${String(m+1).padStart(2,"0")}`;const me=entries.filter(e=>e.date?.startsWith(prefix));bars.push({label:MONTHS_TH[m],income:me.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0),expense:me.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0)});}}
  const maxBar=Math.max(...bars.map(b=>Math.max(b.income,b.expense)),1);
  const topExpenses=Object.entries(currentStats.catExpense||{}).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const totalExp=Object.values(currentStats.catExpense||{}).reduce((s,v)=>s+v,0);
  const calDays=[];for(let i=29;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().split("T")[0];calDays.push({key,day:d.getDate(),month:d.getMonth(),done:targets[key]||false,isToday:key===todayStr()});}
  let streak=0;for(let i=0;i<calDays.length;i++){const idx=calDays.length-1-i;if(calDays[idx].done)streak++;else break;}
  const doneCount=calDays.filter(d=>d.done).length;
  return(
    <div style={S.dashWrap} className="fadeIn">
      <div style={S.periodRow}>{["daily","monthly","yearly"].map(p=>(<button key={p} style={{...S.periodBtn,...(period===p?S.periodActive:{})}} onClick={()=>setPeriod(p)}>{p==="daily"?"วัน":p==="monthly"?"เดือน":"ปี"}</button>))}</div>
      <div style={S.statRow}><StatBox label="รายได้" value={currentStats.income} color={GREEN}/><StatBox label="รายจ่าย" value={currentStats.expense} color={RED}/><StatBox label={currentStats.profit>=0?"กำไร":"ขาดทุน"} value={Math.abs(currentStats.profit)} color={currentStats.profit>=0?GREEN:RED}/></div>
      <div style={S.pcGrid} className="pc-grid">
        <div>
          <div style={S.section}><div style={S.sectionTitle}>🎯 เป้าหมายรายเดือน</div><div style={S.progressBar}><div style={{...S.progressFill,width:`${targetRate}%`}} className="progressAnim"/></div><div style={S.progressText}><span style={{color:GREEN}}>{formatCurrency(monthStats.income)}</span><span style={{color:TEXT_DIM}}> / {formatCurrency(targetGoal)}</span><span style={{color:GOLD,marginLeft:8}}>{targetRate.toFixed(0)}%</span></div></div>
          <div style={S.section}><div style={S.sectionTitle}>📊 สัดส่วนกำไร</div><div style={S.donutRow}><DonutChart rate={Math.max(0,profitRate)}/><div style={S.donutLegend}><div style={S.legendItem}><span style={{...S.dot,background:GREEN}}/><span style={S.legendText}>กำไร {Math.max(0,profitRate).toFixed(1)}%</span></div><div style={S.legendItem}><span style={{...S.dot,background:RED}}/><span style={S.legendText}>รายจ่าย {Math.max(0,100-profitRate).toFixed(1)}%</span></div><div style={{marginTop:8,color:currentStats.profit>=0?GREEN:RED,fontSize:18,fontWeight:700}}>{formatCurrency(Math.round(currentStats.profit))}</div></div></div></div>
          <div style={S.section}><div style={S.sectionTitle}>📈 ภาพรวมรายรับ-รายจ่าย</div><div style={S.barChart}>{bars.map((b,i)=>(<div key={i} style={S.barGroup}><div style={S.barPair}><div style={{...S.bar,height:`${(b.income/maxBar)*80}px`,background:"linear-gradient(180deg,#4ade80,#16a34a)"}}/><div style={{...S.bar,height:`${(b.expense/maxBar)*80}px`,background:"linear-gradient(180deg,#f87171,#dc2626)"}}/></div><div style={S.barLabel}>{b.label}</div></div>))}</div><div style={S.barLegend}><span><span style={{...S.dot,background:GREEN}}/>รายได้</span><span><span style={{...S.dot,background:RED}}/>รายจ่าย</span></div></div>
        </div>
        <div>
          {topExpenses.length>0&&(<div style={S.section}><div style={S.sectionTitle}>💸 หมวดรายจ่ายหลัก</div>{topExpenses.map(([cat,amount])=>{const pct=totalExp>0?(amount/totalExp)*100:0;return(<div key={cat} style={S.catRow}><span style={S.catIcon}>{getCatIcon(cat)}</span><div style={S.catInfo}><div style={S.catName}>{getCatLabel(cat)}</div><div style={S.catBarWrap}><div style={{...S.catBar,width:`${pct}%`}}/></div></div><span style={S.catAmt}>{formatK(Math.round(amount))}</span></div>);})}</div>)}
          <div style={S.section}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={S.sectionTitle}>✦ Daily Target — 30 วัน</div><div style={S.streakBadge}>🔥 {streak} วัน</div></div>
            <div style={S.calStats}><div style={S.calStatBox}><div style={{color:GOLD,fontSize:20,fontWeight:800}}>{doneCount}</div><div style={{color:TEXT_DIM,fontSize:11}}>ทำแล้ว</div></div><div style={S.calStatBox}><div style={{color:TEXT_MID,fontSize:20,fontWeight:800}}>{30-doneCount}</div><div style={{color:TEXT_DIM,fontSize:11}}>ยังไม่ทำ</div></div><div style={S.calStatBox}><div style={{color:GREEN,fontSize:20,fontWeight:800}}>{((doneCount/30)*100).toFixed(0)}%</div><div style={{color:TEXT_DIM,fontSize:11}}>สำเร็จ</div></div></div>
            <div style={S.calGrid}>{calDays.map(({key,day,done,isToday})=>(<button key={key} style={{...S.calDay,...(done?S.calDone:{}),...(isToday?S.calToday:{})}} onClick={()=>toggleTarget(key)}><span style={S.calDayNum}>{day}</span>{done&&<span style={S.calCheck}>✓</span>}</button>))}</div>
            <div style={{marginTop:12}}><div style={{...S.progressBar,height:4}}><div style={{...S.progressFill,width:`${(doneCount/30)*100}%`}}/></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}function CategoryDashboard({period,setPeriod,currentStats,getCatLabel,getCatIcon}){
  const [activeTab,setActiveTab]=useState("expense");
  const catMap=activeTab==="expense"?(currentStats.catExpense||{}):(currentStats.catIncome||{});
  const entries=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,[,v])=>s+v,0);
  return(
    <div style={S.dashWrap} className="fadeIn">
      <div style={S.addTitle}>🗂️ วิเคราะห์หมวดหมู่</div>
      <div style={S.periodRow}>{["daily","monthly","yearly"].map(p=>(<button key={p} style={{...S.periodBtn,...(period===p?S.periodActive:{})}} onClick={()=>setPeriod(p)}>{p==="daily"?"วัน":p==="monthly"?"เดือน":"ปี"}</button>))}</div>
      <div style={S.typeToggle}><button style={{...S.typeBtn,...(activeTab==="income"?S.typeBtnIncome:{})}} onClick={()=>setActiveTab("income")}>↑ รายได้</button><button style={{...S.typeBtn,...(activeTab==="expense"?S.typeBtnExpense:{})}} onClick={()=>setActiveTab("expense")}>↓ รายจ่าย</button></div>
      <div style={S.section}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={S.sectionTitle}>{activeTab==="expense"?"รายจ่ายทั้งหมด":"รายได้ทั้งหมด"}</div><div style={{color:activeTab==="expense"?RED:GREEN,fontWeight:800,fontSize:16}}>{formatCurrency(Math.round(total))}</div></div>
        {entries.length===0&&<div style={{color:TEXT_DIM,textAlign:"center",padding:"20px 0"}}>ยังไม่มีข้อมูลครับ</div>}
        {entries.map(([cat,amount],i)=>{const pct=total>0?(amount/total)*100:0;const color=CAT_COLORS[i%CAT_COLORS.length];return(<div key={cat} style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{getCatIcon(cat)}</span><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:TEXT_MAIN,fontWeight:600}}>{getCatLabel(cat)}</span><span style={{fontSize:13,color,fontWeight:700}}>{formatCurrency(Math.round(amount))}</span></div><div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}><div style={{flex:1,height:6,background:BORDER,borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:999,transition:"width 0.8s ease"}}/></div><span style={{fontSize:11,color:TEXT_DIM,minWidth:32,textAlign:"right"}}>{pct.toFixed(1)}%</span></div></div></div></div>);})}
      </div>
      {entries.length>0&&(<div style={S.section}><div style={S.sectionTitle}>สัดส่วน</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>{entries.map(([cat,amount],i)=>{const pct=total>0?(amount/total)*100:0;const color=CAT_COLORS[i%CAT_COLORS.length];return(<div key={cat} style={{display:"flex",alignItems:"center",gap:4,background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:"4px 10px"}}><span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block"}}/><span style={{fontSize:11,color:TEXT_MID}}>{getCatIcon(cat)} {getCatLabel(cat)}</span><span style={{fontSize:11,color,fontWeight:700}}>{pct.toFixed(0)}%</span></div>);})}</div></div>)}
    </div>
  );
}

function DonutChart({rate}){const r=40,cx=50,cy=50,circ=2*Math.PI*r,dash=(rate/100)*circ;return(<svg width="100" height="100" viewBox="0 0 100 100"><defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={GOLD_DARK}/><stop offset="100%" stopColor={GOLD_LIGHT}/></linearGradient></defs><circle cx={cx} cy={cy} r={r} fill="none" stroke={BORDER} strokeWidth="12"/><circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#goldGrad)" strokeWidth="12" strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" strokeDashoffset={circ/4} style={{transition:"stroke-dasharray 1s ease"}}/><text x={cx} y={cy+5} textAnchor="middle" fill={GOLD_LIGHT} fontSize="13" fontWeight="700">{rate.toFixed(0)}%</text></svg>);}
function StatBox({label,value,color}){return(<div style={S.statBox}><div style={S.statLabel}>{label}</div><div style={{...S.statValue,color}}>{formatK(Math.round(value))}</div></div>);}

function AddEntry({form,setForm,addEntry}){
  const cats=form.type==="income"?CATEGORIES.income:CATEGORIES.expense;
  const showNote=isOther(form.cat);
  return(<div style={S.addWrap} className="fadeIn">
    <div style={S.addTitle}>เพิ่มรายการ</div>
    <div style={S.typeToggle}><button style={{...S.typeBtn,...(form.type==="income"?S.typeBtnIncome:{})}} onClick={()=>setForm({...form,type:"income",cat:"salary",note:""})}>↑ รายได้</button><button style={{...S.typeBtn,...(form.type==="expense"?S.typeBtnExpense:{})}} onClick={()=>setForm({...form,type:"expense",cat:"food",note:""})}>↓ รายจ่าย</button></div>
    <div style={S.field}><label style={S.label}>วันที่</label><input type="date" style={S.input} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
    <div style={S.field}><label style={S.label}>หมวดหมู่</label><div style={S.catGrid}>{cats.map(c=>(<button key={c.id} style={{...S.catChip,...(form.cat===c.id?S.catChipActive:{})}} onClick={()=>setForm({...form,cat:c.id,note:""})}>{c.icon} {c.label}</button>))}</div></div>
    {showNote&&(<div style={S.field} className="fadeIn"><label style={S.label}>หมายเหตุ</label><input type="text" style={S.input} placeholder="เช่น โบนัส, ค่าน้ำค่าไฟ..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>)}
    <div style={S.field}><label style={S.label}>จำนวนเงิน (฿)</label><input type="number" style={S.input} placeholder="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div>
    <button style={S.submitBtn} onClick={addEntry}>✦ บันทึกรายการ</button>
  </div>);
}

function History({entriesByDate,now,setEditModal,getCatLabel,getCatIcon}){
  const [expanded,setExpanded]=useState(null);
  const days=[];for(let i=0;i<30;i++){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().split("T")[0];if(entriesByDate[key])days.push({key,d});}
  return(<div style={S.histWrap} className="fadeIn">
    <div style={S.addTitle}>ประวัติ 30 วัน</div>
    {days.length===0&&<div style={{color:TEXT_DIM,textAlign:"center",marginTop:40}}>ยังไม่มีข้อมูล<br/>เริ่มเพิ่มรายการได้เลย ✦</div>}
    {days.map(({key,d})=>{
      const dayEntries=entriesByDate[key]||[];
      const income=dayEntries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
      const expense=dayEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
      const profit=income-expense;
      const isOpen=expanded===key;
      return(<div key={key} style={{marginBottom:8}}>
        <button style={S.histRow} onClick={()=>setExpanded(isOpen?null:key)}>
          <div style={S.histDate}><div style={S.histDay}>{d.getDate()}</div><div style={S.histMonth}>{MONTHS_TH[d.getMonth()]}</div></div>
          <div style={S.histStats}><div style={{color:GREEN,fontSize:13}}>+{formatK(Math.round(income))}</div><div style={{color:RED,fontSize:13}}>-{formatK(Math.round(expense))}</div></div>
          <div style={{color:profit>=0?GREEN:RED,fontWeight:700,fontSize:15}}>{profit>=0?"+":""}{formatK(Math.round(profit))}</div>
          <div style={{color:TEXT_DIM,fontSize:12,marginLeft:4}}>{isOpen?"▲":"▼"}</div>
        </button>
        {isOpen&&(<div style={S.entryList} className="fadeIn">
          {dayEntries.map(entry=>{
            const cats=entry.type==="income"?CATEGORIES.income:CATEGORIES.expense;
            const catInfo=cats.find(c=>c.id===entry.cat)||{icon:"💰",label:entry.cat};
            const label=entry.note?`${catInfo.label}: ${entry.note}`:catInfo.label;
            return(<div key={entry.id} style={S.entryItem}>
              <span style={{fontSize:16}}>{catInfo.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:13,color:TEXT_MAIN}}>{label}</div><div style={{fontSize:11,color:TEXT_DIM}}>{entry.type==="income"?"รายได้":"รายจ่าย"}</div></div>
              <span style={{color:entry.type==="income"?GREEN:RED,fontWeight:700,fontSize:14}}>{entry.type==="income"?"+":"-"}{formatK(Math.round(entry.amount))}</span>
              <button style={S.editBtn} onClick={()=>setEditModal({id:entry.id,type:entry.type,entry:{...entry}})}>✏️</button>
            </div>);
          })}
        </div>)}
      </div>);
    })}
  </div>);
}

function EditModal({modal,setEditModal,deleteEntry,saveEdit}){
  const {id,type,entry}=modal;
  const [editEntry,setEditEntry]=useState({...entry});
  const [confirmDelete,setConfirmDelete]=useState(false);
  const cats=type==="income"?CATEGORIES.income:CATEGORIES.expense;
  const showNote=isOther(editEntry.cat);
  return(
    <div style={S.modalOverlay} onClick={()=>setEditModal(null)}>
      <div style={S.modalBox} onClick={e=>e.stopPropagation()} className="fadeIn">
        <div style={S.modalTitle}>✏️ แก้ไขรายการ</div>
        <div style={{fontSize:12,color:TEXT_DIM,marginBottom:16}}>{type==="income"?"รายได้":"รายจ่าย"} · {entry.date}</div>
        <div style={S.field}><label style={S.label}>หมวดหมู่</label><div style={S.catGrid}>{cats.map(c=>(<button key={c.id} style={{...S.catChip,...(editEntry.cat===c.id?S.catChipActive:{})}} onClick={()=>setEditEntry({...editEntry,cat:c.id,note:""})}>{c.icon} {c.label}</button>))}</div></div>
        {showNote&&(<div style={S.field}><label style={S.label}>หมายเหตุ</label><input type="text" style={S.input} value={editEntry.note||""} onChange={e=>setEditEntry({...editEntry,note:e.target.value})}/></div>)}
        <div style={S.field}><label style={S.label}>จำนวนเงิน (฿)</label><input type="number" style={S.input} value={editEntry.amount} onChange={e=>setEditEntry({...editEntry,amount:parseFloat(e.target.value)||0})}/></div>
        <button style={S.submitBtn} onClick={()=>saveEdit(id,{cat:editEntry.cat,amount:editEntry.amount,note:editEntry.note||null})}>✦ บันทึกการแก้ไข</button>
        {!confirmDelete
          ?<button style={S.deleteBtn} onClick={()=>setConfirmDelete(true)}>🗑️ ลบรายการนี้</button>
          :<div style={{marginTop:10}}><div style={{color:RED,fontSize:13,textAlign:"center",marginBottom:8}}>ยืนยันการลบ?</div><div style={{display:"flex",gap:8}}><button style={{...S.deleteBtn,flex:1}} onClick={()=>deleteEntry(id)}>ลบเลย</button><button style={{...S.cancelBtn,flex:1}} onClick={()=>setConfirmDelete(false)}>ยกเลิก</button></div></div>
        }
        <button style={S.cancelBtn} onClick={()=>setEditModal(null)}>ปิด</button>
      </div>
    </div>
  );
}

const S={
  root:{width:"100%",minHeight:"100vh",background:BG_BASE,color:TEXT_MAIN,fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",display:"flex",flexDirection:"column"},
  goldLine:{height:2,background:`linear-gradient(90deg,transparent,${GOLD},transparent)`},
  header:{background:"linear-gradient(160deg,#0E0A02 0%,#1A1305 100%)",padding:"16px 24px",borderBottom:`1px solid ${BORDER_GOLD}`},
  headerTop:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"},
  greeting:{fontSize:22,fontWeight:800,color:GOLD_LIGHT,letterSpacing:"1px"},
  dateText:{fontSize:12,color:TEXT_DIM,marginTop:2},
  targetBtn:{background:BG_CARD,border:`1px solid ${BORDER_GOLD}`,borderRadius:12,padding:"8px 10px",fontSize:18,cursor:"pointer"},
  targetEdit:{marginTop:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  targetLabel:{fontSize:13,color:TEXT_MID},
  targetInput:{background:BG_CARD,border:`1px solid ${BORDER_GOLD}`,borderRadius:8,color:TEXT_MAIN,padding:"6px 10px",fontSize:14,width:120},
  saveBtn:{background:`linear-gradient(135deg,${GOLD_DARK},${GOLD})`,border:"none",borderRadius:8,color:"#0E0B05",padding:"6px 14px",fontSize:13,cursor:"pointer",fontWeight:800},
  cards:{display:"flex",gap:8,padding:"12px 24px",flexWrap:"wrap"},
  card:{flex:1,minWidth:80,background:`linear-gradient(145deg,${BG_CARD},#16110A)`,border:`1px solid ${BORDER_GOLD}`,borderRadius:16,padding:"12px 10px",textAlign:"center",cursor:"default",transition:"transform 0.2s"},
  cardBig:{minWidth:"100%",flex:"1 1 100%"},
  cardIcon:{fontSize:18,marginBottom:2},
  cardLabel:{fontSize:11,color:TEXT_DIM,marginBottom:4},
  cardValue:{fontSize:20,fontWeight:800,letterSpacing:"-0.5px"},
  layout:{display:"flex",flex:1,overflow:"hidden"},
  sidebar:{width:200,background:"#060401",borderRight:`1px solid ${BORDER}`,padding:"16px 12px",flexDirection:"column",gap:4,display:"none"},
  sideBtn:{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"none",border:"none",borderRadius:12,color:TEXT_DIM,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",textAlign:"left",width:"100%"},
  sideBtnActive:{background:"#1A1305",color:GOLD,fontWeight:700},
  sideBtnIcon:{fontSize:18},
  main:{flex:1,overflowY:"auto",paddingBottom:70},
  tabs:{display:"flex",background:"#060401",borderTop:`1px solid ${BORDER}`,position:"fixed",bottom:0,left:0,right:0,zIndex:100},
  tab:{flex:1,padding:"12px 4px",background:"none",border:"none",color:TEXT_DIM,fontSize:20,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"},
  tabActive:{color:GOLD,borderTop:`2px solid ${GOLD}`,fontWeight:700},
  dashWrap:{padding:"16px"},
  pcGrid:{display:"grid",gridTemplateColumns:"1fr",gap:12},
  periodRow:{display:"flex",gap:6,marginBottom:14},
  periodBtn:{flex:1,padding:"8px",background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:10,color:TEXT_DIM,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"},
  periodActive:{background:"#1A1305",color:GOLD,border:`1px solid ${GOLD_DARK}`,fontWeight:700},
  statRow:{display:"flex",gap:8,marginBottom:14},
  statBox:{flex:1,background:BG_CARD,border:`1px solid ${BORDER_GOLD}`,borderRadius:14,padding:"12px 8px",textAlign:"center"},
  statLabel:{fontSize:11,color:TEXT_DIM,marginBottom:4},
  statValue:{fontSize:18,fontWeight:800},
  section:{background:`linear-gradient(145deg,${BG_BASE},${BG_SECTION})`,border:`1px solid ${BORDER_GOLD}`,borderRadius:16,padding:"14px",marginBottom:12},
  sectionTitle:{fontSize:13,fontWeight:700,color:GOLD,marginBottom:0},
  progressBar:{height:8,background:BORDER,borderRadius:999,overflow:"hidden",marginBottom:6,marginTop:10},
  progressFill:{height:"100%",background:`linear-gradient(90deg,${GOLD_DARK},${GOLD_LIGHT})`,borderRadius:999,transition:"width 1s ease"},
  progressText:{fontSize:13,display:"flex",alignItems:"center"},
  donutRow:{display:"flex",alignItems:"center",gap:16},
  donutLegend:{flex:1},
  legendItem:{display:"flex",alignItems:"center",gap:8,marginBottom:6},
  dot:{width:10,height:10,borderRadius:"50%",display:"inline-block",flexShrink:0},
  legendText:{fontSize:13,color:TEXT_MID},
  barChart:{display:"flex",alignItems:"flex-end",gap:4,height:96},
  barGroup:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  barPair:{display:"flex",gap:2,alignItems:"flex-end",height:80},
  bar:{width:8,borderRadius:"4px 4px 0 0",transition:"height 0.8s ease",minHeight:2},
  barLabel:{fontSize:10,color:TEXT_DIM,marginTop:2},
  barLegend:{display:"flex",gap:14,marginTop:8,fontSize:12,color:TEXT_MID},
  catRow:{display:"flex",alignItems:"center",gap:10,marginBottom:10},
  catIcon:{fontSize:18},
  catInfo:{flex:1},
  catName:{fontSize:12,color:TEXT_MID,marginBottom:3},
  catBarWrap:{height:4,background:BORDER,borderRadius:999,overflow:"hidden"},
  catBar:{height:"100%",background:`linear-gradient(90deg,${GOLD_DARK},${GOLD})`,borderRadius:999},
  catAmt:{fontSize:13,color:GOLD,fontWeight:700},
  calStats:{display:"flex",gap:8,marginBottom:14,marginTop:4},
  calStatBox:{flex:1,background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:"10px 6px",textAlign:"center"},
  calGrid:{display:"flex",flexWrap:"wrap",gap:6},
  calDay:{width:38,height:44,borderRadius:10,background:"#100D06",border:`1px solid ${BORDER}`,color:TEXT_DIM,fontSize:11,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transition:"all 0.2s",fontFamily:"inherit",gap:1},
  calDone:{background:"linear-gradient(145deg,#1A1305,#2A1E08)",border:`1px solid ${GOLD_DARK}`,color:GOLD_LIGHT},
  calToday:{border:`2px solid ${GOLD}`,color:GOLD},
  calDayNum:{fontSize:12,fontWeight:700,lineHeight:1},
  calCheck:{fontSize:9,color:GOLD,lineHeight:1},
  streakBadge:{background:"#1A0E05",border:`1px solid ${GOLD_DARK}`,borderRadius:20,padding:"4px 10px",fontSize:12,color:GOLD,fontWeight:700},
  addWrap:{padding:"16px",maxWidth:600},
  addTitle:{fontSize:20,fontWeight:800,color:GOLD_LIGHT,marginBottom:20,letterSpacing:"0.5px"},
  typeToggle:{display:"flex",gap:8,marginBottom:20},
  typeBtn:{flex:1,padding:"12px",background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:12,color:TEXT_DIM,fontSize:15,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",fontWeight:600},
  typeBtnIncome:{background:"#052e16",border:"1px solid #4ade80",color:"#4ade80"},
  typeBtnExpense:{background:"#2d0a0a",border:"1px solid #f87171",color:"#f87171"},
  field:{marginBottom:16},
  label:{display:"block",fontSize:12,color:TEXT_DIM,marginBottom:8,fontWeight:600,letterSpacing:"0.5px"},
  input:{width:"100%",background:BG_CARD,border:`1px solid ${BORDER_GOLD}`,borderRadius:12,color:TEXT_MAIN,padding:"12px 14px",fontSize:16,fontFamily:"inherit",boxSizing:"border-box",outline:"none"},
  catGrid:{display:"flex",flexWrap:"wrap",gap:8},
  catChip:{padding:"8px 12px",background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:20,color:TEXT_DIM,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"},
  catChipActive:{background:"#1A1305",border:`1px solid ${GOLD}`,color:GOLD},
  submitBtn:{width:"100%",padding:"14px",marginTop:8,background:`linear-gradient(135deg,${GOLD_DARK},${GOLD})`,border:"none",borderRadius:16,color:"#0A0700",fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:"1px"},
  histWrap:{padding:"16px"},
  histRow:{width:"100%",display:"flex",alignItems:"center",gap:12,background:BG_CARD,border:`1px solid ${BORDER_GOLD}`,borderRadius:14,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",boxSizing:"border-box"},
  histDate:{textAlign:"center",minWidth:32},
  histDay:{fontSize:18,fontWeight:800,color:TEXT_MAIN},
  histMonth:{fontSize:10,color:TEXT_DIM},
  histStats:{flex:1,display:"flex",flexDirection:"column",gap:2},
  entryList:{background:BG_SECTION,border:`1px solid ${BORDER}`,borderTop:"none",borderRadius:"0 0 14px 14px",padding:"8px 12px",marginTop:-2},
  entryItem:{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${BORDER}`},
  editBtn:{background:"none",border:`1px solid ${BORDER_GOLD}`,borderRadius:8,padding:"4px 8px",fontSize:14,cursor:"pointer",color:GOLD},
  modalOverlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
  modalBox:{background:"#0E0B05",border:`1px solid ${BORDER_GOLD}`,borderRadius:20,padding:"24px 20px",width:"90%",maxWidth:480,maxHeight:"85vh",overflowY:"auto"},
  modalTitle:{fontSize:18,fontWeight:800,color:GOLD_LIGHT,marginBottom:4},
  deleteBtn:{width:"100%",padding:"12px",marginTop:10,background:"#2d0a0a",border:"1px solid #f87171",borderRadius:12,color:RED,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  cancelBtn:{width:"100%",padding:"12px",marginTop:8,background:BG_CARD,border:`1px solid ${BORDER}`,borderRadius:12,color:TEXT_DIM,fontSize:14,cursor:"pointer",fontFamily:"inherit"},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#080603;}
  .fadeIn{animation:fadeIn 0.3s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .cardHover:hover{transform:translateY(-2px);box-shadow:0 4px 20px rgba(201,168,76,0.15);}
  .progressAnim{animation:grow 1.2s ease;}
  @keyframes grow{from{width:0;}}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:#080603;}
  ::-webkit-scrollbar-thumb{background:#2A2010;border-radius:4px;}
  input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.6) sepia(1) saturate(2) hue-rotate(5deg);}
  @media(min-width:768px){
    .pc-sidebar{display:flex !important;}
    .mobile-tabs{display:none !important;}
    .pc-grid{grid-template-columns:1fr 1fr !important;}
  }
`;
