# SEO y Google Business Profile – Solace

## Mejoras ya aplicadas para Google

- **Meta y enlaces:** title, description, keywords, canonical, Open Graph, Twitter Card.
- **Datos estructurados:** JSON-LD tipo Restaurant (nombre, dirección, teléfono, horario, etc.).
- **Archivos técnicos:** `robots.txt`, `sitemap.xml`.
- **Rendimiento:** `preload` de la imagen principal del hero, `loading="lazy"` en el resto de imágenes.
- **Señales para buscadores:** `theme-color`, `robots: index, follow`.
- **Imágenes:** textos alternativos (`alt`) en todas las imágenes.

---

## Archivos creados

| Archivo | Uso |
|--------|-----|
| **robots.txt** | Indica a los buscadores qué pueden rastrear y dónde está el sitemap. |
| **sitemap.xml** | Lista la(s) página(s) del sitio para que Google las indexe. |
| **Meta tags y JSON-LD en index.html** | Título, descripción, Open Graph, Twitter Card y datos estructurados (Restaurant) para buscadores y redes. |

---

## Qué debes hacer tú

### 1. Sustituir TU-DOMINIO.com

En todo el proyecto, sustituye **`TU-DOMINIO.com`** por tu dominio real, por ejemplo:

- `solace-lawrence.netlify.app`  
- o `www.tudominio.com`

**Dónde se usa:**

- **index.html:** en `<link rel="canonical">`, en las meta `og:url`, `og:image`, `twitter:image` y en el JSON-LD (`url`, `image`).
- **robots.txt:** en la línea `Sitemap: https://...`
- **sitemap.xml:** en `<loc>https://...</loc>`

Puedes usar “Buscar y reemplazar” en el editor: buscar `TU-DOMINIO.com` y reemplazar por tu URL (sin `https://` si quieres, y luego añadir `https://` solo donde haga falta en URLs completas).

### 2. Verificar en Google Search Console

1. Entra en [Google Search Console](https://search.google.com/search-console).
2. Añade la propiedad con la URL de tu sitio (ej.: `https://tudominio.com`).
3. Verifica la propiedad (por ejemplo con la etiqueta HTML que te da Google o subiendo un archivo).
4. Envía el sitemap: **Sitemaps** → Añadir sitemap → `https://tudominio.com/sitemap.xml`.

### 3. Google Business Profile (antes “Google My Business”)

Esto se hace en la consola de Google, no con archivos del sitio:

1. Entra en [Google Business Profile](https://business.google.com).
2. Inicia sesión con la cuenta de Google que quieras usar para el negocio.
3. **Añadir negocio** o **Reclamar negocio** si ya existe (por nombre y dirección).
4. Completa:
   - Nombre: Solace Brazilian Steakhouse & Bar  
   - Dirección: 101 Essex St, Lawrence, MA  
   - Teléfono: (978) 616-2060  
   - Categoría: Restaurante brasileño / Steakhouse  
   - Horario: Lunes cerrado, Martes–Domingo 11:00–00:00  
   - Web: tu URL (la misma que pusiste en TU-DOMINIO.com)  
   - Botón “Reservar”: enlace a tu formulario de reservas  
5. Verifica el negocio (por correo, teléfono o tarjeta, según lo que ofrezca Google).

El **JSON-LD** que está en tu web ayuda a Google a asociar tu sitio con tu ficha de Business Profile y a mostrar mejor la información en buscador y mapa.

### 4. Imagen para redes (opcional)

Las meta **og:image** y **twitter:image** usan `image/logo1.png`. Si quieres una imagen distinta para cuando compartan el enlace (por ejemplo una foto del restaurante o del plato), cambia en **index.html** la URL de `og:image` y `twitter:image` a esa imagen (por ejemplo `https://tudominio.com/image/og-image.jpg`). Tamaño recomendado: 1200×630 px.

---

## Resumen

- **Archivos listos:** `robots.txt`, `sitemap.xml`, meta tags y JSON-LD en `index.html`.  
- **Tú:** reemplazar `TU-DOMINIO.com` por tu dominio, verificar en Search Console, enviar el sitemap y configurar/verificar Google Business Profile.

---

## Recomendaciones adicionales (fuera del código)

1. **Imágenes:** Comprimir fotos (TinyPNG, Squoosh) y usar WebP donde puedas para mejorar velocidad y Core Web Vitals.
2. **Contenido:** Añadir una sección tipo “Preguntas frecuentes” (FAQ) con schema FAQPage ayuda a aparecer en resultados enriquecidos.
3. **Google Business Profile:** Mantener horarios, fotos y publicaciones al día; responder reseñas.
4. **Enlaces:** Conseguir enlaces desde directorios locales, guías y medios (Lawrence, MA, restaurantes) mejora la autoridad.
5. **Velocidad:** En Netlify la página ya se sirve rápido; si añades muchas imágenes, considera CDN o tamaños adaptativos.
