# Adds the prep-mode password loader, the feedback panel and the visit ping to public/index.html.
# Run after scripts/split-board.js. Refuses to run twice.
import sys
p='public/index.html'; s=open(p).read()
if 'function loadPrep(' in s:
    print("already patched"); sys.exit(0)

def rep(old, new, count=1):
    global s
    assert old in s, "anchor not found: " + old[:60]
    s = s.replace(old, new, count)

# 1. Prep state: never auto-on from the URL hash; the private data is fetched after the admin password.
rep('try{ if(location.hash==="#prep" || localStorage.getItem("cee-prep")==="1") qaState.prep=true; }catch(e){}\nfunction togglePrep(){ qaState.prep=!qaState.prep;',
'''// Prep mode is unlocked with the admin password; the private data is fetched from the server, never shipped in this page.
function setPrep(on){ qaState.prep=on; document.getElementById("pfbtn").hidden=!on; if(!on && pfState.on) closePF(); try{localStorage.setItem("cee-prep",on?"1":"0");}catch(e){} if(!on){ qaState.lens="comp"; if(qaState.group==="gaps"||QA_GROUPS.some(g=>g.id===qaState.group)) qaState.group="all"; } renderQA(); if(pfState.on) renderPF(); }
async function loadPrep(password){
  const r=await fetch("/api/prep",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(password?{password}:{})});
  if(!r.ok) return false;
  const d=await r.json();
  for(const g of d.gaps){ if(QA[g.i]) QA[g.i].gap=g.gap; }
  PORTFOLIO=d.portfolio; PREP_LOADED=true; return true;
}
function askPrep(){
  const box=document.getElementById("prepask"); box.hidden=false; box.querySelector("input").value=""; box.querySelector(".err").hidden=true; box.querySelector("input").focus();
}
async function submitPrep(ev){
  ev.preventDefault(); const box=document.getElementById("prepask"); const pw=box.querySelector("input").value;
  const ok=await loadPrep(pw); if(!ok){ box.querySelector(".err").hidden=false; return; }
  box.hidden=true; setPrep(true); if(!qaState.on) openQA();
}
function togglePrep(){ if(qaState.prep){ setPrep(false); return; } if(PREP_LOADED){ setPrep(true); return; } askPrep(); }
function togglePrepLegacy(){ qaState.prep=!qaState.prep;''')

# 2. Boot: visit ping + silent prep restore while the admin cookie is valid.
rep('applyUI(); renderFlows(); renderNodes(); fitCamera(); renderCrumbs();\n',
'''applyUI(); renderFlows(); renderNodes(); fitCamera(); renderCrumbs();
fetch("/api/ping",{method:"POST"}).then(r=>r.ok?r.json():null).then(d=>{ if(d&&d.name){ const w=document.getElementById("who"); w.textContent=d.name; w.hidden=false; } }).catch(()=>{});
try{ if(localStorage.getItem("cee-prep")==="1"){ loadPrep().then(ok=>{ if(ok) setPrep(true); else localStorage.setItem("cee-prep","0"); }); } }catch(e){}
''')

# 3. Controls: feedback button.
rep('      <button class="ibtn qabtn" id="qabtn" type="button" onclick="toggleQA()"><span id="qalbl"></span></button>\n',
'''      <button class="ibtn qabtn" id="qabtn" type="button" onclick="toggleQA()"><span id="qalbl"></span></button>
      <button class="ibtn qabtn fbbtn" id="fbbtn" type="button" onclick="toggleFB()"><span id="fblbl"></span></button>
      <a class="ibtn qabtn opbtn" id="opbtn" href="/opportunity.html" style="text-decoration:none"><span id="oplbl"></span></a>
''')

# 4. Panels: feedback panel + prep password dialog.
rep('    <section class="qa pf" id="pf" hidden aria-label="Portfolio"><div class="qainner" id="pfinner"></div></section>\n',
'''    <section class="qa pf" id="pf" hidden aria-label="Portfolio"><div class="qainner" id="pfinner"></div></section>
    <section class="qa fb" id="fb" hidden aria-label="Feedback"><div class="qainner" id="fbinner"></div></section>
    <form class="prepask" id="prepask" hidden onsubmit="submitPrep(event)" autocomplete="off">
      <p class="tag">Prep mode · Mode préparation</p>
      <label>Admin password / Mot de passe admin<input type="password" name="password" required></label>
      <p class="err" hidden>Wrong password · Mot de passe incorrect</p>
      <div class="row"><button type="button" class="ibtn" onclick="document.getElementById('prepask').hidden=true">Cancel · Annuler</button><button type="submit" class="ibtn gold">Unlock · Déverrouiller</button></div>
    </form>
''')

# 5. Foot: signed-in name.
rep('    <div class="crumbs" id="crumbs"></div>\n', '    <div class="crumbs" id="crumbs"></div>\n    <span class="who" id="who" hidden></span>\n')

