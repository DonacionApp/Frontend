# Pantallas de Perfil - Donantes y Organizaciones

## 📋 Descripción

Este módulo implementa pantallas completas para visualizar y editar perfiles de usuarios (donantes) y organizaciones, conectadas a los endpoints `/api/users/me` y `/api/orgs/{id}` del backend.

## ✅ Checklist Completado

### ✔️ Vistas diferenciadas para donantes y organizaciones
- **Perfil de Donante**: `/donor/profile`
- **Perfil de Organización**: `/organization/profile`
- Cada vista tiene tabs específicos: Información General, Seguridad y Actividad

### ✔️ Sincronización con el backend
- Servicios que prellenan formularios automáticamente
- Validaciones en tiempo real
- Integración con API REST

### ✔️ Actualizaciones optimistas con rollback
- Los cambios se reflejan inmediatamente en la UI
- Si el backend falla, se restaura el estado anterior
- Feedback visual de éxito/error

### ✔️ Última sesión y cambios confirmados
- Muestra fecha de registro y último acceso
- Timestamp de la última actualización del perfil
- Historial de actividad de la cuenta

## 🗂️ Estructura de Archivos Creados

```
frontend/src/app/
├── core/services/
│   ├── user-profile.service.ts         # Servicio para perfil de donantes
│   ├── organization-profile.service.ts # Servicio para perfil de organizaciones
│   └── index.ts                        # Exportaciones actualizadas
│
├── features/
│   ├── donor/
│   │   ├── profile/
│   │   │   ├── donor-profile.component.ts
│   │   │   ├── donor-profile.component.html
│   │   │   └── donor-profile.component.scss
│   │   └── donor.module.ts             # Rutas actualizadas
│   │
│   └── organization/
│       ├── profile/
│       │   ├── organization-profile.component.ts
│       │   ├── organization-profile.component.html
│       │   └── organization-profile.component.scss
│       └── organization.module.ts      # Rutas actualizadas
│
└── shared/components/nav/
    ├── nav.component.ts                # Navegación actualizada
    └── nav.component.html              # Con menú de perfil
```

## 🔧 Servicios Implementados

### UserProfileService

**Endpoints conectados:**
- `GET /api/users/me` - Obtener perfil del usuario autenticado
- `PATCH /api/users/me` - Actualizar perfil
- `POST /api/users/me/change-password` - Cambiar contraseña
- `GET /api/users/me/activity` - Historial de actividad
- `POST /api/users/me/upload-image` - Subir foto de perfil

**Características:**
- Observable `profile$` para estado reactivo
- Observable `loading$` para UI de carga
- Observable `lastUpdate$` para tracking de cambios
- Actualización optimista con rollback automático

### OrganizationProfileService

**Endpoints conectados:**
- `GET /api/orgs/{id}` - Obtener perfil de organización
- `GET /api/orgs/me` - Obtener perfil de la organización autenticada
- `PATCH /api/orgs/{id}` - Actualizar perfil
- `POST /api/orgs/{id}/change-password` - Cambiar contraseña
- `GET /api/orgs/{id}/activity` - Historial de actividad
- `POST /api/orgs/{id}/upload-logo` - Subir logo
- `POST /api/orgs/{id}/upload-cover` - Subir imagen de portada

**Características:**
- Mismas características que UserProfileService
- Soporte adicional para logo y cover image
- Gestión de redes sociales

## 🎨 Componentes de Perfil

### Perfil de Donante

**Tabs implementadas:**

1. **Información General**
   - Nombre completo
   - Email (solo lectura)
   - Teléfono
   - Fecha de nacimiento
   - Dirección completa (calle, ciudad, estado, país, código postal)
   - Foto de perfil

2. **Seguridad**
   - Cambio de contraseña
   - Validaciones de seguridad
   - Consejos de contraseña segura

3. **Actividad**
   - Fecha de registro
   - Último acceso
   - Historial de actividad
   - Link a notificaciones

### Perfil de Organización

**Tabs implementadas:**

1. **Información General**
   - Información básica (nombre, email, teléfono, website)
   - Representante legal
   - Descripción breve (500 caracteres)
   - Misión (1000 caracteres)
   - Dirección completa
   - Redes sociales (Facebook, Twitter, Instagram, LinkedIn)
   - Logo y portada

2. **Seguridad**
   - Cambio de contraseña
   - Validaciones de seguridad

3. **Actividad**
   - Fecha de registro
   - Último acceso
   - Estadísticas (campañas activas, donaciones recibidas)
   - Historial de actividad

## 🔐 Rutas y Seguridad

Las rutas están protegidas con `AuthGuard`:

```typescript
// Donantes
{ path: 'profile', component: DonorProfileComponent, canActivate: [AuthGuard] }

// Organizaciones
{ path: 'profile', component: OrganizationProfileComponent, canActivate: [AuthGuard] }
```

**Navegación:**
- `/donor/profile` - Perfil de donante (requiere autenticación)
- `/organization/profile` - Perfil de organización (requiere autenticación)

## 🚀 Uso

### 1. Acceder al perfil

