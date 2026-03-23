const test = require('brittle')
const { HTMLServer } = require('..')
const { cellery, Cell } = require('cellery')
const { Duplex, Transform } = require('streamx')
const { matchSnapshot } = require('brittle-snapshot')

test('initial render', async (t) => {
  t.plan(3)

  t.teardown(() => {
    Cell.cellery = undefined
  })

  const app = cellery`
    <Container id="main">
      <Text id="greeting">Hello world!</Text>
    </Container>
  `

  const stream = new Transform({
    transform(msg, cb) {
      const data = JSON.parse(msg)
      this.push(data)
      cb()
    }
  })

  const server = new HTMLServer({ app, streams: [stream] })

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      t.is(msg.event, 'render')
      t.is(msg.id, 'main')
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

test('re-render after input event', async (t) => {
  t.plan(3)

  t.teardown(() => {
    Cell.cellery = undefined
  })

  const app = cellery`
    <Container id="main">
      <Text id="counter">count: 0</Text>
    </Container>
  `

  let count = 0
  const counter = app.children[0]

  const stream = new Transform({
    transform(msg, cb) {
      const data = JSON.parse(msg)

      if (data.event === 'increment') {
        count++
        counter.value = 'count: ' + count
        counter.render()
      }
      cb()
    }
  })

  const server = new HTMLServer({ app, streams: [stream] })

  let initial = true

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      if (initial) {
        initial = false
        t.is(msg.id, 'main')
        this.push(JSON.stringify({ event: 'increment' }))
        cb()
        return
      }

      t.is(msg.id, 'counter')
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

test('heading renders as h tag', async (t) => {
  t.plan(3)

  t.teardown(() => {
    Cell.cellery = undefined
  })

  const app = cellery`
    <Container id="main">
      <Text id="title" heading=1>Hello</Text>
      <Text id="sub" heading=2>World</Text>
    </Container>
  `

  const stream = new Transform({
    transform(data, cb) {
      this.push(data)
      cb()
    }
  })

  const server = new HTMLServer({ app, streams: [stream] })

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      t.is(msg.event, 'render')
      t.is(msg.id, 'main')
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

test('state machine transitions', async (t) => {
  t.plan(5)

  t.teardown(() => {
    Cell.cellery = undefined
  })

  const app = cellery`
    <Container id="main">
      <Text id="status">idle</Text>
    </Container>
  `

  const status = app.children[0]

  const stateMachine = new Transform({
    transform(msg, cb) {
      const data = JSON.parse(msg)

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

  const server = new HTMLServer({ app, streams: [stateMachine] })

  let step = 0

  const socket = new Duplex({
    write(data, cb) {
      const msg = JSON.parse(data)

      if (step === 0) {
        t.is(msg.id, 'main')
        step++
        this.push(JSON.stringify({ event: 'fetch' }))
        cb()
        return
      }

      if (step === 1) {
        t.is(msg.id, 'status')
        matchSnapshot(t, msg.content, 'loading state')
        step++
        this.push(JSON.stringify({ event: 'complete' }))
        cb()
        return
      }

      t.is(msg.id, 'status')
      matchSnapshot(t, msg.content, 'done state')
      server.close()
      cb()
    },
    read(cb) {
      cb(null)
    }
  })

  server.connect(socket)
})
