# Call Time

For days when one appointment takes over the whole day. You type in where you need to be, when, how long the
trip takes and what you need to do to get ready. Call Time works backwards once and shows one big number:
**how much free time you have left.** No more redoing the math in your head.

Live: https://www.davyrockett.com/call-time/

## Using it

- **+ Add a plan**: where you need to be, the day, "Be there at", travel time, and your getting-ready
  routines (tap to add; change the minutes for this plan if you like; "+ Other" for a one-off).
- The main screen shows the next plan:
  - before you need to start: **free time left** and "Free until 10:45 AM";
  - while getting ready: the step you should be on and when to leave;
  - after the leave time: "Time to leave" / "On your way".
  - Below: the whole timeline, with where you are now highlighted.
- **Set alarms** puts alarms in the Clock app, so they ring even when Call Time is closed: one when your free
  time is almost over (Settings > Alarm heads-up, 10 minutes unless you change it), one when it's time to start
  getting ready, and one when it's time to leave. Shortcuts opens for a moment to set them.
  - It needs a shortcut called **Call Time Alarms**, made once on your iPhone. The steps are in Settings >
    Alarms setup, with a **Send a test alarm** button to check it.
  - Clock alarms have no date, so you can set them from 24 hours before you leave.
  - If you change the times, set alarms again and turn off the old ones in Clock.
- Other plans are listed under **Coming up**. Tap one to edit or delete it. A plan disappears once its time
  has passed.
- **Settings**: your routines (name and minutes), alarms setup, alarm heads-up, appearance, share link, check for updates.

The countdown changes once a minute, never every second: a ticking clock is what we're getting away from.
There is no automatic cushion: if you want spare time, set "Be there at" a bit earlier.

Everything is saved on the device only (no syncing).

## Files

- `index.html` page; `styles.css` look; `app.js` everything the app does.
- `sw.js` offline copy (bump `VERSION` with `tools/bump.sh` on every change).
- `move.js`, `suite.js`, `share.js` shared with David's other apps.
- `tools/make-icons.py` draws the icons. `Start Call Time.command` runs it on the Mac (port 8783).
