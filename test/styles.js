const test = require('brittle')
const { HTMLAdapter } = require('..')
const { cellery } = require('cellery')
const { matchSnapshot, matchSnapshotCSS } = require('brittle-snapshot')

test('styling', async (t) => {
  const adapter = new HTMLAdapter()

  const cell = cellery`
    <Container onclick>
      <Style.HTML>
        Container {
          flex: 1 1 auto;
          padding: 0.5rem;
          color: #00c950;
          border: 1px solid #00c950;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        Container:hover {
          color: #00d3f2;
          border: 1px solid #00d3f2;
          cursor: pointer;
        }
      </Style.HTML>

      <Text>Hello world!</Text>
      <Text>2026</Text>
    </Container>
  `

  matchSnapshotCSS(t, cell.style.toCSS())

  const rendered = adapter.render(cell)
  matchSnapshot(t, rendered)
})
