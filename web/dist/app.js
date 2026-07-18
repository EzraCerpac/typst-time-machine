function W_(_,h,f){if(_?.phase!=="ready"||h?.phase!=="ready")return"waiting";let F=_.pages[f],T=h.pages[f];if(!F&&T)return"added";if(F&&!T)return"removed";if(!F||!T)return"waiting";return F.hash===T.hash?"same":"changed"}function x(_,h){if(_?.phase!=="ready"||h?.phase!=="ready")return!1;if(_.pages.length!==h.pages.length)return!1;return _.pages.every((f,F)=>f.hash===h.pages[F]?.hash)}function b(_){return _.slice(0,8)}function q(_){switch(_?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${_.pages.length} page${_.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function w_(_,h){let f=new Map(_.map(($)=>[$.key,$])),F=new Map(_.map(($)=>[$.commit_id,$.key])),T=new Set(h.map(($)=>f.get($)?.commit_id).filter(($)=>Boolean($))),E=[],z=[];h.forEach(($,R)=>{let U=f.get($);if(!U)return;let X=E.indexOf(U.commit_id);if(X<0)X=E.length;else E.splice(X,1);z.push({key:$,row:R,lane:X}),U.parent_ids.filter((Z)=>T.has(Z)).forEach((Z,B)=>{if(E.includes(Z))return;E.splice(Math.min(X+B,E.length),0,Z)})});let Q=new Map(z.map(($)=>[$.key,$])),J=h.flatMap(($)=>{let R=f.get($);if(!R||!Q.has($))return[];return R.parent_ids.flatMap((U,X)=>{let Z=F.get(U);if(!Z||!Q.has(Z))return[];return[{child:$,parent:Z,merge:X>0}]})});return{nodes:z,edges:J,laneCount:Math.max(1,...z.map(($)=>$.lane+1))}}class f_{apply;scheduleFrame;cancelFrame;handle;latest;pending=!1;constructor(_,h=window.requestAnimationFrame.bind(window),f=window.cancelAnimationFrame.bind(window)){this.apply=_;this.scheduleFrame=h;this.cancelFrame=f}schedule(_){if(this.latest=_,this.pending=!0,this.handle!==void 0)return;this.handle=this.scheduleFrame(()=>{this.handle=void 0,this.applyPending()})}flush(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.applyPending()}cancel(){if(this.handle!==void 0)this.cancelFrame(this.handle),this.handle=void 0;this.latest=void 0,this.pending=!1}applyPending(){if(!this.pending)return;let _=this.latest;this.latest=void 0,this.pending=!1,this.apply(_)}}class T_{interval;apply;now;scheduleDelay;cancelDelay;timer;latest;lastApplied=Number.NEGATIVE_INFINITY;constructor(_,h,f=performance.now.bind(performance),F=window.setTimeout.bind(window),T=window.clearTimeout.bind(window)){this.interval=_;this.apply=h;this.now=f;this.scheduleDelay=F;this.cancelDelay=T}schedule(_){this.latest=_;let h=this.interval-(this.now()-this.lastApplied);if(h<=0&&this.timer===void 0){this.applyLatest();return}if(this.timer!==void 0)return;this.timer=this.scheduleDelay(()=>{this.timer=void 0,this.applyLatest()},Math.max(0,h))}flush(){if(this.timer!==void 0)this.cancelDelay(this.timer),this.timer=void 0;if(this.latest!==void 0)this.applyLatest()}applyLatest(){if(this.latest===void 0)return;let _=this.latest;this.latest=void 0,this.lastApplied=this.now(),this.apply(_)}}var d=location.pathname.replace(/\/$/,""),E_=new Worker(`${d}/diff-worker.js`,{type:"module"}),A=O("#app"),u_=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),g_=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),D,O_=new Map,P_=new Map,S_=new Map,o=new Map,Y=0,j=0,L=1,g=0,w=0,N="single",W="first-parent",S=50,Y_=!1,p=!1,v=0,c=!1,D_=0,a_=0,k=new Map,F_=new f_((_)=>{e(_,!1)}),C_=new T_(50,(_)=>{fetch(`${d}/api/focus`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:_.revisionKey,pinned_revision_key:_.pinnedRevisionKey,history_mode:_.historyMode,generation:_.generation})})});E_.addEventListener("error",(_)=>{let h=document.querySelector("#heatmap-label");if(h)h.textContent=`Could not calculate heatmap: ${_.message}`});d_();async function d_(){A.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let _=await fetch(`${d}/api/session`);if(!_.ok)throw Error("Could not load Typst history.");D=await _.json(),O_=new Map(D.revisions.map((h)=>[h.key,h])),P_=new Map(D.revisions.map((h,f)=>[h.key,f])),S_=new Map(D.revisions.map((h)=>[h.commit_id,h])),o=new Map(D.history.first_parent_keys.map((h,f)=>[h,f])),Y=K(D.history.first_parent_keys[0]),j=Y,L=K(D.history.first_parent_keys[1]??D.history.first_parent_keys[0]),v_(),t_(),u(!0)}function v_(){let _=D.repository.root.split("/").filter(Boolean).at(-1)??"repository";A.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${C(D.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${D.repository.kind}</span>
        <strong>${C(_)}</strong>
        <span>${D.revisions.length} revisions</span>
        <span title="${C(D.compiler)}">${C(D.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${m("single","B")}
          ${m("side","A · B")}
          ${m("blink","Blink")}
          ${m("opacity","Mix")}
          ${m("wipe","Wipe")}
          ${m("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${S}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${S}" aria-label="Comparison position percentage" />
          <span aria-hidden="true">%</span>
        </label>
        <div class="page-controls">
          <label>A <select id="page-a" aria-label="Page for revision A"></select></label>
          <label>B <select id="page-b" aria-label="Page for revision B"></select></label>
        </div>
        <button class="pin" id="pin-a" type="button">Pin B as A</button>
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
  `,l_(),K_()}function l_(){A.querySelectorAll("[data-mode]").forEach((h)=>{h.addEventListener("click",()=>{N=h.dataset.mode,P(),k_(),s()})}),O("#mix").addEventListener("input",(h)=>{z_(Number(h.target.value))}),O("#mix-number").addEventListener("input",(h)=>{z_(Number(h.target.value))}),O("#pin-a").addEventListener("click",()=>{j=Y,w=Math.min(w,(D.revisions[j].render?.pages.length??1)-1);let h=L;L=Y,g=w,o_(h,L),a(),u(!0)}),O("#collapse").addEventListener("change",(h)=>{Y_=h.target.checked,G_(),i()}),A.querySelectorAll("[data-history-mode]").forEach((h)=>{h.addEventListener("click",()=>{W=h.dataset.historyMode;let f=J_();if(!f.includes(D.revisions[Y].key))Y=K(f[0]),w=0;F_.cancel(),D_+=1,j=Y,K_(),u(!0)})}),O("#revision-slider").addEventListener("input",(h)=>{let F=[...__()].reverse()[Number(h.target.value)];if(F)F_.schedule(K(F))}),O("#revision-slider").addEventListener("change",(h)=>{F_.flush(),u(!0)}),O("#page-a").addEventListener("change",(h)=>{g=Number(h.target.value),P(),r()}),O("#page-b").addEventListener("change",(h)=>{w=Number(h.target.value),P(),r()});let _=O("#stage");_.addEventListener("pointerdown",(h)=>{if(N==="blink")p=!0,P();else if(N==="wipe"&&h.button===0)c=!0,_.setPointerCapture(h.pointerId),I_(h)}),_.addEventListener("pointermove",(h)=>{if(c)I_(h)}),_.addEventListener("pointerup",(h)=>{if(c)c=!1,_.releasePointerCapture(h.pointerId)}),window.addEventListener("pointerup",()=>{if(p)p=!1,P();c=!1}),window.addEventListener("keydown",(h)=>{if(h.target instanceof HTMLInputElement||h.target instanceof HTMLSelectElement)return;if(h.key==="ArrowLeft")q_(1);else if(h.key==="ArrowRight")q_(-1);else if(h.code==="Space"&&N==="blink"&&!h.repeat)h.preventDefault(),p=!0,P()}),window.addEventListener("keyup",(h)=>{if(h.code==="Space"&&p)p=!1,P()})}function t_(){let _=new EventSource(`${d}/api/events`);_.addEventListener("render",(h)=>{let f=JSON.parse(h.data),F=O_.get(f.status.revision_key);if(!F)return;if(F.render=f.status,n_(F),f.status.phase==="ready")y_()}),_.onerror=()=>{document.body.dataset.connection="lost"}}function K_(){p_(),b_(),G_(),i(),r(),P(),s(),k_(),r_()}function k_(){A.querySelectorAll("[data-mode]").forEach((f)=>{f.setAttribute("aria-pressed",String(f.dataset.mode===N))});let _=O(".mix-control"),h=N==="opacity"||N==="wipe";_.dataset.visible=String(h),_.hidden=!h,O("#mix-label").textContent=N==="opacity"?"Blend":"Wipe"}function r_(){A.querySelectorAll("[data-history-mode]").forEach((h)=>{h.setAttribute("aria-pressed",String(h.dataset.historyMode===W))});let _=O("#collapse");_.disabled=W==="full-tree",O("#history-title").textContent=W==="first-parent"?"First-parent history":"Full revision tree",O("#history-description").textContent=W==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function n_(_){A_(_);let h=o.get(_.key);if(h!=null&&h>0)A_(M(D.history.first_parent_keys[h-1]));if(Y_&&W==="first-parent"&&_.render?.phase==="ready")G_(),i();let f=D.revisions[j],F=K(_.key),T=["ready","entrypoint_missing","error"].includes(_.render?.phase??"");if(F===Y&&T){m_(F);return}if((F===j||F===L||f.parent_ids[0]===_.commit_id)&&T)a()}function A_(_){A.querySelectorAll(`[data-revision-key="${_.key}"]`).forEach((h)=>{if(h.dataset.phase=_.render?.phase??"idle",h.classList.contains("frame")){let F=o.get(_.key),T=F==null?void 0:D.history.first_parent_keys[F+1],E=x(_.render,T?M(T).render:void 0),z=h.querySelector(".frame-meta");if(z)z.textContent=`${b(_.commit_id)} · ${E?"same output":q(_.render)}`}let f=h.querySelector(".tree-meta");if(f)f.textContent=`${b(_.commit_id)} · ${q(_.render)}`}),A.querySelectorAll(`[data-ready-key="${_.key}"]`).forEach((h)=>{h.dataset.phase=_.render?.phase??"idle",h.title=`${_.subject||"(no description)"} · ${q(_.render)}`})}function a(){p_(),b_(),r(),P(),s()}function o_(_,h){t(_,"pinned",!1),t(h,"pinned",!0)}function i_(_,h,f){if(t(_,"selected",!1),t(h,"selected",!0),A.querySelectorAll(`[data-index="${_}"]`).forEach((T)=>{T.setAttribute("aria-selected","false")}),A.querySelectorAll(`[data-index="${h}"]`).forEach((T)=>{T.setAttribute("aria-selected","true")}),!f)return;let F=A.querySelector(`[data-index="${h}"]`);if(F&&W==="full-tree"){let T=O("#tree");T.scrollTop=Math.max(0,F.offsetTop-T.clientHeight/2+F.clientHeight/2)}else if(F){let T=O("#film");T.scrollLeft=Math.max(0,F.offsetLeft-T.clientWidth/2+F.clientWidth/2)}}function t(_,h,f){A.querySelectorAll(`[data-index="${_}"]`).forEach((F)=>{F.classList.toggle(h,f)})}function p_(){U_(O("#revision-a"),D.revisions[L],"A",L===j),U_(O("#revision-b"),D.revisions[j],"B",!1)}function U_(_,h,f,F){let T=u_.format(new Date(h.committed_at));_.innerHTML=`
    <div class="revision-letter">${f}</div>
    <p class="revision-date">${T}</p>
    <h2>${C(h.subject||"(no description)")}</h2>
    <p class="revision-author">${C(h.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${h.commit_id}">${b(h.commit_id)}</dd></div>
      ${h.change_id?`<div><dt>Change</dt><dd title="${h.change_id}">${b(h.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${q(h.render)}</dd></div>
    </dl>
    ${h.bookmarks.map((E)=>`<span class="bookmark">${C(E)}</span>`).join("")}
    ${F?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function G_(){let _=O("#film"),h=O("#tree");if(_.hidden=W!=="first-parent",h.hidden=W!=="full-tree",W==="full-tree"){s_(h);return}let f=_.scrollLeft,F=D.revisions[Y].key,T=_.dataset.selectedKey!==F,z=__().map((J)=>({revision:M(J),index:K(J)})).reverse();_.innerHTML=z.map(({revision:J,index:$})=>{let R=J.render?.phase??"idle",U=o.get(J.key)??-1,X=D.history.first_parent_keys[U+1],Z=X?M(X):void 0,B=x(J.render,Z?.render);return`
        <button
          class="frame ${$===Y?"selected":""} ${$===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${$===Y}"
          data-index="${$}"
          data-revision-key="${J.key}"
          data-phase="${R}"
          title="${C(J.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${N_(J.committed_at)}</time>
          <strong>${C(J.subject||"(no description)")}</strong>
          <span class="frame-meta">${b(J.commit_id)} · ${B?"same output":q(J.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),_.querySelectorAll(".frame").forEach((J)=>{J.addEventListener("click",()=>e(Number(J.dataset.index)))});let Q=_.querySelector(".selected");if(_.dataset.selectedKey=F,Q&&T)_.scrollLeft=Math.max(0,Q.offsetLeft-_.clientWidth/2+Q.clientWidth/2);else _.scrollLeft=f}function s_(_){let h=D.history.full_tree_keys,f=w_(D.revisions,h),F=new Map(f.nodes.map((G)=>[G.key,G])),T=_.scrollTop,E=D.revisions[Y].key,z=_.dataset.selectedKey!==E,Q=58,J=8,$=Math.min(8,f.laneCount),R=34+$*18,U=(G)=>f.laneCount<2?18:16+G/(f.laneCount-1)*(R-32),X=h.length*58+16,Z=new Map(f.nodes.map((G)=>[G.key,G.row])),B=f.edges.map((G)=>{let V=F.get(G.child),I=F.get(G.parent);if(!V||!I)return"";let y=Z.get(G.child),Q_=Z.get(G.parent);if(y==null||Q_==null)return"";let Z_=U(V.lane),j_=8+y*58+29,L_=U(I.lane),X_=8+Q_*58+29,V_=(j_+X_)/2;return`<path class="${G.merge?"merge-edge":""}" d="M ${Z_} ${j_} C ${Z_} ${V_}, ${L_} ${V_}, ${L_} ${X_}" />`}).join(""),x_=f.nodes.map((G)=>{let V=Z.get(G.key);if(V==null)return"";let I=K(G.key);return`<circle class="${[I===Y?"selected":"",I===L?"pinned":""].filter(Boolean).join(" ")}" cx="${U(G.lane)}" cy="${8+V*58+29}" r="5" />`}).join(""),c_=f.nodes.map((G)=>{let V=M(G.key),I=K(G.key),y=V.render?.phase??"idle";return`
        <button
          class="tree-node ${I===Y?"selected":""} ${I===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${I===Y}"
          data-index="${I}"
          data-revision-key="${V.key}"
          data-phase="${y}"
          title="${C(V.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${C(V.subject||"(no description)")}</strong>
            <time>${N_(V.committed_at)}</time>
          </span>
          <span class="tree-meta">${b(V.commit_id)} · ${q(V.render)}</span>
        </button>
      `}).join("");_.innerHTML=`
    <div class="tree-canvas" data-lanes="${$}">
      <svg aria-hidden="true" viewBox="0 0 ${R} ${X}" width="${R}" height="${X}">${B}${x_}</svg>
      ${c_}
    </div>
  `,_.querySelectorAll(".tree-node").forEach((G)=>{G.addEventListener("click",()=>e(Number(G.dataset.index)))});let h_=_.querySelector(".tree-node.selected");if(_.dataset.selectedKey=E,h_&&z)_.scrollTop=Math.max(0,h_.offsetTop-_.clientHeight/2+h_.clientHeight/2);else _.scrollTop=T}function i(_=!0){let h=[...__()].reverse(),f=O("#revision-slider"),F=D.revisions[Y].key,T=Math.max(0,h.indexOf(F));if(f.max=String(Math.max(0,h.length-1)),_)f.value=String(T);let E=h[T]?M(h[T]):void 0;O("#revision-position").textContent=E?`${T+1} / ${h.length} · ${N_(E.committed_at)} · ${E.subject||"(no description)"}`:"No revision",e_(h)}function e_(_){let h=O("#readiness-rail"),f=_.join("\x00");if(h.dataset.keys!==f)h.dataset.keys=f,h.innerHTML=_.map((T)=>{let E=M(T);return`<span
          data-ready-key="${E.key}"
          data-phase="${E.render?.phase??"idle"}"
          title="${C(`${E.subject||"(no description)"} · ${q(E.render)}`)}"
        ></span>`}).join("");let F=D.revisions[Y].key;h.querySelectorAll("[data-ready-key]").forEach((T)=>{let E=T.dataset.readyKey,z=E?M(E):void 0;T.dataset.phase=z?.render?.phase??"idle",T.classList.toggle("selected",E===F)})}function b_(){M_(O("#page-a"),D.revisions[L].render,g),M_(O("#page-b"),D.revisions[j].render,w)}function M_(_,h,f){let F=h?.phase==="ready"?h.pages.length:0;if(F===0){_.innerHTML='<option value="0">—</option>',_.disabled=!0;return}_.disabled=!1,_.innerHTML=Array.from({length:F},(T,E)=>`<option value="${E}" ${E===f?"selected":""}>${E+1}</option>`).join("")}function r(){let _=D.revisions[L].render,h=D.revisions[j].render,f=Math.max(_?.pages.length??0,h?.pages.length??0),F=O("#page-rail");F.innerHTML=Array.from({length:f},(T,E)=>{let z=W_(_,h,E);return`<button class="page-tick ${z} ${E===w?"active":""}" data-page="${E}" title="Page ${E+1}: ${z}">${E+1}</button>`}).join(""),F.querySelectorAll(".page-tick").forEach((T)=>{T.addEventListener("click",()=>{g=Math.min(Number(T.dataset.page),Math.max(0,(_?.pages.length??1)-1)),w=Math.min(Number(T.dataset.page),Math.max(0,(h?.pages.length??1)-1)),a()})})}function P(){let _=O("#stage"),h=D.revisions[L],f=D.revisions[j],F=n(h.render,g),T=n(f.render,w);if(_h(_),N==="heatmap"){let z=`${F??"missing"}\x00${T??"missing"}`;if(F&&T&&_.dataset.comparison!==z){_.dataset.comparison=z;let Q=O("#heatmap-label");Q.textContent="Calculating visual difference…",hh(F,T)}return}R_(_.querySelector('[data-page-slot="a"]'),h,F,"A"),R_(_.querySelector('[data-page-slot="b"]'),f,T,"B"),_.querySelector(".stack-pages")?.classList.toggle("show-a",p),_.querySelector(".stack-pages")?.classList.toggle("show-b",!p);let E=_.querySelector(".same-output");if(E)E.hidden=!fh(f)}function _h(_){if(_.dataset.mode===N)return;if(_.dataset.mode=N,_.dataset.comparison="",N==="single")_.innerHTML=`
      <div class="single-page">
        ${H("b")}
        <span class="same-output" hidden>Same rendered output as first parent</span>
      </div>
    `;else if(N==="side")_.innerHTML=`<div class="split-pages">${H("a")}${H("b")}</div>`;else if(N==="blink")_.innerHTML=`
      <div class="stack-pages show-b">
        ${H("a")}
        ${H("b")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(N==="opacity")_.innerHTML=`
      <div class="stack-pages">
        ${H("a")}
        <div class="overlay-page mix-page">${H("b")}</div>
      </div>
    `;else if(N==="wipe")_.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${H("a")}
        <div class="overlay-page wipe">${H("b")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else _.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Waiting for both revisions…</p></div>'}function H(_){let h=_.toUpperCase();return`
    <div class="page-slot" data-page-slot="${_}">
      <img class="document-page" alt="Revision ${h}" draggable="false" decoding="async" hidden />
      <div class="render-status idle">
        <span class="status-letter">${h}</span>
        <strong>Not rendered</strong>
        <p>Select this revision to render it.</p>
      </div>
    </div>
  `}function R_(_,h,f,F){if(!_)return;let T=_.querySelector("img"),E=_.querySelector(".render-status");if(!T||!E)return;if(f){if(T.getAttribute("src")!==f)T.src=f;T.hidden=!1,E.hidden=!0;return}T.hidden=!0,E.hidden=!1,E.className=`render-status ${h.render?.phase??"idle"}`;let z=E.querySelector("strong"),Q=E.querySelector("p");if(z)z.textContent=q(h.render);if(Q)Q.textContent=h.render?.message??(h.render?.phase?"Preparing this revision…":`Select revision ${F} to render it.`)}function z_(_){if(!Number.isFinite(_))return;S=Math.min(100,Math.max(0,Math.round(_))),s()}function s(){let _=document.querySelector("#mix"),h=document.querySelector("#mix-number");if(_)_.value=String(S);if(h)h.value=String(S);l(document.querySelector(".mix-page"),{opacity:S/100}),l(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-S}% 0 0)`}),l(document.querySelector(".wipe-line"),{left:`${S}%`}),l(document.querySelector(".wipe-handle"),{left:`${S}%`})}function l(_,h){if(!_)return;_.getAnimations().forEach((f)=>f.cancel()),_.animate([h,h],{duration:1,fill:"forwards"})}function I_(_){let h=document.querySelector(".wipe-pages");if(!h)return;let f=h.getBoundingClientRect();z_((_.clientX-f.left)/f.width*100)}async function hh(_,h){let f=++v,F,T;try{[F,T]=await Promise.all([H_(_),H_(h)])}catch(E){if(f===v&&N==="heatmap"){let z=document.querySelector("#heatmap-label");if(z)z.textContent=`Could not calculate heatmap: ${String(E)}`}return}if(f!==v||N!=="heatmap"){F.close(),T.close();return}E_.onmessage=(E)=>{let z=E.data;if(z.generation!==v||N!=="heatmap"){z.bitmap.close();return}let Q=document.querySelector("#heatmap");if(!Q){z.bitmap.close();return}Q.width=z.width,Q.height=z.height;let J=Q.getContext("bitmaprenderer");if(J)J.transferFromImageBitmap(z.bitmap);else Q.getContext("2d").drawImage(z.bitmap,0,0),z.bitmap.close();let $=document.querySelector("#heatmap-label");if($)$.textContent=`${(z.changed/z.total*100).toFixed(2)}% pixels differ`},E_.postMessage({left:F,right:T,scale:1.5,generation:f},[F,T])}function e(_,h=!0){if(_<0||_>=D.revisions.length)return;let f=Y;Y=_,i_(f,Y,h),i(h),$_(),u(),m_(_)}async function m_(_){let h=D.revisions[_];if(!["ready","entrypoint_missing","error"].includes(h.render?.phase??""))return;if(_===j){a(),$_();return}let F=++D_,T=h.render?.pages.length??1,E=Math.min(w,T-1),z=n(h.render,E);if(z)try{await B_(z)}catch{}if(F!==D_||Y!==_)return;j=_,w=E,a(),$_(),y_()}function B_(_){let h=k.get(_);if(h)return k.delete(_),k.set(_,h),h;let f=new Image;f.decoding="async";let F=new Promise((T,E)=>{f.addEventListener("load",()=>{f.decode().then(T,T)}),f.addEventListener("error",()=>E(Error(`Could not preload ${_}`))),f.src=_}).catch((T)=>{throw k.delete(_),T});k.set(_,F);while(k.size>12){let T=k.keys().next().value;if(T===void 0)break;k.delete(T)}return F}function y_(){let _=J_(),h=_.indexOf(D.revisions[Y].key);for(let f of[-2,-1,1,2]){let F=_[h+f];if(!F)continue;let T=n(M(F).render,w);if(T)B_(T).catch(()=>{return})}}function $_(){let _=O("#stage"),h=Y!==j;_.dataset.previewPending=String(h),_.setAttribute("aria-busy",String(h))}function q_(_){let h=__(),f=h.indexOf(D.revisions[Y].key);if(f<0)return;let F=Math.min(h.length-1,Math.max(0,f+_));e(K(h[F]))}function u(_=!1){let h={revisionKey:D.revisions[Y].key,pinnedRevisionKey:D.revisions[L].key,historyMode:W,generation:++a_};if(C_.schedule(h),_)C_.flush()}function n(_,h){if(_?.phase!=="ready"||!_.render_id||!_.pages[h])return null;return`${d}/assets/${_.render_id}/page/${_.pages[h].number}`}function fh(_){let h=S_.get(_.parent_ids[0]);return Boolean(h&&x(_.render,h.render))}function m(_,h){return`<button type="button" data-mode="${_}" aria-pressed="${_===N}">${h}</button>`}function J_(){return W==="first-parent"?D.history.first_parent_keys:D.history.full_tree_keys}function __(){let _=J_();if(W==="full-tree"||!Y_)return _;return _.filter((h,f)=>{if(f===_.length-1)return!0;return!x(M(h).render,M(_[f+1]).render)})}function M(_){let h=O_.get(_);if(!h)throw Error(`Unknown revision: ${_}`);return h}function K(_){return P_.get(_)??-1}function N_(_){return g_.format(new Date(_))}async function H_(_){let h=await new Promise((f,F)=>{let T=new Image;T.decoding="async",T.onload=()=>f(T),T.onerror=()=>F(Error(`Could not load ${_}`)),T.src=_});return createImageBitmap(h)}function O(_){let h=document.querySelector(_);if(!h)throw Error(`Missing UI element: ${_}`);return h}function C(_){return _.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
