function D(e,t,i){if(e?.phase!=="ready"||t?.phase!=="ready")return"waiting";let n=e.pages[i],a=t.pages[i];if(!n&&a)return"added";if(n&&!a)return"removed";if(!n||!a)return"waiting";return n.hash===a.hash?"same":"changed"}function A(e,t){if(e?.phase!=="ready"||t?.phase!=="ready")return!1;if(e.pages.length!==t.pages.length)return!1;return e.pages.every((i,n)=>i.hash===t.pages[n]?.hash)}function H(e){return e.slice(0,8)}function k(e){switch(e?.phase){case"queued":return"Waiting";case"materializing":return"Reading revision";case"compiling":return"Typesetting";case"ready":return`${e.pages.length} page${e.pages.length===1?"":"s"}`;case"entrypoint_missing":return"No document";case"error":return"Could not render";default:return"Not rendered"}}var E=location.pathname.replace(/\/$/,""),W=new Worker(`${E}/diff-worker.js`,{type:"module"}),S=o("#app"),s,d=0,h=1,T=0,v=0,l="single",w=50,G=!1,y=!1,_=0,F;X();async function X(){S.innerHTML='<div class="boot"><span class="boot-mark">T</span><p>Reading document history…</p></div>';let e=await fetch(`${E}/api/session`);if(!e.ok)throw Error("Could not load Typst history.");if(s=await e.json(),s.revisions.length<2)h=0;Y(),ee(),C(),Q()}function Y(){let e=s.repository.root.split("/").filter(Boolean).at(-1)??"repository";S.innerHTML=`
    <header class="masthead">
      <div class="brand">
        <span class="brand-stamp" aria-hidden="true">T</span>
        <div>
          <p class="eyebrow">Typst Time Machine</p>
          <h1>${u(s.target.entry)}</h1>
        </div>
      </div>
      <div class="repo-facts">
        <span class="vcs">${s.repository.kind}</span>
        <strong>${u(e)}</strong>
        <span>${s.revisions.length} revisions</span>
        <span title="${u(s.compiler)}">${u(s.compiler)}</span>
      </div>
    </header>
    <main>
      <section class="controls" aria-label="Comparison controls">
        <div class="mode-group" role="group" aria-label="Comparison mode">
          ${$("single","B")}
          ${$("side","A · B")}
          ${$("blink","Blink")}
          ${$("opacity","Mix")}
          ${$("wipe","Wipe")}
          ${$("heatmap","Heat")}
        </div>
        <label class="mix-control" data-visible="false">
          <span>Position</span>
          <input id="mix" type="range" min="0" max="100" value="${w}" />
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
          <p class="eyebrow">First-parent history</p>
          <p>Old document at left. Present at right.</p>
        </div>
        <label class="collapse">
          <input id="collapse" type="checkbox" />
          Hide visually unchanged
        </label>
      </div>
      <div class="film" id="film" role="listbox" aria-label="Document revisions"></div>
    </footer>
  `,Z(),M()}function Z(){S.querySelectorAll("[data-mode]").forEach((t)=>{t.addEventListener("click",()=>{l=t.dataset.mode,M()})}),o("#mix").addEventListener("input",(t)=>{w=Number(t.target.value),f()}),o("#pin-a").addEventListener("click",()=>{h=d,T=v,M(),C()}),o("#collapse").addEventListener("change",(t)=>{G=t.target.checked,V()}),o("#page-a").addEventListener("change",(t)=>{T=Number(t.target.value),f(),x()}),o("#page-b").addEventListener("change",(t)=>{v=Number(t.target.value),f(),x()}),o("#stage").addEventListener("pointerdown",()=>{if(l==="blink")y=!0,f()}),window.addEventListener("pointerup",()=>{if(y)y=!1,f()}),window.addEventListener("keydown",(t)=>{if(t.key==="ArrowLeft")P(Math.min(s.revisions.length-1,d+1));else if(t.key==="ArrowRight")P(Math.max(0,d-1));else if(t.code==="Space"&&l==="blink"&&!t.repeat)t.preventDefault(),y=!0,f()}),window.addEventListener("keyup",(t)=>{if(t.code==="Space"&&y)y=!1,f()})}function ee(){let e=new EventSource(`${E}/api/events`);e.addEventListener("render",(t)=>{let i=JSON.parse(t.data),n=s.revisions.find((a)=>a.key===i.status.revision_key);if(!n)return;if(n.render=i.status,M(),i.status.phase==="ready")K(),Q()}),e.onerror=()=>{document.body.dataset.connection="lost"}}function M(){te(),ne(),V(),x(),f(),S.querySelectorAll("[data-mode]").forEach((t)=>{t.setAttribute("aria-pressed",String(t.dataset.mode===l))});let e=o(".mix-control");e.dataset.visible=String(l==="opacity"||l==="wipe")}function te(){O(o("#revision-a"),s.revisions[h],"A",h===d),O(o("#revision-b"),s.revisions[d],"B",!1)}function O(e,t,i,n){let a=new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(new Date(t.committed_at));e.innerHTML=`
    <div class="revision-letter">${i}</div>
    <p class="revision-date">${a}</p>
    <h2>${u(t.subject||"(no description)")}</h2>
    <p class="revision-author">${u(t.author)}</p>
    <dl>
      <div><dt>Commit</dt><dd title="${t.commit_id}">${H(t.commit_id)}</dd></div>
      ${t.change_id?`<div><dt>Change</dt><dd title="${t.change_id}">${H(t.change_id)}</dd></div>`:""}
      <div><dt>Render</dt><dd>${k(t.render)}</dd></div>
    </dl>
    ${t.bookmarks.map((r)=>`<span class="bookmark">${u(r)}</span>`).join("")}
    ${n?'<p class="same-pin">A and B are this revision.</p>':""}
  `}function V(){let e=o("#film"),t=s.revisions.map((n,a)=>({revision:n,index:a})).filter(({revision:n,index:a})=>{if(!G||a===s.revisions.length-1)return!0;return!A(n.render,s.revisions[a+1]?.render)}).reverse();e.innerHTML=t.map(({revision:n,index:a})=>{let r=n.render?.phase??"idle",p=A(n.render,s.revisions[a+1]?.render);return`
        <button
          class="frame ${a===d?"selected":""} ${a===h?"pinned":""}"
          type="button"
          role="option"
          aria-selected="${a===d}"
          data-index="${a}"
          data-phase="${r}"
          title="${u(n.changed_paths.join(`
`))}"
        >
          <span class="sprockets" aria-hidden="true"></span>
          <time>${ie(n.committed_at)}</time>
          <strong>${u(n.subject||"(no description)")}</strong>
          <span class="frame-meta">${H(n.commit_id)} · ${p?"same output":k(n.render)}</span>
          <span class="frame-state" aria-hidden="true"></span>
        </button>
      `}).join(""),e.querySelectorAll(".frame").forEach((n)=>{n.addEventListener("click",()=>P(Number(n.dataset.index)))});let i=e.querySelector(".selected");if(i)e.scrollLeft=Math.max(0,i.offsetLeft-e.clientWidth/2+i.clientWidth/2)}function ne(){U(o("#page-a"),s.revisions[h].render,T),U(o("#page-b"),s.revisions[d].render,v)}function U(e,t,i){let n=t?.phase==="ready"?t.pages.length:0;if(n===0){e.innerHTML='<option value="0">—</option>',e.disabled=!0;return}e.disabled=!1,e.innerHTML=Array.from({length:n},(a,r)=>`<option value="${r}" ${r===i?"selected":""}>${r+1}</option>`).join("")}function x(){let e=s.revisions[h].render,t=s.revisions[d].render,i=Math.max(e?.pages.length??0,t?.pages.length??0),n=o("#page-rail");n.innerHTML=Array.from({length:i},(a,r)=>{let p=D(e,t,r);return`<button class="page-tick ${p} ${r===v?"active":""}" data-page="${r}" title="Page ${r+1}: ${p}">${r+1}</button>`}).join(""),n.querySelectorAll(".page-tick").forEach((a)=>{a.addEventListener("click",()=>{T=Math.min(Number(a.dataset.page),Math.max(0,(e?.pages.length??1)-1)),v=Math.min(Number(a.dataset.page),Math.max(0,(t?.pages.length??1)-1)),M()})})}function f(){let e=o("#stage"),t=s.revisions[h],i=s.revisions[d],n=z(t.render,T),a=z(i.render,v);if(l==="single"){e.innerHTML=B(i,a,"B");return}if(!n||!a){e.innerHTML=`
      <div class="split-pages">
        ${B(t,n,"A")}
        ${B(i,a,"B")}
      </div>
    `;return}if(l==="side")e.innerHTML=`<div class="split-pages">${m(n,"Revision A")}${m(a,"Revision B")}</div>`;else if(l==="blink")e.innerHTML=`
      <div class="stack-pages ${y?"show-a":"show-b"}">
        ${m(n,"Revision A")}
        ${m(a,"Revision B")}
        <span class="blink-instruction">Hold space or press document for A</span>
      </div>
    `;else if(l==="opacity")e.innerHTML=`
      <div class="stack-pages">
        ${m(n,"Revision A")}
        <div class="overlay-page" style="opacity:${w/100}">${m(a,"Revision B")}</div>
      </div>
    `;else if(l==="wipe")e.innerHTML=`
      <div class="stack-pages">
        ${m(n,"Revision A")}
        <div class="overlay-page wipe" style="clip-path:inset(0 ${100-w}% 0 0)">${m(a,"Revision B")}</div>
        <span class="wipe-line" style="left:${w}%"></span>
      </div>
    `;else e.innerHTML='<div class="heatmap"><canvas id="heatmap"></canvas><p id="heatmap-label">Calculating visual difference…</p></div>',ae(n,a)}async function ae(e,t){let i=++_,[n,a]=await Promise.all([J(e),J(t)]);if(i!==_||l!=="heatmap")return;let r=1.5,p=Math.ceil(Math.max(n.naturalWidth,a.naturalWidth)*r),L=Math.ceil(Math.max(n.naturalHeight,a.naturalHeight)*r),q=(b)=>{let c=document.createElement("canvas");c.width=p,c.height=L;let g=c.getContext("2d",{willReadFrequently:!0});return g.fillStyle="#ffffff",g.fillRect(0,0,p,L),g.drawImage(b,Math.round((p-b.naturalWidth*r)/2),Math.round((L-b.naturalHeight*r)/2),b.naturalWidth*r,b.naturalHeight*r),g.getImageData(0,0,p,L)},I=q(n),N=q(a);W.onmessage=(b)=>{if(i!==_||l!=="heatmap")return;let c=b.data,g=document.querySelector("#heatmap");if(!g)return;g.width=c.width,g.height=c.height,g.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(c.output),c.width,c.height),0,0);let j=document.querySelector("#heatmap-label");if(j)j.textContent=`${(c.changed/c.total*100).toFixed(2)}% pixels differ`},W.postMessage({left:I.data.buffer,right:N.data.buffer,width:p,height:L},[I.data.buffer,N.data.buffer])}function P(e){d=e;let t=s.revisions[e].render?.pages.length??1;v=Math.min(v,t-1),M(),C()}function C(){R(s.revisions[d]),R(s.revisions[h]),K()}function K(){for(let e of[d-1,d+1])if(e>=0&&e<s.revisions.length)R(s.revisions[e])}function Q(){window.clearTimeout(F),F=window.setTimeout(()=>{let e=s.revisions.find((t)=>t.render==null);if(e)R(e)},400)}async function R(e){if(!e||["queued","materializing","compiling","ready"].includes(e.render?.phase??""))return;await fetch(`${E}/api/render`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision_key:e.key})})}function z(e,t){if(e?.phase!=="ready"||!e.render_id||!e.pages[t])return null;return`${E}/assets/${e.render_id}/page/${e.pages[t].number}`}function B(e,t,i){if(t)return m(t,`Revision ${i}`);let n=e.render?.phase,a=e.render?.message;return`
    <div class="render-status ${n??"idle"}">
      <span class="status-letter">${i}</span>
      <strong>${k(e.render)}</strong>
      <p>${u(a??(n?"Preparing this revision…":"Select this revision to render it."))}</p>
    </div>
  `}function m(e,t){return`<img class="document-page" src="${e}" alt="${t}" draggable="false" />`}function $(e,t){return`<button type="button" data-mode="${e}" aria-pressed="${e===l}">${t}</button>`}function ie(e){return new Intl.DateTimeFormat(void 0,{month:"short",day:"numeric",year:"2-digit"}).format(new Date(e))}function J(e){return new Promise((t,i)=>{let n=new Image;n.onload=()=>t(n),n.onerror=()=>i(Error(`Could not load ${e}`)),n.src=e})}function o(e){let t=document.querySelector(e);if(!t)throw Error(`Missing UI element: ${e}`);return t}function u(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
