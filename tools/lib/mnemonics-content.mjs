// Authored content for data/kana/mnemonics.json. Kana never appear here as
// typed characters: {h:ka} and {k:ka} are resolved from data/kana/*.json by
// build.mjs, so every kana in the output is copied from the curated tables.
// Keys are the romaji, with "wo" for the object particle and "n" for the moraic n.

export const H = {
  a: {
    kw: ['anchor', 'ancla'], emoji: '⚓',
    story: [
      'An anchor: the bar is its crossbar, the long stroke drops straight through it, and the third stroke loops round the bottom like the rope. In {h:o} the long stroke itself bends into the loop.',
      'Un ancla: la raya es la barra de arriba, el trazo largo baja recto a través de ella y el tercero da la vuelta abajo como la cuerda. En {h:o} es el propio trazo largo el que se dobla en el lazo.',
    ],
    contrast: [['h.o',
      '{h:o} has a dot at the top right, and its long stroke curls into the loop instead of running straight down.',
      '{h:o} tiene un punto arriba a la derecha, y su trazo largo se enrosca en el lazo en vez de bajar recto.']],
  },
  i: {
    kw: ['iguana', 'iguana'], emoji: '🦎',
    story: [
      'Two iguanas climb a wall side by side: the left one is longer and flicks its tail up at the bottom, the right one is short. In {h:ri} it is the right stroke that is long.',
      'Dos iguanas trepan una pared lado a lado: la de la izquierda es más larga y levanta la cola al final, la de la derecha es corta. En {h:ri} el trazo largo es el de la derecha.',
    ],
    contrast: [
      ['h.ri', 'In {h:ri} the right stroke is the long one, and it bends away to the left as it falls.', 'En {h:ri} el trazo largo es el de la derecha, y se curva hacia la izquierda al bajar.'],
      ['h.ko', '{h:ko} lies down: two strokes across, one above the other.', '{h:ko} está acostada: dos trazos de lado, uno sobre otro.'],
    ],
  },
  u: {
    kw: ['udon', 'udon'], emoji: '🍜',
    story: [
      'A bowl of hot udon: the short dash on top is a puff of steam, and one thick noodle climbs out, going right, bending round and dropping down to the left.',
      'Un tazón de udon caliente: la rayita de arriba es una nube de vapor, y un fideo grueso sale del tazón, va a la derecha, se curva y cae hacia la izquierda.',
    ],
    contrast: [
      ['h.tsu', '{h:tsu} has no dash on top.', '{h:tsu} no tiene la rayita de arriba.'],
      ['h.ra', '{h:ra} starts its second stroke by dropping straight down; {h:u} starts it by going right.', 'En {h:ra} el segundo trazo empieza bajando recto; en {h:u} empieza hacia la derecha.'],
    ],
  },
  e: {
    kw: ['elephant', 'elefante'], emoji: '🐘',
    story: [
      'An elephant: the dash on top is its ear, then the trunk runs right, swings down to the left, and at the bottom curls up and out to the right.',
      'Un elefante: la rayita de arriba es la oreja; luego la trompa va a la derecha, baja en diagonal hacia la izquierda y abajo se levanta y sale hacia la derecha.',
    ],
    contrast: [['h.so', '{h:so} has no separate dash: it zigzags across the top in one line.', '{h:so} no tiene rayita aparte: zigzaguea arriba de un solo trazo.']],
  },
  o: {
    kw: ['orca', 'orca'], emoji: '🐋',
    story: [
      'An orca leaps: the bar is the surface of the sea, the long stroke dives through it and curls round into the orca\'s round body, and the dot at the top right is the splash.',
      'Una orca salta: la raya es la superficie del mar, el trazo largo se zambulle a través de ella y se enrosca en el cuerpo redondo de la orca, y el punto de arriba a la derecha es la salpicadura.',
    ],
    contrast: [['h.a', '{h:a} has no dot, and its long stroke runs straight down while a stroke of its own draws the loop.', '{h:a} no tiene punto, y su trazo largo baja recto mientras otro trazo dibuja el lazo.']],
  },
  ka: {
    kw: ['kangaroo', 'canguro'], emoji: '🦘',
    story: [
      'A kangaroo boxes: the first stroke is its arm, reaching right and bending down with a hook for the fist; the second is its tail, slanting down through the arm; the dash on the right is the punch.',
      'Un canguro boxea: el primer trazo es su brazo, que va a la derecha y baja con un gancho por puño; el segundo es la cola, que baja inclinada cruzando el brazo; la rayita de la derecha es el golpe.',
    ],
    contrast: [['k.ka', '{k:ka}, the katakana, is the same without the dash.', '{k:ka}, el katakana, es lo mismo sin la rayita.']],
  },
  ki: {
    kw: ['quiche', 'quiche'], emoji: '🥧',
    story: [
      'A quiche on the table: two cuts across it are the two bars, one long cut slants down through both, and the curve below is the crust. {h:sa} has only one bar.',
      'Una quiche en la mesa: dos cortes de lado a lado son las dos rayas, un corte largo baja inclinado a través de las dos, y la curva de abajo es la masa. {h:sa} tiene una sola raya.',
    ],
    contrast: [
      ['h.sa', '{h:sa} has one bar where {h:ki} has two.', '{h:sa} tiene una raya; {h:ki}, dos.'],
      ['k.ki', '{k:ki}, the katakana, keeps the bars and the long stroke and drops the curve below.', '{k:ki}, el katakana, conserva las rayas y el trazo largo y deja fuera la curva de abajo.'],
    ],
  },
  ku: {
    kw: ['kung fu', 'kung-fu'], emoji: '🥋',
    story: [
      'A kung fu stance: one stroke, like a leg bent ready to kick, in to a sharp point on the left and back out to the right.',
      'Una postura de kung-fu: un solo trazo, como una pierna doblada lista para patear, que entra a una punta a la izquierda y vuelve a salir a la derecha.',
    ],
    contrast: [['h.he', '{h:he} is the same bend lying down, with the point on top.', '{h:he} es la misma curva acostada, con la punta arriba.']],
  },
  ke: {
    kw: ['kendo', 'kendo'], emoji: '🤺',
    story: [
      'A kendo match: the left stroke is one fighter, with a flick at the feet; the bar is a sword held out level; the long stroke on the right is the other fighter, standing through the sword and leaning away at the bottom.',
      'Un combate de kendo: el trazo izquierdo es un luchador, con un golpecito en los pies; la raya es una espada extendida; el trazo largo de la derecha es el otro luchador, de pie a través de la espada y inclinándose al final.',
    ],
    contrast: [
      ['h.ha', '{h:ha} has the same post and bar, but its long stroke ties a loop at the bottom.', '{h:ha} tiene el mismo poste y la misma raya, pero su trazo largo hace un lazo abajo.'],
      ['h.ho', '{h:ho} has two bars and a loop.', '{h:ho} tiene dos rayas y un lazo.'],
    ],
  },
  ko: {
    kw: ['koala', 'koala'], emoji: '🐨',
    story: [
      'A koala naps between two branches: the top one droops at its tip, the bottom one curves like a cradle.',
      'Un koala duerme entre dos ramas: la de arriba se dobla en la punta y la de abajo se curva como una cuna.',
    ],
    contrast: [
      ['h.i', '{h:i} stands up: two strokes side by side, not one above the other.', '{h:i} está de pie: dos trazos uno junto al otro, no uno sobre otro.'],
      ['h.ni', '{h:ni} is {h:ko} with a trunk on the left.', '{h:ni} es {h:ko} con un tronco a la izquierda.'],
    ],
  },
  sa: {
    kw: ['sake', 'sake'], emoji: '🍶',
    story: [
      'Pouring sake: the bar is the tray, the bottle slants down through it, and the curve below is the cup catching the drops. {h:ki} has two bars.',
      'Sirviendo sake: la raya es la bandeja, la botella baja inclinada a través de ella, y la curva de abajo es la taza que recoge las gotas. {h:ki} tiene dos rayas.',
    ],
    contrast: [
      ['h.ki', '{h:ki} has two bars where {h:sa} has one.', '{h:ki} tiene dos rayas; {h:sa}, una.'],
      ['h.chi', '{h:chi} is the mirror image, and its bottom curve belongs to the long stroke instead of being a stroke of its own.', '{h:chi} es su imagen en el espejo, y su curva de abajo es parte del trazo largo, no un trazo aparte.'],
    ],
  },
  shi: {
    kw: ['shiba', 'shiba'], emoji: '🐕',
    story: [
      'A shiba\'s tail: one stroke, straight down and then curling up to the right.',
      'La cola de un shiba: un solo trazo, recto hacia abajo y luego curvándose hacia arriba a la derecha.',
    ],
    contrast: [['k.re', '{k:re}, the katakana re, turns at a sharp corner where {h:shi} curves.', '{k:re}, la re del katakana, gira en una esquina donde {h:shi} se curva.']],
  },
  su: {
    kw: ['sushi', 'sushi'], emoji: '🍣',
    story: [
      'Rolling sushi: the bar is the edge of the bamboo mat; the second stroke drops through it, rolls one loop, the roll itself, and slips away down to the left.',
      'Enrollando sushi: la raya es el borde de la esterilla de bambú; el segundo trazo baja a través de ella, da una vuelta, el propio rollo, y se escapa hacia abajo a la izquierda.',
    ],
    contrast: [['h.mu', '{h:mu} loops too, but then swings out to the right and has a dot.', '{h:mu} también da una vuelta, pero luego sale hacia la derecha y tiene un punto.']],
  },
  se: {
    kw: ['selfie', 'selfi'], emoji: '🤳',
    story: [
      'A selfie: the bar is the selfie stick, the short stroke on the right is the phone hanging from it, and the long stroke on the left is your arm, going down and along to the right.',
      'Una selfi: la raya es el palo de selfi, el trazo corto de la derecha es el teléfono que cuelga, y el largo de la izquierda es tu brazo, que baja y sigue hacia la derecha.',
    ],
    contrast: [['k.se', '{k:se}, the katakana, bends its bar down at the end instead of hanging a separate stroke.', '{k:se}, el katakana, dobla la raya hacia abajo al final en vez de colgar un trazo aparte.']],
  },
  so: {
    kw: ['sofa', 'sofá'], emoji: '🛋️',
    story: [
      'The spring inside a sofa, in one line: it zigzags across the top, drops down to the left and rolls out along the bottom to the right.',
      'El resorte de un sofá, en un solo trazo: zigzaguea arriba, baja hacia la izquierda y se estira abajo hacia la derecha.',
    ],
    contrast: [['h.e', '{h:e} has a separate dash on top where {h:so} zigzags in one line.', '{h:e} tiene una rayita aparte arriba; {h:so} zigzaguea de un solo trazo.']],
  },
  ta: {
    kw: ['taxi', 'taxi'], emoji: '🚕',
    story: [
      'A taxi at its stand: the cross on the left is the taxi sign on its pole, and the two short strokes on the right are the taxi waiting beside it.',
      'Un taxi en su parada: la cruz de la izquierda es el letrero en su poste, y los dos trazos cortos de la derecha son el taxi esperando al lado.',
    ],
    contrast: [
      ['h.na', '{h:na} has the same cross, with a dot and a loop on the right instead.', '{h:na} tiene la misma cruz, pero con un punto y un lazo a la derecha.'],
      ['h.ni', '{h:ni} has a plain post instead of the cross.', '{h:ni} tiene un poste simple en vez de la cruz.'],
    ],
  },
  chi: {
    kw: ['chili', 'chile'], emoji: '🌶️',
    story: [
      'A chili hangs on a string to dry: the bar is the string, the stem crosses it, and the pod curls round below.',
      'Un chile colgado de un cordel: la raya es el cordel, el tallo lo cruza y la vaina se curva abajo.',
    ],
    contrast: [
      ['h.sa', '{h:sa} is the mirror image, and its bottom curve is a stroke of its own.', '{h:sa} es su imagen en el espejo, y su curva de abajo es un trazo aparte.'],
      ['h.ra', '{h:ra} has a short dash instead of a bar, and nothing crosses it.', '{h:ra} tiene una rayita en vez de una raya, y nada la cruza.'],
    ],
  },
  tsu: {
    kw: ['tsuki (moon)', 'tsuki (luna)'], emoji: '🌙',
    story: [
      'Tsuki is Japanese for moon: one stroke, a crescent lying on its back, arcing over to the right and curling down to the left.',
      'Tsuki quiere decir luna en japonés: un solo trazo, una luna creciente acostada, que se arquea hacia la derecha y baja curvándose hacia la izquierda.',
    ],
    contrast: [['h.u', '{h:u} has a dash on top.', '{h:u} tiene una rayita arriba.']],
  },
  te: {
    kw: ['tennis', 'tenis'], emoji: '🎾',
    story: [
      'A tennis serve in one stroke: the arm reaches out level to the right, then swings back down to the left and follows through along the bottom.',
      'Un saque de tenis de un solo trazo: el brazo se estira recto a la derecha, luego vuelve hacia abajo a la izquierda y termina el golpe por abajo.',
    ],
    contrast: [],
  },
  to: {
    kw: ['tortoise', 'tortuga'], emoji: '🐢',
    story: [
      'A tortoise: the short first stroke is its head poking out; the second draws the shell, curving down to the left and running flat along the ground.',
      'Una tortuga: el primer trazo, corto, es la cabeza que asoma; el segundo dibuja el caparazón, curvándose hacia abajo a la izquierda y siguiendo plano por el suelo.',
    ],
    contrast: [],
  },
  na: {
    kw: ['naan', 'naan'], emoji: '🫓',
    story: [
      'A baker at a clay oven: the cross on the left is the long paddle, the dot is a spark, and the last stroke drops down and folds into a loop: the naan.',
      'Un panadero junto al horno de barro: la cruz de la izquierda es la pala larga, el punto es una chispa, y el último trazo baja y se dobla en un lazo: el pan naan.',
    ],
    contrast: [['h.ta', '{h:ta} has the same cross, with two short lines on the right instead of a dot and a loop.', '{h:ta} tiene la misma cruz, con dos líneas cortas a la derecha en vez de un punto y un lazo.']],
  },
  ni: {
    kw: ['ninja', 'ninja'], emoji: '🥷',
    story: [
      'A ninja hides beside two branches: the tall stroke on the left is the ninja, with a flick at the feet, and the two short strokes on the right are the branches.',
      'Un ninja se esconde junto a dos ramas: el trazo alto de la izquierda es el ninja, con un golpecito en los pies, y los dos cortos de la derecha son las ramas.',
    ],
    contrast: [
      ['h.ko', '{h:ko} is the two branches with no ninja.', '{h:ko} son las dos ramas sin el ninja.'],
      ['h.ta', '{h:ta} has a cross on the left instead of a post.', '{h:ta} tiene una cruz a la izquierda en vez de un poste.'],
      ['h.ke', '{h:ke} has one bar, and a long stroke crosses it.', '{h:ke} tiene una sola raya, cruzada por un trazo largo.'],
    ],
  },
  nu: {
    // Revised 2026-09-29: the keyword was a noose, which read as grim.
    kw: ['nucleus', 'núcleo'], emoji: '\u269B\uFE0F', checked_at: '2026-09-29',
    story: [
      'A nucleus and its orbits: the first stroke falls from the upper left, and the second drops across it where the nucleus sits, curls back, sweeps round the right in one wide orbit and circles a small loop at the bottom right. {h:me} stops before the small loop.',
      'Un núcleo y sus órbitas: el primer trazo cae desde arriba a la izquierda, y el segundo baja cruzándolo justo donde está el núcleo, se curva hacia atrás, da una órbita amplia por la derecha y cierra un lacito abajo a la derecha. {h:me} se detiene antes del lacito.',
    ],
    contrast: [['h.me', '{h:me} makes the same wide orbit and ends open, with no small loop.', '{h:me} da la misma órbita amplia y termina abierta, sin el lacito.']],
  },
  ne: {
    kw: ['nectar', 'néctar'], emoji: '🐝',
    story: [
      'The first stroke is a flower stem. A bee crosses it, zigzags back, circles round and stops at a tiny loop: the drop of nectar.',
      'El primer trazo es el tallo de una flor. Una abeja lo cruza, zigzaguea de vuelta, da una vuelta y se para en un lacito: la gota de néctar.',
    ],
    contrast: [
      ['h.re', '{h:re} kicks outward at the end.', '{h:re} patea hacia afuera al final.'],
      ['h.wa', '{h:wa} ends in an open belly that curls back in.', '{h:wa} termina en una panza abierta que se mete hacia adentro.'],
    ],
  },
  no: {
    kw: ['note', 'nota'], emoji: '🎵',
    story: [
      'Hum one long note and draw it: a single stroke dips down to the lower left, then swings up and over the top and down the right side.',
      'Canta una nota larga y dibújala: un solo trazo baja hacia abajo a la izquierda, luego sube, pasa por arriba y baja por la derecha.',
    ],
    contrast: [],
  },
  ha: {
    kw: ['ham', 'jamón'], emoji: '🍖',
    story: [
      'A ham hangs by the shop door: the left stroke is the door post, the bar is the rail, and the last stroke drops from the rail and ties a loop at the bottom, the ham\'s string.',
      'Un jamón cuelga junto a la puerta de la tienda: el trazo izquierdo es el marco, la raya es la barra, y el último trazo baja de la barra y hace un lazo abajo, el cordel del jamón.',
    ],
    contrast: [
      ['h.ho', '{h:ho} has two bars.', '{h:ho} tiene dos rayas.'],
      ['h.ke', '{h:ke} has no loop at the bottom.', '{h:ke} no tiene lazo abajo.'],
    ],
  },
  hi: {
    kw: ['Himalaya', 'Himalaya'], emoji: '🏔️',
    story: [
      'The Himalaya in one stroke: start on a small peak at the left, drop into a deep valley, climb the tall peak on the right and slide off its far side.',
      'El Himalaya de un solo trazo: empieza en un pico pequeño a la izquierda, baja a un valle profundo, sube al pico alto de la derecha y se desliza por el otro lado.',
    ],
    contrast: [],
  },
  fu: {
    kw: ['futon', 'futón'], emoji: '🛌',
    story: [
      'Someone sleeps curled on a futon: the hook on top is the head on the pillow, the big curve is the body, and the two side ticks are the corners of the blanket.',
      'Alguien duerme encogido en un futón: el gancho de arriba es la cabeza, la curva grande es el cuerpo y las dos rayitas de los lados son las esquinas de la manta.',
    ],
    contrast: [],
  },
  he: {
    kw: ['heh heh', 'je, je'], emoji: '😏',
    story: [
      'A sly heh heh: one stroke, a crooked grin that rises to a point on the left and slides down to the right.',
      'Una risa pícara, je, je: un solo trazo, una sonrisa torcida que sube a una punta a la izquierda y baja deslizándose a la derecha.',
    ],
    contrast: [['h.ku', '{h:ku} is the same bend standing up, with the point on the left.', '{h:ku} es la misma curva de pie, con la punta a la izquierda.']],
  },
  ho: {
    kw: ['hockey', 'hockey'], emoji: '🏒',
    story: [
      'A hockey rink: the left stroke is the boards, the two bars are two sticks laid across, and the last stroke drops through both and curls into the puck at the bottom.',
      'Una pista de hockey: el trazo izquierdo es la valla, las dos rayas son dos palos cruzados, y el último trazo baja a través de ambas y se enrosca abajo en el disco.',
    ],
    contrast: [
      ['h.ha', '{h:ha} has one bar.', '{h:ha} tiene una sola raya.'],
      ['h.ma', '{h:ma} has the two bars and the loop but no post on the left.', '{h:ma} tiene las dos rayas y el lazo, pero ningún poste a la izquierda.'],
    ],
  },
  ma: {
    kw: ['mango', 'mango'], emoji: '🥭',
    story: [
      'Two long leaves lie across a mango stalk: the stalk drops through both and curls round at the bottom into the mango.',
      'Dos hojas largas cruzan el tallo de un mango: el tallo baja a través de las dos y se enrosca abajo en el mango.',
    ],
    contrast: [
      ['h.ho', '{h:ho} adds a post on the left.', '{h:ho} añade un poste a la izquierda.'],
      ['h.yo', '{h:yo} has one short bar, on the right only.', '{h:yo} tiene una sola raya corta, solo a la derecha.'],
      ['h.mo', '{h:mo} hangs its bars on a hook and has no loop.', '{h:mo} cuelga sus rayas de un gancho y no tiene lazo.'],
    ],
  },
  mi: {
    kw: ['miso', 'miso'], emoji: '🥣',
    story: [
      'Stirring miso soup: the spoon goes across, cuts down to the left, loops once round the bowl and swings out to the right; then the second stroke drops through the end of that swing.',
      'Revolviendo sopa de miso: la cuchara va de lado, baja cortando hacia la izquierda, da una vuelta al tazón y sale hacia la derecha; luego el segundo trazo cae cruzando el final de esa vuelta.',
    ],
    contrast: [],
  },
  mu: {
    kw: ['mousse', 'mousse'], emoji: '🍮',
    story: [
      'A spoon and a cup of mousse: the bar is the spoon; the second stroke drops through it, loops at the bottom and swings up to the right like the rim of the cup; the dot is a drop of cream.',
      'Una cuchara y una taza de mousse: la raya es la cuchara; el segundo trazo baja a través de ella, da una vuelta abajo y sube hacia la derecha como el borde de la taza; el punto es una gota de crema.',
    ],
    contrast: [['h.su', '{h:su} loops and then drops away down to the left, with no dot.', '{h:su} da la vuelta y luego cae hacia la izquierda, sin punto.']],
  },
  me: {
    kw: ['melon', 'melón'], emoji: '🍈',
    story: [
      'A knife cuts down through a melon: the first stroke is the cut, the second crosses it and rolls round into the melon.',
      'Un cuchillo corta un melón: el primer trazo es el corte y el segundo lo cruza y se enrolla en el melón.',
    ],
    contrast: [['h.nu', '{h:nu} is the same shape with a small loop at the end.', '{h:nu} es la misma forma con un lacito al final.']],
  },
  mo: {
    kw: ['moped', 'moto'], emoji: '🛵',
    story: [
      'The front fork of a moped: the first stroke drops from the handle and curls up at the bottom round the wheel; the two bars crossing it are the handlebar and the basket.',
      'La horquilla de una moto: el primer trazo baja desde el manillar y se curva hacia arriba abajo, alrededor de la rueda; las dos rayas que lo cruzan son el manillar y la canasta.',
    ],
    contrast: [
      ['h.shi', '{h:shi} is the same hook with no bars.', '{h:shi} es el mismo gancho sin rayas.'],
      ['h.ma', 'The long stroke of {h:ma} ends in a loop instead of a hook.', 'El trazo largo de {h:ma} termina en un lazo en vez de un gancho.'],
    ],
  },
  ya: {
    kw: ['yakitori', 'yakitori'], emoji: '🍢',
    story: [
      'Yakitori on the grill: the first stroke is a curled piece of chicken, the dash above it is the smoke, and the long slant is the skewer through it.',
      'Yakitori en la parrilla: el primer trazo es un trozo de pollo curvado, la rayita de arriba es el humo, y la diagonal larga es la brocheta que lo atraviesa.',
    ],
    contrast: [['k.ya', '{k:ya}, the katakana, is the same without the smoke.', '{k:ya}, el katakana, es lo mismo sin el humo.']],
  },
  yu: {
    kw: ['yuzu', 'yuzu'], emoji: '🍋',
    story: [
      'A yuzu cut in half: the first stroke draws the round half, starting down the left and swinging round to the right; the second is the knife cutting down through the middle.',
      'Un yuzu partido por la mitad: el primer trazo dibuja la mitad redonda, bajando por la izquierda y dando la vuelta hacia la derecha; el segundo es el cuchillo que corta por el medio.',
    ],
    contrast: [],
  },
  yo: {
    kw: ['yo! (hey!)', '¡yo! (¡a mí!)'], emoji: '🙋',
    story: [
      'A hand goes up: yo! The short bar is the hand raised to the right, and the long stroke is you, standing straight and crossing your feet in a loop at the bottom.',
      'Levantas la mano: ¡yo! La raya corta es la mano alzada a la derecha, y el trazo largo eres tú, de pie, cruzando los pies en un lazo abajo.',
    ],
    contrast: [['h.ma', '{h:ma} has two long bars crossing its stroke.', '{h:ma} tiene dos rayas largas que cruzan su trazo.']],
  },
  ra: {
    kw: ['racket', 'raqueta'], emoji: '🏸',
    story: [
      'A badminton swing: the dash is the shuttle in the air, and the second stroke is the racket, dropping straight down, then swinging round to the right and back under.',
      'Un golpe de bádminton: la rayita es el volante en el aire, y el segundo trazo es la raqueta, que baja recta y luego da la vuelta hacia la derecha y por debajo.',
    ],
    contrast: [
      ['h.u', '{h:u} starts its second stroke by going right; {h:ra} starts it by dropping straight down.', 'En {h:u} el segundo trazo empieza hacia la derecha; en {h:ra} empieza bajando recto.'],
      ['h.chi', '{h:chi} has a full bar, crossed by its long stroke.', '{h:chi} tiene una raya entera, cruzada por su trazo largo.'],
    ],
  },
  ri: {
    kw: ['rhythm', 'ritmo'], emoji: '🥁',
    story: [
      'Rhythm on two drumsticks: a short one on the left that flicks up at the end, and a long one on the right that bends away to the left as it comes down. In {h:i} the right stick is the short one.',
      'Ritmo con dos baquetas: una corta a la izquierda que se levanta al final, y una larga a la derecha que se curva hacia la izquierda al bajar. En {h:i} la baqueta corta es la de la derecha.',
    ],
    contrast: [['h.i', 'In {h:i} the right stroke is the short one.', 'En {h:i} el trazo corto es el de la derecha.']],
  },
  ru: {
    kw: ['rumba', 'rumba'], emoji: '💃',
    story: [
      'A rumba step: the dancer zigzags in from the top, swings round and finishes in a tight little twirl. {h:ro} never closes the twirl.',
      'Un paso de rumba: la bailarina entra zigzagueando desde arriba, gira y termina con una vueltecita cerrada. {h:ro} nunca cierra la vuelta.',
    ],
    contrast: [['h.ro', '{h:ro} ends open, with no small loop.', '{h:ro} termina abierta, sin el lacito.']],
  },
  re: {
    kw: ['reindeer', 'reno'], emoji: '🦌',
    story: [
      'A reindeer kicks: the first stroke is its front leg, straight down; the second crosses it, bends at the knee and kicks out behind to the right.',
      'Un reno da una patada: el primer trazo es la pata delantera, recta hacia abajo; el segundo la cruza, dobla la rodilla y patea hacia atrás, a la derecha.',
    ],
    contrast: [
      ['h.wa', '{h:wa} curls its tail back in.', '{h:wa} enrosca la cola hacia adentro.'],
      ['h.ne', '{h:ne} ties a small loop at the end.', '{h:ne} hace un lacito al final.'],
    ],
  },
  ro: {
    kw: ['rodeo', 'rodeo'], emoji: '🤠',
    story: [
      'A rodeo rope: it zigzags out from the hand and swings into one wide loop that stays open. {h:ru} closes its loop.',
      'La cuerda de un rodeo: sale zigzagueando de la mano y se abre en una vuelta ancha que queda abierta. {h:ru} cierra su vuelta.',
    ],
    contrast: [['h.ru', '{h:ru} ends in a small closed loop.', '{h:ru} termina en un lacito cerrado.']],
  },
  wa: {
    kw: ['waffle', 'waffle'], emoji: '🧇',
    story: [
      'Syrup on a waffle: the first stroke is the syrup pouring straight down; the second crosses the stream, cuts down to the left and swells into the round waffle, tucking back in at the end.',
      'Miel sobre un waffle: el primer trazo es la miel que cae recta; el segundo cruza el chorro, baja cortando hacia la izquierda y se infla en el waffle redondo, que se mete hacia adentro al final.',
    ],
    contrast: [
      ['h.re', '{h:re} kicks out at the end.', '{h:re} patea hacia afuera al final.'],
      ['h.ne', '{h:ne} ties a small loop at the end.', '{h:ne} hace un lacito al final.'],
    ],
  },
  wo: {
    kw: ['wok', 'wok'], emoji: '🥘',
    story: [
      'Stir-fry in a wok: the bar is the handle, the second stroke is the spatula diving through it and flicking out to the right, and the third is the round side of the wok, curving down and out along the bottom. It is said o: the w is only in the spelling.',
      'Salteado en un wok: la raya es el mango, el segundo trazo es la espátula que se hunde a través de ella y sale hacia la derecha, y el tercero es el costado redondo del wok, que baja curvándose y sigue por abajo. Se dice o: la w solo está en la escritura.',
    ],
    contrast: [],
  },
  n: {
    kw: ['nnn (a thinking hum)', 'nnn (un murmullo al pensar)'], emoji: '🤔',
    story: [
      'Thinking, nnn: one stroke drops down to the left, bounces back up, and runs down again with a little flick up at the end, like a thought trailing off.',
      'Pensando, nnn: un solo trazo baja hacia la izquierda, rebota hacia arriba y vuelve a bajar con un golpecito hacia arriba al final, como un pensamiento que se apaga.',
    ],
    contrast: [],
  },
};

