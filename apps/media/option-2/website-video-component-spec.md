# Website video-component specification

The website should be ready for the approved final film without shipping an unapproved draft.

## Required behavior

- Do not place the video in the hero or make it part of Largest Contentful Paint.
- Use an accessible poster with explicit width and height.
- Use `preload="metadata"` or `preload="none"`; never preload the full file on initial page load.
- Do not autoplay with sound. Prefer a clear play action.
- Provide native controls, keyboard operation, and a visible focus state.
- Include a captions track with `kind="captions"`, `srclang="en"`, and a descriptive label.
- Provide a transcript adjacent to the player in a disclosure labelled “Read the transcript.”
- Respect reduced-motion preferences. Do not animate the poster or automatically start playback.
- Pause any decorative motion when the player begins.
- Do not rely on color alone for playback state.
- Use a 16:9 website master. Social exports remain separate downloads rather than browser source candidates.

## Content states

1. **Before final approval:** show an editorial storyboard or a clearly labelled “Film in production” placeholder only if the page needs the space. Do not present the historical export as the approved film.
2. **After approval:** publish the optimized 16:9 master, poster, English WebVTT captions, and transcript together.
3. **Failure state:** retain the poster, synopsis, and transcript link when video playback is unavailable.

## Asset targets

- Website master: H.264/AAC MP4, 1920 × 1080, fast-start metadata, target 6–10 Mbps
- Optional modern source: WebM/AV1 only when it materially improves delivery and has an MP4 fallback
- Poster: AVIF or WebP plus fallback, 1920 × 1080, under 250 KB where visual quality permits
- Captions: reviewed WebVTT based on the final approved narration
- Transcript: semantic HTML, not an image or PDF-only artifact

## Analytics

Track only product-use events, without health information:

- `video_impression`
- `video_play`
- `video_25_percent`
- `video_50_percent`
- `video_75_percent`
- `video_complete`
- `video_caption_enabled`
- `video_transcript_opened`
- `video_download_selected`

Do not include spoken content, free-text fields, medical information, or stable personal identifiers in event properties.
