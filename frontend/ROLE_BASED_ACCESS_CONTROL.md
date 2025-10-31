# Sistema de Control de Acceso por Roles

## 📋 Descripción

Sistema completo de control de acceso basado en roles (RBAC) para Angular que permite proteger rutas, componentes y elementos de UI según los permisos del usuario.

## 🎯 Roles Disponibles

- **admin**: Administrador del sistema (acceso total)
- **donor**: Usuario donante
- **organization**: Organización benéfica

## 🛡️ Guards Implementados

### 1. AuthGuard
Verifica que el usuario esté autenticado. Redirige a `/auth/login` si no lo está.

```typescript
{
  path: 'dashboard',
  component: DashboardComponent,
  canActivate: [AuthGuard]
}
```

### 2. AdminGuard
Verifica que el usuario tenga rol de administrador.

```typescript
{
  path: 'admin',
  loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
  canActivate: [AuthGuard, AdminGuard]
}
```

### 3. DonorGuard
Verifica que el usuario tenga rol de donante.

```typescript
{
  path: 'donor',
  loadChildren: () => import('./features/donor/donor.module').then(m => m.DonorModule),
  canActivate: [AuthGuard, DonorGuard]
}
```

### 4. OrganizationGuard
Verifica que el usuario tenga rol de organización.

```typescript
{
  path: 'organization',
  loadChildren: () => import('./features/organization/organization.module').then(m => m.OrganizationModule),
  canActivate: [AuthGuard, OrganizationGuard]
}
```

## 🎨 Directiva HasRole

### Uso Básico

Mostrar elemento solo para un rol específico:

```html
<div *appHasRole="'admin'">
  Solo los administradores ven esto
</div>
```

### Múltiples Roles

Mostrar elemento para varios roles:

```html
<div *appHasRole="['donor', 'organization']">
  Donantes y organizaciones ven esto
</div>
```

### Ejemplos Prácticos

```html
<!-- Botón solo para admins -->
<button *appHasRole="'admin'" (click)="deleteUser()">
  Eliminar Usuario
</button>

<!-- Menú para donantes -->
<nav *appHasRole="'donor'">
  <a routerLink="/donor/donations">Mis Donaciones</a>
  <a routerLink="/donor/profile">Mi Perfil</a>
</nav>

<!-- Estadísticas para admins y organizaciones -->
<div *appHasRole="['admin', 'organization']">
  <app-statistics></app-statistics>
</div>
```

## 🔐 PermissionService

Servicio para verificar permisos programáticamente.

### Métodos Disponibles

```typescript
// Verificar rol específico (Observable)
permissionService.hasRole('admin').subscribe(hasRole => {
  if (hasRole) {
    // Usuario es admin
  }
});

// Verificar múltiples roles (Observable)
permissionService.hasAnyRole(['donor', 'organization']).subscribe(hasAnyRole => {
  if (hasAnyRole) {
    // Usuario es donante u organización
  }
});

// Verificar si es admin (Observable)
permissionService.isAdmin().subscribe(isAdmin => {
  // ...
});

// Verificar rol síncrono
const hasRole = permissionService.hasRoleSync('admin');

// Obtener rol actual
const currentRole = permissionService.getCurrentRole();
```

### Uso en Componentes

```typescript
export class MyComponent implements OnInit {
  isAdmin = false;
  
  constructor(private permissionService: PermissionService) {}
  
  ngOnInit(): void {
    this.permissionService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }
  
  // Método que solo ejecuta si es admin
  deleteItem(): void {
    if (this.permissionService.hasRoleSync('admin')) {
      // Eliminar item
    } else {
      alert('No tienes permisos');
    }
  }
}
```

## 🚫 Página de Acceso Denegado

Cuando un usuario intenta acceder a una ruta sin permisos, es redirigido automáticamente a `/access-denied` con información sobre:

- Rol requerido
- Rol actual del usuario
- Opciones para volver al inicio o cerrar sesión

## 📝 Ejemplo Completo de Implementación

### 1. Proteger Rutas

```typescript
// app-routing.module.ts
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard, AdminGuard]
  },
  {
    path: 'donor',
    loadChildren: () => import('./features/donor/donor.module').then(m => m.DonorModule),
    canActivate: [AuthGuard, DonorGuard]
  },
  {
    path: 'organization',
    loadChildren: () => import('./features/organization/organization.module').then(m => m.OrganizationModule),
    canActivate: [AuthGuard, OrganizationGuard]
  },
  {
    path: 'access-denied',
    component: AccessDeniedComponent
  }
];
```

