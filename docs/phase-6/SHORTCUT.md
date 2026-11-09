# The "Log to Loot" shortcut (Phase 6 B2)

You build this once on your iPhone, share it as an iCloud link, and paste the link into **Admin → Content → Limits & rates → Shortcut link** (key `shortcut_url`). Everyone else then installs your shortcut from Settings → Spending and pastes their own capture key when it asks.

Needs iOS 17 or later (the **Transaction** automation). Deploy the `log-spend` edge function first (see SETUP.md).

## 1. Build the shortcut

1. Open **Shortcuts** → **Shortcuts** tab → **+** (top right). Name it **Log to Loot** (tap the name at the top).
2. Tap the **ⓘ** (Details) → turn on **Show in Share Sheet** off, leave the rest. Back.
3. Add these actions in order (search for each by name):

   1. **Text** — type `loot_cap_PASTE_YOUR_KEY`. Long-press the action → **Rename** → `Capture key`.
      *This is the value people replace when they install it (step 2 below).*
   2. **Get Contents of URL**
      - URL: `https://<project-ref>.supabase.co/functions/v1/log-spend`
      - Tap **Show More**: **Method** `POST`
      - **Headers** → Add new header: key `Authorization`, value `Bearer ` then insert the **Capture key** variable (tap the value field → choose *Capture key* from the variables bar).
      - Add another header: key `Content-Type`, value `application/json`.
      - **Request Body** `JSON`, add fields:
        - `amount` (Text) → insert the **Shortcut Input** variable, then tap it and choose **Amount**.
        - `merchant` (Text) → **Shortcut Input** → **Merchant**.
        - `at` (Text) → **Current Date** (tap it → Date Format **ISO 8601**, Include ISO 8601 Time **on**).
        - Do **not** add the card name — Loot never needs it.
   3. **Get Dictionary Value** → Get **Value** for **logged** in **Contents of URL**.
   4. **Show Notification** → title `Loot`, body: the **Dictionary Value** (it reads like "R 85 at Woolworths").

   When the automation runs it passes the Wallet transaction as the shortcut input; while you build it in the editor, Shortcuts may show *Shortcut Input* as "Transaction" — that's the same thing.

4. Set up the **import question** so each person pastes their own key: tap **ⓘ** → **Setup** (or *Import Questions*) → **Add Question** → choose the **Capture key** Text action → question text: *Paste your Loot capture key (Settings → Spending)*. Default answer: leave empty.
5. Tap **Done**.

## 2. Test it

1. In Loot (with `apple_pay_capture` on for you): Settings → Spending → **Create my capture key** → copy it.
2. In Shortcuts, edit **Log to Loot**, paste the key into the **Capture key** text, and run the shortcut by hand from the editor with a test input (or temporarily replace the Shortcut Input amount with `12.50` and merchant with `Test shop`).
3. You should see a notification "R 12.50 at Test shop" and the spend appears on **/spending** under *Auto* within a refresh. Delete it there.

## 3. Make it automatic (each person does this once)

1. Shortcuts → **Automation** → **+** → **Transaction**.
2. Pick the cards (all of them is fine) → **Run Immediately** (and turn **Notify When Run** off) → **Next**.
3. **New Blank Automation** → Add Action → **Run Shortcut** → choose **Log to Loot** → pass **Shortcut Input**. Done.

## 4. Share it

1. Put your own key back to `loot_cap_PASTE_YOUR_KEY` first (the import question replaces it for everyone else).
2. Long-press **Log to Loot** → **Share** → **Copy iCloud Link**. It looks like `https://www.icloud.com/shortcuts/…`.
3. Admin portal → **Content** → **Limits & rates** → **Shortcut link** → paste → Save draft → Publish (reason: "Shortcut published").

## What leaves the phone

Only the amount, the shop name and the time. The capture key is the person's own, shown once; Loot stores only its SHA-256. Turning capture off in Settings revokes the key instantly. 200 captures a day per person; the same shop + amount within two minutes counts once.
