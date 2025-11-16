# GUÍA DE SOLUCIONES ESPECÍFICAS

## Problema 1: Typo SCSS "pr{" → "pre{"

### Ubicación exacta
Archivo: `src/app/shared/components/terms-modal/terms-modal.component.scss`
Línea: 291

### Solución (30 segundos)
```bash
# Opción 1: Usar sed para reemplazar
sed -i '291s/pr{/pre{/' src/app/shared/components/terms-modal/terms-modal.component.scss

# Opción 2: Editar manualmente
# Abre el archivo en tu editor favorito
# Busca la línea 291
# Cambia "pr{" por "pre{"
# Guarda
```

### Verificación
```bash
grep -n "^    pre{" src/app/shared/components/terms-modal/terms-modal.component.scss
# Debe mostrar: 291:    pre{
```

---

## Problema 2: Reducir markdown-editor.component.scss (6.53 KB)

### Análisis del archivo actual
- **Líneas**: 1019
- **Tamaño compilado**: 14.53 KB (actual) → debe ser < 8 KB
- **Reducción necesaria**: ~40%

### Estrategia de optimización

#### 2.1 Eliminar estilos de Debug (50 KB estimado)
```scss
// REMOVER estas líneas 2-11:
.markdown-editor-container {
  border: 2px solid #f97316 !important; // DEBUG: Borde naranja visible
  border-radius: 0.5rem;
  overflow: hidden;
  background: white !important;
  transition: all 0.2s;

  &:focus-within {
    border-color: #ea580c !important; // DEBUG: Naranja oscuro cuando tiene foco
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.25) !important;
  }
}

// REEMPLAZAR CON:
.markdown-editor-container {
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  transition: all 0.2s;

  &:focus-within {
    box-shadow: 0 0 0 4px rgba(229, 231, 235, 0.5);
  }
}
```

#### 2.2 Consolidar Media Queries Duplicadas
Actualmente hay media queries duplicadas:
- Líneas 589-632: Primera definición de @media (max-width: 768px)
- Líneas 921-973: Segunda definición de @media (max-width: 768px)

**Acción**: Combinar ambas en una sola

#### 2.3 Eliminar CSS innecesario
```scss
// Revisar y eliminar:
- .quick-help (líneas 554-586) - Si no se usa
- .status-bar (líneas 509-551) - Si no se usa
- Duplicados de .markdown-body estilos

// Consolidar animaciones similares:
@keyframes pulse - ¿Se usa?
@keyframes float - ¿Se usa?
@keyframes spin - Usar de Tailwind
```

#### 2.4 Usar Tailwind en lugar de CSS personalizado
```scss
// En lugar de:
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  align-items: center;
}

// Usar en HTML:
<div class="flex flex-wrap gap-3 p-2 bg-gray-50 border-b border-gray-200">
```

### Estimación de reducción
- Remover debug: -2 KB
- Consolidar media queries: -1.5 KB
- Eliminar código no usado: -2 KB
- Usar Tailwind: -1.5 KB
- **Total estimado**: -7 KB (suficiente)

---

## Problema 3: Reducir terms-modal.component.scss (3.40 KB)

### Análisis del archivo actual
- **Líneas**: 813
- **Tamaño compilado**: 11.40 KB (actual) → debe ser < 8 KB
- **Reducción necesaria**: ~30%

### Estrategia de optimización

#### 3.1 Consolidar Media Queries
```scss
// Revisar líneas 692-755 (tablet)
// Están bien, no cambiar
```

#### 3.2 Eliminar Estilos Redundantes
```scss
// Revisar líneas 170-216 (::ng-deep en markdown-body)
// Mucho de esto está replicado del otro archivo
// Considerar extraer a archivo global

// Ejemplo de redundancia:
- Estilos de h1-h6 
- Estilos de code blocks
- Estilos de tablas
```

#### 3.3 Extraer a archivo global
Crear: `src/styles/markdown-base.scss`
```scss
// Mover estilos compartidos:
.markdown-body {
  h1, h2, h3, h4, h5, h6 { /* ... */ }
  code { /* ... */ }
  pre { /* ... */ }
  blockquote { /* ... */ }
  ul, ol { /* ... */ }
  table { /* ... */ }
  img { /* ... */ }
  hr { /* ... */ }
  a { /* ... */ }
}
```