# 6. i18n labels.
rep('qa_prep_on:"Prep mode — private view: stakeholder lens and open points",',
    'qa_prep_on:"Prep mode — private view: stakeholder lens and open points", fb:"Your thoughts", fb_title:"Your thoughts on the model", fb_sub:"This is a working model shared for opinions. Tell us what convinces you, what does not, and what is missing.", fb_rate:"Overall, does the model hold together?", fb_scale:["Not at all","Weak","Mixed","Mostly","Yes, clearly"], fb_q1:"What is the strongest part of the model?", fb_q2:"What is the weakest part, or what would you challenge?", fb_q3:"Anything missing, unclear, or that you would add?", fb_send:"Send", fb_sent:"Thank you — your comments are recorded.", fb_more:"Send another comment", fb_err:"Could not send. Please try again.", op:"Propose a project",')
rep('qa_prep_on:"Mode préparation — vue privée : lecture par partie prenante et points ouverts",',
    'qa_prep_on:"Mode préparation — vue privée : lecture par partie prenante et points ouverts", fb:"Votre avis", fb_title:"Votre avis sur le modèle", fb_sub:"Ce modèle de travail est partagé pour recueillir des opinions. Dites-nous ce qui vous convainc, ce qui ne tient pas, et ce qui manque.", fb_rate:"Dans l\\u2019ensemble, le modèle tient-il la route?", fb_scale:["Pas du tout","Faible","Mitigé","En grande partie","Oui, clairement"], fb_q1:"Quelle est la partie la plus solide du modèle?", fb_q2:"Quelle est la partie la plus faible, ou que remettriez-vous en question?", fb_q3:"Quelque chose de manquant, de flou, ou que vous ajouteriez?", fb_send:"Envoyer", fb_sent:"Merci — vos commentaires sont enregistrés.", fb_more:"Envoyer un autre commentaire", fb_err:"Envoi impossible. Veuillez réessayer.", op:"Proposer un projet",')

# 7. applyUI / setLang hooks.
rep('  document.getElementById("pflbl").textContent = UI[LANG].pf;\n',
    '  document.getElementById("pflbl").textContent = UI[LANG].pf;\n  document.getElementById("fblbl").textContent = UI[LANG].fb;\n  document.getElementById("oplbl").textContent = UI[LANG].op; document.getElementById("opbtn").href = "/opportunity.html?lang=" + LANG;\n')
rep('  if(pfState.on) renderPF();\n', '  if(pfState.on) renderPF();\n  if(fbState.on) renderFB();\n')
# board v13+: the Snapshot page and the feedback panel close each other
if 'function openSnap(){' in s:
    rep('function openSnap(){\n', 'function openSnap(){\n  if(typeof fbState!=="undefined" && fbState.on) closeFB();\n')

# 8. Feedback panel JS.
rep('// ---------- Portfolio panel (prep mode only) ----------',
'''// ---------- Feedback panel ----------
const fbEl=document.getElementById("fb"), fbInner=document.getElementById("fbinner");
let fbState={on:false, rating:0, sent:false, busy:false, err:false, a:{q1:"",q2:"",q3:""}};
function toggleFB(){ fbState.on ? closeFB() : openFB(); }
function openFB(){
  if(typeof snapState!=="undefined" && snapState.on) closeSnap();
  if(qaState.on) closeQA(); if(pfState.on) closePF(); if(state.node) closeAll(); if(tour.on) pauseTour();
  fbState.on=true; fbEl.hidden=false; world.classList.add("away");
  document.getElementById("fbbtn").classList.add("on"); renderFB();
}
function closeFB(){
  fbState.on=false; fbEl.hidden=true; document.getElementById("fbbtn").classList.remove("on");
  if(!state.node && !qaState.on && !pfState.on && !(typeof snapState!=="undefined" && snapState.on)){ world.classList.remove("away"); if(tour.on) showStep(tour.i,false); }
}
function renderFB(){
  const u=UI[LANG];
  if(fbState.sent){
    fbInner.innerHTML=`<div class="qahead"><div><h2>${u.fb_title}</h2><p>${u.fb_sent}</p></div><div class="sactions"><button class="ibtn round" type="button" onclick="closeFB()" aria-label="${u.close}">×</button></div></div>
      <div class="fbform"><div class="row" style="justify-content:flex-start"><button class="ibtn" type="button" onclick="fbState.sent=false;fbState.rating=0;fbState.a={q1:'',q2:'',q3:''};renderFB()">${u.fb_more}</button></div></div>`;
    return;
  }
  fbInner.innerHTML=`<div class="qahead"><div><h2>${u.fb_title}</h2><p>${u.fb_sub}</p></div><div class="sactions"><button class="ibtn round" type="button" onclick="closeFB()" aria-label="${u.close}">×</button></div></div>
    <form class="fbform" onsubmit="sendFB(event)">
      <p class="lbl">${u.fb_rate}</p>
      <div class="scale" role="radiogroup">${u.fb_scale.map((t,i)=>`<button type="button" class="chip${fbState.rating===i+1?' sel':''}" data-r="${i+1}" aria-pressed="${fbState.rating===i+1}"><b>${i+1}</b> ${esc(t)}</button>`).join("")}</div>
      <label><span class="lbl">${u.fb_q1}</span><textarea name="q1" rows="3">${esc(fbState.a.q1)}</textarea></label>
      <label><span class="lbl">${u.fb_q2}</span><textarea name="q2" rows="3">${esc(fbState.a.q2)}</textarea></label>
      <label><span class="lbl">${u.fb_q3}</span><textarea name="q3" rows="3">${esc(fbState.a.q3)}</textarea></label>
      ${fbState.err?`<p class="err">${u.fb_err}</p>`:""}
      <div class="row"><button class="ibtn gold" type="submit" ${fbState.busy?"disabled":""}>${u.fb_send}</button></div>
    </form>`;
  fbInner.querySelectorAll(".scale .chip").forEach(b=>b.addEventListener("click",()=>{ fbState.rating=+b.dataset.r; captureFB(); renderFB(); }));
}
function captureFB(){ const f=fbInner.querySelector("form"); if(!f) return; fbState.a={q1:f.q1.value,q2:f.q2.value,q3:f.q3.value}; }
async function sendFB(ev){
  ev.preventDefault(); captureFB();
  if(!fbState.rating && !fbState.a.q1 && !fbState.a.q2 && !fbState.a.q3) return;
  fbState.busy=true; fbState.err=false; renderFB();
  try{
    const r=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating:fbState.rating||null, strongest:fbState.a.q1, weakest:fbState.a.q2, missing:fbState.a.q3, lang:LANG, context:state.node||(tour.on?"tour":"home")})});
    if(!r.ok) throw new Error(r.status);
    fbState.sent=true;
  }catch(e){ fbState.err=true; }
  fbState.busy=false; renderFB();
}

// ---------- Portfolio panel (prep mode only) ----------''')