### 2. Usar en Templates

```html
<!-- navbar.component.html -->
<nav>
  <!-- Menú común para todos -->
  <a routerLink="/">Inicio</a>
  
  <!-- Solo para donantes -->
  <a *appHasRole="'donor'" routerLink="/donor/profile">Mi Perfil</a>
  <a *appHasRole="'donor'" routerLink="/donor/donations">Mis Donaciones</a>
  
  <!-- Solo para organizaciones -->
  <a *appHasRole="'organization'" routerLink="/organization/profile">Perfil de Organización</a>
  <a *appHasRole="'organization'" routerLink="/organization/campaigns">Campañas</a>
  
  <!-- Solo para admins -->
  <a *appHasRole="'admin'" routerLink="/admin/dashboard">Panel Admin</a>
  <a *appHasRole="'admin'" routerLink="/admin/users">Usuarios</a>
  
  <!-- Para donantes y organizaciones -->
  <a *appHasRole="['donor', 'organization']" routerLink="/messages">Mensajes</a>
</nav>
```

### 3. Lógica en Componentes

```typescript
export class DashboardComponent implements OnInit {
  canEdit = false;
  canDelete = false;
  
  constructor(
    private permissionService: PermissionService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Verificar permisos
    this.permissionService.isAdmin().subscribe(isAdmin => {
      this.canEdit = isAdmin;
      this.canDelete = isAdmin;
    });
    
    // O de forma síncrona
    const user = this.authService.currentUserValue;
    if (user?.role === 'admin') {
      this.loadAdminData();
    }
  }
  
  private loadAdminData(): void {
    // Cargar datos específicos de admin
  }
}
```

## ✅ Checklist de Implementación

- [x] Leer rol desde token JWT y almacenarlo en estado global (AuthService)
- [x] Crear PermissionService para gestión de permisos
- [x] Implementar guards específicos por rol (AdminGuard, DonorGuard, OrganizationGuard)
- [x] Proteger rutas con guards de frontend
- [x] Crear componente AccessDeniedComponent con mensajes coherentes
- [x] Implementar directiva HasRole para control de visibilidad
- [x] Actualizar rutas principales con guards
- [x] Exportar servicios y directivas en módulos compartidos
- [x] Documentar uso del sistema

## 🔄 Flujo de Autenticación y Autorización

1. Usuario hace login → Token JWT almacenado en localStorage
2. AuthService decodifica el token y extrae el rol
3. Rol se guarda en BehaviorSubject (observable global)
4. Guards verifican el rol antes de activar rutas
5. Si no tiene permisos → Redirige a /access-denied
6. Directiva *appHasRole oculta elementos según rol
7. PermissionService permite verificaciones programáticas

## 📱 Ejemplo de UI Responsive

```html
<div class="dashboard">
  <!-- Sidebar solo para admins -->
  <aside *appHasRole="'admin'" class="sidebar">
    <app-admin-menu></app-admin-menu>
  </aside>
  
  <!-- Contenido principal -->
  <main>
    <h1>Dashboard</h1>
    
    <!-- Botones según rol -->
    <div class="actions">
      <button *appHasRole="'admin'" (click)="createUser()">
        Crear Usuario
      </button>
      
      <button *appHasRole="['donor', 'organization']" (click)="createDonation()">
        Nueva Donación
      </button>
    </div>
    
    <!-- Estadísticas para todos los autenticados -->
    <app-statistics></app-statistics>
  </main>
</div>
```

## 🎓 Mejores Prácticas

1. **Siempre combinar AuthGuard con guards específicos de rol**
2. **No confiar solo en el frontend** - El backend debe validar también
3. **Usar la directiva *appHasRole para mejorar UX** - Ocultar opciones no disponibles
4. **Manejar errores apropiadamente** - Mostrar mensajes claros al usuario
5. **Mantener sincronizado el rol** - Usar observables para cambios en tiempo real

## 🚀 Próximos Pasos

- Implementar permisos granulares (no solo roles)
- Agregar caché de permisos
- Implementar refresh de permisos sin recargar
- Agregar logging de intentos de acceso denegado
- Crear tests unitarios para guards y directivas

---

**Nota**: Este sistema proporciona control de acceso en el frontend. Siempre debe complementarse con validación en el backend para garantizar la seguridad.
