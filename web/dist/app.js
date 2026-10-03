function z(e,t){if(t<=0)return 0;return Math.min(Math.max(e,0),t-1)}function We(e,t,n,i){if(t.length===0)throw Error("cannot select from empty history");let a=t.includes(n)?n:t[t.length-1],s=new Set(e.map((m)=>m.key)),o=e.find((m)=>m.key===a),c=new Map(e.map((m)=>[m.commit_id,m.key])),r=o?.parent_ids.map((m)=>c.get(m)).find((m)=>m!=null),l=s.has(i)?i:r??a;return{selectedKey:a,pinnedKey:l,selectedReset:a!==n,pinnedReset:l!==i}}var ft=250000;function G(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((n,i)=>n.hash===t.pages[i]?.hash)}function Ue(e,t){let n=ht(e,t);if(n.filter((r)=>r.unique).length===0)return{pairs:[],confidence:null,shifted:!1,anchorCount:n.length};let a=yt(n),s=[],o=-1,c=-1;return n.forEach((r,l)=>{De(s,o+1,r.leftIndex,c+1,r.rightIndex,Ne(a,l-1,l),l>0),s.push({leftIndex:r.leftIndex,rightIndex:r.rightIndex,relation:"same",confidence:r.unique&&a.has(l)?"high":"medium"}),o=r.leftIndex,c=r.rightIndex}),De(s,o+1,e.length,c+1,t.length,Ne(a,n.length-1,n.length),!1),{pairs:s,confidence:a.size>0?"high":"medium",shifted:s.some((r)=>r.leftIndex===null||r.rightIndex===null||r.leftIndex!==r.rightIndex),anchorCount:n.length}}function Oe(e,t,n){return e.pairs.find((i)=>t==="left"?i.leftIndex===n:i.rightIndex===n)}function ve(e){if(e.leftIndex===null||e.rightIndex===null)return;return{pageA:e.leftIndex,pageB:e.rightIndex}}function ht(e,t){if((e.length+1)*(t.length+1)>ft)return[];let n=je(e),i=je(t),a=Array.from({length:e.length+1},()=>Array(t.length+1).fill(0));for(let r=e.length-1;r>=0;r-=1)for(let l=t.length-1;l>=0;l-=1)a[r][l]=e[r].hash===t[l].hash?a[r+1][l+1]+1:Math.max(a[r+1][l],a[r][l+1]);let s=[],o=0,c=0;while(o<e.length&&c<t.length){let r=e[o].hash;if(r===t[c].hash)s.push({leftIndex:o,rightIndex:c,unique:n.get(r)===1&&i.get(r)===1}),o+=1,c+=1;else if(a[o+1][c]>=a[o][c+1])o+=1;else c+=1}return s}function je(e){let t=new Map;return e.forEach((n)=>t.set(n.hash,(t.get(n.hash)??0)+1)),t}function yt(e){let t=new Set;for(let n=1;n<e.length;n+=1){let i=e[n-1],a=e[n];if(i.unique&&a.unique&&a.leftIndex===i.leftIndex+1&&a.rightIndex===i.rightIndex+1)t.add(n-1),t.add(n)}return t}function Ne(e,t,n){return e.has(t)||e.has(n)?"high":"medium"}function De(e,t,n,i,a,s,o){let c=n-t,r=a-i;if(o&&c===r){for(let l=0;l<c;l+=1)e.push({leftIndex:t+l,rightIndex:i+l,relation:"changed",confidence:"medium"});return}for(let l=t;l<n;l+=1)e.push({leftIndex:l,rightIndex:null,relation:"removed",confidence:s});for(let l=i;l<a;l+=1)e.push({leftIndex:null,rightIndex:l,relation:"added",confidence:s})}function N(e){return e.slice(0,8)}function X(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return gt(e);case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function gt(e){return`${e.pages.length} page${e.pages.length===1?"":"s"}`}function se(e){let t=e?.placeholder_files?.length??0;if(t===0)return"";return`${t} missing figure${t===1?"":"s"} substituted`}function Ye(e,t){let n=new Map(e.map((l)=>[l.key,l])),i=new Map(e.map((l)=>[l.commit_id,l.key])),a=new Set(t.map((l)=>n.get(l)?.commit_id).filter((l)=>Boolean(l))),s=[],o=[];t.forEach((l,m)=>{let v=n.get(l);if(!v)return;let y=s.indexOf(v.commit_id);if(y<0)y=s.length;else s.splice(y,1);o.push({key:l,row:m,lane:y}),v.parent_ids.filter(($)=>a.has($)).forEach(($,x)=>{if(s.includes($))return;s.splice(Math.min(y+x,s.length),0,$)})});let c=new Map(o.map((l)=>[l.key,l])),r=t.flatMap((l)=>{let m=n.get(l);if(!m||!c.has(l))return[];return m.parent_ids.flatMap((v,y)=>{let $=i.get(v);if(!$||!c.has($))return[];return[{child:l,parent:$,merge:y>0}]})});return{nodes:o,edges:r,laneCount:Math.max(1,...o.map((l)=>l.lane+1))}}class $e{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(e,t=window.requestAnimationFrame.bind(window),n=window.cancelAnimationFrame.bind(window)){this.apply=e;this.scheduleFrame=t;this.cancelFrame=n}schedule(e){if(this.latest=e,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let e=this.latest;this.latest=void 0,this.pending=!1,this.apply(e)}}class Me{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(e,t,n=performance.now.bind(performance),i=window.setTimeout.bind(window),a=window.clearTimeout.bind(window)){this.interval=e;this.apply=t;this.now=n;this.scheduleDelay=i;this.cancelDelay=a}schedule(e){this.latest=e;let t=this.interval-(this.now()-this.lastApplied);if(t<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,t))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let e=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(e)}}class Le{select;changed;schedule;cancel;keys=[];position=0;timer;generation=0;presented=!1;delay=1000;playing=!1;constructor(e,t,n=window.setTimeout.bind(window),i=window.clearTimeout.bind(window)){this.select=e;this.changed=t;this.schedule=n;this.cancel=i}start(e,t){if(this.stop(),e.length<2)return;this.keys=[...e];let n=e.indexOf(t);this.position=n>=0&&n<e.length-1?n:0,this.playing=!0,this.selectCurrent()}stop(e=""){if(this.generation+=1,this.timer!==void 0)this.cancel(this.timer);this.timer=void 0,this.presented=!1,this.playing=!1,this.changed(e)}setSpeed(e){if(![0.5,1,2,4].includes(e))return;if(this.delay=1000/e,this.playing&&this.presented)this.hold()}ready(e){if(!this.playing||e!==this.keys[this.position]||this.presented)return;if(this.presented=!0,this.position===this.keys.length-1)this.stop("Playback complete");else this.changed("Playing"),this.hold()}failed(e,t){if(this.playing&&e===this.keys[this.position])this.stop(t)}selectCurrent(){this.presented=!1,this.changed("Waiting for render…"),this.select(this.keys[this.position])}hold(){if(this.timer!==void 0)this.cancel(this.timer);let e=++this.generation;this.timer=this.schedule(()=>{if(!this.playing||e!==this.generation)return;this.timer=void 0,this.position+=1,this.selectCurrent()},this.delay)}}var J=location.pathname.replace(/\/$/,""),Te=new Worker(`${J}/diff-worker.js`,{type:"module"}),w=u("#app"),bt=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),vt=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),d,fe=new Map,et=new Map,tt=new Map,he=new Map,p=0,M=0,L=1,S=0,T=0,F="right",b="single",E="first-parent",I=50,we=!1,P=!1,re=0,Q=!1,_=0,nt=0,le=!1,q=new Map,de=new Set,ce=new Map,f=new Le((e)=>ae(k(e),!0,!0),(e)=>K(e)),Z=new $e((e)=>{ae(e,!1)}),Je=new Me(50,(e)=>{fetch(`${J}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.revisionKey,pinned_revision_key:e.pinnedRevisionKey,history_mode:e.historyMode,generation:e.generation})}).then((t)=>{if(!t.ok)throw Error("Focus request failed")}).catch(()=>{if(e.generation===nt)f.failed(e.revisionKey,"Playback stopped: could not request render")})});Te.addEventListener("error",(e)=>{let t=document.querySelector("#heatmap-label");if(t)t.textContent=`Could not calculate heatmap: ${e.message}`});$t();async function $t(){w.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${J}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");d=await e.json(),it(),p=k(d.history.first_parent_keys[0]),M=p,L=k(d.history.first_parent_keys[1]??d.history.first_parent_keys[0]),Mt(),Et(),O(!0)}function it(){fe=new Map(d.revisions.map((e)=>[e.key,e])),et=new Map(d.revisions.map((e,t)=>[e.key,t])),tt=new Map(d.revisions.map((e)=>[e.commit_id,e])),he=new Map(d.history.first_parent_keys.map((e,t)=>[e,t])),st(!1)}function at(e,t){if(e.render?.phase==="ready"&&t.phase!=="ready")return!1;return e.render=t,!0}function st(e){for(let[t,n]of ce){let i=fe.get(t);if(!i)continue;let a=at(i,n);if(ce.delete(t),a&&e)ot(i)}}function Mt(){let e=d.repository.root.split("/").filter(Boolean).at(-1)??"repository",t=d.target.missing_figure_roots??[],n=t.length>0?`<p
        class="session-warning"
        role="note"
        title="${h(`Configured missing-figure roots:
${t.join(`
`)}`)}"
      >
        <strong>Approximate render</strong>
        <span>Missing figures use fixed 8:5 placeholders. Page breaks and comparisons are approximate.</span>
      </p>`:"";w.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${h(d.target.entry)}</h1>
        </div>
      </div>
      ${n}
      <div class="repo-facts">
        <span class="vcs">${d.repository.kind}</span>
        <strong>${h(e)}</strong>
        <span id="revision-count">${d.revisions.length} revisions</span>
        <span title="${h(d.compiler)}">${h(d.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${U("single","B")}
          ${U("side","A · B")}
          ${U("blink","Blink")}
          ${U("opacity","Mix")}
          ${U("wipe","Wipe")}
          ${U("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${I}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${I}" aria-label="Comparison position percentage" />
          <span aria-hidden="true">%</span>
        </label>
        <div class="page-controls">
          <label>A <select id="page-a" aria-label="Page for revision A"></select></label>
          <label>B <select id="page-b" aria-label="Page for revision B"></select></label>
        </div>
        <button class="pin" id="pin-a" type="button">Pin B as A</button>
        <div class="pair-suggestion" id="pair-suggestion" hidden>
          <span class="pair-confidence" id="pair-confidence" aria-hidden="true"></span>
          <p id="pair-suggestion-text" role="status" aria-live="polite" aria-atomic="true"></p>
          <button id="apply-pair" type="button"></button>
        </div>
      </section>
      <section class="document-workbench">
        <aside class="revision-note" id="revision-a" aria-label="Pinned revision A"></aside>
        <div class="stage-wrap">
          <div class="stage" id="stage" tabindex="0" aria-live="polite"></div>
          <nav class="page-rail" id="page-rail" aria-label="Document pages"></nav>
        </div>
        <aside class="revision-note" id="revision-b" aria-label="Selected revision B"></aside>
      </section>
    </main>
    <footer class="history-dock">
      <div class="history-heading">
        <div>
          <p class="eyebrow" id="history-title">First-parent history</p>
          <p id="history-description">The main story, oldest at left.</p>
        </div>
        <div class="history-actions">
          <form class="history-limit" id="history-limit-form" aria-busy="false">
            <label for="history-limit">Revision limit</label>
            <input
              id="history-limit"
              type="number"
              min="1"
              max="${d.history.max_limit}"
              step="1"
              value="${d.history.limit}"
              aria-describedby="history-limit-help"
            />
            <button type="submit">Load history</button>
            <span id="history-limit-help" class="sr-only">
              Maximum matching revisions in each history view, from 1 to ${d.history.max_limit}.
            </span>
          </form>
          <div class="history-mode-group" role="group" aria-label="History shape">
            <button type="button" data-history-mode="first-parent" aria-pressed="true">First parent</button>
            <button type="button" data-history-mode="full-tree" aria-pressed="false">Full tree</button>
          </div>
          <label class="collapse">
            <input id="collapse" type="checkbox" />
            Hide visually unchanged
          </label>
          <p id="history-limit-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </div>
      </div>
      <div class="revision-scrubber">
        <div class="playback-controls">
          <label for="revision-slider" class="sr-only">Travel through revisions</label>
          <button id="playback-toggle" type="button" aria-pressed="false" title="Play revisions from oldest to newest; replay from the start at the end">Play</button>
          <select id="playback-speed" aria-label="Playback speed" title="Time per rendered revision at 1×: one second">
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
          <span id="playback-status" role="status" aria-live="polite"></span>
        </div>
        <div class="revision-track">
          <input id="revision-slider" type="range" min="0" max="0" value="0" />
          <div class="readiness-rail" id="readiness-rail" aria-label="Revision render readiness"></div>
        </div>
        <output id="revision-position"></output>
      </div>
      <div class="film" id="film" role="listbox" aria-label="Document revisions"></div>
      <div class="tree" id="tree" role="listbox" aria-label="Full revision tree" hidden></div>
    </footer>
  `,Lt(),ke()}function Lt(){u("#playback-toggle").addEventListener("click",()=>{if(f.playing){f.stop("Paused");return}Z.cancel(),f.start([...Y()].reverse(),d.revisions[p].key)}),u("#playback-speed").addEventListener("change",(t)=>{f.setSpeed(Number(t.target.value))}),document.addEventListener("visibilitychange",()=>{if(document.hidden)f.stop("Paused")}),window.addEventListener("pagehide",()=>f.stop()),u("#revision-slider").addEventListener("pointerdown",()=>f.stop()),u("#revision-slider").addEventListener("keydown",()=>f.stop()),u("#history-limit-form").addEventListener("submit",(t)=>{t.preventDefault(),Tt()}),w.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{f.stop(),b=t.dataset.mode,R(),rt(),ge()})}),u("#mix").addEventListener("input",(t)=>{He(Number(t.target.value))}),u("#mix-number").addEventListener("input",(t)=>{He(Number(t.target.value))}),u("#pin-a").addEventListener("click",()=>{f.stop(),_+=1,M=p,T=z(T,d.revisions[M].render?.pages.length??0);let t=L;L=p,S=T,F="right",St(t,L),ne(),Ae(),O(!0),D(p)}),u("#collapse").addEventListener("change",(t)=>{f.stop(),we=t.target.checked,Se(),ye()}),w.querySelectorAll("[data-history-mode]").forEach((t)=>{t.addEventListener("click",()=>{f.stop(),E=t.dataset.historyMode;let n=Be();if(!n.includes(d.revisions[p].key))p=k(n[0]),T=0;F="right",Z.cancel(),_+=1,M=p,ke(),O(!0)})}),u("#revision-slider").addEventListener("input",(t)=>{f.stop();let i=[...Y()].reverse()[Number(t.target.value)];if(i)Z.schedule(k(i))}),u("#revision-slider").addEventListener("change",(t)=>{Z.flush(),O(!0)}),u("#page-a").addEventListener("change",(t)=>{f.stop(),S=Number(t.target.value),F="left",R(),ie(),pe()}),u("#page-b").addEventListener("change",(t)=>{f.stop(),_+=1,T=Number(t.target.value),F="right",R(),ie(),pe(),D(p)}),u("#apply-pair").addEventListener("click",()=>{f.stop();let t=ct(),n=t?ve(t):null;if(!n)return;_+=1,S=n.pageA,T=n.pageB,ne(),D(p)});let e=u("#stage");e.addEventListener("pointerdown",(t)=>{if(b==="blink")P=!0,R();else if(b==="wipe"&&t.button===0)Q=!0,e.setPointerCapture(t.pointerId),Qe(t)}),e.addEventListener("pointermove",(t)=>{if(Q)Qe(t)}),e.addEventListener("pointerup",(t)=>{if(Q)Q=!1,e.releasePointerCapture(t.pointerId)}),window.addEventListener("pointerup",()=>{if(P)P=!1,R();Q=!1}),window.addEventListener("keydown",(t)=>{if(t.target instanceof HTMLInputElement||t.target instanceof HTMLSelectElement)return;if(t.key==="ArrowLeft")Ze(1);else if(t.key==="ArrowRight")Ze(-1);else if(t.code==="Space"&&b==="blink"&&!t.repeat)t.preventDefault(),P=!0,R()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&P)P=!1,R()})}async function Tt(){f.stop();let e=u("#history-limit-form"),t=u("#history-limit"),n=u("#history-limit-form button"),i=u("#history-limit-status"),a=document.activeElement===t||document.activeElement===n,s=Number(t.value);if(i.setAttribute("role","status"),!Number.isInteger(s)||s<1||s>d.history.max_limit){i.textContent=`Choose a revision limit from 1 to ${d.history.max_limit}.`,t.focus();return}if(s===d.history.limit){i.textContent=`History already uses limit ${s}.`;return}e.setAttribute("aria-busy","true"),t.disabled=!0,n.disabled=!0,le=!0,K(),i.textContent=`Loading up to ${s} matching revisions…`;try{let o=await fetch(`${J}/api/history`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({limit:s})}),r=(o.headers.get("content-type")??"").includes("application/json")?await o.json():await o.text();if(!o.ok){let j=typeof r==="string"?r:("error"in r)&&r.error?r.error:"history request failed";throw Error(j)}let l=d.revisions[p].key,m=d.revisions[M].key,v=d.revisions[L].key,y=r,$=E==="first-parent"?y.history.first_parent_keys:y.history.full_tree_keys,x=We(y.revisions,$,l,v),be=y.revisions.some((j)=>j.key===m)?m:x.selectedKey;Z.cancel(),_+=1,d=y,it(),p=k(x.selectedKey),M=k(be),L=k(x.pinnedKey),u("#revision-count").textContent=`${d.revisions.length} revisions`,t.max=String(d.history.max_limit),t.value=String(d.history.limit),ke(),O(!0),D(p);let W=[];if(x.selectedReset)W.push("Previous B was outside the new limit; showing the oldest available revision.");if(x.pinnedReset)W.push("Previous A was outside the new limit; pin moved to B or its parent.");if(W.length>0)i.setAttribute("role","alert");i.textContent=`History updated. ${d.revisions.length} revisions available. ${W.join(" ")}`.trim()}catch(o){i.setAttribute("role","alert"),i.textContent=`Could not update history. Previous limit remains. ${o instanceof Error?o.message:""}`.trim()}finally{if(e.setAttribute("aria-busy","false"),t.disabled=!1,n.disabled=!1,le=!1,K(),st(!0),a)n.focus()}}function Et(){let e=new EventSource(`${J}/api/events`);e.addEventListener("render",(t)=>{let n=JSON.parse(t.data);if(le){ce.set(n.status.revision_key,n.status);return}let i=fe.get(n.status.revision_key);if(!i){ce.set(n.status.revision_key,n.status);return}if(!at(i,n.status))return;if(ot(i),n.status.phase==="ready")mt()}),e.onerror=()=>{document.body.dataset.connection="lost",f.stop("Playback stopped: connection lost")},e.onopen=()=>{delete document.body.dataset.connection,K()}}function K(e){let t=w.querySelector("#playback-toggle");if(!t)return;if(t.textContent=f.playing?"Pause":"Play",t.setAttribute("aria-pressed",String(f.playing)),t.disabled=le||document.body.dataset.connection==="lost"||!f.playing&&Y().length<2,e!==void 0)u("#playback-status").textContent=e}function ke(){ut(),lt(),dt(),ie(),Se(),ye(),pe(),R(),ge(),rt(),Ht()}function rt(){w.querySelectorAll("[data-mode]").forEach((n)=>{n.setAttribute("aria-pressed",String(n.dataset.mode===b))});let e=u(".mix-control"),t=b==="opacity"||b==="wipe";e.dataset.visible=String(t),e.hidden=!t,u("#mix-label").textContent=b==="opacity"?"Blend":"Wipe"}function Ht(){w.querySelectorAll("[data-history-mode]").forEach((t)=>{t.setAttribute("aria-pressed",String(t.dataset.historyMode===E))});let e=u("#collapse");e.disabled=E==="full-tree",u("#history-title").textContent=E==="first-parent"?"First-parent history":"Full revision tree",u("#history-description").textContent=E==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function ot(e){Ve(e);let t=he.get(e.key);if(t!=null&&t>0)Ve(A(d.history.first_parent_keys[t-1]));if(we&&E==="first-parent"&&e.render?.phase==="ready")Se(),ye();let n=d.revisions[M],i=k(e.key),a=["ready","entrypoint_missing","error"].includes(e.render?.phase??"");if(i===p&&a){D(i);return}if((i===M||i===L||n.parent_ids[0]===e.commit_id)&&a)ne()}function Ve(e){w.querySelectorAll(`[data-revision-key="${e.key}"]`).forEach((t)=>{if(t.dataset.phase=e.render?.phase??"idle",t.classList.contains("frame")){let i=he.get(e.key),a=i==null?void 0:d.history.first_parent_keys[i+1],s=G(e.render,a?A(a).render:void 0),o=t.querySelector(".frame-meta");if(o)o.innerHTML=`${h(N(e.commit_id))} · ${te(e.render,s)}`}let n=t.querySelector(".tree-meta");if(n)n.innerHTML=`${h(N(e.commit_id))} · ${te(e.render)}`}),w.querySelectorAll(`[data-ready-key="${e.key}"]`).forEach((t)=>{t.dataset.phase=e.render?.phase??"idle",t.dataset.placeholder=String(ee(e.render)),t.title=Ee(e)})}function ee(e){return e?.phase==="ready"&&(e.placeholder_files?.length??0)>0}function wt(e){let t=e?.placeholder_files?.length??0;return`${t} placeholder${t===1?"":"s"}`}function te(e,t=!1){let n=t?"same output":X(e);if(!ee(e))return h(n);let i=se(e);return`${h(n)} · <span class="placeholder-count" title="${h(i)}">${h(wt(e))}</span>`}function Ee(e){let t=se(e.render);return`${e.subject||"(no description)"} · ${X(e.render)}${t?` · ${t}`:""}`}function kt(e){if(!ee(e))return"";let t=se(e),n=(e?.placeholder_files??[]).map((i)=>`<li><code>${h(i)}</code></li>`).join("");return`
    <details class="placeholder-details">
      <summary>${h(t)}</summary>
      <ul>${n}</ul>
    </details>
  `}function ne(){ut(),lt(),dt(),ie(),pe(),R(),ge()}function St(e,t){ue(e,"pinned",!1),ue(t,"pinned",!0)}function xt(e,t,n){if(ue(e,"selected",!1),ue(t,"selected",!0),w.querySelectorAll(`[data-index="${e}"]`).forEach((a)=>{a.setAttribute("aria-selected","false")}),w.querySelectorAll(`[data-index="${t}"]`).forEach((a)=>{a.setAttribute("aria-selected","true")}),!n)return;let i=w.querySelector(`[data-index="${t}"]`);if(i&&E==="full-tree"){let a=u("#tree");a.scrollTop=Math.max(0,i.offsetTop-a.clientHeight/2+i.clientHeight/2)}else if(i){let a=u("#film");a.scrollLeft=Math.max(0,i.offsetLeft-a.clientWidth/2+i.clientWidth/2)}}function ue(e,t,n){w.querySelectorAll(`[data-index="${e}"]`).forEach((i)=>{i.classList.toggle(t,n)})}function lt(){ze(u("#revision-a"),d.revisions[L],"A",L===M),ze(u("#revision-b"),d.revisions[M],"B",!1)}function ze(e,t,n,i){let a=bt.format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${n}</div>
    <p class="revision-date">${a}</p>
    <h2>${h(t.subject||"(no description)")}</h2>
    <p class="revision-author">${h(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${N(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${N(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${te(t.render)}</dd></div>
    </dl>
    ${kt(t.render)}
    ${t.bookmarks.map((s)=>`<span class="bookmark">${h(s)}</span>`).join("")}
    ${i?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function Se(){let e=u("#film"),t=u("#tree");if(e.hidden=E!=="first-parent",t.hidden=E!=="full-tree",E==="full-tree"){At(t);return}let n=e.scrollLeft,i=d.revisions[p].key,a=e.dataset.selectedKey!==i,o=Y().map((r)=>({revision:A(r),index:k(r)})).reverse();e.innerHTML=o.map(({revision:r,index:l})=>{let m=r.render?.phase??"idle",v=he.get(r.key)??-1,y=d.history.first_parent_keys[v+1],$=y?A(y):void 0,x=G(r.render,$?.render);return`
        <button
          class="frame ${l===p?"selected":""} ${l===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${l===p}"
          data-index="${l}"
          data-revision-key="${r.key}"
          data-phase="${m}"
          title="${h(r.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${_e(r.committed_at)}</time>
          <strong>${h(r.subject||"(no description)")}</strong>
          <span class="frame-meta">${h(N(r.commit_id))} · ${te(r.render,x)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((r)=>{r.addEventListener("click",()=>ae(Number(r.dataset.index)))});let c=e.querySelector(".selected");if(e.dataset.selectedKey=i,c&&a)e.scrollLeft=Math.max(0,c.offsetLeft-e.clientWidth/2+c.clientWidth/2);else e.scrollLeft=n}function At(e){let t=d.history.full_tree_keys,n=Ye(d.revisions,t),i=new Map(n.nodes.map((g)=>[g.key,g])),a=e.scrollTop,s=d.revisions[p].key,o=e.dataset.selectedKey!==s,c=58,r=8,l=Math.min(8,n.laneCount),m=34+l*18,v=(g)=>n.laneCount<2?18:16+g/(n.laneCount-1)*(m-32),y=t.length*58+16,$=new Map(n.nodes.map((g)=>[g.key,g.row])),x=n.edges.map((g)=>{let H=i.get(g.child),B=i.get(g.parent);if(!H||!B)return"";let V=$.get(g.child),Ce=$.get(g.parent);if(V==null||Ce==null)return"";let Re=v(H.lane),Ie=8+V*58+29,qe=v(B.lane),Pe=8+Ce*58+29,Fe=(Ie+Pe)/2;return`<path class="${g.merge?"merge-edge":""}" d="M ${Re} ${Ie} C ${Re} ${Fe}, ${qe} ${Fe}, ${qe} ${Pe}" />`}).join(""),be=n.nodes.map((g)=>{let H=$.get(g.key);if(H==null)return"";let B=k(g.key);return`<circle class="${[B===p?"selected":"",B===L?"pinned":""].filter(Boolean).join(" ")}" cx="${v(g.lane)}" cy="${8+H*58+29}" r="5" />`}).join(""),W=n.nodes.map((g)=>{let H=A(g.key),B=k(g.key),V=H.render?.phase??"idle";return`
        <button
          class="tree-node ${B===p?"selected":""} ${B===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${B===p}"
          data-index="${B}"
          data-revision-key="${H.key}"
          data-phase="${V}"
          title="${h(H.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${h(H.subject||"(no description)")}</strong>
            <time>${_e(H.committed_at)}</time>
          </span>
          <span class="tree-meta">${h(N(H.commit_id))} · ${te(H.render)}</span>
        </button>
      `}).join("");e.innerHTML=`
    <div class="tree-canvas" data-lanes="${l}">
      <svg aria-hidden="true" viewBox="0 0 ${m} ${y}" width="${m}" height="${y}">${x}${be}</svg>
      ${W}
    </div>
  `,e.querySelectorAll(".tree-node").forEach((g)=>{g.addEventListener("click",()=>ae(Number(g.dataset.index)))});let j=e.querySelector(".tree-node.selected");if(e.dataset.selectedKey=s,j&&o)e.scrollTop=Math.max(0,j.offsetTop-e.clientHeight/2+j.clientHeight/2);else e.scrollTop=a}function ye(e=!0){K();let t=[...Y()].reverse(),n=u("#revision-slider"),i=d.revisions[p].key,a=Math.max(0,t.indexOf(i));if(n.max=String(Math.max(0,t.length-1)),e)n.value=String(a);let s=t[a]?A(t[a]):void 0;u("#revision-position").textContent=s?`${a+1} / ${t.length} · ${_e(s.committed_at)} · ${s.subject||"(no description)"}`:"No revision",Bt(t)}function Bt(e){let t=u("#readiness-rail"),n=e.join("\x00");if(t.dataset.keys!==n)t.dataset.keys=n,t.innerHTML=e.map((a)=>{let s=A(a);return`<span
          data-ready-key="${s.key}"
          data-phase="${s.render?.phase??"idle"}"
          data-placeholder="${ee(s.render)}"
          title="${h(Ee(s))}"
        ></span>`}).join("");let i=d.revisions[p].key;t.querySelectorAll("[data-ready-key]").forEach((a)=>{let s=a.dataset.readyKey,o=s?A(s):void 0;if(a.dataset.phase=o?.render?.phase??"idle",a.dataset.placeholder=String(ee(o?.render)),o)a.title=Ee(o);a.classList.toggle("selected",s===i)})}function dt(){Ge(u("#page-a"),d.revisions[L].render,S),Ge(u("#page-b"),d.revisions[M].render,T)}function Ge(e,t,n){let i=t?.phase==="ready"?t.pages.length:0;if(i===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:i},(a,s)=>`<option value="${s}" ${s===n?"selected":""}>${s+1}</option>`).join("")}function xe(){let e=d.revisions[L].render,t=d.revisions[M].render;return Ue(e?.phase==="ready"?e.pages:[],t?.phase==="ready"?t.pages:[])}function ct(e=xe()){if(!e.shifted)return null;return Oe(e,F,F==="left"?S:T)??null}function ut(){let e=d.revisions[L].render,t=d.revisions[M].render;if(e?.phase==="ready"&&e.pages.length>0)S=z(S,e.pages.length);if(t?.phase==="ready"&&t.pages.length>0)T=z(T,t.pages.length)}function ie(){let e=u("#pair-suggestion"),t=u("#pair-confidence"),n=u("#pair-suggestion-text"),i=u("#apply-pair");if(p!==M){e.hidden=!0;return}let a=xe(),s=ct(a),o=s?ve(s):null;if(s&&!o){e.hidden=!1,e.dataset.confidence="unpaired",t.hidden=!0,i.hidden=!0,n.textContent=s.rightIndex!=null?`B ${s.rightIndex+1} has no reliable A pair. Choose pages manually.`:`A ${(s.leftIndex??0)+1} has no reliable B pair. Choose pages manually.`;return}if(!s||!s.confidence||!o||s.leftIndex===s.rightIndex){let m=d.revisions[L].render,v=d.revisions[M].render;if(m?.phase==="ready"&&v?.phase==="ready"&&m.pages.length!==v.pages.length&&!a.shifted){e.hidden=!1,e.dataset.confidence="unpaired",t.hidden=!0,i.hidden=!0,n.textContent="Could not align these pages reliably. Choose A and B manually.";return}e.hidden=!0,e.removeAttribute("data-confidence");return}let c=o.pageA+1,r=o.pageB+1,l=S===o.pageA&&T===o.pageB;e.hidden=!1,e.dataset.confidence=s.confidence,t.hidden=!1,t.textContent=`${s.confidence} confidence`,n.textContent=l?`Aligned pair: A ${c} with B ${r}.`:`Likely page shift: A ${c} matches B ${r}.`,i.hidden=l,i.textContent=`Use A ${c} / B ${r}`,i.setAttribute("aria-label",`Use A page ${c} and B page ${r}`)}function pe(){let e=xe(),t=u("#page-rail");if(e.pairs.length===0){let n=d.revisions[L].render,i=d.revisions[M].render,a=n?.phase==="ready"?n.pages:[],s=i?.phase==="ready"?i.pages:[],o=Math.max(a.length,s.length);t.innerHTML=Array.from({length:o},(c,r)=>{let l=a[r],m=s[r];if(!l||!m){let $=l?`A${r+1}`:`B${r+1}`;return`<span class="page-tick unpaired" aria-label="${$} has no reliable pair">${$}</span>`}let v=l.hash===m.hash?"same":"changed",y=S===r&&T===r;return`<button
        type="button"
        class="page-tick ${v} ${y?"active":""}"
        data-page-a="${r}"
        data-page-b="${r}"
        aria-pressed="${y}"
        aria-label="Use physical page ${r+1} for A and B, ${v}"
      >${r+1}</button>`}).join("")}else t.innerHTML=e.pairs.map((n)=>{let i=n.leftIndex==null?null:n.leftIndex+1,a=n.rightIndex==null?null:n.rightIndex+1,s=n.leftIndex===S&&n.rightIndex===T,o=i!=null&&a!=null&&i!==a,c=o?`<span>A${i}</span><span>B${a}</span>`:String(a??i??"—"),r=_t(n);if(n.leftIndex==null||n.rightIndex==null)return`<span
          class="page-tick ${n.relation} unpaired"
          aria-label="${h(r)}"
        >${c}</span>`;return`<button
        type="button"
        class="page-tick ${n.relation} ${s?"active":""} ${o?"shifted":""}"
        data-page-a="${n.leftIndex}"
        data-page-b="${n.rightIndex}"
        aria-pressed="${s}"
        aria-label="${h(r)}"
      >${c}</button>`}).join("");t.querySelectorAll(".page-tick").forEach((n)=>{n.addEventListener("click",()=>{f.stop(),_+=1;let i=n.dataset.pageA,a=n.dataset.pageB;if(i==null||a==null)return;S=Number(i),T=Number(a),F="right",ne(),D(p)})})}function _t(e){let t=e.confidence?`, ${e.confidence} confidence`:"";if(e.leftIndex==null&&e.rightIndex!=null)return`B page ${e.rightIndex+1} has no reliable A pair`;if(e.rightIndex==null&&e.leftIndex!=null)return`A page ${e.leftIndex+1} has no reliable B pair`;return`Use A page ${(e.leftIndex??0)+1} and B page ${(e.rightIndex??0)+1}, ${e.relation}${t}`}function R(){let e=u("#stage"),t=d.revisions[L],n=d.revisions[M],i=me(t.render,S),a=me(n.render,T);if(Ct(e),b==="heatmap"){let c=`${i??"missing"}\x00${a??"missing"}`;if(i&&a&&e.dataset.comparison!==c){e.dataset.comparison=c;let r=u("#heatmap-label");r.textContent="Calculating visual difference…",Rt(i,a)}return}Xe(e.querySelector('[data-page-slot="a"]'),t,i,"A"),Xe(e.querySelector('[data-page-slot="b"]'),n,a,"B");let s=e.querySelector(".blink-pages");s?.classList.toggle("show-a",P),s?.classList.toggle("show-b",!P);let o=e.querySelector(".same-output");if(o)o.hidden=!It(n)}function Ct(e){if(e.dataset.mode===b)return;if(e.dataset.mode=b,e.dataset.comparison="",b==="single")e.innerHTML=`
      <div class="single-page">
        ${C("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(b==="side")e.innerHTML=`<div class="split-pages">${C("a")}${C("b")}</div>`;else if(b==="blink")e.innerHTML=`
      <div class="stack-pages blink-pages show-b">
        ${C("a")}
        ${C("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(b==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${C("a")}
        <div class="overlay-page mix-page">${C("b")}</div>
      </div>
    `;else if(b==="wipe")e.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${C("a")}
        <div class="overlay-page wipe">${C("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function C(e){let t=e.toUpperCase();return`
    <div class="page-slot" data-page-slot="${e}">
      <img class="document-page" alt="Revision ${t}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${t}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function Xe(e,t,n,i){if(!e)return;let a=e.querySelector("img"),s=e.querySelector(".render-status");if(!a||!s)return;if(n&&!de.has(n)){if(a.getAttribute("src")!==n)a.src=n;a.hidden=!1,s.hidden=!0;return}a.hidden=!0,s.hidden=!1;let o=Boolean(n&&de.has(n));s.className=`render-status ${o?"error":t.render?.phase??"idle"}`;let c=s.querySelector("strong"),r=s.querySelector("p");if(c)c.textContent=o?"Could not load page image":X(t.render);if(r)r.textContent=(o?"Select this revision again to retry.":t.render?.message)??(t.render?.phase?"Preparing this revision…":`Select revision ${i} to render it.`)}function He(e){if(!Number.isFinite(e))return;I=Math.min(100,Math.max(0,Math.round(e))),ge()}function ge(){let e=document.querySelector("#mix"),t=document.querySelector("#mix-number");if(e)e.value=String(I);if(t)t.value=String(I);oe(document.querySelector(".mix-page"),{opacity:I/100}),oe(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-I}% 0 0)`}),oe(document.querySelector(".wipe-line"),{left:`${I}%`}),oe(document.querySelector(".wipe-handle"),{left:`${I}%`})}function oe(e,t){if(!e)return;e.getAnimations().forEach((n)=>n.cancel()),e.animate([t,t],{duration:1,fill:"forwards"})}function Qe(e){let t=document.querySelector(".wipe-pages");if(!t)return;let n=t.getBoundingClientRect();He((e.clientX-n.left)/n.width*100)}async function Rt(e,t){let n=++re,i,a;try{[i,a]=await Promise.all([Ke(e),Ke(t)])}catch(s){if(n===re&&b==="heatmap"){let o=document.querySelector("#heatmap-label");if(o)o.textContent=`Could not calculate heatmap: ${String(s)}`}return}if(n!==re||b!=="heatmap"){i.close(),a.close();return}Te.onmessage=(s)=>{let o=s.data;if(o.generation!==re||b!=="heatmap"){o.bitmap.close();return}let c=document.querySelector("#heatmap");if(!c){o.bitmap.close();return}c.width=o.width,c.height=o.height;let r=c.getContext("bitmaprenderer");if(r)r.transferFromImageBitmap(o.bitmap);else c.getContext("2d").drawImage(o.bitmap,0,0),o.bitmap.close();let l=document.querySelector("#heatmap-label");if(l)l.textContent=`${(o.changed/o.total*100).toFixed(2)}% pixels differ`},Te.postMessage({left:i,right:a,scale:1.5,generation:n},[i,a])}function ae(e,t=!0,n=!1){if(!n)f.stop();if(e<0||e>=d.revisions.length)return;_+=1;let i=p;p=e,F="right",xt(i,p,t),ye(t),Ae(),ie(),O(n),D(e)}async function D(e){let t=d.revisions[e];if(!["ready","entrypoint_missing","error"].includes(t.render?.phase??""))return;let i=++_,a=t.render?.pages.length??0,s=z(T,a),o=me(t.render,s);if(o)try{await pt(o),de.delete(o)}catch{if(i!==_||p!==e)return;de.add(o),f.failed(t.key,"Playback stopped: page image could not load")}if(i!==_||p!==e)return;if(M=e,T=s,ne(),Ae(),mt(),t.render?.phase==="ready")f.ready(t.key);else f.failed(t.key,`Playback stopped: ${X(t.render)}`)}function pt(e){let t=q.get(e);if(t)return q.delete(e),q.set(e,t),t;let n=new Image;n.decoding="async";let i=new Promise((a,s)=>{n.addEventListener("load",()=>{n.decode().then(a,a)}),n.addEventListener("error",()=>s(Error(`Could not preload ${e}`))),n.src=e}).catch((a)=>{throw q.delete(e),a});q.set(e,i);while(q.size>12){let a=q.keys().next().value;if(a===void 0)break;q.delete(a)}return i}function mt(){let e=Be(),t=e.indexOf(d.revisions[p].key);for(let n of[-2,-1,1,2]){let i=e[t+n];if(!i)continue;let a=me(A(i).render,T);if(a)pt(a).catch(()=>{return})}}function Ae(){let e=u("#stage"),t=p!==M;e.dataset.previewPending=String(t),e.setAttribute("aria-busy",String(t))}function Ze(e){let t=Y(),n=t.indexOf(d.revisions[p].key);if(n<0)return;let i=Math.min(t.length-1,Math.max(0,n+e));ae(k(t[i]))}function O(e=!1){let t={revisionKey:d.revisions[p].key,pinnedRevisionKey:d.revisions[L].key,historyMode:E,generation:++nt};if(Je.schedule(t),e)Je.flush()}function me(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${J}/assets/${e.render_id}/page/${e.pages[t].number}`}function It(e){let t=tt.get(e.parent_ids[0]);return Boolean(t&&G(e.render,t.render))}function U(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===b}">${t}</button>`}function Be(){return E==="first-parent"?d.history.first_parent_keys:d.history.full_tree_keys}function Y(){let e=Be();if(E==="full-tree"||!we)return e;return e.filter((t,n)=>{if(n===e.length-1)return!0;return!G(A(t).render,A(e[n+1]).render)})}function A(e){let t=fe.get(e);if(!t)throw Error(`Unknown revision: ${e}`);return t}function k(e){return et.get(e)??-1}function _e(e){return vt.format(new Date(e))}async function Ke(e){let t=await new Promise((n,i)=>{let a=new Image;a.decoding="async",a.onload=()=>n(a),a.onerror=()=>i(Error(`Could not load ${e}`)),a.src=e});return createImageBitmap(t)}function u(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function h(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
