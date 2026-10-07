import { expect, mock, test } from 'claude-code/testing'

test('/storyboard senza argomenti mostra come usarlo', async $ => {
  const { text } = await $.command.run({ command: 'storyboard' })
  expect(text).toContain('Uso: /storyboard')
})

test('/storyboard con un\'idea invia il prompt dello storyboard', async ($, on) => {
  const clock = mock.clock(on)
  const sent: string[] = []
  on('prompt.submit', (_$, e) => {
    sent.push(e.text)
    return { drop: 'test' }
  })
  const { text } = await $.command.run({ command: 'storyboard', args: 'spot di un profumo al tramonto' })
  expect(text).toContain('avvio /storyboard')
  await clock.advance(10)
  expect(sent.some(t => t.includes('spot di un profumo al tramonto'))).toBe(true)
})

test('il profilo di lavoro entra nel system prompt', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose({
    model: 'test',
    promptModel: 'test',
    surfaces: [],
    tools: [],
    outputStyle: null,
    traits: [],
  })
  expect(sections.some(s => s.id === 'studio-ai:profile')).toBe(true)
})

test('una generazione IA viene registrata nello storico', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  let saved: Array<{ tool: string; status: string }> = []
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', (_$, e) => {
    if (e.key === 'jobs') saved = e.value as typeof saved
    return { value: undefined } as never
  })
  on('tool.call', () => ({ result: { ok: true } }) as never)
  await $.tool.call({ tool: 'mcp__higgsfield__generate_video', prompt: 'x' } as never)
  expect(saved.length).toBe(1)
  expect(saved[0]?.tool).toBe('generate_video')
  expect(saved[0]?.status).toBe('done')
})
