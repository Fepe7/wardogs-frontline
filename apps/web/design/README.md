# Imágenes para compartir

Fuentes HTML de las imágenes de `public/`. Todo es arte propio: el logo de tres cuñas y el mapa de hexágonos, sin recursos de WARDOGS.

| Imagen | Fuente | Tamaño |
|---|---|---|
| `public/og-image.png` (vista previa al compartir el enlace) | `og-image.html` | 1200 × 630 |
| `public/apple-touch-icon.png` (icono en iOS) | `touch-icon.html` | 180 × 180 |
| `public/favicon.svg` | Se edita directamente | Vectorial |

Para regenerar un PNG con Chrome sin interfaz (desde `apps/web`):

```
chrome --headless=new --hide-scrollbars --virtual-time-budget=5000 --window-size=1200,630 --screenshot=public/og-image.png design/og-image.html
chrome --headless=new --hide-scrollbars --window-size=180,180 --screenshot=public/apple-touch-icon.png design/touch-icon.html
```
