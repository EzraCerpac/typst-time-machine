function fe(e,t,n){if(e?.phase!=="ready"||t?.phase!=="ready")return"waiting";let i=e.pages[n],s=t.pages[n];if(!i&&s)return"added";if(i&&!s)return"removed";if(!i||!s)return"waiting";return i.hash===s.hash?"same":"changed"}function N(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((n,i)=>n.hash===t.pages[i]?.hash)}function C(e){return e.slice(0,8)}function B(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${e.pages.length} page${e.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function ye(e,t){let n=new Map(e.map((a)=>[a.key,a])),i=new Map(e.map((a)=>[a.commit_id,a.key])),s=new Set(t.map((a)=>n.get(a)?.commit_id).filter((a)=>Boolean(a))),o=[],l=[];t.forEach((a,T)=>{let L=n.get(a);if(!L)return;let y=o.indexOf(L.commit_id);if(y<0)y=o.length;else o.splice(y,1);l.push({key:a,row:T,lane:y}),L.parent_ids.filter((g)=>s.has(g)).forEach((g,I)=>{if(o.includes(g))return;o.splice(Math.min(y+I,o.length),0,g)})});let f=new Map(l.map((a)=>[a.key,a])),u=t.flatMap((a)=>{let T=n.get(a);if(!T||!f.has(a))return[];return T.parent_ids.flatMap((L,y)=>{let g=i.get(L);if(!g||!f.has(g))return[];return[{child:a,parent:g,merge:y>0}]})});return{nodes:l,edges:u,laneCount:Math.max(1,...l.map((a)=>a.lane+1))}}var D=location.pathname.replace(/\/$/,""),ne=new Worker(`${D}/diff-worker.js`,{type:"module"}),E=d("#app"),qe=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}),Ie=new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}),r,re=new Map,ke=new Map,Se=new Map,J=new Map,p=0,$=0,h=1,K=0,w=0,m="single",b="first-parent",_=50,ae=!1,A=!1,G=0,j=!1,ve,F;ne.addEventListener("error",(e)=>{let t=document.querySelector("#heatmap-label");if(t)t.textContent=`Could not calculate heatmap: ${e.message}`});Pe();async function Pe(){E.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${D}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");r=await e.json(),re=new Map(r.revisions.map((t)=>[t.key,t])),ke=new Map(r.revisions.map((t,n)=>[t.key,n])),Se=new Map(r.revisions.map((t)=>[t.commit_id,t])),J=new Map(r.history.first_parent_keys.map((t,n)=>[t,n])),p=k(r.history.first_parent_keys[0]),$=p,h=k(r.history.first_parent_keys[1]??r.history.first_parent_keys[0]),Ne(),Ke(),z(!0)}function Ne(){let e=r.repository.root.split("/").filter(Boolean).at(-1)??"repository";E.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${M(r.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${r.repository.kind}</span>
        <strong>${M(e)}</strong>
        <span>${r.revisions.length} revisions</span>
        <span title="${M(r.compiler)}">${M(r.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${q("single","B")}
          ${q("side","A · B")}
          ${q("blink","Blink")}
          ${q("opacity","Mix")}
          ${q("wipe","Wipe")}
          ${q("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${_}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${_}" aria-label="Comparison position percentage" />
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
        <input id="revision-slider" type="range" min="0" max="0" value="0" />
        <output id="revision-position"></output>
      </div>
      <div class="film" id="film" role="listbox" aria-label="Document revisions"></div>
      <div class="tree" id="tree" role="listbox" aria-label="Full revision tree" hidden></div>
    </footer>
  `,je(),xe()}function je(){E.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{m=t.dataset.mode,x(),_e(),X()})}),d("#mix").addEventListener("input",(t)=>{ie(Number(t.target.value))}),d("#mix-number").addEventListener("input",(t)=>{ie(Number(t.target.value))}),d("#pin-a").addEventListener("click",()=>{window.clearTimeout(F),$=p,w=Math.min(w,(r.revisions[$].render?.pages.length??1)-1);let t=h;h=p,K=w,De(t,h),W(),z(!0)}),d("#collapse").addEventListener("change",(t)=>{ae=t.target.checked,oe(),V()}),E.querySelectorAll("[data-history-mode]").forEach((t)=>{t.addEventListener("click",()=>{b=t.dataset.historyMode;let n=le();if(!n.includes(r.revisions[p].key))p=k(n[0]),w=0;window.clearTimeout(F),$=p,xe(),z()})}),d("#revision-slider").addEventListener("input",(t)=>{let i=[...Z()].reverse()[Number(t.target.value)];if(i)Q(k(i),!0)}),d("#page-a").addEventListener("change",(t)=>{K=Number(t.target.value),x(),U()}),d("#page-b").addEventListener("change",(t)=>{w=Number(t.target.value),x(),U()});let e=d("#stage");e.addEventListener("pointerdown",(t)=>{if(m==="blink")A=!0,x();else if(m==="wipe"&&t.button===0)j=!0,e.setPointerCapture(t.pointerId),Le(t)}),e.addEventListener("pointermove",(t)=>{if(j)Le(t)}),e.addEventListener("pointerup",(t)=>{if(j)j=!1,e.releasePointerCapture(t.pointerId)}),window.addEventListener("pointerup",()=>{if(A)A=!1,x();j=!1}),window.addEventListener("keydown",(t)=>{if(t.key==="ArrowLeft")Ee(1);else if(t.key==="ArrowRight")Ee(-1);else if(t.code==="Space"&&m==="blink"&&!t.repeat)t.preventDefault(),A=!0,x()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&A)A=!1,x()})}function Ke(){let e=new EventSource(`${D}/api/events`);e.addEventListener("render",(t)=>{let n=JSON.parse(t.data),i=re.get(n.status.revision_key);if(!i)return;if(i.render=n.status,We(i),n.status.phase==="ready")ze()}),e.onerror=()=>{document.body.dataset.connection="lost"}}function xe(){Re(),Ce(),oe(),V(),U(),x(),X(),_e(),Fe()}function _e(){E.querySelectorAll("[data-mode]").forEach((n)=>{n.setAttribute("aria-pressed",String(n.dataset.mode===m))});let e=d(".mix-control"),t=m==="opacity"||m==="wipe";e.dataset.visible=String(t),e.hidden=!t,d("#mix-label").textContent=m==="opacity"?"Blend":"Wipe"}function Fe(){E.querySelectorAll("[data-history-mode]").forEach((t)=>{t.setAttribute("aria-pressed",String(t.dataset.historyMode===b))});let e=d("#collapse");e.disabled=b==="full-tree",d("#history-title").textContent=b==="first-parent"?"First-parent history":"Full revision tree",d("#history-description").textContent=b==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function We(e){be(e);let t=J.get(e.key);if(t!=null&&t>0)be(R(r.history.first_parent_keys[t-1]));if(ae&&b==="first-parent"&&e.render?.phase==="ready")oe(),V();let n=r.revisions[$];if(k(e.key)===$||k(e.key)===h||n.parent_ids[0]===e.commit_id)W()}function be(e){E.querySelectorAll(`[data-revision-key="${e.key}"]`).forEach((t)=>{if(t.dataset.phase=e.render?.phase??"idle",t.classList.contains("frame")){let i=J.get(e.key),s=i==null?void 0:r.history.first_parent_keys[i+1],o=N(e.render,s?R(s).render:void 0),l=t.querySelector(".frame-meta");if(l)l.textContent=`${C(e.commit_id)} · ${o?"same output":B(e.render)}`}let n=t.querySelector(".tree-meta");if(n)n.textContent=`${C(e.commit_id)} · ${B(e.render)}`})}function W(){Re(),Ce(),U(),x(),X()}function De(e,t){Y(e,"pinned",!1),Y(t,"pinned",!0)}function Ge(e,t){Y(e,"selected",!1),Y(t,"selected",!0),E.querySelectorAll(`[data-index="${e}"]`).forEach((i)=>{i.setAttribute("aria-selected","false")}),E.querySelectorAll(`[data-index="${t}"]`).forEach((i)=>{i.setAttribute("aria-selected","true")});let n=E.querySelector(`[data-index="${t}"]`);if(n&&b==="full-tree"){let i=d("#tree");i.scrollTop=Math.max(0,n.offsetTop-i.clientHeight/2+n.clientHeight/2)}else if(n){let i=d("#film");i.scrollLeft=Math.max(0,n.offsetLeft-i.clientWidth/2+n.clientWidth/2)}}function Y(e,t,n){E.querySelectorAll(`[data-index="${e}"]`).forEach((i)=>{i.classList.toggle(t,n)})}function Re(){Me(d("#revision-a"),r.revisions[h],"A",h===$),Me(d("#revision-b"),r.revisions[$],"B",!1)}function Me(e,t,n,i){let s=qe.format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${n}</div>
    <p class="revision-date">${s}</p>
    <h2>${M(t.subject||"(no description)")}</h2>
    <p class="revision-author">${M(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${C(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${C(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${B(t.render)}</dd></div>
    </dl>
    ${t.bookmarks.map((o)=>`<span class="bookmark">${M(o)}</span>`).join("")}
    ${i?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function oe(){let e=d("#film"),t=d("#tree");if(e.hidden=b!=="first-parent",t.hidden=b!=="full-tree",b==="full-tree"){Oe(t);return}let n=e.scrollLeft,i=r.revisions[p].key,s=e.dataset.selectedKey!==i,l=Z().map((u)=>({revision:R(u),index:k(u)})).reverse();e.innerHTML=l.map(({revision:u,index:a})=>{let T=u.render?.phase??"idle",L=J.get(u.key)??-1,y=r.history.first_parent_keys[L+1],g=y?R(y):void 0,I=N(u.render,g?.render);return`
        <button
          class="frame ${a===p?"selected":""} ${a===h?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${a===p}"
          data-index="${a}"
          data-revision-key="${u.key}"
          data-phase="${T}"
          title="${M(u.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${de(u.committed_at)}</time>
          <strong>${M(u.subject||"(no description)")}</strong>
          <span class="frame-meta">${C(u.commit_id)} · ${I?"same output":B(u.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((u)=>{u.addEventListener("click",()=>Q(Number(u.dataset.index)))});let f=e.querySelector(".selected");if(e.dataset.selectedKey=i,f&&s)e.scrollLeft=Math.max(0,f.offsetLeft-e.clientWidth/2+f.clientWidth/2);else e.scrollLeft=n}function Oe(e){let t=r.history.full_tree_keys,n=ye(r.revisions,t),i=new Map(n.nodes.map((c)=>[c.key,c])),s=e.scrollTop,o=r.revisions[p].key,l=e.dataset.selectedKey!==o,f=58,u=8,a=Math.min(8,n.laneCount),T=34+a*18,L=(c)=>n.laneCount<2?18:16+c/(n.laneCount-1)*(T-32),y=t.length*58+16,g=new Map(n.nodes.map((c)=>[c.key,c.row])),I=n.edges.map((c)=>{let v=i.get(c.child),H=i.get(c.parent);if(!v||!H)return"";let P=g.get(c.child),ce=g.get(c.parent);if(P==null||ce==null)return"";let pe=L(v.lane),ue=8+P*58+29,me=L(H.lane),ge=8+ce*58+29,he=(ue+ge)/2;return`<path class="${c.merge?"merge-edge":""}" d="M ${pe} ${ue} C ${pe} ${he}, ${me} ${he}, ${me} ${ge}" />`}).join(""),Be=n.nodes.map((c)=>{let v=g.get(c.key);if(v==null)return"";let H=k(c.key);return`<circle class="${[H===p?"selected":"",H===h?"pinned":""].filter(Boolean).join(" ")}" cx="${L(c.lane)}" cy="${8+v*58+29}" r="5" />`}).join(""),Ae=n.nodes.map((c)=>{let v=R(c.key),H=k(c.key),P=v.render?.phase??"idle";return`
        <button
          class="tree-node ${H===p?"selected":""} ${H===h?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${H===p}"
          data-index="${H}"
          data-revision-key="${v.key}"
          data-phase="${P}"
          title="${M(v.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${M(v.subject||"(no description)")}</strong>
            <time>${de(v.committed_at)}</time>
          </span>
          <span class="tree-meta">${C(v.commit_id)} · ${B(v.render)}</span>
        </button>
      `}).join("");e.innerHTML=`
    <div class="tree-canvas" data-lanes="${a}">
      <svg aria-hidden="true" viewBox="0 0 ${T} ${y}" width="${T}" height="${y}">${I}${Be}</svg>
      ${Ae}
    </div>
  `,e.querySelectorAll(".tree-node").forEach((c)=>{c.addEventListener("click",()=>Q(Number(c.dataset.index)))});let ee=e.querySelector(".tree-node.selected");if(e.dataset.selectedKey=o,ee&&l)e.scrollTop=Math.max(0,ee.offsetTop-e.clientHeight/2+ee.clientHeight/2);else e.scrollTop=s}function V(){let e=[...Z()].reverse(),t=d("#revision-slider"),n=r.revisions[p].key,i=Math.max(0,e.indexOf(n));t.max=String(Math.max(0,e.length-1)),t.value=String(i);let s=e[i]?R(e[i]):void 0;d("#revision-position").textContent=s?`${i+1} / ${e.length} · ${de(s.committed_at)} · ${s.subject||"(no description)"}`:"No revision"}function Ce(){$e(d("#page-a"),r.revisions[h].render,K),$e(d("#page-b"),r.revisions[$].render,w)}function $e(e,t,n){let i=t?.phase==="ready"?t.pages.length:0;if(i===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:i},(s,o)=>`<option value="${o}" ${o===n?"selected":""}>${o+1}</option>`).join("")}function U(){let e=r.revisions[h].render,t=r.revisions[$].render,n=Math.max(e?.pages.length??0,t?.pages.length??0),i=d("#page-rail");i.innerHTML=Array.from({length:n},(s,o)=>{let l=fe(e,t,o);return`<button class="page-tick ${l} ${o===w?"active":""}" data-page="${o}" title="Page ${o+1}: ${l}">${o+1}</button>`}).join(""),i.querySelectorAll(".page-tick").forEach((s)=>{s.addEventListener("click",()=>{K=Math.min(Number(s.dataset.page),Math.max(0,(e?.pages.length??1)-1)),w=Math.min(Number(s.dataset.page),Math.max(0,(t?.pages.length??1)-1)),W()})})}function x(){let e=d("#stage"),t=r.revisions[h],n=r.revisions[$],i=Te(t.render,K),s=Te(n.render,w);if(m==="single"){let o=Je(n);e.innerHTML=`
      <div class="single-page">
        ${te(n,s,"B")}
        ${o?'<span class="same-output">Same rendered output as first parent</span>':""}
      </div>
    `;return}if(!i||!s){e.innerHTML=`
      <div class="split-pages">
        ${te(t,i,"A")}
        ${te(n,s,"B")}
      </div>
    `;return}if(m==="side")e.innerHTML=`<div class="split-pages">${S(i,"Revision A")}${S(s,"Revision B")}</div>`;else if(m==="blink")e.innerHTML=`
      <div class="stack-pages ${A?"show-a":"show-b"}">
        ${S(i,"Revision A")}
        ${S(s,"Revision B")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(m==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${S(i,"Revision A")}
        <div class="overlay-page mix-page">${S(s,"Revision B")}</div>
      </div>
    `;else if(m==="wipe")e.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${S(i,"Revision A")}
        <div class="overlay-page wipe">${S(s,"Revision B")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Calculating visual difference…</p></div>',Ye(i,s)}function ie(e){if(!Number.isFinite(e))return;_=Math.min(100,Math.max(0,Math.round(e))),X()}function X(){let e=document.querySelector("#mix"),t=document.querySelector("#mix-number");if(e)e.value=String(_);if(t)t.value=String(_);O(document.querySelector(".mix-page"),{opacity:_/100}),O(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-_}% 0 0)`}),O(document.querySelector(".wipe-line"),{left:`${_}%`}),O(document.querySelector(".wipe-handle"),{left:`${_}%`})}function O(e,t){if(!e)return;e.getAnimations().forEach((n)=>n.cancel()),e.animate([t,t],{duration:1,fill:"forwards"})}function Le(e){let t=document.querySelector(".wipe-pages");if(!t)return;let n=t.getBoundingClientRect();ie((e.clientX-n.left)/n.width*100)}async function Ye(e,t){let n=++G,i,s;try{[i,s]=await Promise.all([He(e),He(t)])}catch(o){if(n===G&&m==="heatmap"){let l=document.querySelector("#heatmap-label");if(l)l.textContent=`Could not calculate heatmap: ${String(o)}`}return}if(n!==G||m!=="heatmap"){i.close(),s.close();return}ne.onmessage=(o)=>{let l=o.data;if(l.generation!==G||m!=="heatmap"){l.bitmap.close();return}let f=document.querySelector("#heatmap");if(!f){l.bitmap.close();return}f.width=l.width,f.height=l.height;let u=f.getContext("bitmaprenderer");if(u)u.transferFromImageBitmap(l.bitmap);else f.getContext("2d").drawImage(l.bitmap,0,0),l.bitmap.close();let a=document.querySelector("#heatmap-label");if(a)a.textContent=`${(l.changed/l.total*100).toFixed(2)}% pixels differ`},ne.postMessage({left:i,right:s,scale:1.5,generation:n},[i,s])}function Q(e,t=!1){if(e<0||e>=r.revisions.length)return;let n=p;if(p=e,Ge(n,p),V(),z(),t)window.clearTimeout(F),F=window.setTimeout(()=>{if(p===e)we(e,!0)},90);else we(e,!1)}function we(e,t){window.clearTimeout(F),$=e;let n=r.revisions[e].render?.pages.length??1;if(w=Math.min(w,n-1),t)Ue(W);else W()}function Ue(e){let t=d("#revision-slider"),n=t.getBoundingClientRect().top,i=()=>{let s=t.getBoundingClientRect().top-n;if(Math.abs(s)>0.5)window.scrollBy(0,s)};e(),i(),d("#stage").querySelectorAll("img").forEach((s)=>{if(!s.complete)s.addEventListener("load",i,{once:!0})})}function Ee(e){let t=Z(),n=t.indexOf(r.revisions[p].key);if(n<0)return;let i=Math.min(t.length-1,Math.max(0,n+e));Q(k(t[i]))}function z(e=!1){window.clearTimeout(ve);let t=()=>{se(r.revisions[p]),se(r.revisions[h])};if(e)t();else ve=window.setTimeout(t,120)}function ze(){let e=le(),t=e.indexOf(r.revisions[p].key);for(let n of[t-1,t+1])if(n>=0&&n<e.length)se(R(e[n]))}async function se(e){if(!e||["queued","materializing","compiling","ready"].includes(e.render?.phase??""))return;await fetch(`${D}/api/render`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.key})})}function Te(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${D}/assets/${e.render_id}/page/${e.pages[t].number}`}function te(e,t,n){if(t)return S(t,`Revision ${n}`);let i=e.render?.phase,s=e.render?.message;return`
    <div class="render-status ${i??"idle"}">
      <span class="status-letter">${n}</span>
      <strong>${B(e.render)}</strong>
      <p>${M(s??(i?"Preparing this revision…":"Select this revision to render it."))}</p>
    </div>
  `}function S(e,t){return`<img class="document-page" src="${e}" alt="${t}" draggable="false" decoding="async" />`}function Je(e){let t=Se.get(e.parent_ids[0]);return Boolean(t&&N(e.render,t.render))}function q(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===m}">${t}</button>`}function le(){return b==="first-parent"?r.history.first_parent_keys:r.history.full_tree_keys}function Z(){let e=le();if(b==="full-tree"||!ae)return e;return e.filter((t,n)=>{if(n===e.length-1)return!0;return!N(R(t).render,R(e[n+1]).render)})}function R(e){let t=re.get(e);if(!t)throw Error(`Unknown revision: ${e}`);return t}function k(e){return ke.get(e)??-1}function de(e){return Ie.format(new Date(e))}async function He(e){let t=await new Promise((n,i)=>{let s=new Image;s.decoding="async",s.onload=()=>n(s),s.onerror=()=>i(Error(`Could not load ${e}`)),s.src=e});return createImageBitmap(t)}function d(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function M(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
