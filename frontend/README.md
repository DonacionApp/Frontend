# DonanApp Frontend

Este proyecto es el frontend de la aplicación DonanApp, desarrollado con Angular 19.2.7. La aplicación permite el registro de donantes con verificación de correo electrónico.

## 🚀 Configuración del Proyecto

### Prerrequisitos
- Node.js (versión 18 o superior)
- npm o yarn
- Backend de DonanApp ejecutándose

### Instalación

1. Clona el repositorio
2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno en `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000' // URL del backend
};
```

## 🔧 Configuración del Backend

### ⚠️ IMPORTANTE: Configuración de URLs para Verificación de Correo

Para que la verificación de correo funcione correctamente, el backend debe estar configurado con las siguientes URLs:

### URLs de Verificación por Token (Enlaces de Email)
El backend debe enviar enlaces de verificación con la siguiente estructura:

```
http://localhost:4200/auth/verify/email?email=usuario@ejemplo.com&token=TOKEN_DE_VERIFICACION
```

### URLs de Verificación por Código
Para la verificación manual por código, el frontend redirige a:

```
http://localhost:4200/auth/verify/email?email=usuario@ejemplo.com
```

### Configuración en el Backend
El backend debe configurar la URL base en el servicio de email:

```typescript
// En el servicio de email del backend
const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/verify/email`;
```

### Variables de Entorno del Backend
Asegúrate de que el backend tenga configurada la variable:

```env
FRONTEND_URL=http://localhost:4200
```

## 🏃‍♂️ Desarrollo

### Servidor de Desarrollo
Para iniciar el servidor de desarrollo:

```bash
ng serve
```

La aplicación estará disponible en `http://localhost:4200/` y se recargará automáticamente cuando modifiques los archivos fuente.

### Estructura del Proyecto

```
src/
├── app/
│   ├── features/
│   │   ├── auth/                    # Módulo de autenticación
│   │   │   ├── email-verification/  # Componente de verificación de email
│   │   │   └── account-verified/    # Componente de cuenta verificada
│   │   ├── donor/                   # Módulo de donantes
│   │   │   └── components/
│   │   │       └── donor-register/  # Componente de registro de donantes
│   │   └── home/                    # Módulo de inicio
│   ├── core/                        # Servicios core
│   └── shared/                      # Componentes compartidos
└── environments/                    # Configuración de entornos
```

## 🔐 Funcionalidades Implementadas

### Registro de Donantes
- ✅ Formulario completo de registro
- ✅ Validación de datos en tiempo real
- ✅ Selección jerárquica de ubicación (país, estado, ciudad)
- ✅ Validación de edad mínima
- ✅ Confirmación de contraseñas

### Verificación de Email
- ✅ Verificación por código de 6 dígitos
- ✅ Verificación por enlace/token
- ✅ Reenvío de correos de verificación
- ✅ UI dinámica según el estado de verificación
- ✅ Redirección automática después de verificación exitosa

### Flujo de Usuario
1. **Registro** → Usuario completa el formulario
2. **Confirmación** → Pantalla de "Registro Exitoso"
3. **Verificación** → Usuario recibe email y verifica su cuenta
4. **Completado** → Pantalla de "Verificación Exitosa"

## 🛠️ Comandos Útiles

### Generar Componentes
```bash
ng generate component component-name
```

### Construir para Producción
```bash
ng build --prod
```

### Ejecutar Tests
```bash
ng test
```

### Linting
```bash
ng lint
```

## 🔗 Endpoints del Backend Requeridos

El frontend consume los siguientes endpoints del backend:

- `POST /auth/register` - Registro de donantes
- `POST /auth/verify-email-code` - Verificación por código
- `POST /auth/verify-email-token` - Verificación por token
- `POST /auth/resend-verification-email` - Reenvío de correo

## 📝 Notas de Desarrollo

- El proyecto usa Angular Material para componentes UI
- Tailwind CSS para estilos personalizados
- Reactive Forms para manejo de formularios
- HttpClient para comunicación con el backend
- LocalStorage para persistencia de sesión

## 🐛 Solución de Problemas

### Error de CORS
Si encuentras errores de CORS, asegúrate de que el backend tenga configurado CORS para `http://localhost:4200`.

### Error de Verificación de Email
Verifica que:
1. El backend esté ejecutándose en el puerto correcto
2. La URL del frontend esté configurada correctamente en el backend
3. El servicio de email esté funcionando

### Error de Conexión
Verifica que la variable `apiUrl` en `environment.ts` apunte al backend correcto.

## 📚 Recursos Adicionales

- [Angular CLI Overview](https://angular.dev/tools/cli)
- [Angular Material](https://material.angular.io/)
- [Tailwind CSS](https://tailwindcss.com/)
