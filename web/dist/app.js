function ne(e,t,i){if(e?.phase!=="ready"||t?.phase!=="ready")return"waiting";let n=e.pages[i],r=t.pages[i];if(!n&&r)return"added";if(n&&!r)return"removed";if(!n||!r)return"waiting";return n.hash===r.hash?"same":"changed"}function Y(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((i,n)=>i.hash===t.pages[n]?.hash)}function q(e){return e.slice(0,8)}function I(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${e.pages.length} page${e.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function ie(e,t){let i=new Map(e.map((o)=>[o.key,o])),n=new Map(e.map((o)=>[o.commit_id,o.key])),r=new Set(t.map((o)=>i.get(o)?.commit_id).filter((o)=>Boolean(o))),s=[],p=[];t.forEach((o,f)=>{let u=i.get(o);if(!u)return;let d=s.indexOf(u.commit_id);if(d<0)d=s.length;else s.splice(d,1);p.push({key:o,column:t.length-f-1,lane:d}),u.parent_ids.filter((c)=>r.has(c)).forEach((c,b)=>{if(s.includes(c))return;s.splice(Math.min(d+b,s.length),0,c)})});let y=new Map(p.map((o)=>[o.key,o])),x=t.flatMap((o)=>{let f=i.get(o);if(!f||!y.has(o))return[];return f.parent_ids.flatMap((u,d)=>{let c=n.get(u);if(!c||!y.has(c))return[];return[{child:o,parent:c,merge:d>0}]})});return{nodes:p,edges:x,laneCount:Math.max(1,...p.map((o)=>o.lane+1))}}var j=location.pathname.replace(/\/$/,""),se=new Worker(`${j}/diff-worker.js`,{type:"module"}),C=l("#app"),a,m=0,L=1,N=0,T=0,g="single",$="first-parent",H=50,ue=!1,w=!1,F=0,re,P=!1;ye();async function ye(){C.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${j}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");a=await e.json(),m=A(a.history.first_parent_keys[0]),L=A(a.history.first_parent_keys[1]??a.history.first_parent_keys[0]),be(),$e(),D(),ve()}function be(){let e=a.repository.root.split("/").filter(Boolean).at(-1)??"repository";C.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${v(a.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${a.repository.kind}</span>
        <strong>${v(e)}</strong>
        <span>${a.revisions.length} revisions</span>
        <span title="${v(a.compiler)}">${v(a.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${B("single","B")}
          ${B("side","A · B")}
          ${B("blink","Blink")}
          ${B("opacity","Mix")}
          ${B("wipe","Wipe")}
          ${B("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${H}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${H}" aria-label="Comparison position percentage" />
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
  `,Me(),_()}function Me(){C.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{g=t.dataset.mode,_()})}),l("#mix").addEventListener("input",(t)=>{z(Number(t.target.value))}),l("#mix-number").addEventListener("input",(t)=>{z(Number(t.target.value))}),l("#pin-a").addEventListener("click",()=>{L=m,N=T,_(),D()}),l("#collapse").addEventListener("change",(t)=>{ue=t.target.checked,me(),ge()}),C.querySelectorAll("[data-history-mode]").forEach((t)=>{t.addEventListener("click",()=>{$=t.dataset.historyMode;let i=O();if(!i.includes(a.revisions[m].key))m=A(i[0]),T=0;_(),D()})}),l("#revision-slider").addEventListener("input",(t)=>{let n=[...J()].reverse()[Number(t.target.value)];if(n)G(A(n))}),l("#page-a").addEventListener("change",(t)=>{N=Number(t.target.value),S(),K()}),l("#page-b").addEventListener("change",(t)=>{T=Number(t.target.value),S(),K()});let e=l("#stage");e.addEventListener("pointerdown",(t)=>{if(g==="blink")w=!0,S();else if(g==="wipe"&&t.button===0)P=!0,e.setPointerCapture(t.pointerId),le(t)}),e.addEventListener("pointermove",(t)=>{if(P)le(t)}),e.addEventListener("pointerup",(t)=>{if(P)P=!1,e.releasePointerCapture(t.pointerId)}),window.addEventListener("pointerup",()=>{if(w)w=!1,S();P=!1}),window.addEventListener("keydown",(t)=>{if(t.key==="ArrowLeft")de(1);else if(t.key==="ArrowRight")de(-1);else if(t.code==="Space"&&g==="blink"&&!t.repeat)t.preventDefault(),w=!0,S()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&w)w=!1,S()})}function $e(){let e=new EventSource(`${j}/api/events`);e.addEventListener("render",(t)=>{let i=JSON.parse(t.data),n=a.revisions.find((r)=>r.key===i.status.revision_key);if(!n)return;if(n.render=i.status,_(),i.status.phase==="ready")fe(),ve()}),e.onerror=()=>{document.body.dataset.connection="lost"}}function _(){Le(),He(),me(),ge(),K(),S(),he(),C.querySelectorAll("[data-mode]").forEach((n)=>{n.setAttribute("aria-pressed",String(n.dataset.mode===g))});let e=l(".mix-control"),t=g==="opacity"||g==="wipe";e.dataset.visible=String(t),e.hidden=!t,l("#mix-label").textContent=g==="opacity"?"Blend":"Wipe",C.querySelectorAll("[data-history-mode]").forEach((n)=>{n.setAttribute("aria-pressed",String(n.dataset.historyMode===$))});let i=l("#collapse");i.disabled=$==="full-tree",l("#history-title").textContent=$==="first-parent"?"First-parent history":"Full revision tree",l("#history-description").textContent=$==="first-parent"?"The main story, oldest at left.":"Branches and merges, oldest at left."}function Le(){ae(l("#revision-a"),a.revisions[L],"A",L===m),ae(l("#revision-b"),a.revisions[m],"B",!1)}function ae(e,t,i,n){let r=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${i}</div>
    <p class="revision-date">${r}</p>
    <h2>${v(t.subject||"(no description)")}</h2>
    <p class="revision-author">${v(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${q(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${q(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${I(t.render)}</dd></div>
    </dl>
    ${t.bookmarks.map((s)=>`<span class="bookmark">${v(s)}</span>`).join("")}
    ${n?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function me(){let e=l("#film"),t=l("#tree");if(e.hidden=$!=="first-parent",t.hidden=$!=="full-tree",$==="full-tree"){Ee(t);return}let n=J().map((s)=>({revision:R(s),index:A(s)})).reverse();e.innerHTML=n.map(({revision:s,index:p})=>{let y=s.render?.phase??"idle",x=a.history.first_parent_keys.indexOf(s.key),o=a.history.first_parent_keys[x+1],f=o?R(o):void 0,u=Y(s.render,f?.render);return`
        <button
          class="frame ${p===m?"selected":""} ${p===L?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${p===m}"
          data-index="${p}"
          data-phase="${y}"
          title="${v(s.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${V(s.committed_at)}</time>
          <strong>${v(s.subject||"(no description)")}</strong>
          <span class="frame-meta">${q(s.commit_id)} · ${u?"same output":I(s.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((s)=>{s.addEventListener("click",()=>G(Number(s.dataset.index)))});let r=e.querySelector(".selected");if(r)e.scrollLeft=Math.max(0,r.offsetLeft-e.clientWidth/2+r.clientWidth/2)}function Ee(e){let t=a.history.full_tree_keys,i=ie(a.revisions,t),n=new Map(i.nodes.map((h)=>[h.key,h])),r=188,s=92,p=14,y=14,x=166,o=72,f=Math.max(e.clientWidth||0,t.length*188+28),u=Math.max(112,i.laneCount*92+28),d=i.edges.map((h)=>{let M=n.get(h.child),k=n.get(h.parent);if(!M||!k)return"";let W=14+M.column*188+83,Q=14+M.lane*92+36,Z=14+k.column*188+83,ee=14+k.lane*92+36,te=(W+Z)/2;return`<path class="${h.merge?"merge-edge":""}" d="M ${W} ${Q} C ${te} ${Q}, ${te} ${ee}, ${Z} ${ee}" />`}).join(""),c=i.nodes.map((h)=>{let M=R(h.key),k=A(h.key),W=M.render?.phase??"idle";return`
        <button
          class="tree-node ${k===m?"selected":""} ${k===L?"pinned":""}"
          style="left:${14+h.column*188}px;top:${14+h.lane*92}px"
          type="button"
          role="option"
          aria-selected="${k===m}"
          data-index="${k}"
          data-phase="${W}"
          title="${v(M.changed_paths.join(`
`))}"
        >
          <time>${V(M.committed_at)}</time>
          <strong>${v(M.subject||"(no description)")}</strong>
          <span>${q(M.commit_id)} · ${I(M.render)}</span>
        </button>
      `}).join("");e.innerHTML=`
    <div class="tree-canvas" style="width:${f}px;height:${u}px">
      <svg aria-hidden="true" viewBox="0 0 ${f} ${u}" width="${f}" height="${u}">${d}</svg>
      ${c}
    </div>
  `,e.querySelectorAll(".tree-node").forEach((h)=>{h.addEventListener("click",()=>G(Number(h.dataset.index)))});let b=e.querySelector(".selected");if(b)e.scrollLeft=Math.max(0,b.offsetLeft-e.clientWidth/2+b.clientWidth/2),e.scrollTop=Math.max(0,b.offsetTop-e.clientHeight/2+b.clientHeight/2)}function ge(){let e=[...J()].reverse(),t=l("#revision-slider"),i=a.revisions[m].key,n=Math.max(0,e.indexOf(i));t.max=String(Math.max(0,e.length-1)),t.value=String(n),t.style.setProperty("--progress",`${e.length<2?100:n/(e.length-1)*100}%`);let r=e[n]?R(e[n]):void 0;l("#revision-position").textContent=r?`${n+1} / ${e.length} · ${V(r.committed_at)} · ${r.subject||"(no description)"}`:"No revision"}function He(){oe(l("#page-a"),a.revisions[L].render,N),oe(l("#page-b"),a.revisions[m].render,T)}function oe(e,t,i){let n=t?.phase==="ready"?t.pages.length:0;if(n===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:n},(r,s)=>`<option value="${s}" ${s===i?"selected":""}>${s+1}</option>`).join("")}function K(){let e=a.revisions[L].render,t=a.revisions[m].render,i=Math.max(e?.pages.length??0,t?.pages.length??0),n=l("#page-rail");n.innerHTML=Array.from({length:i},(r,s)=>{let p=ne(e,t,s);return`<button class="page-tick ${p} ${s===T?"active":""}" data-page="${s}" title="Page ${s+1}: ${p}">${s+1}</button>`}).join(""),n.querySelectorAll(".page-tick").forEach((r)=>{r.addEventListener("click",()=>{N=Math.min(Number(r.dataset.page),Math.max(0,(e?.pages.length??1)-1)),T=Math.min(Number(r.dataset.page),Math.max(0,(t?.pages.length??1)-1)),_()})})}function S(){let e=l("#stage"),t=a.revisions[L],i=a.revisions[m],n=ce(t.render,N),r=ce(i.render,T);if(g==="single"){e.innerHTML=U(i,r,"B");return}if(!n||!r){e.innerHTML=`
      <div class="split-pages">
        ${U(t,n,"A")}
        ${U(i,r,"B")}
      </div>
    `;return}if(g==="side")e.innerHTML=`<div class="split-pages">${E(n,"Revision A")}${E(r,"Revision B")}</div>`;else if(g==="blink")e.innerHTML=`
      <div class="stack-pages ${w?"show-a":"show-b"}">
        ${E(n,"Revision A")}
        ${E(r,"Revision B")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(g==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${E(n,"Revision A")}
        <div class="overlay-page mix-page">${E(r,"Revision B")}</div>
      </div>
    `;else if(g==="wipe")e.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${E(n,"Revision A")}
        <div class="overlay-page wipe">${E(r,"Revision B")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Calculating visual difference…</p></div>',Te(n,r)}function z(e){if(!Number.isFinite(e))return;H=Math.min(100,Math.max(0,Math.round(e))),he()}function he(){let e=document.querySelector("#mix"),t=document.querySelector("#mix-number");if(e)ke(e,H);if(t)t.value=String(H);document.querySelector(".mix-page")?.style.setProperty("opacity",String(H/100)),document.querySelector(".wipe")?.style.setProperty("clip-path",`inset(0 ${100-H}% 0 0)`),document.querySelector(".wipe-line")?.style.setProperty("left",`${H}%`),document.querySelector(".wipe-handle")?.style.setProperty("left",`${H}%`)}function le(e){let t=document.querySelector(".wipe-pages");if(!t)return;let i=t.getBoundingClientRect();z((e.clientX-i.left)/i.width*100)}async function Te(e,t){let i=++F,[n,r]=await Promise.all([pe(e),pe(t)]);if(i!==F||g!=="heatmap")return;let s=1.5,p=Math.ceil(Math.max(n.naturalWidth,r.naturalWidth)*s),y=Math.ceil(Math.max(n.naturalHeight,r.naturalHeight)*s),x=(u)=>{let d=document.createElement("canvas");d.width=p,d.height=y;let c=d.getContext("2d",{willReadFrequently:!0});return c.fillStyle="#ffffff",c.fillRect(0,0,p,y),c.drawImage(u,Math.round((p-u.naturalWidth*s)/2),Math.round((y-u.naturalHeight*s)/2),u.naturalWidth*s,u.naturalHeight*s),c.getImageData(0,0,p,y)},o=x(n),f=x(r);se.onmessage=(u)=>{if(i!==F||g!=="heatmap")return;let d=u.data,c=document.querySelector("#heatmap");if(!c)return;c.width=d.width,c.height=d.height,c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(d.output),d.width,d.height),0,0);let b=document.querySelector("#heatmap-label");if(b)b.textContent=`${(d.changed/d.total*100).toFixed(2)}% pixels differ`},se.postMessage({left:o.data.buffer,right:f.data.buffer,width:p,height:y},[o.data.buffer,f.data.buffer])}function G(e){if(e<0||e>=a.revisions.length)return;m=e;let t=a.revisions[e].render?.pages.length??1;T=Math.min(T,t-1),_(),D()}function de(e){let t=O(),i=t.indexOf(a.revisions[m].key);if(i<0)return;let n=Math.min(t.length-1,Math.max(0,i+e));G(A(t[n]))}function D(){X(a.revisions[m]),X(a.revisions[L]),fe()}function fe(){let e=O(),t=e.indexOf(a.revisions[m].key);for(let i of[t-1,t+1])if(i>=0&&i<e.length)X(R(e[i]))}function ve(){window.clearTimeout(re),re=window.setTimeout(()=>{let e=a.revisions.find((t)=>t.render==null);if(e)X(e)},400)}async function X(e){if(!e||["queued","materializing","compiling","ready"].includes(e.render?.phase??""))return;await fetch(`${j}/api/render`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.key})})}function ce(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${j}/assets/${e.render_id}/page/${e.pages[t].number}`}function U(e,t,i){if(t)return E(t,`Revision ${i}`);let n=e.render?.phase,r=e.render?.message;return`
    <div class="render-status ${n??"idle"}">
      <span class="status-letter">${i}</span>
      <strong>${I(e.render)}</strong>
      <p>${v(r??(n?"Preparing this revision…":"Select this revision to render it."))}</p>
    </div>
  `}function E(e,t){return`<img class="document-page" src="${e}" alt="${t}" draggable="false" />`}function B(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===g}">${t}</button>`}function O(){return $==="first-parent"?a.history.first_parent_keys:a.history.full_tree_keys}function J(){let e=O();if($==="full-tree"||!ue)return e;return e.filter((t,i)=>{if(i===e.length-1)return!0;return!Y(R(t).render,R(e[i+1]).render)})}function R(e){let t=a.revisions.find((i)=>i.key===e);if(!t)throw Error(`Unknown revision: ${e}`);return t}function A(e){return a.revisions.findIndex((t)=>t.key===e)}function ke(e,t){e.value=String(t),e.style.setProperty("--progress",`${t}%`)}function V(e){return new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}).format(new Date(e))}function pe(e){return new Promise((t,i)=>{let n=new Image;n.onload=()=>t(n),n.onerror=()=>i(Error(`Could not load ${e}`)),n.src=e})}function l(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function v(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
