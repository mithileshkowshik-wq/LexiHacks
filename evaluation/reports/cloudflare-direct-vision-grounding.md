# Cloudflare Llama 3.2 Vision grounding probe

Date: 2026-08-12

Model: `@cf/meta/llama-3.2-11b-vision-instruct`

Endpoint: direct Workers AI model endpoint, `/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`

Official references:

- <https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/>
- Live model schema: `GET /client/v4/accounts/{account_id}/ai/models/schema?model=@cf/meta/llama-3.2-11b-vision-instruct`

## Gate

The benchmark remains blocked until two different worksheets produce clearly image-specific first-line transcriptions. JSON validity is not accepted as proof of image grounding.

## One-sample result

Sample: `student-191379`

Prompt: transcribe exactly the first handwritten response line without correcting it.

| Request shape | HTTP result | Model output | Grounding decision |
|---|---:|---|---|
| `messages` plus separate top-level JPEG data URL | 400 | Cloudflare error 3030: unable to add image because no user/system messages were found | Failed transport; no model judgment possible |
| Multipart text in `messages` plus separate top-level JPEG data URL | 400 | Same Cloudflare error 3030 | Failed transport; no model judgment possible |
| Current schema-recommended `messages[].content` with separate text and `image_url` parts | 200 | `He run` | Pass for this worksheet; visually matches its first handwritten response exactly |

The live Cloudflare model schema describes top-level `image` as deprecated and says to use the image as part of `messages`. The working request therefore places the `data:image/jpeg;base64,...` value in an `image_url` content part. The two top-level-image attempts are retained as failure evidence rather than being silently discarded.

## Saved evidence

Raw requests contain worksheet image bytes and are intentionally ignored by Git under `evaluation/debug-private/`.

- Initial top-level request and raw 400 response: `evaluation/debug-private/cloudflare-direct-vision/student-191379/`
- Multipart-text/top-level-image request and raw 400 response: `evaluation/debug-private/cloudflare-direct-vision/student-191379-multipart-text-top-level-image/`
- Working documented message-image request and raw 200 response: `evaluation/debug-private/cloudflare-direct-vision/student-191379-documented-message-image/`

Each directory contains:

- `raw-request.json` — exact request body with authorization redacted
- `request-structure.json` — reviewable structure with image bytes redacted and image evidence recorded
- `raw-response.txt` — verbatim HTTP response body
- `response-metadata.json` — status and timing
- `probe-result.json` — extracted text and explicit grounding assessment

## Decision

This first sample is no longer hallucinating when the current documented message-image structure is used. It is only one positive grounding result, so the second-worksheet sanity check and F1 benchmark have not been run yet.
