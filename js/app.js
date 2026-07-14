import { ensureAnonymousUser, setBarVote, subscribeToBarVotes } from "./firebase.js";
const $=s=>document.querySelector(s);async function loadTrip(){const r=await fetch("./data/trip.json",{cache:"no-store"});if(!r.ok)throw new Error("Trip data failed");return r.json()}const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);const esc=(v="")=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");const statusLabel=s=>({"selected":"✓ Selected","current":"Current phase","progress":"In progress","not-started":"Not started","assigned":"Assigned"}[s]||s);async function init(){const t=await loadTrip();$("#trip-name").textContent=t.name;$("#trip-location").textContent=t.location;$("#trip-dates").textContent=t.dates;$("#version").textContent=t.version;
document.documentElement.style.setProperty("--hero-image",`url("${t.images.hero.url}")`);
$("#hero-credit").textContent=`Photo: ${t.images.hero.credit}`;$("#hero-credit").href=t.images.hero.source;
const visuals=[
 {image:t.images.alcatraz,kicker:"Booked",title:"Alcatraz",text:"Part of Rob's full-day tour."},
 {image:t.images.muir,kicker:"Booked",title:"Muir Woods",text:"Redwoods, Sausalito, and Alcatraz in one day."},
 {image:t.images.cablecar,kicker:"Booked",title:"Hop-on, hop-off",text:"Flexible sightseeing around San Francisco."}
];
$("#visual-grid").innerHTML=visuals.map(v=>`<article class="visual-card"><img src="${v.image.url}" alt="${esc(v.image.alt)}" loading="lazy"><div class="visual-overlay"><p>${esc(v.kicker)}</p><h3>${esc(v.title)}</h3><span>${esc(v.text)}</span></div></article>`).join("");
$("#photo-credit-list").innerHTML=t.photoCredits.map(i=>`<a class="photo-credit" href="${i.source}" target="_blank" rel="noopener"><strong>${esc(i.credit)}</strong><span>${esc(i.alt)}</span></a>`).join("");const p=Math.round(t.phases.filter(x=>x.status==="selected").length/t.phases.length*100);$("#progress-label").textContent=`${p}% locked`;$("#progress-bar").style.width=`${p}%`;const allBars=[...t.walkableBars.initial,...t.walkableBars.bench];
let sharedVotes={totals:{},mine:{}};
let voteConnectionState="Connecting…";

function rankedBars(){
  return [...allBars].sort((a,b)=>{
    const av=sharedVotes.totals[a.id]||{up:0,down:0};
    const bv=sharedVotes.totals[b.id]||{up:0,down:0};
    const aScore=av.up-av.down;
    const bScore=bv.up-bv.down;
    return bScore-aScore || bv.up-av.up || av.down-bv.down || a.name.localeCompare(b.name);
  });
}

