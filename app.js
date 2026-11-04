// Firebase modules load during bootstrap so errors are shown in the interface.
let initializeApp, getAuth, onAuthStateChanged, createUserWithEmailAndPassword;
let signInWithEmailAndPassword, signOut;
let getFirestore, collection, doc, setDoc, getDoc, query, where;
let orderBy, limit, onSnapshot, serverTimestamp, writeBatch;

const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/11.10.0/';

const $ = id => document.getElementById(id);
const state = { auth:null, db:null, me:null, users:[], chats:[], activeId:null, activeChat:null, messageUnsub:null, chatUnsub:null, usersUnsub:null, authMode:'login', createMode:'private', selected:new Set(), page:'spin', busy:false };
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),4500)}
function errorText(e) {
  const c = e?.code || '';
  if (c === 'auth/email-already-in-use') return 'Нікнейм уже зайнятий.';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(c)) return 'Неправильний нікнейм або пароль.';
  if (c === 'auth/weak-password') return 'Пароль надто слабкий.';
  if (c === 'auth/operation-not-allowed') return 'У Firebase Authentication увімкни Email/Password.';
  if (c === 'auth/unauthorized-domain') return 'Додай поточний домен в Authentication → Settings → Authorized domains.';
  if (c === 'auth/network-request-failed' || c === 'unavailable') return 'Не вдалося зв’язатися з Firebase. Перевір інтернет і блокувальники.';
  if (c === 'permission-denied') return 'Немає доступу. Перевір опубліковані правила Firestore.';
  return e?.message || 'Сталася помилка.';
}
function showModal(id){$(id).classList.remove('hidden');$(id).querySelector('input')?.focus()}
function closeModal(id){$(id).classList.add('hidden')}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
for(const id of ['authModal','createModal'])$(id).addEventListener('click',e=>{if(e.target===$(id))closeModal(id)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('authModal');closeModal('createModal')}});
function page(name){state.page=name;$('spinPage').classList.toggle('hidden',name!=='spin');$('chatPage').classList.toggle('hidden',name!=='chat');document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));location.hash=name}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();page('spin')});

