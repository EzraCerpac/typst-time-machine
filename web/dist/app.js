function z(e,t){if(t<=0)return 0;return Math.min(Math.max(e,0),t-1)}function Ue(e,t,n,i){if(t.length===0)throw Error("cannot select from empty history");let a=t.includes(n)?n:t[t.length-1],s=new Set(e.map((m)=>m.key)),l=e.find((m)=>m.key===a),c=new Map(e.map((m)=>[m.commit_id,m.key])),r=l?.parent_ids.map((m)=>c.get(m)).find((m)=>m!=null),o=s.has(i)?i:r??a;return{selectedKey:a,pinnedKey:o,selectedReset:a!==n,pinnedReset:o!==i}}var ht=250000;function G(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((n,i)=>n.hash===t.pages[i]?.hash)}function Oe(e,t){let n=yt(e,t);if(n.filter((r)=>r.unique).length===0)return{pairs:[],confidence:null,shifted:!1,anchorCount:n.length};let a=gt(n),s=[],l=-1,c=-1;return n.forEach((r,o)=>{We(s,l+1,r.leftIndex,c+1,r.rightIndex,De(a,o-1,o),o>0),s.push({leftIndex:r.leftIndex,rightIndex:r.rightIndex,relation:"same",confidence:r.unique&&a.has(o)?"high":"medium"}),l=r.leftIndex,c=r.rightIndex}),We(s,l+1,e.length,c+1,t.length,De(a,n.length-1,n.length),!1),{pairs:s,confidence:a.size>0?"high":"medium",shifted:s.some((r)=>r.leftIndex===null||r.rightIndex===null||r.leftIndex!==r.rightIndex),anchorCount:n.length}}function Ye(e,t,n){return e.pairs.find((i)=>t==="left"?i.leftIndex===n:i.rightIndex===n)}function $e(e){if(e.leftIndex===null||e.rightIndex===null)return;return{pageA:e.leftIndex,pageB:e.rightIndex}}function yt(e,t){if((e.length+1)*(t.length+1)>ht)return[];let n=Ne(e),i=Ne(t),a=Array.from({length:e.length+1},()=>Array(t.length+1).fill(0));for(let r=e.length-1;r>=0;r-=1)for(let o=t.length-1;o>=0;o-=1)a[r][o]=e[r].hash===t[o].hash?a[r+1][o+1]+1:Math.max(a[r+1][o],a[r][o+1]);let s=[],l=0,c=0;while(l<e.length&&c<t.length){let r=e[l].hash;if(r===t[c].hash)s.push({leftIndex:l,rightIndex:c,unique:n.get(r)===1&&i.get(r)===1}),l+=1,c+=1;else if(a[l+1][c]>=a[l][c+1])l+=1;else c+=1}return s}function Ne(e){let t=new Map;return e.forEach((n)=>t.set(n.hash,(t.get(n.hash)??0)+1)),t}function gt(e){let t=new Set;for(let n=1;n<e.length;n+=1){let i=e[n-1],a=e[n];if(i.unique&&a.unique&&a.leftIndex===i.leftIndex+1&&a.rightIndex===i.rightIndex+1)t.add(n-1),t.add(n)}return t}function De(e,t,n){return e.has(t)||e.has(n)?"high":"medium"}function We(e,t,n,i,a,s,l){let c=n-t,r=a-i;if(l&&c===r){for(let o=0;o<c;o+=1)e.push({leftIndex:t+o,rightIndex:i+o,relation:"changed",confidence:"medium"});return}for(let o=t;o<n;o+=1)e.push({leftIndex:o,rightIndex:null,relation:"removed",confidence:s});for(let o=i;o<a;o+=1)e.push({leftIndex:null,rightIndex:o,relation:"added",confidence:s})}function N(e){return e.slice(0,8)}function X(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return bt(e);case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function bt(e){return`${e.pages.length} page${e.pages.length===1?"":"s"}`}function re(e){let t=e?.placeholder_files?.length??0;if(t===0)return"";return`${t} missing figure${t===1?"":"s"} substituted`}function Je(e,t){let n=new Map(e.map((o)=>[o.key,o])),i=new Map(e.map((o)=>[o.commit_id,o.key])),a=new Set(t.map((o)=>n.get(o)?.commit_id).filter((o)=>Boolean(o))),s=[],l=[];t.forEach((o,m)=>{let $=n.get(o);if(!$)return;let y=s.indexOf($.commit_id);if(y<0)y=s.length;else s.splice(y,1);l.push({key:o,row:m,lane:y}),$.parent_ids.filter((M)=>a.has(M)).forEach((M,x)=>{if(s.includes(M))return;s.splice(Math.min(y+x,s.length),0,M)})});let c=new Map(l.map((o)=>[o.key,o])),r=t.flatMap((o)=>{let m=n.get(o);if(!m||!c.has(o))return[];return m.parent_ids.flatMap(($,y)=>{let M=i.get($);if(!M||!c.has(M))return[];return[{child:o,parent:M,merge:y>0}]})});return{nodes:l,edges:r,laneCount:Math.max(1,...l.map((o)=>o.lane+1))}}class Me{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(e,t=window.requestAnimationFrame.bind(window),n=window.cancelAnimationFrame.bind(window)){this.apply=e;this.scheduleFrame=t;this.cancelFrame=n}schedule(e){if(this.latest=e,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let e=this.latest;this.latest=void 0,this.pending=!1,this.apply(e)}}class Le{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(e,t,n=performance.now.bind(performance),i=window.setTimeout.bind(window),a=window.clearTimeout.bind(window)){this.interval=e;this.apply=t;this.now=n;this.scheduleDelay=i;this.cancelDelay=a}schedule(e){this.latest=e;let t=this.interval-(this.now()-this.lastApplied);if(t<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,t))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let e=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(e)}}class Te{select;changed;schedule;cancel;keys=[];position=0;timer;generation=0;presented=!1;delay=1000;playing=!1;constructor(e,t,n=window.setTimeout.bind(window),i=window.clearTimeout.bind(window)){this.select=e;this.changed=t;this.schedule=n;this.cancel=i}start(e,t){if(this.stop(),e.length<2)return;this.keys=[...e];let n=e.indexOf(t);this.position=n>=0&&n<e.length-1?n:0,this.playing=!0,this.selectCurrent()}stop(e=""){if(this.generation+=1,this.timer!==void 0)this.cancel(this.timer);this.timer=void 0,this.presented=!1,this.playing=!1,this.changed(e)}setSpeed(e){if(![0.5,1,2,4].includes(e))return;if(this.delay=1000/e,this.playing&&this.presented)this.hold()}ready(e){if(!this.playing||e!==this.keys[this.position]||this.presented)return;if(this.presented=!0,this.position===this.keys.length-1)this.stop("Playback complete");else this.changed("Playing"),this.hold()}failed(e,t){if(this.playing&&e===this.keys[this.position])this.stop(t)}selectCurrent(){this.presented=!1,this.changed("Waiting for render…"),this.select(this.keys[this.position])}hold(){if(this.timer!==void 0)this.cancel(this.timer);let e=++this.generation;this.timer=this.schedule(()=>{if(!this.playing||e!==this.generation)return;this.timer=void 0,this.position+=1,this.selectCurrent()},this.delay)}}var J=location.pathname.replace(/\/$/,""),Ee=new Worker(`${J}/diff-worker.js`,{type:"module"}),w=p("#app"),vt=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),$t=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),d,he=new Map,tt=new Map,nt=new Map,ye=new Map,u=0,v=0,L=1,S=0,T=0,F="right",b="single",E="first-parent",P=50,ke=!1,q=!1,Z=0,le=!1,Q=!1,C=0,it=0,de=!1,I=new Map,ce=new Set,pe=new Map,f=new Te((e)=>se(k(e),!0,!0),(e)=>ee(e)),K=new Me((e)=>{se(e,!1)}),Ve=new Le(50,(e)=>{fetch(`${J}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.revisionKey,pinned_revision_key:e.pinnedRevisionKey,history_mode:e.historyMode,generation:e.generation})}).then((t)=>{if(!t.ok)throw Error("Focus request failed")}).catch(()=>{if(e.generation===it)f.failed(e.revisionKey,"Playback stopped: could not request render")})});Ee.addEventListener("error",(e)=>{le=!0;let t=document.querySelector("#heatmap-label");if(t)t.textContent=`Could not calculate heatmap: ${e.message}`;if(b==="heatmap")f.failed(d.revisions[u].key,"Playback stopped: heatmap worker failed")});Mt();async function Mt(){w.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${J}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");d=await e.json(),at(),u=k(d.history.first_parent_keys[0]),v=u,L=k(d.history.first_parent_keys[1]??d.history.first_parent_keys[0]),Lt(),Ht(),O(!0)}function at(){he=new Map(d.revisions.map((e)=>[e.key,e])),tt=new Map(d.revisions.map((e,t)=>[e.key,t])),nt=new Map(d.revisions.map((e)=>[e.commit_id,e])),ye=new Map(d.history.first_parent_keys.map((e,t)=>[e,t])),rt(!1)}function st(e,t){if(e.render?.phase==="ready"&&t.phase!=="ready")return!1;return e.render=t,!0}function rt(e){for(let[t,n]of pe){let i=he.get(t);if(!i)continue;let a=st(i,n);if(pe.delete(t),a&&e)lt(i)}}function Lt(){let e=d.repository.root.split("/").filter(Boolean).at(-1)??"repository",t=d.target.missing_figure_roots??[],n=t.length>0?`<p
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
          <input id="mix" type="range" min="0" max="100" value="${P}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${P}" aria-label="Comparison position percentage" />
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
  `,Tt(),Se()}function Tt(){p("#playback-toggle").addEventListener("click",()=>{if(f.playing){f.stop("Paused");return}if(K.cancel(),b==="heatmap"&&p("#stage").dataset.heatmapState==="error")p("#stage").dataset.comparison="";f.start([...Y()].reverse(),d.revisions[u].key)}),p("#playback-speed").addEventListener("change",(t)=>{f.setSpeed(Number(t.target.value))}),document.addEventListener("visibilitychange",()=>{if(document.hidden)f.stop("Paused")}),window.addEventListener("pagehide",()=>f.stop()),p("#revision-slider").addEventListener("pointerdown",()=>f.stop()),p("#revision-slider").addEventListener("keydown",()=>f.stop()),p("#history-limit-form").addEventListener("submit",(t)=>{t.preventDefault(),Et()}),w.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{f.stop(),b=t.dataset.mode,R(),ot(),be()})}),p("#mix").addEventListener("input",(t)=>{we(Number(t.target.value))}),p("#mix-number").addEventListener("input",(t)=>{we(Number(t.target.value))}),p("#pin-a").addEventListener("click",()=>{f.stop(),C+=1,v=u,T=z(T,d.revisions[v].render?.pages.length??0);let t=L;L=u,S=T,F="right",xt(t,L),ie(),Be(),O(!0),D(u)}),p("#collapse").addEventListener("change",(t)=>{f.stop(),ke=t.target.checked,xe(),ge()}),w.querySelectorAll("[data-history-mode]").forEach((t)=>{t.addEventListener("click",()=>{f.stop(),E=t.dataset.historyMode;let n=Ce();if(!n.includes(d.revisions[u].key))u=k(n[0]),T=0;F="right",K.cancel(),C+=1,v=u,Se(),O(!0)})}),p("#revision-slider").addEventListener("input",(t)=>{f.stop();let i=[...Y()].reverse()[Number(t.target.value)];if(i)K.schedule(k(i))}),p("#revision-slider").addEventListener("change",(t)=>{K.flush(),O(!0)}),p("#page-a").addEventListener("change",(t)=>{f.stop(),S=Number(t.target.value),F="left",R(),ae(),me()}),p("#page-b").addEventListener("change",(t)=>{f.stop(),C+=1,T=Number(t.target.value),F="right",R(),ae(),me(),D(u)}),p("#apply-pair").addEventListener("click",()=>{f.stop();let t=pt(),n=t?$e(t):null;if(!n)return;C+=1,S=n.pageA,T=n.pageB,ie(),D(u)});let e=p("#stage");e.addEventListener("pointerdown",(t)=>{if(b==="blink")q=!0,R();else if(b==="wipe"&&t.button===0)Q=!0,e.setPointerCapture(t.pointerId),Ze(t)}),e.addEventListener("pointermove",(t)=>{if(Q)Ze(t)}),e.addEventListener("pointerup",(t)=>{if(Q)Q=!1,e.releasePointerCapture(t.pointerId)}),window.addEventListener("pointerup",()=>{if(q)q=!1,R();Q=!1}),window.addEventListener("keydown",(t)=>{if(t.target instanceof HTMLInputElement||t.target instanceof HTMLSelectElement)return;if(t.key==="ArrowLeft")Ke(1);else if(t.key==="ArrowRight")Ke(-1);else if(t.code==="Space"&&b==="blink"&&!t.repeat)t.preventDefault(),q=!0,R()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&q)q=!1,R()})}async function Et(){f.stop();let e=p("#history-limit-form"),t=p("#history-limit"),n=p("#history-limit-form button"),i=p("#history-limit-status"),a=document.activeElement===t||document.activeElement===n,s=Number(t.value);if(i.setAttribute("role","status"),!Number.isInteger(s)||s<1||s>d.history.max_limit){i.textContent=`Choose a revision limit from 1 to ${d.history.max_limit}.`,t.focus();return}if(s===d.history.limit){i.textContent=`History already uses limit ${s}.`;return}e.setAttribute("aria-busy","true"),t.disabled=!0,n.disabled=!0,de=!0,ee(),i.textContent=`Loading up to ${s} matching revisions…`;try{let l=await fetch(`${J}/api/history`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({limit:s})}),r=(l.headers.get("content-type")??"").includes("application/json")?await l.json():await l.text();if(!l.ok){let j=typeof r==="string"?r:("error"in r)&&r.error?r.error:"history request failed";throw Error(j)}let o=d.revisions[u].key,m=d.revisions[v].key,$=d.revisions[L].key,y=r,M=E==="first-parent"?y.history.first_parent_keys:y.history.full_tree_keys,x=Ue(y.revisions,M,o,$),ve=y.revisions.some((j)=>j.key===m)?m:x.selectedKey;K.cancel(),C+=1,d=y,at(),u=k(x.selectedKey),v=k(ve),L=k(x.pinnedKey),p("#revision-count").textContent=`${d.revisions.length} revisions`,t.max=String(d.history.max_limit),t.value=String(d.history.limit),Se(),O(!0),D(u);let W=[];if(x.selectedReset)W.push("Previous B was outside the new limit; showing the oldest available revision.");if(x.pinnedReset)W.push("Previous A was outside the new limit; pin moved to B or its parent.");if(W.length>0)i.setAttribute("role","alert");i.textContent=`History updated. ${d.revisions.length} revisions available. ${W.join(" ")}`.trim()}catch(l){i.setAttribute("role","alert"),i.textContent=`Could not update history. Previous limit remains. ${l instanceof Error?l.message:""}`.trim()}finally{if(e.setAttribute("aria-busy","false"),t.disabled=!1,n.disabled=!1,de=!1,ee(),rt(!0),a)n.focus()}}function Ht(){let e=new EventSource(`${J}/api/events`);e.addEventListener("render",(t)=>{let n=JSON.parse(t.data);if(de){pe.set(n.status.revision_key,n.status);return}let i=he.get(n.status.revision_key);if(!i){pe.set(n.status.revision_key,n.status);return}if(!st(i,n.status))return;if(lt(i),n.status.phase==="ready")ft()}),e.onerror=()=>{document.body.dataset.connection="lost",f.stop("Playback stopped: connection lost")},e.onopen=()=>{delete document.body.dataset.connection,ee()}}function ee(e){let t=w.querySelector("#playback-toggle");if(!t)return;if(t.textContent=f.playing?"Pause":"Play",t.setAttribute("aria-pressed",String(f.playing)),t.disabled=de||document.body.dataset.connection==="lost"||!f.playing&&Y().length<2,e!==void 0)p("#playback-status").textContent=e}function Se(){ut(),dt(),ct(),ae(),xe(),ge(),me(),R(),be(),ot(),wt()}function ot(){w.querySelectorAll("[data-mode]").forEach((n)=>{n.setAttribute("aria-pressed",String(n.dataset.mode===b))});let e=p(".mix-control"),t=b==="opacity"||b==="wipe";e.dataset.visible=String(t),e.hidden=!t,p("#mix-label").textContent=b==="opacity"?"Blend":"Wipe"}function wt(){w.querySelectorAll("[data-history-mode]").forEach((t)=>{t.setAttribute("aria-pressed",String(t.dataset.historyMode===E))});let e=p("#collapse");e.disabled=E==="full-tree",p("#history-title").textContent=E==="first-parent"?"First-parent history":"Full revision tree",p("#history-description").textContent=E==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function lt(e){ze(e);let t=ye.get(e.key);if(t!=null&&t>0)ze(A(d.history.first_parent_keys[t-1]));if(ke&&E==="first-parent"&&e.render?.phase==="ready")xe(),ge();let n=d.revisions[v],i=k(e.key),a=["ready","entrypoint_missing","error"].includes(e.render?.phase??"");if(i===u&&a){D(i);return}if((i===v||i===L||n.parent_ids[0]===e.commit_id)&&a)ie()}function ze(e){w.querySelectorAll(`[data-revision-key="${e.key}"]`).forEach((t)=>{if(t.dataset.phase=e.render?.phase??"idle",t.classList.contains("frame")){let i=ye.get(e.key),a=i==null?void 0:d.history.first_parent_keys[i+1],s=G(e.render,a?A(a).render:void 0),l=t.querySelector(".frame-meta");if(l)l.innerHTML=`${h(N(e.commit_id))} · ${ne(e.render,s)}`}let n=t.querySelector(".tree-meta");if(n)n.innerHTML=`${h(N(e.commit_id))} · ${ne(e.render)}`}),w.querySelectorAll(`[data-ready-key="${e.key}"]`).forEach((t)=>{t.dataset.phase=e.render?.phase??"idle",t.dataset.placeholder=String(te(e.render)),t.title=He(e)})}function te(e){return e?.phase==="ready"&&(e.placeholder_files?.length??0)>0}function kt(e){let t=e?.placeholder_files?.length??0;return`${t} placeholder${t===1?"":"s"}`}function ne(e,t=!1){let n=t?"same output":X(e);if(!te(e))return h(n);let i=re(e);return`${h(n)} · <span class="placeholder-count" title="${h(i)}">${h(kt(e))}</span>`}function He(e){let t=re(e.render);return`${e.subject||"(no description)"} · ${X(e.render)}${t?` · ${t}`:""}`}function St(e){if(!te(e))return"";let t=re(e),n=(e?.placeholder_files??[]).map((i)=>`<li><code>${h(i)}</code></li>`).join("");return`
    <details class="placeholder-details">
      <summary>${h(t)}</summary>
      <ul>${n}</ul>
    </details>
  `}function ie(){ut(),dt(),ct(),ae(),me(),R(),be()}function xt(e,t){ue(e,"pinned",!1),ue(t,"pinned",!0)}function At(e,t,n){if(ue(e,"selected",!1),ue(t,"selected",!0),w.querySelectorAll(`[data-index="${e}"]`).forEach((a)=>{a.setAttribute("aria-selected","false")}),w.querySelectorAll(`[data-index="${t}"]`).forEach((a)=>{a.setAttribute("aria-selected","true")}),!n)return;let i=w.querySelector(`[data-index="${t}"]`);if(i&&E==="full-tree"){let a=p("#tree");a.scrollTop=Math.max(0,i.offsetTop-a.clientHeight/2+i.clientHeight/2)}else if(i){let a=p("#film");a.scrollLeft=Math.max(0,i.offsetLeft-a.clientWidth/2+i.clientWidth/2)}}function ue(e,t,n){w.querySelectorAll(`[data-index="${e}"]`).forEach((i)=>{i.classList.toggle(t,n)})}function dt(){Ge(p("#revision-a"),d.revisions[L],"A",L===v),Ge(p("#revision-b"),d.revisions[v],"B",!1)}function Ge(e,t,n,i){let a=vt.format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${n}</div>
    <p class="revision-date">${a}</p>
    <h2>${h(t.subject||"(no description)")}</h2>
    <p class="revision-author">${h(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${N(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${N(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${ne(t.render)}</dd></div>
    </dl>
    ${St(t.render)}
    ${t.bookmarks.map((s)=>`<span class="bookmark">${h(s)}</span>`).join("")}
    ${i?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function xe(){let e=p("#film"),t=p("#tree");if(e.hidden=E!=="first-parent",t.hidden=E!=="full-tree",E==="full-tree"){Bt(t);return}let n=e.scrollLeft,i=d.revisions[u].key,a=e.dataset.selectedKey!==i,l=Y().map((r)=>({revision:A(r),index:k(r)})).reverse();e.innerHTML=l.map(({revision:r,index:o})=>{let m=r.render?.phase??"idle",$=ye.get(r.key)??-1,y=d.history.first_parent_keys[$+1],M=y?A(y):void 0,x=G(r.render,M?.render);return`
        <button
          class="frame ${o===u?"selected":""} ${o===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${o===u}"
          data-index="${o}"
          data-revision-key="${r.key}"
          data-phase="${m}"
          title="${h(r.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${_e(r.committed_at)}</time>
          <strong>${h(r.subject||"(no description)")}</strong>
          <span class="frame-meta">${h(N(r.commit_id))} · ${ne(r.render,x)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((r)=>{r.addEventListener("click",()=>se(Number(r.dataset.index)))});let c=e.querySelector(".selected");if(e.dataset.selectedKey=i,c&&a)e.scrollLeft=Math.max(0,c.offsetLeft-e.clientWidth/2+c.clientWidth/2);else e.scrollLeft=n}function Bt(e){let t=d.history.full_tree_keys,n=Je(d.revisions,t),i=new Map(n.nodes.map((g)=>[g.key,g])),a=e.scrollTop,s=d.revisions[u].key,l=e.dataset.selectedKey!==s,c=58,r=8,o=Math.min(8,n.laneCount),m=34+o*18,$=(g)=>n.laneCount<2?18:16+g/(n.laneCount-1)*(m-32),y=t.length*58+16,M=new Map(n.nodes.map((g)=>[g.key,g.row])),x=n.edges.map((g)=>{let H=i.get(g.child),B=i.get(g.parent);if(!H||!B)return"";let V=M.get(g.child),Re=M.get(g.parent);if(V==null||Re==null)return"";let Pe=$(H.lane),Ie=8+V*58+29,qe=$(B.lane),Fe=8+Re*58+29,je=(Ie+Fe)/2;return`<path class="${g.merge?"merge-edge":""}" d="M ${Pe} ${Ie} C ${Pe} ${je}, ${qe} ${je}, ${qe} ${Fe}" />`}).join(""),ve=n.nodes.map((g)=>{let H=M.get(g.key);if(H==null)return"";let B=k(g.key);return`<circle class="${[B===u?"selected":"",B===L?"pinned":""].filter(Boolean).join(" ")}" cx="${$(g.lane)}" cy="${8+H*58+29}" r="5" />`}).join(""),W=n.nodes.map((g)=>{let H=A(g.key),B=k(g.key),V=H.render?.phase??"idle";return`
        <button
          class="tree-node ${B===u?"selected":""} ${B===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${B===u}"
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
          <span class="tree-meta">${h(N(H.commit_id))} · ${ne(H.render)}</span>
        </button>
      `}).join("");e.innerHTML=`
    <div class="tree-canvas" data-lanes="${o}">
      <svg aria-hidden="true" viewBox="0 0 ${m} ${y}" width="${m}" height="${y}">${x}${ve}</svg>
      ${W}
    </div>
  `,e.querySelectorAll(".tree-node").forEach((g)=>{g.addEventListener("click",()=>se(Number(g.dataset.index)))});let j=e.querySelector(".tree-node.selected");if(e.dataset.selectedKey=s,j&&l)e.scrollTop=Math.max(0,j.offsetTop-e.clientHeight/2+j.clientHeight/2);else e.scrollTop=a}function ge(e=!0){ee();let t=[...Y()].reverse(),n=p("#revision-slider"),i=d.revisions[u].key,a=Math.max(0,t.indexOf(i));if(n.max=String(Math.max(0,t.length-1)),e)n.value=String(a);let s=t[a]?A(t[a]):void 0;p("#revision-position").textContent=s?`${a+1} / ${t.length} · ${_e(s.committed_at)} · ${s.subject||"(no description)"}`:"No revision",Ct(t)}function Ct(e){let t=p("#readiness-rail"),n=e.join("\x00");if(t.dataset.keys!==n)t.dataset.keys=n,t.innerHTML=e.map((a)=>{let s=A(a);return`<span
          data-ready-key="${s.key}"
          data-phase="${s.render?.phase??"idle"}"
          data-placeholder="${te(s.render)}"
          title="${h(He(s))}"
        ></span>`}).join("");let i=d.revisions[u].key;t.querySelectorAll("[data-ready-key]").forEach((a)=>{let s=a.dataset.readyKey,l=s?A(s):void 0;if(a.dataset.phase=l?.render?.phase??"idle",a.dataset.placeholder=String(te(l?.render)),l)a.title=He(l);a.classList.toggle("selected",s===i)})}function ct(){Xe(p("#page-a"),d.revisions[L].render,S),Xe(p("#page-b"),d.revisions[v].render,T)}function Xe(e,t,n){let i=t?.phase==="ready"?t.pages.length:0;if(i===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:i},(a,s)=>`<option value="${s}" ${s===n?"selected":""}>${s+1}</option>`).join("")}function Ae(){let e=d.revisions[L].render,t=d.revisions[v].render;return Oe(e?.phase==="ready"?e.pages:[],t?.phase==="ready"?t.pages:[])}function pt(e=Ae()){if(!e.shifted)return null;return Ye(e,F,F==="left"?S:T)??null}function ut(){let e=d.revisions[L].render,t=d.revisions[v].render;if(e?.phase==="ready"&&e.pages.length>0)S=z(S,e.pages.length);if(t?.phase==="ready"&&t.pages.length>0)T=z(T,t.pages.length)}function ae(){let e=p("#pair-suggestion"),t=p("#pair-confidence"),n=p("#pair-suggestion-text"),i=p("#apply-pair");if(u!==v){e.hidden=!0;return}let a=Ae(),s=pt(a),l=s?$e(s):null;if(s&&!l){e.hidden=!1,e.dataset.confidence="unpaired",t.hidden=!0,i.hidden=!0,n.textContent=s.rightIndex!=null?`B ${s.rightIndex+1} has no reliable A pair. Choose pages manually.`:`A ${(s.leftIndex??0)+1} has no reliable B pair. Choose pages manually.`;return}if(!s||!s.confidence||!l||s.leftIndex===s.rightIndex){let m=d.revisions[L].render,$=d.revisions[v].render;if(m?.phase==="ready"&&$?.phase==="ready"&&m.pages.length!==$.pages.length&&!a.shifted){e.hidden=!1,e.dataset.confidence="unpaired",t.hidden=!0,i.hidden=!0,n.textContent="Could not align these pages reliably. Choose A and B manually.";return}e.hidden=!0,e.removeAttribute("data-confidence");return}let c=l.pageA+1,r=l.pageB+1,o=S===l.pageA&&T===l.pageB;e.hidden=!1,e.dataset.confidence=s.confidence,t.hidden=!1,t.textContent=`${s.confidence} confidence`,n.textContent=o?`Aligned pair: A ${c} with B ${r}.`:`Likely page shift: A ${c} matches B ${r}.`,i.hidden=o,i.textContent=`Use A ${c} / B ${r}`,i.setAttribute("aria-label",`Use A page ${c} and B page ${r}`)}function me(){let e=Ae(),t=p("#page-rail");if(e.pairs.length===0){let n=d.revisions[L].render,i=d.revisions[v].render,a=n?.phase==="ready"?n.pages:[],s=i?.phase==="ready"?i.pages:[],l=Math.max(a.length,s.length);t.innerHTML=Array.from({length:l},(c,r)=>{let o=a[r],m=s[r];if(!o||!m){let M=o?`A${r+1}`:`B${r+1}`;return`<span class="page-tick unpaired" aria-label="${M} has no reliable pair">${M}</span>`}let $=o.hash===m.hash?"same":"changed",y=S===r&&T===r;return`<button
        type="button"
        class="page-tick ${$} ${y?"active":""}"
        data-page-a="${r}"
        data-page-b="${r}"
        aria-pressed="${y}"
        aria-label="Use physical page ${r+1} for A and B, ${$}"
      >${r+1}</button>`}).join("")}else t.innerHTML=e.pairs.map((n)=>{let i=n.leftIndex==null?null:n.leftIndex+1,a=n.rightIndex==null?null:n.rightIndex+1,s=n.leftIndex===S&&n.rightIndex===T,l=i!=null&&a!=null&&i!==a,c=l?`<span>A${i}</span><span>B${a}</span>`:String(a??i??"—"),r=_t(n);if(n.leftIndex==null||n.rightIndex==null)return`<span
          class="page-tick ${n.relation} unpaired"
          aria-label="${h(r)}"
        >${c}</span>`;return`<button
        type="button"
        class="page-tick ${n.relation} ${s?"active":""} ${l?"shifted":""}"
        data-page-a="${n.leftIndex}"
        data-page-b="${n.rightIndex}"
        aria-pressed="${s}"
        aria-label="${h(r)}"
      >${c}</button>`}).join("");t.querySelectorAll(".page-tick").forEach((n)=>{n.addEventListener("click",()=>{f.stop(),C+=1;let i=n.dataset.pageA,a=n.dataset.pageB;if(i==null||a==null)return;S=Number(i),T=Number(a),F="right",ie(),D(u)})})}function _t(e){let t=e.confidence?`, ${e.confidence} confidence`:"";if(e.leftIndex==null&&e.rightIndex!=null)return`B page ${e.rightIndex+1} has no reliable A pair`;if(e.rightIndex==null&&e.leftIndex!=null)return`A page ${e.leftIndex+1} has no reliable B pair`;return`Use A page ${(e.leftIndex??0)+1} and B page ${(e.rightIndex??0)+1}, ${e.relation}${t}`}function R(){let e=p("#stage"),t=d.revisions[L],n=d.revisions[v],i=fe(t.render,S),a=fe(n.render,T);if(Rt(e),b==="heatmap"){let c=`${i??"missing"}\x00${a??"missing"}`;if(le){p("#heatmap-label").textContent="Could not calculate heatmap. Reload the viewer to retry.",f.failed(n.key,"Playback stopped: heatmap worker failed");return}if(e.dataset.comparison!==c){e.dataset.comparison=c,e.dataset.heatmapState="pending";let o=p("#heatmap-label");if(o.textContent=i&&a?"Calculating visual difference…":"Waiting for both revisions…",i&&a)Pt(i,a);else Z+=1}if([t,n].some((o)=>["error","entrypoint_missing"].includes(o.render?.phase??"")||o.render?.phase==="ready"&&o.render.pages.length===0))p("#heatmap-label").textContent="Heatmap needs both rendered pages.",f.failed(n.key,"Playback stopped: heatmap needs both rendered pages");else if(e.dataset.heatmapState==="ready"&&u===v)f.ready(n.key);return}Qe(e.querySelector('[data-page-slot="a"]'),t,i,"A"),Qe(e.querySelector('[data-page-slot="b"]'),n,a,"B");let s=e.querySelector(".blink-pages");s?.classList.toggle("show-a",q),s?.classList.toggle("show-b",!q);let l=e.querySelector(".same-output");if(l)l.hidden=!It(n)}function Rt(e){if(e.dataset.mode===b)return;if(e.dataset.mode=b,e.dataset.comparison="",b==="single")e.innerHTML=`
      <div class="single-page">
        ${_("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(b==="side")e.innerHTML=`<div class="split-pages">${_("a")}${_("b")}</div>`;else if(b==="blink")e.innerHTML=`
      <div class="stack-pages blink-pages show-b">
        ${_("a")}
        ${_("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(b==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${_("a")}
        <div class="overlay-page mix-page">${_("b")}</div>
      </div>
    `;else if(b==="wipe")e.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${_("a")}
        <div class="overlay-page wipe">${_("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function _(e){let t=e.toUpperCase();return`
    <div class="page-slot" data-page-slot="${e}">
      <img class="document-page" alt="Revision ${t}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${t}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function Qe(e,t,n,i){if(!e)return;let a=e.querySelector("img"),s=e.querySelector(".render-status");if(!a||!s)return;if(n&&!ce.has(n)){if(a.getAttribute("src")!==n)a.src=n;a.hidden=!1,s.hidden=!0;return}a.hidden=!0,s.hidden=!1;let l=Boolean(n&&ce.has(n));s.className=`render-status ${l?"error":t.render?.phase??"idle"}`;let c=s.querySelector("strong"),r=s.querySelector("p");if(c)c.textContent=l?"Could not load page image":X(t.render);if(r)r.textContent=(l?"Select this revision again to retry.":t.render?.message)??(t.render?.phase?"Preparing this revision…":`Select revision ${i} to render it.`)}function we(e){if(!Number.isFinite(e))return;P=Math.min(100,Math.max(0,Math.round(e))),be()}function be(){let e=document.querySelector("#mix"),t=document.querySelector("#mix-number");if(e)e.value=String(P);if(t)t.value=String(P);oe(document.querySelector(".mix-page"),{opacity:P/100}),oe(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-P}% 0 0)`}),oe(document.querySelector(".wipe-line"),{left:`${P}%`}),oe(document.querySelector(".wipe-handle"),{left:`${P}%`})}function oe(e,t){if(!e)return;e.getAnimations().forEach((n)=>n.cancel()),e.animate([t,t],{duration:1,fill:"forwards"})}function Ze(e){let t=document.querySelector(".wipe-pages");if(!t)return;let n=t.getBoundingClientRect();we((e.clientX-n.left)/n.width*100)}async function Pt(e,t){let n=++Z,i=d.revisions[v].key,a,s;try{[a,s]=await Promise.all([et(e),et(t)])}catch(l){if(n===Z&&b==="heatmap"){p("#stage").dataset.heatmapState="error";let c=document.querySelector("#heatmap-label");if(c)c.textContent=`Could not calculate heatmap: ${String(l)}`;f.failed(i,"Playback stopped: could not calculate heatmap")}return}if(n!==Z||b!=="heatmap"||le){a.close(),s.close();return}Ee.onmessage=(l)=>{let c=l.data;if(c.generation!==Z||b!=="heatmap"||le){c.bitmap.close();return}let r=document.querySelector("#heatmap");if(!r){c.bitmap.close();return}r.width=c.width,r.height=c.height;let o=r.getContext("bitmaprenderer");if(o)o.transferFromImageBitmap(c.bitmap);else r.getContext("2d").drawImage(c.bitmap,0,0),c.bitmap.close();let m=document.querySelector("#heatmap-label");if(m)m.textContent=`${(c.changed/c.total*100).toFixed(2)}% pixels differ`;p("#stage").dataset.heatmapState="ready",f.ready(i)},Ee.postMessage({left:a,right:s,scale:1.5,generation:n},[a,s])}function se(e,t=!0,n=!1){if(!n)f.stop();if(e<0||e>=d.revisions.length)return;C+=1;let i=u;u=e,F="right",At(i,u,t),ge(t),Be(),ae(),O(n),D(e)}async function D(e){let t=d.revisions[e];if(!["ready","entrypoint_missing","error"].includes(t.render?.phase??""))return;let i=++C,a=t.render?.pages.length??0,s=z(T,a),l=fe(t.render,s);if(l)try{await mt(l),ce.delete(l)}catch{if(i!==C||u!==e)return;ce.add(l),f.failed(t.key,"Playback stopped: page image could not load")}if(i!==C||u!==e)return;if(v=e,T=s,ie(),Be(),ft(),t.render?.phase==="ready"){if(b!=="heatmap")f.ready(t.key)}else f.failed(t.key,`Playback stopped: ${X(t.render)}`)}function mt(e){let t=I.get(e);if(t)return I.delete(e),I.set(e,t),t;let n=new Image;n.decoding="async";let i=new Promise((a,s)=>{n.addEventListener("load",()=>{n.decode().then(a,a)}),n.addEventListener("error",()=>s(Error(`Could not preload ${e}`))),n.src=e}).catch((a)=>{throw I.delete(e),a});I.set(e,i);while(I.size>12){let a=I.keys().next().value;if(a===void 0)break;I.delete(a)}return i}function ft(){let e=Ce(),t=e.indexOf(d.revisions[u].key);for(let n of[-2,-1,1,2]){let i=e[t+n];if(!i)continue;let a=fe(A(i).render,T);if(a)mt(a).catch(()=>{return})}}function Be(){let e=p("#stage"),t=u!==v;e.dataset.previewPending=String(t),e.setAttribute("aria-busy",String(t))}function Ke(e){let t=Y(),n=t.indexOf(d.revisions[u].key);if(n<0)return;let i=Math.min(t.length-1,Math.max(0,n+e));se(k(t[i]))}function O(e=!1){let t={revisionKey:d.revisions[u].key,pinnedRevisionKey:d.revisions[L].key,historyMode:E,generation:++it};if(Ve.schedule(t),e)Ve.flush()}function fe(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${J}/assets/${e.render_id}/page/${e.pages[t].number}`}function It(e){let t=nt.get(e.parent_ids[0]);return Boolean(t&&G(e.render,t.render))}function U(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===b}">${t}</button>`}function Ce(){return E==="first-parent"?d.history.first_parent_keys:d.history.full_tree_keys}function Y(){let e=Ce();if(E==="full-tree"||!ke)return e;return e.filter((t,n)=>{if(n===e.length-1)return!0;return!G(A(t).render,A(e[n+1]).render)})}function A(e){let t=he.get(e);if(!t)throw Error(`Unknown revision: ${e}`);return t}function k(e){return tt.get(e)??-1}function _e(e){return $t.format(new Date(e))}async function et(e){let t=await new Promise((n,i)=>{let a=new Image;a.decoding="async",a.onload=()=>n(a),a.onerror=()=>i(Error(`Could not load ${e}`)),a.src=e});return createImageBitmap(t)}function p(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function h(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
