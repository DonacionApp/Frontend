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
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  orgs: OrgMinimal[] = [];
  loading = false;
  error: string | null = null;
  map: any = null;
  markers: any[] = [];
  selectedOrg: OrgMinimal | null = null;
  sidebarOpen = false;
  private _outsideClickHandler: any = null;

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
    this.search$.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(q => {
      this.params.searchParam = q || '';
      this.loadOrgs();
    });
  }

  ngOnDestroy(): void {
    try { this.destroy$.next(); this.destroy$.complete(); } catch (e) {}
    try { this.removeOutsideClickListener(); } catch (e) {}
  }

  private buildUrl(): string {
    return `${environment.apiBackendUrl}/user/minimal/all/organizations`;
  }

  loadOrgs(): void {
    this.loading = true;
    this.error = null;
    let httpParams = new HttpParams();
    // build params; ignore `limit` for map rendering
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
        if (!this.orgs.length) {
          this.error = 'No se encontraron organizaciones para la búsqueda.';
        } else {
          this.error = null;
        }
        this.zone.runOutsideAngular(() => { this.ensureMapAndMarkers(); });
      },
      error: (err) => {
        this.loading = false;
        if (!err || typeof err !== 'object') {
          this.error = 'Error desconocido al conectar con el servidor.';
          return;
        }
        // network error
        if (err.status === 0) {
          this.error = 'No hay conexión con el servidor. Verifica tu red e inténtalo de nuevo.';
          return;
        }
        if (err.status === 404) {
          this.error = 'No se encontraron organizaciones (404).';
          return;
        }
        // other errors
        this.error = err?.message || `Error cargando organizaciones (status: ${err.status || 'N/A'})`;
      }
    });
  }

  onSearch(): void {
    this.loadOrgs();
  }

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
                return; 
              }
            } catch (e) {}
            _warn(...args);
          };
          (console as any).__suppressGoogleMarkerDeprecated = true;
        }
      } catch (e) {}

      this.zone.run(() => this.initMap());
    } catch (e) {
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
        const Adv = win.google?.maps?.marker?.AdvancedMarkerElement;
        let marker: any = null;
        if (Adv) {
          const content = document.createElement('div');
          const img = document.createElement('img');
          img.src = 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2.png';
          img.style.width = '28px';
          img.style.height = '40px';
          img.style.transform = 'translateY(-10px) scale(1)';
          img.style.display = 'block';
          img.style.cursor = 'pointer';
          img.style.transition = 'transform 140ms ease, box-shadow 140ms ease';
          try { img.addEventListener('mouseenter', () => { img.style.transform = 'translateY(-14px) scale(1.18)'; img.style.boxShadow = '0 8px 18px rgba(0,0,0,0.25)'; }); } catch (e) {}
          try { img.addEventListener('mouseleave', () => { img.style.transform = 'translateY(-10px) scale(1)'; img.style.boxShadow = 'none'; }); } catch (e) {}
          content.appendChild(img);
          marker = new Adv({ map: this.map, position: loc, title: o.username, content });
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
    if (loc) {
      (this.selectedOrg as any).location = loc;
    }
    this.sidebarOpen = true;
    this.attachOutsideClickListener();
  }

  closeSidebar() {
    this.sidebarOpen = false;
    this.selectedOrg = null;
    this.removeOutsideClickListener();
  }

  private attachOutsideClickListener() {
    try {
      if (this._outsideClickHandler) return;
      this._outsideClickHandler = (ev: MouseEvent) => {
        try {
          const sidebar = document.getElementById('org-sidebar');
          if (!sidebar) return;
          const target = ev.target as Node;
          if (!sidebar.contains(target)) {
            this.zone.run(() => this.closeSidebar());
          }
        } catch (e) {}
      };
      document.addEventListener('click', this._outsideClickHandler, true);
    } catch (e) {}
  }

  private removeOutsideClickListener() {
    try {
      if (!this._outsideClickHandler) return;
      document.removeEventListener('click', this._outsideClickHandler, true);
      this._outsideClickHandler = null;
    } catch (e) {}
  }

  goToProfile(id?: number | null) {
    if (!id) return;
    this.closeSidebar();
    try {
      this.router.navigate(['/profile', id]);
    } catch (e) {
    }
  }

}
