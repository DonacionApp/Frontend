import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface OrgMinimal {
  id: number;
  username: string;
  email?: string;
  profilePhoto?: string;
  location?: { lat: number; lng: number } | null;
  locationJson?: { lat: number; lng: number } | null;
  residencia?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-organization-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class OrganizationListComponent implements OnInit {
  // live search
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  orgs: OrgMinimal[] = [];
  loading = false;
  error: string | null = null;
  map: any = null;
  markers: any[] = [];
  // sidebar state
  selectedOrg: OrgMinimal | null = null;
  sidebarOpen = false;

  // Query params (all optional)
  params = {
    limit: 20 as number | null,
    offset: 0 as number | null,
    page: 1 as number | null,
    cursor: '' as string | null,
    searchParam: '' as string | null,
    orderBy: '' as string | null
  };

  constructor(private http: HttpClient, private zone: NgZone, private router: Router) {}

  ngOnInit(): void {
    this.loadOrgs();
    // subscribe to live search with debounce
    this.search$.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(q => {
      this.params.searchParam = q || '';
      this.loadOrgs();
    });
  }

  ngOnDestroy(): void {
    try { this.destroy$.next(); this.destroy$.complete(); } catch (e) {}
  }

  private buildUrl(): string {
    return `${environment.apiBackendUrl}/user/minimal/all/organizations`;
  }

  loadOrgs(): void {
    this.loading = true;
    this.error = null;
    let httpParams = new HttpParams();
    // Ignore `limit` when requesting organizations for the map; only use searchParam and other relevant filters
    Object.keys(this.params).forEach(k => {
      if (k === 'limit') return; // skip limit
      const v: any = (this.params as any)[k];
      if (v !== null && v !== undefined && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });

    this.http.get<OrgMinimal[]>(this.buildUrl(), { params: httpParams }).subscribe({
      next: (data) => {
        this.orgs = Array.isArray(data) ? data : [];
        this.loading = false;
        this.zone.runOutsideAngular(() => { this.ensureMapAndMarkers(); });
      },
      error: (err) => {
        this.error = err?.message || 'Error cargando organizaciones';
        this.loading = false;
      }
    });
  }

  // Called by the search input/button to reload orgs filtered by searchParam
  onSearch(): void {
    // reset pagination/cursor if you want; keep simple: reload with current params.searchParam
    this.loadOrgs();
  }

  // called from ngModelChange to feed the debounced search stream
  onSearchTerm(term: string) {
    this.search$.next(String(term || ''));
  }

  private loadMapsScript(): Promise<void> {
    const win: any = window as any;
    if (win.google && win.google.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cb = '__initOrgList_' + Math.random().toString(36).slice(2);
      (win as any)[cb] = () => { try { resolve(); } finally { try { delete (win as any)[cb]; } catch (e) {} } };
      const key = encodeURIComponent(environment.apiKeyGoogleMaps || '');
      const mapId = environment.mapsMapId ? `&map_ids=${encodeURIComponent(environment.mapsMapId)}` : '';
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${cb}${mapId}&libraries=marker&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });
  }

  private async ensureMapAndMarkers(): Promise<void> {
    try {
      await this.loadMapsScript();
      // Optionally suppress the Google Maps deprecation warning for google.maps.Marker
      try {
        if (typeof console !== 'undefined' && !(console as any).__suppressGoogleMarkerDeprecated) {
          const _warn = console.warn.bind(console);
          console.warn = (...args: any[]) => {
            try {
              const first = args && args[0];
              if (typeof first === 'string' && first.includes('google.maps.Marker is deprecated')) {
                return; // drop this specific deprecation message
              }
            } catch (e) {}
            _warn(...args);
          };
          (console as any).__suppressGoogleMarkerDeprecated = true;
        }
      } catch (e) {}

      this.zone.run(() => this.initMap());
    } catch (e) {
      // ignore - user will see fallback
    }
  }

  private initMap(): void {
    const win: any = window as any;
    const container = document.getElementById('org-list-map');
    if (!container || !win.google || !win.google.maps) return;
    if (!this.map) {
      const center = this.orgs.length && this.orgs[0].location ? this.orgs[0].location : { lat: 4.615, lng: -74.05 };
      this.map = new win.google.maps.Map(container, { center, zoom: 5, mapId: environment.mapsMapId || undefined });
    }
    // clear markers
    this.markers.forEach(m => { try { m.setMap(null); } catch (e) {} });
    this.markers = [];

    this.orgs.forEach(o => {
      // support `location` or `locationJson`
      const loc = (o.location && o.location.lat != null && o.location.lng != null) ? o.location : ((o as any).locationJson || null);
      if (!loc) return;
      try {
        // Prefer the AdvancedMarkerElement when available to avoid deprecation warnings
        const Adv = win.google?.maps?.marker?.AdvancedMarkerElement;
        let marker: any = null;
        if (Adv) {
          // Use an IMG inside AdvancedMarkerElement to mimic the classic Google pin
          const content = document.createElement('div');
          const img = document.createElement('img');
          // Use a Google-hosted marker icon that resembles the classic pin.
          img.src = 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png';
          img.style.width = '28px';
          img.style.height = '40px';
          // Shift up so the tip points to the exact lat/lng
          img.style.transform = 'translateY(-10px)';
          img.style.display = 'block';
          content.appendChild(img);
          marker = new Adv({ map: this.map, position: loc, title: o.username, content });
          // attach click on the DOM content as a fallback
          try { content.addEventListener('click', () => this.zone.run(() => this.openSidebar(o, loc))); } catch (e) {}
        } else {
          // fallback: classic Marker (may emit deprecation warning)
          marker = new win.google.maps.Marker({ position: loc, map: this.map, title: o.username });
          try { win.google.maps.event.addListener(marker, 'click', () => { this.zone.run(() => this.openSidebar(o, loc)); }); } catch (e) {}
        }
        this.markers.push(marker);
      } catch (e) {}
    });

    if (this.markers.length) {
      try {
        if (this.markers.length === 1) {
          // When there's a single marker, avoid an extreme zoom from fitBounds.
          // Center the map on the marker and use a moderate zoom so the context is visible.
          const single = this.markers[0];
          let pos: any = null;
          try { pos = (typeof single.getPosition === 'function') ? single.getPosition() : (single.position || null); } catch (e) { pos = null; }
          if (pos) {
            try { this.map.setCenter(pos); this.map.setZoom(8); } catch (e) { try { this.map.setCenter({ lat: pos.lat || pos.lat(), lng: pos.lng || pos.lng() }); this.map.setZoom(8); } catch (e2) {} }
          }
        } else {
          const bounds = new win.google.maps.LatLngBounds();
          this.markers.forEach(m => {
            try { bounds.extend(m.getPosition()); } catch (e) {
              // fallback: if marker has no getPosition, try to extend by corresponding org location
              try {
                // find a matching org by title
                const title = m && m.getTitle ? m.getTitle() : (m && m.title) || null;
                const org = title ? this.orgs.find(x => String(x.username) === String(title)) : null;
                const loc = org ? (org.location || (org as any).locationJson) : null;
                if (loc) bounds.extend(loc as any);
              } catch (e2) {}
            }
          });
          this.map.fitBounds(bounds);
        }
      } catch (e) {
        try { this.map.fitBounds(new win.google.maps.LatLngBounds()); } catch (e2) {}
      }
    }
  }

  openSidebar(org: OrgMinimal, loc?: { lat: number; lng: number }) {
    this.selectedOrg = { ...org } as OrgMinimal;
    // ensure coordinates are present on selectedOrg for display
    if (loc) {
      (this.selectedOrg as any).location = loc;
    }
    this.sidebarOpen = true;
  }

  closeSidebar() {
    this.sidebarOpen = false;
    this.selectedOrg = null;
  }

  goToProfile(id?: number | null) {
    if (!id) return;
    // close sidebar then navigate
    this.closeSidebar();
    // navigate to /profile/:id
    try {
      this.router.navigate(['/profile', id]);
    } catch (e) {
      // ignore navigation errors
    }
  }

}
