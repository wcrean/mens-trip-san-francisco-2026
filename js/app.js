import { ensureAnonymousUser, setBarVote, subscribeToBarVotes } from "./firebase.js";

const $ = s => document.querySelector(s);
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);

async function loadTrip(){
  const response = await fetch("./data/trip.json",{cache:"no-store"});
  if(!response.ok) throw new Error("Trip data failed");
  return response.json();
}



const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&forecast_days=10";

function weatherLabel(code){
  if(code===0) return ["☀️","Clear"];
  if(code===1) return ["🌤️","Mainly clear"];
  if(code===2) return ["⛅","Partly cloudy"];
  if(code===3) return ["☁️","Overcast"];
  if(code===45 || code===48) return ["🌫️","Fog"];
  if(code>=51 && code<=57) return ["🌦️","Drizzle"];
  if(code>=61 && code<=67) return ["🌧️","Rain"];
  if(code>=71 && code<=77) return ["🌨️","Snow"];
  if(code>=80 && code<=82) return ["🌦️","Showers"];
  if(code>=85 && code<=86) return ["🌨️","Snow showers"];
  if(code>=95 && code<=99) return ["⛈️","Thunderstorms"];
  return ["🌡️","Conditions"];
}

function formatForecastDate(iso,i){
  const d=new Date(`${iso}T12:00:00`);
  const day=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",weekday:"short"}).format(d);
  const date=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric"}).format(d);
  return {
    day:i===0?`Today · ${day}`:day,
    date
  };
}

function isTripDate(iso){
  return iso>="2026-10-21" && iso<="2026-10-25";
}

function renderTenDayForecast(daily){
  if(!daily?.time?.length) return false;

  $("#weather-placeholder-list").innerHTML=daily.time.slice(0,10).map((iso,i)=>{
    const {day,date}=formatForecastDate(iso,i);
    const low=Number.isFinite(daily.temperature_2m_min?.[i])?`${Math.round(daily.temperature_2m_min[i])}°`:"—";
    const high=Number.isFinite(daily.temperature_2m_max?.[i])?`${Math.round(daily.temperature_2m_max[i])}°`:"—";
    const rain=Number.isFinite(daily.precipitation_probability_max?.[i])?`${Math.round(daily.precipitation_probability_max[i])}%`:"—";
    const [icon,label]=weatherLabel(daily.weather_code?.[i]);
    const trip=isTripDate(iso);
    return `<div class="weather-row${trip?" weather-trip-row":""}">
      <div>
        <strong>${esc(day)}${trip?' <span class="weather-trip-badge">Men’s Trip</span>':""}</strong>
        <span>${esc(date)}</span>
        <span class="weather-condition">${icon} ${esc(label)}</span>
      </div>
      <div>${low}</div><div>${high}</div><div>${rain}</div>
    </div>`;
  }).join("");
  return true;
}

