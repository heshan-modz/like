(function setupAntiInspect() {
 document.addEventListener('contextmenu', e => e.preventDefault(), true);
 document.addEventListener('keydown', e => {
 const ctrl = e.ctrlKey || e.metaKey;
 const shift = e.shiftKey;
 const k = e.key.toLowerCase();
 if (e.key === 'F12' || (ctrl && shift && ['i','j','c'].includes(k)) || (ctrl && ['u','s'].includes(k))) {
 e.preventDefault();
 e.stopPropagation();
 return false;
 }
 }, true);

 const shield = document.getElementById('devtools-shield');
 function showShield(on) { if (!shield) return; shield.style.display = on ? 'flex' : 'none'; }

 let lastState = false;
 setInterval(() => {
 const gapW = Math.abs(window.outerWidth - window.innerWidth);
 const gapH = Math.abs(window.outerHeight - window.innerHeight);
 const isOpen = (gapW > 160 || gapH > 160);
 if (isOpen !== lastState) { lastState = isOpen; showShield(isOpen); }
 }, 500);
})();


const themeKey = 'nova-theme';
const root = document.documentElement;
const storedTheme = localStorage.getItem(themeKey);
if (storedTheme) root.setAttribute('data-theme', storedTheme);

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
 themeToggle.addEventListener('click', () => {
 const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
 if (next === 'dark') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', 'light');
 localStorage.setItem(themeKey, next);
 });
}


const revealEls = document.querySelectorAll('[data-reveal]');
const io = new IntersectionObserver((entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
 });
}, { threshold: 0.18 });
revealEls.forEach(el => io.observe(el));


const blob = document.querySelector('.cursor-blob');
let x = 0, y = 0, tx = 0, ty = 0, raf;
function loop(){ x += (tx - x) * 0.08; y += (ty - y) * 0.08; if (blob) blob.style.transform = `translate3d(${x}px, ${y}px, 0)`; raf = requestAnimationFrame(loop); }
window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; if(!raf) loop(); });
window.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = null; });


const yEl = document.getElementById('year');
if (yEl) yEl.textContent = new Date().getFullYear();


const heroVideo = document.querySelector('.hero-video');
const videoIframe = document.getElementById('demoVideo');
const originalSrc = videoIframe ? videoIframe.getAttribute('src') : '';

function showHeroVideo(show){
 if (!heroVideo || !videoIframe) return;
 heroVideo.style.display = show ? '' : 'none';
 if (!show) {
 videoIframe.dataset.src = videoIframe.getAttribute('src') || originalSrc || '';
 videoIframe.setAttribute('src', '');
 } else if (!videoIframe.getAttribute('src')) {
 videoIframe.setAttribute('src', videoIframe.dataset.src || originalSrc || '');
 }
}

const $ = (id) => document.getElementById(id);
const tabs = { login: $('tab-login'), create: $('tab-create'), menu: $('tab-menu') };
const panels = { login: $('panel-login'), create: $('panel-create'), menu: $('panel-menu') };

function switchTo(which){
 for(const k of Object.keys(tabs)){
 const on = (k===which);
 tabs[k].setAttribute('aria-selected', String(on));
 panels[k].classList.toggle('active', on);
 panels[k].style.display = on ? 'block' : 'none';
 panels[k].setAttribute('aria-hidden', on ? 'false' : 'true');
 }

 showHeroVideo(which !== 'menu');
}

setTimeout(()=>{
 try { if (loginChart) { loginChart.resize(); } } catch(_) {}
}, 50);


if (tabs.login) tabs.login.addEventListener('click',()=>switchTo('login'));
if (tabs.create) tabs.create.addEventListener('click',()=>switchTo('create'));
if (tabs.menu) tabs.menu.addEventListener('click',()=>switchTo('menu'));

const gotoLogin = $('goto-login');
if (gotoLogin) gotoLogin.addEventListener('click',()=>switchTo('login'));


switchTo('login');


if (location.protocol === 'file:') {
 const n=$('login-status'); if(n) n.textContent='Open via http(s) — Firebase blocks file:// origins.';
}