Los usuarios autenticados verán un menú desplegable en la barra de navegación con su nombre e inicial. Al hacer clic, pueden:
- Ver su perfil
- Cerrar sesión

### 2. Actualizar perfil

1. Navegar a la tab "Información General"
2. Modificar los campos deseados
3. Hacer clic en "Guardar Cambios"
4. Los cambios se aplican inmediatamente (optimista)
5. Si hay error, se muestra mensaje y se revierte

### 3. Cambiar contraseña

1. Navegar a la tab "Seguridad"
2. Ingresar contraseña actual
3. Ingresar nueva contraseña (con validaciones)
4. Confirmar nueva contraseña
5. Hacer clic en "Cambiar Contraseña"

### 4. Subir imágenes

**Para donantes:**
- Click en "Seleccionar Imagen"
- Elegir archivo
- Click en "Subir Imagen"

**Para organizaciones:**
- Logo: Click en icono de cámara sobre el logo
- Portada: Click en "Cambiar Portada"

## 📊 Actualización Optimista

El sistema implementa actualizaciones optimistas para mejorar la UX:

```typescript
// 1. Guardar estado actual (para rollback)
const currentProfile = this.profileSubject.value;

// 2. Actualizar UI inmediatamente
this.profileSubject.next(optimisticProfile);

// 3. Enviar al backend
return this.http.patch(url, updates).pipe(
  tap(confirmedData => {
    // 4. Confirmar con datos del servidor
    this.profileSubject.next(confirmedData);
  }),
  catchError(error => {
    // 5. Rollback si hay error
    this.profileSubject.next(currentProfile);
    throw error;
  })
);
```

## 🎯 Validaciones Implementadas

### Campos de perfil:
- **Nombre**: Requerido, mínimo 2 caracteres
- **Teléfono**: Formato numérico válido
- **Website**: Formato URL válido (https://...)
- **Descripción**: Máximo 500 caracteres
- **Misión**: Máximo 1000 caracteres

### Contraseña:
- **Requerida**: Mínimo 8 caracteres
- **Complejidad**: Debe incluir:
  - Al menos una mayúscula
  - Al menos una minúscula
  - Al menos un número
  - Al menos un carácter especial (@$!%*?&)
- **Confirmación**: Debe coincidir con la nueva contraseña

## 🔄 Estados Reactivos

Los servicios exponen Observables para estado reactivo:

```typescript
// Suscribirse al perfil
profileService.profile$.subscribe(profile => {
  console.log('Perfil actualizado:', profile);
});

// Suscribirse al estado de carga
profileService.loading$.subscribe(loading => {
  console.log('Cargando:', loading);
});

// Suscribirse a última actualización
profileService.lastUpdate$.subscribe(date => {
  console.log('Última actualización:', date);
});
```

## 🎨 Diseño y UX

- **Framework CSS**: Tailwind CSS
- **Responsive**: Adaptado para móviles, tablets y escritorio
- **Animaciones**: Transiciones suaves
- **Feedback visual**: 
  - Mensajes de éxito en verde
  - Mensajes de error en rojo
  - Estados de carga con spinners
  - Validaciones en tiempo real

## 🧪 Testing

Para probar las funcionalidades:

1. **Iniciar sesión** como donante u organización
2. **Navegar** al perfil desde el menú de usuario
3. **Editar campos** y verificar prellenado automático
4. **Intentar guardar** con campos inválidos (ver validaciones)
5. **Guardar cambios** válidos (ver actualización optimista)
6. **Cambiar contraseña** (probar validaciones de seguridad)
7. **Ver actividad** de la cuenta

## 📝 Notas de Implementación

### Backend Requirements

El backend debe implementar los siguientes endpoints:

**Para usuarios (donantes):**
```
GET    /api/users/me
PATCH  /api/users/me
POST   /api/users/me/change-password
GET    /api/users/me/activity
POST   /api/users/me/upload-image
```

**Para organizaciones:**
```
GET    /api/orgs/:id
GET    /api/orgs/me
PATCH  /api/orgs/:id
POST   /api/orgs/:id/change-password
GET    /api/orgs/:id/activity
POST   /api/orgs/:id/upload-logo
POST   /api/orgs/:id/upload-cover
```

### Manejo de Errores

Si algún endpoint no existe, los servicios:
- Muestran un mensaje de error al usuario
- Realizan rollback al estado anterior
- Logean el error en consola
- No rompen la aplicación

### Próximas Mejoras

- [ ] Agregar validación de email en tiempo real
- [ ] Implementar crop de imágenes antes de subir
- [ ] Agregar historial de cambios en el perfil
- [ ] Implementar 2FA (autenticación de dos factores)
- [ ] Agregar preferencias de notificaciones
- [ ] Dashboard personalizado por rol

## 🆘 Soporte

Para problemas o preguntas:
1. Verificar que el backend esté corriendo
2. Revisar la consola del navegador para errores
3. Verificar que el token de autenticación sea válido
4. Comprobar que las URLs del environment sean correctas

---

**Desarrollado con ❤️ para DonacionApp**
