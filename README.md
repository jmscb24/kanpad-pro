# KanPad Pro para Kanlane

Notas del proyecto organizadas en carpetas, con cuatro editores: **Docs**, **Codepad**, **Grid** y **Markdown**.

## Uso

Al abrir el plugin aparece **Inicio**. Desde ahí puedes crear carpetas y notas, buscar, filtrar, ordenar, renombrar, duplicar, mover y eliminar. Cada nota mantiene su tipo de editor. Eliminar una carpeta conserva las notas en **Sin carpeta**.

- **Docs:** contenido enriquecido, tablas con inserción en el cursor, listas, enlaces, bloques de código y notas destacadas.
- **Codepad:** editor monoespaciado, números de línea, selector de lenguaje, formateo y copia. Incluye JavaScript, TypeScript, PHP, Perl, Bash/Shell, PowerShell, Java, C#, Python, Ruby, Go, Rust, Kotlin, Swift, Dart, Lua, R, C, C++, HTML, XML, CSS, SCSS, SQL, JSON, YAML, TOML, Markdown y texto plano. Guarda el lenguaje de cada nota y exporta con su extensión correspondiente. El formateo específico está disponible para JavaScript/TypeScript, JSON, HTML/XML, CSS y SQL; en los demás se aplica una limpieza básica de espacios finales.
- **Markdown:** editor y vista previa en paralelo, vistas individuales, detección automática, títulos, listas y tareas, tablas, citas, enlaces y bloques de código. Permite abrir `.md`/`.markdown`/`.txt`, copiar el original y exportar `.md`. El original se guarda junto a las demás notas del proyecto. Al pegar Markdown reconocible en Docs se aplica su formato en el cursor. La presentación se sanea antes de insertarla.
- **Grid:** celdas editables, fórmulas y referencias, selección de rangos, formato, deshacer/rehacer y CSV/TSV. Empieza con 50 filas y 26 columnas, ampliables hasta 1.000 × 100. Funciones: SUM/SUMA, AVERAGE/PROMEDIO, MIN, MAX y COUNT/CONTAR; operaciones `+ - * / ^` y paréntesis.

El botón **Inicio** guarda el editor y vuelve a las carpetas. **Guardar** muestra «Guardando…», «✓ Guardado» o «Reintentar» según el resultado real y bloquea los clics repetidos durante la escritura. Los botones dan feedback al pulsar con ratón o teclado. También puedes guardar con **Ctrl+S / Cmd+S**; el autosave se activa tras una pausa de escritura. El estado inferior distingue «Guardando», «Guardado en Kanlane», «Guardado localmente» y «Sin guardar». Los errores no se presentan como guardados correctos.

El marco de Docs crece con el texto y las cajas destacadas se adaptan al contenido, incluso con títulos grandes y textos largos.

## Integración con Kanlane

