# 📝 KanPad Pro — Plugin para Kanlane

> **El bloc de notas avanzado para Kanlane**: combina un procesador de documentos enriquecidos (tipo **Google Docs / Word**) con tablas y formato visual, más un potente editor de código (tipo **Notepad++**) con detección de lenguaje, números de línea y formateo inteligente (*prettify*).

---

## ✨ Características Principales

### Inicio y gestión de notas (v1.2)
- La aplicación abre en **Inicio**, con tarjetas de documentos, código y hojas Grid, buscador, filtros por tipo y orden por nombre, tipo o fecha.
- Crea, abre, renombra, mueve, duplica y elimina notas. Puedes borrar también la última nota y crear una nueva desde una biblioteca vacía.
- Crea y renombra carpetas. Al eliminar una carpeta, sus notas se conservan en **Sin carpeta**. Las carpetas son de un solo nivel.
- Las notas nuevas se crean en la carpeta que tengas seleccionada. El botón **Inicio** guarda el editor y vuelve al gestor.
- Las notas existentes se conservan; aquellas que no tenían carpeta aparecen en **Sin carpeta**. Notas y carpetas usan `kanpad_notes` y `kanpad_folders` en el almacenamiento de Kanlane y el respaldo local.
- El modo independiente utiliza directamente el almacenamiento del navegador; la conexión SDK se intenta cuando se abre integrado en un iframe.
- **Insertar Tabla** en Docs conserva el cursor al abrir el modal, valida las dimensiones y guarda la tabla insertada. Si aún no colocaste el cursor, se añade al final del documento.


### 1. 📄 Modo Documento (Docs / Word Pro)
- **Formato Enriquecido**: Títulos (H1, H2, H3), Negrita, Cursiva, Subrayado, Tachado, Citas destacadas y Listas.
- **📊 Tablas Interactivas**: Asistente visual para insertar tablas de cualquier tamaño (filas × columnas) con encabezados y celdas estilizadas.
- **💡 Cajas de Aviso / Callouts**: Inserta notas informativas, avisos de advertencia (`warning`) o confirmaciones (`success`).
- **💻 Bloques de Código Integrados**: Incrusta snippets de código con selector de lenguaje y botón de copia con un clic.
- **Hoja de Trabajo Flotante**: Diseño visual de hoja de papel centrada y limpia adaptada a pantallas grandes y móviles.

### 2. ⚡ Modo Notepad++ (Editor de Código)
- **Gutter con Números de Línea**: Numeración en tiempo real sincronizada con el scroll y escritura.
- **Formateo Inteligente (Prettify)**: Botón **"⚡ Formatear Código"** que detecta automáticamente o según el selector la sintaxis y limpia la indentación (JSON, JavaScript, HTML, CSS, SQL, Python).
- **Soporte para Tab**: Presionar `Tab` añade 2 espacios sin perder el foco en el editor.
- **Copiar Todo**: Copia todo el contenido del código directamente al portapapeles.
- **Barra de Estado**: Contador de líneas, palabras, caracteres y estado de guardado.

### 3. ▦ Grid (Hoja de cálculo)
- **Tercera sección independiente** junto a Documento y Notepad++, con filtro Grid y varias hojas guardadas como notas.
- **Celdas editables** con cabeceras A–Z (ampliables hasta CV) y filas numeradas. Cada hoja empieza con 50 filas y 26 columnas, ampliables hasta 1.000 × 100.
- **Fórmulas** con referencias (`=A1*B1`), rangos (`=SUMA(A1:A10)`), paréntesis, `+`, `-`, `*`, `/`, `^`, y funciones `SUM`/`SUMA`, `AVERAGE`/`PROMEDIO`, `MIN`, `MAX`, `COUNT`/`CONTAR`. Recalcula al editar y muestra errores de referencia, división por cero o referencias circulares.
- **Barra de fórmulas y dirección de celda**, negrita, número con dos decimales, euros y porcentajes; resumen de selección con suma.
- **Teclado y portapapeles**: flechas, Tab y Enter para navegar; doble clic o F2 para editar; Escape para cancelar; Mayús + clic o Mayús + flechas para seleccionar rangos; Supr para vaciar; copiar, cortar y pegar tablas desde Excel/Google Sheets.
- **Deshacer y rehacer** (botones, Ctrl/Cmd+Z y Ctrl/Cmd+Y), incluyendo pegado, formato e importación. El historial se conserva mientras la hoja está abierta.
- **Importación CSV/TSV** con comillas, saltos de línea y detección de separadores (coma, punto y coma o tabulador). Importar reemplaza la hoja previa tras confirmarlo. Límite de archivo: 5 MB.
- **Exportación CSV** desde el botón Exportar: descarga resultados calculados en UTF-8. Las fórmulas y el formato se conservan en el guardado de KanPad; CSV no conserva formato ni fórmulas. No importa archivos `.xlsx`.
- **Autosave** mediante el almacenamiento existente de Kanlane y respaldo local. El cálculo se realiza en el navegador sin ejecutar fórmulas como JavaScript.

