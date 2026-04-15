// ═══════════════════════════════════════════════════════════════
//  MREC CELL SIZE OPTIMISER  —  app.js
//  Main application logic. Credentials are managed in credentials.js
// ═══════════════════════════════════════════════════════════════

/* ── SCREEN MANAGEMENT ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ── LOGIN ── */
function doLogin() {
  const raw = document.getElementById('inp-user').value;
  const u   = raw.trim().toLowerCase();   // case-insensitive, allow spaces
  const p   = document.getElementById('inp-pass').value; // password: exact match
  const err = document.getElementById('login-err');
  const card = document.getElementById('login-card');

  if (!u || !p) { err.textContent = 'Please enter both username and password.'; shake(card); return; }

  // Look up in credentials object (defined in credentials.js)
  const users = typeof CELLSIZE_USERS !== 'undefined' ? CELLSIZE_USERS : {};
  // Try exact key first, then case-insensitive match
  let match = false;
  for (const [key, val] of Object.entries(users)) {
    if (key.trim().toLowerCase() === u && val === p) { match = true; break; }
  }

  if (match) {
    // Store display name (preserve original case from input)
    sessionStorage.setItem('cellsize_user', raw.trim());
    document.getElementById('logged-user').textContent = raw.trim();
    showScreen('app-screen');
  } else {
    err.textContent = 'Invalid credentials. Please try again.';
    shake(card);
  }
}

function doLogout() {
  sessionStorage.removeItem('cellsize_user');
  document.getElementById('inp-pass').value = '';
  document.getElementById('login-err').textContent = '';
  showScreen('login-screen');
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// Allow Enter key on login form
document.addEventListener('DOMContentLoaded', () => {
  ['inp-user','inp-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  // If already logged in this session, go straight to app
  const saved = sessionStorage.getItem('cellsize_user');
  if (saved) {
    document.getElementById('logged-user').textContent = saved;
    showScreen('app-screen');
  }
});

/* ═══════════════════════════════════════════════════════════════
   APP LOGIC  (cell size analysis)
═══════════════════════════════════════════════════════════════ */
const state = {
  mode: 'multi', files: {}, mapping: {}, desurveyMethod: 'mincurv',
  desurveyed: [], collars: [], results: null, currentStep: 1
};

function goStep(n) {
  state.currentStep = n;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + n).classList.add('active');
  // Sidebar step items
  document.querySelectorAll('.step-item').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if (sn === n) s.classList.add('active');
    else if (sn < n) s.classList.add('done');
  });
  // Header nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active','done');
  });
  const activeTab = document.getElementById('nav-' + n);
  if (activeTab) activeTab.classList.add('active');
  // Mark previous nav tabs as done
  for (let i = 1; i < n; i++) {
    const t = document.getElementById('nav-' + i);
    if (t) t.classList.add('done');
  }
}

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-tab').forEach((t,i) => t.classList.toggle('active', (i===0&&m==='multi')||(i===1&&m==='point')));
  document.getElementById('mode-multi').style.display = m==='multi'?'':'none';
  document.getElementById('mode-point').style.display = m==='point'?'':'none';
  checkStep1Ready();
}

function triggerUpload(t) { document.getElementById('file-'+t).click(); }
function dragOver(e,t) { e.preventDefault(); document.getElementById('zone-'+t).classList.add('dragging'); }
function dragLeave(t) { document.getElementById('zone-'+t).classList.remove('dragging'); }
function dropFile(e,t) { e.preventDefault(); document.getElementById('zone-'+t).classList.remove('dragging'); const f=e.dataTransfer.files[0]; if(f) parseFile(t,f); }
function handleFile(t,input) { if(input.files[0]) parseFile(t,input.files[0]); }

function parseFile(type, file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const data = parseCSV(ev.target.result);
    state.files[type] = data;
    document.getElementById('zone-'+type).classList.add('has-file');
    document.getElementById('fn-'+type).textContent = file.name;
    document.getElementById('rc-'+type).textContent = data.rows.length + ' rows';
    updateSummary(type, data.rows.length);
    checkStep1Ready();
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers:[], rows:[] };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g,''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(delim).map(v => v.trim().replace(/^"|"$/g,''));
    const obj = {};
    headers.forEach((h,i) => obj[h] = vals[i]||'');
    return obj;
  }).filter(r => Object.values(r).some(v => v!==''));
  return { headers, rows };
}

function updateSummary(type, n) {
  const map = {collar:'sum-collars',survey:'sum-surveys',assay:'sum-assays',litho:'sum-litho',point:'sum-assays'};
  if (map[type]) { const el=document.getElementById(map[type]); el.textContent=n.toLocaleString(); el.classList.remove('none'); }
}

function checkStep1Ready() {
  const ok = state.mode==='multi' ? !!(state.files.collar && state.files.survey) : !!state.files.point;
  document.getElementById('btn-step1-next').disabled = !ok;
  if (ok) { document.getElementById('status-dot').classList.add('warn'); document.getElementById('status-text').textContent='Files loaded'; }
}

function loadDemoData() {
  const collarRows=[], surveyRows=[], assayRows=[];
  const nx=7, ny=7, spacing=60;
  let id=1;
  for (let i=0;i<nx;i++) for (let j=0;j<ny;j++) {
    if (Math.random()<0.12) continue;
    const hid='DH'+String(id).padStart(3,'0');
    const x=1000+i*spacing+(Math.random()-0.5)*12;
    const y=2000+j*spacing+(Math.random()-0.5)*12;
    const z=450+(Math.random()-0.5)*18;
    const depth=120+Math.random()*80;
    collarRows.push({HOLEID:hid,X:x.toFixed(2),Y:y.toFixed(2),Z:z.toFixed(2),DEPTH:depth.toFixed(1)});
    const dip=-(55+Math.random()*20), az=270+(Math.random()-0.5)*40;
    surveyRows.push({HOLEID:hid,DEPTH:'0',DIP:dip.toFixed(1),AZIMUTH:az.toFixed(1)});
    surveyRows.push({HOLEID:hid,DEPTH:(depth*0.5).toFixed(1),DIP:(dip-Math.random()*5).toFixed(1),AZIMUTH:(az+(Math.random()-0.5)*10).toFixed(1)});
    surveyRows.push({HOLEID:hid,DEPTH:depth.toFixed(1),DIP:(dip-Math.random()*8).toFixed(1),AZIMUTH:(az+(Math.random()-0.5)*15).toFixed(1)});
    for (let d=0;d<depth;d+=2) {
      const to=Math.min(d+2,depth);
      assayRows.push({HOLEID:hid,FROM:d.toFixed(1),TO:to.toFixed(1),CU_PCT:Math.max(0,0.15+Math.random()*1.2-0.5).toFixed(3),AU_GT:Math.max(0,0.05+Math.random()*0.8).toFixed(3)});
    }
    id++;
  }
  state.files.collar={headers:['HOLEID','X','Y','Z','DEPTH'],rows:collarRows};
  state.files.survey={headers:['HOLEID','DEPTH','DIP','AZIMUTH'],rows:surveyRows};
  state.files.assay={headers:['HOLEID','FROM','TO','CU_PCT','AU_GT'],rows:assayRows};
  state.mode='multi'; setMode('multi');
  ['collar','survey','assay'].forEach(t => {
    document.getElementById('zone-'+t).classList.add('has-file');
    document.getElementById('fn-'+t).textContent='demo_'+t+'.csv';
    document.getElementById('rc-'+t).textContent=state.files[t].rows.length+' rows';
    updateSummary(t, state.files[t].rows.length);
  });
  checkStep1Ready();
}

