
// --- 1. THE MANIFEST (SIMULATED DATABASE) ---

// In a real professional app, each of these objects would be a separate "info.json" file
// living in a folder like: /albums/electronic-vibe/info.json.
// We would then use fetch('/albums/electronic-vibe/info.json') to get this data.

const database = [
    {
        "folder": "Ambient",
        "meta": {
            "title": "Ambient",
            "artist": "Royalty Free",
            "cover": "assets/albums/Ambient/cover.jpg",
            "description": "Soft ambient loops to help you relax and focus."
        },
        "songs": [
            { "title": "Heavenly Loop", "src": "assets/albums/Ambient/song/Heavenly Loop.mp3", "duration": "0:33" },
            { "title": "Project Utopia", "src": "assets/albums/Ambient/song/Project Utopia.mp3", "duration": "0:18" }
        ]
    },
    {
        "folder": "Calm",
        "meta": {
            "title": "Calm",
            "artist": "Royalty Free",
            "cover": "assets/albums/Calm/cover.jpg",
            "description": "Calm the Mind."
        },
        "songs": [
            { "title": "JRPG-Piano", "src": "assets/albums/Calm/song/JRPG-Piano.mp3", "duration": "0:24" },
            { "title": "piano_nostalgia", "src": "assets/albums/Calm/song/piano_nostalgia.mp3", "duration": "0:49" }
        ]
    },
    {
        "folder": "Coding-vibe",
        "meta": {
            "title": "Coding Vibe",
            "artist": "Royalty Free",
            "cover": "assets/albums/Coding-vibe/cover.jpg",
            "description": "Minimal loops to help you code and stay in flow."
        },
        "songs": [
            { "title": "Level Music Loop", "src": "assets/albums/Coding-vibe/song/levelmusicloop-tigrun.mp3", "duration": "0:41" }
        ]
    },
    {
        "folder": "Energy",
        "meta": {
            "title": "Energy",
            "artist": "Royalty Free",
            "cover": "assets/albums/Energy/cover.jpg",
            "description": "Upbeat grooves to keep you moving."
        },
        "songs": [
            { "title": "Funky Menu Loop", "src": "assets/albums/Energy/song/funkymenuloop.mp3", "duration": "0:18" },
            { "title": "Jungled", "src": "assets/albums/Energy/song/jungled.mp3", "duration": "0:37" }
        ]
    },
    {
        "folder": "Focus",
        "meta": {
            "title": "Focus",
            "artist": "Royalty Free",
            "cover": "assets/albums/Focus/cover.jpg",
            "description": "Short loops that help with concentration."
        },
        "songs": [
            { "title": "1 Minute Loop", "src": "assets/albums/Focus/song/1minute.mp3", "duration": "1:00" },
            { "title": "8-Bit Title Screen", "src": "assets/albums/Focus/song/8BitTitleScreen.mp3", "duration": "0:21" }
        ]
    },
    {
        "folder": "Motivation",
        "meta": {
            "title": "Motivation",
            "artist": "Royalty Free",
            "cover": "assets/albums/Motivation/cover.jpg",
            "description": "Motivating loops to power your day."
        },
        "songs": [
            { "title": "Dark Things Loop", "src": "assets/albums/Motivation/song/dark_things_loop.mp3", "duration": "0:32" },
            { "title": "Unexplored (Short)", "src": "assets/albums/Motivation/song/Unexplored-shortver.mp3", "duration": "0:38" }
        ]
    }
];

// --- 2. MOCK FETCH (fallback) ---

// This function simulates the delay and Promise behavior of a real API call.
// It is kept as a fallback for environments where fetch() to local files is blocked (file://).
async function mockFetchAlbums() {
    // Simulate network delay (300ms) for realism
    return new Promise(resolve => {
        setTimeout(() => {
            // Return a deep clone to simulate the new object you get from `JSON.parse`/network
            resolve(JSON.parse(JSON.stringify(database)));
        }, 300);
    });
}

