# Componente Edit - Endpoints y Campos Editables

## ✅ CAMPOS EDITABLES (confirmado por backend)

### 1. Título y Descripción
**Endpoint**: `POST /post/update/:id`
```typescript
updatePost(postId: number, data: UpdatePostDTO)
// UpdatePostDTO = { title?: string; message?: string }
```
✅ **EXISTE** - Solo permite editar `title` y `message`

### 2. Imágenes
**Agregar**: `POST /post/image/add/:postId`
```typescript
addImageToPost(postId: number, formData: FormData)
```
✅ **EXISTE** - Sube múltiples archivos

**Eliminar**: `DELETE /post/image/delete/:imageId/post/:postId`
```typescript
deleteImageFromPost(imageId: number, postId: number)
```
✅ **EXISTE** - Elimina una imagen específica

### 3. Etiquetas (Tags)
**Buscar/Crear tag**:
```typescript
getTagByName(name: string): Observable<Tag>  // GET /tags/name/:name
createTag(tag: string): Observable<Tag>       // POST /tags/create
```
✅ **EXISTE**

**Agregar**: `POST /post/add/tag/:tagId/post/:postId`
```typescript
addTagToPost(tagId: number, postId: number)
```
✅ **EXISTE**

**Quitar**: `DELETE /post/remove/tag/:tagId/post/:postId`
```typescript
removeTagFromPost(tagId: number, postId: number)
```
✅ **EXISTE**

---

## ❌ CAMPOS NO EDITABLES (sin endpoints)

### 1. Tipo de Post
**Necesario**: Extender `UpdatePostDTO`
```typescript
// Actualmente
export interface UpdatePostDTO {
  title?: string;
  message?: string;
}

// Debería ser
export interface UpdatePostDTO {
  title?: string;
  message?: string;
  typePost?: number;  // ← FALTA
}
```
❌ **NO EXISTE** - El DTO no incluye `typePost`

### 2. Artículos y Cantidades
**Necesarios**: Endpoints para gestión de artículos
```typescript
// Opción A: Reemplazar lista completa
PUT /post/:id/articles
Body: { articles: [{ idArticle: number, quantity: number }] }

// Opción B: Individual
POST /post/:id/article
Body: { articleId: number, quantity: number }

DELETE /post/:id/article/:articleId
```
❌ **NO EXISTEN** - No hay forma de modificar artículos de un post existente

---

## Implementación Actual

El componente `EditComponent` implementa:
- ✅ Edición de título y descripción
- ✅ Eliminación de imágenes existentes
- ✅ Subida de nuevas imágenes
- ✅ Gestión completa de tags (add/remove con diff)
- ℹ️ Mostrar tipo y artículos como READ-ONLY

---

## Para habilitar edición completa

### Backend debe implementar:

1. **Extender UpdatePostDTO**:
```typescript
// src/dtos/post.dto.ts (o similar)
export interface UpdatePostDTO {
  title?: string;
  message?: string;
  typePost?: number;  // NUEVO
}
```

2. **Endpoint para artículos**:
```typescript
// Controlador de posts
@Put('/:id/articles')
async updatePostArticles(
  @Param('id') postId: number,
  @Body() body: { articles: { idArticle: number, quantity: number }[] }
) {
  // Lógica para reemplazar/actualizar artículos
}
```

3. **Actualizar servicio de frontend**:
```typescript
// posts.service.ts
export interface UpdatePostDTO {
  title?: string;
  message?: string;
  typePost?: number;  // AGREGAR
}

updatePostArticles(postId: number, articles: any[]): Observable<ApiResponse> {
  return this.http.put<ApiResponse>(`${this.postEndpoint}/${postId}/articles`, { articles });
}
```

4. **Habilitar en EditComponent**:
```typescript
// Agregar select de tipo
selectedTypeId: number | null = null;

// Agregar panel de artículos (reutilizar de CreateEditComponent)
articleChecklistItems: ArticleChecklistItem[] = [];

// En onSubmit agregar
await firstValueFrom(this.postsService.updatePost(this.postId, {
  title: this.title,
  message: this.message,
  typePost: this.selectedTypeId  // NUEVO
}));

// Sync artículos si hay cambios
await this.syncArticles();
```

---

## Resumen

**Editables ahora**: Título, descripción, imágenes, tags  
**No editables**: Tipo, artículos (requieren nuevos endpoints)  
**Solución temporal**: Mostrar tipo y artículos como información de solo lectura
