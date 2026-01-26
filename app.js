// Variables globales
let map, marker;
const formAssistance = document.getElementById('assistanceForm');
const formAppointment = document.getElementById('appointmentForm');
const loadingOverlay = document.getElementById('loading-overlay');
const successOverlay = document.getElementById('success-overlay');
let debounceTimer;

// --- NAVEGACIÓN ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goHome() { 
    // 1. Cambiar pantalla
    switchScreen('screen-home');
    
    // 2. FORZAR CIERRE DE OVERLAYS
    if(successOverlay) successOverlay.classList.add('hidden');
    if(loadingOverlay) loadingOverlay.classList.add('hidden');
    
    // 3. Limpiar formularios
    if(formAssistance) formAssistance.reset();
    if(formAppointment) formAppointment.reset();
}

function goToAppointment() { switchScreen('screen-appointment'); }

function goToAssistance() {
    switchScreen('screen-assistance');
    setTimeout(initMap, 300); 
}

// --- MAPA ---
function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }
    
    let lat = 40.416;
    let lng = -3.703;

    map = L.map('map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    marker = L.marker([lat, lng], {draggable: true}).addTo(map);

    locateMe(true);

    marker.on('dragend', function(e) {
        let pos = marker.getLatLng();
        updateFormCoords(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
        updatePosition(e.latlng.lat, e.latlng.lng);
    });
}

function updatePosition(lat, lng) {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
    marker.setLatLng([lat, lng]);
    updateFormCoords(lat, lng);
}

function updateFormCoords(lat, lng) {
    document.getElementById('lat').value = lat;
    document.getElementById('lng').value = lng;
    document.getElementById('gmaps_link').value = `http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`;
}

// --- FUNCIÓN BOTÓN GPS ---
function locateMe(silentMode = false) {
    if (!navigator.geolocation) {
        if (!silentMode) alert("Tu navegador no soporta GPS.");
        return;
    }

    const btn = document.querySelector('.btn-gps');
    if (!silentMode && btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            updatePosition(pos.coords.latitude, pos.coords.longitude);
            if (!silentMode && btn) btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
        },
        (err) => {
            console.warn("Error GPS:", err);
            if (!silentMode && btn) {
                btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
                alert("No pudimos localizarte.");
            }
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

// --- BUSCADOR CALIBRADO PARA ESPAÑA ---
const searchInput = document.getElementById('addressSearch');
const suggestionsList = document.getElementById('suggestions-list');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = this.value;

        if (query.length < 3) { 
            suggestionsList.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });
}

function fetchSuggestions(query) {
    // AQUÍ ESTÁ EL CAMBIO: &countrycodes=es y &dedupe=1
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&addressdetails=1&limit=5&countrycodes=es&dedupe=1`)
        .then(response => response.json())
        .then(data => {
            suggestionsList.innerHTML = '';
            
            if (data.length > 0) {
                suggestionsList.classList.remove('hidden');
                data.forEach(place => {
                    const li = document.createElement('li');
                    li.innerText = place.display_name;
                    li.onclick = () => {
                        selectSuggestion(place.lat, place.lon, place.display_name);
                    };
                    suggestionsList.appendChild(li);
                });
            } else {
                suggestionsList.classList.add('hidden');
            }
        });
}

function selectSuggestion(lat, lon, name) {
    searchInput.value = name;
    suggestionsList.classList.add('hidden');
    updatePosition(lat, lon);
}

function searchLocation() {
    const query = searchInput.value;
    if (query) fetchSuggestions(query);
}

document.addEventListener('click', function(e) {
    if (e.target !== searchInput && e.target !== suggestionsList) {
        if(suggestionsList) suggestionsList.classList.add('hidden');
    }
});

// --- COOKIES ---
window.onload = function() {
    if (!localStorage.getItem('cookiesAccepted')) {
        setTimeout(() => {
            document.getElementById('cookie-banner').classList.remove('hidden-cookie');
        }, 1000);
    }
    
    // Fecha mínima hoy
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split("T")[0];
    }
}

function acceptCookies() {
    localStorage.setItem('cookiesAccepted', 'true');
    document.getElementById('cookie-banner').classList.add('hidden-cookie');
}

// --- ENVÍO FORMULARIO (Web3Forms JSON) ---
function handleFormSubmit(event, form) {
    event.preventDefault();
    loadingOverlay.classList.remove('hidden');
    
    const formData = new FormData(form);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);
    
    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: json
    })
    .then(async (response) => {
        let json = await response.json();
        if (response.status == 200) {
            loadingOverlay.classList.add('hidden');
            successOverlay.classList.remove('hidden');
            form.reset();
        } else {
            console.log(response);
            loadingOverlay.classList.add('hidden');
            alert("Error al enviar: " + json.message);
        }
    })
    .catch(error => {
        console.log(error);
        loadingOverlay.classList.add('hidden');
        alert("Algo salió mal. Inténtalo de nuevo.");
    });
}

if (formAssistance) {
    formAssistance.addEventListener('submit', (e) => handleFormSubmit(e, formAssistance));
}

if (formAppointment) {
    formAppointment.addEventListener('submit', (e) => handleFormSubmit(e, formAppointment));
}
