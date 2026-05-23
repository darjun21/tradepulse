const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TARIFFS = {
  cn: { furn:{base:0,section301:0.34,total:0.34,hts:'4407.10'}, elec:{base:0,section301:0.25,total:0.25,hts:'8471.30'}, text:{base:0.165,section301:0.075,total:0.24,hts:'6109.10'}, auto:{base:0.025,section301:0.25,total:0.275,hts:'8708.29'}, mach:{base:0,section301:0.25,total:0.25,hts:'8479.89'} },
  vn: { furn:{base:0,section301:0.10,total:0.10,hts:'4407.10'}, elec:{base:0,section301:0,total:0,hts:'8471.30'}, text:{base:0.12,section301:0,total:0.12,hts:'6109.10'}, auto:{base:0.025,section301:0,total:0.025,hts:'8708.29'}, mach:{base:0,section301:0,total:0,hts:'8479.89'} },
  mx: { furn:{base:0,section301:0,total:0,hts:'4407.10',note:'USMCA duty-free'}, elec:{base:0,section301:0,total:0,hts:'8471.30',note:'USMCA duty-free'}, text:{base:0,section301:0,total:0,hts:'6109.10',note:'USMCA duty-free'}, auto:{base:0,section301:0,total:0,hts:'8708.29',note:'USMCA duty-free'}, mach:{base:0,section301:0,total:0,hts:'8479.89',note:'USMCA duty-free'} },
  in: { furn:{base:0,section301:0,total:0,hts:'4407.10'}, elec:{base:0,section301:0,total:0,hts:'8471.30'}, text:{base:0.12,section301:0,total:0.12,hts:'6109.10'}, auto:{base:0.025,section301:0,total:0.025,hts:'8708.29'}, mach:{base:0,section301:0,total:0,hts:'8479.89'} },
  kr: { furn:{base:0,section301:0,total:0,hts:'4407.10',note:'KORUS FTA'}, elec:{base:0,section301:0,total:0,hts:'8471.30',note:'KORUS FTA'}, text:{base:0.08,section301:0,total:0.08,hts:'6109.10',note:'KORUS FTA'}, auto:{base:0.025,section301:0,total:0.025,hts:'8708.29',note:'KORUS FTA'}, mach:{base:0,section301:0,total:0,hts:'8479.89',note:'KORUS FTA'} }
};
const CNAMES = {cn:'China',vn:'Vietnam',mx:'Mexico',in:'India',kr:'South Korea'};
const CATNAMES = {furn:'Furniture',elec:'Electronics',text:'Textiles',auto:'Auto parts',mach:'Machinery'};

const ALERTS = [
  {id:1,severity:'critical',title:'US tariff on Chinese wood products raised to 34%',description:'HTS 4407.10 — Section 301 List 3 increase. Estimated cost increase: $42,000 per $100K shipment. Rerouting to Vietnam recommended.',source:'USTR Section 301',country:'China',timestamp:new Date().toISOString()},
  {id:2,severity:'critical',title:'Shenzhen Furniture Co. — financial distress signal',description:'3 missed payments. Credit score dropped 72→41. Recommend qualifying alternate supplier before next PO.',source:'D&B Business Monitor',timestamp:new Date().toISOString()},
  {id:3,severity:'watch',title:'Vietnam electronics tariff review — proposed +15%',description:'USTR review notice for HTS 8471. Public comment open until June 30, 2026. Consider pre-ordering.',source:'USTR Federal Register',country:'Vietnam',timestamp:new Date().toISOString()},
  {id:4,severity:'info',title:'Port of LA congestion — 8-day delay',description:'Average dwell time 8.3 days due to labor action. 2 tracked shipments affected. Estimated delay: 6–10 days.',source:'MARAD',timestamp:new Date().toISOString()},
  {id:5,severity:'savings',title:'Mexico USMCA duty-free confirmed for auto parts',description:'HTS 8708 qualifies for 0% duty-free. Projected savings: $18,400/quarter.',source:'CBP USMCA Ruling',country:'Mexico',timestamp:new Date().toISOString()}
];