export const K = {
  a: {
    kw: ['alpaca', 'alpaca'], emoji: '🦙',
    story: [
      'An alpaca peers down: the first stroke is its head, across and bending down at the nose; the second is its long neck, slanting down to the left from under the head.',
      'Una alpaca mira hacia abajo: el primer trazo es la cabeza, que va de lado y se dobla hacia abajo en el hocico; el segundo es el cuello largo, que baja inclinado hacia la izquierda desde debajo de la cabeza.',
    ],
    contrast: [['k.ma', 'The second stroke of {k:ma} is short and crosses the first on its way down to the right.', 'En {k:ma} el segundo trazo es corto y cruza el primero bajando hacia la derecha.']],
  },
  i: {
    kw: ['insect', 'insecto'], emoji: '🐛',
    story: [
      'An insect hangs by a thread from a twig: the first stroke is the twig, slanting down to the left; the second is the thread, straight down from the middle of the twig.',
      'Un insecto cuelga de un hilo bajo una ramita: el primer trazo es la ramita, inclinada hacia la izquierda; el segundo es el hilo, recto hacia abajo desde el medio de la ramita.',
    ],
    contrast: [['k.no', '{k:no} is the twig alone.', '{k:no} es la ramita sola.']],
  },
  u: {
    kw: ['oolong', 'oolong'], emoji: '🍵',
    story: [
      'A cup of oolong tea with its lid on: the dot is the knob of the lid, and the short left stroke and the long bent stroke are the lid sitting on the cup.',
      'Una taza de té oolong con su tapa: el punto es el pomo de la tapa, y el trazo corto de la izquierda y el largo doblado son la tapa sobre la taza.',
    ],
    contrast: [
      ['k.wa', '{k:wa} has no knob on top.', '{k:wa} no tiene el pomo de arriba.'],
      ['k.fu', '{k:fu} has no knob and no left stroke.', '{k:fu} no tiene pomo ni trazo a la izquierda.'],
    ],
  },
  e: {
    kw: ['espresso', 'expreso'], emoji: '☕',
    story: [
      'An espresso machine pours: the top bar is the head of the machine, the vertical is the coffee running straight down, and the long bottom bar is the tray.',
      'Una cafetera de expreso sirve: la raya de arriba es la cabeza de la máquina, la vertical es el café que cae recto, y la raya larga de abajo es la bandeja.',
    ],
    contrast: [['k.ni', '{k:ni} has the two bars and nothing joining them.', '{k:ni} tiene las dos rayas y nada que las una.']],
  },
  o: {
    kw: ['oasis', 'oasis'], emoji: '🌴',
    story: [
      'A palm at an oasis: the bar is the fronds, the vertical is the trunk with a little hook at its foot, and the slant is its shadow falling to the left.',
      'Una palmera en un oasis: la raya son las hojas, la vertical es el tronco con un ganchito al pie, y la diagonal es su sombra que cae hacia la izquierda.',
    ],
    contrast: [
      ['k.ho', '{k:ho} has two short strokes at the bottom instead of one long slant.', '{k:ho} tiene dos trazos cortos abajo en vez de una diagonal larga.'],
      ['k.na', '{k:na} has no vertical: a bar and one slant.', '{k:na} no tiene vertical: una raya y una diagonal.'],
    ],
  },
  ka: {
    kw: ['camel', 'camello'], emoji: '🐪',
    story: [
      'A camel lowers its head: the first stroke is its long neck, out to the right and bending down, with a hook for the head; the second is a back leg, slanting down to the left through the neck.',
      'Un camello baja la cabeza: el primer trazo es su cuello largo, que sale a la derecha y se dobla hacia abajo, con un gancho por cabeza; el segundo es una pata trasera, que baja inclinada hacia la izquierda cruzando el cuello.',
    ],
    contrast: [['h.ka', '{h:ka}, the hiragana, adds a dash on the right.', '{h:ka}, el hiragana, añade una rayita a la derecha.']],
  },
  ki: {
    kw: ['kiwi', 'kiwi'], emoji: '🥝',
    story: [
      'Two kiwi slices pushed onto a stick: the two bars are the slices, and the long stroke is the stick through both.',
      'Dos rodajas de kiwi en un palito: las dos rayas son las rodajas y el trazo largo es el palito que las atraviesa.',
    ],
    contrast: [
      ['h.ki', '{h:ki}, the hiragana, adds a curled peel below.', '{h:ki}, el hiragana, añade una cáscara curva abajo.'],
      ['k.sa', '{k:sa} has one bar and two strokes through it.', '{k:sa} tiene una raya y dos trazos que la cruzan.'],
      ['k.mo', 'The long stroke of {k:mo} starts under the top bar and turns right at the bottom.', 'El trazo largo de {k:mo} empieza debajo de la raya de arriba y dobla a la derecha al final.'],
    ],
  },
  ku: {
    kw: ['coupon', 'cupón'], emoji: '🎫',
    story: [
      'Tearing off a coupon: the short first stroke is the nick where the tear starts; the second runs along the top edge and tears down to the left.',
      'Arrancar un cupón: el primer trazo, corto, es el cortecito donde empieza; el segundo recorre el borde de arriba y se rasga hacia abajo a la izquierda.',
    ],
    contrast: [
      ['k.ta', '{k:ta} is {k:ku} with a dot inside.', '{k:ta} es {k:ku} con un punto adentro.'],
      ['k.ke', 'In {k:ke} the bar stands free and the long stroke falls from its middle.', 'En {k:ke} la raya va suelta y el trazo largo cae desde su mitad.'],
      ['k.wa', '{k:wa} has a straight post on the left instead of a slanted nick.', '{k:wa} tiene un poste recto a la izquierda en vez del cortecito inclinado.'],
    ],
  },
  ke: {
    kw: ['ketchup', 'kétchup'], emoji: '🍅',
    story: [
      'A ketchup bottle on its side: the short first stroke is the cap flipped up, the bar is the bottle, and the long stroke is the squirt falling from its middle.',
      'Una botella de kétchup acostada: el primer trazo, corto, es la tapa abierta, la raya es la botella, y el trazo largo es el chorro que cae desde su mitad.',
    ],
    contrast: [['k.ku', 'The top of {k:ku} is one bent stroke, with no bar standing free.', '{k:ku} tiene arriba un solo trazo doblado, sin raya suelta.']],
  },
  ko: {
    kw: ['coconut', 'coco'], emoji: '🥥',
    story: [
      'Half a coconut shell turned on its side: the first stroke runs across the top and down the right, the second closes the bottom, and the left is left open.',
      'Media cáscara de coco puesta de lado: el primer trazo va por arriba y baja por la derecha, el segundo cierra abajo, y la izquierda queda abierta.',
    ],
    contrast: [
      ['k.ro', '{k:ro} closes the left side too.', '{k:ro} también cierra el lado izquierdo.'],
      ['k.yu', 'In {k:yu} the bottom bar sticks out past the corner.', 'En {k:yu} la raya de abajo sobresale de la esquina.'],
      ['k.yo', '{k:yo} has a bar in the middle.', '{k:yo} tiene una raya en el medio.'],
    ],
  },
  sa: {
    kw: ['Saturn', 'Saturno'], emoji: '🪐',
    story: [
      'Saturn: the long bar is its ring, and the two strokes through it are the sides of the planet, a short one on the left and a long one on the right that curves round as it falls.',
      'Saturno: la raya larga es su anillo, y los dos trazos que la cruzan son los costados del planeta, uno corto a la izquierda y uno largo a la derecha que se curva al bajar.',
    ],
    contrast: [['k.ki', '{k:ki} has two bars and one stroke through them.', '{k:ki} tiene dos rayas y un solo trazo que las cruza.']],
  },
  shi: {
    kw: ['shiatsu', 'shiatsu'], emoji: '💆',
    story: [
      'Shiatsu: two fingertips press, one above the other on the left (the two dots), then the palm sweeps up from the bottom left. {k:tsu} lines its dots up along the top and falls from the top instead.',
      'Shiatsu: dos yemas de los dedos presionan, una sobre otra a la izquierda (los dos puntos), y luego la palma sube barriendo desde abajo a la izquierda. {k:tsu} pone sus puntos en fila arriba y cae desde arriba.',
    ],
    contrast: [
      ['k.tsu', 'The dots of {k:tsu} sit side by side along the top, and its long stroke falls from the top right; the long stroke of {k:shi} rises from the bottom left.', 'En {k:tsu} los puntos van lado a lado arriba y el trazo largo cae desde arriba a la derecha; en {k:shi} el trazo largo sube desde abajo a la izquierda.'],
      ['k.n', '{k:n} has one dot, not two.', '{k:n} tiene un punto, no dos.'],
    ],
  },
  su: {
    kw: ['sumo', 'sumo'], emoji: '🤼',
    story: [
      'A sumo wrestler leans into a push: the top bar and long slant are his body, and the short stroke is the leg braced behind.',
      'Un luchador de sumo empuja inclinado: la raya de arriba y la diagonal son su cuerpo, y el trazo corto es la pierna que apoya atrás.',
    ],
    contrast: [['k.nu', 'In {k:nu} the short stroke crosses the slant, where in {k:su} it starts from it.', 'En {k:nu} el trazo corto cruza la diagonal; en {k:su} sale de ella.']],
  },
  se: {
    kw: ['semaphore', 'semáforo'], emoji: '🚦',
    story: [
      'A semaphore signal on a corner: the first stroke is its arm, reaching across with the light hanging down at the end; the second is the post, down and then along the curb to the right.',
      'Un semáforo en una esquina: el primer trazo es el brazo, que cruza con la luz colgando al final; el segundo es el poste, que baja y sigue por la acera hacia la derecha.',
    ],
    contrast: [['h.se', '{h:se}, the hiragana, hangs a separate short stroke where {k:se} bends its bar.', '{h:se}, el hiragana, cuelga un trazo corto aparte donde {k:se} dobla la raya.']],
  },
  so: {
    kw: ['solar', 'sol'], emoji: '🌞',
    story: [
      'Solar rays fall from the sky: both strokes start at the top, a short one on the left and a long one slanting down from the right.',
      'Rayos de sol que caen: los dos trazos empiezan arriba, uno corto a la izquierda y uno largo que baja desde la derecha.',
    ],
    contrast: [
      ['k.n', 'The long stroke of {k:n} rises from the bottom left instead.', 'El trazo largo de {k:n} sube desde abajo a la izquierda.'],
      ['k.tsu', '{k:tsu} has two short strokes, not one.', '{k:tsu} tiene dos trazos cortos, no uno.'],
    ],
  },
  ta: {
    kw: ['tapioca', 'tapioca'], emoji: '🧋',
    story: [
      'A cup of tapioca tea tipped on its side: the first two strokes draw the corner of the cup, as in {k:ku}, and the dot inside is one tapioca pearl.',
      'Un vaso de té con tapioca inclinado: los dos primeros trazos dibujan la esquina del vaso, como en {k:ku}, y el punto de adentro es una perla de tapioca.',
    ],
    contrast: [['k.ku', '{k:ku} has no pearl inside.', '{k:ku} no tiene la perla adentro.']],
  },
  chi: {
    kw: ['chimp', 'chimpancé'], emoji: '🐒',
    story: [
      'A chimp on a branch: the short top stroke is its arm reaching up, the bar is the branch, and the long stroke is the chimp hanging down through it and swinging to the left.',
      'Un chimpancé en una rama: el trazo corto de arriba es su brazo que se estira, la raya es la rama, y el trazo largo es el chimpancé que cuelga a través de ella y se balancea hacia la izquierda.',
    ],
    contrast: [['k.te', '{k:te} has a flat bar on top, and its long stroke hangs from under the lower bar.', '{k:te} tiene arriba una raya plana, y su trazo largo cuelga debajo de la raya de abajo.']],
  },
  tsu: {
    kw: ['tsuna (tuna)', 'tsuna (atún)'], emoji: '🐟',
    story: [
      'Tsuna is tuna, said the Japanese way: the two dots are drops flying off, side by side along the top, and the long stroke is the tuna diving down from the top right.',
      'Tsuna es atún, dicho a la japonesa: los dos puntos son gotas que saltan, lado a lado arriba, y el trazo largo es el atún que se zambulle desde arriba a la derecha.',
    ],
    contrast: [
      ['k.shi', '{k:shi} stacks its dots on the left, and its long stroke rises from the bottom.', '{k:shi} apila sus puntos a la izquierda, y su trazo largo sube desde abajo.'],
      ['k.so', '{k:so} has one short stroke, not two.', '{k:so} tiene un trazo corto, no dos.'],
    ],
  },
  te: {
    kw: ['temple', 'templo'], emoji: '⛩️',
    story: [
      'A temple gate: two beams across the top, a short one above a long one, and one post slanting down from the middle of the lower beam.',
      'La puerta de un templo: dos vigas arriba, una corta sobre una larga, y un poste que baja inclinado desde el medio de la viga de abajo.',
    ],
    contrast: [
      ['k.chi', '{k:chi} starts with a slanted tick, and its long stroke crosses the bar.', '{k:chi} empieza con un trazo inclinado, y su trazo largo cruza la raya.'],
      ['k.ra', '{k:ra} has one bar that bends down into the slant.', '{k:ra} tiene una raya que se dobla hacia abajo en la diagonal.'],
    ],
  },
  to: {
    kw: ['Tokyo', 'Tokio'], emoji: '🗼',
    story: [
      'Tokyo Tower: the vertical is the tower, and the short stroke is the viewing deck sticking out to the right.',
      'La torre de Tokio: la vertical es la torre, y el trazo corto es el mirador que sale a la derecha.',
    ],
    contrast: [],
  },
  na: {
    kw: ['nah', '¡nada!'], emoji: '🙅',
    story: [
      'Nah, with arms crossed: the bar is one arm held across, and the slant is the other crossing it on the way down to the left.',
      '¡Nada!, con los brazos cruzados: la raya es un brazo atravesado, y la diagonal es el otro, que lo cruza bajando hacia la izquierda.',
    ],
    contrast: [['k.me', 'The long stroke of {k:me} slants from the top right, and a short one crosses it.', 'En {k:me} el trazo largo baja inclinado desde arriba a la derecha, y uno corto lo cruza.']],
  },
  ni: {
    kw: ['nickel', 'níquel'], emoji: '🪙',
    story: [
      'Two nickel coins seen edge on, stacked: a short one on top and a longer one below.',
      'Dos monedas de níquel vistas de canto, apiladas: una corta arriba y una más larga abajo.',
    ],
    contrast: [['k.e', '{k:e} joins its two bars with a vertical.', '{k:e} une sus dos rayas con una vertical.']],
  },
  nu: {
    // Revised 2026-09-29: the keyword was a noose, which read as grim.
    kw: ['numeral', 'número'], emoji: '🔢', checked_at: '2026-09-29',
    story: [
      'The numeral seven crossed through its stem, the way many people write it by hand: the first stroke runs across the top and falls away to the lower left, and the short second stroke cuts across that fall. In {k:su} the short stroke hangs from the slant, so that seven is never crossed.',
      'El número siete con su rayita, como mucha gente lo escribe a mano: el primer trazo va por arriba y cae hacia abajo a la izquierda, y el trazo corto atraviesa esa caída. En {k:su} el trazo corto cuelga de la diagonal, así que ese siete nunca queda cruzado.',
    ],
    contrast: [
      ['k.su', 'In {k:su} the short stroke starts from the slant instead of crossing it.', 'En {k:su} el trazo corto sale de la diagonal en vez de cruzarla.'],
      ['k.me', '{k:me} has no bar across the top.', '{k:me} no tiene la raya de arriba.'],
    ],
  },
  ne: {
    kw: ['Neptune', 'Neptuno'], emoji: '🔱',
    story: [
      'Neptune rising from the sea: the dot is his crown, the bent stroke is his arm sweeping out and down to the left, the vertical is the shaft of his trident, and the last dot is the spray on the right.',
      'Neptuno sale del mar: el punto es su corona, el trazo doblado es su brazo que se abre y baja hacia la izquierda, la vertical es el mango del tridente, y el último punto es la espuma a la derecha.',
    ],
    contrast: [],
  },
  no: {
    kw: ['nori', 'nori'], emoji: '🍙',
    story: [
      'A strip of nori laid on at a slant: one stroke, from the top right down to the left.',
      'Una tira de alga nori puesta en diagonal: un solo trazo, desde arriba a la derecha hacia abajo a la izquierda.',
    ],
    contrast: [['k.i', '{k:i} hangs a vertical from the middle.', '{k:i} cuelga una vertical desde el medio.']],
  },
  ha: {
    kw: ['hamster', 'hámster'], emoji: '🐹',
    story: [
      'A hamster\'s two front teeth: close together at the top and spreading apart at the tips, the left one first.',
      'Los dos dientes delanteros de un hámster: juntos arriba y separándose en las puntas, primero el de la izquierda.',
    ],
    contrast: [['k.ru', 'The right stroke of {k:ru} goes straight down and kicks up at the foot.', 'El trazo derecho de {k:ru} baja recto y patea hacia arriba al final.']],
  },
  hi: {
    kw: ['hip hop', 'hip hop'], emoji: '🕺',
    story: [
      'A hip hop dancer hits the floor: the short bar is an arm thrown out to the right, and the long stroke is the body going straight down and the legs sliding out along the floor.',
      'Un bailarín de hip hop baja al suelo: la raya corta es un brazo lanzado a la derecha, y el trazo largo es el cuerpo, que baja recto y desliza las piernas por el suelo.',
    ],
    contrast: [],
  },
  fu: {
    kw: ['football', 'fútbol'], emoji: '⚽',
    story: [
      'A shot at goal: the stroke runs along the crossbar and then drops down to the left, the path of the ball into the net.',
      'Un tiro a gol: el trazo recorre el travesaño y luego cae hacia la izquierda, el camino de la pelota hacia la red.',
    ],
    contrast: [
      ['k.wa', '{k:wa} adds a short post on the left.', '{k:wa} añade un poste corto a la izquierda.'],
      ['k.ra', '{k:ra} adds a short bar above.', '{k:ra} añade una raya corta arriba.'],
    ],
  },
  he: {
    kw: ['heh heh', 'je, je'], emoji: '😏',
    story: [
      'The same sly grin as {h:he}: a short rise to a point on the left, then a long slide down to the right.',
      'La misma sonrisa pícara que {h:he}: una subida corta hasta una punta a la izquierda, y luego una bajada larga hacia la derecha.',
    ],
    contrast: [],
  },
  ho: {
    kw: ['home run', 'jonrón'], emoji: '⚾',
    story: [
      'A home run: the bar is the bat swung level, the vertical is the batter under it with a hook at the foot, and the two short strokes are the dust kicked up on the left and the ball flying off to the right.',
      'Un jonrón: la raya es el bate en horizontal, la vertical es el bateador debajo, con un gancho en el pie, y los dos trazos cortos son el polvo a la izquierda y la pelota que sale volando a la derecha.',
    ],
    contrast: [['k.o', '{k:o} has one long slant to the lower left instead of two short strokes.', '{k:o} tiene una sola diagonal larga abajo a la izquierda en vez de dos trazos cortos.']],
  },
  ma: {
    kw: ['mammoth', 'mamut'], emoji: '🦣',
    story: [
      'A mammoth\'s trunk and tusk: the first stroke runs across its face and curls down and back, and the short second stroke is the tusk poking out below.',
      'La trompa y el colmillo de un mamut: el primer trazo cruza la cara y baja doblándose hacia atrás, y el segundo, corto, es el colmillo que asoma abajo.',
    ],
    contrast: [['k.a', 'The second stroke of {k:a} is long and falls to the left.', 'En {k:a} el segundo trazo es largo y cae hacia la izquierda.']],
  },
  mi: {
    kw: ['mikado', 'mikado'], emoji: '🥢',
    story: [
      'Mikado sticks dropped in a stack: three short strokes, each sloping down to the right, drawn from the top down.',
      'Palitos de mikado caídos en pila: tres trazos cortos, cada uno inclinado hacia abajo a la derecha, dibujados de arriba abajo.',
    ],
    contrast: [],
  },
  mu: {
    kw: ['Muay Thai', 'muay thai'], emoji: '🥊',
    story: [
      'A Muay Thai elbow strike: the first stroke is the arm, down to the left and then along to the right; the short stroke is the elbow landing.',
      'Un codazo de muay thai: el primer trazo es el brazo, que baja a la izquierda y sigue a la derecha; el trazo corto es el codo que golpea.',
    ],
    contrast: [],
  },
  me: {
    kw: ['medal', 'medalla'], emoji: '🏅',
    story: [
      'The crossed ribbons of a medal: a long one slanting down from the top right, and a short one crossing it.',
      'Las cintas cruzadas de una medalla: una larga que baja inclinada desde arriba a la derecha, y una corta que la cruza.',
    ],
    contrast: [
      ['k.na', 'The first stroke of {k:na} is a flat bar.', 'En {k:na} el primer trazo es una raya plana.'],
      ['k.nu', '{k:nu} has a bar across the top.', '{k:nu} tiene una raya arriba.'],
    ],
  },
  mo: {
    kw: ['motel', 'motel'], emoji: '🏨',
    story: [
      'A roadside motel sign: two boards on a post, a short one above a long one; the post runs down through the long board and turns along the road at the bottom.',
      'El letrero de un motel en la carretera: dos tablas en un poste, una corta sobre una larga; el poste baja a través de la tabla larga y dobla por la carretera al final.',
    ],
    contrast: [
      ['k.ki', 'The long stroke of {k:ki} goes straight through both bars and out the bottom.', 'En {k:ki} el trazo largo atraviesa las dos rayas y sale por abajo.'],
      ['k.te', 'The post of {k:te} slants to the left from the lower bar.', 'En {k:te} el poste sale inclinado hacia la izquierda desde la raya de abajo.'],
    ],
  },
  ya: {
    kw: ['yakitori', 'yakitori'], emoji: '🍢',
    story: [
      'The yakitori of {h:ya} without the smoke: the first stroke is the piece of chicken, across and bent down at the end; the long slant is the skewer through it.',
      'El yakitori de {h:ya} sin el humo: el primer trazo es el trozo de pollo, de lado y doblado al final; la diagonal larga es la brocheta que lo atraviesa.',
    ],
    contrast: [],
  },
  yu: {
    kw: ['yuzu', 'yuzu'], emoji: '🍋',
    story: [
      'A box of yuzu on a shelf: the first stroke is the lid and side of the box, across and down; the long bar is the shelf, sticking out on both sides.',
      'Una caja de yuzu en un estante: el primer trazo es la tapa y el costado de la caja, de lado y hacia abajo; la raya larga es el estante, que sobresale por los dos lados.',
    ],
    contrast: [['k.ko', 'The bottom bar of {k:ko} stops at the corner.', 'En {k:ko} la raya de abajo termina en la esquina.']],
  },
  yo: {
    kw: ['yo! (hey!)', '¡yo! (¡a mí!)'], emoji: '🤚',
    story: [
      'A hand held up for yo!, seen side on: the first stroke is the top finger and the edge of the hand, across and down the right; the next two bars are the fingers below.',
      'Una mano alzada para decir ¡yo!, vista de lado: el primer trazo es el dedo de arriba y el borde de la mano, de lado y bajando por la derecha; las dos rayas siguientes son los dedos de abajo.',
    ],
    contrast: [['k.ko', '{k:ko} has no bar in the middle.', '{k:ko} no tiene raya en el medio.']],
  },
  ra: {
    kw: ['rafting', 'rafting'], emoji: '🚣',
    story: [
      'Rafting: the short top bar is the paddle held up, and the second stroke is the river, across and then down the rapids to the left.',
      'Rafting: la raya corta de arriba es el remo en alto, y el segundo trazo es el río, que va de lado y luego baja por los rápidos hacia la izquierda.',
    ],
    contrast: [['k.fu', '{k:fu} has no bar above.', '{k:fu} no tiene raya arriba.']],
  },
  ri: {
    kw: ['rhythm', 'ritmo'], emoji: '🥁',
    story: [
      'The two drumsticks of {h:ri}, held straighter: a short one on the left, and a long one on the right that bends away at the tip.',
      'Las dos baquetas de {h:ri}, más derechas: una corta a la izquierda y una larga a la derecha que se curva en la punta.',
    ],
    contrast: [],
  },
  ru: {
    kw: ['rumba', 'rumba'], emoji: '💃',
    story: [
      'A rumba dancer\'s legs: the left leg sweeps out to the left, and the right leg goes straight down and kicks up at the foot.',
      'Las piernas de una bailarina de rumba: la izquierda se abre hacia la izquierda, y la derecha baja recta y patea hacia arriba con el pie.',
    ],
    contrast: [
      ['k.ha', '{k:ha} is two plain slants, with no kick.', '{k:ha} son dos diagonales simples, sin patada.'],
      ['k.re', '{k:re} is the right leg alone.', '{k:re} es la pierna derecha sola.'],
    ],
  },
  re: {
    kw: ['reindeer', 'reno'], emoji: '🦌',
    story: [
      'A reindeer\'s hind leg: straight down, then the hoof kicks up to the right.',
      'La pata trasera de un reno: recta hacia abajo, y la pezuña patea hacia arriba a la derecha.',
    ],
    contrast: [
      ['h.shi', '{h:shi}, the hiragana shi, curves where {k:re} turns at a corner.', '{h:shi}, la shi del hiragana, se curva donde {k:re} gira en una esquina.'],
      ['k.ru', '{k:ru} adds a left leg.', '{k:ru} añade una pierna izquierda.'],
    ],
  },
  ro: {
    kw: ['rodeo', 'rodeo'], emoji: '🤠',
    story: [
      'A rodeo pen: the left fence first, then the top and right fence in one stroke, and the bottom fence closes it.',
      'El corral de un rodeo: primero la cerca izquierda, luego la de arriba y la de la derecha de un solo trazo, y la de abajo lo cierra.',
    ],
    contrast: [['k.ko', '{k:ko} is open on the left.', '{k:ko} está abierta a la izquierda.']],
  },
  wa: {
    kw: ['waffle', 'waffle'], emoji: '🧇',
    story: [
      'An open waffle iron: the short post on the left is the hinge, and the lid runs across the top and swings down to the left.',
      'Una máquina de waffles abierta: el poste corto de la izquierda es la bisagra, y la tapa va por arriba y baja hacia la izquierda.',
    ],
    contrast: [
      ['k.u', '{k:u} has a dot on top.', '{k:u} tiene un punto arriba.'],
      ['k.fu', '{k:fu} has no post on the left.', '{k:fu} no tiene poste a la izquierda.'],
      ['k.ku', '{k:ku} starts with a slanted nick, not a post.', '{k:ku} empieza con un cortecito inclinado, no con un poste.'],
    ],
  },
  wo: {
    kw: ['wok', 'wok'], emoji: '🥘',
    story: [
      'A wok on its stand, side on: the two bars are the rim and the rail of the stand, and the long stroke is the side of the wok, falling from the top right to the lower left. It is said o, like {k:o}.',
      'Un wok en su soporte, de lado: las dos rayas son el borde y la barra del soporte, y el trazo largo es el costado del wok, que cae desde arriba a la derecha hacia abajo a la izquierda. Se dice o, como {k:o}.',
    ],
    contrast: [['k.fu', '{k:fu} has no bar in the middle.', '{k:fu} no tiene raya en el medio.']],
  },
  n: {
    kw: ['nnn (a thinking hum)', 'nnn (un murmullo al pensar)'], emoji: '🤔',
    story: [
      'The thinking hum again: a single dot, then one long stroke rising from the bottom left. The long stroke of {k:so} falls from the top right instead.',
      'El mismo murmullo de pensar: un punto, y luego un trazo largo que sube desde abajo a la izquierda. El trazo largo de {k:so} cae desde arriba a la derecha.',
    ],
    contrast: [
      ['k.so', 'The long stroke of {k:so} falls from the top right; the long stroke of {k:n} rises from the bottom left.', 'El trazo largo de {k:so} cae desde arriba a la derecha; el de {k:n} sube desde abajo a la izquierda.'],
      ['k.shi', '{k:shi} has two dots.', '{k:shi} tiene dos puntos.'],
    ],
  },
};

