# Production checklist

## Approval

- [ ] Narration approved by Oluwabiyi Adeyemo
- [ ] Voice method and model availability confirmed at production time
- [ ] Visual references and any portrait/footage approved
- [ ] Music source and license documented
- [ ] Logo lockup approved

## Narration

- [ ] Record or synthesize only after script approval
- [ ] Warm, calm, clear, assured, thoughtful, conversational, and measured delivery
- [ ] Natural pauses retained; no theatrical, sentimental, rushed, or advertising-style performance
- [ ] Final audio reviewed by a human before render
- [ ] No medical advice, diagnosis, triage, treatment, or prescription language introduced

## Music and mix

- [ ] Restrained instrumental track with no vocals or lyrics
- [ ] No corporate ukulele, hospital sounds, aggressive percussion, or dramatic cinematic build
- [ ] License permits website and organic/paid social use
- [ ] Narration remains intelligible throughout
- [ ] Music ducks under speech and fades naturally at start and finish
- [ ] Final loudness checked consistently across all exports

## Visuals

- [ ] One focal idea per scene
- [ ] Authentic or approved assets only
- [ ] No generative alteration of Oluwabiyi Adeyemo’s face or identity
- [ ] No artificial hospital scenes or staged treatment imagery
- [ ] Captions and key text remain inside platform-safe areas
- [ ] Reduced-motion alternative considered for the website

## Technical

- [ ] Resolve Remotion/Zod dependency mismatch before render
- [ ] Replace provisional caption timings using the final narration audio
- [ ] Validate JSON captions against the Remotion `Caption` shape
- [ ] Render representative stills at 9:16, 4:5, and 16:9 and inspect at full size
- [ ] Render all masters from the same approved composition and narration
- [ ] Verify duration, frame rate, resolution, H.264/AAC streams, and audio sample rate with ffprobe
- [ ] Check for clipping, silence, caption collisions, encoding artifacts, and illegible text
- [ ] Create accessible poster, WebVTT captions, and HTML transcript

## Final approval and release

- [ ] Oluwabiyi Adeyemo approves the final master
- [ ] Website master and social exports receive distinct filenames and version metadata
- [ ] Historical exports are not overwritten until the replacement is accepted
- [ ] Publish only after explicit deployment approval
