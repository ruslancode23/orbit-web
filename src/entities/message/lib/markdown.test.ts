import { parseInline, parseMessage, plainMessageText } from './markdown'

const types = (content: string) => parseMessage(content).map((block) => block.type)

describe('parseMessage', () => {
  it('keeps a plain message as one paragraph', () => {
    const blocks = parseMessage('привет')
    expect(blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'привет' }] }])
  })

  it('reads bold, italic, strike, code and spoiler', () => {
    expect(parseInline('**жирный**')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'жирный' }] },
    ])
    expect(parseInline('*курсив*')).toEqual([
      { type: 'italic', children: [{ type: 'text', text: 'курсив' }] },
    ])
    expect(parseInline('_курсив_')).toEqual([
      { type: 'italic', children: [{ type: 'text', text: 'курсив' }] },
    ])
    expect(parseInline('~~зачёркнутый~~')).toEqual([
      { type: 'strike', children: [{ type: 'text', text: 'зачёркнутый' }] },
    ])
    expect(parseInline('`код`')).toEqual([{ type: 'code', text: 'код' }])
    expect(parseInline('||тайна||')).toEqual([
      { type: 'spoiler', children: [{ type: 'text', text: 'тайна' }] },
    ])
  })

  it('nests emphasis', () => {
    expect(parseInline('**жирный *и курсив***')).toEqual([
      {
        type: 'bold',
        children: [
          { type: 'text', text: 'жирный ' },
          { type: 'italic', children: [{ type: 'text', text: 'и курсив' }] },
        ],
      },
    ])
  })

  it('leaves an unclosed marker as text', () => {
    expect(parseInline('**незакрытый')).toEqual([{ type: 'text', text: '**незакрытый' }])
    expect(parseInline('одна *звёздочка')).toEqual([{ type: 'text', text: 'одна *звёздочка' }])
  })

  it('does not italicise inside a word', () => {
    expect(parseInline('snake_case_name')).toEqual([{ type: 'text', text: 'snake_case_name' }])
  })

  it('does not format inside inline code', () => {
    expect(parseInline('`**не жирный**`')).toEqual([{ type: 'code', text: '**не жирный**' }])
  })

  it('turns only http(s) into links', () => {
    expect(parseInline('https://orbit.chat/docs')).toEqual([
      {
        type: 'link',
        href: 'https://orbit.chat/docs',
        children: [{ type: 'text', text: 'https://orbit.chat/docs' }],
      },
    ])
    expect(parseInline('javascript:alert(1)')).toEqual([
      { type: 'text', text: 'javascript:alert(1)' },
    ])
  })

  it('keeps a trailing full stop out of a link', () => {
    expect(parseInline('смотри https://orbit.chat.')).toEqual([
      { type: 'text', text: 'смотри ' },
      {
        type: 'link',
        href: 'https://orbit.chat',
        children: [{ type: 'text', text: 'https://orbit.chat' }],
      },
      { type: 'text', text: '.' },
    ])
  })

  it('reads a fenced code block with its language', () => {
    expect(types('```go\nfmt.Println(1)\n```')).toEqual(['codeblock'])
    expect(parseMessage('```go\nfmt.Println(1)\n```')[0]).toEqual({
      type: 'codeblock',
      code: 'fmt.Println(1)',
      language: 'go',
    })
  })

  it('reads consecutive quote lines as one quote', () => {
    expect(parseMessage('> один\n> два')).toEqual([
      { type: 'quote', children: [{ type: 'text', text: 'один\nдва' }] },
    ])
  })

  it('does not choke on a long input', () => {
    const long = `${'*a* '.repeat(20_000)}**${'b'.repeat(20_000)}`
    const started = performance.now()
    parseMessage(long)
    expect(performance.now() - started).toBeLessThan(500)
  })
})

describe('plainMessageText', () => {
  it('strips the markers and keeps the words', () => {
    expect(plainMessageText('**жирный** и *курсив*, `код`, ||тайна||')).toBe(
      'жирный и курсив, код, тайна',
    )
    expect(plainMessageText('ссылка https://orbit.chat')).toBe('ссылка https://orbit.chat')
    expect(plainMessageText('```\nкод\n```')).toBe('код')
  })
})