Implementación revisada contra [Kanlane](https://github.com/yalerooo/Kanlane/tree/3f76580a0504d0a223176c864f16f7e667df5cc4), su [guía](https://github.com/yalerooo/Kanlane/blob/3f76580a0504d0a223176c864f16f7e667df5cc4/docs/PLUGINS.md), SDK, anfitrión y plugin [Apariencia](https://github.com/yalerooo/Kanlane/tree/3f76580a0504d0a223176c864f16f7e667df5cc4/plugins/apariencia).

- Mantiene el identificador existente **`com.yalerooo.kanpad-pro`** para conservar la instalación y sus datos.
- El SDK y su CSS se cargan desde `https://kanlane.com/plugins/sdk/`.
- En el **panel**, conecta primero, verifica el permiso `storage`, carga las notas del proyecto y abre Inicio. Ante un fallo de conexión o lectura muestra el error y ofrece reintentar; no abre una biblioteca local de sustitución.
- En **segundo plano**, registra únicamente una acción «Abrir KanPad Pro» en la paleta de comandos. No carga ni guarda una biblioteca ni inicializa editores.
- Usa `wh.storage` del **proyecto**; no usa el espacio global del usuario. Las notas de un proyecto no se mezclan con otro. Los eventos de proyecto y de almacenamiento permiten recargar los datos; si hay cambios locales pendientes, un cambio de otra ventana se avisa sin reemplazar el editor.
- Dentro del sandbox opaco no accede a `localStorage` y no utiliza los cuadros nativos `alert`, `confirm` o `prompt`. Borrados, importaciones, enlaces y selección de lenguaje usan diálogos propios.
- Los permisos solicitados son `storage`, `tasks:read` y `ui:extend`. El icono es `book`, reconocido por Kanlane. No requiere `appearance` ni escribir tareas.
- El selector de tareas usa las tareas reales del proyecto y el campo `cliente`; una lista vacía no se rellena con tareas inventadas.

### Persistencia y migración

Las versiones anteriores guardaban `kanpad_notes` y `kanpad_folders`. Se leen en el mismo proyecto y se conservan; al modificar datos se publica la biblioteca v2 en **`kanpad_library_v2`**. Las instalaciones vacías permanecen vacías y no generan notas de ejemplo.

Una biblioteca pequeña se guarda en una sola escritura. Una biblioteca grande se divide en claves `kanpad_part_*`, de menos de 100 KB por clave, y se publica su índice solo después de guardar todas sus partes. Si falla la publicación, la biblioteca previamente confirmada sigue disponible. Los guardados se serializan y las escrituras SDK se espacian para respetar el límite de 60 por minuto; no se escribe al abrir una biblioteca que no ha cambiado.

Se mantienen los límites totales de Kanlane: 800 KB por plugin y proyecto, o 600 KB en proyectos con cifrado total, incluyendo versiones conservadas durante un guardado y datos antiguos de migración. Un error de cuota se muestra en el estado; el contenido del editor sigue disponible para exportar o reintentar. Los datos del proyecto nunca se trasladan automáticamente al almacenamiento del usuario ni al modo local.

### Apariencia

El SDK aplica y actualiza las variables que exporta Kanlane: colores, acento, superficies, bordes, fuente y radios. KanPad las utiliza también en Docs, Codepad, Grid, Markdown y diálogos. El fondo exterior es transparente para que se vea el fondo de Kanlane y los cambios de Apariencia; el editor de código sigue el tema elegido.

El contrato actual del SDK no transmite los atributos de densidad, tamaño de texto o movimiento de Apariencia. KanPad sigue las variables disponibles y la preferencia de movimiento reducido del navegador; no intenta leer el DOM de la página anfitriona.

## Publicación

Publica los archivos en un alojamiento HTTPS, por ejemplo GitHub Pages. Instala la **URL de `index.html`**, no la página del repositorio, desde **Kanlane → Plugins → Añadir**. Para este repositorio, si GitHub Pages está activado en la raíz de `main`, la URL es:

```
https://jmscb24.github.io/kanpad-pro/index.html
```

Conserva la instalación actual si ya utiliza esa dirección; recarga Kanlane tras publicar. No desinstales para actualizar: Kanlane borra los datos del proyecto al quitar un plugin.

## Modo independiente

Puedes abrir `index.html` directamente o servirlo con `python3 -m http.server 8080`. Se abre en Inicio y guarda en el navegador. Este almacenamiento es independiente del de Kanlane; no se usa como respaldo de los proyectos.

## Verificación

Pruebas sin dependencias externas (Node.js):

```bash
node --test tests/grid.test.js tests/storage.test.js
```

Pruebas de navegador con Playwright y Chromium, con el proyecto servido en el puerto 8080:

```bash
node tests/home.browser.cjs
node tests/grid.browser.cjs
node tests/markdown.browser.cjs
```

Integración con el código de Kanlane:

```bash
git clone https://github.com/yalerooo/Kanlane.git ../kanlane-reference
node tests/kanlane.browser.cjs
```

La última prueba carga el SDK, `PluginFrame`, `PluginsController`, `PluginModel`, los estilos y el plugin Apariencia del checkout indicado. Usa el sandbox real, sin `allow-same-origin` ni `allow-modals`. Sustituye solo el backend de datos por un almacenamiento de prueba; no necesita una cuenta Firebase. Verifica conexión y permisos, Inicio, carpetas, los cuatro editores, tablas, CSV, guardado y reapertura, Apariencia, bibliotecas de más de 100 KB, separación por proyecto, segundo plano y sondeo de instalación. La sincronización con una cuenta real de Kanlane requiere una prueba posterior en esa cuenta.

Variables opcionales: `GRID_TEST_URL`, `GRID_CHROMIUM_PATH` y `KANLANE_SOURCE`.

## Archivos

- `index.html`, `css/styles.css`: interfaz y estilos.
- `js/app.js`: panel, SDK, editores y ciclo de vida.
- `js/markdown.js`: detección y presentación segura de Markdown.
- `js/vendor/`: Marked 18.1.2 (MIT) y DOMPurify 3.4.17 (Apache-2.0 o MPL-2.0), con sus licencias, servidos desde el plugin. No requieren CDN ni compilación.
- `js/home.js`: Inicio y carpetas.
- `js/grid.js`: hoja de cálculo, fórmulas y CSV.
- `js/storage.js`: almacenamiento local o por proyecto, migración y fragmentos.
- `js/dialogs.js`: diálogos compatibles con el sandbox y copia.
- `js/code-highlighter.js`: formateo de código.
- `manifest.json`: descripción del plugin; coincide con el manifiesto enviado por el SDK.
