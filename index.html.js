const css = require('./output.css', { with: { type: 'text' } })

const html = String.raw

module.exports = ({ title, port, token }) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          ${css}
        </style>
      </head>
      <body class="bg-black font-mono overflow-hidden">
        <main id="app"></main>
        <script>
          const socket = new WebSocket('ws://localhost:${port}?token=${token}')

          socket.onmessage = (msg) => {
            const { id, content, insert, value, clear, destroy, event, targets } = JSON.parse(
              msg.data
            )

            if (!id && content) {
              const target = document.getElementById('app')
              target.innerHTML = content
              return
            }

            const target = document.getElementById(id)

            if (id && !target) {
              socket.send(JSON.stringify({ error: 'NOT_FOUND', id }))
              return
            }

            if (event === 'register') {
              for (const t of targets) {
                target.addEventListener(t, (e) => {
                  let value

                  if (t === 'submit') {
                    e.preventDefault()
                    const formData = new FormData(e.target)
                    value = Object.fromEntries(formData)
                    target.reset()
                  }

                  const data = {
                    event: t,
                    data: {
                      id,
                      value
                    }
                  }

                  socket.send(JSON.stringify(data))
                })
              }
              // @todo off?
            }

            // @todo simplify
            if (destroy) {
              target.remove()
              return
            }

            if (value !== undefined) {
              target.value = value
            }

            if (clear) {
              target.innerHTML = ''
            }

            if (!content) return

            if (insert) {
              target.insertAdjacentHTML(insert, content)
              target.scrollTop = target.scrollHeight
            } else {
              target.innerHTML = content
            }
          }

          const supportedKeys = ['Enter', 'ArrowUp', 'ArrowDown']

          document.addEventListener('keydown', (e) => {
            // TODO: register for events
            if (!supportedKeys.includes(e.key)) return
            if (!e.shiftKey) e.preventDefault()

            socket.send(
              JSON.stringify({
                event: 'keydown',
                data: {
                  key: e.key,
                  id: e.target.id,
                  shift: e.shiftKey,
                  value: e.target.value
                }
              })
            )

            if (e.key === 'Enter') {
              e.target.value = ''
            }
          })

          let startY = 0

          document.addEventListener('touchstart', (e) => {
            if (e.target.id !== 'cmd-input') return
            startY = e.touches[0].clientY
          })

          document.addEventListener('touchend', (e) => {
            if (e.target.id !== 'cmd-input') return
            const endY = e.changedTouches[0].clientY
            const diff = startY - endY

            if (Math.abs(diff) < 40) return // ignore small swipes

            if (diff > 0) {
              socket.send(
                JSON.stringify({
                  event: 'keydown',
                  data: {
                    key: 'ArrowUp',
                    id: e.target.id,
                    shift: false
                  }
                })
              )
            } else {
              socket.send(
                JSON.stringify({
                  event: 'keydown',
                  data: {
                    key: 'ArrowDown',
                    id: e.target.id,
                    shift: false
                  }
                })
              )
            }
          })
        </script>
      </body>
    </html>`
