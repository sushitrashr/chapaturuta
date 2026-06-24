import React, { useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';

// Create custom icons using DivIcon for Origin and Dest
const createCustomIcon = (type) => {
  return L.divIcon({
    html: `<div class="custom-marker-wrapper">
             <div class="marker-pulse ${type}"></div>
             <div class="custom-marker ${type}"></div>
           </div>`,
    className: 'custom-icon-container',
    iconSize: [20, 20],
    iconAnchor: [0, 0]
  });
};

const originIcon = createCustomIcon('origin');
const destIcon = createCustomIcon('dest');

// Create a bus icon using Lucide React SVG
const busSvgMarkup = renderToStaticMarkup(<Navigation size={20} color="#ffffff" fill="#ffffff" style={{transform: 'rotate(45deg)'}} />);
const busIcon = L.divIcon({
  html: `<div class="bus-marker" style="background-color: var(--primary); padding: 5px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); width: 30px; height: 30px;">
          ${busSvgMarkup}
         </div>`,
  className: 'bus-icon-container',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Create report icon
const createReportIcon = (typeString) => {
  const emoji = typeString.split(' ')[0];
  return L.divIcon({
    html: `<div class="report-marker" style="font-size: 24px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: 'report-icon-container',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

// Create Bus Stop (Paradero) icon matching Google Maps style
const busStopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>`;

const busStopIcon = L.divIcon({
  html: `<div class="bus-stop-marker" style="background-color: #2563EB; border: 1.5px solid #ffffff; width: 16px; height: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          ${busStopSvg}
         </div>`,
  className: 'bus-stop-icon-container',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Generador de paraderos mockeados para simular toda la ciudad de Cajamarca
const mockParaderos = [];

// Draggable Marker Component
const DraggableMarker = ({ position, setPosition, icon }) => {
  const markerRef = useRef(null);
  const eventHandlers = React.useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPosition({ lat: newPos.lat, lng: newPos.lng });
      }
    },
  }), [setPosition]);

  return (
    <Marker draggable={true} eventHandlers={eventHandlers} position={position} icon={icon} ref={markerRef} />
  );
};

// Component to handle map clicks for selecting Origin/Dest
const MapEvents = ({ selectingMode, setSelectingMode, setOrigin, setDest }) => {
  useMapEvents({
    click(e) {
      if (selectingMode === 'origin') {
        setOrigin(e.latlng);
        setSelectingMode(null);
      } else if (selectingMode === 'dest') {
        setDest(e.latlng);
        setSelectingMode(null);
      }
    },
  });
  return null;
};

// Component to recenter map and fit bounds
const MapCenterer = ({ origin, dest, selectedRoute }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedRoute) return; // Si hay una ruta seleccionada, no mover la cámara por los pines
    
    if (origin && dest) {
      const bounds = L.latLngBounds([origin, dest]);
      map.fitBounds(bounds, { paddingBottomRight: [0, 300], paddingTopLeft: [0, 100], maxZoom: 16 });
    } else if (origin) {
      map.flyTo(origin, 16, { animate: true, duration: 1.5 });
    } else if (dest) {
      map.flyTo(dest, 16, { animate: true, duration: 1.5 });
    }
  }, [origin, dest, map, selectedRoute]);
  return null;
};

// Component to animate bus along the route
const AnimatedBus = ({ routeLine }) => {
  const [position, setPosition] = React.useState(null);
  
  useEffect(() => {
    if (!routeLine || routeLine.coordinates.length === 0) return;
    
    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const coords = routeLine.coordinates.map(c => [c[1], c[0]]);
    setPosition(coords[0]);

    let step = 0;
    const totalSteps = coords.length;
    const interval = setInterval(() => {
      step = (step + 1) % totalSteps;
      setPosition(coords[step]);
    }, 150); // Move every 150ms

    return () => clearInterval(interval);
  }, [routeLine]);

  if (!position) return null;
  return <Marker position={position} icon={busIcon} zIndexOffset={2000} />;
};

export default function Map({ origin, dest, setOrigin, setDest, routes, selectingMode, setSelectingMode, hoveredRoute, selectedRoute, walkingRoutes, reports }) {
  const center = [-7.164, -78.518];
  // Google Maps Standard Tile Layer
  const tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
  const attribution = '&copy; Google Maps';

  const routesToRender = selectedRoute ? [selectedRoute] : routes;

  // Render walking routes
  const renderWalkingLine = (routeObj) => {
    if (!routeObj || !routeObj.geometry) return null;
    const coords = routeObj.geometry.coordinates.map(c => [c[1], c[0]]);
    return (
      <Polyline positions={coords} color={'#41549a'} weight={4} dashArray="5, 10" opacity={0.6} />
    );
  };

  return (
    <div className="map-container">
      {/* Remove default zoomControl to avoid it being hidden under UI, add manually */}
      <MapContainer center={center} zoom={15} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tileUrl} attribution={attribution} />
        <ZoomControl position="topright" />
        <MapCenterer origin={origin} dest={dest} selectedRoute={selectedRoute} />
        <MapEvents selectingMode={selectingMode} setSelectingMode={setSelectingMode} setOrigin={setOrigin} setDest={setDest} />
        
        {/* Render Paraderos */}
        {mockParaderos.map((p) => (
          <Marker key={`p-${p.id}`} position={[p.lat, p.lng]} icon={busStopIcon}>
            {/* Popups opcionales si quieres que al hacer clic muestre el nombre */}
          </Marker>
        ))}

        {/* Render Origins and Dests */}
        {origin && <DraggableMarker position={origin} setPosition={setOrigin} icon={originIcon} />}
        {dest && <DraggableMarker position={dest} setPosition={setDest} icon={destIcon} />}

        {/* Render Reports (Waze style) */}
        {reports && reports.map((r, idx) => (
           <Marker key={idx} position={[r.lat, r.lng]} icon={createReportIcon(r.type)} />
        ))}

        {/* Render Combi Routes */}
        {routesToRender.map((route, i) => {
          const isHovered = hoveredRoute?.name === route.name;
          const isSelected = selectedRoute?.name === route.name;
          // Dim other routes if one is hovered, unless it's selected view
          const opacity = selectedRoute ? 0.8 : (hoveredRoute && !isHovered ? 0.2 : 0.7);
          const weight = (isHovered || isSelected) ? 6 : 4;
          
          if (!route.lineString) return null;
          const coords = route.lineString.coordinates.map(c => [c[1], c[0]]);
          return (
            <React.Fragment key={i}>
              <Polyline 
                positions={coords} 
                color={route.color} 
                weight={weight} 
                opacity={opacity} 
                pathOptions={{
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
              {/* Only animate bus on the selected route to avoid clutter */}
              {isSelected && <AnimatedBus routeLine={route.lineString} />}
            </React.Fragment>
          );
        })}

        {/* Render Walking Lines if selected */}
        {selectedRoute && walkingRoutes.originToRoute && renderWalkingLine(walkingRoutes.originToRoute)}
        {selectedRoute && walkingRoutes.routeToDest && renderWalkingLine(walkingRoutes.routeToDest)}
      </MapContainer>
    </div>
  );
}