// --- 3. FETCH FROM ASSETS (production-like) ---
async function fetchAlbumsFromAssets() {
    try {
        const manifestResp = await fetch('assets/albums/manifest.json');
        if (!manifestResp.ok) throw new Error('Failed to fetch manifest');
        const folders = await manifestResp.json();

        // Fetch each album info.json in parallel
        const albumPromises = folders.map(folder =>
            fetch(`assets/albums/${folder}/info.json`).then(r => {
                if (!r.ok) throw new Error(`Failed to load info.json for ${folder}`);
                return r.json();
            })
        );
        const albums = await Promise.all(albumPromises);
        return albums;
    } catch (err) {
        console.warn('fetchAlbumsFromAssets failed, falling back to in-memory data:', err);
        return mockFetchAlbums();
    }
}

/* --- STATE --- */
let currentQueue = [];
let currentSongIndex = 0;
let isPlaying = false;

// DOM ELEMENTS
const audioPlayer = new Audio();
const mainContainer = document.getElementById('main-view-container');
// These are expected in the DOM; provide sensible fallbacks so the script doesn't break during early errors/tests
const viewTitle = document.getElementById('view-title') || { innerText: '' };
const viewDesc = document.getElementById('view-desc') || { style: {}, innerText: '' };
const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward'); // new forward control

const playBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const seekBar = document.getElementById('seek-bar');
const currentTimeSpan = document.getElementById('current-time');
const totalDurationSpan = document.getElementById('total-duration');
const songTitleEl = document.getElementById('current-song-title');
const songArtistEl = document.getElementById('current-song-artist');
const albumArtEl = document.getElementById('current-album-art');

// Volume controls
const muteBtn = document.getElementById('mute-btn');
const volumeBar = document.getElementById('volume-bar');

// Navigation history state
let backStack = [];
let forwardStack = [];
let currentView = { type: 'grid' };

// Initialize controls safe defaults
seekBar.disabled = true;
audioPlayer.volume = 1;
if (volumeBar) volumeBar.value = String(audioPlayer.volume);

/* --- LOGIC --- */

