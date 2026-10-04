# BC Reader

Business Card Reader. Photograph a business card, check the fields, and file the person into the Contacts app on iPhone or Android.

BC Reader fills a vCard (name, Chinese name, title, company, phones, emails, website, LinkedIn, address, notes) and hands that file to the phone. iPhone opens a contact card. Android imports the vCard. Both ask you to confirm before anyone is saved. A browser cannot write the address book on its own.

The book of cards stays in this browser. Nothing is stored on a server unless you turn on Gemini, in which case the photo is sent to Google to be read and is not kept.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL printed by Next.js. `npm test` checks the card parser and the vCard file. `npm run lint` checks the app.

## Read a card

1. Take a photo, upload one, or drop it on the plate. Two sample cards are under the buttons if you want to try the flow without a camera.
2. Press **Read this card**.
3. Correct anything that looks wrong.
4. Press **Add to phone**. On a computer this downloads a `.vcf` file you can open in Contacts, Google Contacts, or Outlook. **Add everyone** does the same for the whole book.

Without a Gemini key, BC Reader reads the card on the device with Tesseract. That path is private. It sharpens the photo and reads English plus Traditional Chinese. With a key, Gemini reads the photograph.

## Gemini

Create a key in [Google AI Studio](https://aistudio.google.com/apikey).

Either:

- Paste it in **Settings**. It stays in this browser and is sent only to this app’s `/api/parse` route, which forwards the photo to Gemini.
- Or set `GEMINI_API_KEY` in the environment. A server key is used first and is never shown in the page. Do not use a `NEXT_PUBLIC_` prefix.

Optional: `GEMINI_MODEL` (default `gemini-3.5-flash`). `gemini-3.8-flash` is stronger. `gemini-3.5-flash-lite` is cheaper. See `.env.example`.

Anyone who can open a deployed site can spend a server key. For a personal tool, paste the key in Settings, or turn on a password in Netlify.

## Deploy on Netlify

`netlify.toml` overrides the site settings in the Netlify UI. The build is the same one Netlify uses for Next.js 16: `npm run build`, publish directory `.next`, Node 22 (also set in `.node-version` and `.nvmrc`). The Next.js runtime is applied automatically. This repo does not pin `@netlify/plugin-nextjs`.

1. Import the repo as a new site. Leave the base directory empty. If an older site has a publish directory of `public` or `out`, clear it and redeploy so `.next` from `netlify.toml` is used.
2. In **Project configuration → Build & deploy → Build plugins**, remove a pinned “Next.js runtime” / `@netlify/plugin-nextjs` entry if the build log says the adapter is outdated. A pinned copy opts out of the current runtime and breaks Next.js 16.
3. Optional: add `GEMINI_API_KEY` under **Environment variables**, then redeploy. Do not use a `NEXT_PUBLIC_` name. The key is read when a card is scanned, not baked into the build.
4. Open the site on a phone and tap **Add to phone**.

Netlify’s default function limit is 10 seconds. Card reads use `gemini-3.5-flash-lite` and give up at 8 seconds so the request returns before that cutoff. If Gemini is slow, Automatic mode reads the card in the browser instead. On-device reading does not call a Netlify function.