async function setupLiveWeather(t){
  try{
    const response=await fetch(WEATHER_URL,{cache:"no-store"});
    if(!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const data=await response.json();

    const current=data.current||{};
    const [icon,label]=weatherLabel(current.weather_code);
    const temp=Number.isFinite(current.temperature_2m)?`${Math.round(current.temperature_2m)}°F`:"—";
    const feels=Number.isFinite(current.apparent_temperature)?`${Math.round(current.apparent_temperature)}°`:"—";
    const wind=Number.isFinite(current.wind_speed_10m)?`${Math.round(current.wind_speed_10m)} mph`:"—";

    $("#weather-current").innerHTML=`
      <div class="weather-current-copy">
        <span class="status status-selected">● Live</span>
        <h3>San Francisco now</h3>
        <p>${icon} ${esc(label)}</p>
      </div>
      <div class="weather-current-temp">${temp}</div>
      <div class="weather-current-detail"><span>Feels like <strong>${feels}</strong></span><span>Wind <strong>${wind}</strong></span></div>`;

    const rendered=renderTenDayForecast(data.daily);
    if(!rendered) throw new Error("No daily forecast returned");

    const tripVisible=(data.daily?.time||[]).some(isTripDate);
    $("#weather-note").textContent=tripVisible
      ? "The live 10-day forecast now includes Men’s Trip dates. Trip days are highlighted."
      : "Live 10-day San Francisco forecast. As October 21–25 enters this window, the trip days will appear automatically.";
  }catch(error){
    console.warn("Live weather unavailable",error);
    $("#weather-current").innerHTML=`<div><span class="status">Weather unavailable</span><h3>San Francisco weather</h3><p>Live conditions could not be loaded right now.</p></div>`;
    $("#weather-placeholder-list").innerHTML=`<div class="weather-row"><div><strong>Forecast unavailable</strong><span>Please refresh later.</span></div><div>—</div><div>—</div><div>—</div></div>`;
    $("#weather-note").textContent="The weather service is temporarily unavailable. Refresh later to try again.";
  }
}

async function init(){
  const t = await loadTrip();
  $("#trip-name").textContent=t.name;
  $("#trip-location").textContent=t.location;
  $("#trip-dates").textContent=t.dates;
  $("#version").textContent=t.version;
  $("#tagline").textContent=t.taglines[Math.floor(Math.random()*t.taglines.length)];

  document.documentElement.style.setProperty("--hero-image",`url("${t.images.hero.url}")`);
  $("#hero-credit").textContent=`Photo: ${t.images.hero.credit}`;
  $("#hero-credit").href=t.images.hero.source;

  const now=new Date();
  const tz=t.rightNow.timeZone;
  $("#sf-clock").textContent=new Intl.DateTimeFormat("en-US",{timeZone:tz,weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(now);
  const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const reunionCutoff="2026-10-21";
  if(dateParts>reunionCutoff){
    document.querySelector("#reunion")?.remove();
    document.querySelector("#reunion-nav")?.remove();
  }
  const today=t.rightNow.days.find(d=>d.date===dateParts);
  const tripStart=new Date(`${t.rightNow.tripStart}T12:00:00`);
  const tripEnd=new Date(`${t.rightNow.tripEnd}T23:59:59`);
  let rightNowHtml="";
  if(now<tripStart){
    const days=Math.ceil((tripStart-now)/86400000);
    rightNowHtml=`<span class="status status-current">Coming up</span><h3>${days} day${days===1?"":"s"} until San Francisco</h3>`;
  }else if(now>tripEnd){
    rightNowHtml=`<span class="status status-selected">✓ Trip complete</span><h3>${esc(t.rightNow.tripComplete.title)}</h3><p>${esc(t.rightNow.tripComplete.text)}</p>`;
  }else if(today){
    const currentMinutes=Number(new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(now).replace(":",""));
    const next=today.events.find(e=>Number(e.time.replace(":",""))>=currentMinutes)||today.events[today.events.length-1];
    rightNowHtml=`<span class="status status-selected">✓ ${esc(today.label)}</span><h3>Next up: ${esc(next.title)}</h3><p>${esc(next.detail)}</p><div class="right-now-time">${esc(next.time)}</div>`;
  }
  $("#right-now-card").innerHTML=rightNowHtml;

  if($("#reunion")){
  $("#reunion-intro").innerHTML=`<div><p class="eyebrow">The opening scene</p><h3>${esc(t.reunion.title)}</h3><p>${esc(t.reunion.summary)}</p></div><div class="big-date">WED<br><strong>21</strong></div>`;
  $("#arrival-list").innerHTML=t.arrivals.map((a,i)=>`<article class="arrival-card">
    <div class="arrival-time">${esc(a.arrival)}</div>
    <div><span class="status ${i<3?"status-selected":"status-current"}">${i<3?"✓ Confirmed":"Meet at hotel"}</span>
    <h3>${esc(a.traveler)}</h3><p class="muted">${esc(a.origin)} → ${esc(a.airport)}</p>
    <p><strong>${esc(a.airline)}</strong>${a.flight.includes("TBD")?"":` · ${esc(a.flight)}`}</p><p>${esc(a.meetup)}</p></div>
  </article>`).join("");
  }

  $("#adventure-list").innerHTML=t.adventures.map(a=>`<article class="adventure-card">
    <img src="${a.image}" alt="${esc(a.imageAlt)}" loading="lazy">
    <div class="adventure-body">
      <div class="adventure-date"><span>${esc(a.day)}</span><strong>${esc(a.date)}</strong></div>
      <p class="eyebrow">${esc(a.title)}</p><h3>${esc(a.name)}</h3><p>${esc(a.summary)}</p>
      <div class="moment-list">${a.moments.map(m=>`<span>${esc(m)}</span>`).join("")}</div>
      <a class="primary-link" href="${a.website}" target="_blank" rel="noopener">${esc(a.button)}</a>
    </div>
  </article>`).join("");

  $("#tour-highlight-list").innerHTML=t.tourHighlights.map(v=>`<article class="visual-card">
    <img src="${v.image}" alt="${esc(v.alt)}" loading="lazy">
    <div class="visual-overlay"><h3>${esc(v.name)}</h3><span>${esc(v.text)}</span></div>
  </article>`).join("");

  $("#hotel-card").innerHTML=`<div class="hotel-copy"><span class="status status-selected">✓ Our home base</span>
    <p class="eyebrow">225 Powell Street</p><h3>${esc(t.hotel.name)}</h3><p>${esc(t.hotel.summary)}</p>
    <div class="hotel-highlights">${t.hotel.highlights.map(h=>`<span>✓ ${esc(h)}</span>`).join("")}</div>
    <div class="bar-links"><a class="primary-link" href="${t.hotel.website}" target="_blank" rel="noopener">Hotel website</a><a class="pill" href="${t.hotel.maps}" target="_blank" rel="noopener">Open map</a></div>
  </div><div class="hotel-neighborhood"><div class="neighborhood-icon">🚋</div><h3>Union Square outside the door</h3><p>Cable cars, Chinatown, downtown landmarks, restaurants, and the bar leaderboard are all part of the immediate neighborhood.</p></div>`;

  $("#restaurant-list").innerHTML=t.restaurants.map(r=>`<article class="restaurant-card">
    <div class="restaurant-top"><span class="restaurant-category">${esc(r.category)}</span><span class="bar-walk">${esc(r.walk)}</span></div>
    <h3>${esc(r.name)}</h3><p>${esc(r.summary)}</p>
    <div class="bar-links"><a class="pill" href="${r.website}" target="_blank" rel="noopener">Website</a><a class="pill" href="${r.maps}" target="_blank" rel="noopener">Map</a></div>
  </article>`).join("");

  const allBars=[...t.walkableBars.initial,...t.walkableBars.bench];
  let sharedVotes={totals:{},mine:{}};
  let voteConnectionState="Connecting…";

  function rankedBars(){
    return [...allBars].sort((a,b)=>{
      const av=sharedVotes.totals[a.id]||{up:0,down:0};
      const bv=sharedVotes.totals[b.id]||{up:0,down:0};
      return (bv.up-bv.down)-(av.up-av.down) || bv.up-av.up || av.down-bv.down || a.name.localeCompare(b.name);
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
          <div class="bar-photo-shade"></div>
          <span class="bar-rank">#${index+1}</span>
          <div class="bar-photo-title"><span class="bar-type-icon" aria-hidden="true">${esc(b.icon||"🍻")}</span><div><span>${esc(b.category)}</span><h3>${esc(b.name)}</h3></div></div>
          <a class="bar-photo-credit" href="${b.imageSource}" target="_blank" rel="noopener">Photo source</a>
        </div>
        <div class="bar-card-body">
          <div class="bar-meta-row"><span class="bar-walk">📍 ${esc(b.walk)}</span><div class="bar-score"><strong>${score>0?"+":""}${score}</strong><span>group score</span></div></div>
          <p>${esc(b.summary)}</p>
          <div class="bar-links"><a class="pill" href="${b.website}" target="_blank" rel="noopener">Website</a><a class="pill" href="${b.maps}" target="_blank" rel="noopener">Map</a></div>
          <div class="vote-row">
            <button class="vote-button vote-up ${mine==="up"?"selected":""}" data-bar="${b.id}" data-vote="up" ${voteConnectionState!=="Live"?"disabled":""}>👍 I’m In <span>${votes.up}</span></button>
            <button class="vote-button vote-down ${mine==="down"?"selected":""}" data-bar="${b.id}" data-vote="down" ${voteConnectionState!=="Live"?"disabled":""}>👎 Pass <span>${votes.down}</span></button>
          </div>
        </div>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-vote]").forEach(button=>button.addEventListener("click",async()=>{
      const barId=button.dataset.bar, requested=button.dataset.vote;
      button.disabled=true;
      try{ await setBarVote(barId,sharedVotes.mine[barId]===requested?null:requested); }
      catch(error){ console.error(error); alert("The shared vote could not be saved. Check the connection and try again."); button.disabled=false; }
    }));
    const note=document.querySelector(".bar-vote-note");
    note.innerHTML=`<span class="firebase-status ${voteConnectionState==="Live"?"live":""}">${voteConnectionState==="Live"?"● Live shared voting":"○ "+voteConnectionState}</span> ${esc(t.walkableBars.voteNote)}`;
  }
  renderBars();
  ensureAnonymousUser().then(()=>subscribeToBarVotes(data=>{sharedVotes=data;voteConnectionState="Live";renderBars()},()=>{voteConnectionState="Connection problem";renderBars()})).catch(error=>{console.error(error);voteConnectionState="Firebase setup needed";renderBars()});

  const photo=t.photoHub, viewReady=Boolean(photo.viewUrl), uploadReady=Boolean(photo.uploadUrl);
  $("#photo-hub").innerHTML=`<div class="photo-intro"><div class="photo-symbol">📸</div><div><h3>${esc(photo.title)}</h3><p>${esc(photo.summary)}</p></div></div>
  <div class="photo-actions">
    <a class="photo-button ${viewReady?"":"disabled"}" ${viewReady?`href="${photo.viewUrl}" target="_blank" rel="noopener"`:'aria-disabled="true"'}><span>See Everyone’s Pictures</span><small>${viewReady?"Open the shared album":"Link coming soon"}</small></a>
    <a class="photo-button ${uploadReady?"":"disabled"}" ${uploadReady?`href="${photo.uploadUrl}" target="_blank" rel="noopener"`:'aria-disabled="true"'}><span>Upload My Pictures</span><small>${uploadReady?"Add pictures from your phone":"Link coming soon"}</small></a>
  </div><p class="photo-note">${esc(photo.note)}</p>`;

  setupLiveWeather(t);

  const rows=[
    ["Status",...t.accommodations.map(a=>a.status)],
    ["Type",...t.accommodations.map(a=>a.type)],
    ["Neighborhood",...t.accommodations.map(a=>a.neighborhood)],
    ["Total",...t.accommodations.map(a=>money(a.total))],
    ["Per person",...t.accommodations.map(a=>money(a.perPerson))],
    ["Sleeping",...t.accommodations.map(a=>a.sleeping)],
    ["Gathering",...t.accommodations.map(a=>a.gathering)],
    ["Cancellation",...t.accommodations.map(a=>a.cancellation)]
  ];
  $("#comparison-table").innerHTML=`<thead><tr><th>Consideration</th>${t.accommodations.map(a=>`<th>${esc(a.name)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>i===0?`<th>${esc(cell)}</th>`:`<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;

  $("#photo-credit-list").innerHTML=t.photoCredits.map(i=>`<a class="photo-credit" href="${i.source}" target="_blank" rel="noopener"><strong>${esc(i.credit)}</strong><span>${esc(i.alt)}</span></a>`).join("");

  setupTheme();
  setupInstall();
}

function setupTheme(){
  const button=$("#theme-toggle");
  const stored=localStorage.getItem("trip-theme");
  if(stored==="light") document.documentElement.dataset.theme="light";
  const update=()=>button.textContent=document.documentElement.dataset.theme==="light"?"Dark mode":"Light mode";
  update();
  button.addEventListener("click",()=>{
    document.documentElement.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light";
    localStorage.setItem("trip-theme",document.documentElement.dataset.theme);
    update();
  });
}

function setupInstall(){
  let deferred;
  const button=$("#install-button");
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferred=event;button.hidden=false;});
  button.addEventListener("click",async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;button.hidden=true;});
}

init().catch(error=>{
  console.error(error);
  document.body.insertAdjacentHTML("afterbegin",`<div class="fatal-error">The trip app could not load. Please refresh.</div>`);
});