// 1. LOAD ALBUMS 
// Uses async/await to wait for our "database" to respond
async function loadAlbums() {
    try {
        // UI Reset (use safe updates in case elements were not found)
        if (viewTitle) viewTitle.innerText = "Recommended Albums for you";
        btnBack.disabled = true;
        btnBack.style.cursor = "not-allowed";
        btnBack.style.opacity = "0.5";
        mainContainer.innerHTML = '<p style="color:#fff; font-family: Roboto;">Loading...</p>'; // Loading state

        // Fetch Data (from assets /info.json files)
        const albums = await fetchAlbumsFromAssets();

        // Render Grid
        mainContainer.innerHTML = ''; // Clear loading text
        mainContainer.className = 'cards-container';

        albums.forEach(albumData => {
            const card = document.createElement('div');
            card.classList.add('card');

            // Pass the whole album object to the click handler (use navigation wrapper so history is tracked)
            card.addEventListener('click', () => navigateToPlaylist(albumData));

            // Use data from the "meta" part of the JSON structure (encode URI in case filenames have spaces)
            card.innerHTML = `
                        <img src="${encodeURI(albumData.meta.cover)}" alt="${albumData.meta.title}">
                        <div class="play-btn-overlay">
                            <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: black; margin-left: 2px;"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                        <h4>${albumData.meta.title}</h4>
                        <p>${albumData.meta.artist}</p>
                    `;
            mainContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load albums:', err);
        btnBack.disabled = false;
        mainContainer.innerHTML = '<p style="color:#f66">Failed to load albums. See console for details.</p>';
    }
}

// 2. RENDER PLAYLIST (Detailed View)
function renderPlaylistView(albumData) {
    btnBack.disabled = false;
    btnBack.style.cursor = "pointer";
    btnBack.style.opacity = "1";
    viewTitle.innerText = '';
    viewDesc.style.display = 'none';
    mainContainer.innerHTML = '';
    mainContainer.className = '';
    // Put the container into playlist-mode so it won't show its scrollbar
    mainContainer.classList.add('playlist-mode');

    // Header Section (compact layout): small cover on the left, details on the right
    const headerDiv = document.createElement('div');
    headerDiv.className = 'playlist-header';
    headerDiv.innerHTML = `
                <img class="playlist-cover" src="${encodeURI(albumData.meta.cover)}" alt="${albumData.meta.title}">
                <div class="playlist-info">
                    <div class="badge">PLAYLIST</div>
                    <h1 class="playlist-title">${albumData.meta.title}</h1>
                    <div class="playlist-meta">${albumData.meta.description}</div>
                    <div class="playlist-sub"><b>${albumData.meta.artist}</b> • ${albumData.songs.length} songs</div>
                </div>
            `;
    mainContainer.appendChild(headerDiv);

    // Songs List Section
    const listDiv = document.createElement('div');
    listDiv.className = 'song-list';

    albumData.songs.forEach((song, index) => {
        const row = document.createElement('div');
        row.className = 'song-row';

        // Play logic
        row.onclick = () => {
            playSongFromAlbum(albumData, index);
        };

        row.innerHTML = `
                    <span class="song-num">${index + 1}</span>
                    <div class="song-details">
                        <span class="song-title">${song.title}</span>
                        <span class="song-artist">${albumData.meta.artist}</span>
                    </div>
                    <span class="song-duration">${song.duration}</span>
                `;
        listDiv.appendChild(row);
    });

    mainContainer.appendChild(listDiv);
}

// 3. PLAYER CONTROLLER
function playSongFromAlbum(albumData, index) {
    // Create a new queue based on this album
    currentQueue = albumData.songs.map(song => ({
        ...song,
        artist: albumData.meta.artist,
        cover: albumData.meta.cover
    }));

    currentSongIndex = index;
    loadSong(currentSongIndex);
    playSong();
}

function loadSong(index) {
    if (currentQueue.length === 0) return;
    const song = currentQueue[index];
    audioPlayer.src = song.src;
    audioPlayer.load();

    // Reset UI while metadata loads (prevents NaN/incorrect seek behavior)
    seekBar.disabled = true;
    seekBar.value = 0;
    currentTimeSpan.innerText = '0:00';
    totalDurationSpan.innerText = '0:00';

    songTitleEl.innerText = song.title;
    songArtistEl.innerText = song.artist;
    albumArtEl.src = song.cover;

    highlightActiveSong();
}

function highlightActiveSong() {
    document.querySelectorAll('.song-row').forEach(row => row.classList.remove('active-song'));
    const rows = document.querySelectorAll('.song-row');
    if (rows[currentSongIndex]) {
        rows[currentSongIndex].classList.add('active-song');
    }
}

function playSong() {
    if (!audioPlayer.src) return;
    audioPlayer.play();
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
}

function pauseSong() {
    audioPlayer.pause();
    isPlaying = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
}

function togglePlay() {
    if (isPlaying) pauseSong();
    else playSong();
}

function nextSong() {
    if (currentQueue.length === 0) return;
    currentSongIndex = (currentSongIndex + 1) % currentQueue.length;
    loadSong(currentSongIndex);
    playSong();
}

function prevSong() {
    if (currentQueue.length === 0) return;
    currentSongIndex = (currentSongIndex - 1 + currentQueue.length) % currentQueue.length;
    loadSong(currentSongIndex);
    playSong();
}

// 4. AUDIO EVENT LISTENERS
// Navigation helpers -----------------------------------------------------
function updateNavButtons() {
    if (btnBack) {
        btnBack.disabled = backStack.length === 0;
        btnBack.style.cursor = backStack.length === 0 ? 'not-allowed' : 'pointer';
        btnBack.style.opacity = backStack.length === 0 ? '0.5' : '1';
    }
    if (btnForward) {
        btnForward.disabled = forwardStack.length === 0;
        btnForward.style.cursor = forwardStack.length === 0 ? 'not-allowed' : 'pointer';
        btnForward.style.opacity = forwardStack.length === 0 ? '0.5' : '1';
    }
}

function navigateToPlaylist(albumData) {
    // push current view to back stack (unless already on the same playlist)
    if (!(currentView.type === 'playlist' && currentView.album && currentView.album.folder === albumData.folder)) {
        backStack.push(currentView);
        forwardStack = [];
    }
    currentView = { type: 'playlist', album: albumData };
    updateNavButtons();
    renderPlaylistView(albumData);
}

function goBack() {
    if (backStack.length === 0) return;
    forwardStack.push(currentView);
    const prev = backStack.pop();
    currentView = prev;
    updateNavButtons();
    if (prev.type === 'grid') loadAlbums();
    else renderPlaylistView(prev.album);
}

function goForward() {
    if (forwardStack.length === 0) return;
    backStack.push(currentView);
    const next = forwardStack.pop();
    currentView = next;
    updateNavButtons();
    if (next.type === 'grid') loadAlbums();
    else renderPlaylistView(next.album);
}

// Hook navigation buttons if present
if (btnBack) btnBack.addEventListener('click', goBack);
if (btnForward) btnForward.addEventListener('click', goForward);

// Volume control handlers -------------------------------------------------
function updateMuteUI() {
    if (!muteBtn) return;
    if (audioPlayer.muted || audioPlayer.volume === 0) {
        muteBtn.classList.add('muted');
        // swap icon to muted visual (cleaned SVG)
        muteBtn.innerHTML = '<svg viewBox="0 0 16 16" class="icon" aria-hidden="true"><path d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06"></path><path d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.64 3.64 0 0 0-1.33 4.967 3.64 3.64 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.7 4.7 0 0 1-1.5-.694v1.3L2.817 9.852a2.14 2.14 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694z"></path></svg>';
    } else {
        muteBtn.classList.remove('muted');
        // swap icon to unmuted visual (cleaned SVG)
        muteBtn.innerHTML = '<svg viewBox="0 0 16 16" class="icon" aria-hidden="true"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a3 3 0 0 1 0 5.175z"></path></svg>';
    }

}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        audioPlayer.muted = !audioPlayer.muted;
        updateMuteUI();
    });
}

