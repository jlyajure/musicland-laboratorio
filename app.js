// Configuración de Chromecast
window.castUrl = ""; window.castTitle = ""; window.castCover = ""; window.lastTvTime = 0;
window['__onGCastApiAvailable'] = function(isAvailable) {
    if (isAvailable) {
        const castContext = cast.framework.CastContext.getInstance();
        castContext.setOptions({ 
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, 
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED 
        });
        const player = new cast.framework.RemotePlayer();
        const controller = new cast.framework.RemotePlayerController(player);
        controller.addEventListener(cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED, () => {
            window.lastTvTime = player.currentTime;
        });
        castContext.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
            const media = document.getElementById('main-media');
            if (event.sessionState === 'SESSION_STARTED') {
                media.pause();
                const session = castContext.getCurrentSession();
                const info = new chrome.cast.media.MediaInfo(window.castUrl, 'audio/mp3');
                const meta = new chrome.cast.media.MusicTrackMediaMetadata();
                meta.title = window.castTitle; meta.artist = "Jazztabueno Productions";
                meta.images = [new chrome.cast.Image(window.castCover)];
                info.metadata = meta;
                const req = new chrome.cast.media.LoadRequest(info);
                req.currentTime = media.currentTime;
                session.loadMedia(req);
            }
        });
    }
};

