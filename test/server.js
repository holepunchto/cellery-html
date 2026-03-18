const test = require('brittle')
const { HTMLServer } = require('..')
const { cellery } = require('cellery')
const { Duplex, Transform } = require('streamx')
const { matchSnapshot } = require('brittle-snapshot')

test('initial render', async (t) => {
  t.plan(2)

  const app = cellery`
    <Container id="main">
      <Text id="greeting">Hello world!</Text>
    </Container>
  `

  const stream = new Transform({
    transform(data, cb) {
      this.push(data)
      cb()
    }
  })

  const server = new HTMLServer({ app, stream })

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      t.is(msg.event, 'render')
      t.is(msg.id, 'app')

      server.close()
      cb()
    },
    read(cb) {
      cb(null)
    }
  })

  server.connect(socket)
})

test('initial render - snapshot', async (t) => {
  const app = cellery`
    <Container id="main">
      <Text id="greeting">Hello world!</Text>
      <Text id="year">2026</Text>
    </Container>
  `

  const stream = new Transform({
    transform(data, cb) {
      this.push(data)
      cb()
    }
  })

  const server = new HTMLServer({ app, stream })

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)
      matchSnapshot(t, msg.content)
      server.close()
      cb()
    },
    read(cb) {
      cb(null)
    }
  })

  server.connect(socket)
})

test('input event triggers re-render', async (t) => {
  t.plan(2)

  const app = cellery`
    <Container id="main">
      <Text id="counter">count: 0</Text>
    </Container>
  `

  let count = 0

  const counter = app.children[0]

  const stream = new Transform({
    transform(data, cb) {
      if (data.event === 'increment') {
        count++
        counter.value = 'count: ' + count
        counter.render()
      }
      cb()
    }
  })

  const server = new HTMLServer({ app, stream })

  let renders = 0

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      if (renders === 0) {
        // initial render of the full app
        t.is(msg.id, 'app')
        renders++

        // simulate an input event from the client
        this.push(JSON.stringify({ event: 'increment' }))
      } else {
        // re-render of just the counter cell
        t.is(msg.id, 'counter')
        server.close()
      }

      cb()
    },
    read(cb) {
      cb(null)
    }
  })

  server.connect(socket)
})

test('state machine stream processes events', async (t) => {
  t.plan(3)

  const app = cellery`
    <Container id="main">
      <Text id="status">idle</Text>
    </Container>
  `

  const status = app.children[0]

  // a simple state machine: idle -> loading -> done
  const stateMachine = new Transform({
    transform(data, cb) {
      if (data.event === 'fetch') {
        status.value = 'loading'
        status.render()
      }

      if (data.event === 'complete') {
        status.value = 'done'
        status.render()
      }

      cb()
    }
  })

  const server = new HTMLServer({ app, stream: stateMachine })

  let renders = 0

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      if (renders === 0) {
        t.is(msg.id, 'app')
        renders++
        this.push(JSON.stringify({ event: 'fetch' }))
      } else if (renders === 1) {
        t.ok(msg.content.includes('loading'), 'status is loading')
        renders++
        this.push(JSON.stringify({ event: 'complete' }))
      } else {
        t.ok(msg.content.includes('done'), 'status is done')
        server.close()
      }

      cb()
    },
    read(cb) {
      cb(null)
    }
  })

  server.connect(socket)
})