if (volumeBar) {
    volumeBar.addEventListener('input', () => {
        audioPlayer.volume = parseFloat(volumeBar.value);
        if (audioPlayer.volume === 0) audioPlayer.muted = true;
        else audioPlayer.muted = false;
        updateMuteUI();
    });
}

// Keep UI in sync on initial load
updateNavButtons();
updateMuteUI();

// --- timeupdate listener (moved back) ---
audioPlayer.addEventListener('timeupdate', () => {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    if (isNaN(duration)) return;

    // --- SHORT SONG LOGIC (Requested Feature) ---
    // Automatically skip to next song if we pass 75 seconds (1:15)
    // This is useful for demos to keep things moving quickly
    if (current > 75) {
        nextSong();
        return;
    }

    seekBar.value = (current / duration) * 100;
    currentTimeSpan.innerText = formatTime(current);
    totalDurationSpan.innerText = formatTime(duration);
});

audioPlayer.addEventListener('loadedmetadata', () => {
    // Metadata now available; enable seeking and update total duration display
    const duration = audioPlayer.duration;
    if (!isNaN(duration) && duration > 0) {
        totalDurationSpan.innerText = formatTime(duration);
        seekBar.disabled = false;
    }
});

audioPlayer.addEventListener('ended', nextSong);

audioPlayer.addEventListener('error', (e) => {
    console.error('Audio playback error', e);
});

seekBar.addEventListener('input', () => {
    const duration = audioPlayer.duration;
    if (isNaN(duration) || duration === 0) return; // Prevent seeking before metadata loads
    audioPlayer.currentTime = (seekBar.value / 100) * duration;
});

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

// Initialize App
loadAlbums();

