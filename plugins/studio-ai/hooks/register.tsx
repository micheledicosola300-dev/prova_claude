import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Job } from '../types'

const PANE = 'studio-ai'
const jobs = atom({ plugin: 'studio-ai', key: 'jobs' } as const, [])

// Strumenti che producono media: generazione, upscale, sfondi, animazioni.
const MEDIA_TOOL =
  /^mcp__.*(generate|upscale|outpaint|reframe|remove_background|animate|motion|video|image|dubbing|voice|3d)/i

export const PROFILE = `# Profilo di lavoro (studio-ai)
La persona crea video con l'intelligenza artificiale: grafica, foto, animazioni e motion graphics. Rispondi in italiano.
- Prima di generare, fissa formato (9:16 per Reels/TikTok/Shorts, 1:1 o 4:5 per post, 16:9 per YouTube), durata e stile; se mancano, proponi un default ragionevole invece di bloccarti.
- Scrivi i prompt per immagini e video in inglese (rendono meglio sui modelli), strutturati: soggetto, azione, ambientazione, camera/obiettivo, movimento di camera, luce, stile, colori, negativi.
- Mantieni coerenza tra le scene: stesso personaggio, palette, luce e seed quando possibile.
- Per lavori in più passaggi: prima immagini chiave, poi animazione, poi upscale/montaggio. Riassumi alla fine cosa è stato generato e cosa manca.`

type Recipe = { description: string; hint: string; build: (args: string) => string }

export const RECIPES: Record<string, Recipe> = {
  storyboard: {
    description: 'Storyboard completo da un\'idea: scene, inquadrature, prompt e audio',
    hint: '<idea del video>',
    build: idea => `Crea uno storyboard per questo video: "${idea}".
Per ogni scena dai: numero, durata in secondi, descrizione, inquadratura e movimento di camera, transizione, testo a schermo, musica/SFX, poi un prompt immagine (keyframe) e un prompt video (animazione) in inglese.
Chiudi con formato consigliato, durata totale e lista dei materiali da generare. Presentalo come tabella.`,
  },
  'prompt-video': {
    description: 'Tre varianti di prompt ottimizzati per generare un video',
    hint: '<cosa vuoi vedere>',
    build: idea => `Scrivi 3 varianti di prompt per un generatore video IA a partire da: "${idea}".
Ognuna in inglese, con soggetto, azione, ambientazione, camera e movimento, luce, stile, durata e prompt negativo. Varia lo stile tra le tre (es. cinematografico, stilizzato, documentaristico) e spiega in una riga quando usare ciascuna.`,
  },
  'prompt-foto': {
    description: 'Tre varianti di prompt per immagini e foto IA',
    hint: '<cosa vuoi vedere>',
    build: idea => `Scrivi 3 varianti di prompt per un generatore di immagini IA a partire da: "${idea}".
Ognuna in inglese, con soggetto, composizione, obiettivo/focale, luce, palette, stile, aspect ratio consigliato e prompt negativo. Spiega in una riga la differenza tra le tre.`,
  },
  motion: {
    description: 'Piano di motion graphics: tempi, keyframe, easing e testi',
    hint: '<brief dell\'animazione>',
    build: brief => `Prepara un piano di motion graphics per: "${brief}".
Dai una timeline secondo per secondo con elementi, keyframe (posizione, scala, rotazione, opacità), easing, transizioni, tipografia e palette. Aggiungi i prompt in inglese per gli eventuali elementi da generare con l'IA e i suggerimenti per After Effects o simili.`,
  },
  social: {
    description: 'Adatta un video o un\'idea a Reels, TikTok, Shorts e YouTube',
    hint: '<idea o video da pubblicare>',
    build: brief => `Adatta questo contenuto ai social: "${brief}".
Per Reels/TikTok/Shorts (9:16), post (1:1 o 4:5) e YouTube (16:9) indica: durata ideale, hook nei primi 2 secondi, come ritagliare o riformattare, testo a schermo, caption, 5-10 hashtag e orario di pubblicazione consigliato.`,
  },
}

