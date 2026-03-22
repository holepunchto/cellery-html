const { Size, Cellery } = require('cellery')
const { Window, WebView } = require('bare-native')
const ws = require('bare-ws')
const http = require('bare-http1')
const Console = require('bare-console')
const htmlTemplate = require('./index.html')
const { Writable, Transform, pipeline } = require('streamx')
const ReadyResource = require('ready-resource')
const safetyCatch = require('safety-catch')

const console = new Console()
const html = String.raw

function renderChildren() {
  let childrenHTML = ''
  if (this.children && this.children.length > 0) {
    for (const child of this.children) {
      childrenHTML += this.renderer._renderCell(child)
    }
  }

  return childrenHTML
}

const sizes = {
  [Size.XS]: '0.5rem',
  [Size.S]: '0.75rem',
  [Size.M]: '1rem',
  [Size.L]: '1.5rem',
  [Size.XL]: '2rem'
}

function renderStyle(cell) {
  const style = []

  if (cell.padding) {
    for (const k of Object.keys(cell.padding)) {
      if (!cell.padding[k]) continue
      style.push(`padding-${k}: ${cell.padding[k]}rem;`)
    }
  }

  if (cell.margin) {
    for (const k of Object.keys(cell.margin)) {
      if (!cell.margin[k]) continue
      style.push(`margin-${k}: ${cell.margin[k]}rem;`)
    }
  }

  if (cell.color) {
    style.push(`color: ${cell.color.toRGBA()};`)
  }

  if (cell.alignment) {
    style.push(`flex-direction: ${cell.alignment.direction === 'vertical' ? 'column' : 'row'};`)
    style.push(`justify-content: ${cell.alignment.justify || 'start'};`)
    style.push(`align-items: ${cell.alignment.items || 'start'};`)
  }

  if (cell.decoration?.border) {
    const borderColor = cell.decoration.border.color?.toRGBA() || '#000'
    style.push(`border: ${cell.decoration.border.width}px solid ${borderColor};`)
  }

  if (cell.size) {
    style.push(`font-size: ${sizes[cell.size] || sizes[Size.M]}`)
  }

  return style.join('')
}

class HTMLAdapter {
  components = {
    Fragment: function () {
      return renderChildren.call(this)
    },
    Container: function () {
      let style = ''
      if (this.style) {
        if (this.id) this.style.addScope(this.id)
        style = this.style.toCSS()
      }
      const id = this.id ? `id="${this.id}"` : ''

      return html`<div
        data-cellery-cell="Container"
        ${id}
        ${this.onclick ? 'onclick="onClick(this)"' : ''}
      >
        <style>
          ${style}
        </style>
        ${renderChildren.call(this)}
      </div>`
    },
    Text: function (style) {
      const tag = this.heading ? `h${this.heading}` : this.paragraph ? 'p' : 'span'

      let attributes = this.id ? `id="${this.id}"` : ''
      if (this.paragraph) {
        attributes += ' class="text-wrap"'
      }
      if (style) {
        attributes += ` style="${style}"`
      }

      // todo: fix safety
      return `<${tag} data-cellery-cell="Text" ${attributes}>${this.value.toString()}</${tag}>`
    },
    Input: function () {
      // TODO: options

      if (!this.multiline) {
        return html`<input
          data-cellery-cell="Input"
          id="${this.id}"
          type="${this.type}"
          class="flex-1 bg-transparent outline-none text-green-500 placeholder-green-900"
          placeholder="${this.placeholder}"
          autofocus
        ></input>`
      }

      return html`<textarea
        data-cellery-cell="Input"
        id="${this.id}"
        type="${this.type}"
        class="flex-1 bg-transparent outline-none text-green-500 placeholder-green-900 field-sizing-content min-h-lh! max-h-[5lh]! resize-none"
        placeholder="${this.placeholder}"
        autofocus
      ></textarea>`
    }
  }

  _renderCell(component) {
    if (component._render) {
      // get the cell out without triggering another render
      component = component._render()
    }

    component.renderer = this
    const style = renderStyle(component)
    const rendererFn = this.components[component.constructor.name || component.parent]
    if (!rendererFn) {
      throw new Error(`No renderer defined for ${component.constructor.name} component.`)
    }
    return rendererFn.call(component, style)
  }

  render(cell) {
    return this._renderCell(cell)
  }
}

function isAction(event, id) {
  return Iambus.match(event, {
    event: 'keydown',
    data: { id, key: 'Enter', shift: false }
  })
}

function isClick(event, id) {
  return Iambus.match(event, { event: 'click', data: { id } })
}

class HTMLServer extends ReadyResource {
  constructor(opts = {}) {
    super()
    const { target, app, stream } = opts

    this.target = target
    this.stream = stream
    this.wss = null
    this.cellery = new Cellery(app, new HTMLAdapter())
    this.onerror = opts.onerror || safetyCatch
  }

  connect(socket) {
    const cellery = this.cellery

    this.pipe = pipeline(
      this.cellery.sub({ event: 'render' }),
      new Transform({
        transform(data, cb) {
          this.push(JSON.stringify(data))
          cb()
        }
      }),
      socket,
      new Transform({
        transform(msg, cb) {
          try {
            this.push(JSON.parse(msg.toString('utf-8')))
          } catch {}
          cb()
        }
      }),
      this.stream,
      new Writable({
        write(data, cb) {
          cellery.pub(data)
          cb()
        }
      }),
      (err) => {
        if (err) this.onerror(err)
      }
    )

    this.cellery.render()
  }

  async _close() {
    if (this.pipe) this.pipe.destroy()
  }

  _open() {
    const token = require('bare-crypto').randomBytes(32).toString('hex')

    const server = http.createServer()

    this.wss = new ws.Server({ server }, (socket, req) => {
      const url = new URL(req.url, 'http://localhost')
      if (url.searchParams.get('token') !== token) {
        socket.destroy()
        return
      }

      this.connect(socket)
    })

    server.listen(0, this.target.host, () => {
      const port = server.address().port
      console.log('ws listening on', this.target.host, port)

      if (!this.target.headless) {
        const window = new Window(800, 600)
        const webView = new WebView()
        window.content(webView)
        webView.loadHTML(htmlTemplate({ ...this.target, port, token }))
        webView.inspectable(true)
      }
    })
  }
}

module.exports = {
  isAction,
  isClick,
  HTMLServer,
  HTMLAdapter
}
