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
  Async: 'Asíncrono',
};

export const levelTextEs: Record<string, LevelText> = {
  '01-hello-world': {
    title: 'Hola, mundo',
    brief: 'Abre una tienda online pequeña. Unas 50 personas por segundo verán el catálogo. Atiéndelas con un app server y una base de datos.',
    guidedHint: 'Conecta el app server a la base de datos para que pueda responder peticiones. Luego haz que lleguen los usuarios.',
    tutorial: [
      { text: 'Selecciona el app server para ver su configuración en el inspector.' },
      { text: 'Las peticiones llegan al app server, pero no siguen. Arrastra desde el app server hasta la base de datos para conectarlos.' },
      { text: 'Pulsa «Release a producción» para empezar la oleada, o espera a que acabe la cuenta atrás.' },
      { text: 'Mira cómo viajan las peticiones y vuelven. Aguanta hasta que termine la oleada.' },
    ],
  },
  '02-first-spike': {
    title: 'Primer pico',
    brief: 'Una newsletter habló de la tienda y el tráfico subió a 300 personas por segundo. Un app server atiende unas 200. Pon un load balancer delante y usa más instancias.',
    guidedHint: 'Una instancia de app server atiende unas 200 req/s. Selecciona el app server y añade instancias hasta que cada una quede por debajo del 70 % de carga.',
  },
  '03-bigger-or-more': {
    title: '¿Más grande o más?',
    brief: 'El tráfico se quedó en 250 personas por segundo. Ahora puedes elegir el tamaño de cada instancia de app server. ¿Una máquina más grande es más barata que varias pequeñas detrás de un load balancer?',
    guidedHint: 'Una instancia mediana se queda corta para 250 req/s. Selecciona el app server y prueba el tamaño Grande.',
  },
  '04-flash-sale': {
    title: 'Venta flash',
    brief: 'Una venta flash: 500 personas por segundo durante 30 segundos, y casi todas cargan las mismas páginas de producto. Una base de datos más grande aguantaría, pero ¿hay una forma más barata?',
    guidedHint: 'La base de datos pequeña no aguanta la venta sola. Pon la caché entre los app servers y la base de datos, y sube su TTL.',
  },
  '05-popular-content': {
    title: 'Contenido popular',
    brief: 'Un post viral manda 600 personas por segundo durante 40 segundos. Tu base de datos está fija en el tier pequeño y los datos de producto pueden tener como mucho 60 segundos de retraso. ¿Cuánto tiempo debe guardar la caché las respuestas?',
    guidedHint: 'Con un TTL de 10 s, la mayoría de peticiones aún llega a la base de datos. Selecciona la caché y sube su TTL.',
  },
  '06-server-goes-down': {
    title: 'Se cae un servidor',
    brief: 'El tráfico es estable, 300 personas por segundo, y a los 10 segundos de la oleada se cae una de tus instancias de app server. En un buen día bastan tres instancias. ¿Bastan en un mal día?',
    guidedHint: 'Cuando se cae una instancia, las demás deben llevar su tráfico. Añade una instancia más de las que necesitas.',
  },
  '07-tight-budget': {
    title: 'Presupuesto ajustado',
    brief: 'Vuelve la venta flash, y esta vez el dinero es escaso. Una base de datos más grande aguantaría, pero no te la puedes permitir. Encuentra la base más barata que aún aguante.',
    guidedHint: 'Mejorar la base de datos cuesta demasiado aquí. Pon la caché delante de la base de datos pequeña.',
  },
  '08-black-friday': {
    title: 'Black Friday',
    brief: 'Todo a la vez: 500 personas por segundo durante 40 segundos, una instancia de app server se cae a los 15 segundos de la oleada y el dinero es escaso. Es el examen final del capítulo.',
    guidedHint: 'Durante el pico se cae un app server. Añade instancias hasta que las demás aún puedan llevar 500 req/s.',
  },
  '09-slow-processing': {
    title: 'Procesamiento lento',
    brief: 'Tu app de vídeo deja subir vídeos, y cada subida hay que procesarla: cerca de un segundo de trabajo. Llegan seis subidas por segundo. Procesar dentro de la petición hace esperar a todos los usuarios. Pon una cola de mensajes entre el app server y un Worker: la cola responde al instante y el Worker hace el trabajo en segundo plano.',
    guidedHint: 'Procesar un vídeo dentro de la petición es lento. Conecta la cola de mensajes al Worker: la cola responde al instante y el Worker toma los trabajos en segundo plano.',
  },
  '10-watch-and-upload': {
    title: 'Ver y subir',
    brief: 'Ahora la gente ve vídeos y los sube a la vez: 40 visionados y 10 subidas por segundo. Un visionado debe responderse al instante, así que sigue siendo síncrono: lo responde la caché o la base de datos. Solo el trabajo lento, procesar una subida, va a la cola. Tu app server manda cada tipo de petición por su camino.',
    guidedHint: 'Solo el trabajo lento va a la cola: los visionados siguen siendo síncronos. El app server manda cada tipo de petición por su camino. Añade un Worker para que las subidas no se acumulen.',
  },
};
