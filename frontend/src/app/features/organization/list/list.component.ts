import { Component, OnInit, NgZone, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  // Estructura anidada del backend
  people?: {
    city?: string;
    municipio?: {
      name?: string;
      city?: {
        name?: string;
      };
    };
  };
  municipio?: {
    name?: string;
    city?: {
      name?: string;
    };
  };
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

  isBrowser = false;

  constructor(
    private http: HttpClient, 
    private zone: NgZone, 
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

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

  private async ensureMapAndMarkers(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      this.zone.run(() => this.initMap());
    } catch (e) {
      console.error('ensureMapAndMarkers error', e);
    }
  }

  private async initMap(): Promise<void> {
    if (!this.isBrowser) return;

    const container = document.getElementById('org-list-map');
    if (!container) return;

    try {
      const L = await import('leaflet');

      if (!this.map) {
        const center = this.orgs.length && this.orgs[0].location ? this.orgs[0].location : { lat: 4.615, lng: -74.05 };
        this.map = L.map(container).setView([center.lat, center.lng], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
      }

      // clear markers
      this.markers.forEach(m => { try { m.remove(); } catch (e) {} });
      this.markers = [];

      const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });

      this.orgs.forEach(o => {
        const loc = (o.location && o.location.lat != null && o.location.lng != null) ? o.location : ((o as any).locationJson || null);
        if (!loc) return;
        try {
          const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(this.map);

          marker.on('click', () => {
            this.zone.run(() => this.openSidebar(o, loc));
          });

          this.markers.push(marker);
        } catch (e) {
          console.error('Error adding Leaflet marker:', e);
        }
      });

      if (this.markers.length) {
        try {
          if (this.markers.length === 1) {
            const single = this.markers[0];
            this.map.setView(single.getLatLng(), 8);
          } else {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds());
          }
        } catch (e) {
          console.error('Error fitting Leaflet bounds:', e);
        }
      }
    } catch (e) {
      console.error('Error initializing Leaflet in initMap:', e);
    }
  }

  /**
   * Extrae el nombre de la ciudad de la estructura anidada del backend
   */
  private extractCityName(org: any): string | null {
    // Intentar múltiples rutas para encontrar la ciudad (en orden de prioridad)
    const city = org.people?.municipio?.city?.name || 
                 org.municipio?.city?.name ||
                 org.people?.city || 
                 org.city || 
                 org.people?.municipio?.name ||
                 org.municipio?.name ||
                 org.residencia;
    
    // Si encontramos algo, devolverlo (sin validaciones complejas)
    if (city && typeof city === 'string' && city.trim().length > 0) {
      return city.trim();
    }
    
    return null;
  }

  openSidebar(org: OrgMinimal, loc?: { lat: number; lng: number }) {
    this.selectedOrg = { ...org } as OrgMinimal;
    
    // Extraer ciudad correctamente de la estructura anidada
    const cityName = this.extractCityName(org);
    if (cityName) {
      (this.selectedOrg as any).residencia = cityName;
    } else {
      // Si no hay ciudad válida, ocultar el campo
      (this.selectedOrg as any).residencia = null;
    }
    
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
