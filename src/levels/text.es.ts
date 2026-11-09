// Spanish level texts. The level JSON files hold the English texts and the rules;
// this table only replaces the texts. levels.test.ts checks every level has a complete entry.

export type LevelText = {
  title: string;
  brief: string;
  guidedHint: string;
  /** Same length and order as the level's tutorial; `textCompact` where English has one. */
  tutorial?: { text: string; textCompact?: string }[];
};

export const chaptersEs: Record<string, string> = {
  Core: 'Fundamentos',
};

export const levelTextEs: Record<string, LevelText> = {
  '01-hello-world': {
    title: 'Hola, mundo',
    brief: 'Abre una tienda online pequeña. Unas 50 personas por segundo verán el catálogo. Atiéndelas con un app server y una base de datos.',
    guidedHint: 'Conecta el app server a la base de datos para que pueda responder peticiones. Luego pulsa Jugar.',
    tutorial: [
      { text: 'Selecciona el app server para ver su configuración en el inspector.' },
      {
        text: 'Las peticiones llegan al app server, pero no siguen. Arrastra desde su punto derecho hasta la base de datos para conectarlos.',
        textCompact: 'Las peticiones llegan al app server, pero no siguen. En el inspector, elige Base de datos en "Manda peticiones a" para conectarlos.',
      },
      { text: 'Pulsa Jugar para mandar 60 segundos de tráfico por tu diseño.' },
      { text: 'La ejecución se repite en pocos segundos: mira el reloj y la carga de cada componente, y luego lee el informe.' },
    ],
  },
  '02-first-spike': {
    title: 'Primer pico',
    brief: 'Una newsletter habló de la tienda y el tráfico subió a 300 personas por segundo. Un app server atiende unas 200. Pon un load balancer delante y usa más instancias.',
    guidedHint: 'Una instancia de app server atiende unas 200 req/s. Selecciónala y añade una segunda instancia.',
  },
  '03-bigger-or-more': {
    title: '¿Más grande o más?',
    brief: 'El tráfico se quedó en 250 personas por segundo. Ahora puedes elegir el tamaño de cada instancia de app server. ¿Una máquina más grande es más barata que varias pequeñas detrás de un load balancer?',
    guidedHint: 'Una instancia mediana se queda corta para 250 req/s. Selecciona el app server y prueba el tamaño Grande.',
  },
  '04-flash-sale': {
    title: 'Venta flash',
    brief: 'Una venta flash de 10 segundos empieza a los 30 s y el tráfico salta de 200 a 500 personas por segundo. Casi todas cargan las mismas páginas de producto. Una base de datos más grande aguantaría, pero ¿hay una forma más barata?',
    guidedHint: 'La base de datos pequeña no aguanta el pico sola. Pon la cache entre los app servers y la base de datos.',
  },
  '05-popular-content': {
    title: 'Contenido popular',
    brief: 'Un post viral manda 600 personas por segundo durante 40 segundos. Tu base de datos está fija en el tier pequeño y los datos de producto pueden tener como mucho 60 segundos de retraso. ¿Cuánto tiempo debe guardar la cache las respuestas?',
    guidedHint: 'Con un TTL de 10 s, la mayoría de peticiones aún llega a la base de datos. Selecciona la cache y sube su TTL.',
  },
  '06-server-goes-down': {
    title: 'Se cae un servidor',
    brief: 'El tráfico es estable, 300 personas por segundo, y a los 20 s se cae una de tus instancias de app server. En un buen día bastan dos instancias. ¿Bastan en un mal día?',
    guidedHint: 'Cuando se cae una instancia, las demás deben llevar su tráfico. Añade una instancia más de las que necesitas.',
  },
  '07-tight-budget': {
    title: 'Presupuesto ajustado',
    brief: 'Vuelve la venta flash, y esta vez finanzas limitó la factura a $230 al mes. Una base de datos más grande aguantaría, pero se pasaría del presupuesto. Encuentra el diseño más barato que aún aguante.',
    guidedHint: 'Mejorar la base de datos cuesta demasiado aquí. Pon la cache delante de la base de datos pequeña.',
  },
  '08-black-friday': {
    title: 'Black Friday',
    brief: 'Todo a la vez: el tráfico se dobla a 500 personas por segundo durante 15 segundos, una instancia de app server se cae en mitad del pico y el presupuesto es ajustado. Es el examen final del capítulo.',
    guidedHint: 'Durante el pico se cae un app server. Añade instancias hasta que las demás aún puedan llevar 500 req/s.',
  },
};