// --- CONFIGURACIÓN FIREBASE (COMPAT) ---
const firebaseConfig = { 
    apiKey: "AIzaSyBwBq4gLgv4DSfUidzUuC7Irmvj_4pCTtI", 
    authDomain: "familia-yajure-app.firebaseapp.com", 
    projectId: "familia-yajure-app", 
    storageBucket: "familia-yajure-app.firebasestorage.app", 
    messagingSenderId: "692035727386", 
    appId: "1:692035727386:web:dfa3e39a481d56368a61a3" 
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const media = document.getElementById('main-media');
let canciones = []; let idActual = null; let perfilData = null; let filtroActual = 'Todo';
let misFavoritos = JSON.parse(localStorage.getItem('ml_favoritos')) || [];
let misPlaylists = JSON.parse(localStorage.getItem('ml_playlists')) || {};
let cancionA_Agregar = null;

const SVG_PLAY = `<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const SVG_PAUSE = `<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

// --- CARPETAS / PLAYLISTS ---
window.abrirModalPlaylist = (id) => {
    cancionA_Agregar = id;
    const container = document.getElementById('pl-list');
    container.innerHTML = Object.keys(misPlaylists).map(n => `<div class="pl-item" onclick="window.agregarAPlaylist('${n}')">📁 ${n} (${misPlaylists[n].length})</div>`).join('') || "No hay carpetas";
    document.getElementById('modal-playlist').style.display = 'flex';
};

window.crearPlaylist = () => {
    const n = document.getElementById('pl-new-name').value.trim();
    if(n) { if(!misPlaylists[n]) misPlaylists[n] = []; window.agregarAPlaylist(n); document.getElementById('pl-new-name').value = ""; }
};

window.agregarAPlaylist = (n) => {
    if(!misPlaylists[n].includes(cancionA_Agregar)) {
        misPlaylists[n].push(cancionA_Agregar);
        localStorage.setItem('ml_playlists', JSON.stringify(misPlaylists));
        alert(`✅ Guardada en "${n}"`);
    }
    document.getElementById('modal-playlist').style.display = 'none';
    renderPlaylists(); renderFeeds();
};

function renderPlaylists() {
    const lists = Object.keys(misPlaylists);
    document.getElementById('title-play').style.display = lists.length ? 'block' : 'none';
    document.getElementById('carousel-play').style.display = lists.length ? 'flex' : 'none';
    document.getElementById('carousel-play').innerHTML = lists.map(n => `<button class="filter-btn" onclick="window.filtrar('PLAYLIST:${n}', this)">📁 ${n}</button>`).join('');
}

// --- FAVORITOS ---
window.toggleFavorito = (id) => {
    if(misFavoritos.includes(id)) { misFavoritos = misFavoritos.filter(fid => fid !== id); }
    else { misFavoritos.push(id); }
    localStorage.setItem('ml_favoritos', JSON.stringify(misFavoritos));
    renderHero(); renderFeeds();
};

// 🔥 REPRODUCTOR: AUTO-ABRE LA IMAGEN COMPLETA 🔥
window.gestionarPlay = async (id) => {
    let s = canciones.find(c => c.id === id) || (id === 'PERFIL_MAIN' ? perfilData : null);
    if(!s) return;
    if(idActual !== id) {
        idActual = id;
        document.getElementById('mini-title').innerText = s.titulo;
        document.getElementById('mini-artist').innerText = s.artista;
        document.getElementById('mini-art').style.backgroundImage = `url('${s.imagenUrl}')`;
        document.getElementById('mini-player').style.display = 'flex';
        document.getElementById('fp-title').innerText = s.titulo;
        document.getElementById('fp-artist').innerText = s.artista;
        document.getElementById('fp-art').style.backgroundImage = `url('${s.imagenUrl}')`;
        
        media.pause();
        media.removeAttribute('crossorigin');
        media.src = s.mp3Url;
        media.load();
        try { await media.play(); } catch(e) { media.play(); }
        
        window.openFullPlayer();
    } else {
        media.paused ? media.play() : media.pause();
    }
    const icon = media.paused ? SVG_PLAY : SVG_PAUSE;
    [document.getElementById('mini-play-btn'), document.getElementById('fp-play-btn'), document.getElementById('hero-play-btn')].forEach(b => { if(b) b.innerHTML = icon; });
    renderFeeds();
};

window.toggleMainPlay = () => { if(media.src) window.gestionarPlay(idActual); };

window.filtrar = (cat, btn) => {
    filtroActual = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('secciones-extra').style.display = (cat === 'Todo') ? 'block' : 'none';
    renderFeeds();
};

// Escucha en tiempo real a Firebase
db.collection("musicland_canciones").onSnapshot((snap) => {
    canciones = []; perfilData = null;
    snap.forEach(d => {
        const data = {id: d.id, ...d.data()};
        if(d.id === "PERFIL_MAIN") perfilData = data; else canciones.push(data);
    });
    // Ordenar de más reciente a más antigua
    canciones.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    renderHero(); renderPlaylists(); renderFeeds(); 
});

function renderHero() {
    const f = perfilData || canciones[0]; if(!f) return;
    document.getElementById('hero-bg').style.backgroundImage = `url('${f.imagenUrl}')`;
    document.getElementById('hero-cover').style.backgroundImage = `url('${f.imagenUrl}')`;
    document.getElementById('hero-title').innerText = f.titulo;
    document.getElementById('hero-artist').innerText = f.artista;
    document.getElementById('hero-bio').innerText = f.bio || "Bienvenidos.";
    const playBtn = document.getElementById('hero-play-btn');
    if(playBtn) {
        playBtn.innerHTML = (idActual === f.id && !media.paused) ? SVG_PAUSE : SVG_PLAY;
        playBtn.onclick = () => window.gestionarPlay(f.id);
    }
    const bFav = document.getElementById('hero-fav-btn');
    if(bFav) {
        bFav.innerText = misFavoritos.includes(f.id) ? '❤️' : '🤍';
        bFav.onclick = () => window.toggleFavorito(f.id);
    }
}

function renderFeeds() {
    // 🔥 MAGIA: Agregué overflow:hidden y white-space:nowrap al artista también
    const createCard = (c) => `<div class="n-card" onclick="window.gestionarPlay('${c.id}')"><div class="n-img" style="background-image:url('${c.imagenUrl}')"><div class="btn-delete-card">🗑️</div><button class="btn-add-list" onclick="event.stopPropagation(); window.abrirModalPlaylist('${c.id}')">➕</button><button class="btn-fav-card" onclick="event.stopPropagation(); window.toggleFavorito('${c.id}')">${misFavoritos.includes(c.id)?'❤️':'🤍'}</button><div class="n-overlay"><div class="n-play-icon">${idActual===c.id&&!media.paused?SVG_PAUSE:SVG_PLAY}</div></div></div><div style="font-size:14px;font-weight:700;color:white;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.titulo}</div><div style="font-size:12px;color:var(--neon);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.artista}</div></div>`;
    
    let filtradas = (filtroActual === 'Todo') ? canciones : (filtroActual.startsWith('PLAYLIST:') ? canciones.filter(c => (misPlaylists[filtroActual.replace('PLAYLIST:', '')] || []).includes(c.id)) : canciones.filter(c => c.categoria === filtroActual));
    
    document.getElementById('carousel-all').innerHTML = filtradas.map(c => createCard(c)).join('');
    document.getElementById('carousel-new').innerHTML = canciones.slice(0, 10).map(c => createCard(c)).join('');
    
    const fList = canciones.filter(c => misFavoritos.includes(c.id));
    if(fList.length) { 
        document.getElementById('title-fav').style.display='block'; 
        document.getElementById('carousel-fav').style.display='flex'; 
        document.getElementById('carousel-fav').innerHTML = fList.map(c=>createCard(c)).join(''); 
    } else { 
        document.getElementById('title-fav').style.display='none'; 
        document.getElementById('carousel-fav').style.display='none'; 
    }
    
    let sug = [...canciones].sort(() => 0.5 - Math.random()).slice(0, 10);
    document.getElementById('carousel-sug').innerHTML = sug.map(c => createCard(c)).join('');
}

window.openFullPlayer = () => document.getElementById('full-player').classList.add('active');
window.closeFullPlayer = () => document.getElementById('full-player').classList.remove('active');
window.triggerAdmin = () => { if(prompt("Acceso:") === "ticoadmin2026") { document.body.classList.add('admin-mode'); document.getElementById('admin-panel').style.display='block'; } };
window.confirmarSalida = () => { if(confirm("¿Deseas detener la música y salir de la app?")) { media.pause(); document.getElementById('pantalla-salida').style.display = 'flex'; } };

media.addEventListener('timeupdate', () => {
    document.getElementById('mini-progress').style.width = (media.currentTime / media.duration) * 100 + "%";
    document.getElementById('seek-bar').value = media.currentTime;
    const fmt = (t) => isNaN(t) ? "0:00" : `${Math.floor(t/60)}:${Math.floor(t%60).toString().padStart(2,'0')}`;
    document.getElementById('time-current').innerText = fmt(media.currentTime);
});
media.addEventListener('loadedmetadata', () => document.getElementById('seek-bar').max = media.duration);