function renderBars(){
  $("#bar-list").innerHTML=rankedBars().map((b,index)=>{
    const votes=sharedVotes.totals[b.id]||{up:0,down:0};
    const mine=sharedVotes.mine[b.id]||null;
    const score=votes.up-votes.down;
    return `<article class="bar-card">
      <div class="bar-photo-wrap">
        <img src="${b.image}" alt="${esc(b.imageAlt)}" loading="lazy">
        <span class="bar-rank">#${index+1}</span>
        <a class="bar-photo-credit" href="${b.imageSource}" target="_blank" rel="noopener">${esc(b.imageCredit)}</a>
      </div>
      <div class="bar-card-body">
        <div class="bar-topline"><span class="status status-current">${esc(b.category)}</span><span class="bar-walk">${esc(b.walk)}</span></div>
        <h3>${esc(b.name)}</h3>
        <p>${esc(b.summary)}</p>
        <div class="bar-score"><strong>${score>0?"+":""}${score}</strong><span>group score</span></div>
        <div class="bar-links"><a class="pill" href="${b.website}" target="_blank" rel="noopener">Website</a><a class="pill" href="${b.maps}" target="_blank" rel="noopener">Map</a></div>
        <div class="vote-row">
          <button class="vote-button vote-up ${mine==="up"?"selected":""}" data-bar="${b.id}" data-vote="up" ${voteConnectionState!=="Live"?"disabled":""}>👍 I’m In <span>${votes.up}</span></button>
          <button class="vote-button vote-down ${mine==="down"?"selected":""}" data-bar="${b.id}" data-vote="down" ${voteConnectionState!=="Live"?"disabled":""}>👎 Pass <span>${votes.down}</span></button>
        </div>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-vote]").forEach(button=>button.addEventListener("click",async()=>{
    const barId=button.dataset.bar;
    const requested=button.dataset.vote;
    const nextVote=sharedVotes.mine[barId]===requested?null:requested;
    button.disabled=true;
    try{
      await setBarVote(barId,nextVote);
    }catch(error){
      console.error(error);
      alert("The shared vote could not be saved. Check the connection and try again.");
      button.disabled=false;
    }
  }));

  const note=document.querySelector(".bar-vote-note");
  if(note){
    note.innerHTML=`<span class="firebase-status ${voteConnectionState==="Live"?"live":""}">${voteConnectionState==="Live"?"● Live shared voting":"○ "+voteConnectionState}</span> ${esc(t.walkableBars.voteNote)}`;
  }
}

renderBars();
ensureAnonymousUser().then(()=>subscribeToBarVotes(data=>{sharedVotes=data;voteConnectionState="Live";renderBars()},()=>{voteConnectionState="Connection problem";renderBars()})).catch(error=>{console.error(error);voteConnectionState="Firebase setup needed";renderBars()});$("#weather-placeholder-list").innerHTML=t.weatherPlaceholder.map(d=>`<div class="weather-row"><div><strong>${esc(d.day)}</strong><span>${esc(d.date)}</span></div><div>${esc(d.low)}</div><div>${esc(d.high)}</div><div>${esc(d.rain)}</div></div>`).join("");
const now=new Date();
const tz=t.rightNow.timeZone;
const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
$("#sf-clock").textContent=new Intl.DateTimeFormat("en-US",{timeZone:tz,weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(now);
const today=t.rightNow.days.find(d=>d.date===dateParts);
const tripStart=new Date(`${t.rightNow.tripStart}T12:00:00`);
const tripEnd=new Date(`${t.rightNow.tripEnd}T23:59:59`);
let rightNowHtml="";
if(now<tripStart){
  const days=Math.ceil((tripStart-now)/86400000);
  rightNowHtml=`<span class="status status-current">Pre-trip</span><h3>${days} day${days===1?"":"s"} until San Francisco</h3><p><strong>${esc(t.rightNow.preTrip.title)}:</strong> ${esc(t.rightNow.preTrip.text)}</p>`;
}else if(now>tripEnd){
  rightNowHtml=`<span class="status status-selected">✓ Complete</span><h3>${esc(t.rightNow.tripComplete.title)}</h3><p>${esc(t.rightNow.tripComplete.text)}</p>`;
}else if(today){
  const currentMinutes=Number(new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(now).replace(":",""));
  const next=today.events.find(e=>Number(e.time.replace(":",""))>=currentMinutes)||today.events[today.events.length-1];
  rightNowHtml=`<span class="status status-selected">✓ ${esc(today.label)}</span><h3>Next up: ${esc(next.title)}</h3><p>${esc(next.detail)}</p><div class="right-now-time">${esc(next.time)}</div>`;
}
$("#right-now-card").innerHTML=rightNowHtml;
const photo=t.photoHub;
const viewReady=Boolean(photo.viewUrl),uploadReady=Boolean(photo.uploadUrl);
$("#photo-hub").innerHTML=`<div class="photo-intro"><div class="photo-symbol">📸</div><div><h3>${esc(photo.title)}</h3><p>${esc(photo.summary)}</p></div></div>
<div class="photo-actions">
<a class="photo-button ${viewReady?"":"disabled"}" ${viewReady?`href="${photo.viewUrl}" target="_blank" rel="noopener"`:'aria-disabled="true"'}><span>See Everyone’s Pictures</span><small>${viewReady?"Open the shared album":"Link coming soon"}</small></a>
<a class="photo-button ${uploadReady?"":"disabled"}" ${uploadReady?`href="${photo.uploadUrl}" target="_blank" rel="noopener"`:'aria-disabled="true"'}><span>Upload My Pictures</span><small>${uploadReady?"Add pictures from your phone":"Link coming soon"}</small></a>
</div>
<ol class="photo-steps">${photo.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
<p class="photo-note">${esc(photo.note)}</p>`;$("#arrival-list").innerHTML=t.arrivals.map((a,i)=>`<article class="arrival-card"><div class="arrival-time">${esc(a.arrival)}</div><div><span class="status ${i<3?"status-selected":"status-current"}">${i<3?"✓ Confirmed":"Meet at hotel"}</span><h3>${esc(a.traveler)}</h3><p class="muted">${esc(a.origin)} → ${esc(a.airport)}</p><p><strong>${esc(a.airline)}</strong>${a.flight.includes("TBD")?"":` · ${esc(a.flight)}`}</p><p>${esc(a.meetup)}</p></div></article>`).join("");
$("#arrival-summary").innerHTML=`<p class="eyebrow">Coordination note</p><h3>${esc(t.arrivalSummary.title)}</h3><p>${esc(t.arrivalSummary.text)}</p>`;$("#responsibility-list").innerHTML=t.responsibilities.map(r=>`<article class="responsibility-card"><div><span class="status ${["Selected","Reserved","Booked"].includes(r.status)?"status-selected":r.status==="Not started"?"status-not-started":"status-current"}">${["Selected","Reserved","Booked"].includes(r.status)?"✓ ":""}${esc(r.status)}</span><h3>${esc(r.task)}</h3><p class="muted">${esc(r.detail)}</p></div><div class="owner">${esc(r.owner)}</div></article>`).join("");
$("#activity-list").innerHTML=t.activities.map((a,i)=>`<article class="accommodation-card activity-card ${a.status==="Booked"?"reserved":""}">${i===0?`<img class="card-photo" src="${t.images.alcatraz.url}" alt="${esc(t.images.alcatraz.alt)}" loading="lazy">`:`<img class="card-photo" src="${t.images.cablecar.url}" alt="${esc(t.images.cablecar.alt)}" loading="lazy">`}<span class="status status-selected">${a.status==="Booked"?"✓ ":""}${a.status==="Reserved"?"✓ ":""}${esc(a.status)}</span><h3>${esc(a.name)}</h3><p class="muted">Owner: ${esc(a.owner)}</p><div class="activity-meta"><span><strong>Date</strong>${esc(a.date)}</span><span><strong>Duration</strong>${esc(a.duration)}</span></div><p>${esc(a.summary)}</p>${a.website?`<a class="pill" href="${a.website}" target="_blank" rel="noopener">Open booking page</a>`:""}<span class="pill">Source: ${esc(a.source)}</span></article>`).join("");$("#phase-list").innerHTML=t.phases.map(x=>`<article class="phase-card ${x.status==="current"?"current":""}"><span class="status status-${x.status}">${statusLabel(x.status)}</span><h3>${esc(x.label)}</h3><p class="muted">${esc(x.summary)}</p></article>`).join("");$("#accommodation-list").innerHTML=t.accommodations.map(a=>`<article class="accommodation-card ${a.status==="Reserved"?"reserved":""}"><span class="status ${a.status==="Reserved"?"status-selected":"status-current"}">${a.status==="Booked"?"✓ ":""}${esc(a.status)}</span><h3>${esc(a.name)}</h3><p class="muted">${esc(a.type)} · ${esc(a.neighborhood)}</p><div class="price">${money(a.perPerson)}<span class="muted" style="font-size:.85rem"> / person</span></div><p><strong>Total:</strong> ${money(a.total)}</p><p><strong>Sleeping:</strong> ${esc(a.sleeping)}</p><p><strong>Cancellation:</strong> ${esc(a.cancellation)}</p><h4>Pros</h4><ul class="detail-list">${a.pros.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h4>Tradeoffs</h4><ul class="detail-list">${a.cons.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${a.website?`<a class="pill" href="${a.website}" target="_blank">Open listing</a>`:""}<span class="pill">Source: ${esc(a.source)}</span></article>`).join("");$("#comparison-table").innerHTML=`<thead><tr><th>Factor</th>${t.accommodations.map(a=>`<th>${esc(a.name)}</th>`).join("")}</tr></thead><tbody><tr><td>Per person</td>${t.accommodations.map(a=>`<td>${money(a.perPerson)}</td>`).join("")}</tr><tr><td>Total</td>${t.accommodations.map(a=>`<td>${money(a.total)}</td>`).join("")}</tr><tr><td>Location</td>${t.accommodations.map(a=>`<td>${esc(a.neighborhood)}</td>`).join("")}</tr><tr><td>Gathering space</td>${t.accommodations.map(a=>`<td>${esc(a.gathering)}</td>`).join("")}</tr><tr><td>Cancellation</td>${t.accommodations.map(a=>`<td>${esc(a.cancellation)}</td>`).join("")}</tr></tbody>`;$("#recommendation-card").innerHTML=`<p class="eyebrow">Current recommendation</p><h3>${esc(t.recommendation.title)}</h3><p>${esc(t.recommendation.reason)}</p>`;const saved=JSON.parse(localStorage.getItem("mens-trip-questions")||"{}");$("#question-list").innerHTML=t.questions.map((q,i)=>`<li><label><input type="checkbox" data-q="${i}" ${saved[i]?"checked":""}>${esc(q)}</label></li>`).join("");document.querySelectorAll("[data-q]").forEach(b=>b.onchange=()=>{saved[b.dataset.q]=b.checked;localStorage.setItem("mens-trip-questions",JSON.stringify(saved))});$("#note-list").innerHTML=t.notes.map(n=>`<article class="timeline-item"><div><strong>${esc(n.date)}</strong><div class="muted">${esc(n.author)}</div></div><div>${esc(n.text)}</div></article>`).join("");const note=$("#private-note");note.value=localStorage.getItem("mens-trip-note")||"";$("#save-note").onclick=()=>{localStorage.setItem("mens-trip-note",note.value);$("#save-status").textContent="Saved";setTimeout(()=>$("#save-status").textContent="",1200)};$("#theme-toggle").onclick=()=>{const l=document.body.classList.toggle("light");$("#theme-toggle").textContent=l?"Dark mode":"Light mode";localStorage.setItem("mens-trip-theme",l?"light":"dark")};if(localStorage.getItem("mens-trip-theme")==="light"){document.body.classList.add("light");$("#theme-toggle").textContent="Dark mode"}if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js")}init().catch(e=>{console.error(e);document.body.insertAdjacentHTML("afterbegin","<div style='padding:12px;background:#8b2c2c;color:white'>Trip data could not load. Publish with GitHub Pages.</div>")});