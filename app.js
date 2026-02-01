// --- VARIABLES GLOBALES ---
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
    switchScreen('screen-home');
    
    // Forzar cierre de overlays
    if(successOverlay) successOverlay.classList.add('hidden');
    if(loadingOverlay) loadingOverlay.classList.add('hidden');
    
    // Limpiar formularios y bordes rojos
    if(formAssistance) {
        formAssistance.reset();
        clearErrors(formAssistance);
    }
    if(formAppointment) {
        formAppointment.reset();
        clearErrors(formAppointment);
    }
}

function clearErrors(form) {
    const inputs = form.querySelectorAll('input');
    inputs.forEach(i => i.style.border = "");
}

function goToAppointment() { switchScreen('screen-appointment'); }

function goToAssistance() {
    switchScreen('screen-assistance');
    setTimeout(initMap, 300); 
}

// --- MAPA (Leaflet) ---
function initMap() {
    if (map) {
        map.invalidateSize();
        return;
    }
    
    // Coordenadas iniciales (Centro España o Tarragona por defecto)
    let lat = 41.118; 
    let lng = 1.245;

    map = L.map('map').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    marker = L.marker([lat, lng], {draggable: true}).addTo(map);

    locateMe(true); // Intenta localizar al iniciar

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
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const linkInput = document.getElementById('gmaps_link');

    if(latInput) latInput.value = lat;
    if(lngInput) lngInput.value = lng;
    if(linkInput) linkInput.value = `http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`;
}

// --- GPS BOTÓN ---
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
                if(!silentMode) alert("No pudimos localizarte. Mueve el mapa manualmente.");
            }
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

// --- BUSCADOR ---
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
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&addressdetails=1&limit=5&countrycodes=es&dedupe=1`;
    
    if (map) {
        const bounds = map.getBounds();
        const viewbox = `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
        url += `&viewbox=${viewbox}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if(suggestionsList) {
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
            }
        });
}

function selectSuggestion(lat, lon, name) {
    if(searchInput) searchInput.value = name;
    if(suggestionsList) suggestionsList.classList.add('hidden');
    updatePosition(lat, lon);
}

function searchLocation() {
    if(searchInput) {
        const query = searchInput.value;
        if (query) fetchSuggestions(query);
    }
}

document.addEventListener('click', function(e) {
    if (searchInput && suggestionsList && e.target !== searchInput && e.target !== suggestionsList) {
        suggestionsList.classList.add('hidden');
    }
});

// --- COOKIES ---
window.onload = function() {
    if (!localStorage.getItem('cookiesAccepted')) {
        setTimeout(() => {
            const banner = document.getElementById('cookie-banner');
            if(banner) banner.classList.remove('hidden-cookie');
        }, 1000);
    }
    
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split("T")[0];
    }
    
    // Iniciar el slider cuando carga la página
    startSlider();
}

function acceptCookies() {
    localStorage.setItem('cookiesAccepted', 'true');
    const banner = document.getElementById('cookie-banner');
    if(banner) banner.classList.add('hidden-cookie');
}

// --- LÓGICA DE ENVÍO Y VALIDACIÓN ---

function handleFormSubmit(event, form) {
    event.preventDefault(); // 1. DETENEMOS EL ENVÍO INMEDIATAMENTE

    // 2. BUSCAMOS EL CAMPO DE TELÉFONO
    const phoneInput = form.querySelector('input[name="telefono"]');
    
    // 3. VALIDACIÓN ESTRICTA
    if (phoneInput) {
        // Limpiamos espacios para contar solo números reales
        const cleanNumber = phoneInput.value.replace(/\D/g, ''); 
        
        if (cleanNumber.length < 9) {
            alert("⚠️ El teléfono debe tener al menos 9 números.");
            phoneInput.style.border = "2px solid red"; // Borde rojo
            phoneInput.focus();
            return; // ¡ALTO! AQUÍ SE DETIENE LA FUNCIÓN. NO SIGUE.
        } else {
            phoneInput.style.border = ""; // Quitamos borde rojo si está bien
        }
    }

    // 4. SI PASA LA VALIDACIÓN, ENVIAMOS
    if(loadingOverlay) loadingOverlay.classList.remove('hidden');
    
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
            if(loadingOverlay) loadingOverlay.classList.add('hidden');
            if(successOverlay) successOverlay.classList.remove('hidden');
            form.reset();
        } else {
            console.log(response);
            if(loadingOverlay) loadingOverlay.classList.add('hidden');
            alert("Error al enviar: " + json.message);
        }
    })
    .catch(error => {
        console.log(error);
        if(loadingOverlay) loadingOverlay.classList.add('hidden');
        alert("Algo salió mal. Inténtalo de nuevo.");
    });
}

// Asignamos los eventos de envío
if (formAssistance) {
    formAssistance.addEventListener('submit', (e) => handleFormSubmit(e, formAssistance));
}

if (formAppointment) {
    formAppointment.addEventListener('submit', (e) => handleFormSubmit(e, formAppointment));
}

// --- LIMPIEZA AUTOMÁTICA DE LETRAS ---
document.addEventListener('DOMContentLoaded', function() {
    const phoneInputs = document.querySelectorAll('input[name="telefono"]');
    
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if(this.value.length >= 9) {
                this.style.border = "";
            }
        });
    });
});

// --- CAROUSEL / SLIDER (Lógica Nueva) ---
let slideIndex = 0;
let slideInterval;
const slideDelay = 4000; // 4 segundos por imagen

function startSlider() {
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    
    showSlide(slideIndex);
    resetTimer();
}

function moveSlide(n) {
    const slides = document.querySelectorAll('.carousel-slide');
    slideIndex += n;
    
    if (slideIndex >= slides.length) slideIndex = 0;
    if (slideIndex < 0) slideIndex = slides.length - 1;
    
    showSlide(slideIndex);
    resetTimer(); // Reinicia el contador si el usuario toca las flechas
}

function showSlide(index) {
    const track = document.getElementById('carouselTrack');
    if(track) {
        track.style.transform = `translateX(-${index * 100}%)`;
    }
}

function resetTimer() {
    clearInterval(slideInterval);
    
    // Reiniciar la animación de la barra
    const bar = document.getElementById('progressBar');
    if (bar) {
        bar.classList.remove('animating');
        void bar.offsetWidth; // Forzar reflow para reiniciar CSS animation
        bar.classList.add('animating');
    }

    slideInterval = setInterval(() => {
        moveSlide(1);
    }, slideDelay);
}
