# Cloner Project Memory

Current branch/worktree contains an MVP clone pipeline for an art project.

What works:
- User enters personal truth, records voice, uploads photo.
- Voice sample uploads to Supabase as `voice.webm`.
- Photo uploads to Supabase as `photo.png`.
- ElevenLabs voice cloning works.
- TTS generation works and uploads `tts.mp3`.
- Replicate video generation works and uploads `clone.mp4`.
- Supabase folder can contain `photo.png`, `voice.webm`, `tts.mp3`, `clone.mp4`.

Important recent changes:
- Added password gate for Vercel-hosted MVP.
- Added Supabase upload/session APIs.
- Added ElevenLabs TTS and Replicate avatar video flow.
- Added language-aware script generation so selected Polish/etc should generate speech in that language.
- Added automatic final reaction recording logic.
- Added browser-side composite recording intended to create `final.webm`.
- Added raw reaction backup upload as `reaction.webm`.
- Added `/api/session/asset` proxy for private Supabase files.
- Tried to fix loader handoff by checking avatar video readiness and streaming asset responses.

What still does not work:
- After Replicate finishes and backend reaches `phase: clone_uploaded`, the app still gets stuck on the loader at 98%.
- Supabase has generated assets except the final merged video.
- `final.webm` is not created/uploaded because the app never reaches or successfully runs the final reaction recording step.
- The latest attempted fix did not solve the stuck loader.

Likely problem area:
- `app/clone/steps/loading-step.tsx`
- `/api/analyze-clone`
- `/api/session/asset`
- The handoff from successful `clone_uploaded` response to `onComplete(...)` / `ReactionStep`.

Desired behavior:
- Keep user on loader until avatar video is truly ready.
- Then enter final screen automatically.
- Start recording automatically once avatar appears.
- Create a Zoom-style composite video:
  - left: participant webcam reaction
  - right: generated avatar video
- Preserve aspect ratio, no stretching.
- Upload final merged recording to Supabase as `final.webm`.
- Also keep separate source assets for debugging/use later.

Verification status:
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run lint` only reports an existing unused variable warning in `hooks/use-webcam.ts`.
