function p(T,D){if(T?.phase!=="ready"||D?.phase!=="ready")return!1;if(T.pages.length!==D.pages.length)return!1;return T.pages.every((Y,J)=>Y.hash===D.pages[J]?.hash)}function KT(T,D){let Y=rT(T,D);if(Y.filter((Q)=>Q.unique).length===0)return{pairs:[],confidence:null,shifted:!1,anchorCount:Y.length};let _=iT(Y),O=[],$=-1,z=-1;return Y.forEach((Q,Z)=>{IT(O,$+1,Q.leftIndex,z+1,Q.rightIndex,RT(_,Z-1,Z),Z>0),O.push({leftIndex:Q.leftIndex,rightIndex:Q.rightIndex,relation:"same",confidence:Q.unique&&_.has(Z)?"high":"medium"}),$=Q.leftIndex,z=Q.rightIndex}),IT(O,$+1,T.length,z+1,D.length,RT(_,Y.length-1,Y.length),!1),{pairs:O,confidence:_.size>0?"high":"medium",shifted:O.some((Q)=>Q.leftIndex===null||Q.rightIndex===null||Q.leftIndex!==Q.rightIndex),anchorCount:Y.length}}function AT(T,D,Y){return T.pairs.find((J)=>D==="left"?J.leftIndex===Y:J.rightIndex===Y)}function JT(T){if(T.leftIndex===null||T.rightIndex===null)return;return{pageA:T.leftIndex,pageB:T.rightIndex}}function rT(T,D){if((T.length+1)*(D.length+1)>250000)return[];let Y=qT(T),J=qT(D),_=Array.from({length:T.length+1},()=>Array(D.length+1).fill(0));for(let Q=T.length-1;Q>=0;Q-=1)for(let Z=D.length-1;Z>=0;Z-=1)_[Q][Z]=T[Q].hash===D[Z].hash?_[Q+1][Z+1]+1:Math.max(_[Q+1][Z],_[Q][Z+1]);let O=[],$=0,z=0;while($<T.length&&z<D.length){let Q=T[$].hash;if(Q===D[z].hash)O.push({leftIndex:$,rightIndex:z,unique:Y.get(Q)===1&&J.get(Q)===1}),$+=1,z+=1;else if(_[$+1][z]>=_[$][z+1])$+=1;else z+=1}return O}function qT(T){let D=new Map;return T.forEach((Y)=>D.set(Y.hash,(D.get(Y.hash)??0)+1)),D}function iT(T){let D=new Set;for(let Y=1;Y<T.length;Y+=1){let J=T[Y-1],_=T[Y];if(J.unique&&_.unique&&_.leftIndex===J.leftIndex+1&&_.rightIndex===J.rightIndex+1)D.add(Y-1),D.add(Y)}return D}function RT(T,D,Y){return T.has(D)||T.has(Y)?"high":"medium"}function IT(T,D,Y,J,_,O,$){let z=Y-D,Q=_-J;if($&&z===Q){for(let Z=0;Z<z;Z+=1)T.push({leftIndex:D+Z,rightIndex:J+Z,relation:"changed",confidence:"medium"});return}for(let Z=D;Z<Y;Z+=1)T.push({leftIndex:Z,rightIndex:null,relation:"removed",confidence:O});for(let Z=J;Z<_;Z+=1)T.push({leftIndex:null,rightIndex:Z,relation:"added",confidence:O})}function y(T){return T.slice(0,8)}function S(T){switch(T?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${T.pages.length} page${T.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function ST(T,D){let Y=new Map(T.map((Z)=>[Z.key,Z])),J=new Map(T.map((Z)=>[Z.commit_id,Z.key])),_=new Set(D.map((Z)=>Y.get(Z)?.commit_id).filter((Z)=>Boolean(Z))),O=[],$=[];D.forEach((Z,M)=>{let G=Y.get(Z);if(!G)return;let L=O.indexOf(G.commit_id);if(L<0)L=O.length;else O.splice(L,1);$.push({key:Z,row:M,lane:L}),G.parent_ids.filter((U)=>_.has(U)).forEach((U,c)=>{if(O.includes(U))return;O.splice(Math.min(L+c,O.length),0,U)})});let z=new Map($.map((Z)=>[Z.key,Z])),Q=D.flatMap((Z)=>{let M=Y.get(Z);if(!M||!z.has(Z))return[];return M.parent_ids.flatMap((G,L)=>{let U=J.get(G);if(!U||!z.has(U))return[];return[{child:Z,parent:U,merge:L>0}]})});return{nodes:$,edges:Q,laneCount:Math.max(1,...$.map((Z)=>Z.lane+1))}}class OT{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(T,D=window.requestAnimationFrame.bind(window),Y=window.cancelAnimationFrame.bind(window)){this.apply=T;this.scheduleFrame=D;this.cancelFrame=Y}schedule(T){if(this.latest=T,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let T=this.latest;this.latest=void 0,this.pending=!1,this.apply(T)}}class QT{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(T,D,Y=performance.now.bind(performance),J=window.setTimeout.bind(window),_=window.clearTimeout.bind(window)){this.interval=T;this.apply=D;this.now=Y;this.scheduleDelay=J;this.cancelDelay=_}schedule(T){this.latest=T;let D=this.interval-(this.now()-this.lastApplied);if(D<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,D))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let T=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(T)}}var a=location.pathname.replace(/\/$/,""),$T=new Worker(`${a}/diff-worker.js`,{type:"module"}),R=X("#app"),eT=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),TD=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),F,jT=new Map,uT=new Map,hT=new Map,i=new Map,j=0,W=0,C=1,I=0,E=0,x="right",V="single",q="first-parent",b=50,NT=!1,m=!1,o=0,g=!1,FT=0,DD=0,f=new Map,ZT=new OT((T)=>{DT(T,!1)}),kT=new QT(50,(T)=>{fetch(`${a}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:T.revisionKey,pinned_revision_key:T.pinnedRevisionKey,history_mode:T.historyMode,generation:T.generation})})});$T.addEventListener("error",(T)=>{let D=document.querySelector("#heatmap-label");if(D)D.textContent=`Could not calculate heatmap: ${T.message}`});YD();async function YD(){R.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let T=await fetch(`${a}/api/session`);if(!T.ok)throw Error("Could not load Typst history.");F=await T.json(),jT=new Map(F.revisions.map((D)=>[D.key,D])),uT=new Map(F.revisions.map((D,Y)=>[D.key,Y])),hT=new Map(F.revisions.map((D)=>[D.commit_id,D])),i=new Map(F.history.first_parent_keys.map((D,Y)=>[D,Y])),j=P(F.history.first_parent_keys[0]),W=j,C=P(F.history.first_parent_keys[1]??F.history.first_parent_keys[0]),_D(),OD(),d(!0)}function _D(){let T=F.repository.root.split("/").filter(Boolean).at(-1)??"repository";R.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${w(F.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${F.repository.kind}</span>
        <strong>${w(T)}</strong>
        <span>${F.revisions.length} revisions</span>
        <span title="${w(F.compiler)}">${w(F.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${u("single","B")}
          ${u("side","A · B")}
          ${u("blink","Blink")}
          ${u("opacity","Mix")}
          ${u("wipe","Wipe")}
          ${u("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${b}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${b}" aria-label="Comparison position percentage" />
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
          <div class="history-mode-group" role="group" aria-label="History shape">
            <button type="button" data-history-mode="first-parent" aria-pressed="true">First parent</button>
            <button type="button" data-history-mode="full-tree" aria-pressed="false">Full tree</button>
          </div>
          <label class="collapse">
            <input id="collapse" type="checkbox" />
            Hide visually unchanged
          </label>
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
  `,JD(),cT()}function JD(){R.querySelectorAll("[data-mode]").forEach((D)=>{D.addEventListener("click",()=>{V=D.dataset.mode,B(),vT(),TT()})}),X("#mix").addEventListener("input",(D)=>{zT(Number(D.target.value))}),X("#mix-number").addEventListener("input",(D)=>{zT(Number(D.target.value))}),X("#pin-a").addEventListener("click",()=>{W=j,E=Math.min(E,(F.revisions[W].render?.pages.length??1)-1);let D=C;C=j,I=E,x="right",$D(D,C),h(),d(!0)}),X("#collapse").addEventListener("change",(D)=>{NT=D.target.checked,VT(),e()}),R.querySelectorAll("[data-history-mode]").forEach((D)=>{D.addEventListener("click",()=>{q=D.dataset.historyMode;let Y=WT();if(!Y.includes(F.revisions[j].key))j=P(Y[0]),E=0;x="right",ZT.cancel(),FT+=1,W=j,cT(),d(!0)})}),X("#revision-slider").addEventListener("input",(D)=>{let J=[...YT()].reverse()[Number(D.target.value)];if(J)ZT.schedule(P(J))}),X("#revision-slider").addEventListener("change",(D)=>{ZT.flush(),d(!0)}),X("#page-a").addEventListener("change",(D)=>{I=Number(D.target.value),x="left",B(),l(),n()}),X("#page-b").addEventListener("change",(D)=>{E=Number(D.target.value),x="right",B(),l(),n()}),X("#apply-pair").addEventListener("click",()=>{let D=dT(),Y=D?JT(D):null;if(!Y)return;I=Y.pageA,E=Y.pageB,h()});let T=X("#stage");T.addEventListener("pointerdown",(D)=>{if(V==="blink")m=!0,B();else if(V==="wipe"&&D.button===0)g=!0,T.setPointerCapture(D.pointerId),mT(D)}),T.addEventListener("pointermove",(D)=>{if(g)mT(D)}),T.addEventListener("pointerup",(D)=>{if(g)g=!1,T.releasePointerCapture(D.pointerId)}),window.addEventListener("pointerup",()=>{if(m)m=!1,B();g=!1}),window.addEventListener("keydown",(D)=>{if(D.target instanceof HTMLInputElement||D.target instanceof HTMLSelectElement)return;if(D.key==="ArrowLeft")xT(1);else if(D.key==="ArrowRight")xT(-1);else if(D.code==="Space"&&V==="blink"&&!D.repeat)D.preventDefault(),m=!0,B()}),window.addEventListener("keyup",(D)=>{if(D.code==="Space"&&m)m=!1,B()})}function OD(){let T=new EventSource(`${a}/api/events`);T.addEventListener("render",(D)=>{let Y=JSON.parse(D.data),J=jT.get(Y.status.revision_key);if(!J)return;if(J.render=Y.status,ZD(J),Y.status.phase==="ready")tT()}),T.onerror=()=>{document.body.dataset.connection="lost"}}function cT(){lT(),pT(),gT(),l(),VT(),e(),n(),B(),TT(),vT(),QD()}function vT(){R.querySelectorAll("[data-mode]").forEach((Y)=>{Y.setAttribute("aria-pressed",String(Y.dataset.mode===V))});let T=X(".mix-control"),D=V==="opacity"||V==="wipe";T.dataset.visible=String(D),T.hidden=!D,X("#mix-label").textContent=V==="opacity"?"Blend":"Wipe"}function QD(){R.querySelectorAll("[data-history-mode]").forEach((D)=>{D.setAttribute("aria-pressed",String(D.dataset.historyMode===q))});let T=X("#collapse");T.disabled=q==="full-tree",X("#history-title").textContent=q==="first-parent"?"First-parent history":"Full revision tree",X("#history-description").textContent=q==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function ZD(T){BT(T);let D=i.get(T.key);if(D!=null&&D>0)BT(K(F.history.first_parent_keys[D-1]));if(NT&&q==="first-parent"&&T.render?.phase==="ready")VT(),e();let Y=F.revisions[W],J=P(T.key),_=["ready","entrypoint_missing","error"].includes(T.render?.phase??"");if(J===j&&_){aT(J);return}if((J===W||J===C||Y.parent_ids[0]===T.commit_id)&&_)h()}function BT(T){R.querySelectorAll(`[data-revision-key="${T.key}"]`).forEach((D)=>{if(D.dataset.phase=T.render?.phase??"idle",D.classList.contains("frame")){let J=i.get(T.key),_=J==null?void 0:F.history.first_parent_keys[J+1],O=p(T.render,_?K(_).render:void 0),$=D.querySelector(".frame-meta");if($)$.textContent=`${y(T.commit_id)} · ${O?"same output":S(T.render)}`}let Y=D.querySelector(".tree-meta");if(Y)Y.textContent=`${y(T.commit_id)} · ${S(T.render)}`}),R.querySelectorAll(`[data-ready-key="${T.key}"]`).forEach((D)=>{D.dataset.phase=T.render?.phase??"idle",D.title=`${T.subject||"(no description)"} · ${S(T.render)}`})}function h(){lT(),pT(),gT(),l(),n(),B(),TT()}function $D(T,D){s(T,"pinned",!1),s(D,"pinned",!0)}function FD(T,D,Y){if(s(T,"selected",!1),s(D,"selected",!0),R.querySelectorAll(`[data-index="${T}"]`).forEach((_)=>{_.setAttribute("aria-selected","false")}),R.querySelectorAll(`[data-index="${D}"]`).forEach((_)=>{_.setAttribute("aria-selected","true")}),!Y)return;let J=R.querySelector(`[data-index="${D}"]`);if(J&&q==="full-tree"){let _=X("#tree");_.scrollTop=Math.max(0,J.offsetTop-_.clientHeight/2+J.clientHeight/2)}else if(J){let _=X("#film");_.scrollLeft=Math.max(0,J.offsetLeft-_.clientWidth/2+J.clientWidth/2)}}function s(T,D,Y){R.querySelectorAll(`[data-index="${T}"]`).forEach((J)=>{J.classList.toggle(D,Y)})}function pT(){bT(X("#revision-a"),F.revisions[C],"A",C===W),bT(X("#revision-b"),F.revisions[W],"B",!1)}function bT(T,D,Y,J){let _=eT.format(new Date(D.committed_at));T.innerHTML=`
    <div class="revision-letter">${Y}</div>
    <p class="revision-date">${_}</p>
    <h2>${w(D.subject||"(no description)")}</h2>
    <p class="revision-author">${w(D.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${D.commit_id}">${y(D.commit_id)}</dd></div>
      ${D.change_id?`<div><dt>Change</dt><dd title="${D.change_id}">${y(D.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${S(D.render)}</dd></div>
    </dl>
    ${D.bookmarks.map((O)=>`<span class="bookmark">${w(O)}</span>`).join("")}
    ${J?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function VT(){let T=X("#film"),D=X("#tree");if(T.hidden=q!=="first-parent",D.hidden=q!=="full-tree",q==="full-tree"){zD(D);return}let Y=T.scrollLeft,J=F.revisions[j].key,_=T.dataset.selectedKey!==J,$=YT().map((Q)=>({revision:K(Q),index:P(Q)})).reverse();T.innerHTML=$.map(({revision:Q,index:Z})=>{let M=Q.render?.phase??"idle",G=i.get(Q.key)??-1,L=F.history.first_parent_keys[G+1],U=L?K(L):void 0,c=p(Q.render,U?.render);return`
        <button
          class="frame ${Z===j?"selected":""} ${Z===C?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${Z===j}"
          data-index="${Z}"
          data-revision-key="${Q.key}"
          data-phase="${M}"
          title="${w(Q.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${GT(Q.committed_at)}</time>
          <strong>${w(Q.subject||"(no description)")}</strong>
          <span class="frame-meta">${y(Q.commit_id)} · ${c?"same output":S(Q.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),T.querySelectorAll(".frame").forEach((Q)=>{Q.addEventListener("click",()=>DT(Number(Q.dataset.index)))});let z=T.querySelector(".selected");if(T.dataset.selectedKey=J,z&&_)T.scrollLeft=Math.max(0,z.offsetLeft-T.clientWidth/2+z.clientWidth/2);else T.scrollLeft=Y}function zD(T){let D=F.history.full_tree_keys,Y=ST(F.revisions,D),J=new Map(Y.nodes.map((N)=>[N.key,N])),_=T.scrollTop,O=F.revisions[j].key,$=T.dataset.selectedKey!==O,z=58,Q=8,Z=Math.min(8,Y.laneCount),M=34+Z*18,G=(N)=>Y.laneCount<2?18:16+N/(Y.laneCount-1)*(M-32),L=D.length*58+16,U=new Map(Y.nodes.map((N)=>[N.key,N.row])),c=Y.edges.map((N)=>{let H=J.get(N.child),A=J.get(N.parent);if(!H||!A)return"";let v=U.get(N.child),LT=U.get(N.parent);if(v==null||LT==null)return"";let UT=G(H.lane),CT=8+v*58+29,MT=G(A.lane),wT=8+LT*58+29,HT=(CT+wT)/2;return`<path class="${N.merge?"merge-edge":""}" d="M ${UT} ${CT} C ${UT} ${HT}, ${MT} ${HT}, ${MT} ${wT}" />`}).join(""),sT=Y.nodes.map((N)=>{let H=U.get(N.key);if(H==null)return"";let A=P(N.key);return`<circle class="${[A===j?"selected":"",A===C?"pinned":""].filter(Boolean).join(" ")}" cx="${G(N.lane)}" cy="${8+H*58+29}" r="5" />`}).join(""),nT=Y.nodes.map((N)=>{let H=K(N.key),A=P(N.key),v=H.render?.phase??"idle";return`
        <button
          class="tree-node ${A===j?"selected":""} ${A===C?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${A===j}"
          data-index="${A}"
          data-revision-key="${H.key}"
          data-phase="${v}"
          title="${w(H.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${w(H.subject||"(no description)")}</strong>
            <time>${GT(H.committed_at)}</time>
          </span>
          <span class="tree-meta">${y(H.commit_id)} · ${S(H.render)}</span>
        </button>
      `}).join("");T.innerHTML=`
    <div class="tree-canvas" data-lanes="${Z}">
      <svg aria-hidden="true" viewBox="0 0 ${M} ${L}" width="${M}" height="${L}">${c}${sT}</svg>
      ${nT}
    </div>
  `,T.querySelectorAll(".tree-node").forEach((N)=>{N.addEventListener("click",()=>DT(Number(N.dataset.index)))});let _T=T.querySelector(".tree-node.selected");if(T.dataset.selectedKey=O,_T&&$)T.scrollTop=Math.max(0,_T.offsetTop-T.clientHeight/2+_T.clientHeight/2);else T.scrollTop=_}function e(T=!0){let D=[...YT()].reverse(),Y=X("#revision-slider"),J=F.revisions[j].key,_=Math.max(0,D.indexOf(J));if(Y.max=String(Math.max(0,D.length-1)),T)Y.value=String(_);let O=D[_]?K(D[_]):void 0;X("#revision-position").textContent=O?`${_+1} / ${D.length} · ${GT(O.committed_at)} · ${O.subject||"(no description)"}`:"No revision",XD(D)}function XD(T){let D=X("#readiness-rail"),Y=T.join("\x00");if(D.dataset.keys!==Y)D.dataset.keys=Y,D.innerHTML=T.map((_)=>{let O=K(_);return`<span
          data-ready-key="${O.key}"
          data-phase="${O.render?.phase??"idle"}"
          title="${w(`${O.subject||"(no description)"} · ${S(O.render)}`)}"
        ></span>`}).join("");let J=F.revisions[j].key;D.querySelectorAll("[data-ready-key]").forEach((_)=>{let O=_.dataset.readyKey,$=O?K(O):void 0;_.dataset.phase=$?.render?.phase??"idle",_.classList.toggle("selected",O===J)})}function gT(){PT(X("#page-a"),F.revisions[C].render,I),PT(X("#page-b"),F.revisions[W].render,E)}function PT(T,D,Y){let J=D?.phase==="ready"?D.pages.length:0;if(J===0){T.innerHTML='<option value="0">—</option>',T.disabled=!0;return}T.disabled=!1,T.innerHTML=Array.from({length:J},(_,O)=>`<option value="${O}" ${O===Y?"selected":""}>${O+1}</option>`).join("")}function ET(){let T=F.revisions[C].render,D=F.revisions[W].render;return KT(T?.phase==="ready"?T.pages:[],D?.phase==="ready"?D.pages:[])}function dT(T=ET()){if(!T.shifted)return null;return AT(T,x,x==="left"?I:E)??null}function lT(){let T=F.revisions[C].render,D=F.revisions[W].render;if(T?.phase==="ready"&&T.pages.length>0)I=Math.min(I,T.pages.length-1);if(D?.phase==="ready"&&D.pages.length>0)E=Math.min(E,D.pages.length-1)}function l(){let T=X("#pair-suggestion"),D=X("#pair-confidence"),Y=X("#pair-suggestion-text"),J=X("#apply-pair");if(j!==W){T.hidden=!0;return}let _=ET(),O=dT(_),$=O?JT(O):null;if(O&&!$){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent=O.rightIndex!=null?`B ${O.rightIndex+1} has no reliable A pair. Choose pages manually.`:`A ${(O.leftIndex??0)+1} has no reliable B pair. Choose pages manually.`;return}if(!O||!O.confidence||!$||O.leftIndex===O.rightIndex){let M=F.revisions[C].render,G=F.revisions[W].render;if(M?.phase==="ready"&&G?.phase==="ready"&&M.pages.length!==G.pages.length&&!_.shifted){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent="Could not align these pages reliably. Choose A and B manually.";return}T.hidden=!0,T.removeAttribute("data-confidence");return}let z=$.pageA+1,Q=$.pageB+1,Z=I===$.pageA&&E===$.pageB;T.hidden=!1,T.dataset.confidence=O.confidence,D.hidden=!1,D.textContent=`${O.confidence} confidence`,Y.textContent=Z?`Aligned pair: A ${z} with B ${Q}.`:`Likely page shift: A ${z} matches B ${Q}.`,J.hidden=Z,J.textContent=`Use A ${z} / B ${Q}`,J.setAttribute("aria-label",`Use A page ${z} and B page ${Q}`)}function n(){let T=ET(),D=X("#page-rail");if(T.pairs.length===0){let Y=F.revisions[C].render,J=F.revisions[W].render,_=Y?.phase==="ready"?Y.pages:[],O=J?.phase==="ready"?J.pages:[],$=Math.max(_.length,O.length);D.innerHTML=Array.from({length:$},(z,Q)=>{let Z=_[Q],M=O[Q];if(!Z||!M){let U=Z?`A${Q+1}`:`B${Q+1}`;return`<span class="page-tick unpaired" aria-label="${U} has no reliable pair">${U}</span>`}let G=Z.hash===M.hash?"same":"changed",L=I===Q&&E===Q;return`<button
        type="button"
        class="page-tick ${G} ${L?"active":""}"
        data-page-a="${Q}"
        data-page-b="${Q}"
        aria-pressed="${L}"
        aria-label="Use physical page ${Q+1} for A and B, ${G}"
      >${Q+1}</button>`}).join("")}else D.innerHTML=T.pairs.map((Y)=>{let J=Y.leftIndex==null?null:Y.leftIndex+1,_=Y.rightIndex==null?null:Y.rightIndex+1,O=Y.leftIndex===I&&Y.rightIndex===E,$=J!=null&&_!=null&&J!==_,z=$?`<span>A${J}</span><span>B${_}</span>`:String(_??J??"—"),Q=jD(Y);if(Y.leftIndex==null||Y.rightIndex==null)return`<span
          class="page-tick ${Y.relation} unpaired"
          aria-label="${w(Q)}"
        >${z}</span>`;return`<button
        type="button"
        class="page-tick ${Y.relation} ${O?"active":""} ${$?"shifted":""}"
        data-page-a="${Y.leftIndex}"
        data-page-b="${Y.rightIndex}"
        aria-pressed="${O}"
        aria-label="${w(Q)}"
      >${z}</button>`}).join("");D.querySelectorAll(".page-tick").forEach((Y)=>{Y.addEventListener("click",()=>{let J=Y.dataset.pageA,_=Y.dataset.pageB;if(J==null||_==null)return;I=Number(J),E=Number(_),x="right",h()})})}function jD(T){let D=T.confidence?`, ${T.confidence} confidence`:"";if(T.leftIndex==null&&T.rightIndex!=null)return`B page ${T.rightIndex+1} has no reliable A pair`;if(T.rightIndex==null&&T.leftIndex!=null)return`A page ${T.leftIndex+1} has no reliable B pair`;return`Use A page ${(T.leftIndex??0)+1} and B page ${(T.rightIndex??0)+1}, ${T.relation}${D}`}function B(){let T=X("#stage"),D=F.revisions[C],Y=F.revisions[W],J=r(D.render,I),_=r(Y.render,E);if(ND(T),V==="heatmap"){let z=`${J??"missing"}\x00${_??"missing"}`;if(J&&_&&T.dataset.comparison!==z){T.dataset.comparison=z;let Q=X("#heatmap-label");Q.textContent="Calculating visual difference…",VD(J,_)}return}fT(T.querySelector('[data-page-slot="a"]'),D,J,"A"),fT(T.querySelector('[data-page-slot="b"]'),Y,_,"B");let O=T.querySelector(".blink-pages");O?.classList.toggle("show-a",m),O?.classList.toggle("show-b",!m);let $=T.querySelector(".same-output");if($)$.hidden=!ED(Y)}function ND(T){if(T.dataset.mode===V)return;if(T.dataset.mode=V,T.dataset.comparison="",V==="single")T.innerHTML=`
      <div class="single-page">
        ${k("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(V==="side")T.innerHTML=`<div class="split-pages">${k("a")}${k("b")}</div>`;else if(V==="blink")T.innerHTML=`
      <div class="stack-pages blink-pages show-b">
        ${k("a")}
        ${k("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(V==="opacity")T.innerHTML=`
      <div class="stack-pages">
        ${k("a")}
        <div class="overlay-page mix-page">${k("b")}</div>
      </div>
    `;else if(V==="wipe")T.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${k("a")}
        <div class="overlay-page wipe">${k("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else T.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function k(T){let D=T.toUpperCase();return`
    <div class="page-slot" data-page-slot="${T}">
      <img class="document-page" alt="Revision ${D}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${D}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function fT(T,D,Y,J){if(!T)return;let _=T.querySelector("img"),O=T.querySelector(".render-status");if(!_||!O)return;if(Y){if(_.getAttribute("src")!==Y)_.src=Y;_.hidden=!1,O.hidden=!0;return}_.hidden=!0,O.hidden=!1,O.className=`render-status ${D.render?.phase??"idle"}`;let $=O.querySelector("strong"),z=O.querySelector("p");if($)$.textContent=S(D.render);if(z)z.textContent=D.render?.message??(D.render?.phase?"Preparing this revision…":`Select revision ${J} to render it.`)}function zT(T){if(!Number.isFinite(T))return;b=Math.min(100,Math.max(0,Math.round(T))),TT()}function TT(){let T=document.querySelector("#mix"),D=document.querySelector("#mix-number");if(T)T.value=String(b);if(D)D.value=String(b);t(document.querySelector(".mix-page"),{opacity:b/100}),t(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-b}% 0 0)`}),t(document.querySelector(".wipe-line"),{left:`${b}%`}),t(document.querySelector(".wipe-handle"),{left:`${b}%`})}function t(T,D){if(!T)return;T.getAnimations().forEach((Y)=>Y.cancel()),T.animate([D,D],{duration:1,fill:"forwards"})}function mT(T){let D=document.querySelector(".wipe-pages");if(!D)return;let Y=D.getBoundingClientRect();zT((T.clientX-Y.left)/Y.width*100)}async function VD(T,D){let Y=++o,J,_;try{[J,_]=await Promise.all([yT(T),yT(D)])}catch(O){if(Y===o&&V==="heatmap"){let $=document.querySelector("#heatmap-label");if($)$.textContent=`Could not calculate heatmap: ${String(O)}`}return}if(Y!==o||V!=="heatmap"){J.close(),_.close();return}$T.onmessage=(O)=>{let $=O.data;if($.generation!==o||V!=="heatmap"){$.bitmap.close();return}let z=document.querySelector("#heatmap");if(!z){$.bitmap.close();return}z.width=$.width,z.height=$.height;let Q=z.getContext("bitmaprenderer");if(Q)Q.transferFromImageBitmap($.bitmap);else z.getContext("2d").drawImage($.bitmap,0,0),$.bitmap.close();let Z=document.querySelector("#heatmap-label");if(Z)Z.textContent=`${($.changed/$.total*100).toFixed(2)}% pixels differ`},$T.postMessage({left:J,right:_,scale:1.5,generation:Y},[J,_])}function DT(T,D=!0){if(T<0||T>=F.revisions.length)return;let Y=j;j=T,x="right",FD(Y,j,D),e(D),XT(),l(),d(),aT(T)}async function aT(T){let D=F.revisions[T];if(!["ready","entrypoint_missing","error"].includes(D.render?.phase??""))return;if(T===W){h(),XT();return}let J=++FT,_=D.render?.pages.length??1,O=Math.min(E,_-1),$=r(D.render,O);if($)try{await oT($)}catch{}if(J!==FT||j!==T)return;W=T,E=O,h(),XT(),tT()}function oT(T){let D=f.get(T);if(D)return f.delete(T),f.set(T,D),D;let Y=new Image;Y.decoding="async";let J=new Promise((_,O)=>{Y.addEventListener("load",()=>{Y.decode().then(_,_)}),Y.addEventListener("error",()=>O(Error(`Could not preload ${T}`))),Y.src=T}).catch((_)=>{throw f.delete(T),_});f.set(T,J);while(f.size>12){let _=f.keys().next().value;if(_===void 0)break;f.delete(_)}return J}function tT(){let T=WT(),D=T.indexOf(F.revisions[j].key);for(let Y of[-2,-1,1,2]){let J=T[D+Y];if(!J)continue;let _=r(K(J).render,E);if(_)oT(_).catch(()=>{return})}}function XT(){let T=X("#stage"),D=j!==W;T.dataset.previewPending=String(D),T.setAttribute("aria-busy",String(D))}function xT(T){let D=YT(),Y=D.indexOf(F.revisions[j].key);if(Y<0)return;let J=Math.min(D.length-1,Math.max(0,Y+T));DT(P(D[J]))}function d(T=!1){let D={revisionKey:F.revisions[j].key,pinnedRevisionKey:F.revisions[C].key,historyMode:q,generation:++DD};if(kT.schedule(D),T)kT.flush()}function r(T,D){if(T?.phase!=="ready"||!T.render_id||!T.pages[D])return null;return`${a}/assets/${T.render_id}/page/${T.pages[D].number}`}function ED(T){let D=hT.get(T.parent_ids[0]);return Boolean(D&&p(T.render,D.render))}function u(T,D){return`<button type="button" data-mode="${T}" aria-pressed="${T===V}">${D}</button>`}function WT(){return q==="first-parent"?F.history.first_parent_keys:F.history.full_tree_keys}function YT(){let T=WT();if(q==="full-tree"||!NT)return T;return T.filter((D,Y)=>{if(Y===T.length-1)return!0;return!p(K(D).render,K(T[Y+1]).render)})}function K(T){let D=jT.get(T);if(!D)throw Error(`Unknown revision: ${T}`);return D}function P(T){return uT.get(T)??-1}function GT(T){return TD.format(new Date(T))}async function yT(T){let D=await new Promise((Y,J)=>{let _=new Image;_.decoding="async",_.onload=()=>Y(_),_.onerror=()=>J(Error(`Could not load ${T}`)),_.src=T});return createImageBitmap(D)}function X(T){let D=document.querySelector(T);if(!D)throw Error(`Missing UI element: ${T}`);return D}function w(T){return T.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