function proceedToMapping() { buildMappingUI(); goStep(2); }

function buildMappingUI() {
  const container = document.getElementById('mapping-container');
  container.innerHTML = '';
  const configs = state.mode==='multi' ? [
    {key:'collar',label:'Collar File',fields:[{field:'holeid',label:'Hole ID',req:true},{field:'x',label:'Easting X',req:true},{field:'y',label:'Northing Y',req:true},{field:'z',label:'Elevation Z',req:true},{field:'depth',label:'Max Depth',req:false}]},
    {key:'survey',label:'Survey File',fields:[{field:'holeid',label:'Hole ID',req:true},{field:'depth',label:'Depth',req:true},{field:'dip',label:'Dip',req:true},{field:'az',label:'Azimuth',req:true}]},
    {key:'assay',label:'Assay File',fields:[{field:'holeid',label:'Hole ID',req:true},{field:'from',label:'FROM',req:true},{field:'to',label:'TO',req:true}]}
  ] : [{key:'point',label:'Point File',fields:[{field:'holeid',label:'Hole ID',req:true},{field:'x',label:'X',req:true},{field:'y',label:'Y',req:true},{field:'z',label:'Z',req:true},{field:'from',label:'FROM',req:false},{field:'to',label:'TO',req:false}]}];

  const grid = document.createElement('div'); grid.className='mapping-grid';
  configs.forEach(cfg => {
    if (!state.files[cfg.key]) return;
    const headers = state.files[cfg.key].headers;
    const card = document.createElement('div'); card.className='map-card';
    card.innerHTML='<div class="map-card-title">📁 '+cfg.label+'</div>';
    cfg.fields.forEach(f => {
      const guess = guessColumn(headers, f.field);
      const row = document.createElement('div'); row.className='map-row';
      row.innerHTML='<div class="map-field">'+f.label+(f.req?'<span class="required"> *</span>':'')+'</div>'
        +'<select class="map-sel" id="map-'+cfg.key+'-'+f.field+'"><option value="">— select —</option>'
        +headers.map(h=>'<option value="'+h+'"'+(h===guess?' selected':'')+'>'+h+'</option>').join('')+'</select>';
      card.appendChild(row);
    });
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function guessColumn(headers, field) {
  const patterns = {holeid:['holeid','hole_id','hole','dhid','id'],x:['x','east','easting'],y:['y','north','northing'],z:['z','elev','elevation','rl'],depth:['depth','max_depth','eoh','total_depth'],dip:['dip','incl','inclination'],az:['az','azimuth','bearing'],from:['from','from_m','depth_from'],to:['to','to_m','depth_to']};
  const pats = patterns[field]||[field];
  for (const h of headers) { const hl=h.toLowerCase().replace(/[\s\-]/g,'_'); if(pats.some(p=>hl===p||hl.includes(p))) return h; }
  return '';
}

function selectMethod(m) {
  state.desurveyMethod = m;
  ['mincurv','tangential','balanced'].forEach(k => document.getElementById('card-'+k).classList.toggle('selected', k===m));
  const info = {mincurv:'<b>Minimum Curvature</b>: RF = 2/dl × tan(dl/2). Smooth arc between survey stations — industry standard for resource models.',tangential:'<b>Tangential</b>: Projects using dip/azimuth at the START of each interval. Fast but accumulates error in deviated holes.',balanced:'<b>Balanced Tangential</b>: Averages direction vectors at start AND end of each segment. Better than tangential, simpler than minimum curvature.'};
  document.getElementById('method-info-text').innerHTML = info[m];
}

function proceedToDesurvey() {
  saveMappings(); goStep(3); drawPreviewTrace();
}

function saveMappings() {
  state.mapping = {};
  document.querySelectorAll('select.col-select[id^="map-"]').forEach(s => {
    const parts = s.id.split('-'); const src=parts[1]; const field=parts.slice(2).join('-');
    if (!state.mapping[src]) state.mapping[src]={};
    state.mapping[src][field] = s.value;
  });
}

function getCollarData() {
  if (state.mode==='point') {
    const m=state.mapping.point||{};
    return (state.files.point?.rows||[]).reduce((acc,row) => { const hid=row[m.holeid]; if(!acc[hid]) acc[hid]={holeid:hid,x:+row[m.x],y:+row[m.y],z:+row[m.z]}; return acc; },{});
  }
  const m=state.mapping.collar||{}, out={};
  (state.files.collar?.rows||[]).forEach(row => { const hid=row[m.holeid]; out[hid]={holeid:hid,x:+row[m.x],y:+row[m.y],z:+row[m.z],depth:+row[m.depth]}; });
  return out;
}

function getSurveyData() {
  if (state.mode==='point') return null;
  const m=state.mapping.survey||{}, out={};
  (state.files.survey?.rows||[]).forEach(row => { const hid=row[m.holeid]; if(!out[hid]) out[hid]=[]; out[hid].push({depth:+row[m.depth],dip:+row[m.dip],az:+row[m.az]}); });
  Object.values(out).forEach(arr => arr.sort((a,b)=>a.depth-b.depth));
  return out;
}

function runDesurvey() {
  const progress=document.getElementById('desurvey-progress'); progress.classList.add('visible');
  const collars=getCollarData(), surveys=getSurveyData(), holeIds=Object.keys(collars);
  state.collars=Object.values(collars);
  document.getElementById('sum-holes').textContent=holeIds.length;
  document.getElementById('sum-holes').classList.remove('none');
  document.getElementById('hole-count').textContent=holeIds.length+' holes';
  document.getElementById('sum-method').textContent=state.desurveyMethod;
  document.getElementById('sum-method').classList.remove('none');

  const desurveyed=[]; let i=0;
  function processHole(hid) {
    const collar=collars[hid]; if(!collar) return;
    if (state.mode==='point') {
      const m=state.mapping.point||{};
      (state.files.point?.rows||[]).filter(r=>r[m.holeid]===hid).forEach(row => desurveyed.push({holeid:hid,x:+row[m.x],y:+row[m.y],z:+row[m.z],from:+row[m.from]||0,to:+row[m.to]||0}));
      return;
    }
    const survey=surveys?.[hid]; if(!survey||survey.length===0) return;
    const m=state.mapping.assay||{};
    const intervals=(state.files.assay?.rows||[]).filter(r=>r[m.holeid]===hid).map(r=>({from:+r[m.from],to:+r[m.to],raw:r}));
    if (!intervals.length) { for(let d=0;d<=(collar.depth||120);d+=5) { const pt=desurveyPoint(collar,survey,d,state.desurveyMethod); desurveyed.push({...pt,from:d,to:d+5,holeid:hid}); } return; }
    intervals.forEach(iv => { const pt=desurveyPoint(collar,survey,(iv.from+iv.to)/2,state.desurveyMethod); desurveyed.push({...pt,from:iv.from,to:iv.to,holeid:hid,...iv.raw}); });
  }

  function tick() {
    if (i>=holeIds.length) {
      state.desurveyed=desurveyed;
      progress.classList.remove('visible');
      document.getElementById('status-dot').classList.remove('warn');
      document.getElementById('status-dot').classList.add('active');
      document.getElementById('status-text').textContent='Desurveyed';
      drawPreviewTrace();
      setTimeout(()=>goStep(4),400); return;
    }
    processHole(holeIds[i]); i++;
    const pct=Math.round(i/holeIds.length*100);
    document.getElementById('desurvey-prog-fill').style.width=pct+'%';
    document.getElementById('desurvey-prog-pct').textContent=pct+'%';
    addLog('desurvey-log','Processed '+holeIds[i-1]+' ('+desurveyed.length+' pts)');
    requestAnimationFrame(tick);
  }
  tick();
}

function desurveyPoint(collar, survey, depth, method) {
  const toRad=d=>d*Math.PI/180;
  let cx=collar.x, cy=collar.y, cz=collar.z, prevDepth=0;
  for (let si=0;si<survey.length;si++) {
    const s1=survey[si], s2=survey[si+1]||{depth:depth,dip:survey[si].dip,az:survey[si].az};
    const segEnd=Math.min(s2.depth,depth);
    if (prevDepth>=depth) break;
    const dl=segEnd-prevDepth; if(dl<=0){prevDepth=segEnd;continue;}
    const d1=toRad(s1.dip),a1=toRad(s1.az),d2=toRad(s2.dip),a2=toRad(s2.az);
    if (method==='tangential') { cx+=dl*Math.cos(d1)*Math.sin(a1); cy+=dl*Math.cos(d1)*Math.cos(a1); cz+=dl*Math.sin(d1); }
    else if (method==='balanced') { cx+=dl*(Math.cos(d1)*Math.sin(a1)+Math.cos(d2)*Math.sin(a2))/2; cy+=dl*(Math.cos(d1)*Math.cos(a1)+Math.cos(d2)*Math.cos(a2))/2; cz+=dl*(Math.sin(d1)+Math.sin(d2))/2; }
    else { const dl_r=Math.acos(Math.max(-1,Math.min(1,Math.sin(d1)*Math.sin(d2)+Math.cos(d1)*Math.cos(d2)*Math.cos(a2-a1)))); let rf=1; if(dl_r>0.0001) rf=2/dl_r*Math.tan(dl_r/2); cx+=(dl/2)*(Math.cos(d1)*Math.sin(a1)+Math.cos(d2)*Math.sin(a2))*rf; cy+=(dl/2)*(Math.cos(d1)*Math.cos(a1)+Math.cos(d2)*Math.cos(a2))*rf; cz+=(dl/2)*(Math.sin(d1)+Math.sin(d2))*rf; }
    prevDepth=segEnd; if(prevDepth>=depth) break;
  }
  return {x:cx,y:cy,z:cz};
}

function addLog(id, msg) {
  const el=document.getElementById(id); if(!el) return;
  const t=new Date().toTimeString().split(' ')[0];
  const line=document.createElement('div'); line.className='log-line';
  line.innerHTML='<span class="log-time">'+t+'</span><span>'+msg+'</span>';
  el.appendChild(line);
  while(el.children.length>6) el.removeChild(el.firstChild);
}

function drawPreviewTrace() {
  const canvas=document.getElementById('desurvey-canvas');
  const wrap=document.getElementById('desurvey-canvas-wrap');
  const w = wrap.offsetWidth || wrap.parentElement?.offsetWidth || 800;
  canvas.width = w; const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,canvas.width,canvas.height);

  if (!state.collars.length) {
    ctx.fillStyle='#94a3b8'; ctx.font='12px DM Mono, monospace'; ctx.fillText('Load data to see hole traces', canvas.width/2-110, canvas.height/2); return;
  }

  const pts=state.collars;
  const xs=pts.map(p=>p.x),zs=pts.map(p=>p.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs)||1,minZ=Math.min(...zs)-50,maxZ=Math.max(...zs)+10;
  const pad=36, W=canvas.width-pad*2, H=canvas.height-pad*2;
  const tx=x=>pad+(x-minX)/(maxX-minX||1)*W;
  const tz=z=>canvas.height-pad-(z-minZ)/(maxZ-minZ||1)*H;

  // Grid lines
  ctx.strokeStyle='rgba(26,86,168,0.06)'; ctx.lineWidth=1;
  for (let i=0;i<=5;i++) { const y=pad+H*i/5; ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(pad+W,y);ctx.stroke(); }

  const byHole={};
  state.desurveyed.forEach(p=>{if(!byHole[p.holeid])byHole[p.holeid]=[];byHole[p.holeid].push(p);});
  const colors=['#1a56a8','#2563eb','#3b82f6','#0d9488','#15803d','#7c3aed'];

  Object.keys(byHole).forEach((hid,idx) => {
    const pts2=byHole[hid].sort((a,b)=>a.from-b.from);
    if(pts2.length<2) return;
    const collar=state.collars.find(c=>c.holeid===hid); if(!collar) return;
    ctx.beginPath(); ctx.moveTo(tx(collar.x),tz(collar.z));
    pts2.forEach(p=>ctx.lineTo(tx(p.x),tz(p.z)));
    ctx.strokeStyle=colors[idx%colors.length]; ctx.lineWidth=1.5; ctx.globalAlpha=0.65; ctx.stroke(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(tx(collar.x),tz(collar.z),3,0,Math.PI*2);
    ctx.fillStyle=colors[idx%colors.length]; ctx.fill();
  });

  ctx.fillStyle='#94a3b8'; ctx.font='10px DM Mono, monospace';
  ctx.fillText('→ Easting (X)', pad, canvas.height-6);
  ctx.save(); ctx.translate(13,canvas.height/2); ctx.rotate(-Math.PI/2); ctx.fillText('Elevation (Z) ↑',-30,0); ctx.restore();
}

function runAnalysis() {
  const progress=document.getElementById('analysis-progress'); progress.classList.add('visible');
  const steps=['Computing collar positions...','Building nearest-neighbour index...','Calculating E-W / N-S spacings...','Estimating variogram range...','Computing composite lengths...','Evaluating six criteria...','Synthesising recommendation...'];
  let si=0;
  function tick() {
    if (si>=steps.length) { progress.classList.remove('visible'); computeResults(); goStep(5); setTimeout(()=>{ if(state.results) drawSpatialCanvas(state.results); drawPreviewTrace(); },50); return; }
    addLog('analysis-log',steps[si]);
    const pct=Math.round((si+1)/steps.length*100);
    document.getElementById('analysis-prog-fill').style.width=pct+'%';
    document.getElementById('analysis-prog-pct').textContent=pct+'%';
    si++; setTimeout(tick,160);
  }
  tick();
}

function computeResults() {
  const collars=state.collars; if(collars.length<2) return;

  const mean=arr=>arr.length?arr.reduce((s,v)=>s+v,0)/arr.length:0;
  const std=arr=>{ const m=mean(arr); return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/Math.max(arr.length-1,1)); };
  function filter(arr) { if(!arr.length) return arr; const s=[...arr].sort((a,b)=>a-b); const med=s[Math.floor(s.length/2)]; return arr.filter(v=>v<med*4&&v>0.01); }

  // ── TRUE NEAREST-NEIGHBOUR SPACING in X and Y ──
  // For each collar, find the closest other collar in 2D (XY) and record
  // the X-component and Y-component of that vector separately.
  // This avoids the "sort by X and diff" bug which pairs diagonal holes.
  const nnDistXY = []; // {dx, dy, d2D} — one entry per collar
  for (let i=0; i<collars.length; i++) {
    let bestDist=Infinity, bestDX=0, bestDY=0;
    for (let j=0; j<collars.length; j++) {
      if (i===j) continue;
      const dx=Math.abs(collars[j].x-collars[i].x);
      const dy=Math.abs(collars[j].y-collars[i].y);
      const d=Math.sqrt(dx*dx+dy*dy);
      if (d<bestDist) { bestDist=d; bestDX=dx; bestDY=dy; }
    }
    if (bestDist<Infinity) nnDistXY.push({dx:bestDX, dy:bestDY, d2D:bestDist});
  }

  // Mean 2D nearest-neighbour distance (true collar spacing)
  const nn2D = filter(nnDistXY.map(n=>n.d2D));
  const meanSpacing2D = mean(nn2D);

  // E-W and N-S components from nearest-neighbour pairs
  // Use the X and Y projections of the NN vector — gives directional spacing estimate
  const ewRaw = filter(nnDistXY.map(n=>n.dx).filter(v=>v>0.1));
  const nsRaw = filter(nnDistXY.map(n=>n.dy).filter(v=>v>0.1));
  const ewMean = ewRaw.length ? mean(ewRaw) : meanSpacing2D;
  const nsMean = nsRaw.length ? mean(nsRaw) : meanSpacing2D;
  const ewCV = std(ewRaw)/(ewMean||1);
  const nsCV = std(nsRaw)/(nsMean||1);

  // ── VERTICAL: average sample (FROM-TO) length ──
  // This is the correct basis for Z cell size — how densely sampled vertically
  const sampleLens = state.desurveyed.map(p=>p.to-p.from).filter(v=>v>0);
  const sampleLensFilt = filter(sampleLens);
  const avgSampleLen = parseFloat(document.getElementById('param-comp-len').value)
                    || mean(sampleLensFilt) || 2;

  // Also compute vertical extent per hole from desurveyed XYZ
  // (Z-spread / nSamples gives mean vertical sample spacing in 3D)
  const byHole={};
  state.desurveyed.forEach(p=>{if(!byHole[p.holeid])byHole[p.holeid]=[];byHole[p.holeid].push(p);});
  const vertSpacings=[];
  Object.values(byHole).forEach(pts=>{
    if(pts.length<2) return;
    const sorted=pts.sort((a,b)=>a.from-b.from);
    for(let i=1;i<sorted.length;i++){
      const dz=Math.abs(sorted[i].z-sorted[i-1].z);
      if(dz>0) vertSpacings.push(dz);
    }
  });
  const vertMean = mean(filter(vertSpacings)) || avgSampleLen;

  // Horizontal: use 2D NN spacing as the primary measure
  const horiz = meanSpacing2D || (ewMean+nsMean)/2;

  // Variogram range: user input or estimated as ~55% of 2D spacing
  const varRangeInput = parseFloat(document.getElementById('param-var-range').value);
  const varRangeIsAuto = !varRangeInput || isNaN(varRangeInput);
  let varRange = varRangeIsAuto ? horiz * 0.55 : varRangeInput;

  const minSamp = parseInt(document.getElementById('param-min-samples').value)||8;
  const maxSamp = parseInt(document.getElementById('param-max-samples').value)||24;
  const blocksPerRange = parseInt(document.getElementById('param-blocks-per-range').value)||3;
  const smuX=parseFloat(document.getElementById('param-smu-x').value)||null;
  const smuY=parseFloat(document.getElementById('param-smu-y').value)||null;
  const smuZ=parseFloat(document.getElementById('param-smu-z').value)||null;

  // ── SIX CRITERIA ──
  // 1. Drill spacing rule (XY): 40–60% of mean 2D nearest-neighbour spacing
  const cr1 = horiz * 0.5;

  // 2. Variogram range: range / 3 (horizontal)
  const cr2 = varRange / 3;

  // 3. Composite:block ratio (Z): optimal Z block ≈ 1.0–2.0× sample length
  //    (composite should be 0.5–1.0× block size, so block = comp × 1.0–2.0)
  const cr3_z = avgSampleLen * 1.5;

  // Helper: collar extent
  const cMaxX=arr=>Math.max(...arr.map(c=>c.x));
  const cMinX=arr=>Math.min(...arr.map(c=>c.x));
  const cMaxY=arr=>Math.max(...arr.map(c=>c.y));
  const cMinY=arr=>Math.min(...arr.map(c=>c.y));

  // 4. Kriging neighbourhood adequacy
  const collarArea=(cMaxX(collars)-cMinX(collars))*(cMaxY(collars)-cMinY(collars))||1;
  const density=collars.length/collarArea;
  const samplesPerHole=state.desurveyed.length/Math.max(collars.length,1);
  const searchVol=Math.PI*(varRange**2);
  const samplesInSearch=density*searchVol*samplesPerHole;
  const cr4_ideal = samplesInSearch>0 ? varRange*Math.sqrt(minSamp/samplesInSearch) : cr1;

  // 5. Information content: spacing / 4 (≥4 blocks across drill spacing)
  const cr5 = horiz / 4;

  // 6. SMU constraint (horizontal)
  const cr6 = smuX || null;

  // ── SYNTHESISE: separate H and Z recommendations ──
  const horizCriteria = [cr1, cr2, cr5];
  if (cr6) horizCriteria.push(Math.min(cr6, cr1));
  const synthesisedH = mean(horizCriteria);

  // Z synthesis: driven by sample length, not horizontal spacing
  const synthesisedZ = cr3_z;

  // Snap to geologically sensible nice values
  const niceH=[2,2.5,3,4,5,6,8,10,12.5,15,20,25,30,40,50,60,75,100];
  const niceZ=[0.5,1,1.5,2,2.5,3,4,5,6,8,10,12.5,15,20,25];
  const snap=(v,arr)=>arr.reduce((b,c)=>Math.abs(c-v)<Math.abs(b-v)?c:b,arr[0]);
  const recX=snap(synthesisedH, niceH);
  const recY=recX;
  // Z is independent — snap to its own list, not capped by horizontal
  const recZ=snap(synthesisedZ, niceZ);

  // Suitability matrix
  const sizes=[[recX*0.5,recY*0.5,recZ*0.5],[recX*0.75,recY*0.75,recZ*0.75],[recX,recY,recZ],[recX*1.5,recY*1.5,recZ],[recX*2,recY*2,recZ*1.5],[recX*3,recY*3,recZ*2]];
  const suitability=sizes.map(([sx,sy,sz])=>{
    const spacingRatio=sx/horiz;
    const varRatio=sx/varRange;
    const compRatio=avgSampleLen/sz;
    const spacingOk=(spacingRatio>=0.35&&spacingRatio<=0.65);
    const varOk=(varRatio<=0.35);
    const compOk=(compRatio>=0.45&&compRatio<=1.05);
    const overallPct=Math.round(((spacingOk?35:Math.max(0,35-Math.abs(spacingRatio-0.5)*60))+(varOk?30:Math.max(0,30-Math.abs(varRatio-0.33)*50))+(compOk?25:Math.max(0,25-Math.abs(compRatio-0.75)*30))+10));
    let tag='fine';
    if(spacingRatio>=0.4&&spacingRatio<=0.6) tag='optimal';
    else if(spacingRatio>=0.3&&spacingRatio<=0.75) tag='good';
    else if(spacingRatio>0.75) tag='coarse';
    return {sx,sy,sz,spacingRatio,varRatio:varRatio.toFixed(2),compRatio:compRatio.toFixed(2),overallPct:Math.min(100,overallPct),tag};
  });

  state.results={ewMean,nsMean,vertMean,avgSampleLen,varRange,varRangeIsAuto,ewCV,nsCV,recX,recY,recZ,suitability,collars,cr1,cr2,cr3_z,cr4_ideal,cr5,cr6,samplesInSearch,horiz,meanSpacing2D,nn2D,nnDistXY};
  renderResults();
}

function renderResults() {
  const r=state.results; if(!r) return;
  document.getElementById('res-cell-x').textContent=r.recX;
  document.getElementById('res-cell-unit').textContent='× '+r.recY+' × '+r.recZ+' m';
  document.getElementById('res-headline').textContent=r.recX+' × '+r.recY+' × '+r.recZ+' m recommended block size';
  document.getElementById('res-rationale').textContent=
    'X/Y size based on mean 2D collar spacing of '+r.meanSpacing2D.toFixed(1)+' m '
    +'(E-W component: '+r.ewMean.toFixed(1)+' m, N-S: '+r.nsMean.toFixed(1)+' m). '
    +'Z size based on avg sample length of '+r.avgSampleLen.toFixed(1)+' m. '
    +'Est. variogram range: '+r.varRange.toFixed(0)+' m. '
    +'Synthesised from 6 independent criteria.';
  document.getElementById('sum-cell').textContent=r.recX+'×'+r.recY+'×'+r.recZ+' m';
  document.getElementById('sum-cell').classList.remove('none');

  // Metric cards — show meaningful values with correct labels
  const mx=Math.max(r.meanSpacing2D, r.ewMean, r.nsMean, r.vertMean, r.avgSampleLen, r.varRange, 1);
  function setMet(id,val,barId,pct,color){
    document.getElementById(id).textContent=isNaN(val)||val===undefined?'—':val.toFixed(1);
    if(barId){const b=document.getElementById(barId);b.style.width=Math.min(100,pct*100)+'%';if(color)b.style.background=color;}
  }
  // Update metric labels to be accurate
  document.querySelector('#metrics-grid .metric-card:nth-child(1) .metric-label').textContent='Mean 2D Collar Spacing';
  document.querySelector('#metrics-grid .metric-card:nth-child(2) .metric-label').textContent='E-W NN Component';
  document.querySelector('#metrics-grid .metric-card:nth-child(3) .metric-label').textContent='N-S NN Component';
  document.querySelector('#metrics-grid .metric-card:nth-child(4) .metric-label').textContent='Avg Sample Length (Z basis)';

  setMet('met-ew', r.meanSpacing2D, 'met-ew-bar', r.meanSpacing2D/mx);
  setMet('met-ns', r.ewMean, 'met-ns-bar', r.ewMean/mx);
  setMet('met-vert', r.nsMean, 'met-vert-bar', r.nsMean/mx);
  setMet('met-samp', r.avgSampleLen, 'met-samp-bar', r.avgSampleLen/mx);
  setMet('met-var', r.varRange, 'met-var-bar', 0.55, 'var(--gold)');
  document.getElementById('met-reg').textContent=((r.ewCV+r.nsCV)/2).toFixed(2);
  document.getElementById('met-reg-bar').style.width=(Math.max(0,1-(r.ewCV+r.nsCV)/2)*100)+'%';
  document.getElementById('met-holes').textContent=r.collars.length;
  document.getElementById('met-holes-bar').style.width=Math.min(100,r.collars.length/50*100)+'%';
  document.getElementById('met-samples').textContent=state.desurveyed.length.toLocaleString();
  document.getElementById('met-samples-bar').style.width=Math.min(100,state.desurveyed.length/5000*100)+'%';

  // Criteria cards
  function setCrit(idx, val, calc, score) {
    document.getElementById('cr'+idx+'-value').textContent = (val===null||val===undefined||isNaN(val))?'N/A':(typeof val==='string'?val:val.toFixed(1)+' m');
    document.getElementById('cr'+idx+'-calc').textContent = calc;
    document.getElementById('cr'+idx+'-bar').style.width = Math.min(100,score*100)+'%';
    const v = document.getElementById('cr'+idx+'-verdict');
    v.className='criterion-verdict';
    if (val===null||val===undefined||isNaN(val)) { v.classList.add('verdict-na'); v.textContent='N/A'; }
    else if (score>=0.7) { v.classList.add('verdict-good'); v.textContent='Good'; }
    else if (score>=0.4) { v.classList.add('verdict-warn'); v.textContent='Review'; }
    else { v.classList.add('verdict-bad'); v.textContent='Poor'; }
  }

  const spRatio=r.recX/r.meanSpacing2D;
  setCrit(1, r.cr1, '2D spacing '+r.meanSpacing2D.toFixed(1)+'m × 0.50 → XY', spRatio>=0.38&&spRatio<=0.62?1:spRatio>=0.3&&spRatio<=0.72?0.6:0.3);
  const vRatio=r.recX/r.varRange;
  if (r.varRangeIsAuto) {
    // Auto-estimated range — show as informational, not a pass/fail verdict
    document.getElementById('cr2-value').textContent = r.cr2.toFixed(1)+' m';
    document.getElementById('cr2-calc').textContent = 'est. range '+r.varRange.toFixed(1)+'m (= '+r.meanSpacing2D.toFixed(1)+'m × 0.55) ÷ 3 — enter a fitted range for accuracy';
    document.getElementById('cr2-bar').style.width = '40%';
    document.getElementById('cr2-bar').style.background = '#94a3b8';
    const v2=document.getElementById('cr2-verdict'); v2.className='criterion-verdict verdict-est'; v2.textContent='EST.';
  } else {
    setCrit(2, r.cr2, 'fitted range '+r.varRange.toFixed(1)+'m ÷ 3 → XY', vRatio<=0.34?1:vRatio<=0.5?0.65:0.3);
  }
  const cRatio=r.avgSampleLen/r.recZ;
  setCrit(3, r.cr3_z, 'sample len '+r.avgSampleLen.toFixed(1)+'m × 1.5 → Z', cRatio>=0.45&&cRatio<=1.1?1:0.55);
  const sScore=Math.min(1,r.samplesInSearch/12);
  setCrit(4, r.samplesInSearch.toFixed(0)+' est.', 'composites in search ellipsoid', sScore);
  const iRatio=r.meanSpacing2D/r.recX;
  setCrit(5, r.cr5, 'spacing '+r.meanSpacing2D.toFixed(1)+'m ÷ 4 → XY', iRatio>=3&&iRatio<=6?1:iRatio>=2?0.65:0.3);
  if (r.cr6) {
    const smuOk=r.recX<=r.cr6;
    setCrit(6, r.cr6, 'SMU = '+r.cr6+'m (user input)', smuOk?1:0.2);
  } else {
    document.getElementById('cr6-value').textContent='Not set';
    document.getElementById('cr6-calc').textContent='provide SMU for best results';
    document.getElementById('cr6-bar').style.width='0%';
    const v=document.getElementById('cr6-verdict'); v.className='criterion-verdict verdict-na'; v.textContent='N/A';
  }

  // Suitability table
  const tbody=document.getElementById('range-tbody'); tbody.innerHTML='';
  r.suitability.forEach(s => {
    const tr=document.createElement('tr'); if(s.tag==='optimal') tr.classList.add('highlighted');
    const kc=s.overallPct>70?'var(--green)':s.overallPct>40?'var(--gold)':'var(--red)';
    tr.innerHTML='<td style="font-family:var(--mono);font-size:12px;font-weight:600">'+s.sx+' × '+s.sy+' × '+s.sz+' m</td>'
      +'<td style="font-family:var(--mono);font-size:11.5px">'+(s.spacingRatio*100).toFixed(0)+'% of spacing</td>'
      +'<td style="font-family:var(--mono);font-size:11.5px">'+s.varRatio+'× range</td>'
      +'<td style="font-family:var(--mono);font-size:11.5px">'+s.compRatio+'</td>'
      +'<td><div class="suitability-bar"><div class="suit-track"><div class="suit-fill" style="width:'+s.overallPct+'%;background:'+kc+'"></div></div><span class="suit-pct">'+s.overallPct+'%</span></div></td>'
      +'<td><span class="tag tag-'+s.tag+'">'+({optimal:'★ Optimal',good:'Good',coarse:'Coarse',fine:'Too Fine'}[s.tag])+'</span></td>';
    tbody.appendChild(tr);
  });

  drawHistogram('hist-ew','hist-ew-labels', r.nn2D, '#1a56a8');
  drawHistogram('hist-ns','hist-ns-labels', r.nnDistXY.map(n=>n.dx).filter(v=>v>0.1), '#2563eb');
  document.getElementById('status-dot').classList.add('active');
  document.getElementById('status-text').textContent='Analysis complete';
}

function drawHistogram(cid, lid, data, color) {
  if (!data.length) return;
  const c=document.getElementById(cid), l=document.getElementById(lid);
  c.innerHTML=''; l.innerHTML='';
  const bins=10, min=Math.min(...data), max=Math.max(...data), bw=(max-min)/bins||1;
  const counts=new Array(bins).fill(0);
  data.forEach(v=>{ const bi=Math.min(bins-1,Math.floor((v-min)/bw)); counts[bi]++; });
  const maxC=Math.max(...counts);
  counts.forEach((cnt,i)=>{ const bar=document.createElement('div'); bar.className='hist-bar'; bar.style.height=(cnt/maxC*100)+'%'; bar.style.background=color; bar.style.opacity='0.75'; bar.title=(min+i*bw).toFixed(0)+'–'+(min+(i+1)*bw).toFixed(0)+' m: '+cnt; c.appendChild(bar); });
  [min,min+bw*5,max].forEach(v=>{ const sp=document.createElement('span'); sp.textContent=v.toFixed(0)+'m'; l.appendChild(sp); });
}

// ── INTERACTIVE MAP STATE ──
const mapState = {
  zoom: 1, panX: 0, panY: 0,
  dragging: false, lastMX: 0, lastMY: 0,
  cellSize: 20,
  worldMinX:0, worldMaxX:1, worldMinY:0, worldMaxY:1,
  inited: false
};

function initMap(r) {
  const wrap = document.getElementById('spatial-canvas-wrap');
  const canvas = document.getElementById('spatial-canvas');
  const W = wrap.offsetWidth || 900, H = wrap.offsetHeight || 440;
  canvas.width = W; canvas.height = H;

  const collars = r.collars;
  const xs = collars.map(c=>c.x), ys = collars.map(c=>c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const padW = (maxX-minX)*0.12||40, padH = (maxY-minY)*0.12||40;
  mapState.worldMinX = minX-padW; mapState.worldMaxX = maxX+padW;
  mapState.worldMinY = minY-padH; mapState.worldMaxY = maxY+padH;

  // Fit to view
  const wW = mapState.worldMaxX - mapState.worldMinX;
  const wH = mapState.worldMaxY - mapState.worldMinY;
  const fitZoom = Math.min((W-80)/wW, (H-80)/wH);
  mapState.zoom = fitZoom;
  mapState.panX = (W - wW*fitZoom)/2 - mapState.worldMinX*fitZoom;
  mapState.panY = (H - wH*fitZoom)/2 + mapState.worldMaxY*fitZoom;

  // Set slider to recommended cell size
  mapState.cellSize = r.recX;
  const slider = document.getElementById('cell-slider');
  const maxSlide = Math.max(200, r.recX * 6);
  slider.max = maxSlide;
  slider.value = r.recX;
  document.getElementById('cell-slider-label').textContent = r.recX + ' m';

  if (!mapState.inited) {
    attachMapEvents(canvas, wrap);
    mapState.inited = true;
  }
  mapState.inited = true;
  redrawMap();
}

function worldToCanvas(wx, wy) {
  return {
    x: wx * mapState.zoom + mapState.panX,
    y: -wy * mapState.zoom + mapState.panY
  };
}

function canvasToWorld(cx, cy) {
  return {
    x: (cx - mapState.panX) / mapState.zoom,
    y: -(cy - mapState.panY) / mapState.zoom
  };
}

function redrawMap() {
  const r = state.results; if (!r || !r.collars.length) return;
  const canvas = document.getElementById('spatial-canvas');
  const wrap = document.getElementById('spatial-canvas-wrap');
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  // Background
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,W,H);

  // Subtle world boundary fill
  const tl = worldToCanvas(mapState.worldMinX, mapState.worldMaxY);
  const br = worldToCanvas(mapState.worldMaxX, mapState.worldMinY);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);

  const cell = mapState.cellSize;
  if (cell <= 0) return;

  // Pixel size of one cell
  const cellPx = cell * mapState.zoom;

  // Compute visible world bounds
  const topLeft = canvasToWorld(0, 0);
  const botRight = canvasToWorld(W, H);
  const visMinX = topLeft.x, visMaxX = botRight.x;
  const visMinY = botRight.y, visMaxY = topLeft.y;

  // Grid lines — only draw if cells are at least 4px wide
  if (cellPx >= 4) {
    const gx0 = Math.floor(visMinX/cell)*cell;
    const gy0 = Math.floor(visMinY/cell)*cell;

    // Grid opacity based on zoom
    const gridOpacity = Math.min(0.35, Math.max(0.06, cellPx/200));
    ctx.strokeStyle = `rgba(26,86,168,${gridOpacity})`;
    ctx.lineWidth = cellPx > 30 ? 1 : 0.5;

    ctx.beginPath();
    for (let gx = gx0; gx <= visMaxX+cell; gx += cell) {
      const p = worldToCanvas(gx, 0);
      ctx.moveTo(p.x, 0); ctx.lineTo(p.x, H);
    }
    for (let gy = gy0; gy <= visMaxY+cell; gy += cell) {
      const p = worldToCanvas(0, gy);
      ctx.moveTo(0, p.y); ctx.lineTo(W, p.y);
    }
    ctx.stroke();

    // Cell fill if big enough
    if (cellPx > 20) {
      ctx.fillStyle = 'rgba(219,234,254,0.18)';
      for (let gx = gx0; gx <= visMaxX+cell; gx += cell) {
        for (let gy = gy0; gy <= visMaxY+cell; gy += cell) {
          const p1 = worldToCanvas(gx, gy+cell);
          const p2 = worldToCanvas(gx+cell, gy);
          if (p1.x > W || p2.x < 0 || p1.y > H || p2.y < 0) continue;
          // Checkerboard subtle effect
          const ci = Math.round(gx/cell), cj = Math.round(gy/cell);
          if ((ci+cj)%2===0) {
            ctx.fillRect(p1.x, p1.y, p2.x-p1.x, p2.y-p1.y);
          }
        }
      }
    }

    // Cell size labels at intersections if very zoomed
    if (cellPx > 80) {
      ctx.fillStyle = 'rgba(26,86,168,0.35)';
      ctx.font = `${Math.min(11, cellPx*0.12)}px DM Mono,monospace`;
      ctx.textAlign = 'center';
      for (let gx = gx0; gx <= visMaxX+cell; gx += cell) {
        for (let gy = gy0; gy <= visMaxY+cell; gy += cell) {
          const p = worldToCanvas(gx + cell/2, gy + cell/2);
          if (p.x<0||p.x>W||p.y<0||p.y>H) continue;
          ctx.fillText(`${cell}m`, p.x, p.y+4);
        }
      }
      ctx.textAlign = 'left';
    }
  }

  // Spacing indicators (faint lines between nearest holes)
  const collars = r.collars;
  if (mapState.zoom > 0.5) {
    ctx.strokeStyle = 'rgba(180,83,9,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
    const sorted = [...collars].sort((a,b)=>a.x-b.x);
    for (let i=0; i<sorted.length-1; i++) {
      if (Math.abs(sorted[i+1].x-sorted[i].x) < r.horiz*2) {
        const p1 = worldToCanvas(sorted[i].x, sorted[i].y);
        const p2 = worldToCanvas(sorted[i+1].x, sorted[i+1].y);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // Collar dots
  const dotR = Math.max(3, Math.min(8, mapState.zoom * 6));
  const showLabels = mapState.zoom > 0.3;
  collars.forEach(c => {
    const p = worldToCanvas(c.x, c.y);
    if (p.x < -20 || p.x > W+20 || p.y < -20 || p.y > H+20) return;

    // Shadow
    ctx.beginPath(); ctx.arc(p.x, p.y, dotR+2, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(26,86,168,0.12)'; ctx.fill();

    // Dot
    ctx.beginPath(); ctx.arc(p.x, p.y, dotR, 0, Math.PI*2);
    ctx.fillStyle = '#1a56a8'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();

    // Label
    if (showLabels) {
      ctx.fillStyle = '#334155';
      const fs = Math.max(8, Math.min(11, mapState.zoom*9));
      ctx.font = `${fs}px DM Mono,monospace`;
      ctx.fillText(c.holeid, p.x+dotR+3, p.y+4);
    }
  });

  // Axes
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px DM Mono,monospace';
  ctx.fillText('→ Easting (X)', 10, H-8);
  ctx.save(); ctx.translate(14, H/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Northing (Y) ↑', -36, 0); ctx.restore();

  // Legend box
  const lx = W-170, ly = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'var(--border)';
  ctx.lineWidth = 1;
  roundRect(ctx, lx, ly, 158, 52, 6); ctx.fill(); ctx.stroke();

  // Grid swatch
  ctx.fillStyle = 'rgba(219,234,254,0.7)'; ctx.strokeStyle = 'rgba(26,86,168,0.4)';
  ctx.fillRect(lx+10, ly+10, 12, 12); ctx.strokeRect(lx+10, ly+10, 12, 12);
  ctx.fillStyle = '#475569'; ctx.font = '10px DM Mono,monospace';
  ctx.fillText(cell + 'm block grid', lx+26, ly+20);

  ctx.beginPath(); ctx.arc(lx+16, ly+38, 4, 0, Math.PI*2);
  ctx.fillStyle = '#1a56a8'; ctx.fill();
  ctx.strokeStyle = 'white'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.font = '10px DM Mono,monospace';
  ctx.fillText('Collar location', lx+26, ly+42);

  // Scale bar
  drawScaleBar(ctx, W, H);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawScaleBar(ctx, W, H) {
  // Pick a nice round scale bar length in world units
  const barTargetPx = 100;
  const worldPerPx = 1 / mapState.zoom;
  const rawWorld = barTargetPx * worldPerPx;
  const niceVals = [1,2,5,10,20,25,50,100,200,250,500,1000,2000,5000];
  const barWorld = niceVals.reduce((b,v)=>Math.abs(v-rawWorld)<Math.abs(b-rawWorld)?v:b, niceVals[0]);
  const barPx = barWorld * mapState.zoom;

  const bx = 50, by = H-18;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx+barPx, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, by-4); ctx.lineTo(bx, by+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+barPx, by-4); ctx.lineTo(bx+barPx, by+4); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.font = '10px DM Mono,monospace'; ctx.textAlign='center';
  ctx.fillText(barWorld + ' m', bx+barPx/2, by-6);
  ctx.textAlign = 'left';
}

function attachMapEvents(canvas, wrap) {
  // Mouse wheel zoom
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    // Zoom around mouse position
    mapState.panX = mx - (mx - mapState.panX) * factor;
    mapState.panY = my - (my - mapState.panY) * factor;
    mapState.zoom *= factor;
    redrawMap();
  }, { passive: false });

  // Drag pan
  wrap.addEventListener('mousedown', e => {
    mapState.dragging = true;
    mapState.lastMX = e.clientX; mapState.lastMY = e.clientY;
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!mapState.dragging) {
      // Coordinate readout
      if (state.currentStep===5) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX-rect.left, my = e.clientY-rect.top;
        if (mx>=0&&mx<=canvas.width&&my>=0&&my<=canvas.height) {
          const w = canvasToWorld(mx, my);
          document.getElementById('map-coords').textContent = 'E: '+w.x.toFixed(1)+'  N: '+w.y.toFixed(1);
        }
      }
      return;
    }
    const dx = e.clientX - mapState.lastMX, dy = e.clientY - mapState.lastMY;
    mapState.panX += dx; mapState.panY += dy;
    mapState.lastMX = e.clientX; mapState.lastMY = e.clientY;
    redrawMap();
  });
  window.addEventListener('mouseup', () => {
    mapState.dragging = false;
    const wrap2 = document.getElementById('spatial-canvas-wrap');
    if (wrap2) wrap2.style.cursor = 'grab';
  });

  // Touch support
  let lastTouchDist = null;
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length===1) { mapState.dragging=true; mapState.lastMX=e.touches[0].clientX; mapState.lastMY=e.touches[0].clientY; }
    if (e.touches.length===2) { lastTouchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); }
    e.preventDefault();
  },{passive:false});
  wrap.addEventListener('touchmove', e => {
    if (e.touches.length===1 && mapState.dragging) {
      const dx=e.touches[0].clientX-mapState.lastMX, dy=e.touches[0].clientY-mapState.lastMY;
      mapState.panX+=dx; mapState.panY+=dy;
      mapState.lastMX=e.touches[0].clientX; mapState.lastMY=e.touches[0].clientY;
      redrawMap();
    }
    if (e.touches.length===2 && lastTouchDist!==null) {
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      const factor=d/lastTouchDist; lastTouchDist=d;
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      const rect=canvas.getBoundingClientRect();
      const mx=cx-rect.left, my=cy-rect.top;
      mapState.panX=mx-(mx-mapState.panX)*factor;
      mapState.panY=my-(my-mapState.panY)*factor;
      mapState.zoom*=factor; redrawMap();
    }
    e.preventDefault();
  },{passive:false});
  wrap.addEventListener('touchend', ()=>{ mapState.dragging=false; lastTouchDist=null; });
}

