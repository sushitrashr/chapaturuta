import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Map as MapIcon, Loader2, AlertCircle, MapPin, ArrowUpDown, Navigation, Star, AlertTriangle, Home, Briefcase, Navigation2, Menu, BellRing } from 'lucide-react';
import Map from './Map';
import { dict } from './translations';

// Helper: Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const APP_TIPS = [
  "💡 Tip: Toca el botón del GPS (📍) para que el mapa vuele hacia donde estás parado.",
  "💡 Tip: Puedes arrastrar el pin rojo directamente sobre el mapa para apuntar exactamente adónde vas.",
  "💡 Tip: Usa el botón de flechas (Invertir) en el buscador para encontrar la ruta de regreso a casa.",
  "💡 Sabías que: Pronto podrás reportar tráfico o desvíos para ayudar a la comunidad de ChapaTuRuta.",
  "💡 Tip: Si pones un pin fuera de la ruta de la combi, te diremos cuánto tiempo tienes que caminar."
];

const TipWidget = ({ t }) => {
  const [currentTip, setCurrentTip] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentTip(prev => (prev + 1) % t.tips.length);
        setFade(true);
      }, 500);
    }, 7000);
    return () => clearInterval(interval);
  }, [t]);

  return (
    <div className="tip-widget-container">
      <div className={`tip-content ${fade ? 'fade-in' : 'fade-out'}`}>
        {t.tips[currentTip]}
      </div>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState('es');

  useEffect(() => {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang && browserLang.startsWith('en')) {
      setLang('en');
    }
  }, []);

  const t = dict[lang];

  const [currentScene, setCurrentScene] = useState('splash'); // splash, onboarding, main
  const [onboardStep, setOnboardStep] = useState(0);
  
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [selectingMode, setSelectingMode] = useState(null);
  const [hoveredRoute, setHoveredRoute] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [walkingRoutes, setWalkingRoutes] = useState({});
  const [walkingLoading, setWalkingLoading] = useState(false);

  // Phase 5 States
  const [navTab, setNavTab] = useState('explore'); // explore, saved, reports
  const [isTopBarExpanded, setIsTopBarExpanded] = useState(false);
  const [favorites, setFavorites] = useState({ home: null, work: null });
  const [reports, setReports] = useState([]); // { lat, lng, type }
  const [isReportingMode, setIsReportingMode] = useState(false);
  const [toast, setToast] = useState(null); // Nuevo sistema de notificaciones

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Phase 6: Scene Management
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasOnboarded = localStorage.getItem('chapaOnboarded');
      if (hasOnboarded) {
        setCurrentScene('main');
      } else {
        setCurrentScene('onboarding');
      }
    }, 1500); // 1.5 seconds splash
    return () => clearTimeout(timer);
  }, []);

  // Load favorites on mount
  useEffect(() => {
    const savedFavs = localStorage.getItem('chapaFavs');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
  }, []);

  const saveFavorite = (type, coords) => {
    const newFavs = { ...favorites, [type]: coords };
    setFavorites(newFavs);
    localStorage.setItem('chapaFavs', JSON.stringify(newFavs));
  };

  useEffect(() => {
    if (origin && !originText.includes('Cajamarca')) {
      setOriginText(`${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`);
    }
    if (dest && !destText.includes('Cajamarca')) {
      setDestText(`${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`);
    }
    setIsTopBarExpanded(false); // Collapse search on pick
  }, [origin, dest]);

  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Cajamarca, Peru')}&limit=1`);
      if (response.data && response.data.length > 0) {
        return { lat: parseFloat(response.data[0].lat), lng: parseFloat(response.data[0].lon) };
      }
      throw new Error("No encontrado");
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleSearch = async () => {
    setError(null);
    setSelectedRoute(null);
    setWalkingRoutes({});
    
    let finalOrigin = origin;
    let finalDest = dest;

    if (!finalOrigin && originText) {
      const coords = await geocodeAddress(originText);
      if (coords) { finalOrigin = coords; setOrigin(coords); }
    }
    if (!finalDest && destText) {
      const coords = await geocodeAddress(destText);
      if (coords) { finalDest = coords; setDest(coords); }
    }

    if (!finalOrigin || !finalDest) {
      setError('Por favor, selecciona punto de inicio y destino en el mapa o escribe direcciones válidas.');
      return;
    }

    setLoading(true);
    setIsTopBarExpanded(false);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${apiUrl}/api/routes/find`, {
        origin: finalOrigin,
        destination: finalDest,
      });

      if (res.data.routes && res.data.routes.length > 0) {
        setRoutes(res.data.routes);
      } else {
        setError('No se encontraron rutas directas para esta búsqueda.');
        setRoutes([]);
      }
    } catch (err) {
      setError('Error al buscar rutas. Revisa la consola o el backend.');
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateWalkingRoutes = async (route) => {
    if (!origin || !dest) return;
    setWalkingLoading(true);
    try {
      // MOCK DE DEMOSTRACIÓN: Calcular líneas de caminata desde el usuario hasta la ruta
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const firstPoint = route.lineString.coordinates[0];
      const lastPoint = route.lineString.coordinates[route.lineString.coordinates.length - 1];
      
      const originToRoute = [[origin.lat, origin.lng], [firstPoint[1], firstPoint[0]]];
      const routeToDest = [[lastPoint[1], lastPoint[0]], [dest.lat, dest.lng]];

      const distKm = calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng);
      const walkTime = Math.round((distKm / 4.5) * 60) + 3; // 4.5 km/h + 3 min de espera

      setWalkingRoutes({ originToRoute, routeToDest, walkTime, estimate: true, distKm });
    } catch (err) {
      console.error("Error fetching walking route:", err);
    } finally {
      setWalkingLoading(false);
    }
  };

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    calculateWalkingRoutes(route);
  };

  const handleSwap = () => {
    const tempO = origin;
    const tempOT = originText;
    setOrigin(dest); setOriginText(destText);
    setDest(tempO); setDestText(tempOT);
  };

  const handleFavClick = (type) => {
    if (favorites[type]) {
      setDest(favorites[type]);
      setDestText(type === 'home' ? 'Casa' : 'Trabajo');
      setIsTopBarExpanded(true); // Open search bar to let them pick origin
    } else {
      // Set current location as fav if they click it empty
      if (origin) {
        saveFavorite(type, origin);
        showToast(`${t.savedAs} ${type === 'home' ? t.home : t.work}`);
      } else {
        showToast(t.putOriginFirst);
      }
    }
  };

  const triggerReportingMode = () => {
    setIsReportingMode(true);
    setNavTab('explore'); // Ensure bottom sheet shows the reporting UI
  };

  const confirmReport = (typeRaw) => {
    const typesMap = {
      'Traffic': t.traffic, 'Accident': t.accident, 'Closed': t.closedRoad, 'Police': t.police,
      'Tráfico': t.traffic, 'Accidente': t.accident, 'Cerrada': t.closedRoad, 'Policía': t.police
    };
    const translatedType = typesMap[typeRaw] || typeRaw;
    const saveType = `${typeRaw === 'Traffic' || typeRaw === 'Tráfico' ? '🚗' : typeRaw === 'Accident' || typeRaw === 'Accidente' ? '💥' : typeRaw === 'Closed' || typeRaw === 'Cerrada' ? '🚧' : '👮'} ${translatedType}`;

    if (origin) {
      setReports([...reports, { lat: origin.lat, lng: origin.lng, type: saveType }]);
      setIsReportingMode(false);
      showToast(t.reportSent);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setReports([...reports, { lat: pos.coords.latitude, lng: pos.coords.longitude, type: saveType }]);
          setIsReportingMode(false);
          showToast(t.reportSentLoc);
        },
        (err) => {
          setReports([...reports, { lat: -7.164, lng: -78.518, type: saveType }]);
          setIsReportingMode(false);
          showToast(t.reportSentFallback);
        }
      );
    } else {
      setReports([...reports, { lat: -7.164, lng: -78.518, type: saveType }]);
      setIsReportingMode(false);
      showToast(t.reportSentFallback);
    }
  };

  // Phase 6: Scene Renders
  if (currentScene === 'splash') {
    return (
      <div className="splash-screen">
        <img src="/icon.png" alt="Logo" className="splash-logo" />
        <h1 className="splash-title">ChapaTuRuta</h1>
      </div>
    );
  }

  if (currentScene === 'onboarding') {
    const slides = [
      { title: t.findRouteTitle, desc: t.findRouteDesc, icon: "🚐" },
      { title: t.favTitle, desc: t.favDesc, icon: "⭐" },
      { title: t.liveTitle, desc: t.liveDesc, icon: "⚠️" }
    ];
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content">
          <div style={{fontSize: '5rem', marginBottom: '1rem'}}>{slides[onboardStep].icon}</div>
          <h1>{slides[onboardStep].title}</h1>
          <p>{slides[onboardStep].desc}</p>
          
          <div className="dots-container">
            {slides.map((_, i) => <div key={i} className={`dot ${i === onboardStep ? 'active' : ''}`}></div>)}
          </div>

          <button 
            className="onboarding-btn primary"
            onClick={() => {
              if (onboardStep < slides.length - 1) {
                setOnboardStep(onboardStep + 1);
              } else {
                localStorage.setItem('chapaOnboarded', 'true');
                setCurrentScene('main');
              }
            }}
          >
            {onboardStep < slides.length - 1 ? t.nextBtn : t.startBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Map 
        origin={origin} dest={dest} 
        setOrigin={setOrigin} setDest={setDest} 
        routes={routes}
        selectingMode={selectingMode} setSelectingMode={setSelectingMode}
        hoveredRoute={hoveredRoute} selectedRoute={selectedRoute}
        walkingRoutes={walkingRoutes}
        reports={reports}
      />

      <div className="ui-layer">
        
        {/* TOP FLOATING SEARCH BAR */}
        <div className={`clickable-ui top-floating-bar ${isTopBarExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="top-bar-header" onClick={() => setIsTopBarExpanded(!isTopBarExpanded)}>
            {!isTopBarExpanded ? (
              <div className="search-mock-input">
                <Menu size={20} color="var(--text-muted)" />
                {originText || destText ? 
                  <span>{originText ? (originText.substring(0,10)+'...') : t.origin} &rarr; {destText ? (destText.substring(0,10)+'...') : t.destination}</span>
                  : <span>{t.whereTo}</span>
                }
              </div>
            ) : (
              <div className="app-logo-text">ChapaTuRuta</div>
            )}
          </div>

          <div className="points-container">
            <div className="inputs-wrapper" style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <div className="point-row">
                <div className="point-dot origin"></div>
                <input 
                  type="text" className="point-input" placeholder={t.whereAreYou} 
                  value={originText} onChange={(e) => setOriginText(e.target.value)} 
                />
                <button 
                  className={`map-pick-btn ${selectingMode === 'origin' ? 'active' : ''}`}
                  onClick={() => setSelectingMode('origin')} title="Elegir en el mapa"
                >
                  <MapPin size={20} />
                </button>
              </div>

              <div className="point-row">
                <div className="point-dot dest"></div>
                <input 
                  type="text" className="point-input" placeholder={t.whereTo} 
                  value={destText} onChange={(e) => setDestText(e.target.value)} 
                />
                <button 
                  className={`map-pick-btn ${selectingMode === 'dest' ? 'active' : ''}`}
                  onClick={() => setSelectingMode('dest')} title="Elegir en el mapa"
                >
                  <MapPin size={20} />
                </button>
              </div>

              <button className="swap-btn" onClick={handleSwap} title="Invertir"><ArrowUpDown size={18}/></button>
            </div>

            <button className="search-btn" onClick={handleSearch} disabled={loading || (!origin && !originText) || (!dest && !destText)}>
              {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
              <span>{loading ? 'Buscando...' : 'Buscar Rutas'}</span>
            </button>
          </div>

          {isTopBarExpanded && (
            <div className="filters-container">
              <div className="filter-pill active">🚶 Menos caminata</div>
              <div className="filter-pill">⚡ Más rápido</div>
              <div className="filter-pill">🚐 Solo combis</div>
            </div>
          )}
        </div>

        {/* FLOATING ACTION BUTTONS */}
        <div className="clickable-ui fabs-container">
          <div className="fab report" onClick={triggerReportingMode} title="Reportar incidente">
            <BellRing size={24} />
          </div>
          <div className="fab" onClick={() => navigator.geolocation.getCurrentPosition(pos => { setOrigin({lat: pos.coords.latitude, lng: pos.coords.longitude}); setSelectingMode(null); })} title="Mi ubicación">
            <Navigation2 size={24} />
          </div>
        </div>

        {/* BOTTOM SHEET */}
        <div className={`clickable-ui bottom-sheet ${(routes.length > 0 || isTopBarExpanded || navTab === 'saved' || selectedRoute || isReportingMode) ? 'open' : ''}`}>
          <div className="sheet-handle"></div>
          
          {isReportingMode ? (
            <div className="results-container">
              <div className="results-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span>{t.whatsHappening}</span>
                <button onClick={() => setIsReportingMode(false)} style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem'}}>&times;</button>
              </div>
              <div className="report-grid">
                <div className="report-btn" onClick={() => confirmReport('Traffic')}>
                  <div className="report-icon">🚗</div>
                  <span>{t.traffic}</span>
                </div>
                <div className="report-btn" onClick={() => confirmReport('Accident')}>
                  <div className="report-icon">💥</div>
                  <span>{t.accident}</span>
                </div>
                <div className="report-btn" onClick={() => confirmReport('Closed')}>
                  <div className="report-icon">🚧</div>
                  <span>{t.closedRoad}</span>
                </div>
                <div className="report-btn" onClick={() => confirmReport('Police')}>
                  <div className="report-icon">👮</div>
                  <span>{t.police}</span>
                </div>
              </div>
            </div>
          ) : selectedRoute ? (
             <div className="details-view">
              <button className="back-btn" onClick={() => setSelectedRoute(null)}>
                &larr; {t.backToResults}
              </button>
              <h2 style={{marginTop: '1rem', color: selectedRoute.color}}>{selectedRoute.name}</h2>
              <div style={{display: 'flex', gap: '1rem', margin: '1rem 0'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)'}}>
                  <MapPin size={16} /> <span>{selectedRoute.distance} {t.kmRoute}</span>
                </div>
              </div>
              
              <div className="timeline-container">
                {walkingRoutes && walkingRoutes.originToRoute && (
                  <div className="timeline-item">
                    <div className="timeline-icon"><Navigation size={16} /></div>
                    <div className="timeline-content">
                      <strong>{t.walk} {walkingRoutes.walkTime} {t.min}</strong>
                      <p>Hacia la ruta de la combi</p>
                    </div>
                  </div>
                )}
                
                <div className="timeline-item">
                  <div className="timeline-icon" style={{background: selectedRoute.color, color: 'white'}}>
                    <Navigation size={16} />
                  </div>
                  <div className="timeline-content">
                    <strong>{t.board} {selectedRoute.name}</strong>
                    <p>{t.rideToDest}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : navTab === 'saved' ? (
            /* Render Favorites */
            <div className="results-container">
              <div className="results-header">{t.savedPlaces}</div>
              <div className="favorites-grid">
                <div className="fav-btn" onClick={() => handleFavClick('home')}>
                  <div className="fav-icon"><Home size={20} /></div>
                  <span>{t.home}</span>
                  <span style={{fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal'}}>
                    {favorites.home ? t.goNow : t.tapToSave}
                  </span>
                </div>
                <div className="fav-btn" onClick={() => handleFavClick('work')}>
                  <div className="fav-icon"><Briefcase size={20} /></div>
                  <span>{t.work}</span>
                  <span style={{fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal'}}>
                    {favorites.work ? t.goNow : t.tapToSave}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Render Route List */
            <div className="results-container">
              {loading ? (
                <>
                  <div className="skeleton-item skeleton"><div className="route-color skeleton-color"></div><div className="route-info"><div className="skeleton-text-1 skeleton"></div><div className="skeleton-text-2 skeleton"></div></div></div>
                  <div className="skeleton-item skeleton"><div className="route-color skeleton-color"></div><div className="route-info"><div className="skeleton-text-1 skeleton"></div><div className="skeleton-text-2 skeleton"></div></div></div>
                </>
              ) : routes.length > 0 ? (
                <>
                  <div className="results-header">{t.recommendedRoutes} ({routes.length})</div>
                  {routes.map((route, i) => (
                    <div 
                      key={i} className="route-item"
                      onMouseEnter={() => setHoveredRoute(route)} onMouseLeave={() => setHoveredRoute(null)}
                      onClick={() => handleRouteSelect(route)}
                    >
                      <div className="route-color" style={{ backgroundColor: route.color }}></div>
                      <div className="route-info">
                        <h3>{route.name}</h3>
                        <p>{route.distance} {t.kmRoute}</p>
                      </div>
                      <Navigation size={20} color="var(--primary)" />
                    </div>
                  ))}
                </>
              ) : (
                <div style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '1rem'}}>
                  <MapIcon size={48} style={{opacity: 0.1, marginBottom: '1rem'}} />
                  <p style={{marginBottom: '1.5rem'}}>{t.whereToToday}</p>
                  <TipWidget t={t} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM NAV BAR */}
        <div className="clickable-ui bottom-nav">
          <div className={`nav-item ${navTab === 'explore' ? 'active' : ''}`} onClick={() => setNavTab('explore')}>
            <MapIcon size={24} />
            <span>{t.explore}</span>
          </div>
          <div className={`nav-item ${navTab === 'saved' ? 'active' : ''}`} onClick={() => setNavTab('saved')}>
            <Star size={24} />
            <span>{t.saved}</span>
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        <div className={`toast-notification ${toast ? 'visible' : ''}`}>
          {toast}
        </div>

        {/* TOASTS */}
        <div className="toast-container">
          {error && (
            <div className="toast" style={{background: '#EF4444'}}>
              <AlertCircle size={20} /><span>{error}</span>
            </div>
          )}
          {selectingMode && (
            <div className="toast" style={{background: 'var(--text-main)'}}>
              <MapPin size={20} /><span>Toca el mapa para seleccionar {selectingMode === 'origin' ? 'Origen' : 'Destino'}</span>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