const toastEl = $('toast');
function toast(m){ if(!toastEl) return; toastEl.textContent=m; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'), 1600); }
function setStatus(id,msg,cls=''){ const n=$(id); if(!n) return; n.textContent=msg||''; n.className=`status ${cls}`; }


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
 getAuth, setPersistence, browserLocalPersistence,
 signInWithEmailAndPassword, createUserWithEmailAndPassword,
 sendPasswordResetEmail, sendEmailVerification, onAuthStateChanged, signOut, reload
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getDatabase, ref, set, remove, get, update } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import {
 getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = (window.__FIREBASE_CONFIG || {});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const fs = getFirestore(app);
await setPersistence(auth, browserLocalPersistence);


const btnForgot = $('btn-forgot');
if (btnForgot) {
 btnForgot.addEventListener('click', async ()=>{
 const email = $('login-email').value.trim();
 if(!email) return setStatus('login-status','Enter your email to reset.','error');
 try { await sendPasswordResetEmail(auth,email); setStatus('login-status','Password reset sent.',''); }
 catch(e){ setStatus('login-status', e.message || 'Failed to send reset','error'); }
 });
}


async function requireVerified(user){
 try { await reload(user); } catch(_) {}
 if (!user.emailVerified) {
 try { await sendEmailVerification(user); } catch(_) {}
 setStatus('verify-status',"Verification email sent automatically. Please verify, then log in again.",'');
 await signOut(auth);
 return false;
 }
 return true;
}

async function ensureAllowDoc(email){
 const dref = doc(fs,"emailAccess",email);
 const snap = await getDoc(dref);
 if (!snap.exists()) {
 try { await setDoc(dref, { allow:false }); } catch(_) {}
 }
}
async function isAllowed(email){
 const s = await getDoc(doc(fs,"emailAccess",email));
 return s.exists() && s.data().allow === true;
}
async function isSuperadmin(email){
 const s = await getDoc(doc(fs,"superadmins",email));
 return s.exists() && s.data().allow === true;
}
function randomKeyHex(bytes=32){
 const a=new Uint8Array(bytes); crypto.getRandomValues(a);
 return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function getAdminKeyForUser(user){
 return (user && user.uid) ? user.uid : null;
}

async function saveAppVersion(adminKey){
 const v = $('app-version').value.trim();
 if(!/^\d+\.\d+\.\d+$/.test(v)) return setStatus('version-status','Version must be x.y.z','error');
 await set(ref(rtdb, `versions/${adminKey}`), v);
 setStatus('version-status',`Saved ${v}.`,'');
}
async function loadAppVersion(adminKey){
 const s = await get(ref(rtdb, `versions/${adminKey}`));
 if (s.exists()) { $('app-version').value = s.val(); setStatus('version-status',`Current: ${s.val()}`,''); }
 else { $('app-version').value=''; setStatus('version-status','No version set.',''); }
}


async function saveAppLink(adminKey){
 const link = $('app-link').value.trim();
 if(!link) return setStatus('link-status','Link cannot be empty.','error');
 await set(ref(rtdb, `appLinks/${adminKey}`), { link, ts: Date.now() });
 setStatus('link-status','Link saved.','');
}
async function loadAppLink(adminKey){
 const s = await get(ref(rtdb, `appLinks/${adminKey}`));
 if (s.exists() && s.val()?.link) {
 $('app-link').value = s.val().link;
 setStatus('link-status','Loaded saved link.','');
 } else {
 setStatus('link-status','No link saved yet.','');
 }
}
function openSavedLinkNow(){
 const link = $('app-link').value.trim();
 if(!link) return setStatus('link-status','No link set.','error');
 window.open(link, '_blank', 'noopener');
}

async function registerUser(adminKey){
 const username=$('username').value.trim();
 const password=$('password').value.trim();
 const expiration=$('expiration').value;
 const requireHwid=$('require-hwid').checked;
 if(!username||!password||!expiration) return setStatus('register-status','All fields required.','error');


 const uref = ref(rtdb, `users/${adminKey}/${username}`);
 let isUpdate = false;
 try {
 const existing = await get(uref);
 isUpdate = existing.exists();
 } catch (_) { }

 const payload={ username,password,expirationDate:new Date(expiration).toISOString(),creationDate:new Date().toISOString(),requireHwid:!!requireHwid };
 await set(uref, payload);
 setStatus('register-status','Saved.','');


 try {
 await recordUserMetric(adminKey, isUpdate ? 'updated' : 'added');
 } catch(_) {}

 await loadUsers(adminKey);
}
async function loadUsers(adminKey){
 const s = await get(ref(rtdb, `users/${adminKey}`));
 const data = s.exists() ? s.val() : {};
 const rows = Object.keys(data).map(k=>({ username:k, ...(data[k]||{}) }));
 renderUsers(rows);
}
function renderUsers(users){
 const t = $('users-table');
 t.innerHTML = `<thead><tr><th>Username</th><th>HWID</th><th>Expiration</th><th>Created</th><th>HWID lock</th><th>Action</th></tr></thead><tbody></tbody>`;
 const tb = t.querySelector('tbody');
 (users||[]).forEach(u=>{
 const hwid = u.hwid || '';
 const masked = hwid ? `${hwid.slice(0,8)}…${hwid.slice(-6)}` : '—';
 const row = document.createElement('tr');
 row.innerHTML = `
 <td data-label="Username">${u.username}</td>
 <td data-label="HWID">${hwid ? `<code title="${hwid}">${masked}</code>` : '—'}</td>
 <td data-label="Expiration">${u.expirationDate ? new Date(u.expirationDate).toLocaleDateString() : '—'}</td>
 <td data-label="Created">${u.creationDate ? new Date(u.creationDate).toLocaleDateString() : '—'}</td>
 <td data-label="HWID lock"><button class="btn secondary" data-toggle-hwid="${u.username}" data-on="${!!u.requireHwid}">${u.requireHwid?'Enabled':'Disabled'}</button></td>
 <td data-label="Action">
 <button class="btn secondary" data-reset="${u.username}">Reset HWID</button>
 <button class="btn danger" data-del="${u.username}">Delete</button>
 </td>`;
 tb.appendChild(row);
 });
}


document.addEventListener('click', (e) => {

 const resetBtn = e.target.closest?.('[data-reset]');
 if (resetBtn && ADMIN_KEY) {
 const name = resetBtn.getAttribute('data-reset');
 resetHWID(ADMIN_KEY, name);
 return;
 }


 const delUserBtn = e.target.closest?.('[data-del]');
 if (delUserBtn && ADMIN_KEY) {
 const name = delUserBtn.getAttribute('data-del');
 deleteUser(ADMIN_KEY, name);
 return;
 }


 const toggleBtn = e.target.closest?.('[data-toggle-hwid]');
 if (toggleBtn && ADMIN_KEY) {
 const name = toggleBtn.getAttribute('data-toggle-hwid');
 const current = (toggleBtn.getAttribute('data-on') === 'true');
 toggleBtn.disabled = true;
 toggleRequireHwid(ADMIN_KEY, name, !current)
 .catch(()=>{})
 .finally(()=>{ toggleBtn.disabled = false; });
 return;
 }
});
async function deleteUser(adminKey, name){
 if(!confirm(`Delete ${name}?`)) return;
 await remove(ref(rtdb, `users/${adminKey}/${name}`));
 toast('User deleted'); await loadUsers(adminKey);
}
async function deleteAllUsers(adminKey){
 if(!confirm('⚠️ Delete ALL users?')) return;
 await remove(ref(rtdb, `users/${adminKey}`));
 toast('All users deleted'); await loadUsers(adminKey);
}
async function resetHWID(adminKey, name){
 if(!confirm(`Reset HWID for ${name}?`)) return;
 await remove(ref(rtdb, `users/${adminKey}/${name}/hwid`));
 toast('HWID reset'); await loadUsers(adminKey);
}
async function toggleRequireHwid(adminKey, name, val){
 await update(ref(rtdb, `users/${adminKey}/${name}`), { requireHwid: !!val });
 toast(`HWID lock ${val ? 'enabled':'disabled'}`); await loadUsers(adminKey);
}

let ADMIN_KEY = null;
function enableMenu(on){
 const menuTab = $('tab-menu'), menuPanel = $('panel-menu');
 if(on){ menuTab.hidden=false; menuTab.removeAttribute('inert'); menuPanel.removeAttribute('inert'); }
 else { menuTab.hidden=true; menuTab.setAttribute('inert',''); menuPanel.setAttribute('inert',''); }
}



document.addEventListener('click', (e)=>{
 const delTok = e.target.closest?.('[data-del-token]');
 if (delTok && ADMIN_KEY) deleteToken(ADMIN_KEY, delTok.getAttribute('data-del-token'));
});


const btnReload = $('btn-reload');
const btnDeleteAll = $('btn-delete-all');
const btnSort = $('btn-sort');
const searchInput = $('search-input');
if (btnReload) btnReload.addEventListener('click', ()=> ADMIN_KEY && loadUsers(ADMIN_KEY));
if (btnDeleteAll) btnDeleteAll.addEventListener('click', ()=> ADMIN_KEY && deleteAllUsers(ADMIN_KEY));
if (btnSort) btnSort.addEventListener('click', ()=>{
 const tb = document.querySelector('#users-table tbody'); if(!tb) return;
 const rows=[...tb.querySelectorAll('tr')];
 rows.sort((a,b)=>{
 const A = a.cells[0]?.innerText?.trim().toLowerCase() || '';
 const B = b.cells[0]?.innerText?.trim().toLowerCase() || '';
 return A.localeCompare(B, undefined, {sensitivity:'base'});
 });
 rows.forEach(r=>tb.appendChild(r));
});
let t=null;
if (searchInput) searchInput.addEventListener('input',()=>{
 clearTimeout(t); t=setTimeout(()=>{
 const q = searchInput.value.toLowerCase();
 document.querySelectorAll('#users-table tbody tr').forEach(row=>{
 const name = row.cells[0]?.innerText?.toLowerCase() || '';
 row.style.display = name.includes(q) ? '' : 'none';
 });
 },120);
});
const copyAdmin = $('copy-admin');
if (copyAdmin) copyAdmin.addEventListener('click', async ()=>{
 const full = $('admin-key').dataset.full || '';
 if(!full) return; await navigator.clipboard.writeText(full); toast('Admin key copied');
});
const btnSaveVersion = $('btn-save-version');
const btnSendLink = $('btn-send-link');
const btnOpenLink = $('btn-open-link');
const btnRegisterUser = $('btn-register-user');
if (btnSaveVersion) btnSaveVersion.addEventListener('click', ()=> ADMIN_KEY && saveAppVersion(ADMIN_KEY));
if (btnSendLink) btnSendLink.addEventListener('click', ()=> ADMIN_KEY && saveAppLink(ADMIN_KEY));
if (btnOpenLink) btnOpenLink.addEventListener('click', openSavedLinkNow);
if (btnRegisterUser) btnRegisterUser.addEventListener('click', ()=> ADMIN_KEY && registerUser(ADMIN_KEY));




async function recordUserMetric(adminKey, kind ){
 if (!adminKey || !kind) return;
 try {
 const now = new Date();
 const yyyyMMdd = now.toISOString().slice(0,10).replace(/-/g,'');
 const hour = String(now.getHours()).padStart(2,'0');
 const dref = doc(fs, "regStats", adminKey, "daily", yyyyMMdd);

 await setDoc(dref, { _created: true }, { merge: true });
 await updateDoc(dref, {
 [kind + '_h' + hour]: increment(1),
 lastUpdated: now.toISOString()
 });
 } catch (e) {
 console.warn('recordUserMetric failed:', e);
 }
}


let loginChart = null;
let unsubscribeStats = null;
function initRegisterChart(adminKey){
 const canvas = $('registerChart');
 if (!canvas || typeof Chart === 'undefined') return;


 const labels = Array.from({length:24}, (_,i)=>`${String(i).padStart(2,'0')}:00`);
 const data = Array(24).fill(0);
 let lastData = data.slice();
 let bumpAt = Array(24).fill(0);

 const ctx = canvas.getContext('2d');


 const runner = {
 id: 'runnerGlow',
 afterDatasetsDraw(chart, args, pluginOpts) {
 const { ctx } = chart;
 const meta = chart.getDatasetMeta(0);
 if (!meta || !meta.data || !meta.data.length) return;


 ctx.save();
 ctx.shadowBlur = 18;
 ctx.shadowColor = 'rgba(124,92,255,.8)';
 ctx.globalCompositeOperation = 'lighter';
 meta.dataset.draw(ctx);
 ctx.restore();


 const t = (performance.now()/700)%meta.data.length;
 const i0 = Math.floor(t);
 const i1 = Math.min(i0+1, meta.data.length-1);
 const p = t - i0;

 const p0 = meta.data[i0];
 const p1 = meta.data[i1];
 const x = p0.x + (p1.x - p0.x)*p;
 const y = p0.y + (p1.y - p0.y)*p;

 ctx.save();
 ctx.beginPath();
 const radius = 6;
 const grd = ctx.createRadialGradient(x,y,0,x,y,28);
 grd.addColorStop(0,'rgba(124,92,255,1)');
 grd.addColorStop(.35,'rgba(124,92,255,.7)');
 grd.addColorStop(1,'rgba(124,92,255,0)');
 ctx.fillStyle = grd;
 ctx.arc(x,y,radius,0,Math.PI*2);
 ctx.fill();
 ctx.restore();

 const nowMs = performance.now();
 for (let h=0; h<meta.data.length; h++){
 const t0 = bumpAt[h] || 0;
 const dt = nowMs - t0;
 if (t0 && dt < 1500) {
 const fade = 1 - (dt/1500);
 const px = meta.data[h].x;
 const py = meta.data[h].y;
 const r = 32;
 const g2 = ctx.createRadialGradient(px,py,0,px,py,r);
 g2.addColorStop(0, 'rgba(124,92,255,' + (0.9*fade).toFixed(3) + ')');
 g2.addColorStop(0.35, 'rgba(124,92,255,' + (0.6*fade).toFixed(3) + ')');
 g2.addColorStop(1, 'rgba(124,92,255,0)');
 ctx.save();
 ctx.fillStyle = g2;
 ctx.beginPath();
 ctx.arc(px, py, 8, 0, Math.PI*2);
 ctx.fill();
 ctx.restore();
 }
 }
}
 };


 const getStroke = () => {
 const { chartArea } = loginChart;
 const g = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
 g.addColorStop(0, '#7c5cff');
 g.addColorStop(1, '#00e7f5');
 return g;
 };
 const getFill = () => {
 const { chartArea } = loginChart;
 const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
 g.addColorStop(0, 'rgba(124,92,255,.25)');
 g.addColorStop(1, 'rgba(124,92,255,0)');
 return g;
 };


 loginChart = new Chart(ctx, {
 type: 'line',
 data: {
 labels,
 datasets: [{
 label: 'Users Added',
 data,
 tension: 0.35,
 fill: true,
 borderWidth: 2,
 pointRadius: 0,
 borderColor: '#7c5cff',
 backgroundColor: 'rgba(124,92,255,.20)'
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 interaction: { intersect:false, mode:'index' },
 plugins: { legend: { display:false }, tooltip: { enabled:true } },
 scales: {
 x: { grid: { color:'rgba(255,255,255,.06)' } },
 y: {

 beginAtZero: true,
 min: 0,
 max: 100,
 grace: 0,
 grid: { color:'rgba(255,255,255,.06)' },
 ticks: {
 precision: 0,
 stepSize: 10,
 maxTicksLimit: 11
 }
 }
 },
 animation: false
 },
 plugins: [runner]
 });

 function startRunnerAnimation(){
 let anim = null;
 function step(){
 if (!loginChart) return;

 loginChart.draw();
 anim = requestAnimationFrame(step);
 }
 if (!anim) requestAnimationFrame(step);
 }
 startRunnerAnimation();



 function applyGradients(){
 if (!loginChart.chartArea) { requestAnimationFrame(applyGradients); return; }
 loginChart.data.datasets[0].borderColor = getStroke();
 loginChart.data.datasets[0].backgroundColor = getFill();
 loginChart.update();
 }
 applyGradients();


 function bindToday(){
 const now = new Date();
 const yyyyMMdd = now.toISOString().slice(0,10).replace(/-/g,'');
 const dref = doc(fs, "regStats", adminKey, "daily", yyyyMMdd);
 if (unsubscribeStats) unsubscribeStats();
 unsubscribeStats = onSnapshot(dref, (snap)=>{
 const base = Array(24).fill(0);
 if (snap.exists()) {
 const v = snap.data() || {};
 for (let h=0; h<24; h++){
 const hh = String(h).padStart(2,'0');
 const added = Number(v['added_h'+hh] || 0);
 const updated = Number(v['updated_h'+hh] || 0);
 const val = added;
 const clamped = Math.max(0, Math.min(100, val));
 if (clamped > lastData[h]) bumpAt[h] = performance.now();
 base[h] = clamped;
 }
 }
 loginChart.data.datasets[0].data = base;
 lastData = base.slice();
 loginChart.update();
 });
 }
 bindToday();


 setInterval(()=>{
 const d = new Date();
 if (d.getHours()===0 && d.getMinutes()===0) bindToday();
 }, 60_000);
}


const btnLogin = $('btn-login');
const btnRegister = $('btn-register');
if (btnLogin) btnLogin.addEventListener('click', async ()=>{
 setStatus('login-status','Logging in…','');
 try {
 await signInWithEmailAndPassword(auth, $('login-email').value, $('login-pass').value);
 setStatus('login-status','pending your access..','');
 } catch(e){ setStatus('login-status', e.message || 'Login failed','error'); }
});
if (btnRegister) btnRegister.addEventListener('click', async ()=>{
 setStatus('reg-status','Check Your Mail Box to verify','');
 
 try {
 const cred = await createUserWithEmailAndPassword(auth, $('reg-email').value, $('reg-pass').value);
 await sendEmailVerification(cred.user);
 await ensureAllowDoc(cred.user.email);
 setStatus('reg-status','Account created. Verification email sent — check inbox, then log in.','');
 await signOut(auth);
 switchTo('login');
 } catch(e){ setStatus('reg-status', e.message || 'Registration failed','error'); }
});


onAuthStateChanged(auth, async (user)=>{
 if(!user){
 ADMIN_KEY = null;
 enableMenu(false);
 $('allow-admin').style.display='none';
 $('allow-status').textContent='—';
 setStatus('login-status','', ''); setStatus('verify-status','', '');
 switchTo('login'); return;
 }
 try {
 if (!(await requireVerified(user))) return;

 await ensureAllowDoc(user.email);
 if (!(await isAllowed(user.email))) {
 setStatus('login-status','Your email is not allowed yet. Ask a superadmin.','error');
 await signOut(auth); return;
 }
 $('allow-status').textContent = 'ALLOWED';

 const sa = await isSuperadmin(user.email);
 $('allow-admin').style.display = sa ? 'block' : 'none';
 if (sa) await listAllowDocs();

 const key = getAdminKeyForUser(user);
 ADMIN_KEY = key;
 $('admin-key').textContent = key.slice(0,8)+'…'+key.slice(-6);
 $('admin-key').dataset.full = key;

 await set(ref(rtdb, `adminKeys/${key}`), {
 uid: user.uid, email: (user.email||'').toLowerCase(), createdAt: new Date().toISOString()
 });

 await Promise.allSettled([ loadAppVersion(ADMIN_KEY), loadUsers(ADMIN_KEY), loadAppLink(ADMIN_KEY), loadTokens(ADMIN_KEY) ]);
 enableMenu(true);
 switchTo('menu');
 setStatus('login-status','Login ok.',''); setStatus('verify-status','', '');


 initRegisterChart(ADMIN_KEY);

 } catch(e){
 setStatus('login-status', e.message || 'Error after login','error');
 }
});

async function listAllowDocs(){
 const tb = $('allow-table').querySelector('tbody'); tb.innerHTML='';
 try {
 const qs = await getDocs(collection(fs, "emailAccess"));
 qs.forEach(d => {
 const v = d.data() || {};
 const tr = document.createElement('tr');
 tr.innerHTML = `<td>${d.id}</td><td>${v.allow ? 'true':'false'}</td><td>${v.role||'—'}</td><td>${v.reason||'—'}</td>`;
 tb.appendChild(tr);
 });
 setStatus('allow-status-msg','List refreshed.','');
 } catch(e) {
 setStatus('allow-status-msg', e.message || 'Error listing','error');
 }
}



function maskToken(tok){
 if(!tok) return '—';
 if (tok.length <= 14) return tok;
 return tok.slice(0,8) + '…' + tok.slice(-6);
}

async function saveToken(adminKey){
 try {
 let token = $('token-value')?.value?.trim() || '';
 if (!token) {
 token = randomKeyHex(32);
 if ($('token-value')) $('token-value').value = token;
 }
 const expRaw = $('token-expiration')?.value || '';
 if (!expRaw) return setStatus('token-status','Select an expiration date.','error');
 const expirationDate = new Date(expRaw).toISOString();
 const requireHwid = !!$('token-require-hwid')?.checked;

 await set(ref(rtdb, `tokens/${adminKey}/${token}`), {
 token,
 createdAt: new Date().toISOString(),
 expirationDate,
 requireHwid,
 enabled: true
 });
 setStatus('token-status','Token saved.','');
 try { await navigator.clipboard.writeText(token); toast('Token copied'); } catch(_) {}
 await loadTokens(adminKey);
 } catch(e){
 setStatus('token-status', (e && e.code==='PERMISSION_DENIED') ? 'PERMISSION_DENIED: Check your Realtime Database Rules for /tokens.' : (e?.message||'Failed to save token'),'error');
 }
}

async function loadTokens(adminKey){
 try {
 const s = await get(ref(rtdb, `tokens/${adminKey}`));
 const data = s.exists() ? s.val() : {};
 const rows = Object.keys(data).map(k => ({ token:k, ...(data[k]||{}) }));
 renderTokens(rows);
 } catch(e){
 setStatus('token-status', e?.message || 'Failed to load tokens','error');
 }
}

function renderTokens(tokens){
 const list = $('tokens-list'); if (!list) return;
 list.innerHTML = '';
 (tokens || []).forEach(v => {
 const tok = v.token || '';
 const li = document.createElement('li');
 li.className = 'token-item';
 li.innerHTML = `
 <span class="token-text" title="${tok}">${maskToken(tok)}</span>
 <div class="token-meta">
 ${v.requireHwid ? '<span class="badge">HWID lock</span>' : ''}
 ${v.expirationDate ? `<span class="badge">${new Date(v.expirationDate).toLocaleDateString()}</span>` : ''}
 <button class="btn danger" data-del-token="${tok}">Delete</button>
 </div>`;
 list.appendChild(li);
 });
}

async function deleteToken(adminKey, token){
 if(!confirm('Delete this token?')) return;
 await remove(ref(rtdb, `tokens/${adminKey}/${token}`));
 toast('Token deleted');
 await loadTokens(adminKey);
}



const btnGenToken = $('btn-gen-token');
const btnSaveToken = $('btn-save-token');
if (btnGenToken) btnGenToken.addEventListener('click', ()=>{
 if ($('token-value')) $('token-value').value = randomKeyHex(32);
 setStatus('token-status','New token generated.','');
});
if (btnSaveToken) btnSaveToken.addEventListener('click', ()=> ADMIN_KEY && saveToken(ADMIN_KEY));



document.addEventListener('click', (e)=>{
 const delTok = e.target.closest?.('[data-del-token]');
 if (delTok && ADMIN_KEY) deleteToken(ADMIN_KEY, delTok.getAttribute('data-del-token'));
});
 
;