// 3D rotation — positive degrees in [-180, 180]
const rot={x:0,y:0,z:0};
const normal=n=>((n+180)%360+360)%360-180;
function drawCube(){for(const axis of ['x','y','z']){const n=Math.round(rot[axis]);$(axis+'Range').value=n;$(axis+'Value').textContent=n+'°';$(axis+'Read').textContent=(n<0?'-':'+')+String(Math.abs(n)).padStart(3,'0')+'°'}$('cube').style.transform=`rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(${rot.z}deg)`}
for(const axis of ['x','y','z'])$(axis+'Range').addEventListener('input',e=>{rot[axis]=Number(e.target.value);drawCube()});
$('resetRotation').addEventListener('click',()=>{rot.x=rot.y=rot.z=0;drawCube()});
let pointer=null;
$('scene').addEventListener('pointerdown',e=>{if(e.button!==0 && e.pointerType==='mouse')return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('scene').setPointerCapture(e.pointerId)});
$('scene').addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;rot.y=normal(rot.y+(e.clientX-pointer.x)*.7);rot.x=normal(rot.x-(e.clientY-pointer.y)*.7);pointer.x=e.clientX;pointer.y=e.clientY;drawCube()});
for(const evt of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(evt,()=>pointer=null);
drawCube();if(location.hash==='#chat')page('chat');

const validNick = nick => /^[a-z0-9_]{3,20}$/.test(nick);
const nickFromEmail = email => (email||'').split('@')[0];
// Alias email is technical identifier only; no mailbox exists.
const alias = nick => `${nick}@neonspin.example`;
function setAuthMode(mode){state.authMode=mode;$('loginTab').classList.toggle('active',mode==='login');$('registerTab').classList.toggle('active',mode==='register');$('authTitle').textContent=mode==='login'?'З поверненням!':'Створи акаунт';$('authSubmit').textContent=mode==='login'?'Увійти':'Зареєструватись';$('authError').textContent='';$('password').setAttribute('autocomplete',mode==='login'?'current-password':'new-password')}
$('loginTab').addEventListener('click',()=>setAuthMode('login'));
$('registerTab').addEventListener('click',()=>setAuthMode('register'));
$('noticeLogin').addEventListener('click',()=>showModal('authModal'));
$('accountButton').addEventListener('click',async()=>{if(state.me){try{await signOut(state.auth);toast('Вихід виконано')}catch(e){toast(errorText(e))}}else showModal('authModal')});
$('authForm').addEventListener('submit',async e=>{e.preventDefault();if(state.busy)return;const nick=$('nickname').value.trim().toLowerCase(),pw=$('password').value;$('authError').textContent='';if(!validNick(nick)){ $('authError').textContent='Нікнейм: 3–20 латинських літер, цифр або _';return }if(pw.length<8){$('authError').textContent='Введи пароль від 8 символів.';return}if(!state.auth || !state.db){$('authError').textContent=state.firebaseError || 'Firebase ще не готовий. Перезавантаж сторінку.';return}state.busy=true;$('authSubmit').disabled=true;try{if(state.authMode==='register'){const cred=await createUserWithEmailAndPassword(state.auth,alias(nick),pw);await ensureProfile(cred.user);toast('Акаунт створено!')}else{const cred=await signInWithEmailAndPassword(state.auth,alias(nick),pw);await ensureProfile(cred.user);toast('Успішний вхід!')}closeModal('authModal');$('authForm').reset()}catch(err){$('authError').textContent=errorText(err)}finally{state.busy=false;$('authSubmit').disabled=false}});
async function ensureProfile(user){const ref=doc(state.db,'users',user.uid),snapshot=await getDoc(ref);if(!snapshot.exists())await setDoc(ref,{uid:user.uid,nickname:nickFromEmail(user.email),createdAt:serverTimestamp()});}

function cleanSubscriptions(){for(const key of ['chatUnsub','messageUnsub','usersUnsub']){state[key]?.();state[key]=null}state.users=[];state.chats=[];state.activeId=null;state.activeChat=null;$('conversationList').replaceChildren();$('messageList').replaceChildren();$('messageList').dataset.loaded='';$('chatCount').textContent='0';$('chatApp').classList.remove('chat-open');showActive(null)}
function setAccount(user){state.me=user;$('accountLabel').textContent=user?'@'+nickFromEmail(user.email):'Гість';$('accountButton').textContent=user?'Вийти':'Увійти';$('chatLoginNotice').classList.toggle('hidden',!!user);$('chatApp').classList.toggle('hidden',!user);$('newChat').disabled=!user;}
function listenData(){state.usersUnsub=onSnapshot(query(collection(state.db,'users'),limit(250)),snapshot=>{state.users=snapshot.docs.map(d=>d.data()).filter(u=>u.uid!==state.me?.uid);renderChoices();renderChats();renderHeader()},e=>toast('Користувачі: '+errorText(e)));
 state.chatUnsub=onSnapshot(query(collection(state.db,'chats'),where('memberIds','array-contains',state.me.uid)),snapshot=>{state.chats=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.updatedAt?.toMillis?.()||0)-(a.updatedAt?.toMillis?.()||0));$('chatCount').textContent=state.chats.length;renderChats();if(state.activeId){const current=state.chats.find(x=>x.id===state.activeId);if(!current){selectChat(null)}else{state.activeChat=current;renderHeader()}}},e=>toast('Чати: '+errorText(e)));
}
function nickname(uid){if(uid===state.me?.uid)return nickFromEmail(state.me.email);return state.users.find(u=>u.uid===uid)?.nickname||'Користувач'}
function chatTitle(chat){return chat.type==='group'?chat.name:'@'+nickname(chat.memberIds.find(uid=>uid!==state.me.uid))}
function fmtDate(ts){const d=ts?.toDate?.();return d?new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit'}).format(d):''}
function elem(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function renderChats(){const target=$('conversationList');target.replaceChildren();const search=$('chatSearch').value.trim().toLowerCase();const found=state.chats.filter(c=>chatTitle(c).toLowerCase().includes(search));if(!found.length){target.append(elem('p','empty-mini',search?'Нічого не знайдено.':'Чатів ще немає. Натисни «Новий чат».'));return}for(const c of found){const btn=elem('button','conversation'+(c.id===state.activeId?' active':''));const av=elem('div','avatar',c.type==='group'?'♧':nickname(c.memberIds.find(uid=>uid!==state.me.uid)).slice(0,1).toUpperCase());const info=elem('div','convo-info'),title=elem('strong','',chatTitle(c)),prev=elem('small','',c.lastText||'Почни розмову…');info.append(title,prev);btn.append(av,info,elem('span','convo-time',fmtDate(c.updatedAt)));btn.addEventListener('click',()=>selectChat(c.id));target.append(btn)}}
$('chatSearch').addEventListener('input',renderChats);
function showActive(chat){$('chatEmpty').classList.toggle('hidden',!!chat);$('activeChat').classList.toggle('hidden',!chat)}
function renderHeader(){if(!state.activeChat)return;$('chatTitle').textContent=chatTitle(state.activeChat);const count=state.activeChat.memberIds.length;$('chatSubtitle').textContent=state.activeChat.type==='group'?`${count} учасників`:'Приватна розмова';$('chatAvatar').textContent=state.activeChat.type==='group'?'♧':chatTitle(state.activeChat).replace('@','').slice(0,1).toUpperCase()}
function selectChat(id){state.messageUnsub?.();state.messageUnsub=null;state.activeId=id;state.activeChat=state.chats.find(c=>c.id===id)||null;showActive(state.activeChat);$('chatApp').classList.toggle('chat-open',!!state.activeChat);renderChats();if(!state.activeChat)return;renderHeader();$('messageList').dataset.loaded='';$('messageList').replaceChildren(elem('p','system-note','Завантаження…'));state.messageUnsub=onSnapshot(query(collection(state.db,'chats',id,'messages'),orderBy('createdAt','desc'),limit(100)),snapshot=>{const msgs=snapshot.docs.map(d=>d.data()).reverse();renderMessages(msgs)},e=>{$('messageList').replaceChildren(elem('p','system-note',errorText(e)))})}
$('backToChats').addEventListener('click',()=>selectChat(null));
function renderMessages(msgs){const area=$('messageList');const nearBottom=area.scrollHeight-area.scrollTop-area.clientHeight<130;area.replaceChildren();if(!msgs.length){area.append(elem('p','system-note','Поки немає повідомлень. Напиши першим!'));return}for(const m of msgs){const mine=m.senderId===state.me.uid;const box=elem('div','message'+(mine?' mine':''));if(!mine)box.append(elem('div','sender','@'+nickname(m.senderId)));box.append(elem('div','body',m.text));box.append(elem('div','time',fmtDate(m.createdAt)));area.append(box)}if(nearBottom||!area.dataset.loaded)area.scrollTop=area.scrollHeight;area.dataset.loaded='1'}
$('messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('sendForm').requestSubmit()}});
$('sendForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.me||!state.activeChat||state.busy)return;const text=$('messageInput').value.trim();if(!text||text.length>2000)return;const chatId=state.activeId;state.busy=true;$('sendButton').disabled=true;try{const batch=writeBatch(state.db);batch.set(doc(collection(state.db,'chats',chatId,'messages')),{text,senderId:state.me.uid,createdAt:serverTimestamp()});batch.update(doc(state.db,'chats',chatId),{lastText:text.slice(0,120),lastSenderId:state.me.uid,updatedAt:serverTimestamp()});await batch.commit();$('messageInput').value=''}catch(err){toast('Не надіслано: '+errorText(err))}finally{state.busy=false;$('sendButton').disabled=false}});

function setCreateMode(mode){state.createMode=mode;state.selected.clear();$('privateTab').classList.toggle('active',mode==='private');$('groupTab').classList.toggle('active',mode==='group');$('groupNameWrap').classList.toggle('hidden',mode!=='group');$('selectedHint').textContent=mode==='private'?'Обери одного користувача.':'Обери щонайменше двох користувачів.';renderChoices()}
$('newChat').addEventListener('click',()=>{if(!state.me)return showModal('authModal');setCreateMode('private');$('userSearch').value='';$('groupName').value='';$('createError').textContent='';showModal('createModal')});
$('privateTab').addEventListener('click',()=>setCreateMode('private'));$('groupTab').addEventListener('click',()=>setCreateMode('group'));$('userSearch').addEventListener('input',renderChoices);
function renderChoices(){const root=$('userChoices');root.replaceChildren();const s=$('userSearch').value.trim().toLowerCase();const found=state.users.filter(u=>typeof u.nickname==='string'&&u.nickname.includes(s)).slice(0,50);if(!found.length){root.append(elem('p','empty-mini','Немає користувачів.'));return}for(const u of found){const selected=state.selected.has(u.uid);const btn=elem('button','user-choice'+(selected?' selected':''));btn.type='button';btn.append(elem('span','mini-avatar',selected?'✓':u.nickname[0].toUpperCase()),elem('span','',`@${u.nickname}`));btn.addEventListener('click',()=>{if(state.createMode==='private')state.selected.clear();if(selected)state.selected.delete(u.uid);else state.selected.add(u.uid);$('selectedHint').textContent=`Обрано: ${state.selected.size}`;renderChoices()});root.append(btn)}}
$('createForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (state.busy || !state.me) return;

  const ids = [...state.selected];
  const group = state.createMode === 'group';
  const name = $('groupName').value.trim();
  const error = $('createError');
  error.textContent = '';

  if ((group && ids.length < 2) || (!group && ids.length !== 1)) {
    error.textContent = group ? 'Обери щонайменше 2 учасників.' : 'Обери одного користувача.';
    return;
  }
  if (group && (name.length < 2 || name.length > 60)) {
    error.textContent = 'Назва групи: 2–60 символів.';
    return;
  }

  state.busy = true;
  $('createSubmit').disabled = true;
  try {
    const members = [state.me.uid, ...ids].sort();
    const chatId = group ? doc(collection(state.db, 'chats')).id : `dm_${members.join('_')}`;
    const chatRef = doc(state.db, 'chats', chatId);
    // An existing DM is already visible in the authorized chat list.
    // Opening it avoids an invalid attempt to overwrite protected fields.
    if (!group && state.chats.some(c => c.id === chatId)) {
      closeModal('createModal');
      selectChat(chatId);
      return;
    }
    const payload = {
      type: group ? 'group' : 'private',
      name: group ? name : '',
      memberIds: members,
      createdBy: state.me.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastText: '',
      lastSenderId: ''
    };

    // Do not read an absent chat first: Firestore rules correctly deny reads
    // of non-existent chats to protect private conversations.
    try {
      await setDoc(chatRef, payload);
    } catch (creationError) {
      // A deterministic private chat may already exist. setDoc would then
      // become an update, which our security rules intentionally deny.
      // Only treat it as an existing conversation after a permitted read.
      if (group || creationError?.code !== 'permission-denied') throw creationError;
      let existing;
      try {
        existing = await getDoc(chatRef);
      } catch (_) {
        throw creationError;
      }
      if (!existing.exists() ||
          !Array.isArray(existing.data().memberIds) ||
          !existing.data().memberIds.includes(state.me.uid)) {
        throw creationError;
      }
      if (!state.chats.some(c => c.id === chatId)) {
        state.chats.push({id: chatId, ...existing.data()});
      }
      closeModal('createModal');
      selectChat(chatId);
      toast('Відкрито наявний чат.');
      return;
    }

    closeModal('createModal');
    toast('Чат створено!');
    state.selected.clear();
    // Add locally to avoid waiting for the real-time chats listener.
    const provisional = {id: chatId, ...payload};
    state.chats = state.chats.filter(c => c.id !== chatId);
    state.chats.unshift(provisional);
    selectChat(chatId);
  } catch (err) {
    console.error('[NEON SPIN] Create chat:', err);
    error.textContent = errorText(err);
  } finally {
    state.busy = false;
    $('createSubmit').disabled = false;
  }
});

// Boot Firebase with precise diagnostics (instead of a misleading config warning).
function firebaseStatus(message, isError = false) {
  const notice = $('chatLoginNotice')?.querySelector('p');
  if (notice && !state.me) notice.textContent = message;
  if (isError) {
    state.firebaseError = message;
    const error = $('authError');
    if (error) error.textContent = message;
    console.error('[NEON SPIN] ' + message);
  }
}

async function bootstrapFirebase() {
  firebaseStatus('Підключення до Firebase…');
  try {
    const [configModule, appModule, authModule, firestoreModule] = await Promise.all([
      import('./firebase-config.js'),
      import(FIREBASE_SDK + 'firebase-app.js'),
      import(FIREBASE_SDK + 'firebase-auth.js'),
      import(FIREBASE_SDK + 'firebase-firestore.js')
    ]);
    const config = configModule.firebaseConfig;
    if (!config || typeof config.apiKey !== 'string' || !config.apiKey.trim() ||
        config.apiKey.includes('PASTE_') || !config.projectId ||
        config.projectId === 'YOUR_PROJECT_ID' || !config.appId || !config.authDomain) {
      throw new Error('Файл firebase-config.js не містить усіх необхідних параметрів Firebase.');
    }
    ({ initializeApp } = appModule);
    ({ getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
       signInWithEmailAndPassword, signOut } = authModule);
    ({ getFirestore, collection, doc, setDoc, getDoc, query, where,
       orderBy, limit, onSnapshot, serverTimestamp, writeBatch } = firestoreModule);

    const app = initializeApp(config);
    state.auth = getAuth(app);
    state.db = getFirestore(app);
    state.firebaseError = null;
    firebaseStatus('Firebase підключено. Увійди або зареєструйся.');
    console.info('[NEON SPIN] Firebase initialized:', config.projectId);

    onAuthStateChanged(state.auth, async user => {
      cleanSubscriptions();
      setAccount(user);
      if (user) {
        try {
          await ensureProfile(user);
          // The user may have signed out while the profile was being loaded.
          if (state.me?.uid === user.uid) listenData();
        } catch (err) {
          console.error('[NEON SPIN] User profile:', err);
          toast('Профіль: ' + errorText(err));
        }
      } else {
        firebaseStatus('Увійди або зареєструйся, щоб спілкуватися.');
      }
    }, err => {
      firebaseStatus('Помилка авторизації: ' + errorText(err), true);
    });
  } catch (err) {
    console.error('[NEON SPIN] Firebase bootstrap failed:', err);
    state.auth = null;
    state.db = null;
    setAccount(null);
    firebaseStatus('Не вдалося запустити Firebase: ' + errorText(err), true);
  }
}

setAccount(null);
bootstrapFirebase();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[NEON SPIN] Service Worker:', err));
}
