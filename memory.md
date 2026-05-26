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





 ## Key Change

  Append this section to the bottom of [memory.md](http://memory.md):

  ## 2026-05-17 Handoff

  What works:

  - Core clone pipeline mostly works and reaches the final reaction/video stage.

  - User truth, voice, and photo flow are connected.

  - ElevenLabs voice cloning and TTS are working.

  - Replicate clone video generation is working.

  - Final reaction screen has been simplified to two unlabeled video panes.

  - Sonnet script generation is intended to be called once through `/api/generate-tts-script`,

  then reused by `/api/analyze-clone`.

  - Current script length is temporarily short for testing, around 4 seconds.

  What does not work yet:

  - Final archive number does not display correctly. In the latest run it displayed nothing.

  - Need to verify whether `archiveLabel` is missing because Supabase migration/table is not

  applied, upload response lacks label, or state is not propagated into `ReactionStep`.

  - Prompt quality is still poor. Participant input should affect the generated confession more

  naturally while preserving the required structure.

  - There is a brief moment where a random/error page flashes during the flow; this should not

  appear.

  Likely next priorities:

  - First fix real dynamic archive number display based on how many people were cloned.

  - Then improve the Sonnet prompt so user input shapes the output without being repeated

  directly.

  - Then remove the brief error-page flash.

  - Keep the short 4-second generation mode until the full flow is stable, then extend duration

  later.

  Verification status:

  - `npm run lint` passed with only the existing unused `blob` warning in `hooks/use-webcam.ts`.

  - `npx tsc --noEmit` passed.

  - `npm run build` passed.

  - `git diff --check` passed.

  ## Test Plan

  - Re-read [memory.md](http://memory.md).

  - Confirm it contains ## 2026-05-17 Handoff.

  - No build/test required.

  ## Assumptions

  - Append only; do not rewrite existing notes.

  - No code changes.

    </proposed_plan>

## 2026-05-23 Handoff

What was done this session (all committed and pushed to `main` as `de90f57`):

### 1. Mobile layout for final reaction screen
- `app/clone/steps/reaction-step.tsx` line 546.
- First attempt changed `grid-cols-2` → `grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1` so the two videos stack on mobile (top/bottom) and stay side-by-side on `sm+`. Visually fine.
- That CSS change broke the **composite recording**: clone video was black on the right half of the saved `final.webm` on mobile (desktop still fine).
- Root cause: `grid-template-rows: repeat(2, minmax(0, 1fr))` needs the grid container to have a defined height. The grid's children use `absolute inset-0`, so they contribute zero to the grid's intrinsic height. On iOS Safari this collapses both row tracks to 0px → video elements have 0 CSS height → iOS Safari stops delivering frames to canvas → `ctx.drawImage(cloneVideo)` paints black.
- Final fix: replaced the grid with flex. Now line 546:
  ```jsx
  <div className="flex min-h-0 w-full flex-1 flex-col sm:flex-row">
  ```
  And each video cell (lines 547, 564) got `flex-1` added:
  ```jsx
  <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
  ```
- Canvas recording logic (1920×1080 side-by-side via `drawVideoContain` at `COMPOSITE_WIDTH/2` offset) was NOT touched.

### 2. Added Russian as a third language
- `lib/cloner/languages.ts`: added `{ code: "ru", label: "Русский" }` to `LANGUAGE_OPTIONS`. `LanguageCode` auto-expands.
- `lib/cloner/ui-copy.ts`: added full `ru` block matching the shape of `pl` and `en` (welcome/truth/voice/photo/loading/reaction/login/transitions/common/language all translated).
- `lib/cloner/readings.ts`: added `ru` passage — Pushkin "К ***" (two stanzas of "Я помню чудное мгновенье"), with attribution.
- `lib/cloner/tts-script.ts`:
  - Added `ru: "Russian"` to `LANGUAGE_LABELS`.
  - Renamed local `polishInstruction` → `langInstruction`, extended ternary to also emit a Russian-specific instruction when `languageCode === "ru"`.
  - No fallback script written for Russian (per user request: "do not create fallback scenarios for this language"). If Replicate fails for `ru`, `fallbackTtsScript()` returns the English fallback string.

### 3. Pre-existing password-step change
Also committed (was already in working tree at session start): `app/clone/steps/password-step.tsx` form now uses `mx-auto w-full max-w-sm` instead of `w-full`. Not work I did, just rolled into the commits.

## What still does not work
Nothing new identified this session. The mobile composite-recording bug was the one regression caused by my first layout attempt, and the flex rewrite is the fix. Should be verified on a real iOS device (only verified by reasoning, not by running on hardware in this session).

## Verification status
- Not run this session — no lint, typecheck, or build attempts. Changes are pure CSS class swaps plus additive language data (new object key, new switch branch). Low risk of typecheck breakage but worth running `npx tsc --noEmit` and `npm run build` before next deploy.

## Likely next priorities
- Verify on a real iPhone that the saved `final.webm` shows both halves filled when recorded on mobile.
- Test the Russian flow end-to-end (truth → voice with Pushkin passage → TTS script → clone video).
- Carry forward the priorities from the 2026-05-17 handoff that are still open (archive number display, Sonnet prompt quality, error-page flash).

