# Brass

Photograph a business card, check the fields, and file the person into the Contacts app on iPhone or Android.

Brass fills a vCard (name, title, company, phones, emails, website, LinkedIn, address, notes) and hands that file to the phone. iPhone opens a contact card. Android imports the vCard. Both ask you to confirm before anyone is saved. A browser cannot write the address book on its own.

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

Without a Gemini key, Brass reads the card on the device with Tesseract. That path is private and less accurate. With a key, Gemini reads the photograph.

## Gemini

Create a key in [Google AI Studio](https://aistudio.google.com/apikey).

Either:

- Paste it in **Settings**. It stays in this browser and is sent only to this app’s `/api/parse` route, which forwards the photo to Gemini.
- Or set `GEMINI_API_KEY` in the environment. A server key is used first and is never shown in the page. Do not use a `NEXT_PUBLIC_` prefix.

Optional: `GEMINI_MODEL` (default `gemini-3.5-flash`). `gemini-3.8-flash` is stronger. `gemini-3.5-flash-lite` is cheaper. See `.env.example`.

Anyone who can open a deployed site can spend a server key. For a personal tool, paste the key in Settings, or turn on a password in Netlify.

## Deploy on Netlify

Netlify’s Next.js runtime (OpenNext) picks this app up without a pinned adapter.

1. Push the repo and create a Netlify site from it.
2. Build command: `npm run build`. Publish directory: `.next`. Node 22. These are already in `netlify.toml`.
3. Add `GEMINI_API_KEY` under **Site configuration → Environment variables**, then redeploy.
4. Open the site on your phone, read a card, and tap **Add to phone**.

The parse function timeout is 26 seconds so a Gemini read can finish.
