# Infinite Financial Group — website

A single-page, scroll-driven website for **Infinite Financial Group** (Covington, GA): *Financial Protection • Wealth Creation • Legacy Planning*.

Plain HTML, CSS and JavaScript. No build step, no frameworks, no dependencies. It runs on any static host (GitHub Pages, Netlify, Cloudflare Pages, Hostinger, and so on).

## Preview it

Double-click **`START-PREVIEW.bat`**. It starts a small local server (Windows PowerShell, nothing to install) and opens `http://localhost:8080/`. Leave the window open while you look around.

You can also open `index.html` directly. Most things work, but some browsers block parts of a page opened from disk, so the preview server is the reliable way to check it.

## Publish on GitHub Pages

1. Push this repository to GitHub (already set up as `cohen05heidt/Infinite-Financial-Website`).
2. On GitHub, go to **Settings → Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**, pick **main** and **/ (root)**, then **Save**.
4. After a minute the site is live at `https://cohen05heidt.github.io/Infinite-Financial-Website/`. A custom domain such as `infinite-financial-group.com` can be added on the same page.

All paths are relative, so the site works from a sub-folder URL or from the root of a domain.

## What's on the page

| Section | Interaction |
|---|---|
| Opening | A Higgsfield-generated film of a golden infinity. **Scrolling plays it**, frame by frame, through three chapters: Protection → Wealth → Legacy. Preloader draws the infinity while frames load. |
| Ticker | Speeds up and leans with how fast you scroll. |
| Our approach | The statement lights up word by word as you scroll. |
| Who we are | Kareem's portrait as a holographic card that tilts and catches light under the cursor. |
| How we help | On desktop the section pins and the four services **slide sideways as you scroll down**. On phones it's a swipe carousel. |
| Planning lab | Two live tools: a DIME life-insurance estimate and a monthly money snapshot. Nothing entered leaves the page. |
| Mission | Words rise into place over a parallax gold-ribbon backdrop. |
| What you can expect | A comet travels the infinity symbol and lights each promise as you reach it. |
| Contact | A second film (golden horizon) plays as you arrive. Click-to-call numbers, live **Open now / Closed** status in Eastern Time, and a request form. |

Throughout: an **infinity-shaped progress meter** in the top bar fills as you move down the page, a gold cursor ring, magnetic buttons, and drifting gold dust that moves away from the cursor.

Visitors who have "reduce motion" turned on get a calm, static version: no scroll film, no pinning, everything readable.

## The request form

There is no server, so **Send request by email** opens the visitor's email app with a message to `farleyphp@gmail.com` already written (name, phone, email, topics, best time, message). They press send. If you later want submissions to arrive without the visitor's email app (Formspree, Netlify Forms, a CRM), the form is in `index.html` (`#requestForm`) and the handler is near the bottom of `assets/js/main.js`.

## Editing content

- **Text** — everything is in `index.html`, in page order, with comments marking each section.
- **Phone numbers / email / address** — search `index.html` for `706-496-5292`, `404-272-8733`, `farleyphp@gmail.com`, `Industrial Blvd`. The structured data block in `<head>` has them too.
- **Office hours** — the table in `index.html` (`#hoursBody`) **and** the `HOURS` line in `assets/js/main.js` (it drives the Open now / Closed status).
- **Colors and type** — the tokens at the top of `assets/css/style.css`.

## Files

```
index.html               the page
assets/css/style.css     all styling
assets/js/main.js        all interaction (vanilla JS)
assets/img/              photos, Higgsfield graphics, logos, social share card
assets/film/hero/        opening film: 144 frames, desktop + mobile crops
assets/film/horizon/     contact film: 72 frames, desktop + mobile crops
preview-server.ps1       local preview server used by START-PREVIEW.bat
```

The films are stored as numbered JPEG frames rather than video on purpose. Scrubbing still frames on a canvas is smooth in every browser, including iPhone Safari, where seeking a video by scroll position stutters. Please don't re-encode or rename them.

## Graphics

All illustrations, backgrounds and both films were generated with **Higgsfield** (GPT Image 2.5 stills; Kling 3.0 Pro image-to-video, cut into frames with ffmpeg). Photos of Kareem M. Farley and the IFG logos are the client's own. Two supplied photos showing Louis Vuitton branding were intentionally left out, and no third-party logos appear anywhere on the site.

## Before launch

- Insurance and financial-services marketing, including bios, service descriptions and the Planning Lab tools, may need review by the carrier or IMO the agency is appointed with. Worth starting early.
- The Planning Lab is labeled as educational estimates, not quotes or recommendations. Keep that wording if the tools change.
