const test = require('brittle')
const { HTMLAdapter } = require('..')
const { cellery } = require('cellery')
const { matchSnapshot, matchSnapshotCSS } = require('brittle-snapshot')

test('styling', async (t) => {
  const adapter = new HTMLAdapter()

  const cell = cellery`
    <Container id="main">
      <Style>
        [data-cellery-cell="Container"] {
          flex: 1 1 auto;
          padding: 0.5rem;
          color: #00c950;
          border: 1px solid #00c950;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        [data-cellery-cell="Container"]:hover {
          color: #00d3f2;
          border: 1px solid #00d3f2;
          cursor: pointer;
        }
      </Style>

      <div>
        <Text>Hello world!</Text>
        <Text>2026</Text>
      </div>
    </Container>
  `

  matchSnapshotCSS(t, cell.style.toCSS())

  const rendered = adapter.render(cell)
  matchSnapshot(t, rendered)
})

const html = cellery

test('styles - html', async (t) => {
  const adapter = new HTMLAdapter()
  const app = html`<>
    <style>
      #main {
          flex: 1 1 auto;
          display: flex;
          flex-flow: row;
          padding: 1em;
      }
    </style>
    <div id="main">
        <p>Loading...</p>
    </div>
  </>`

  matchSnapshotCSS(t, app.style.toCSS())

  const rendered = adapter.render(app)
  matchSnapshot(t, rendered)
})

test('styles - html events', async (t) => {
  const adapter = new HTMLAdapter()
  const app = html`
    <div id="my-id" events="click">
      <style>
        div {
          flex: 1 1 auto;
          padding: 0.5rem;
          color: #00c950;
          border: 1px solid #00c950;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        div:hover {
          color: #00d3f2;
          border: 1px solid #00d3f2;
          cursor: pointer;
        }
      </style>

      <span>Hello</span>
      <span>world</span>
    </div>
  `

  matchSnapshotCSS(t, app.style.toCSS())

  const rendered = adapter.render(app)
  matchSnapshot(t, rendered)
})
