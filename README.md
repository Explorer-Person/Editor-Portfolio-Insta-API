# 🧠 Editor-Portfolio-Insta-API

This project is a full-stack **Express.js API** implementation that includes:

* 📝 A **Blog Editor** API for managing blog posts with image uploads.
* 🎨 A **Portfolio Project Editor** API for managing developer portfolios.
* 📸 An **Instagram Content Scraper** to automate profile media extraction.

> 📍 **Frontend UI:** [Explorer-Person/Editor-Portfolio-Insta-UI](https://github.com/Explorer-Person/Editor-Portfolio-Insta-UI.git)

---

## 🗂️ Project Structure & Routing

### Main Entry Point: `routes/index.js`

The central router maps subroutes as follows:

```js
router.use("/blog", blogRouter);       // Blog-related endpoints
router.use("/project", projectRouter); // Portfolio project-related endpoints
router.use("/instagram", instaRouter); // Instagram scraping endpoints
```

It also includes a `/test` route to verify API health:

```http
GET /api/test
```

---

## 📚 Blog Editor API

Blog-related endpoints are defined under `/api/blog` and support the following routes:

| Method | Route             | Description                             |
| ------ | ----------------- | --------------------------------------- |
| POST   | `/save`           | Save blog post metadata                 |
| POST   | `/saveJSON`       | Save full blog JSON content             |
| POST   | `/upload`         | Upload blog images                      |
| GET    | `/get`            | Retrieve all blog posts                 |
| GET    | `/getJSON/:id`    | Get JSON content of a blog by ID        |
| GET    | `/getOne/:slug`   | Get blog post by slug                   |
| GET    | `/delete/:id`     | Delete blog post                        |
| GET    | `/download/:slug` | Download all blog images as zip by slug |
| PUT    | `/update/:id`     | Update blog post                        |

> All routes that deal with JSON content use `express.json()` middleware to parse incoming data.

---

## 🧰 Portfolio Editor API

Similarly structured under `/api/project` (not fully shown here but implemented the same way as `blogRouter`).

Supports:

* Project creation and editing
* Image/video uploads
* GitHub link support
* Hashtag management

---

## 📸 Instagram Content Scraper API

Endpoints under `/api/instagram` handle:

* **Login to Instagram** using Puppeteer automation
* **Scraping post media** (image/video) from a given profile
* **Saving scraped metadata** to DB

> ⚠️ **Environment Warning:**
> This automation setup is optimized for **local development only**.
> For cloud/VPS deployments, you must acquire **safe and trusted proxies**.
> Otherwise, Instagram will likely block or CAPTCHA your automated requests.

### Features:

* Loads Instagram profile
* Bypasses detection using stealth plugin
* Saves media URLs and metadata to database

---

## 🔐 Environment Configuration (Sensitive Keys Redacted)

The following `.env` keys are used in the system:

| Key                                                       | Purpose                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `IG_USERNAME`, `IG_PASSWORD`, `IG_PROFILE`                | Instagram automation credentials and target profile       |
| `CLIENT_URL`, `SERVER_URL`                                | UI and backend base URLs                                  |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | MySQL database connection settings                        |
| `PORT`, `NODE_ENV`                                        | Server runtime configuration                              |
| `CLOUDINARY_*`                                            | Cloudinary credentials for media uploads                  |
| `TWOCAPTCHA_API_KEY`                                      | CAPTCHA solving key for Instagram login (v2/v3 reCAPTCHA) |
| `PROXY_URL`, `PROXY_USERNAME`, `PROXY_PASSWORD`           | Authenticated proxy credentials for Puppeteer scraping    |

---

## 🛠️ Tech Stack

* **Backend**: Node.js + Express.js
* **Frontend**: React (see linked UI repo)
* **Database**: MySQL (via `mysql2` or similar driver)
* **Storage**: Cloudinary (for blog/project media)
* **Automation**: Puppeteer (with stealth and 2Captcha plugins)

---

## 🚀 Deployment Tips

* Use **SSH authentication** for GitHub push from VPS
* For Puppeteer scraping on VPS:

  * Use Chromium binary (`/usr/bin/chromium-browser`)
  * Use residential proxy via `--proxy-server`
  * Disable sandbox: `--no-sandbox`, `--disable-setuid-sandbox`
* Add reverse proxy (e.g., Nginx) if serving to public

---

## 📎 Final Notes

This project is modular and scalable. You can extend the API to:

* Track Instagram stories or highlights
* Add Markdown or Tiptap support to the editor
* Add user authentication for secure panel access

> Contact [Explorer-Person](https://github.com/Explorer-Person) for project collaboration or enhancements.