Luego importar en ambos componentes:
```scss
@import '../../styles/markdown-base.scss';

// En terms-modal.component.scss sobrescribir solo específicos:
.markdown-body {
  // Overrides específicos del modal
  h1 {
    color: #667eea; // Diferente al editor
  }
}
```

#### 3.4 Reducción estimada
- Extraer markdown-base.scss: -4 KB (en terms-modal, +1.5 KB en global pero se comparte)
- Consolidar media queries: -0.5 KB
- Eliminar redundancia: -0.5 KB
- **Total estimado**: -5 KB (suficiente)

---

## Problema 4: Non-null Assertions

### Ubicación
`src/app/features/admin/system/system.component.ts` (líneas 32-34)

### Código actual
```typescript
export class SystemComponent implements OnInit, OnDestroy {
  // ...
  policiesForm!: FormGroup;
  termsForm!: FormGroup;
  aboutUsForm!: FormGroup;
  
  constructor(private systemService: SystemService, private fb: FormBuilder) {
    this.initForms();
  }
  
  initForms(): void {
    this.policiesForm = this.fb.group({ /* ... */ });
    // ...
  }
}
```

### Solución A: Inicializar en constructor (RECOMENDADO)
```typescript
constructor(
  private systemService: SystemService,
  private fb: FormBuilder
) {
  this.initForms(); // Ya existe, mantener igual
}

// O mejor aún:
private fb = inject(FormBuilder);

constructor(private systemService: SystemService) {
  this.initForms();
}

initForms(): void {
  this.policiesForm = this.fb.group({
    content: ['', [Validators.required]]
  });
  // ...
}
```

### Solución B: Usar getters (Alternativa)
```typescript
private _policiesForm?: FormGroup;

get policiesForm(): FormGroup {
  if (!this._policiesForm) {
    this._policiesForm = this.fb.group({
      content: ['', [Validators.required]]
    });
  }
  return this._policiesForm;
}
```

---

## Problema 5: console.error() en Producción

### Ubicaciones
- `system.component.ts`: líneas 147, 180, 204, 237, 261, 294
- `markdown-editor.component.ts`: líneas 233, 235

### Solución: Crear LoggerService

#### 5.1 Crear el servicio
```bash
# Generar el servicio
ng generate service core/services/logger --skip-tests
```

#### 5.2 Implementación
```typescript
// src/app/core/services/logger.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  error(message: string, error?: any): void {
    if (!environment.production) {
      console.error(`[ERROR] ${message}`, error);
    }
    // En producción, podrías enviar a un servicio de tracking
    // this.trackingService.logError(message, error);
  }

  log(message: string, data?: any): void {
    if (!environment.production) {
      console.log(`[LOG] ${message}`, data);
    }
  }

  warn(message: string, data?: any): void {
    if (!environment.production) {
      console.warn(`[WARN] ${message}`, data);
    }
  }
}
```

#### 5.3 Usar en system.component.ts
```typescript
// ANTES:
this.systemService.getPolicies()
  .pipe(takeUntil(this.destroy$))
  .subscribe({
    next: (response) => { /* ... */ },
    error: (error) => {
      console.error('Error loading policies:', error); // ❌ REMOVER
      const errorMessage = error?.error?.message || error?.message || 'Error';
      alert(`Error: ${errorMessage}`); // ⚠️ También cambiar a toast
    }
  });

// DESPUÉS:
constructor(
  private systemService: SystemService,
  private fb: FormBuilder,
  private logger: LoggerService // ← Inyectar
) {
  this.initForms();
}

loadPolicies(): void {
  this.loadingPolicies = true;
  this.errorMessage = '';

  this.systemService.getPolicies()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.policiesContent = response.policies || '';
        this.policiesForm.patchValue({ content: this.policiesContent });
        this.loadingPolicies = false;
      },
      error: (error) => {
        this.logger.error('Error loading policies:', error); // ✓ Usar servicio
        const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar las políticas';
        this.notificationService.error(errorMessage); // ✓ Toast en lugar de alert
        this.loadingPolicies = false;
      }
    });
}
```

#### 5.4 Usar en markdown-editor.component.ts
```typescript
// ANTES (línea 233):
console.log('✅ Markdown convertido a HTML');

// DESPUÉS:
this.logger.log('Markdown convertido a HTML');
```

