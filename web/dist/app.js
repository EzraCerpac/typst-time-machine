function l(T,D){if(D<=0)return 0;return Math.min(Math.max(T,0),D-1)}function hT(T,D,Y,J){if(D.length===0)throw Error("cannot select from empty history");let O=D.includes(Y)?Y:D[D.length-1],Q=new Set(T.map((X)=>X.key)),$=T.find((X)=>X.key===O),j=new Map(T.map((X)=>[X.commit_id,X.key])),Z=$?.parent_ids.map((X)=>j.get(X)).find((X)=>X!=null),_=Q.has(J)?J:Z??O;return{selectedKey:O,pinnedKey:_,selectedReset:O!==Y,pinnedReset:_!==J}}var z0=250000;function a(T,D){if(T?.phase!=="ready"||D?.phase!=="ready")return!1;if(T.pages.length!==D.pages.length)return!1;return T.pages.every((Y,J)=>Y.hash===D.pages[J]?.hash)}function uT(T,D){let Y=j0(T,D);if(Y.filter((Z)=>Z.unique).length===0)return{pairs:[],confidence:null,shifted:!1,anchorCount:Y.length};let O=F0(Y),Q=[],$=-1,j=-1;return Y.forEach((Z,_)=>{yT(Q,$+1,Z.leftIndex,j+1,Z.rightIndex,mT(O,_-1,_),_>0),Q.push({leftIndex:Z.leftIndex,rightIndex:Z.rightIndex,relation:"same",confidence:Z.unique&&O.has(_)?"high":"medium"}),$=Z.leftIndex,j=Z.rightIndex}),yT(Q,$+1,T.length,j+1,D.length,mT(O,Y.length-1,Y.length),!1),{pairs:Q,confidence:O.size>0?"high":"medium",shifted:Q.some((Z)=>Z.leftIndex===null||Z.rightIndex===null||Z.leftIndex!==Z.rightIndex),anchorCount:Y.length}}function cT(T,D,Y){return T.pairs.find((J)=>D==="left"?J.leftIndex===Y:J.rightIndex===Y)}function VT(T){if(T.leftIndex===null||T.rightIndex===null)return;return{pageA:T.leftIndex,pageB:T.rightIndex}}function j0(T,D){if((T.length+1)*(D.length+1)>z0)return[];let Y=xT(T),J=xT(D),O=Array.from({length:T.length+1},()=>Array(D.length+1).fill(0));for(let Z=T.length-1;Z>=0;Z-=1)for(let _=D.length-1;_>=0;_-=1)O[Z][_]=T[Z].hash===D[_].hash?O[Z+1][_+1]+1:Math.max(O[Z+1][_],O[Z][_+1]);let Q=[],$=0,j=0;while($<T.length&&j<D.length){let Z=T[$].hash;if(Z===D[j].hash)Q.push({leftIndex:$,rightIndex:j,unique:Y.get(Z)===1&&J.get(Z)===1}),$+=1,j+=1;else if(O[$+1][j]>=O[$][j+1])$+=1;else j+=1}return Q}function xT(T){let D=new Map;return T.forEach((Y)=>D.set(Y.hash,(D.get(Y.hash)??0)+1)),D}function F0(T){let D=new Set;for(let Y=1;Y<T.length;Y+=1){let J=T[Y-1],O=T[Y];if(J.unique&&O.unique&&O.leftIndex===J.leftIndex+1&&O.rightIndex===J.rightIndex+1)D.add(Y-1),D.add(Y)}return D}function mT(T,D,Y){return T.has(D)||T.has(Y)?"high":"medium"}function yT(T,D,Y,J,O,Q,$){let j=Y-D,Z=O-J;if($&&j===Z){for(let _=0;_<j;_+=1)T.push({leftIndex:D+_,rightIndex:J+_,relation:"changed",confidence:"medium"});return}for(let _=D;_<Y;_+=1)T.push({leftIndex:_,rightIndex:null,relation:"removed",confidence:Q});for(let _=J;_<O;_+=1)T.push({leftIndex:null,rightIndex:_,relation:"added",confidence:Q})}function h(T){return T.slice(0,8)}function s(T){switch(T?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return X0(T);case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function X0(T){return`${T.pages.length} page${T.pages.length===1?"":"s"}`}function i(T){let D=T?.placeholder_files?.length??0;if(D===0)return"";return`${D} missing figure${D===1?"":"s"} substituted`}function vT(T,D){let Y=new Map(T.map((_)=>[_.key,_])),J=new Map(T.map((_)=>[_.commit_id,_.key])),O=new Set(D.map((_)=>Y.get(_)?.commit_id).filter((_)=>Boolean(_))),Q=[],$=[];D.forEach((_,X)=>{let L=Y.get(_);if(!L)return;let E=Q.indexOf(L.commit_id);if(E<0)E=Q.length;else Q.splice(E,1);$.push({key:_,row:X,lane:E}),L.parent_ids.filter((M)=>O.has(M)).forEach((M,S)=>{if(Q.includes(M))return;Q.splice(Math.min(E+S,Q.length),0,M)})});let j=new Map($.map((_)=>[_.key,_])),Z=D.flatMap((_)=>{let X=Y.get(_);if(!X||!j.has(_))return[];return X.parent_ids.flatMap((L,E)=>{let M=J.get(L);if(!M||!j.has(M))return[];return[{child:_,parent:M,merge:E>0}]})});return{nodes:$,edges:Z,laneCount:Math.max(1,...$.map((_)=>_.lane+1))}}class ET{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(T,D=window.requestAnimationFrame.bind(window),Y=window.cancelAnimationFrame.bind(window)){this.apply=T;this.scheduleFrame=D;this.cancelFrame=Y}schedule(T){if(this.latest=T,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let T=this.latest;this.latest=void 0,this.pending=!1,this.apply(T)}}class GT{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(T,D,Y=performance.now.bind(performance),J=window.setTimeout.bind(window),O=window.clearTimeout.bind(window)){this.interval=T;this.apply=D;this.now=Y;this.scheduleDelay=J;this.cancelDelay=O}schedule(T){this.latest=T;let D=this.interval-(this.now()-this.lastApplied);if(D<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,D))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let T=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(T)}}var g=location.pathname.replace(/\/$/,""),WT=new Worker(`${g}/diff-worker.js`,{type:"module"}),A=F("#app"),N0=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),V0=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),z,$T=new Map,nT=new Map,sT=new Map,_T=new Map,N=0,U=0,C=1,I=0,w=0,m="right",W="single",q="first-parent",f=50,wT=!1,x=!1,e=0,o=!1,YT=0,E0=0,UT=!1,P=new Map,JT=new Map,DT=new ET((T)=>{FT(T,!1)}),pT=new GT(50,(T)=>{fetch(`${g}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:T.revisionKey,pinned_revision_key:T.pinnedRevisionKey,history_mode:T.historyMode,generation:T.generation})})});WT.addEventListener("error",(T)=>{let D=document.querySelector("#heatmap-label");if(D)D.textContent=`Could not calculate heatmap: ${T.message}`});G0();async function G0(){A.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let T=await fetch(`${g}/api/session`);if(!T.ok)throw Error("Could not load Typst history.");z=await T.json(),iT(),N=R(z.history.first_parent_keys[0]),U=N,C=R(z.history.first_parent_keys[1]??z.history.first_parent_keys[0]),W0(),M0(),v(!0)}function iT(){$T=new Map(z.revisions.map((T)=>[T.key,T])),nT=new Map(z.revisions.map((T,D)=>[T.key,D])),sT=new Map(z.revisions.map((T)=>[T.commit_id,T])),_T=new Map(z.history.first_parent_keys.map((T,D)=>[T,D])),T0(!1)}function eT(T,D){if(T.render?.phase==="ready"&&D.phase!=="ready")return!1;return T.render=D,!0}function T0(T){for(let[D,Y]of JT){let J=$T.get(D);if(!J)continue;let O=eT(J,Y);if(JT.delete(D),O&&T)Y0(J)}}function W0(){let T=z.repository.root.split("/").filter(Boolean).at(-1)??"repository",D=z.target.missing_figure_roots??[],Y=D.length>0?`<p
        class="session-warning"
        role="note"
        title="${V(`Configured missing-figure roots:
${D.join(`
`)}`)}"
      >
        <strong>Approximate render</strong>
        <span>Missing figures use fixed 8:5 placeholders. Page breaks and comparisons are approximate.</span>
      </p>`:"";A.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${V(z.target.entry)}</h1>
        </div>
      </div>
      ${Y}
      <div class="repo-facts">
        <span class="vcs">${z.repository.kind}</span>
        <strong>${V(T)}</strong>
        <span id="revision-count">${z.revisions.length} revisions</span>
        <span title="${V(z.compiler)}">${V(z.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${c("single","B")}
          ${c("side","A · B")}
          ${c("blink","Blink")}
          ${c("opacity","Mix")}
          ${c("wipe","Wipe")}
          ${c("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${f}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${f}" aria-label="Comparison position percentage" />
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
              max="${z.history.max_limit}"
              step="1"
              value="${z.history.limit}"
              aria-describedby="history-limit-help"
            />
            <button type="submit">Load history</button>
            <span id="history-limit-help" class="sr-only">
              Maximum matching revisions in each history view, from 1 to ${z.history.max_limit}.
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
        <label for="revision-slider">Travel through revisions</label>
        <div class="revision-track">
          <input id="revision-slider" type="range" min="0" max="0" value="0" />
          <div class="readiness-rail" id="readiness-rail" aria-label="Revision render readiness"></div>
        </div>
        <output id="revision-position"></output>
      </div>
      <div class="film" id="film" role="listbox" aria-label="Document revisions"></div>
      <div class="tree" id="tree" role="listbox" aria-label="Full revision tree" hidden></div>
    </footer>
  `,U0(),qT()}function U0(){F("#history-limit-form").addEventListener("submit",(D)=>{D.preventDefault(),L0()}),A.querySelectorAll("[data-mode]").forEach((D)=>{D.addEventListener("click",()=>{W=D.dataset.mode,b(),D0(),jT()})}),F("#mix").addEventListener("input",(D)=>{MT(Number(D.target.value))}),F("#mix-number").addEventListener("input",(D)=>{MT(Number(D.target.value))}),F("#pin-a").addEventListener("click",()=>{U=N,w=l(w,z.revisions[U].render?.pages.length??0);let D=C;C=N,I=w,m="right",H0(D,C),p(),v(!0)}),F("#collapse").addEventListener("change",(D)=>{wT=D.target.checked,HT(),zT()}),A.querySelectorAll("[data-history-mode]").forEach((D)=>{D.addEventListener("click",()=>{q=D.dataset.historyMode;let Y=RT();if(!Y.includes(z.revisions[N].key))N=R(Y[0]),w=0;m="right",DT.cancel(),YT+=1,U=N,qT(),v(!0)})}),F("#revision-slider").addEventListener("input",(D)=>{let J=[...XT()].reverse()[Number(D.target.value)];if(J)DT.schedule(R(J))}),F("#revision-slider").addEventListener("change",(D)=>{DT.flush(),v(!0)}),F("#page-a").addEventListener("change",(D)=>{I=Number(D.target.value),m="left",b(),n(),QT()}),F("#page-b").addEventListener("change",(D)=>{w=Number(D.target.value),m="right",b(),n(),QT()}),F("#apply-pair").addEventListener("click",()=>{let D=Q0(),Y=D?VT(D):null;if(!Y)return;I=Y.pageA,w=Y.pageB,p()});let T=F("#stage");T.addEventListener("pointerdown",(D)=>{if(W==="blink")x=!0,b();else if(W==="wipe"&&D.button===0)o=!0,T.setPointerCapture(D.pointerId),oT(D)}),T.addEventListener("pointermove",(D)=>{if(o)oT(D)}),T.addEventListener("pointerup",(D)=>{if(o)o=!1,T.releasePointerCapture(D.pointerId)}),window.addEventListener("pointerup",()=>{if(x)x=!1,b();o=!1}),window.addEventListener("keydown",(D)=>{if(D.target instanceof HTMLInputElement||D.target instanceof HTMLSelectElement)return;if(D.key==="ArrowLeft")tT(1);else if(D.key==="ArrowRight")tT(-1);else if(D.code==="Space"&&W==="blink"&&!D.repeat)D.preventDefault(),x=!0,b()}),window.addEventListener("keyup",(D)=>{if(D.code==="Space"&&x)x=!1,b()})}async function L0(){let T=F("#history-limit-form"),D=F("#history-limit"),Y=F("#history-limit-form button"),J=F("#history-limit-status"),O=document.activeElement===D||document.activeElement===Y,Q=Number(D.value);if(J.setAttribute("role","status"),!Number.isInteger(Q)||Q<1||Q>z.history.max_limit){J.textContent=`Choose a revision limit from 1 to ${z.history.max_limit}.`,D.focus();return}if(Q===z.history.limit){J.textContent=`History already uses limit ${Q}.`;return}T.setAttribute("aria-busy","true"),D.disabled=!0,Y.disabled=!0,UT=!0,J.textContent=`Loading up to ${Q} matching revisions…`;try{let $=await fetch(`${g}/api/history`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({limit:Q})}),Z=($.headers.get("content-type")??"").includes("application/json")?await $.json():await $.text();if(!$.ok){let y=typeof Z==="string"?Z:("error"in Z)&&Z.error?Z.error:"history request failed";throw Error(y)}let _=z.revisions[N].key,X=z.revisions[U].key,L=z.revisions[C].key,E=Z,M=q==="first-parent"?E.history.first_parent_keys:E.history.full_tree_keys,S=hT(E.revisions,M,_,L),NT=E.revisions.some((y)=>y.key===X)?X:S.selectedKey;DT.cancel(),YT+=1,z=E,iT(),N=R(S.selectedKey),U=R(NT),C=R(S.pinnedKey),F("#revision-count").textContent=`${z.revisions.length} revisions`,D.max=String(z.history.max_limit),D.value=String(z.history.limit),qT(),v(!0),IT(N);let u=[];if(S.selectedReset)u.push("Previous B was outside the new limit; showing the oldest available revision.");if(S.pinnedReset)u.push("Previous A was outside the new limit; pin moved to B or its parent.");if(u.length>0)J.setAttribute("role","alert");J.textContent=`History updated. ${z.revisions.length} revisions available. ${u.join(" ")}`.trim()}catch($){J.setAttribute("role","alert"),J.textContent=`Could not update history. Previous limit remains. ${$ instanceof Error?$.message:""}`.trim()}finally{if(T.setAttribute("aria-busy","false"),D.disabled=!1,Y.disabled=!1,UT=!1,T0(!0),O)Y.focus()}}function M0(){let T=new EventSource(`${g}/api/events`);T.addEventListener("render",(D)=>{let Y=JSON.parse(D.data);if(UT){JT.set(Y.status.revision_key,Y.status);return}let J=$T.get(Y.status.revision_key);if(!J){JT.set(Y.status.revision_key,Y.status);return}if(!eT(J,Y.status))return;if(Y0(J),Y.status.phase==="ready")_0()}),T.onerror=()=>{document.body.dataset.connection="lost"}}function qT(){Z0(),J0(),O0(),n(),HT(),zT(),QT(),b(),jT(),D0(),C0()}function D0(){A.querySelectorAll("[data-mode]").forEach((Y)=>{Y.setAttribute("aria-pressed",String(Y.dataset.mode===W))});let T=F(".mix-control"),D=W==="opacity"||W==="wipe";T.dataset.visible=String(D),T.hidden=!D,F("#mix-label").textContent=W==="opacity"?"Blend":"Wipe"}function C0(){A.querySelectorAll("[data-history-mode]").forEach((D)=>{D.setAttribute("aria-pressed",String(D.dataset.historyMode===q))});let T=F("#collapse");T.disabled=q==="full-tree",F("#history-title").textContent=q==="first-parent"?"First-parent history":"Full revision tree",F("#history-description").textContent=q==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function Y0(T){gT(T);let D=_T.get(T.key);if(D!=null&&D>0)gT(k(z.history.first_parent_keys[D-1]));if(wT&&q==="first-parent"&&T.render?.phase==="ready")HT(),zT();let Y=z.revisions[U],J=R(T.key),O=["ready","entrypoint_missing","error"].includes(T.render?.phase??"");if(J===N&&O){IT(J);return}if((J===U||J===C||Y.parent_ids[0]===T.commit_id)&&O)p()}function gT(T){A.querySelectorAll(`[data-revision-key="${T.key}"]`).forEach((D)=>{if(D.dataset.phase=T.render?.phase??"idle",D.classList.contains("frame")){let J=_T.get(T.key),O=J==null?void 0:z.history.first_parent_keys[J+1],Q=a(T.render,O?k(O).render:void 0),$=D.querySelector(".frame-meta");if($)$.innerHTML=`${V(h(T.commit_id))} · ${r(T.render,Q)}`}let Y=D.querySelector(".tree-meta");if(Y)Y.innerHTML=`${V(h(T.commit_id))} · ${r(T.render)}`}),A.querySelectorAll(`[data-ready-key="${T.key}"]`).forEach((D)=>{D.dataset.phase=T.render?.phase??"idle",D.dataset.placeholder=String(t(T.render)),D.title=LT(T)})}function t(T){return T?.phase==="ready"&&(T.placeholder_files?.length??0)>0}function w0(T){let D=T?.placeholder_files?.length??0;return`${D} placeholder${D===1?"":"s"}`}function r(T,D=!1){let Y=D?"same output":s(T);if(!t(T))return V(Y);let J=i(T);return`${V(Y)} · <span class="placeholder-count" title="${V(J)}">${V(w0(T))}</span>`}function LT(T){let D=i(T.render);return`${T.subject||"(no description)"} · ${s(T.render)}${D?` · ${D}`:""}`}function q0(T){if(!t(T))return"";let D=i(T),Y=(T?.placeholder_files??[]).map((J)=>`<li><code>${V(J)}</code></li>`).join("");return`
    <details class="placeholder-details">
      <summary>${V(D)}</summary>
      <ul>${Y}</ul>
    </details>
  `}function p(){Z0(),J0(),O0(),n(),QT(),b(),jT()}function H0(T,D){OT(T,"pinned",!1),OT(D,"pinned",!0)}function A0(T,D,Y){if(OT(T,"selected",!1),OT(D,"selected",!0),A.querySelectorAll(`[data-index="${T}"]`).forEach((O)=>{O.setAttribute("aria-selected","false")}),A.querySelectorAll(`[data-index="${D}"]`).forEach((O)=>{O.setAttribute("aria-selected","true")}),!Y)return;let J=A.querySelector(`[data-index="${D}"]`);if(J&&q==="full-tree"){let O=F("#tree");O.scrollTop=Math.max(0,J.offsetTop-O.clientHeight/2+J.clientHeight/2)}else if(J){let O=F("#film");O.scrollLeft=Math.max(0,J.offsetLeft-O.clientWidth/2+J.clientWidth/2)}}function OT(T,D,Y){A.querySelectorAll(`[data-index="${T}"]`).forEach((J)=>{J.classList.toggle(D,Y)})}function J0(){dT(F("#revision-a"),z.revisions[C],"A",C===U),dT(F("#revision-b"),z.revisions[U],"B",!1)}function dT(T,D,Y,J){let O=N0.format(new Date(D.committed_at));T.innerHTML=`
    <div class="revision-letter">${Y}</div>
    <p class="revision-date">${O}</p>
    <h2>${V(D.subject||"(no description)")}</h2>
    <p class="revision-author">${V(D.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${D.commit_id}">${h(D.commit_id)}</dd></div>
      ${D.change_id?`<div><dt>Change</dt><dd title="${D.change_id}">${h(D.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${r(D.render)}</dd></div>
    </dl>
    ${q0(D.render)}
    ${D.bookmarks.map((Q)=>`<span class="bookmark">${V(Q)}</span>`).join("")}
    ${J?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function HT(){let T=F("#film"),D=F("#tree");if(T.hidden=q!=="first-parent",D.hidden=q!=="full-tree",q==="full-tree"){I0(D);return}let Y=T.scrollLeft,J=z.revisions[N].key,O=T.dataset.selectedKey!==J,$=XT().map((Z)=>({revision:k(Z),index:R(Z)})).reverse();T.innerHTML=$.map(({revision:Z,index:_})=>{let X=Z.render?.phase??"idle",L=_T.get(Z.key)??-1,E=z.history.first_parent_keys[L+1],M=E?k(E):void 0,S=a(Z.render,M?.render);return`
        <button
          class="frame ${_===N?"selected":""} ${_===C?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${_===N}"
          data-index="${_}"
          data-revision-key="${Z.key}"
          data-phase="${X}"
          title="${V(Z.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${ST(Z.committed_at)}</time>
          <strong>${V(Z.subject||"(no description)")}</strong>
          <span class="frame-meta">${V(h(Z.commit_id))} · ${r(Z.render,S)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),T.querySelectorAll(".frame").forEach((Z)=>{Z.addEventListener("click",()=>FT(Number(Z.dataset.index)))});let j=T.querySelector(".selected");if(T.dataset.selectedKey=J,j&&O)T.scrollLeft=Math.max(0,j.offsetLeft-T.clientWidth/2+j.clientWidth/2);else T.scrollLeft=Y}function I0(T){let D=z.history.full_tree_keys,Y=vT(z.revisions,D),J=new Map(Y.nodes.map((G)=>[G.key,G])),O=T.scrollTop,Q=z.revisions[N].key,$=T.dataset.selectedKey!==Q,j=58,Z=8,_=Math.min(8,Y.laneCount),X=34+_*18,L=(G)=>Y.laneCount<2?18:16+G/(Y.laneCount-1)*(X-32),E=D.length*58+16,M=new Map(Y.nodes.map((G)=>[G.key,G.row])),S=Y.edges.map((G)=>{let H=J.get(G.child),K=J.get(G.parent);if(!H||!K)return"";let d=M.get(G.child),kT=M.get(G.parent);if(d==null||kT==null)return"";let KT=L(H.lane),BT=8+d*58+29,bT=L(K.lane),fT=8+kT*58+29,PT=(BT+fT)/2;return`<path class="${G.merge?"merge-edge":""}" d="M ${KT} ${BT} C ${KT} ${PT}, ${bT} ${PT}, ${bT} ${fT}" />`}).join(""),NT=Y.nodes.map((G)=>{let H=M.get(G.key);if(H==null)return"";let K=R(G.key);return`<circle class="${[K===N?"selected":"",K===C?"pinned":""].filter(Boolean).join(" ")}" cx="${L(G.lane)}" cy="${8+H*58+29}" r="5" />`}).join(""),u=Y.nodes.map((G)=>{let H=k(G.key),K=R(G.key),d=H.render?.phase??"idle";return`
        <button
          class="tree-node ${K===N?"selected":""} ${K===C?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${K===N}"
          data-index="${K}"
          data-revision-key="${H.key}"
          data-phase="${d}"
          title="${V(H.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${V(H.subject||"(no description)")}</strong>
            <time>${ST(H.committed_at)}</time>
          </span>
          <span class="tree-meta">${V(h(H.commit_id))} · ${r(H.render)}</span>
        </button>
      `}).join("");T.innerHTML=`
    <div class="tree-canvas" data-lanes="${_}">
      <svg aria-hidden="true" viewBox="0 0 ${X} ${E}" width="${X}" height="${E}">${S}${NT}</svg>
      ${u}
    </div>
  `,T.querySelectorAll(".tree-node").forEach((G)=>{G.addEventListener("click",()=>FT(Number(G.dataset.index)))});let y=T.querySelector(".tree-node.selected");if(T.dataset.selectedKey=Q,y&&$)T.scrollTop=Math.max(0,y.offsetTop-T.clientHeight/2+y.clientHeight/2);else T.scrollTop=O}function zT(T=!0){let D=[...XT()].reverse(),Y=F("#revision-slider"),J=z.revisions[N].key,O=Math.max(0,D.indexOf(J));if(Y.max=String(Math.max(0,D.length-1)),T)Y.value=String(O);let Q=D[O]?k(D[O]):void 0;F("#revision-position").textContent=Q?`${O+1} / ${D.length} · ${ST(Q.committed_at)} · ${Q.subject||"(no description)"}`:"No revision",R0(D)}function R0(T){let D=F("#readiness-rail"),Y=T.join("\x00");if(D.dataset.keys!==Y)D.dataset.keys=Y,D.innerHTML=T.map((O)=>{let Q=k(O);return`<span
          data-ready-key="${Q.key}"
          data-phase="${Q.render?.phase??"idle"}"
          data-placeholder="${t(Q.render)}"
          title="${V(LT(Q))}"
        ></span>`}).join("");let J=z.revisions[N].key;D.querySelectorAll("[data-ready-key]").forEach((O)=>{let Q=O.dataset.readyKey,$=Q?k(Q):void 0;if(O.dataset.phase=$?.render?.phase??"idle",O.dataset.placeholder=String(t($?.render)),$)O.title=LT($);O.classList.toggle("selected",Q===J)})}function O0(){lT(F("#page-a"),z.revisions[C].render,I),lT(F("#page-b"),z.revisions[U].render,w)}function lT(T,D,Y){let J=D?.phase==="ready"?D.pages.length:0;if(J===0){T.innerHTML='<option value="0">—</option>',T.disabled=!0;return}T.disabled=!1,T.innerHTML=Array.from({length:J},(O,Q)=>`<option value="${Q}" ${Q===Y?"selected":""}>${Q+1}</option>`).join("")}function AT(){let T=z.revisions[C].render,D=z.revisions[U].render;return uT(T?.phase==="ready"?T.pages:[],D?.phase==="ready"?D.pages:[])}function Q0(T=AT()){if(!T.shifted)return null;return cT(T,m,m==="left"?I:w)??null}function Z0(){let T=z.revisions[C].render,D=z.revisions[U].render;if(T?.phase==="ready"&&T.pages.length>0)I=l(I,T.pages.length);if(D?.phase==="ready"&&D.pages.length>0)w=l(w,D.pages.length)}function n(){let T=F("#pair-suggestion"),D=F("#pair-confidence"),Y=F("#pair-suggestion-text"),J=F("#apply-pair");if(N!==U){T.hidden=!0;return}let O=AT(),Q=Q0(O),$=Q?VT(Q):null;if(Q&&!$){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent=Q.rightIndex!=null?`B ${Q.rightIndex+1} has no reliable A pair. Choose pages manually.`:`A ${(Q.leftIndex??0)+1} has no reliable B pair. Choose pages manually.`;return}if(!Q||!Q.confidence||!$||Q.leftIndex===Q.rightIndex){let X=z.revisions[C].render,L=z.revisions[U].render;if(X?.phase==="ready"&&L?.phase==="ready"&&X.pages.length!==L.pages.length&&!O.shifted){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent="Could not align these pages reliably. Choose A and B manually.";return}T.hidden=!0,T.removeAttribute("data-confidence");return}let j=$.pageA+1,Z=$.pageB+1,_=I===$.pageA&&w===$.pageB;T.hidden=!1,T.dataset.confidence=Q.confidence,D.hidden=!1,D.textContent=`${Q.confidence} confidence`,Y.textContent=_?`Aligned pair: A ${j} with B ${Z}.`:`Likely page shift: A ${j} matches B ${Z}.`,J.hidden=_,J.textContent=`Use A ${j} / B ${Z}`,J.setAttribute("aria-label",`Use A page ${j} and B page ${Z}`)}function QT(){let T=AT(),D=F("#page-rail");if(T.pairs.length===0){let Y=z.revisions[C].render,J=z.revisions[U].render,O=Y?.phase==="ready"?Y.pages:[],Q=J?.phase==="ready"?J.pages:[],$=Math.max(O.length,Q.length);D.innerHTML=Array.from({length:$},(j,Z)=>{let _=O[Z],X=Q[Z];if(!_||!X){let M=_?`A${Z+1}`:`B${Z+1}`;return`<span class="page-tick unpaired" aria-label="${M} has no reliable pair">${M}</span>`}let L=_.hash===X.hash?"same":"changed",E=I===Z&&w===Z;return`<button
        type="button"
        class="page-tick ${L} ${E?"active":""}"
        data-page-a="${Z}"
        data-page-b="${Z}"
        aria-pressed="${E}"
        aria-label="Use physical page ${Z+1} for A and B, ${L}"
      >${Z+1}</button>`}).join("")}else D.innerHTML=T.pairs.map((Y)=>{let J=Y.leftIndex==null?null:Y.leftIndex+1,O=Y.rightIndex==null?null:Y.rightIndex+1,Q=Y.leftIndex===I&&Y.rightIndex===w,$=J!=null&&O!=null&&J!==O,j=$?`<span>A${J}</span><span>B${O}</span>`:String(O??J??"—"),Z=S0(Y);if(Y.leftIndex==null||Y.rightIndex==null)return`<span
          class="page-tick ${Y.relation} unpaired"
          aria-label="${V(Z)}"
        >${j}</span>`;return`<button
        type="button"
        class="page-tick ${Y.relation} ${Q?"active":""} ${$?"shifted":""}"
        data-page-a="${Y.leftIndex}"
        data-page-b="${Y.rightIndex}"
        aria-pressed="${Q}"
        aria-label="${V(Z)}"
      >${j}</button>`}).join("");D.querySelectorAll(".page-tick").forEach((Y)=>{Y.addEventListener("click",()=>{let J=Y.dataset.pageA,O=Y.dataset.pageB;if(J==null||O==null)return;I=Number(J),w=Number(O),m="right",p()})})}function S0(T){let D=T.confidence?`, ${T.confidence} confidence`:"";if(T.leftIndex==null&&T.rightIndex!=null)return`B page ${T.rightIndex+1} has no reliable A pair`;if(T.rightIndex==null&&T.leftIndex!=null)return`A page ${T.leftIndex+1} has no reliable B pair`;return`Use A page ${(T.leftIndex??0)+1} and B page ${(T.rightIndex??0)+1}, ${T.relation}${D}`}function b(){let T=F("#stage"),D=z.revisions[C],Y=z.revisions[U],J=ZT(D.render,I),O=ZT(Y.render,w);if(k0(T),W==="heatmap"){let j=`${J??"missing"}\x00${O??"missing"}`;if(J&&O&&T.dataset.comparison!==j){T.dataset.comparison=j;let Z=F("#heatmap-label");Z.textContent="Calculating visual difference…",K0(J,O)}return}aT(T.querySelector('[data-page-slot="a"]'),D,J,"A"),aT(T.querySelector('[data-page-slot="b"]'),Y,O,"B");let Q=T.querySelector(".blink-pages");Q?.classList.toggle("show-a",x),Q?.classList.toggle("show-b",!x);let $=T.querySelector(".same-output");if($)$.hidden=!B0(Y)}function k0(T){if(T.dataset.mode===W)return;if(T.dataset.mode=W,T.dataset.comparison="",W==="single")T.innerHTML=`
      <div class="single-page">
        ${B("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(W==="side")T.innerHTML=`<div class="split-pages">${B("a")}${B("b")}</div>`;else if(W==="blink")T.innerHTML=`
      <div class="stack-pages blink-pages show-b">
        ${B("a")}
        ${B("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(W==="opacity")T.innerHTML=`
      <div class="stack-pages">
        ${B("a")}
        <div class="overlay-page mix-page">${B("b")}</div>
      </div>
    `;else if(W==="wipe")T.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${B("a")}
        <div class="overlay-page wipe">${B("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else T.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function B(T){let D=T.toUpperCase();return`
    <div class="page-slot" data-page-slot="${T}">
      <img class="document-page" alt="Revision ${D}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${D}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function aT(T,D,Y,J){if(!T)return;let O=T.querySelector("img"),Q=T.querySelector(".render-status");if(!O||!Q)return;if(Y){if(O.getAttribute("src")!==Y)O.src=Y;O.hidden=!1,Q.hidden=!0;return}O.hidden=!0,Q.hidden=!1,Q.className=`render-status ${D.render?.phase??"idle"}`;let $=Q.querySelector("strong"),j=Q.querySelector("p");if($)$.textContent=s(D.render);if(j)j.textContent=D.render?.message??(D.render?.phase?"Preparing this revision…":`Select revision ${J} to render it.`)}function MT(T){if(!Number.isFinite(T))return;f=Math.min(100,Math.max(0,Math.round(T))),jT()}function jT(){let T=document.querySelector("#mix"),D=document.querySelector("#mix-number");if(T)T.value=String(f);if(D)D.value=String(f);TT(document.querySelector(".mix-page"),{opacity:f/100}),TT(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-f}% 0 0)`}),TT(document.querySelector(".wipe-line"),{left:`${f}%`}),TT(document.querySelector(".wipe-handle"),{left:`${f}%`})}function TT(T,D){if(!T)return;T.getAnimations().forEach((Y)=>Y.cancel()),T.animate([D,D],{duration:1,fill:"forwards"})}function oT(T){let D=document.querySelector(".wipe-pages");if(!D)return;let Y=D.getBoundingClientRect();MT((T.clientX-Y.left)/Y.width*100)}async function K0(T,D){let Y=++e,J,O;try{[J,O]=await Promise.all([rT(T),rT(D)])}catch(Q){if(Y===e&&W==="heatmap"){let $=document.querySelector("#heatmap-label");if($)$.textContent=`Could not calculate heatmap: ${String(Q)}`}return}if(Y!==e||W!=="heatmap"){J.close(),O.close();return}WT.onmessage=(Q)=>{let $=Q.data;if($.generation!==e||W!=="heatmap"){$.bitmap.close();return}let j=document.querySelector("#heatmap");if(!j){$.bitmap.close();return}j.width=$.width,j.height=$.height;let Z=j.getContext("bitmaprenderer");if(Z)Z.transferFromImageBitmap($.bitmap);else j.getContext("2d").drawImage($.bitmap,0,0),$.bitmap.close();let _=document.querySelector("#heatmap-label");if(_)_.textContent=`${($.changed/$.total*100).toFixed(2)}% pixels differ`},WT.postMessage({left:J,right:O,scale:1.5,generation:Y},[J,O])}function FT(T,D=!0){if(T<0||T>=z.revisions.length)return;let Y=N;N=T,m="right",A0(Y,N,D),zT(D),CT(),n(),v(),IT(T)}async function IT(T){let D=z.revisions[T];if(!["ready","entrypoint_missing","error"].includes(D.render?.phase??""))return;if(T===U){p(),CT();return}let J=++YT,O=D.render?.pages.length??0,Q=l(w,O),$=ZT(D.render,Q);if($)try{await $0($)}catch{}if(J!==YT||N!==T)return;U=T,w=Q,p(),CT(),_0()}function $0(T){let D=P.get(T);if(D)return P.delete(T),P.set(T,D),D;let Y=new Image;Y.decoding="async";let J=new Promise((O,Q)=>{Y.addEventListener("load",()=>{Y.decode().then(O,O)}),Y.addEventListener("error",()=>Q(Error(`Could not preload ${T}`))),Y.src=T}).catch((O)=>{throw P.delete(T),O});P.set(T,J);while(P.size>12){let O=P.keys().next().value;if(O===void 0)break;P.delete(O)}return J}function _0(){let T=RT(),D=T.indexOf(z.revisions[N].key);for(let Y of[-2,-1,1,2]){let J=T[D+Y];if(!J)continue;let O=ZT(k(J).render,w);if(O)$0(O).catch(()=>{return})}}function CT(){let T=F("#stage"),D=N!==U;T.dataset.previewPending=String(D),T.setAttribute("aria-busy",String(D))}function tT(T){let D=XT(),Y=D.indexOf(z.revisions[N].key);if(Y<0)return;let J=Math.min(D.length-1,Math.max(0,Y+T));FT(R(D[J]))}function v(T=!1){let D={revisionKey:z.revisions[N].key,pinnedRevisionKey:z.revisions[C].key,historyMode:q,generation:++E0};if(pT.schedule(D),T)pT.flush()}function ZT(T,D){if(T?.phase!=="ready"||!T.render_id||!T.pages[D])return null;return`${g}/assets/${T.render_id}/page/${T.pages[D].number}`}function B0(T){let D=sT.get(T.parent_ids[0]);return Boolean(D&&a(T.render,D.render))}function c(T,D){return`<button type="button" data-mode="${T}" aria-pressed="${T===W}">${D}</button>`}function RT(){return q==="first-parent"?z.history.first_parent_keys:z.history.full_tree_keys}function XT(){let T=RT();if(q==="full-tree"||!wT)return T;return T.filter((D,Y)=>{if(Y===T.length-1)return!0;return!a(k(D).render,k(T[Y+1]).render)})}function k(T){let D=$T.get(T);if(!D)throw Error(`Unknown revision: ${T}`);return D}function R(T){return nT.get(T)??-1}function ST(T){return V0.format(new Date(T))}async function rT(T){let D=await new Promise((Y,J)=>{let O=new Image;O.decoding="async",O.onload=()=>Y(O),O.onerror=()=>J(Error(`Could not load ${T}`)),O.src=T});return createImageBitmap(D)}function F(T){let D=document.querySelector(T);if(!D)throw Error(`Missing UI element: ${T}`);return D}function V(T){return T.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
