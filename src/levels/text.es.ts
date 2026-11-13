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
  'Data scale': 'Escala de datos',
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
  '11-upload-rush': {
    title: 'Avalancha de subidas',
    brief: 'Un creador famoso lanza un reto y, durante 20 segundos, llegan 30 subidas por segundo: muchas más de las que tus Workers pueden procesar. La cola acepta cada trabajo al instante y deja que los Workers los saquen a su ritmo, lo que además protege a la base de datos pequeña del pico. Eso es load leveling (nivelar la carga). Pero una cola solo absorbe un pico. Si la carga se mantiene por encima de lo que tus Workers procesan, el Backlog y la edad de la cola crecen sin fin.',
    guidedHint: 'Una cola absorbe un pico, pero no arregla una carga que se mantiene demasiado alta. Añade Workers hasta que la edad de la cola quede por debajo de su máximo mientras el Backlog se vacía.',
  },
  '12-worker-goes-down': {
    title: 'Se cae un Worker',
    brief: 'Llegan ocho subidas por segundo y, a los 10 segundos de la oleada, se cae uno de tus Workers. No se pierde nada: los mensajes siguen en la cola y los demás Workers siguen tomándolos. Es la entrega at-least-once (al menos una vez). El precio es que un trabajo que el Worker estaba procesando al caerse se entregará otra vez, así que un trabajo puede ejecutarse dos veces, y los Workers reales deben ser idempotentes: ejecutar un trabajo dos veces debe dar el mismo resultado que ejecutarlo una vez. ¿Tienes Workers suficientes para un mal día?',
    guidedHint: 'Cuando se cae un Worker, los mensajes siguen en la cola y los demás Workers deben tomarlos. Ten un Worker más de los que necesitas. Un trabajo puede ejecutarse dos veces, así que los Workers deben ser idempotentes.',
  },
  '13-fresh-videos': {
    title: 'Vídeos frescos',
    brief: 'La gente espera que un vídeo nuevo esté listo a los pocos segundos de subirlo. Eso es la edad de la cola (Queue Age): cuánto lleva esperando el mensaje más antiguo. Aquí debe quedar por debajo de 5 segundos, y llegan 10 subidas por segundo. Un Backlog lento no es un error, pero mientras la edad de la cola supera su máximo tu reputación baja. Añade Workers hasta que se mantenga baja, pero cada Worker cuesta dinero. Los sistemas reales añaden y quitan Workers solos según la edad de la cola (autoscaling); aquí lo eliges tú.',
    guidedHint: 'La edad de la cola crece cuando los Workers toman los trabajos más despacio de lo que llegan. Llegan diez trabajos por segundo y un Worker mediano toma cuatro: añade Workers hasta que puedan con todos.',
  },
  '14-launch-day': {
    title: 'Día de lanzamiento',
    brief: 'La app de vídeo sale al público. Casi todos ven vídeos, 480 peticiones por segundo, y una de cada veinte es una subida que procesar. A mitad de la primera oleada se cae un Worker. Usa todo lo que has aprendido: un load balancer delante de varios app servers, una caché para que la base de datos pequeña no reciba una y otra vez la misma pregunta, y una cola con Workers que mantengan la edad de la cola por debajo de 20 segundos incluso sin uno de ellos.',
    guidedHint: 'Los visionados van por el load balancer y los app servers hasta la caché y la base de datos. Las subidas van a la cola y a los Workers. Un Worker se caerá, así que ten uno de repuesto: la edad de la cola debe seguir baja incluso con un Worker menos.',
  },
  '15-too-many-reads': {
    title: 'Demasiadas lecturas',
    brief: 'Tu app de vídeo es un éxito: llegan 480 peticiones por segundo y nueve de cada diez solo leen datos (listas de vídeos, comentarios, visionados). Una base de datos primaria atiende unas 400 peticiones por segundo, así que está llena. Los datos deben estar al día, por eso una caché no ayuda aquí. Una réplica de lectura (Read Replica) es una copia de la base de datos que solo responde lecturas. Añade Read Replicas: el app server les envía las lecturas y deja las escrituras para la base de datos primaria. Las Read Replicas escalan las lecturas, no las escrituras.',
    guidedHint: 'La base de datos primaria está llena de lecturas. Añade Read Replicas: el app server les envía las lecturas y la primaria se queda con las escrituras. Las lecturas son 9 de cada 10 peticiones, así que una Read Replica no basta.',
  },
  '16-just-saved-not-there': {
    title: 'Guardado, pero no está',
    brief: 'Un usuario publica un comentario, la página se recarga y el comentario ha desaparecido. Una Read Replica siempre va un poco por detrás de la base de datos primaria, así que una lectura que cae en ella puede no mostrar lo que el usuario acaba de guardar. Algunas lecturas deben estar al día: Read-your-writes. Van a la base de datos primaria, nunca a una Read Replica; en una Read Replica cuentan como errores. Las lecturas normales aún pueden usar las Read Replicas, pero ahora la primaria tiene más trabajo, así que mantén el app server conectado a ella.',
    guidedHint: 'Una Read Replica va un poco por detrás, así que una lectura que debe mostrar el cambio del propio usuario (Read-your-writes) tiene que ir a la base de datos primaria. Conecta el app server a la primaria además de a las Read Replicas.',
  },
  '17-too-much-to-write': {
    title: 'Demasiado que escribir',
    brief: 'Tu app de vídeo sigue creciendo: llegan 900 peticiones por segundo y siete de cada diez son escrituras (vídeos nuevos, comentarios, «me gusta»). Una Read Replica no ayuda con las escrituras, y una base de datos primaria atiende unas 400 peticiones por segundo. La respuesta es el sharding: reparte los datos en varias Shards, cada una una base de datos que guarda un trozo y atiende solo ese trozo. La Shard Key decide qué Shard guarda cada dato: aquí el id de usuario y el id de vídeo reparten el tráfico por igual. Añade Shards hasta que ninguna esté llena. Cada Shard cuesta dinero, así que no añadas más de las necesarias.',
    guidedHint: 'Una base de datos no puede con 630 escrituras por segundo. Añade Shards: cada una es otra base de datos que guarda un trozo de los datos. Con tres Shards, cada una atiende unas 300 peticiones por segundo. La Shard Key decide cómo se reparte el tráfico: el id de usuario lo reparte por igual.',
  },
  '18-hot-shard': {
    title: 'Hot Shard',
    brief: 'La app de vídeo ya usa sharding, pero algo va mal: una Shard está llena mientras las demás están ociosas. Tu Shard Key reparte mal el tráfico. Con el país, casi todos tus usuarios viven en uno, así que una Shard recibe casi todo el tráfico. Eso es un Hot Shard. Añadir más Shards no lo arregla, porque la misma Shard sigue recibiendo el mismo trozo. Una buena Shard Key reparte el tráfico por igual: el id de usuario lo hace; el país y la fecha no (todas las escrituras de hoy caen en la fecha más nueva). Cambia la Shard Key en la fase de construcción. Durante la oleada está bloqueada: en la vida real, cambiarla significa mover datos y tener tiempo de inactividad.',
    guidedHint: 'Una Shard está llena mientras las demás tienen hueco: el país es una mala Shard Key, porque casi todos los usuarios viven en un país. Más Shards no ayudarían. Elige el id de usuario como Shard Key en la fase de construcción: reparte el tráfico por igual.',
  },
  '19-big-uploads': {
    title: 'Subidas grandes',
    brief: 'La gente ya sube archivos de vídeo grandes: llegan 90 subidas y 210 visionados por segundo. Un archivo enviado a través del app server lo ocupa tanto como diez peticiones normales, así que tus app servers se ahogan. El almacenamiento de objetos (Object Storage) guarda archivos grandes y solo acepta subidas. Usa el patrón de URL prefirmada (pre-signed URL): el app server entrega una dirección firmada y el navegador envía el archivo directo a Object Storage. Conecta a los usuarios a Object Storage además de al app server. Más adelante, el trabajo en la cola solo apuntará al archivo guardado.',
    guidedHint: 'Un archivo enviado a través del app server lo ocupa tanto como diez peticiones normales. Conecta a los usuarios directo a Object Storage: es el patrón de URL prefirmada (pre-signed URL). El app server solo entrega la dirección firmada y el archivo va a Object Storage.',
  },
  '20-release-day': {
    title: 'Día de lanzamiento de datos',
    brief: 'Día de lanzamiento de la app de vídeo, y todo tiene que funcionar junto. Llegan 440 peticiones por segundo: visionados, lecturas y escrituras, subidas grandes y trabajos de procesamiento. Necesitas un load balancer delante de varios app servers, una caché para los visionados, Read Replicas para las lecturas, Object Storage para los archivos y una cola de mensajes con Workers para el procesamiento. Los usuarios deben ver sus propios cambios, así que esas lecturas van a la base de datos primaria. Hay un límite nuevo: el Replication Lag. Muchas escrituras hacen que una Read Replica se quede atrás, y el lag no puede pasar de 2 segundos. Una Read Replica más grande aplica las escrituras más rápido. Mira el lag junto a los demás objetivos.',
    guidedHint: 'El Replication Lag no puede pasar de 2 segundos. Una Read Replica pequeña aplica 100 escrituras por segundo, pero llegan 167: se queda más atrás cada segundo. Usa una Read Replica mediana. Cada pieza tiene su trabajo: subidas directo a Object Storage, Read-your-writes a la base de datos primaria, trabajos por la cola.',
  },
};