Ejemplo: escribe `10` en A1, `20` en A2 y `=SUMA(A1:A2)` en B1 para obtener `30`. Las fórmulas admiten punto decimal y separadores de argumentos `,` o `;`; los valores numéricos de las celdas admiten coma decimal.

### 4. 🎯 Integración Nativa con Kanlane
- **SDK Oficial (`workhub-plugin.js`)**: Comunicación segura mediante `iframe` aislado de Kanlane.
- **Autosave y Almacenamiento Persistente**: Guarda automáticamente todas las notas en el almacenamiento de Kanlane (`wh.storage`).
- **📌 Vinculación de Tareas**: Puedes abrir un modal con tus tareas actuales de Kanlane (`wh.tasks.list()`) e insertarlas como tarjetas vinculadas en tus notas.
- **Adaptación al Tema**: Sigue automáticamente los colores y temas claro/oscuro de Kanlane gracias a sus variables CSS oficiales.
- **🛡️ Modo Independiente (Local / Standalone)**: Si abres el archivo directamente en tu navegador fuera de Kanlane, funciona de inmediato usando `localStorage` para que puedas probarlo y editar sin restricciones.

---

## 📁 Estructura del Proyecto

```
kanpad-pro/
├── index.html              # Interfaz principal (UI, barra de herramientas y modales)
├── manifest.json           # Configuración y permisos del plugin para Kanlane
├── css/
│   └── styles.css          # Estilos modernos con variables de diseño de Kanlane
├── js/
│   ├── app.js              # Lógica principal, estado de notas y SDK Kanlane
│   ├── code-highlighter.js # Formateador y detector de sintaxis multilinguaje
│   ├── grid.js             # Editor Grid, fórmulas, portapapeles y CSV
│   └── home.js             # Inicio, tarjetas de notas y navegación de carpetas
└── README.md               # Esta documentación
```

---

## 🚀 Cómo Probarlo en Local

Puedes probar el plugin en tu equipo de varias formas:

### Opción A: Abrir directamente en el navegador
Simplemente haz doble clic en `index.html` o ábrelo con Chrome/Edge. El plugin detectará automáticamente que está en modo local y usará `localStorage` para guardar tus notas.

### Opción B: Usar un servidor local ligero
Si tienes Node.js o Python instalado:

```powershell
# Con Python:
python -m http.server 8080

# O con npx:
npx serve .
```
Luego visita `http://localhost:8080` en tu navegador.

---

## 🌐 Cómo Instalarlo en Kanlane

Los plugins de Kanlane se ejecutan mediante URLs seguras con HTTPS (por ejemplo alojados en **GitHub Pages**):

1. **Sube este proyecto a tu repositorio de GitHub**:
   - Crea un repositorio (ej: `kanpad-pro`).
   - Sube los archivos de esta carpeta.
   - En GitHub: Ve a **Settings** → **Pages** → y activa GitHub Pages en la rama `main`.
   - Obtendrás una URL como: `https://tu-usuario.github.io/kanpad-pro/`

2. **Añádelo a Kanlane**:
   - En tu aplicación de Kanlane, ve a la sección **Plugins**.
   - Pega la URL de tu plugin (ej: `https://tu-usuario.github.io/kanpad-pro/index.html`).
   - Haz clic en **Añadir**, revisa los permisos solicitados (`storage`, `tasks:read`, `tasks:write`, `ui:extend`) y pulsa **Instalar**.
   - ¡Listo! Tendrás tu bloc de notas pro disponible como panel integrado en Kanlane.

---

## 🔒 Permisos Solicitados
- `storage`: Permite guardar tus documentos y código de forma segura en Kanlane.
- `tasks:read`: Permite listar tus tareas para vincularlas en las notas.
- `tasks:write`: Permite crear o actualizar tareas desde tus notas.
- `ui:extend`: Permite abrir vistas y formularios dentro de Kanlane.


## Verificación

Pruebas del motor de cálculo y CSV (Node.js, sin instalar dependencias):

```bash
node --test tests/grid.test.js
```

Prueba funcional del navegador: con Playwright y Chromium instalados, sirve el proyecto con `python3 -m http.server 8080` y ejecuta `node tests/grid.browser.cjs` y `node tests/home.browser.cjs`. Puedes indicar otra URL mediante `GRID_TEST_URL`. Comprueba edición, recálculo, formato, rangos, pegado, deshacer/rehacer, guardado tras recarga, aislamiento entre notas, CSV y tamaño móvil.

La prueba de Inicio verifica la migración de notas previas, la inserción de tablas en el cursor y su recuperación al recargar, validación de dimensiones, gestión de carpetas, mover/renombrar/duplicar/borrar notas, cancelación de borrados, filtros y biblioteca vacía. Incluye una integración SDK simulada para verificar el guardado y que una colección remota vacía no restaure un respaldo antiguo.
