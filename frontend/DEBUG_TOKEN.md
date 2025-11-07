# 🔍 Guía de Debugging - Problema 401 (Token no enviado)

## El Problema
Después del rebase, recibes error **401 Unauthorized** en `/auth/profile`. Esto significa que el token no se está enviando.

## Soluciones en Orden

### ✅ Solución 1: Limpiar localStorage (La más probable)

El rebase borró la sesión anterior. **Debes volver a hacer login:**

1. Abre la consola del navegador (F12)
2. Ejecuta esto:
```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

3. **Vuelve a hacer login** con tus credenciales
4. Verifica que en la consola aparezca el mensaje: `✅ Token encontrado en localStorage: ...`

### ✅ Solución 2: Verificar que el token se guardó

En la consola del navegador, ejecuta:
```javascript
console.log('Token guardado:', localStorage.getItem('accessToken'))
console.log('Usuario guardado:', JSON.parse(localStorage.getItem('currentUser') || '{}'))
```

Debería mostrar:
```
Token guardado: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Usuario guardado: { id: '123', email: 'test@test.com', role: 'organization', ... }
```

### ✅ Solución 3: Ver los logs mejorados del interceptor

Después de volver a hacer login:

1. Abre la consola (F12 → Pestaña Console)
2. Haz una solicitud que requiera autenticación (por ejemplo, ve a tu perfil)
3. Deberías ver logs como estos:

```
✅ Token encontrado en localStorage: eyJhbGciOiJIUzI1NiIs...
✅ Token agregado a solicitud: GET http://localhost:5000/auth/profile
```

Si ves: `⚠️ NO hay token en localStorage para la solicitud:` → El localStorage está vacío, vuelve a hacer login.

### ✅ Solución 4: Si aún así da error 401

Si después de hacer login sigue dando 401, el problema es diferente:

1. En la consola, ejecuta:
```javascript
// Copiar el token
const token = localStorage.getItem('accessToken')
console.log('Token actual:', token)

// Decodificar para ver el contenido
function decodeToken(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return 'Token inválido'
  const payload = JSON.parse(atob(parts[1]))
  return payload
}
console.log('Contenido del token:', decodeToken(token))
```

Esto te mostrará:
- Si el token está expirado
- Cuál es el rol (`role`, `roles`, `rol`)
- El ID del usuario

2. **Si el token está expirado**, el backend lo rechazará aunque se envíe correctamente.

## Resumen Rápido

```
401 después del rebase
    ↓
Limpiar localStorage + volver a hacer login
    ↓
Verificar que el token está en localStorage
    ↓
Verificar que aparece en los logs del interceptor
    ↓
Si sigue sin funcionar → Revisar si el backend tiene el refresh token configurado
```

## Archivos Modificados
- ✏️ `/src/app/core/interceptors/auth.interceptor.ts` - Mejorado con debugging

## Próximos Pasos
1. **Limpia localStorage y haz login de nuevo**
2. Comparte los logs de la consola si sigue sin funcionar