# 8b. Snapshot page (board v13+): add "Your thoughts" and "Propose a project" to the closing button row.
if 'snap_foot' in s:
    rep('<button class="ibtn" type="button" onclick="closeSnap();openQA()">${u.snap_qa}</button></div>',
        '<button class="ibtn" type="button" onclick="closeSnap();openQA()">${u.snap_qa}</button><button class="ibtn" type="button" onclick="closeSnap();openFB()">${u.fb}</button><a class="ibtn opbtn" href="/opportunity.html" style="text-decoration:none">${u.op} ↗</a></div>')

# 9. Escape closes the dialog / feedback panel first.
rep('  if(e.key==="Escape"){ if(',
    '  if(e.key==="Escape"){ if(!document.getElementById("prepask").hidden){ document.getElementById("prepask").hidden=true; } else if(fbState.on){ closeFB(); } else if(')

# 10. CSS.
rep('</style>\n\n<div class="spot" id="spot"></div>',
'''  .fbform{padding:6px 26px 26px;display:flex;flex-direction:column;gap:14px;max-width:760px}
  .fbform .lbl{margin:0 0 6px;font-weight:600;color:var(--ivory)}
  .fbform label{display:block}
  .fbform textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:12px;color:var(--ivory);font:400 14px/1.5 var(--body);padding:10px 12px;resize:vertical}
  .fbform textarea:focus{outline:2px solid var(--gold-2);outline-offset:1px}
  .scale{display:flex;gap:6px;flex-wrap:wrap}
  .scale .chip{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:8px 12px;cursor:pointer;font:500 13px/1 var(--body)}
  .scale .chip b{color:var(--gold-2);margin-right:4px}
  .scale .chip.sel{background:var(--gold);color:var(--ink);border-color:var(--gold)} .scale .chip.sel b{color:var(--ink)}
  .fbform .row,.prepask .row{display:flex;gap:10px;justify-content:flex-end}
  .ibtn.gold{background:var(--gold);color:var(--ink);border-color:var(--gold);font-weight:600}
  .ibtn.gold:hover{background:var(--gold-2)}
  .err{color:#F0A0A0;margin:0;font-size:13px}
  .prepask{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(92vw,380px);background:linear-gradient(165deg,#1B3D5A,#102539);border:1px solid rgba(79,184,173,.6);border-radius:18px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px}
  .prepask[hidden]{display:none}
  .prepask .tag{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal-2);margin:0}
  .prepask label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}
  .prepask input{background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:10px;color:var(--ivory);font:500 15px/1 var(--body);padding:10px 12px}
  .opbtn{border-color:rgba(79,184,173,.6);color:var(--teal-2)} .opbtn:hover{border-color:var(--teal-2)}
  .who{font-size:12px;color:var(--dim);margin-left:auto;padding-right:8px}
  .who[hidden]{display:none}
</style>

<div class="spot" id="spot"></div>''')

open(p,'w').write(s)
print("patched public/index.html")