export const RULES = {
  dakuten: {
    title: ['Two ticks switch the voice on', 'Dos rayitas encienden la voz'],
    rule: [
      'Two small ticks at the top right voice the consonant: k becomes g, s becomes z, t becomes d, and h becomes b. {h:ka} ka is {h:ga} ga, {h:ha} ha is {h:ba} ba.',
      'Dos rayitas arriba a la derecha dan voz a la consonante: la k pasa a g, la s a z, la t a d y la h a b. {h:ka} ka es {h:ga} ga, {h:ha} ha es {h:ba} ba.',
    ],
    mnemonic: [
      'Put a hand on your throat and say k, then g: the buzz you feel in the second one is what the two ticks add.',
      'Pon la mano en la garganta y di k y luego g: la vibración que sientes en la segunda es lo que añaden las dos rayitas.',
    ],
  },
  handakuten: {
    title: ['A small circle pops a p', 'Un circulito hace estallar la p'],
    rule: [
      'A small circle at the top right turns the h row into p, and only the h row: {h:ha} ha is {h:pa} pa.',
      'Un circulito arriba a la derecha convierte la fila de la h en p, y solo esa fila: {h:ha} ha es {h:pa} pa.',
    ],
    mnemonic: [
      'The circle is your lips, closed and popping open: p.',
      'El círculo son tus labios, cerrados y abriéndose de golpe: p.',
    ],
  },
  youon: {
    title: ['Small ya, yu and yo ride along', 'La ya, yu y yo pequeñas van montadas'],
    rule: [
      'A small ya, yu or yo after an i-row kana joins it, and the two are said as one beat: {h:ki} ki with a small ya after it is {h:kya} kya, one beat and not two.',
      'Una ya, yu o yo pequeña después de un kana de la fila i se une a él, y los dos se dicen en un solo tiempo: {h:ki} ki con una ya pequeña detrás es {h:kya} kya, un tiempo y no dos.',
    ],
    mnemonic: [
      'The small kana is a passenger riding on the one before it. It is small because it adds no beat of its own.',
      'La kana pequeña es un pasajero montado en la anterior. Es pequeña porque no suma un tiempo propio.',
    ],
  },
  sokuon: {
    title: ['A small tsu holds your breath', 'Una tsu pequeña aguanta la respiración'],
    rule: [
      'A small tsu doubles the consonant after it: stop for one silent beat, then say the next consonant. {h:ki}{h:te} kite against {h:ki}{h:sokuon}{h:te} kitte.',
      'Una tsu pequeña duplica la consonante que viene después: para un tiempo en silencio y luego di la consonante siguiente. {h:ki}{h:te} kite contra {h:ki}{h:sokuon}{h:te} kitte.',
    ],
    mnemonic: [
      'The small tsu is a hand held up: stop, count one, go.',
      'La tsu pequeña es una mano en alto: para, cuenta uno, sigue.',
    ],
  },
  long: {
    title: ['A long vowel is a held note', 'Una vocal larga es una nota sostenida'],
    rule: [
      'A long vowel is the same sound held for a second beat. Hiragana writes the extra beat as a vowel kana, as in {h:o}{h:ka}{h:a}{h:sa}{h:n} okaasan; an e-row kana plus {h:i} is usually said ee, and an o-row kana plus {h:u} is usually said oo. Katakana draws the extra beat as a bar, as in {k:ko}{k:chouon}{k:hi}{k:chouon} koohii.',
      'Una vocal larga es el mismo sonido sostenido un tiempo más. El hiragana escribe ese tiempo con una vocal, como en {h:o}{h:ka}{h:a}{h:sa}{h:n} okaasan; un kana de la fila e más {h:i} suele decirse ee, y uno de la fila o más {h:u} suele decirse oo. El katakana dibuja ese tiempo como una raya, como en {k:ko}{k:chouon}{k:hi}{k:chouon} koohii.',
    ],
    mnemonic: [
      'Hold the key down on a piano: the note keeps sounding for one more beat. The bar is your finger on the key.',
      'Mantén apretada una tecla del piano: la nota sigue sonando un tiempo más. La raya es tu dedo sobre la tecla.',
    ],
  },
};
