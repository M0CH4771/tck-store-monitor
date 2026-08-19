(() => {
  "use strict";

  const KEYS={settings:"tck-store-monitor-settings-v1",cache:"tck-store-monitor-cache-v1"};
  const VERSION=7, PAGE_SIZES=[6,12,18,24], NAME_MODES=["hidden","compact","full"];
  const LIMITS={titleScale:[60,180],imageScale:[60,140],priceScale:[70,160],stockScale:[70,160],labelScale:[70,150],nameScale:[70,170]};
  const DEFAULTS={version:VERSION,endpoint:"",title:"トレカキングダム 店頭販売カード",nameMode:"hidden",showProductName:false,titleScale:100,imageScale:100,priceScale:100,stockScale:100,labelScale:100,nameScale:100,pageSize:24,slideSeconds:12,refreshMinutes:3};

  const demoRows=[
    ["ピカチュウex SAR",25800,3,21800,1,"#f2c94c","#f2994a"],
    ["リザードンex SAR",32800,2,null,0,"#eb5757","#9b111e"],
    ["ブラッキーex SAR",49800,1,42800,1,"#3b3f68","#111426"],
    ["ミュウex SAR",12800,4,null,0,"#e66dbe","#8a2f71"],
    ["リーリエのピッピex SAR",19800,2,16800,1,"#b897ff","#6a4ec2"],
    ["ゲンガーVMAX SA",148000,1,null,0,"#7f5af0","#37226d"],
    ["ナンジャモ SAR",23800,3,19800,1,"#56ccf2","#2f80ed"],
    ["ルカリオVSTAR SAR",8800,5,null,0,"#6383a8","#21344d"],
    ["ニンフィアVMAX SA",118000,1,99800,1,"#ff8fc7","#8b3e69"],
    ["ミモザ SAR",34800,2,null,0,"#f299c2","#9c4770"],
    ["ストームエメラルダ(1BOX)",19000,1,17000,10,"#f2b84b","#477c43"],
    ["アビスアイ(1BOX)",10000,2,9400,9,"#6c5bd4","#242654"],
    ["ニンジャスピナー(1BOX)",12000,3,11000,8,"#ff765f","#244e99"],
    ["ムニキスゼロ(1BOX)",11000,4,9700,7,"#ec4a8c","#376634"],
    ["MEGAドリームex(1BOX)",16000,5,14000,6,"#f2db3e","#e05530"],
    ["インフェルノX(1BOX)",25000,6,22000,5,"#ef4861","#56244f"],
    ["メガブレイブ(1BOX)",12000,7,null,0,"#ed5c35","#294ca7"],
    ["メガシンフォニア(1BOX)",11000,8,10000,4,"#f86bae","#6847b8"],
    ["ブラックボルト(1BOX)",28000,9,null,0,"#494949","#111111"],
    ["ホワイトフレア(1BOX)",null,0,23000,3,"#f3f4f5","#aeb7c5"],
    ["バトルパートナーズ(1BOX)",12000,2,11000,4,"#f0a64b","#b13f3f"],
    ["テラスタルフェスex(1BOX)",null,0,21000,1,"#69c8d1","#4e55ae"],
    ["ナイトワンダラー(1BOX)",15000,3,13000,5,"#7453a6","#26243f"],
    ["ロケット団の栄光(1BOX)",18000,4,null,0,"#b43a3a","#222222"]
  ];

  function demoImage(name,a,b){
    const t=name.replace(/[&<>"']/g,"").slice(0,6);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="838"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="838" rx="34" fill="#e8e6df"/><rect x="18" y="18" width="564" height="802" rx="25" fill="url(#g)"/><circle cx="300" cy="330" r="150" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="18"/><path d="M150 330h300" stroke="rgba(255,255,255,.7)" stroke-width="18"/><text x="300" y="620" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="52" font-weight="900">${t}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }

  const DEMO=demoRows.map((r,i)=>({row:i+2,name:r[0],normalPrice:r[1],normalPriceText:r[1]==null?"":String(r[1]),normalStock:r[2],specialPrice:r[3],specialPriceText:r[3]==null?"":String(r[3]),specialStock:r[4],imageUrl:demoImage(r[0],r[5],r[6])}));

  const $=id=>document.getElementById(id);
  const ui={grid:$("productGrid"),siteTitle:$("siteTitle"),status:$("status"),statusText:$("statusText"),loadingState:$("loadingState"),emptyState:$("emptyState"),emptyTitle:$("emptyTitle"),emptyCopy:$("emptyCopy"),previousButton:$("previousButton"),nextButton:$("nextButton"),dots:$("dots"),pageNumber:$("pageNumber"),updatedText:$("updatedText"),progress:$("progress"),pauseButton:$("pauseButton"),refreshButton:$("refreshButton"),fullscreenButton:$("fullscreenButton"),settingsButton:$("settingsButton"),settingsDialog:$("settingsDialog"),settingsForm:$("settingsForm"),endpointInput:$("endpointInput"),titleInput:$("titleInput"),nameModeInput:$("nameModeInput"),titleScaleInput:$("titleScaleInput"),titleScaleOutput:$("titleScaleOutput"),imageScaleInput:$("imageScaleInput"),imageScaleOutput:$("imageScaleOutput"),priceScaleInput:$("priceScaleInput"),priceScaleOutput:$("priceScaleOutput"),stockScaleInput:$("stockScaleInput"),stockScaleOutput:$("stockScaleOutput"),labelScaleInput:$("labelScaleInput"),labelScaleOutput:$("labelScaleOutput"),nameScaleInput:$("nameScaleInput"),nameScaleOutput:$("nameScaleOutput"),resetDisplayButton:$("resetDisplayButton"),pageSizeInput:$("pageSizeInput"),slideSecondsInput:$("slideSecondsInput"),refreshMinutesInput:$("refreshMinutesInput"),formError:$("formError"),cancelSettingsButton:$("cancelSettingsButton"),toast:$("toast"),clockTime:$("clockTime"),clockDate:$("clockDate")};
  const controls=Object.keys(LIMITS).map(key=>({key,input:ui[key+"Input"],output:ui[key+"Output"]}));

  function sanitize(v){
    const r={...DEFAULTS,...v};
    r.version=VERSION;r.endpoint=String(r.endpoint||"").trim();r.title=String(r.title||DEFAULTS.title).trim().slice(0,48)||DEFAULTS.title;
    r.nameMode=NAME_MODES.includes(r.nameMode)?r.nameMode:(r.showProductName===true?"full":"hidden");r.showProductName=r.nameMode!=="hidden";
    r.pageSize=PAGE_SIZES.includes(Number(r.pageSize))?Number(r.pageSize):24;
    r.slideSeconds=[5,8,12,15,20].includes(Number(r.slideSeconds))?Number(r.slideSeconds):12;
    r.refreshMinutes=[1,3,5,10].includes(Number(r.refreshMinutes))?Number(r.refreshMinutes):3;
    for(const [k,[min,max]] of Object.entries(LIMITS)){const n=Number(r[k]);r[k]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):100;}
    return r;
  }
  function loadSettings(){try{return sanitize(JSON.parse(localStorage.getItem(KEYS.settings)||"{}"));}catch{return {...DEFAULTS};}}
  function saveSettings(){try{localStorage.setItem(KEYS.settings,JSON.stringify(state.settings));}catch{}}

  const state={settings:loadSettings(),products:[],currentPage:0,paused:false,loading:false,demo:new URLSearchParams(location.search).get("demo")==="1",lastSuccessAt:null,slideStartedAt:performance.now(),slideTimer:0,refreshTimer:0,progressTimer:0,pointerTimer:0,toastTimer:0,requestToken:0};

  function toNumber(v){if(typeof v==="number")return Number.isFinite(v)?v:0;const n=Number(String(v??"").replace(/[０-９．－]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/[,，\s¥￥円]/g,""));return Number.isFinite(n)?n:0;}
  function finite(v){if(v===""||v==null)return null;if(typeof v==="number")return Number.isFinite(v)?v:null;const s=String(v).replace(/[０-９．－]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/[,，\s¥￥円]/g,"");const n=Number(s);return s&&Number.isFinite(n)?n:null;}
  function normalizeImage(url){if(!url)return "";for(const p of [/drive\.google\.com\/file\/d\/([\w-]+)/,/drive\.google\.com\/open\?id=([\w-]+)/,/drive\.google\.com\/uc\?(?:[^#]*&)?id=([\w-]+)/,/[?&]id=([\w-]+)/]){const m=url.match(p);if(m)return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;}return url;}
  function normalize(items){return items.map((x,i)=>({row:Number(x.row)||i+2,name:String(x.name||"").trim(),imageUrl:normalizeImage(String(x.imageUrl||"").trim()),normalPrice:finite(x.normalPrice),normalPriceText:String(x.normalPriceText??x.normalPrice??"").trim(),normalStock:Math.max(0,toNumber(x.normalStock)),specialPrice:finite(x.specialPrice),specialPriceText:String(x.specialPriceText??x.specialPrice??"").trim(),specialStock:Math.max(0,toNumber(x.specialStock))})).filter(x=>x.name&&(x.normalStock>=1||x.specialStock>=1));}
  function formatPrice(v,text){if(Number.isFinite(v))return `¥${Math.round(v).toLocaleString("ja-JP")}`;const s=String(text||"").trim();if(!s)return "価格確認中";const n=toNumber(s);return n>0&&/^[¥￥]?[\d０-９,，]+(?:円)?$/.test(s)?`¥${Math.round(n).toLocaleString("ja-JP")}`:s;}
  const formatStock=v=>Number.isInteger(v)?String(v):String(Math.floor(v*100)/100);

  function applyDisplay(s){const r=document.documentElement;r.style.setProperty("--title-font-size",`calc(clamp(32px,2.55vw,50px) * ${s.titleScale/100})`);for(const k of ["image","price","stock","label","name"])r.style.setProperty(`--${k}-scale`,String(s[k+"Scale"]/100));}
  function syncForm(s=state.settings){ui.endpointInput.value=s.endpoint;ui.titleInput.value=s.title;ui.nameModeInput.value=s.nameMode;ui.pageSizeInput.value=String(s.pageSize);ui.slideSecondsInput.value=String(s.slideSeconds);ui.refreshMinutesInput.value=String(s.refreshMinutes);for(const c of controls){c.input.value=String(s[c.key]);c.output.textContent=`${s[c.key]}%`;}}
  function readForm(){const s={...state.settings,endpoint:ui.endpointInput.value.trim(),title:ui.titleInput.value.trim(),nameMode:ui.nameModeInput.value,pageSize:Number(ui.pageSizeInput.value),slideSeconds:Number(ui.slideSecondsInput.value),refreshMinutes:Number(ui.refreshMinutesInput.value)};for(const c of controls)s[c.key]=Number(c.input.value);return sanitize(s);}
  function validEndpoint(e){try{const u=new URL(e);return u.protocol==="https:"&&/script\.google\.com$/i.test(u.hostname)&&/\/exec\/?$/i.test(u.pathname);}catch{return false;}}

  function setStatus(text,type){ui.statusText.textContent=text;ui.status.className=`status is-${type}`;}
  function showLoading(v){ui.loadingState.classList.toggle("is-visible",v);if(v)hideEmpty();}
  function showEmpty(title,copy){ui.emptyTitle.textContent=title;ui.emptyCopy.textContent=copy;ui.emptyState.classList.add("is-visible");showLoading(false);}
  function hideEmpty(){ui.emptyState.classList.remove("is-visible");}
  function updateUpdated(cached=false){if(!state.lastSuccessAt||Number.isNaN(state.lastSuccessAt.getTime())){ui.updatedText.textContent=cached?"保存データ":"未更新";return;}const t=new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit"}).format(state.lastSuccessAt);ui.updatedText.textContent=`${cached?"保存時 ":"更新 "}${t}`;}
  function toast(msg){clearTimeout(state.toastTimer);ui.toast.textContent=msg;ui.toast.classList.add("is-visible");state.toastTimer=setTimeout(()=>ui.toast.classList.remove("is-visible"),2400);}

  function loadCache(){try{const p=JSON.parse(localStorage.getItem(KEYS.cache)||"null");if(p?.ok===true&&Array.isArray(p.items)){state.products=normalize(p.items);state.lastSuccessAt=p.updatedAt?new Date(p.updatedAt):null;render();setStatus("保存データを表示中","live");updateUpdated(true);return true;}}catch{}return false;}
  function saveCache(p){try{localStorage.setItem(KEYS.cache,JSON.stringify(p));}catch{}}
  function jsonp(endpoint){return new Promise((resolve,reject)=>{const cb=`__tck_${Date.now()}_${Math.random().toString(36).slice(2)}`,script=document.createElement("script"),sep=endpoint.includes("?")?"&":"?";let done=false;const cleanup=()=>{delete window[cb];script.remove();};const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error("Apps Scriptからの応答がありません"));},16000);window[cb]=p=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(p);};script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(new Error("Apps Scriptへ接続できません"));};script.src=`${endpoint}${sep}callback=${encodeURIComponent(cb)}&_=${Date.now()}`;script.async=true;document.head.appendChild(script);});}

  async function refresh({manual=false}={}){
    if(state.loading)return;
    if(state.demo){state.products=DEMO;state.lastSuccessAt=new Date();render();setStatus("デモ表示中","live");updateUpdated();if(manual)toast("デモデータを再表示しました");return;}
    if(!validEndpoint(state.settings.endpoint)){setStatus("初期設定が必要です","error");showLoading(false);if(!ui.settingsDialog.open)openSettings(true);return;}
    state.loading=true;const token=++state.requestToken;setStatus("在庫を更新中","loading");if(!state.products.length)showLoading(true);
    try{const p=await jsonp(state.settings.endpoint);if(token!==state.requestToken)return;if(!p||p.ok!==true||!Array.isArray(p.items))throw new Error(p?.error||"商品データの形式が正しくありません");state.products=normalize(p.items);state.currentPage=Math.min(state.currentPage,Math.max(0,pageCount()-1));state.lastSuccessAt=p.updatedAt?new Date(p.updatedAt):new Date();saveCache(p);render();setStatus(`${state.products.length}商品を表示中`,`live`);updateUpdated();if(manual)toast("最新の在庫へ更新しました");}
    catch(e){console.error(e);showLoading(false);setStatus("更新に失敗しました","error");updateUpdated(true);if(!state.products.length&&!loadCache())showEmpty("データを取得できませんでした",`${e.message||"接続設定を確認してください。"} 設定画面からApps Script URLを確認できます。`);if(manual)toast(e.message||"更新に失敗しました");}
    finally{state.loading=false;}
  }

  function perPage(){const n=state.settings.pageSize;if(innerWidth<760)return Math.min(n,4);if(innerWidth<1180)return Math.min(n,8);return n;}
  function pageCount(){return Math.ceil(state.products.length/perPage());}
  function layout(count){if(innerWidth<760)return{columns:2,rows:Math.max(1,Math.ceil(count/2))};if(innerWidth<1180)return{columns:4,rows:Math.max(1,Math.ceil(count/4))};const columns=Math.min(6,Math.max(1,count));return{columns,rows:Math.max(1,Math.ceil(count/columns))};}

  function priceBox(label,value,text,count,special){const box=document.createElement("div");box.className=`price-box${special?" special":""}`;const l=document.createElement("span");l.className="price-label";l.textContent=label;const p=document.createElement("div");p.className="price";p.textContent=formatPrice(value,text);if(p.textContent.length>=8)p.classList.add("is-long");const stock=document.createElement("div");if(Number(count)===1){stock.className="stock is-last-one";stock.textContent="残り1点";}else{stock.className="stock";const a=document.createElement("span");a.className="stock-label";a.textContent="在庫";const b=document.createElement("strong");b.className="stock-count";b.textContent=`${formatStock(count)}点`;stock.append(a,b);}box.append(l,p,stock);return box;}

  function card(product,index){const normal=product.normalStock>=1,special=product.specialStock>=1,count=Number(normal)+Number(special),el=document.createElement("article");el.className=`card${special?" has-special":""}${count===1?" is-single-price":""}`;el.style.animationDelay=`${Math.min(index*18,160)}ms`;const visual=document.createElement("div");visual.className="visual";const wrap=document.createElement("div");wrap.className=`image-wrap${product.imageUrl?"":" is-error"}`;const img=document.createElement("img");img.className="card-image";img.alt=product.name;img.decoding="async";img.loading="eager";if(product.imageUrl)img.src=product.imageUrl;img.addEventListener("error",()=>wrap.classList.add("is-error"),{once:true});const fallback=document.createElement("div");fallback.className="image-fallback";fallback.textContent="NO IMAGE";wrap.append(img,fallback);const name=document.createElement("h2");name.className="card-name";name.textContent=product.name;visual.append(wrap,name);const prices=document.createElement("div");prices.className="price-area";if(normal)prices.append(priceBox("通常価格",product.normalPrice,product.normalPriceText,product.normalStock,false));if(special)prices.append(priceBox("状態特価",product.specialPrice,product.specialPriceText,product.specialStock,true));el.append(visual,prices);return el;}

  function renderPagination(){const pages=pageCount();ui.dots.replaceChildren();if(pages>1&&pages<=16){const f=document.createDocumentFragment();for(let i=0;i<pages;i++){const b=document.createElement("button");b.className=`dot${i===state.currentPage?" is-current":""}`;b.type="button";b.setAttribute("aria-label",`${i+1}ページ目を表示`);b.onclick=()=>go(i);f.append(b);}ui.dots.append(f);}ui.pageNumber.textContent=pages?`${state.currentPage+1} / ${pages}`:"0 / 0";ui.previousButton.hidden=pages<=1;ui.nextButton.hidden=pages<=1;}
  function render(){applyDisplay(state.settings);ui.siteTitle.textContent=state.settings.title;document.title=`${state.settings.title}｜店頭モニター`;ui.grid.classList.remove("name-hidden","name-compact","name-full");ui.grid.classList.add(`name-${state.settings.nameMode}`);showLoading(false);ui.grid.replaceChildren();if(!state.products.length){document.documentElement.style.setProperty("--columns","2");document.documentElement.style.setProperty("--rows","2");showEmpty("現在表示できる商品がありません","通常在庫または特価在庫が1以上の商品が登録されると自動で表示されます。");renderPagination();resetSlide();return;}hideEmpty();const n=perPage();state.currentPage=Math.min(state.currentPage,Math.max(0,pageCount()-1));const visible=state.products.slice(state.currentPage*n,state.currentPage*n+n),l=layout(visible.length);document.documentElement.style.setProperty("--columns",String(l.columns));document.documentElement.style.setProperty("--rows",String(l.rows));const f=document.createDocumentFragment();visible.forEach((p,i)=>f.append(card(p,i)));ui.grid.append(f);renderPagination();resetSlide();}

  function go(i){const pages=pageCount();if(!pages)return;state.currentPage=((i%pages)+pages)%pages;render();}
  const next=()=>pageCount()>1?go(state.currentPage+1):resetSlide();
  const prev=()=>pageCount()>1?go(state.currentPage-1):resetSlide();
  function resetSlide(){state.slideStartedAt=performance.now();ui.progress.style.width="0%";}
  function paused(v){state.paused=v;ui.pauseButton.textContent=v?"▶":"Ⅱ";ui.pauseButton.setAttribute("aria-label",v?"自動切替を再開":"自動切替を停止");resetSlide();toast(v?"自動ページ切替を停止しました":"自動ページ切替を再開しました");}
  function timers(){clearInterval(state.slideTimer);clearInterval(state.refreshTimer);clearInterval(state.progressTimer);state.slideTimer=setInterval(()=>{if(!state.paused&&!document.hidden&&pageCount()>1&&performance.now()-state.slideStartedAt>=state.settings.slideSeconds*1000)next();},250);state.refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},state.settings.refreshMinutes*60000);state.progressTimer=setInterval(()=>{if(state.paused||pageCount()<=1){ui.progress.style.width="0%";return;}ui.progress.style.width=`${Math.min(100,(performance.now()-state.slideStartedAt)/(state.settings.slideSeconds*10))}%`;},100);}

  function preview(){const s=readForm();applyDisplay(s);ui.siteTitle.textContent=s.title;ui.grid.classList.remove("name-hidden","name-compact","name-full");ui.grid.classList.add(`name-${s.nameMode}`);}
  function openSettings(required=false){syncForm();ui.formError.textContent="";ui.formError.classList.remove("is-visible");ui.cancelSettingsButton.hidden=required;if(!ui.settingsDialog.open)ui.settingsDialog.showModal();}
  function closeSettings(){if(ui.settingsDialog.open)ui.settingsDialog.close();}
  async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast("全画面表示を切り替えられませんでした");}}
  function clock(){const now=new Date();ui.clockTime.textContent=new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",hour12:false}).format(now);ui.clockDate.textContent=new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).format(now);}
  function pointer(){document.body.classList.add("has-pointer");clearTimeout(state.pointerTimer);state.pointerTimer=setTimeout(()=>document.body.classList.remove("has-pointer"),2200);}

  ui.previousButton.onclick=prev;ui.nextButton.onclick=next;ui.pauseButton.onclick=()=>paused(!state.paused);ui.refreshButton.onclick=()=>refresh({manual:true});ui.fullscreenButton.onclick=fullscreen;ui.settingsButton.onclick=()=>openSettings(false);
  ui.cancelSettingsButton.onclick=()=>{syncForm();applyDisplay(state.settings);render();closeSettings();};
  for(const c of controls)c.input.addEventListener("input",()=>{c.output.textContent=`${c.input.value}%`;preview();});
  ui.titleInput.addEventListener("input",preview);ui.nameModeInput.addEventListener("change",preview);
  ui.resetDisplayButton.onclick=()=>{for(const c of controls){c.input.value=String(DEFAULTS[c.key]);c.output.textContent=`${DEFAULTS[c.key]}%`;}preview();};
  ui.settingsForm.addEventListener("submit",e=>{e.preventDefault();const s=readForm();if(!state.demo&&!validEndpoint(s.endpoint)){ui.formError.textContent="Apps Scriptの「/exec」で終わるウェブアプリURLを入力してください。";ui.formError.classList.add("is-visible");return;}state.settings=s;saveSettings();state.currentPage=0;ui.formError.classList.remove("is-visible");closeSettings();render();timers();refresh({manual:true});});
  document.addEventListener("mousemove",pointer,{passive:true});document.addEventListener("pointerdown",pointer,{passive:true});
  document.addEventListener("keydown",e=>{if(ui.settingsDialog.open&&e.key!=="Escape")return;if(e.key==="ArrowLeft")prev();else if(e.key==="ArrowRight")next();else if(e.key===" "||e.key.toLowerCase()==="p"){e.preventDefault();paused(!state.paused);}else if(e.key.toLowerCase()==="r")refresh({manual:true});else if(e.key.toLowerCase()==="f")fullscreen();else if(e.key.toLowerCase()==="s")openSettings(false);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){clock();refresh();resetSlide();}});window.addEventListener("resize",render);setInterval(clock,1000);

  clock();applyDisplay(state.settings);render();timers();
  if(state.demo)refresh();else if(validEndpoint(state.settings.endpoint)){loadCache();refresh();}else{showLoading(false);setStatus("初期設定が必要です","error");openSettings(true);}
})();
