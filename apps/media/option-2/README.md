# SozoRock Health — Option 2 video package

Status: **pre-production; narration approval required**

This folder is the handoff package for the approved Option 2 visual direction. It does not replace the existing 80-second exports and it does not contain newly generated narration, music, or a final render.

## Creative direction

The film should feel like a quiet human route from uncertainty to an appropriate next step. It uses warm editorial neutrals, restrained ink and moss, generous negative space, and a single continuous path motif. The visual language should match the redesigned website without reproducing web cards inside a video frame.

The central message is:

> Care may exist. The path to a licensed practitioner may not.

The closing line is:

> A clearer path to care that already exists.

## Package contents

- `storyboard.md` — 80-second scene plan and visual direction
- `narration-draft.txt` — the supplied narration, retained verbatim for approval
- `captions-draft.json` — provisional Remotion caption source
- `captions-draft.vtt` — provisional accessible web captions
- `website-video-component-spec.md` — website integration and accessibility requirements
- `production-checklist.md` — approval, recording, mixing, render, and QA gates

## Approval gates

Production must not begin until Oluwabiyi Adeyemo approves:

1. the narration text;
2. the use of Sol or a currently available equivalent voice;
3. the final visual references and any appearance of his portrait or footage;
4. the licensed background-music selection;
5. the final master before publication.

The draft captions use provisional timing. After approved narration is recorded, regenerate timings from the final audio and manually review every cue.

## Existing asset audit

The existing package under `exports/resident-journey-80s-final` contains four 80.04-second H.264/AAC files:

- 1080 × 1920 Instagram Reels
- 1080 × 1920 YouTube Shorts
- 1080 × 1350 LinkedIn
- 1280 × 720 X

Those videos use the earlier “Readiness starts with being heard” concept, an earlier narration, and a rural-road photograph. They should be treated as historical exports, not silently relabeled as the Option 2 master.

The existing Remotion dependency resolution also reports a Zod version mismatch: the media package requests 4.3.6 while the active workspace resolves 3.25.76. Resolve and lock this before any replacement render.