const USAGE = Object.entries(RECIPES)
  .map(([name, r]) => `/${name} ${r.hint}: ${r.description}`)
  .concat('/studio: pannello con lo storico delle generazioni')
  .join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const [name, r] of Object.entries(RECIPES)) {
      await $.command.register({ name, description: r.description, argumentHint: r.hint })
    }
    await $.command.register({
      name: 'studio',
      description: 'Pannello con lo storico delle generazioni IA',
    })

    // Riprende lo storico dalle sessioni precedenti.
    const saved = await $.store.get('jobs')
    if (Array.isArray(saved)) {
      await update($, jobs, list => (list.length > 0 ? list : (saved as Job[])))
    }

    return next(e)
  })

  // Il profilo di lavoro entra nel system prompt di ogni richiesta.
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)

    return {
      sections: [...sections, { id: 'studio-ai:profile', text: PROFILE, scope: 'session' }],
    }
  })

  for (const name of Object.keys(RECIPES)) {
    on('command.run', { command: name }, async ($, e) => {
      const args = (e.args ?? '').trim()
      if (args === '') {
        return { text: `Uso: /${name} ${RECIPES[name]!.hint}\n\nComandi disponibili:\n${USAGE}` }
      }
      // Un command.run non può avviare un turno mentre lo tiene occupato:
      // il prompt parte appena il comando ha finito.
      void submitLater($, RECIPES[name]!.build(args))

      return { text: `studio-ai: avvio /${name}…` }
    }).catch(() => ({ text: `studio-ai: /${name} non è riuscito, riprova.` }))
  }

  on('command.run', { command: 'studio' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Studio IA' })

    return { text: 'Pannello Studio IA aperto.' }
  })

  on('tool.call', async ($, e, next) => {
    if (!MEDIA_TOOL.test(e.tool)) {
      return next(e)
    }

    const job: Job = {
      id: e.tool_use_id,
      tool: e.tool.split('__').pop() ?? e.tool,
      at: await $.clock.now(),
      status: 'running',
    }
    await update($, jobs, list => [...list, job].slice(-100))

    const ran = await next(e)
    const isFailed = ran.deny !== undefined || ran.isError === true
    const status: Job['status'] = isFailed ? 'failed' : 'done'

    const list = await update($, jobs, all =>
      all.map(one => (one.id === job.id ? { ...one, status } : one)),
    )
    await $.store.set('jobs', list)

    const today = list.filter(one => one.status === 'done' && isToday(one.at, job.at)).length
    $.ui.status(`🎬 ${today} generazioni oggi`)
    $.ui.toast(isFailed ? `✖ ${job.tool} non riuscito` : `✔ ${job.tool} completato`)

    return ran
  }).catch(($, e, next) => next(e)) // il tracker non deve mai bloccare una generazione

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, jobs)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 6)
    const done = list.filter(one => one.status === 'done').length
    const failed = list.filter(one => one.status === 'failed').length

    return (
      <Box flexDirection="column">
        <Text bold>
          {done} completate · {failed} fallite · {list.length} totali
        </Text>
        {list.length === 0 && <Text dimColor>Nessuna generazione ancora.</Text>}
        {list
          .slice(-room)
          .reverse()
          .map(one => (
            <Text dimColor={one.status !== 'running'}>
              {one.status === 'running' ? '⏳' : one.status === 'done' ? '✔' : '✖'} {formatTime(one.at)}{' '}
              {one.tool}
            </Text>
          ))}
        <Button
          key="clear"
          label="Svuota storico"
          onPress={async () => {
            await update($, jobs, () => [])
            await $.store.set('jobs', [])
          }}
        />
      </Box>
    )
  })
}

async function submitLater($: EngineInterface, text: string): Promise<void> {
  await $.clock.sleep(1)
  await $.prompt.submit({ text, asUser: true })
}

function isToday(at: number, now: number): boolean {
  return new Date(at).toDateString() === new Date(now).toDateString()
}

function formatTime(at: number): string {
  const d = new Date(at)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
