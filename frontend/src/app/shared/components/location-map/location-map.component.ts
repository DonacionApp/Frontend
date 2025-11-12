import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-location-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './location-map.component.html',
  styleUrls: ['./location-map.component.scss']
})
export class LocationMapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() location?: { lat: number; lng: number } | null;
  @Input() apiKey?: string | null;
  @Input() mapId?: string | null;
  @Input() zoom = 12;
  @Input() showMarker = true;

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;

  map: any = null;
  marker: any = null;
  circle: any = null;
  loading = true;
  error: string | null = null;
  showStaticFallback = false;
  // diagnostics visible in template
  public scriptUrl: string | null = null;
  public mapCreated = false;

  private destroyed = false;

  constructor(private zone: NgZone, private sanitizer: DomSanitizer) {}

  async ngOnInit(): Promise<void> {
    const win: any = window as any;
    const hasKey = !!(this.apiKey || win.__GMAPS_API_KEY__);
    if (!hasKey) {
      this.loading = false;
      this.error = 'Falta clave de Google Maps';
      return;
    }

    try {
      await this.loadMaps();
    } catch (e: any) {
      console.warn('LocationMap: loadMaps failed, will show static map fallback', e);
      this.error = e?.message || 'No se pudo cargar Google Maps';
    } finally {
      this.loading = false;
      this.maybeInitMap();
    }
  }

  private setLocation(loc?: { lat: number; lng: number } | null): void {
    const win: any = window as any;
    if (!loc || !this.map) return;
    const pos = { lat: loc.lat, lng: loc.lng };
    try {
      if (this.marker) {
        try {
          if (typeof this.marker.setPosition === 'function') {
            this.marker.setPosition(pos);
          } else if (typeof this.marker.setOptions === 'function') {
            this.marker.setOptions({ position: pos });
          } else if ('position' in this.marker) {
            try { (this.marker as any).position = pos; } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore marker update errors */ }
      }
      if (this.circle && typeof this.circle.setCenter === 'function') this.circle.setCenter(pos);
      if (win.google && win.google.maps && this.map) this.map.setCenter(pos);
    } catch (e) {
      console.error('LocationMap: error setting position', e);
    }
  }

  ngAfterViewInit(): void {
    this.maybeInitMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['location']) {
      // If map exists, update position; otherwise attempt init (maps script may already be present)
      if (this.map) {
        this.setLocation(this.location);
      } else {
        this.maybeInitMap();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  private async loadMaps(): Promise<void> {
    const win: any = window as any;
    if (win.google && win.google.maps) return;

    // Traditional script injection with callback (works like the plain HTML approach)
    return new Promise<void>((resolve, reject) => {
      const apiKey = this.apiKey || (win.__GMAPS_API_KEY__ || '');
      if (!apiKey) {
        reject(new Error('No API key provided for Google Maps'));
        return;
      }

      // Create a unique callback name to avoid clashes
      const cbName = '__initLocationMap_' + Math.random().toString(36).slice(2);
      (win as any)[cbName] = () => {
        try {
          this.zone.run(() => { resolve(); });
        } finally {
          try { delete (win as any)[cbName]; } catch (e) { }
        }
      };
      const mapIdParam = this.mapId ? `&map_ids=${encodeURIComponent(this.mapId)}` : '';
  // load the marker library to support AdvancedMarkerElement
  const libs = 'marker';
      const script = document.createElement('script');
  // Use loading=async to follow Google's best-practice loading pattern
  // and avoid the console warning about suboptimal loading.
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cbName}${mapIdParam}${libs ? `&libraries=${libs}` : ''}&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => {
        try { delete (win as any)[cbName]; } catch (err) { /* ignore */ }
        reject(new Error('Failed to load Google Maps script'));
      };
      this.scriptUrl = script.src;
      document.head.appendChild(script);
    });
  }

  // Public wrapper so parent can force initialization after tabs render
  public ensureInit(): void { this.maybeInitMap(); }

  private maybeInitMap(attempts = 0): void {
    try {
      const win: any = window as any;
      if (this.loading) return;
      const el = this.mapContainer && (this.mapContainer as any).nativeElement;
      if (!el) {
        const MAX = 20; // retry up to ~2s (20 * 100ms)
        if (attempts < MAX) {
          setTimeout(() => this.maybeInitMap(attempts + 1), 100);
        } else {
          this.zone.run(() => { this.showStaticFallback = true; });
        }
        return;
      }
      if (win.google && win.google.maps && !this.map) {
        try { this.initMap(); } catch (e) { console.error('LocationMap.maybeInitMap: initMap threw', e); this.zone.run(() => { this.showStaticFallback = true; }); }
      }
    } catch (e) {
      console.error('LocationMap.maybeInitMap error', e);
    }
  }

  private initMap(): void {
    const win: any = window as any;
    if (!win.google || !win.google.maps) { this.error = 'Google Maps no disponible'; return; }

    const center = this.location || { lat: 4.6150, lng: -74.0500 };
    const el = this.mapContainer?.nativeElement;
    if (!el) {
      console.error('LocationMap.initMap: container element not found');
      return;
    }

    this.zone.run(() => {
      this.map = new win.google.maps.Map(el, { center, zoom: this.zoom, mapId: this.mapId || undefined });
      try {
        // Ensure any existing marker is removed
        try { if (this.marker && typeof this.marker.setMap === 'function') this.marker.setMap(null); } catch (e) { }

        // Prefer AdvancedMarkerElement (new recommended API) when available
        if (win.google && win.google.maps && win.google.maps.marker && (win.google.maps.marker as any).AdvancedMarkerElement) {
          try {
            const content = document.createElement('div');
            content.className = 'adv-marker';
            // Use an <img> inside the AdvancedMarkerElement so the official pin is displayed
            const img = document.createElement('img');
            img.src = 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png';
            img.alt = 'Ubicación';
            img.className = 'adv-marker-img';
            content.appendChild(img);
            // @ts-ignore
            this.marker = new win.google.maps.marker.AdvancedMarkerElement({ position: center, map: this.map, content, title: 'Ubicación', zIndex: 999999 });
            try { (this.marker as any).setVisible?.(true); } catch (e) { }
          } catch (e) {
            // If AdvancedMarker creation fails, fall back to classic Marker
            const iconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
            this.marker = new win.google.maps.Marker({ position: center, map: this.map, draggable: false, icon: { url: iconUrl }, zIndex: 999999 });
          }
        } else {
          // Fallback to classic Marker if marker library not present
          // Use the default Google Maps marker (no custom icon) so the standard teardrop pin is shown
          this.marker = new win.google.maps.Marker({ position: center, map: this.map, draggable: false, zIndex: 999999 });
        }
      } catch (e) {
        console.warn('LocationMap: marker creation failed', e);
      }

      // Always create a small circle overlay as a guaranteed visual cue for the location
      try {
  // make circle small and subtle so it doesn't visually replace the marker
  this.circle = new win.google.maps.Circle({ strokeColor: '#a94442', strokeOpacity: 0.9, strokeWeight: 1, fillColor: '#d9534f', fillOpacity: 0.25, map: this.map, center, radius: 8 });
  try { this.circle.setOptions?.({ zIndex: 99998 }); } catch (e) { }
      } catch (e) { }

      this.mapCreated = true;
      this.setLocation(center);
    });

    // trigger resize in case container was hidden initially
    setTimeout(() => {
      try {
        if (win.google && win.google.maps && this.map) {
          win.google.maps.event.trigger(this.map, 'resize');
          this.map.setCenter(center);
        }
      } catch (e) { /* ignore */ }
    }, 150);

    // If after a short delay no marker or no visible map children exist, enable static fallback.
    setTimeout(() => {
      try {
        const el2 = this.mapContainer && (this.mapContainer as any).nativeElement;
        const hasMapChildren = el2 && el2.querySelector && el2.querySelector('.gm-style');
        if (!this.marker || !hasMapChildren) { this.showStaticFallback = true; }
      } catch (e) { /* ignore */ }
    }, 700);
  }

  // Build static map URL as fallback
  public getStaticMapUrl(): string {
    if (!this.location) return '';
    const lat = this.location.lat;
    const lng = this.location.lng;
    const size = '600x300';
    const zoom = this.zoom || 14;
    const marker = `color:red%7C${lat},${lng}`;
    const key = encodeURIComponent(this.apiKey || '');
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${marker}&key=${key}`;
  }

  // Build an OpenStreetMap embed URL (no API key required) as a reliable fallback
  public getOsmEmbedUrl(): string {
    if (!this.location) return '';
    const lat = this.location.lat;
    const lng = this.location.lng;
    // bbox around the point for a nice zoomed view
    const delta = 0.02;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    const marker = `${lat}%2C${lng}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker}`;
  }

  public getOsmEmbedSafeUrl(): SafeResourceUrl {
    const url = this.getOsmEmbedUrl();
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

}

