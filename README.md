# prova_claude

## Mod `studio-ai` per Claude Code

Automazioni per chi crea video, foto, animazioni e motion graphics con l'intelligenza artificiale.

### Installazione

Nel terminale, dentro Claude Code:

```
/plugin install studio-ai --marketplace micheledicosola300-dev/prova_claude
```

Rispondi `y` per aggiungere il marketplace, poi scegli lo scope (Invio = utente).

### Comandi

| Comando | Cosa fa |
| --- | --- |
| `/storyboard <idea>` | Storyboard completo: scene, durate, inquadrature, transizioni, audio, prompt immagine e video per ogni scena |
| `/prompt-video <idea>` | 3 varianti di prompt ottimizzati per generatori video IA |
| `/prompt-foto <idea>` | 3 varianti di prompt per immagini e foto IA |
| `/motion <brief>` | Piano di motion graphics: timeline, keyframe, easing, tipografia |
| `/social <idea>` | Adattamento per Reels/TikTok/Shorts, post e YouTube con hook, caption e hashtag |
| `/studio` | Pannello con lo storico delle generazioni |

### Automatico, senza fare niente

- **Profilo di lavoro**: Claude sa che crei contenuti IA, propone formato/durata/stile, scrive prompt strutturati in inglese e mantiene la coerenza tra le scene.
- **Tracker generazioni**: ogni generazione fatta con strumenti IA collegati (immagini, video, upscale, rimozione sfondo, animazioni, voce, 3D) viene registrata; una notifica avvisa quando finisce o fallisce e la barra di stato mostra quante ne hai fatte oggi.
