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
}import { useState, useEffect, useCallback } from "react";
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
}