function mapZoom(factor) {
  const wrap = document.getElementById('spatial-canvas-wrap');
  const cx = wrap.offsetWidth/2, cy = wrap.offsetHeight/2;
  mapState.panX = cx - (cx-mapState.panX)*factor;
  mapState.panY = cy - (cy-mapState.panY)*factor;
  mapState.zoom *= factor;
  redrawMap();
}

function mapReset() {
  if (state.results) initMap(state.results);
}

function onCellSlider(val) {
  mapState.cellSize = parseFloat(val);
  document.getElementById('cell-slider-label').textContent = parseFloat(val).toFixed(0) + ' m';
  redrawMap();
}

function drawSpatialCanvas(r) {
  initMap(r);
}

function exportCSV() {
  const r=state.results; if(!r) return;
  let csv='Criterion,Recommended Cell Size (m),Notes\n';
  csv+='Drill Spacing Rule (40-60%),'+r.cr1.toFixed(1)+',50% of '+r.horiz.toFixed(1)+'m avg spacing\n';
  csv+='Variogram Range Rule,'+r.cr2.toFixed(1)+',Variogram range '+r.varRange.toFixed(0)+'m ÷ 3\n';
  csv+='Composite:Block Ratio (Z),'+r.cr3_z.toFixed(1)+',Composite '+r.avgSampleLen.toFixed(1)+'m × 1.5\n';
  csv+='Kriging Neighbourhood,'+r.cr4_ideal.toFixed(1)+',Est '+r.samplesInSearch.toFixed(0)+' samples in search vol\n';
  csv+='Information Content,'+r.cr5.toFixed(1)+',Avg spacing ÷ 4\n';
  csv+='SMU Constraint,'+(r.cr6||'N/A')+',User-provided SMU\n';
  csv+='\nFINAL RECOMMENDATION,'+r.recX+' x '+r.recY+' x '+r.recZ+' m,Synthesised from all criteria\n';
  csv+='\nSpacing Statistics\nMean E-W,'+r.ewMean.toFixed(2)+'\nMean N-S,'+r.nsMean.toFixed(2)+'\nVariogram Range,'+r.varRange.toFixed(2)+'\nAvg Sample Length,'+r.avgSampleLen.toFixed(2);
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cellsize_criteria_report.csv'; a.click();
}

window.addEventListener('resize', () => {
  if(state.currentStep===3) drawPreviewTrace();
  if(state.currentStep===5&&state.results) drawSpatialCanvas(state.results);
});