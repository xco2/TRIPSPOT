import React, { useEffect, useRef } from 'react';
import { MAP_CONTAINER_ID } from '../constants';
import { LocationItem } from '../types';

interface MapContainerProps {
  locations: LocationItem[];
  selectedIds: Set<string>;
  routeSequence: string[] | null;
  mapLoaded: boolean;
}

const MapContainer: React.FC<MapContainerProps> = ({ locations, selectedIds, routeSequence, mapLoaded }) => {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (mapLoaded && !mapRef.current && window.AMap) {
      try {
        mapRef.current = new window.AMap.Map(MAP_CONTAINER_ID, {
          zoom: 11,
          center: [104.06, 30.67], // Default Chengdu
          mapStyle: 'amap://styles/whitesmoke', // Light minimalist style
          viewMode: '2D',
        });
      } catch (e) {
        console.error("Map Init Error", e);
      }
    }
  }, [mapLoaded]);

  // Update Markers and Polyline
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing
    mapRef.current.remove(markersRef.current);
    if (polylineRef.current) mapRef.current.remove(polylineRef.current);
    markersRef.current = [];

    // Add Markers
    locations.forEach((loc) => {
      const isSelected = selectedIds.has(loc.id);
      const sequenceIndex = routeSequence ? routeSequence.indexOf(loc.id) : -1;
      const label = sequenceIndex >= 0 ? `${sequenceIndex + 1}` : '';

      const content = `
        <div class="custom-marker ${isSelected ? 'selected' : 'inactive'}">
          ${label}
        </div>
      `;

      const marker = new window.AMap.Marker({
        position: [loc.lng, loc.lat],
        content: content,
        offset: new window.AMap.Pixel(-12, -12),
        anchor: 'center',
        title: loc.name
      });
      
      marker.setMap(mapRef.current);
      markersRef.current.push(marker);
    });

    // Fit View
    if (locations.length > 0) {
      mapRef.current.setFitView();
    }

    // Draw Route
    if (routeSequence && routeSequence.length > 1) {
      const path = routeSequence
        .map(id => locations.find(l => l.id === id))
        .filter(Boolean)
        .map(l => [l!.lng, l!.lat]);

      polylineRef.current = new window.AMap.Polyline({
        path: path,
        isOutline: false,
        borderWeight: 2,
        strokeColor: "#000000", 
        strokeOpacity: 1,
        strokeWeight: 2,
        strokeStyle: "dashed",
        strokeDasharray: [10, 5],
        lineJoin: 'round',
        lineCap: 'round',
        showDir: true,
      });

      mapRef.current.add(polylineRef.current);
    }

  }, [locations, selectedIds, routeSequence, mapLoaded]);

  return (
    <div className="relative w-full h-full border border-black shadow-hard overflow-hidden bg-white">
      <div id={MAP_CONTAINER_ID} className="w-full h-full" />
      
      {/* Tangible Controls (Zoom) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button 
          onClick={() => mapRef.current?.zoomIn()}
          className="w-10 h-10 bg-white border border-black shadow-hard flex items-center justify-center font-bold hover:translate-y-[2px] hover:shadow-hard-sm active:translate-y-[4px] active:shadow-none"
        >
          +
        </button>
        <button 
          onClick={() => mapRef.current?.zoomOut()}
          className="w-10 h-10 bg-white border border-black shadow-hard flex items-center justify-center font-bold hover:translate-y-[2px] hover:shadow-hard-sm active:translate-y-[4px] active:shadow-none"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default MapContainer;