import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class OrganizationListComponent implements OnInit {
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

  constructor(private http: HttpClient, private zone: NgZone) {}

  ngOnInit(): void {
    this.loadOrgs();
  }

  private buildUrl(): string {
    return `${environment.apiBackendUrl}/user/minimal/all/organizations`;
  }

  loadOrgs(): void {
    this.loading = true;
    this.error = null;
    let httpParams = new HttpParams();
    Object.keys(this.params).forEach(k => {
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
        const marker = new win.google.maps.Marker({ position: loc, map: this.map, title: o.username });
        this.markers.push(marker);
        try {
          win.google.maps.event.addListener(marker, 'click', () => {
            // open sidebar inside Angular zone
            this.zone.run(() => this.openSidebar(o, loc));
          });
        } catch (e) {}
      } catch (e) {}
    });

    if (this.markers.length) {
      const bounds = new win.google.maps.LatLngBounds();
      this.markers.forEach(m => bounds.extend(m.getPosition()));
      this.map.fitBounds(bounds);
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

}