---

## Problema 6: Remover DEBUG Comments

### Ubicación
`src/app/shared/components/markdown-editor/markdown-editor.component.scss` (líneas 2, 9)

### Cambio
```scss
// ANTES:
.markdown-editor-container {
  border: 2px solid #f97316 !important; // DEBUG: Borde naranja visible
  border-radius: 0.5rem;
  overflow: hidden;
  background: white !important;
  transition: all 0.2s;

  &:focus-within {
    border-color: #ea580c !important; // DEBUG: Naranja oscuro cuando tiene foco
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.25) !important;
  }
}

// DESPUÉS (Opción A: Sin bordes naranja):
.markdown-editor-container {
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  transition: all 0.2s;

  &:focus-within {
    box-shadow: 0 0 0 4px rgba(229, 231, 235, 0.5);
  }
}

// OPCIÓN B: Si los bordes naranja son intencionales:
.markdown-editor-container {
  border: 1px solid #e5e7eb; // Borde sutil, no debug
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  transition: all 0.2s;

  &:focus-within {
    border-color: #f97316;
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
  }
}
```

---

## Problema 7: Reemplazar alert() por Toast

### Ubicación
`src/app/features/admin/system/system.component.ts` (9 llamadas)

### Solución asumiendo que existe NotificationService

```typescript
// Inyectar el servicio (ya existe probablemente)
constructor(
  private systemService: SystemService,
  private fb: FormBuilder,
  private notificationService: NotificationService // ← Inyectar
) {
  this.initForms();
}

// ANTES (línea 176):
alert('Políticas actualizadas correctamente');

// DESPUÉS:
this.notificationService.success('Políticas actualizadas correctamente');

// ANTES (línea 182):
alert(`Error: ${errorMessage}`);

// DESPUÉS:
this.notificationService.error(errorMessage);
```

### Búsqueda y reemplazo
```bash
# Encontrar todas las líneas con alert:
grep -n "alert(" src/app/features/admin/system/system.component.ts

# Reemplazar manualmente en el editor:
# alert('Políticas actualizadas correctamente');
# ↓
# this.notificationService.success('Políticas actualizadas correctamente');

# alert(`Error: ${errorMessage}`);
# ↓
# this.notificationService.error(errorMessage);
```

---

## Problema 8: API Key Hardcodeada

### Ubicación
`scripts/generate-env.js` (línea 7)

### Código actual
```javascript
const GOOGLE_MAPS_API_KEY = process.env['GOOGLE_MAPS_API_KEY'] || 'AIzaSyC55ytCYBbBKrqbm10kHQBmwXNyYoxCogE';
```

### Solución
```javascript
const GOOGLE_MAPS_API_KEY = process.env['GOOGLE_MAPS_API_KEY'];

// En ambiente de desarrollo local, crear .env:
# .env
API_URL=http://localhost:5000
SOCKET_URL=http://localhost:5000
GOOGLE_MAPS_API_KEY=tu-clave-local

// Para CI/CD, configurar variables de entorno en el sistema
```

### Validación en build
```typescript
// En src/environments/environment.prod.ts
if (!environment.apiKeyGoogleMaps) {
  console.warn('WARNING: Google Maps API Key no configurada');
}
```

---

## Resumen de Comandos

```bash
# 1. Arreglar typo SCSS
sed -i '291s/pr{/pre{/' src/app/shared/components/terms-modal/terms-modal.component.scss

# 2. Crear LoggerService
ng generate service core/services/logger --skip-tests

# 3. Verificar que compila
npm run build

# 4. Verificar tests (si hay)
npm run test
```

---

## Checklist Final

- [ ] Cambiar pr{ a pre{ (línea 291)
- [ ] Crear LoggerService
- [ ] Reemplazar console.error() con logger.error()
- [ ] Reemplazar console.log() con logger.log()
- [ ] Remover comentarios DEBUG
- [ ] Reemplazar alert() con notificationService
- [ ] Remover API key hardcodeada
- [ ] Reducir tamaño de markdown-editor.component.scss
- [ ] Reducir tamaño de terms-modal.component.scss
- [ ] Verificar que npm run build ejecuta sin errores
- [ ] Commitear cambios

---

