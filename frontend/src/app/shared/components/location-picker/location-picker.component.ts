import { Component, EventEmitter, Input, NgZone, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './location-picker.component.html',
  styleUrls: ['./location-picker.component.scss']
})
export class LocationPickerComponent implements OnInit, OnChanges {
  @Input() initialLocation?: { lat: number; lng: number } | null;
  @Input() apiKey?: string | null;
  @Input() mapId?: string | null;

  @Output() saved = new EventEmitter<{ lat: number; lng: number }>();
  @Output() cancel = new EventEmitter<void>();

  map: any = null;
  marker: any = null;
  loading = true;
  error: string | null = null;

  constructor(private zone: NgZone, private http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.loadMaps();
    } catch (e: any) {
      console.error('Error cargando Maps:', e);
      this.error = e?.message || 'No se pudo cargar el mapa';
    } finally {
      // Mark loading false so the template can render the internal map container
      // (the map div is only present when loading === false). We defer initMap
      // to the next tick so Angular has time to render the DOM node with
      // id="shared-location-picker-map" before Google Maps attaches to it.
      this.loading = false;
      // Defer initialization to ensure the inner div exists in the DOM.
      setTimeout(() => {
        try { this.initMap(); } catch (err) { console.error('initMap error:', err); }
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If initialLocation is provided/updated after the map has been created,
    // update the marker & center accordingly.
    if (changes['initialLocation'] && this.map && this.initialLocation) {
      try {
        this.setLocation(this.initialLocation);
      } catch (e) {
        // Ignore errors during change reaction
      }
    }
  }

  /** Set marker position and recenter map to the given location */
  private setLocation(loc: { lat: number; lng: number } | null | undefined): void {
    const win: any = window as any;
    if (!loc || !this.map) return;
    const pos = { lat: loc.lat, lng: loc.lng };
    try {
      if (this.marker) {
        if (typeof this.marker.setPosition === 'function') {
          this.marker.setPosition(pos);
        } else if ('position' in this.marker) {
          (this.marker as any).position = pos;
        } else if (typeof (this.marker as any).set === 'function') {
          (this.marker as any).set('position', pos);
        }
      }
      // Recenter map
      if (win.google && win.google.maps && this.map) {
        this.map.setCenter(pos);
      }
    } catch (e) {
      console.error('Error setting location on map:', e);
    }
  }

  private async loadMaps(): Promise<void> {
    // Try to use the official loader if available (we dynamically import it)
    const win: any = window as any;
    if (win.google && win.google.maps) return;

    try {
      const module = await import('@googlemaps/js-api-loader');
      const Loader = module.Loader;
      const loader = new Loader({
        apiKey: this.apiKey || (win.__GMAPS_API_KEY__ || ''),
        libraries: ['marker'],
        // pass mapIds when available so advanced markers / styling work
        mapIds: this.mapId ? [this.mapId] : undefined
      });
      await loader.load();
      return;
    } catch (err) {
      // Fallback to direct script injection
      return new Promise((resolve, reject) => {
        const apiKey = this.apiKey || (win.__GMAPS_API_KEY__ || '');
        const libs = 'marker';
        const mapIdParam = this.mapId ? `&map_ids=${encodeURIComponent(this.mapId)}` : '';
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${libs}${mapIdParam}&callback=__initLocationPicker`;
        script.async = true;
        script.defer = true;
        (win as any).__initLocationPicker = () => {
          resolve(undefined);
        };
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });
    }
  }

  private initMap(): void {
    const win: any = window as any;
    if (!win.google || !win.google.maps) {
      this.error = 'Google Maps no disponible';
      return;
    }

    const center = this.initialLocation || { lat: 4.6150, lng: -74.0500 };
    const mapEl = document.getElementById('shared-location-picker-map');
    if (!mapEl) {
      // If the element is still not found, log to help debugging. The caller
      // should have deferred init until the template rendered, so this likely
      // indicates a template id mismatch.
      console.error("LocationPicker: map container with id 'shared-location-picker-map' not found in DOM.");
      return;
    }

    this.map = new win.google.maps.Map(mapEl, {
      center,
      zoom: 12,
      mapId: this.mapId || undefined
    });

    // Create marker (prefer AdvancedMarkerElement)
    try {
      if (win.google.maps.marker && win.google.maps.marker.AdvancedMarkerElement) {
        this.marker = new win.google.maps.marker.AdvancedMarkerElement({
          position: center,
          map: this.map,
          title: 'Selecciona ubicación'
        });
      } else {
        this.marker = new win.google.maps.Marker({ position: center, map: this.map, draggable: true });
      }
    } catch (e) {
      this.marker = new win.google.maps.Marker({ position: center, map: this.map, draggable: true });
    }

    // Click map to move marker
    this.map.addListener('click', (e: any) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      try {
        if (!this.marker) return;
        // Prefer setPosition (Marker), but AdvancedMarkerElement uses a
        // .position property. Try multiple strategies to be defensive.
        if (typeof this.marker.setPosition === 'function') {
          this.marker.setPosition(pos);
        } else if ('position' in this.marker) {
          try {
            // AdvancedMarkerElement accepts a LatLngLiteral
            (this.marker as any).position = pos;
          } catch (inner) {
            if (typeof (this.marker as any).set === 'function') {
              (this.marker as any).set('position', pos);
            }
          }
        } else if (typeof (this.marker as any).set === 'function') {
          (this.marker as any).set('position', pos);
        }
      } catch (err) {
        console.error('Failed moving marker:', err);
      }
    });

    // Sometimes the map appears blank if the container was hidden when initialized.
    // Trigger a resize and re-center after a short tick to ensure tiles render.
    setTimeout(() => {
      try {
        if (win.google && win.google.maps && this.map) {
          win.google.maps.event.trigger(this.map, 'resize');
          this.map.setCenter(center);
        }
      } catch (e) { /* ignore */ }
    }, 100);
  }

  save(): void {
    if (!this.marker) return;
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (typeof this.marker.getPosition === 'function') {
        const p: any = this.marker.getPosition();
        lat = typeof p.lat === 'function' ? p.lat() : p.lat;
        lng = typeof p.lng === 'function' ? p.lng() : p.lng;
      } else if (this.marker.position) {
        const p: any = this.marker.position;
        lat = typeof p.lat === 'function' ? p.lat() : p.lat;
        lng = typeof p.lng === 'function' ? p.lng() : p.lng;
      } else if ((this.marker as any).geometry && (this.marker as any).geometry.location) {
        const p: any = (this.marker as any).geometry.location;
        lat = typeof p.lat === 'function' ? p.lat() : p.lat;
        lng = typeof p.lng === 'function' ? p.lng() : p.lng;
      }
      if (lat == null || lng == null) {
        console.warn('LocationPicker.save: could not determine marker coordinates');
        return;
      }

      // Prefer to send the update directly to the backend for a quicker UX.
      const payload = { location: { lat, lng } };
      const url = `${environment.apiBaseUrl}/update-me`;

      this.http.post<any>(url, payload).subscribe({
        next: (res) => {
          console.log('Location saved to backend:', res);
          // Emit saved so parent can update UI as well.
          this.zone.run(() => this.saved.emit({ lat, lng }));
          // Optionally close the picker by emitting cancel (parent can choose to hide)
          this.zone.run(() => this.cancel.emit());
        },
        error: (err) => {
          console.error('Failed saving location to backend:', err);
          // Still emit saved locally so parent can handle it if desired
          this.zone.run(() => this.saved.emit({ lat, lng }));
        }
      });
    } catch (e) {
      console.error('Error leyendo posición:', e);
    }
  }

  doCancel(): void {
    this.cancel.emit();
  }
}
