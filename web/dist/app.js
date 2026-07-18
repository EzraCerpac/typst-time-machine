function ae(e,t,n){if(e?.phase!=="ready"||t?.phase!=="ready")return"waiting";let i=e.pages[n],s=t.pages[n];if(!i&&s)return"added";if(i&&!s)return"removed";if(!i||!s)return"waiting";return i.hash===s.hash?"same":"changed"}function K(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((n,i)=>n.hash===t.pages[i]?.hash)}function I(e){return e.slice(0,8)}function P(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${e.pages.length} page${e.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}function oe(e,t){let n=new Map(e.map((a)=>[a.key,a])),i=new Map(e.map((a)=>[a.commit_id,a.key])),s=new Set(t.map((a)=>n.get(a)?.commit_id).filter((a)=>Boolean(a))),o=[],h=[];t.forEach((a,y)=>{let g=n.get(a);if(!g)return;let l=o.indexOf(g.commit_id);if(l<0)l=o.length;else o.splice(l,1);h.push({key:a,row:y,lane:l}),g.parent_ids.filter((d)=>s.has(d)).forEach((d,k)=>{if(o.includes(d))return;o.splice(Math.min(l+k,o.length),0,d)})});let v=new Map(h.map((a)=>[a.key,a])),m=t.flatMap((a)=>{let y=n.get(a);if(!y||!v.has(a))return[];return y.parent_ids.flatMap((g,l)=>{let d=i.get(g);if(!d||!v.has(d))return[];return[{child:a,parent:d,merge:l>0}]})});return{nodes:h,edges:m,laneCount:Math.max(1,...h.map((a)=>a.lane+1))}}var D=location.pathname.replace(/\/$/,""),le=new Worker(`${D}/diff-worker.js`,{type:"module"}),C=c("#app"),r,u=0,$=1,j=0,T=0,f="single",E="first-parent",w=50,fe=!1,S=!1,Y=0,N=!1,de;Le();async function Le(){C.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${D}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");r=await e.json(),u=x(r.history.first_parent_keys[0]),$=x(r.history.first_parent_keys[1]??r.history.first_parent_keys[0]),Ee(),we(),F(!0)}function Ee(){let e=r.repository.root.split("/").filter(Boolean).at(-1)??"repository";C.innerHTML=`
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
          ${B("single","B")}
          ${B("side","A · B")}
          ${B("blink","Blink")}
          ${B("opacity","Mix")}
          ${B("wipe","Wipe")}
          ${B("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false" hidden>
          <span id="mix-label">Wipe</span>
          <input id="mix" type="range" min="0" max="100" value="${w}" aria-label="Comparison position" />
          <input id="mix-number" type="number" min="0" max="100" value="${w}" aria-label="Comparison position percentage" />
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
  `,He(),R()}function He(){C.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{f=t.dataset.mode,R()})}),c("#mix").addEventListener("input",(t)=>{V(Number(t.target.value))}),c("#mix-number").addEventListener("input",(t)=>{V(Number(t.target.value))}),c("#pin-a").addEventListener("click",()=>{$=u,j=T,R(),F(!0)}),c("#collapse").addEventListener("change",(t)=>{fe=t.target.checked,ve(),ye()}),C.querySelectorAll("[data-history-mode]").forEach((t)=>{t.addEventListener("click",()=>{E=t.dataset.historyMode;let n=O();if(!n.includes(r.revisions[u].key))u=x(n[0]),T=0;R(),F()})}),c("#revision-slider").addEventListener("input",(t)=>{let i=[...Q()].reverse()[Number(t.target.value)];if(i)G(x(i))}),c("#page-a").addEventListener("change",(t)=>{j=Number(t.target.value),_(),J()}),c("#page-b").addEventListener("change",(t)=>{T=Number(t.target.value),_(),J()});let e=c("#stage");e.addEventListener("pointerdown",(t)=>{if(f==="blink")S=!0,_();else if(f==="wipe"&&t.button===0)N=!0,e.setPointerCapture(t.pointerId),ue(t)}),e.addEventListener("pointermove",(t)=>{if(N)ue(t)}),e.addEventListener("pointerup",(t)=>{if(N)N=!1,e.releasePointerCapture(t.pointerId)}),window.addEventListener("pointerup",()=>{if(S)S=!1,_();N=!1}),window.addEventListener("keydown",(t)=>{if(t.key==="ArrowLeft")me(1);else if(t.key==="ArrowRight")me(-1);else if(t.code==="Space"&&f==="blink"&&!t.repeat)t.preventDefault(),S=!0,_()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&S)S=!1,_()})}function we(){let e=new EventSource(`${D}/api/events`);e.addEventListener("render",(t)=>{let n=JSON.parse(t.data),i=r.revisions.find((s)=>s.key===n.status.revision_key);if(!i)return;if(i.render=n.status,R(),n.status.phase==="ready")_e()}),e.onerror=()=>{document.body.dataset.connection="lost"}}function R(){Te(),xe(),ve(),ye(),J(),_(),be(),C.querySelectorAll("[data-mode]").forEach((i)=>{i.setAttribute("aria-pressed",String(i.dataset.mode===f))});let e=c(".mix-control"),t=f==="opacity"||f==="wipe";e.dataset.visible=String(t),e.hidden=!t,c("#mix-label").textContent=f==="opacity"?"Blend":"Wipe",C.querySelectorAll("[data-history-mode]").forEach((i)=>{i.setAttribute("aria-pressed",String(i.dataset.historyMode===E))});let n=c("#collapse");n.disabled=E==="full-tree",c("#history-title").textContent=E==="first-parent"?"First-parent history":"Full revision tree",c("#history-description").textContent=E==="first-parent"?"The main story, oldest at left.":"Newest at top, with branches and merges at left."}function Te(){ce(c("#revision-a"),r.revisions[$],"A",$===u),ce(c("#revision-b"),r.revisions[u],"B",!1)}function ce(e,t,n,i){let s=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${n}</div>
    <p class="revision-date">${s}</p>
    <h2>${M(t.subject||"(no description)")}</h2>
    <p class="revision-author">${M(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${I(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${I(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${P(t.render)}</dd></div>
    </dl>
    ${t.bookmarks.map((o)=>`<span class="bookmark">${M(o)}</span>`).join("")}
    ${i?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function ve(){let e=c("#film"),t=c("#tree");if(e.hidden=E!=="first-parent",t.hidden=E!=="full-tree",E==="full-tree"){ke(t);return}let n=e.scrollLeft,i=r.revisions[u].key,s=e.dataset.selectedKey!==i,h=Q().map((m)=>({revision:A(m),index:x(m)})).reverse();e.innerHTML=h.map(({revision:m,index:a})=>{let y=m.render?.phase??"idle",g=r.history.first_parent_keys.indexOf(m.key),l=r.history.first_parent_keys[g+1],d=l?A(l):void 0,k=K(m.render,d?.render);return`
        <button
          class="frame ${a===u?"selected":""} ${a===$?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${a===u}"
          data-index="${a}"
          data-phase="${y}"
          title="${M(m.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${Z(m.committed_at)}</time>
          <strong>${M(m.subject||"(no description)")}</strong>
          <span class="frame-meta">${I(m.commit_id)} · ${k?"same output":P(m.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((m)=>{m.addEventListener("click",()=>G(Number(m.dataset.index)))});let v=e.querySelector(".selected");if(e.dataset.selectedKey=i,v&&s)e.scrollLeft=Math.max(0,v.offsetLeft-e.clientWidth/2+v.clientWidth/2);else e.scrollLeft=n}function ke(e){let t=r.history.full_tree_keys,n=oe(r.revisions,t),i=new Map(n.nodes.map((p)=>[p.key,p])),s=e.scrollTop,o=r.revisions[u].key,h=e.dataset.selectedKey!==o,v=58,m=8,a=Math.min(8,n.laneCount),y=34+a*18,g=(p)=>n.laneCount<2?18:16+p/(n.laneCount-1)*(y-32),l=t.length*58+16,d=new Map(n.nodes.map((p)=>[p.key,p.row])),k=n.edges.map((p)=>{let b=i.get(p.child),L=i.get(p.parent);if(!b||!L)return"";let q=d.get(p.child),ee=d.get(p.parent);if(q==null||ee==null)return"";let te=g(b.lane),ne=8+q*58+29,ie=g(L.lane),se=8+ee*58+29,re=(ne+se)/2;return`<path class="${p.merge?"merge-edge":""}" d="M ${te} ${ne} C ${te} ${re}, ${ie} ${re}, ${ie} ${se}" />`}).join(""),Me=n.nodes.map((p)=>{let b=d.get(p.key);if(b==null)return"";let L=x(p.key);return`<circle class="${[L===u?"selected":"",L===$?"pinned":""].filter(Boolean).join(" ")}" cx="${g(p.lane)}" cy="${8+b*58+29}" r="5" />`}).join(""),$e=n.nodes.map((p)=>{let b=A(p.key),L=x(p.key),q=b.render?.phase??"idle";return`
        <button
          class="tree-node ${L===u?"selected":""} ${L===$?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${L===u}"
          data-index="${L}"
          data-phase="${q}"
          title="${M(b.changed_paths.join(`
`))}"
        >
          <span class="tree-subject">
            <strong>${M(b.subject||"(no description)")}</strong>
            <time>${Z(b.committed_at)}</time>
          </span>
          <span class="tree-meta">${I(b.commit_id)} · ${P(b.render)}</span>
        </button>
      `}).join("");e.innerHTML=`
    <div class="tree-canvas" data-lanes="${a}">
      <svg aria-hidden="true" viewBox="0 0 ${y} ${l}" width="${y}" height="${l}">${k}${Me}</svg>
      ${$e}
    </div>
  `,e.querySelectorAll(".tree-node").forEach((p)=>{p.addEventListener("click",()=>G(Number(p.dataset.index)))});let U=e.querySelector(".tree-node.selected");if(e.dataset.selectedKey=o,U&&h)e.scrollTop=Math.max(0,U.offsetTop-e.clientHeight/2+U.clientHeight/2);else e.scrollTop=s}function ye(){let e=[...Q()].reverse(),t=c("#revision-slider"),n=r.revisions[u].key,i=Math.max(0,e.indexOf(n));t.max=String(Math.max(0,e.length-1)),t.value=String(i);let s=e[i]?A(e[i]):void 0;c("#revision-position").textContent=s?`${i+1} / ${e.length} · ${Z(s.committed_at)} · ${s.subject||"(no description)"}`:"No revision"}function xe(){pe(c("#page-a"),r.revisions[$].render,j),pe(c("#page-b"),r.revisions[u].render,T)}function pe(e,t,n){let i=t?.phase==="ready"?t.pages.length:0;if(i===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:i},(s,o)=>`<option value="${o}" ${o===n?"selected":""}>${o+1}</option>`).join("")}function J(){let e=r.revisions[$].render,t=r.revisions[u].render,n=Math.max(e?.pages.length??0,t?.pages.length??0),i=c("#page-rail");i.innerHTML=Array.from({length:n},(s,o)=>{let h=ae(e,t,o);return`<button class="page-tick ${h} ${o===T?"active":""}" data-page="${o}" title="Page ${o+1}: ${h}">${o+1}</button>`}).join(""),i.querySelectorAll(".page-tick").forEach((s)=>{s.addEventListener("click",()=>{j=Math.min(Number(s.dataset.page),Math.max(0,(e?.pages.length??1)-1)),T=Math.min(Number(s.dataset.page),Math.max(0,(t?.pages.length??1)-1)),R()})})}function _(){let e=c("#stage"),t=r.revisions[$],n=r.revisions[u],i=ge(t.render,j),s=ge(n.render,T);if(f==="single"){let o=Re(n);e.innerHTML=`
      <div class="single-page">
        ${z(n,s,"B")}
        ${o?'<span class="same-output">Same rendered output as first parent</span>':""}
      </div>
    `;return}if(!i||!s){e.innerHTML=`
      <div class="split-pages">
        ${z(t,i,"A")}
        ${z(n,s,"B")}
      </div>
    `;return}if(f==="side")e.innerHTML=`<div class="split-pages">${H(i,"Revision A")}${H(s,"Revision B")}</div>`;else if(f==="blink")e.innerHTML=`
      <div class="stack-pages ${S?"show-a":"show-b"}">
        ${H(i,"Revision A")}
        ${H(s,"Revision B")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(f==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${H(i,"Revision A")}
        <div class="overlay-page mix-page">${H(s,"Revision B")}</div>
      </div>
    `;else if(f==="wipe")e.innerHTML=`
      <div class="stack-pages wipe-pages">
        ${H(i,"Revision A")}
        <div class="overlay-page wipe">${H(s,"Revision B")}</div>
        <span class="wipe-line" aria-hidden="true"></span>
        <span class="wipe-handle" aria-hidden="true">A&nbsp;│&nbsp;B</span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Calculating visual difference…</p></div>',Se(i,s)}function V(e){if(!Number.isFinite(e))return;w=Math.min(100,Math.max(0,Math.round(e))),be()}function be(){let e=document.querySelector("#mix"),t=document.querySelector("#mix-number");if(e)e.value=String(w);if(t)t.value=String(w);W(document.querySelector(".mix-page"),{opacity:w/100}),W(document.querySelector(".wipe"),{clipPath:`inset(0 ${100-w}% 0 0)`}),W(document.querySelector(".wipe-line"),{left:`${w}%`}),W(document.querySelector(".wipe-handle"),{left:`${w}%`})}function W(e,t){if(!e)return;e.getAnimations().forEach((n)=>n.cancel()),e.animate([t,t],{duration:1,fill:"forwards"})}function ue(e){let t=document.querySelector(".wipe-pages");if(!t)return;let n=t.getBoundingClientRect();V((e.clientX-n.left)/n.width*100)}async function Se(e,t){let n=++Y,[i,s]=await Promise.all([he(e),he(t)]);if(n!==Y||f!=="heatmap")return;let o=1.5,h=Math.ceil(Math.max(i.naturalWidth,s.naturalWidth)*o),v=Math.ceil(Math.max(i.naturalHeight,s.naturalHeight)*o),m=(g)=>{let l=document.createElement("canvas");l.width=h,l.height=v;let d=l.getContext("2d",{willReadFrequently:!0});return d.fillStyle="#ffffff",d.fillRect(0,0,h,v),d.drawImage(g,Math.round((h-g.naturalWidth*o)/2),Math.round((v-g.naturalHeight*o)/2),g.naturalWidth*o,g.naturalHeight*o),d.getImageData(0,0,h,v)},a=m(i),y=m(s);le.onmessage=(g)=>{if(n!==Y||f!=="heatmap")return;let l=g.data,d=document.querySelector("#heatmap");if(!d)return;d.width=l.width,d.height=l.height,d.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(l.output),l.width,l.height),0,0);let k=document.querySelector("#heatmap-label");if(k)k.textContent=`${(l.changed/l.total*100).toFixed(2)}% pixels differ`},le.postMessage({left:a.data.buffer,right:y.data.buffer,width:h,height:v},[a.data.buffer,y.data.buffer])}function G(e){if(e<0||e>=r.revisions.length)return;u=e;let t=r.revisions[e].render?.pages.length??1;T=Math.min(T,t-1),R(),F()}function me(e){let t=O(),n=t.indexOf(r.revisions[u].key);if(n<0)return;let i=Math.min(t.length-1,Math.max(0,n+e));G(x(t[i]))}function F(e=!1){window.clearTimeout(de);let t=()=>{X(r.revisions[u]),X(r.revisions[$])};if(e)t();else de=window.setTimeout(t,120)}function _e(){let e=O(),t=e.indexOf(r.revisions[u].key);for(let n of[t-1,t+1])if(n>=0&&n<e.length)X(A(e[n]))}async function X(e){if(!e||["queued","materializing","compiling","ready"].includes(e.render?.phase??""))return;await fetch(`${D}/api/render`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.key})})}function ge(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${D}/assets/${e.render_id}/page/${e.pages[t].number}`}function z(e,t,n){if(t)return H(t,`Revision ${n}`);let i=e.render?.phase,s=e.render?.message;return`
    <div class="render-status ${i??"idle"}">
      <span class="status-letter">${n}</span>
      <strong>${P(e.render)}</strong>
      <p>${M(s??(i?"Preparing this revision…":"Select this revision to render it."))}</p>
    </div>
  `}function H(e,t){return`<img class="document-page" src="${e}" alt="${t}" draggable="false" />`}function Re(e){let t=e.parent_ids[0],n=r.revisions.find((i)=>i.commit_id===t);return Boolean(n&&K(e.render,n.render))}function B(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===f}">${t}</button>`}function O(){return E==="first-parent"?r.history.first_parent_keys:r.history.full_tree_keys}function Q(){let e=O();if(E==="full-tree"||!fe)return e;return e.filter((t,n)=>{if(n===e.length-1)return!0;return!K(A(t).render,A(e[n+1]).render)})}function A(e){let t=r.revisions.find((n)=>n.key===e);if(!t)throw Error(`Unknown revision: ${e}`);return t}function x(e){return r.revisions.findIndex((t)=>t.key===e)}function Z(e){return new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}).format(new Date(e))}function he(e){return new Promise((t,n)=>{let i=new Image;i.onload=()=>t(i),i.onerror=()=>n(Error(`Could not load ${e}`)),i.src=e})}function c(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function M(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
