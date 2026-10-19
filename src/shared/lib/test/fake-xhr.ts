/**
 * A stand-in for XMLHttpRequest, for the upload with progress:
 *
 *   vi.stubGlobal('XMLHttpRequest', FakeXhr)
 *   FakeXhr.last().progress(50, 100)
 *   FakeXhr.last().respond(201, attachment)
 *
 * Reset `FakeXhr.instances` between tests.
 */
export class FakeXhr {
  static instances: FakeXhr[] = []

  static last(): FakeXhr {
    const request = FakeXhr.instances.at(-1)
    if (!request) {
      throw new Error('no XMLHttpRequest was created')
    }
    return request
  }

  method = ''
  url = ''
  withCredentials = false
  body: unknown = undefined
  status = 0
  responseText = ''
  aborted = false
  readonly upload = new EventTarget()
  private readonly events = new EventTarget()

  constructor() {
    FakeXhr.instances.push(this)
  }

  open(method: string, url: string | URL) {
    this.method = method
    this.url = String(url)
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.aborted = true
    this.events.dispatchEvent(new Event('abort'))
  }

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener)
  }

  /** The file sent as `file` in the multipart body. */
  get file(): File | null {
    const file = this.body instanceof FormData ? this.body.get('file') : null
    return file instanceof File ? file : null
  }

  progress(loaded: number, total: number) {
    this.upload.dispatchEvent(
      new ProgressEvent('progress', { lengthComputable: true, loaded, total }),
    )
  }

  respond(status: number, body: unknown) {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.events.dispatchEvent(new Event('load'))
  }

  failNetwork() {
    this.events.dispatchEvent(new Event('error'))
  }
}