const SUPPLIERS = [
  {name:'Shenzhen Furniture Co.',country:'China',category:'Furniture',score:41,onTime:68,status:'high',trend:'declining'},
  {name:'Hanoi TechParts Ltd',country:'Vietnam',category:'Electronics',score:47,onTime:79,status:'high',trend:'stable'},
  {name:'Monterrey Auto Parts',country:'Mexico',category:'Auto',score:63,onTime:87,status:'medium',trend:'improving'},
  {name:'Guangzhou Textiles',country:'China',category:'Apparel',score:58,onTime:82,status:'medium',trend:'stable'},
  {name:'Taipei Silicon Works',country:'Taiwan',category:'Semiconductors',score:84,onTime:97,status:'low',trend:'stable'},
  {name:'Bangalore BioMed',country:'India',category:'Medical',score:79,onTime:94,status:'low',trend:'improving'}
];

app.get('/api/status', (req,res) => res.json({status:'live',product:'TradePulse',version:'1.0.0',source:'USITC HTS 2026 Rev.7 + USTR Section 301',lastUpdated:new Date().toISOString()}));

app.get('/api/tariffs', (req,res) => res.json({success:true,source:'USITC HTS 2026',data:TARIFFS}));

app.get('/api/tariffs/:country/:category', (req,res) => {
  const {country,category} = req.params;
  const d = TARIFFS[country]?.[category];
  if(!d) return res.status(404).json({success:false,error:'Not found'});
  res.json({success:true,country:CNAMES[country],category:CATNAMES[category],htsCode:d.hts,totalRate:(d.total*100).toFixed(1)+'%',totalRateDecimal:d.total,section301:(d.section301*100).toFixed(1)+'%',baseMFN:(d.base*100).toFixed(1)+'%',tradeAgreement:d.note||null,source:'USITC HTS 2026'});
});

app.post('/api/calculate', (req,res) => {
  const {productValue:pv,country,category,weightLbs:w} = req.body;
  if(!pv||!country||!category) return res.status(400).json({success:false,error:'Missing: productValue, country, category'});
  const d = TARIFFS[country]?.[category];
  if(!d) return res.status(404).json({success:false,error:'Tariff data not found'});
  const val=parseFloat(pv), weight=parseFloat(w)||2000;
  const duty=val*d.total, freight=Math.round(weight*0.65+800);
  const ins=val*0.005, mpf=Math.min(Math.max(val*0.003464,31.67),614.35), hmf=val*0.00125, customs=285;
  const total=val+duty+freight+ins+mpf+hmf+customs;
  const savingsVsChina = country!=='cn' ? val*(TARIFFS.cn[category].total-d.total) : 0;
  res.json({success:true,country:CNAMES[country],category:CATNAMES[category],tariff:{htsCode:d.hts,totalRate:(d.total*100).toFixed(1)+'%',section301:(d.section301*100).toFixed(1)+'%',baseMFN:(d.base*100).toFixed(1)+'%'},costs:{productValue:Math.round(val),dutyTax:Math.round(duty),freight:Math.round(freight),insurance:Math.round(ins),merchandiseProcessingFee:Math.round(mpf),harborMaintenanceFee:Math.round(hmf),customsBrokerage:customs,totalLandedCost:Math.round(total)},savings:{vsChina:Math.round(savingsVsChina),message:savingsVsChina>0?'Saving $'+Math.round(savingsVsChina).toLocaleString()+' vs China':null},tradeAgreement:d.note||null});
});

app.get('/api/alerts', (req,res) => {
  const {severity} = req.query;
  const alerts = severity ? ALERTS.filter(a=>a.severity===severity) : ALERTS;
  res.json({success:true,total:alerts.length,critical:alerts.filter(a=>a.severity==='critical').length,lastChecked:new Date().toISOString(),alerts});
});

app.get('/api/suppliers', (req,res) => res.json({success:true,total:SUPPLIERS.length,highRisk:SUPPLIERS.filter(s=>s.status==='high').length,mediumRisk:SUPPLIERS.filter(s=>s.status==='medium').length,lowRisk:SUPPLIERS.filter(s=>s.status==='low').length,suppliers:SUPPLIERS}));

app.get('/api/compare/:category', (req,res) => {
  const {category} = req.params;
  if(!CATNAMES[category]) return res.status(404).json({success:false,error:'Category not found'});
  const comparison = Object.entries(TARIFFS).map(([code,cats])=>({country:CNAMES[code],code,totalRate:(cats[category].total*100).toFixed(1)+'%',totalRateDecimal:cats[category].total,tradeAgreement:cats[category].note||null})).sort((a,b)=>a.totalRateDecimal-b.totalRateDecimal);
  res.json({success:true,category:CATNAMES[category],cheapest:comparison[0],comparison});
});

app.get('/{*path}', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT||3000;
app.listen(PORT, () => console.log('TradePulse API live on port', PORT));
