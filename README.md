# Trukeados 🃏

Truco argentino online en 3D para **1 vs 1, 2 vs 2 y 3 vs 3**. Corre entero en
**Cloudflare Workers** (`*.workers.dev`), gratis.

- **Escena 3D en primera persona**: estás sentado a la mesa de un bar. Arrastrá (o usá A/D y W/S) para mirar
  a los costados y para abajo; mantené la **Z** para hacer zoom.
- **Señas con la cara** (cejas, guiño, boca torcida, ojos cerrados…). El servidor solo se la manda a quien te
  está mirando en ese momento: un rival te la puede cazar. Los personajes no parpadean solos, así que unos ojos
  cerrados siempre son la seña de "ciego".
- Truco / retruco / vale cuatro, envido / real envido / falta envido, "el envido está primero", son buenas,
  mostrar los tantos, irse al mazo, pardas, anotador de palitos. Los cantos se hacen **en tu turno**.
- **Opciones de sala**: jugar con **flor**, con **muestra** (piezas) y **no permitir trampas**.
- **Trampa**: tirar dos cartas encimadas. La de abajo juega; la de arriba queda **quemada**. Los rivales pueden
  pedir "mostrá las dos".
- **Online** con salas por código de 4 números, enlace `/sala/CÓDIGO`, partida rápida, mesas públicas,
  modo espectador y práctica con bots. Los bots ocupan lugares y juegan por quien se desconecta; aprenden cómo
  juega cada persona, farolean y, si la mesa permite trampas, también hacen trampa.
- Chat con frases rápidas, globos sobre cada jugador y voz que canta los cantos.

Reglas completas (y las que faltan): [docs/REGLAS.md](docs/REGLAS.md).
Guía del código para quien siga desarrollando: [AGENTS.md](AGENTS.md).

## Probarlo en tu PC
Necesitás [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install
```

```bash
npm run dev
```

Abrí http://localhost:8787. Para probar con varias personas, abrí la sala en otra ventana de incógnito.

```bash
npm test
```

## Publicarlo
```bash
npx wrangler login
```

```bash
npm run deploy
```

O desde el panel de Cloudflare: **Workers & Pages → Create → Import a repository** con este repositorio
(comando de deploy `npx wrangler deploy`). Los Durable Objects usan SQLite, incluido en el plan gratuito.

## Licencias
- Cartas: diseño “Naipes Libres” de [Basquetteur](https://commons.wikimedia.org/wiki/User:Basquetteur)
  (Wikimedia Commons), vectorizado por [gjenkins20](https://github.com/gjenkins20/spanish-playing-cards-svg),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); convertidas a WebP.
- [Three.js](https://threejs.org): MIT (`public/vendor/three.LICENSE.txt`).
