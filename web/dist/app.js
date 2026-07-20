function a(T,D){if(D<=0)return 0;return Math.min(Math.max(T,0),D-1)}function PT(T,D,Y,J){if(D.length===0)throw Error("cannot select from empty history");let O=D.includes(Y)?Y:D[D.length-1],Q=new Set(T.map((X)=>X.key)),$=T.find((X)=>X.key===O),F=new Map(T.map((X)=>[X.commit_id,X.key])),Z=$?.parent_ids.map((X)=>F.get(X)).find((X)=>X!=null),_=Q.has(J)?J:Z??O;return{selectedKey:O,pinnedKey:_,selectedReset:O!==Y,pinnedReset:_!==J}}var QD=250000;function o(T,D){if(T?.phase!=="ready"||D?.phase!=="ready")return!1;if(T.pages.length!==D.pages.length)return!1;return T.pages.every((Y,J)=>Y.hash===D.pages[J]?.hash)}function xT(T,D){let Y=ZD(T,D);if(Y.filter((Z)=>Z.unique).length===0)return{pairs:[],confidence:null,shifted:!1,anchorCount:Y.length};let O=$D(Y),Q=[],$=-1,F=-1;return Y.forEach((Z,_)=>{fT(Q,$+1,Z.leftIndex,F+1,Z.rightIndex,bT(O,_-1,_),_>0),Q.push({leftIndex:Z.leftIndex,rightIndex:Z.rightIndex,relation:"same",confidence:Z.unique&&O.has(_)?"high":"medium"}),$=Z.leftIndex,F=Z.rightIndex}),fT(Q,$+1,T.length,F+1,D.length,bT(O,Y.length-1,Y.length),!1),{pairs:Q,confidence:O.size>0?"high":"medium",shifted:Q.some((Z)=>Z.leftIndex===null||Z.rightIndex===null||Z.leftIndex!==Z.rightIndex),anchorCount:Y.length}}function mT(T,D,Y){return T.pairs.find((J)=>D==="left"?J.leftIndex===Y:J.rightIndex===Y)}function jT(T){if(T.leftIndex===null||T.rightIndex===null)return;return{pageA:T.leftIndex,pageB:T.rightIndex}}function ZD(T,D){if((T.length+1)*(D.length+1)>QD)return[];let Y=BT(T),J=BT(D),O=Array.from({length:T.length+1},()=>Array(D.length+1).fill(0));for(let Z=T.length-1;Z>=0;Z-=1)for(let _=D.length-1;_>=0;_-=1)O[Z][_]=T[Z].hash===D[_].hash?O[Z+1][_+1]+1:Math.max(O[Z+1][_],O[Z][_+1]);let Q=[],$=0,F=0;while($<T.length&&F<D.length){let Z=T[$].hash;if(Z===D[F].hash)Q.push({leftIndex:$,rightIndex:F,unique:Y.get(Z)===1&&J.get(Z)===1}),$+=1,F+=1;else if(O[$+1][F]>=O[$][F+1])$+=1;else F+=1}return Q}function BT(T){let D=new Map;return T.forEach((Y)=>D.set(Y.hash,(D.get(Y.hash)??0)+1)),D}function $D(T){let D=new Set;for(let Y=1;Y<T.length;Y+=1){let J=T[Y-1],O=T[Y];if(J.unique&&O.unique&&O.leftIndex===J.leftIndex+1&&O.rightIndex===J.rightIndex+1)D.add(Y-1),D.add(Y)}return D}function bT(T,D,Y){return T.has(D)||T.has(Y)?"high":"medium"}function fT(T,D,Y,J,O,Q,$){let F=Y-D,Z=O-J;if($&&F===Z){for(let _=0;_<F;_+=1)T.push({leftIndex:D+_,rightIndex:J+_,relation:"changed",confidence:"medium"});return}for(let _=D;_<Y;_+=1)T.push({leftIndex:_,rightIndex:null,relation:"removed",confidence:Q});for(let _=J;_<O;_+=1)T.push({leftIndex:null,rightIndex:_,relation:"added",confidence:Q})}function u(T){return T.slice(0,8)}function B(T){switch(T?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${T.pages.length} page${T.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function yT(T,D){let Y=new Map(T.map((_)=>[_.key,_])),J=new Map(T.map((_)=>[_.commit_id,_.key])),O=new Set(D.map((_)=>Y.get(_)?.commit_id).filter((_)=>Boolean(_))),Q=[],$=[];D.forEach((_,X)=>{let L=Y.get(_);if(!L)return;let V=Q.indexOf(L.commit_id);if(V<0)V=Q.length;else Q.splice(V,1);$.push({key:_,row:X,lane:V}),L.parent_ids.filter((U)=>O.has(U)).forEach((U,S)=>{if(Q.includes(U))return;Q.splice(Math.min(V+S,Q.length),0,U)})});let F=new Map($.map((_)=>[_.key,_])),Z=D.flatMap((_)=>{let X=Y.get(_);if(!X||!F.has(_))return[];return X.parent_ids.flatMap((L,V)=>{let U=J.get(L);if(!U||!F.has(U))return[];return[{child:_,parent:U,merge:V>0}]})});return{nodes:$,edges:Z,laneCount:Math.max(1,...$.map((_)=>_.lane+1))}}class XT{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(T,D=window.requestAnimationFrame.bind(window),Y=window.cancelAnimationFrame.bind(window)){this.apply=T;this.scheduleFrame=D;this.cancelFrame=Y}schedule(T){if(this.latest=T,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let T=this.latest;this.latest=void 0,this.pending=!1,this.apply(T)}}class NT{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(T,D,Y=performance.now.bind(performance),J=window.setTimeout.bind(window),O=window.clearTimeout.bind(window)){this.interval=T;this.apply=D;this.now=Y;this.scheduleDelay=J;this.cancelDelay=O}schedule(T){this.latest=T;let D=this.interval-(this.now()-this.lastApplied);if(D<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,D))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let T=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(T)}}var l=location.pathname.replace(/\/$/,""),VT=new Worker(`${l}/diff-worker.js`,{type:"module"}),R=j("#app"),_D=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),zD=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),z,OT=new Map,aT=new Map,oT=new Map,QT=new Map,N=0,G=0,M=1,A=0,C=0,y="right",E="single",H="first-parent",P=50,LT=!1,m=!1,r=0,t=!1,e=0,FD=0,WT=!1,x=new Map,TT=new Map,i=new XT((T)=>{_T(T,!1)}),hT=new NT(50,(T)=>{fetch(`${l}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:T.revisionKey,pinned_revision_key:T.pinnedRevisionKey,history_mode:T.historyMode,generation:T.generation})})});VT.addEventListener("error",(T)=>{let D=document.querySelector("#heatmap-label");if(D)D.textContent=`Could not calculate heatmap: ${T.message}`});jD();async function jD(){R.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let T=await fetch(`${l}/api/session`);if(!T.ok)throw Error("Could not load Typst history.");z=await T.json(),tT(),N=I(z.history.first_parent_keys[0]),G=N,M=I(z.history.first_parent_keys[1]??z.history.first_parent_keys[0]),XD(),WD(),p(!0)}function tT(){OT=new Map(z.revisions.map((T)=>[T.key,T])),aT=new Map(z.revisions.map((T,D)=>[T.key,D])),oT=new Map(z.revisions.map((T)=>[T.commit_id,T])),QT=new Map(z.history.first_parent_keys.map((T,D)=>[T,D])),rT(!1)}function nT(T,D){if(T.render?.phase==="ready"&&D.phase!=="ready")return!1;return T.render=D,!0}function rT(T){for(let[D,Y]of TT){let J=OT.get(D);if(!J)continue;let O=nT(J,Y);if(TT.delete(D),O&&T)iT(J)}}function XD(){let T=z.repository.root.split("/").filter(Boolean).at(-1)??"repository";R.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${w(z.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${z.repository.kind}</span>
        <strong>${w(T)}</strong>
        <span id="revision-count">${z.revisions.length} revisions</span>
        <span title="${w(z.compiler)}">${w(z.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${v("single","B")}
          ${v("side","A · B")}
          ${v("blink","Blink")}
          ${v("opacity","Mix")}
          ${v("wipe","Wipe")}
          ${v("heatmap","Heat")}
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
  `,ND(),UT()}function ND(){j("#history-limit-form").addEventListener("submit",(D)=>{D.preventDefault(),VD()}),R.querySelectorAll("[data-mode]").forEach((D)=>{D.addEventListener("click",()=>{E=D.dataset.mode,f(),sT(),$T()})}),j("#mix").addEventListener("input",(D)=>{ET(Number(D.target.value))}),j("#mix-number").addEventListener("input",(D)=>{ET(Number(D.target.value))}),j("#pin-a").addEventListener("click",()=>{G=N,C=a(C,z.revisions[G].render?.pages.length??0);let D=M;M=N,A=C,y="right",GD(D,M),g(),p(!0)}),j("#collapse").addEventListener("change",(D)=>{LT=D.target.checked,MT(),ZT()}),R.querySelectorAll("[data-history-mode]").forEach((D)=>{D.addEventListener("click",()=>{H=D.dataset.historyMode;let Y=wT();if(!Y.includes(z.revisions[N].key))N=I(Y[0]),C=0;y="right",i.cancel(),e+=1,G=N,UT(),p(!0)})}),j("#revision-slider").addEventListener("input",(D)=>{let J=[...zT()].reverse()[Number(D.target.value)];if(J)i.schedule(I(J))}),j("#revision-slider").addEventListener("change",(D)=>{i.flush(),p(!0)}),j("#page-a").addEventListener("change",(D)=>{A=Number(D.target.value),y="left",f(),n(),YT()}),j("#page-b").addEventListener("change",(D)=>{C=Number(D.target.value),y="right",f(),n(),YT()}),j("#apply-pair").addEventListener("click",()=>{let D=DD(),Y=D?jT(D):null;if(!Y)return;A=Y.pageA,C=Y.pageB,g()});let T=j("#stage");T.addEventListener("pointerdown",(D)=>{if(E==="blink")m=!0,f();else if(E==="wipe"&&D.button===0)t=!0,T.setPointerCapture(D.pointerId),gT(D)}),T.addEventListener("pointermove",(D)=>{if(t)gT(D)}),T.addEventListener("pointerup",(D)=>{if(t)t=!1,T.releasePointerCapture(D.pointerId)}),window.addEventListener("pointerup",()=>{if(m)m=!1,f();t=!1}),window.addEventListener("keydown",(D)=>{if(D.target instanceof HTMLInputElement||D.target instanceof HTMLSelectElement)return;if(D.key==="ArrowLeft")lT(1);else if(D.key==="ArrowRight")lT(-1);else if(D.code==="Space"&&E==="blink"&&!D.repeat)D.preventDefault(),m=!0,f()}),window.addEventListener("keyup",(D)=>{if(D.code==="Space"&&m)m=!1,f()})}async function VD(){let T=j("#history-limit-form"),D=j("#history-limit"),Y=j("#history-limit-form button"),J=j("#history-limit-status"),O=document.activeElement===D||document.activeElement===Y,Q=Number(D.value);if(J.setAttribute("role","status"),!Number.isInteger(Q)||Q<1||Q>z.history.max_limit){J.textContent=`Choose a revision limit from 1 to ${z.history.max_limit}.`,D.focus();return}if(Q===z.history.limit){J.textContent=`History already uses limit ${Q}.`;return}T.setAttribute("aria-busy","true"),D.disabled=!0,Y.disabled=!0,WT=!0,J.textContent=`Loading up to ${Q} matching revisions…`;try{let $=await fetch(`${l}/api/history`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({limit:Q})}),Z=($.headers.get("content-type")??"").includes("application/json")?await $.json():await $.text();if(!$.ok){let h=typeof Z==="string"?Z:("error"in Z)&&Z.error?Z.error:"history request failed";throw Error(h)}let _=z.revisions[N].key,X=z.revisions[G].key,L=z.revisions[M].key,V=Z,U=H==="first-parent"?V.history.first_parent_keys:V.history.full_tree_keys,S=PT(V.revisions,U,_,L),FT=V.revisions.some((h)=>h.key===X)?X:S.selectedKey;i.cancel(),e+=1,z=V,tT(),N=I(S.selectedKey),G=I(FT),M=I(S.pinnedKey),j("#revision-count").textContent=`${z.revisions.length} revisions`,D.max=String(z.history.max_limit),D.value=String(z.history.limit),UT(),p(!0),HT(N);let c=[];if(S.selectedReset)c.push("Previous B was outside the new limit; showing the oldest available revision.");if(S.pinnedReset)c.push("Previous A was outside the new limit; pin moved to B or its parent.");if(c.length>0)J.setAttribute("role","alert");J.textContent=`History updated. ${z.revisions.length} revisions available. ${c.join(" ")}`.trim()}catch($){J.setAttribute("role","alert"),J.textContent=`Could not update history. Previous limit remains. ${$ instanceof Error?$.message:""}`.trim()}finally{if(T.setAttribute("aria-busy","false"),D.disabled=!1,Y.disabled=!1,WT=!1,rT(!0),O)Y.focus()}}function WD(){let T=new EventSource(`${l}/api/events`);T.addEventListener("render",(D)=>{let Y=JSON.parse(D.data);if(WT){TT.set(Y.status.revision_key,Y.status);return}let J=OT.get(Y.status.revision_key);if(!J){TT.set(Y.status.revision_key,Y.status);return}if(!nT(J,Y.status))return;if(iT(J),Y.status.phase==="ready")OD()}),T.onerror=()=>{document.body.dataset.connection="lost"}}function UT(){YD(),eT(),TD(),n(),MT(),ZT(),YT(),f(),$T(),sT(),ED()}function sT(){R.querySelectorAll("[data-mode]").forEach((Y)=>{Y.setAttribute("aria-pressed",String(Y.dataset.mode===E))});let T=j(".mix-control"),D=E==="opacity"||E==="wipe";T.dataset.visible=String(D),T.hidden=!D,j("#mix-label").textContent=E==="opacity"?"Blend":"Wipe"}function ED(){R.querySelectorAll("[data-history-mode]").forEach((D)=>{D.setAttribute("aria-pressed",String(D.dataset.historyMode===H))});let T=j("#collapse");T.disabled=H==="full-tree",j("#history-title").textContent=H==="first-parent"?"First-parent history":"Full revision tree",j("#history-description").textContent=H==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function iT(T){uT(T);let D=QT.get(T.key);if(D!=null&&D>0)uT(k(z.history.first_parent_keys[D-1]));if(LT&&H==="first-parent"&&T.render?.phase==="ready")MT(),ZT();let Y=z.revisions[G],J=I(T.key),O=["ready","entrypoint_missing","error"].includes(T.render?.phase??"");if(J===N&&O){HT(J);return}if((J===G||J===M||Y.parent_ids[0]===T.commit_id)&&O)g()}function uT(T){R.querySelectorAll(`[data-revision-key="${T.key}"]`).forEach((D)=>{if(D.dataset.phase=T.render?.phase??"idle",D.classList.contains("frame")){let J=QT.get(T.key),O=J==null?void 0:z.history.first_parent_keys[J+1],Q=o(T.render,O?k(O).render:void 0),$=D.querySelector(".frame-meta");if($)$.textContent=`${u(T.commit_id)} · ${Q?"same output":B(T.render)}`}let Y=D.querySelector(".tree-meta");if(Y)Y.textContent=`${u(T.commit_id)} · ${B(T.render)}`}),R.querySelectorAll(`[data-ready-key="${T.key}"]`).forEach((D)=>{D.dataset.phase=T.render?.phase??"idle",D.title=`${T.subject||"(no description)"} · ${B(T.render)}`})}function g(){YD(),eT(),TD(),n(),YT(),f(),$T()}function GD(T,D){DT(T,"pinned",!1),DT(D,"pinned",!0)}function LD(T,D,Y){if(DT(T,"selected",!1),DT(D,"selected",!0),R.querySelectorAll(`[data-index="${T}"]`).forEach((O)=>{O.setAttribute("aria-selected","false")}),R.querySelectorAll(`[data-index="${D}"]`).forEach((O)=>{O.setAttribute("aria-selected","true")}),!Y)return;let J=R.querySelector(`[data-index="${D}"]`);if(J&&H==="full-tree"){let O=j("#tree");O.scrollTop=Math.max(0,J.offsetTop-O.clientHeight/2+J.clientHeight/2)}else if(J){let O=j("#film");O.scrollLeft=Math.max(0,J.offsetLeft-O.clientWidth/2+J.clientWidth/2)}}function DT(T,D,Y){R.querySelectorAll(`[data-index="${T}"]`).forEach((J)=>{J.classList.toggle(D,Y)})}function eT(){cT(j("#revision-a"),z.revisions[M],"A",M===G),cT(j("#revision-b"),z.revisions[G],"B",!1)}function cT(T,D,Y,J){let O=_D.format(new Date(D.committed_at));T.innerHTML=`
    <div class="revision-letter">${Y}</div>
    <p class="revision-date">${O}</p>
    <h2>${w(D.subject||"(no description)")}</h2>
    <p class="revision-author">${w(D.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${D.commit_id}">${u(D.commit_id)}</dd></div>
      ${D.change_id?`<div><dt>Change</dt><dd title="${D.change_id}">${u(D.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${B(D.render)}</dd></div>
    </dl>
    ${D.bookmarks.map((Q)=>`<span class="bookmark">${w(Q)}</span>`).join("")}
    ${J?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function MT(){let T=j("#film"),D=j("#tree");if(T.hidden=H!=="first-parent",D.hidden=H!=="full-tree",H==="full-tree"){UD(D);return}let Y=T.scrollLeft,J=z.revisions[N].key,O=T.dataset.selectedKey!==J,$=zT().map((Z)=>({revision:k(Z),index:I(Z)})).reverse();T.innerHTML=$.map(({revision:Z,index:_})=>{let X=Z.render?.phase??"idle",L=QT.get(Z.key)??-1,V=z.history.first_parent_keys[L+1],U=V?k(V):void 0,S=o(Z.render,U?.render);return`
        <button
          class="frame ${_===N?"selected":""} ${_===M?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${_===N}"
          data-index="${_}"
          data-revision-key="${Z.key}"
          data-phase="${X}"
          title="${w(Z.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${qT(Z.committed_at)}</time>
          <strong>${w(Z.subject||"(no description)")}</strong>
          <span class="frame-meta">${u(Z.commit_id)} · ${S?"same output":B(Z.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),T.querySelectorAll(".frame").forEach((Z)=>{Z.addEventListener("click",()=>_T(Number(Z.dataset.index)))});let F=T.querySelector(".selected");if(T.dataset.selectedKey=J,F&&O)T.scrollLeft=Math.max(0,F.offsetLeft-T.clientWidth/2+F.clientWidth/2);else T.scrollLeft=Y}function UD(T){let D=z.history.full_tree_keys,Y=yT(z.revisions,D),J=new Map(Y.nodes.map((W)=>[W.key,W])),O=T.scrollTop,Q=z.revisions[N].key,$=T.dataset.selectedKey!==Q,F=58,Z=8,_=Math.min(8,Y.laneCount),X=34+_*18,L=(W)=>Y.laneCount<2?18:16+W/(Y.laneCount-1)*(X-32),V=D.length*58+16,U=new Map(Y.nodes.map((W)=>[W.key,W.row])),S=Y.edges.map((W)=>{let q=J.get(W.child),K=J.get(W.parent);if(!q||!K)return"";let d=U.get(W.child),RT=U.get(W.parent);if(d==null||RT==null)return"";let AT=L(q.lane),IT=8+d*58+29,ST=L(K.lane),kT=8+RT*58+29,KT=(IT+kT)/2;return`<path class="${W.merge?"merge-edge":""}" d="M ${AT} ${IT} C ${AT} ${KT}, ${ST} ${KT}, ${ST} ${kT}" />`}).join(""),FT=Y.nodes.map((W)=>{let q=U.get(W.key);if(q==null)return"";let K=I(W.key);return`<circle class="${[K===N?"selected":"",K===M?"pinned":""].filter(Boolean).join(" ")}" cx="${L(W.lane)}" cy="${8+q*58+29}" r="5" />`}).join(""),c=Y.nodes.map((W)=>{let q=k(W.key),K=I(W.key),d=q.render?.phase??"idle";return`
        <button
          class="tree-node ${K===N?"selected":""} ${K===M?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${K===N}"
          data-index="${K}"
          data-revision-key="${q.key}"
          data-phase="${d}"
          title="${w(q.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${w(q.subject||"(no description)")}</strong>
            <time>${qT(q.committed_at)}</time>
          </span>
          <span class="tree-meta">${u(q.commit_id)} · ${B(q.render)}</span>
        </button>
      `}).join("");T.innerHTML=`
    <div class="tree-canvas" data-lanes="${_}">
      <svg aria-hidden="true" viewBox="0 0 ${X} ${V}" width="${X}" height="${V}">${S}${FT}</svg>
      ${c}
    </div>
  `,T.querySelectorAll(".tree-node").forEach((W)=>{W.addEventListener("click",()=>_T(Number(W.dataset.index)))});let h=T.querySelector(".tree-node.selected");if(T.dataset.selectedKey=Q,h&&$)T.scrollTop=Math.max(0,h.offsetTop-T.clientHeight/2+h.clientHeight/2);else T.scrollTop=O}function ZT(T=!0){let D=[...zT()].reverse(),Y=j("#revision-slider"),J=z.revisions[N].key,O=Math.max(0,D.indexOf(J));if(Y.max=String(Math.max(0,D.length-1)),T)Y.value=String(O);let Q=D[O]?k(D[O]):void 0;j("#revision-position").textContent=Q?`${O+1} / ${D.length} · ${qT(Q.committed_at)} · ${Q.subject||"(no description)"}`:"No revision",MD(D)}function MD(T){let D=j("#readiness-rail"),Y=T.join("\x00");if(D.dataset.keys!==Y)D.dataset.keys=Y,D.innerHTML=T.map((O)=>{let Q=k(O);return`<span
          data-ready-key="${Q.key}"
          data-phase="${Q.render?.phase??"idle"}"
          title="${w(`${Q.subject||"(no description)"} · ${B(Q.render)}`)}"
        ></span>`}).join("");let J=z.revisions[N].key;D.querySelectorAll("[data-ready-key]").forEach((O)=>{let Q=O.dataset.readyKey,$=Q?k(Q):void 0;O.dataset.phase=$?.render?.phase??"idle",O.classList.toggle("selected",Q===J)})}function TD(){vT(j("#page-a"),z.revisions[M].render,A),vT(j("#page-b"),z.revisions[G].render,C)}function vT(T,D,Y){let J=D?.phase==="ready"?D.pages.length:0;if(J===0){T.innerHTML='<option value="0">—</option>',T.disabled=!0;return}T.disabled=!1,T.innerHTML=Array.from({length:J},(O,Q)=>`<option value="${Q}" ${Q===Y?"selected":""}>${Q+1}</option>`).join("")}function CT(){let T=z.revisions[M].render,D=z.revisions[G].render;return xT(T?.phase==="ready"?T.pages:[],D?.phase==="ready"?D.pages:[])}function DD(T=CT()){if(!T.shifted)return null;return mT(T,y,y==="left"?A:C)??null}function YD(){let T=z.revisions[M].render,D=z.revisions[G].render;if(T?.phase==="ready"&&T.pages.length>0)A=a(A,T.pages.length);if(D?.phase==="ready"&&D.pages.length>0)C=a(C,D.pages.length)}function n(){let T=j("#pair-suggestion"),D=j("#pair-confidence"),Y=j("#pair-suggestion-text"),J=j("#apply-pair");if(N!==G){T.hidden=!0;return}let O=CT(),Q=DD(O),$=Q?jT(Q):null;if(Q&&!$){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent=Q.rightIndex!=null?`B ${Q.rightIndex+1} has no reliable A pair. Choose pages manually.`:`A ${(Q.leftIndex??0)+1} has no reliable B pair. Choose pages manually.`;return}if(!Q||!Q.confidence||!$||Q.leftIndex===Q.rightIndex){let X=z.revisions[M].render,L=z.revisions[G].render;if(X?.phase==="ready"&&L?.phase==="ready"&&X.pages.length!==L.pages.length&&!O.shifted){T.hidden=!1,T.dataset.confidence="unpaired",D.hidden=!0,J.hidden=!0,Y.textContent="Could not align these pages reliably. Choose A and B manually.";return}T.hidden=!0,T.removeAttribute("data-confidence");return}let F=$.pageA+1,Z=$.pageB+1,_=A===$.pageA&&C===$.pageB;T.hidden=!1,T.dataset.confidence=Q.confidence,D.hidden=!1,D.textContent=`${Q.confidence} confidence`,Y.textContent=_?`Aligned pair: A ${F} with B ${Z}.`:`Likely page shift: A ${F} matches B ${Z}.`,J.hidden=_,J.textContent=`Use A ${F} / B ${Z}`,J.setAttribute("aria-label",`Use A page ${F} and B page ${Z}`)}function YT(){let T=CT(),D=j("#page-rail");if(T.pairs.length===0){let Y=z.revisions[M].render,J=z.revisions[G].render,O=Y?.phase==="ready"?Y.pages:[],Q=J?.phase==="ready"?J.pages:[],$=Math.max(O.length,Q.length);D.innerHTML=Array.from({length:$},(F,Z)=>{let _=O[Z],X=Q[Z];if(!_||!X){let U=_?`A${Z+1}`:`B${Z+1}`;return`<span class="page-tick unpaired" aria-label="${U} has no reliable pair">${U}</span>`}let L=_.hash===X.hash?"same":"changed",V=A===Z&&C===Z;return`<button
        type="button"
        class="page-tick ${L} ${V?"active":""}"
        data-page-a="${Z}"
        data-page-b="${Z}"
        aria-pressed="${V}"
        aria-label="Use physical page ${Z+1} for A and B, ${L}"
      >${Z+1}</button>`}).join("")}else D.innerHTML=T.pairs.map((Y)=>{let J=Y.leftIndex==null?null:Y.leftIndex+1,O=Y.rightIndex==null?null:Y.rightIndex+1,Q=Y.leftIndex===A&&Y.rightIndex===C,$=J!=null&&O!=null&&J!==O,F=$?`<span>A${J}</span><span>B${O}</span>`:String(O??J??"—"),Z=CD(Y);if(Y.leftIndex==null||Y.rightIndex==null)return`<span
          class="page-tick ${Y.relation} unpaired"
          aria-label="${w(Z)}"
        >${F}</span>`;return`<button
        type="button"
        class="page-tick ${Y.relation} ${Q?"active":""} ${$?"shifted":""}"
        data-page-a="${Y.leftIndex}"
        data-page-b="${Y.rightIndex}"
        aria-pressed="${Q}"
        aria-label="${w(Z)}"
      >${F}</button>`}).join("");D.querySelectorAll(".page-tick").forEach((Y)=>{Y.addEventListener("click",()=>{let J=Y.dataset.pageA,O=Y.dataset.pageB;if(J==null||O==null)return;A=Number(J),C=Number(O),y="right",g()})})}function CD(T){let D=T.confidence?`, ${T.confidence} confidence`:"";if(T.leftIndex==null&&T.rightIndex!=null)return`B page ${T.rightIndex+1} has no reliable A pair`;if(T.rightIndex==null&&T.leftIndex!=null)return`A page ${T.leftIndex+1} has no reliable B pair`;return`Use A page ${(T.leftIndex??0)+1} and B page ${(T.rightIndex??0)+1}, ${T.relation}${D}`}function f(){let T=j("#stage"),D=z.revisions[M],Y=z.revisions[G],J=JT(D.render,A),O=JT(Y.render,C);if(HD(T),E==="heatmap"){let F=`${J??"missing"}\x00${O??"missing"}`;if(J&&O&&T.dataset.comparison!==F){T.dataset.comparison=F;let Z=j("#heatmap-label");Z.textContent="Calculating visual difference…",wD(J,O)}return}pT(T.querySelector('[data-page-slot="a"]'),D,J,"A"),pT(T.querySelector('[data-page-slot="b"]'),Y,O,"B");let Q=T.querySelector(".blink-pages");Q?.classList.toggle("show-a",m),Q?.classList.toggle("show-b",!m);let $=T.querySelector(".same-output");if($)$.hidden=!qD(Y)}function HD(T){if(T.dataset.mode===E)return;if(T.dataset.mode=E,T.dataset.comparison="",E==="single")T.innerHTML=`
      <div class="single-page">
        ${b("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(E==="side")T.innerHTML=`<div class="split-pages">${b("a")}${b("b")}</div>`;else if(E==="blink")T.innerHTML=`
      <div class="stack-pages blink-pages show-b">
        ${b("a")}
        ${b("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(E==="opacity")T.innerHTML=`
      <div class="stack-pages">
        ${b("a")}
        <div class="overlay-page mix-page">${b("b")}</div>
      </div>
    `;else if(E==="wipe")T.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${b("a")}
        <div class="overlay-page wipe">${b("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else T.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function b(T){let D=T.toUpperCase();return`
    <div class="page-slot" data-page-slot="${T}">
      <img class="document-page" alt="Revision ${D}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${D}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function pT(T,D,Y,J){if(!T)return;let O=T.querySelector("img"),Q=T.querySelector(".render-status");if(!O||!Q)return;if(Y){if(O.getAttribute("src")!==Y)O.src=Y;O.hidden=!1,Q.hidden=!0;return}O.hidden=!0,Q.hidden=!1,Q.className=`render-status ${D.render?.phase??"idle"}`;let $=Q.querySelector("strong"),F=Q.querySelector("p");if($)$.textContent=B(D.render);if(F)F.textContent=D.render?.message??(D.render?.phase?"Preparing this revision…":`Select revision ${J} to render it.`)}function ET(T){if(!Number.isFinite(T))return;P=Math.min(100,Math.max(0,Math.round(T))),$T()}function $T(){let T=document.querySelector("#mix"),D=document.querySelector("#mix-number");if(T)T.value=String(P);if(D)D.value=String(P);s(document.querySelector(".mix-page"),{opacity:P/100}),s(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-P}% 0 0)`}),s(document.querySelector(".wipe-line"),{left:`${P}%`}),s(document.querySelector(".wipe-handle"),{left:`${P}%`})}function s(T,D){if(!T)return;T.getAnimations().forEach((Y)=>Y.cancel()),T.animate([D,D],{duration:1,fill:"forwards"})}function gT(T){let D=document.querySelector(".wipe-pages");if(!D)return;let Y=D.getBoundingClientRect();ET((T.clientX-Y.left)/Y.width*100)}async function wD(T,D){let Y=++r,J,O;try{[J,O]=await Promise.all([dT(T),dT(D)])}catch(Q){if(Y===r&&E==="heatmap"){let $=document.querySelector("#heatmap-label");if($)$.textContent=`Could not calculate heatmap: ${String(Q)}`}return}if(Y!==r||E!=="heatmap"){J.close(),O.close();return}VT.onmessage=(Q)=>{let $=Q.data;if($.generation!==r||E!=="heatmap"){$.bitmap.close();return}let F=document.querySelector("#heatmap");if(!F){$.bitmap.close();return}F.width=$.width,F.height=$.height;let Z=F.getContext("bitmaprenderer");if(Z)Z.transferFromImageBitmap($.bitmap);else F.getContext("2d").drawImage($.bitmap,0,0),$.bitmap.close();let _=document.querySelector("#heatmap-label");if(_)_.textContent=`${($.changed/$.total*100).toFixed(2)}% pixels differ`},VT.postMessage({left:J,right:O,scale:1.5,generation:Y},[J,O])}function _T(T,D=!0){if(T<0||T>=z.revisions.length)return;let Y=N;N=T,y="right",LD(Y,N,D),ZT(D),GT(),n(),p(),HT(T)}async function HT(T){let D=z.revisions[T];if(!["ready","entrypoint_missing","error"].includes(D.render?.phase??""))return;if(T===G){g(),GT();return}let J=++e,O=D.render?.pages.length??0,Q=a(C,O),$=JT(D.render,Q);if($)try{await JD($)}catch{}if(J!==e||N!==T)return;G=T,C=Q,g(),GT(),OD()}function JD(T){let D=x.get(T);if(D)return x.delete(T),x.set(T,D),D;let Y=new Image;Y.decoding="async";let J=new Promise((O,Q)=>{Y.addEventListener("load",()=>{Y.decode().then(O,O)}),Y.addEventListener("error",()=>Q(Error(`Could not preload ${T}`))),Y.src=T}).catch((O)=>{throw x.delete(T),O});x.set(T,J);while(x.size>12){let O=x.keys().next().value;if(O===void 0)break;x.delete(O)}return J}function OD(){let T=wT(),D=T.indexOf(z.revisions[N].key);for(let Y of[-2,-1,1,2]){let J=T[D+Y];if(!J)continue;let O=JT(k(J).render,C);if(O)JD(O).catch(()=>{return})}}function GT(){let T=j("#stage"),D=N!==G;T.dataset.previewPending=String(D),T.setAttribute("aria-busy",String(D))}function lT(T){let D=zT(),Y=D.indexOf(z.revisions[N].key);if(Y<0)return;let J=Math.min(D.length-1,Math.max(0,Y+T));_T(I(D[J]))}function p(T=!1){let D={revisionKey:z.revisions[N].key,pinnedRevisionKey:z.revisions[M].key,historyMode:H,generation:++FD};if(hT.schedule(D),T)hT.flush()}function JT(T,D){if(T?.phase!=="ready"||!T.render_id||!T.pages[D])return null;return`${l}/assets/${T.render_id}/page/${T.pages[D].number}`}function qD(T){let D=oT.get(T.parent_ids[0]);return Boolean(D&&o(T.render,D.render))}function v(T,D){return`<button type="button" data-mode="${T}" aria-pressed="${T===E}">${D}</button>`}function wT(){return H==="first-parent"?z.history.first_parent_keys:z.history.full_tree_keys}function zT(){let T=wT();if(H==="full-tree"||!LT)return T;return T.filter((D,Y)=>{if(Y===T.length-1)return!0;return!o(k(D).render,k(T[Y+1]).render)})}function k(T){let D=OT.get(T);if(!D)throw Error(`Unknown revision: ${T}`);return D}function I(T){return aT.get(T)??-1}function qT(T){return zD.format(new Date(T))}async function dT(T){let D=await new Promise((Y,J)=>{let O=new Image;O.decoding="async",O.onload=()=>Y(O),O.onerror=()=>J(Error(`Could not load ${T}`)),O.src=T});return createImageBitmap(D)}function j(T){let D=document.querySelector(T);if(!D)throw Error(`Missing UI element: ${T}`);return D}function w(T){return T.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
