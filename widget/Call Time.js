// Variables used by Scriptable.
// These must be at the top of the file. Do not edit.
// icon-color: deep-orange; icon-glyph: clock;

/* Call Time widget for the iPhone (Scriptable app). Shows the free time left before the next plan in Call Time
   (www.davyrockett.com/call-time/), the same sums as the app: be there − travel = leave; leave − getting-ready steps
   = free until.
   - Plans come from the private davyrockett/call-time-data repo (plans.json), which Call Time saves to.
   - The access key arrives once from Call Time > Settings > "Connect the widget" (it opens this script with ?key=…)
     and is kept in the iPhone's Keychain. The last plans fetched are kept for when there's no internet.
   - Sizes: small and medium Home Screen widgets, and Lock Screen (rectangular, inline, circular).
   Master copy: call-time/widget/Call Time.js in the call-time repo. Copied into Scriptable's iCloud Drive folder. */

const URL_DATA = 'https://api.github.com/repos/davyrockett/call-time-data/contents/plans.json';
const APP_URL = 'https://www.davyrockett.com/call-time/';
const KEY_NAME = 'calltime-key';
const MIN = 60000;

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), 'calltime-plans.json');

// Colours from Call Time / the Apps screen, light and dark.
const BG = Color.dynamic(new Color('#FBF8F4'), new Color('#1E1B18'));
const INK = Color.dynamic(new Color('#1E1B18'), new Color('#F3EEE7'));
const GREY = Color.dynamic(new Color('#7A7068'), new Color('#A99F95'));
const ORANGE = Color.dynamic(new Color('#C4561F'), new Color('#F08A50'));

/* ---------- the access key ---------- */
const params = (args && args.queryParameters) || {};
if (params.key) {
  Keychain.set(KEY_NAME, params.key);
  const a = new Alert();
  a.title = 'Widget connected';
  a.message = 'Now add a Scriptable widget to your Home Screen or Lock Screen, tap it while editing, and choose "Call Time" as the Script.';
  a.addAction('OK');
  await a.present();
}
const key = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : '';

/* ---------- plans ---------- */
async function loadPlans() {
  if (key) {
    try {
      const req = new Request(URL_DATA);
      req.headers = { Authorization: `Bearer ${key}`, Accept: 'application/vnd.github.raw+json' };
      req.timeoutInterval = 15;
      const data = await req.loadJSON();
      if (req.response && req.response.statusCode === 200 && data && Array.isArray(data.plans)) {
        fm.writeString(CACHE, JSON.stringify(data));
        return { plans: data.plans, ok: true };
      }
    } catch (e) { /* offline: use the saved copy */ }
  }
  try { return { plans: JSON.parse(fm.readString(CACHE)).plans || [], ok: false }; } catch (e) { return { plans: null, ok: false }; }
}

function arriveDate(p) {
  const [y, mo, d] = p.day.split('-').map(Number), [h, mi] = p.time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}
function times(p) {
  const arrive = arriveDate(p);
  const leave = new Date(arrive - (Number(p.travel) || 0) * MIN);
  const steps = [];
  let t = leave;
  for (const s of [...(p.steps || [])].reverse()) {
    const start = new Date(t - s.min * MIN);
    steps.unshift({ name: s.name, start, end: t });
    t = start;
  }
  return { arrive, leave, free: t, steps };
}
const clock = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
function when(d, now) {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  if (days === 0) return clock(d);
  if (days === 1) return `tomorrow ${clock(d)}`;
  const df = new DateFormatter();
  df.dateFormat = days < 7 ? 'EEEE' : 'EEE, MMM d';
  return `${df.string(d)} ${clock(d)}`;
}
const span = (ms) => {
  const m = Math.max(0, Math.ceil(ms / MIN));
  if (m >= 1440) { const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h}h` : ''}`; }
  if (m >= 60) { const h = Math.floor(m / 60), r = m % 60; return `${h}h${r ? ` ${r}m` : ''}`; }
  return `${m}m`;
};

// What to show right now, and when the widget should look again.
function state(plans, now) {
  if (!plans) return { kind: 'none', title: key ? 'No connection' : 'Not connected', note: key ? 'Will try again soon' : 'Call Time › Settings › Connect the widget' };
  const list = plans.filter((p) => p && p.day && p.time && arriveDate(p) > now).sort((a, b) => arriveDate(a) - arriveDate(b));
  const p = list[0];
  const later = list.slice(1, 3).map((q) => ({ what: q.what, free: times(q).free, arrive: times(q).arrive }));
  if (!p) return { kind: 'none', title: 'All free', note: 'Nothing planned', later };
  const t = times(p);
  if (now < t.free) return { kind: 'free', p, t, later, next: t.free };
  if (now < t.leave) { const s = t.steps.find((x) => now < x.end); return { kind: 'ready', p, t, s, later, next: s.end }; }
  return { kind: 'leave', p, t, later, next: now - t.leave < 10 * MIN ? new Date(+t.leave + 10 * MIN) : t.arrive,
    title: now - t.leave < 10 * MIN ? 'Time to leave' : 'On your way' };
}

/* ---------- drawing ---------- */
function text(stack, s, font, color, lines = 1) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color; t.lineLimit = lines; t.minimumScaleFactor = 0.6;
  return t;
}
// The free time left, counting down on its own between refreshes ("3 hr, 15 min").
function countdown(stack, date, size, color) {
  const d = stack.addDate(date);
  d.applyRelativeStyle();
  d.font = Font.boldRoundedSystemFont(size); d.textColor = color; d.lineLimit = 1; d.minimumScaleFactor = 0.5;
  return d;
}
function kicker(stack, s) {
  return text(stack, s, Font.boldSystemFont(12), ORANGE);
}

function mainColumn(col, st, now, big) {
  if (st.kind === 'free') {
    kicker(col, 'Free time left');
    col.addSpacer(4);
    countdown(col, st.t.free, big, ORANGE);
    col.addSpacer(2);
    text(col, `until ${when(st.t.free, now)}`, Font.semiboldSystemFont(13), INK);
    col.addSpacer();
    text(col, `${st.p.what} · ${when(st.t.arrive, now)}`, Font.systemFont(12), GREY, 2);
  } else if (st.kind === 'ready') {
    kicker(col, `Now · ${span(st.s.end - now)} left`);
    col.addSpacer(4);
    text(col, st.s.name, Font.boldRoundedSystemFont(big - 6), INK, 2);
    col.addSpacer();
    text(col, `Leave at ${clock(st.t.leave)}`, Font.semiboldSystemFont(13), INK);
    text(col, st.p.what, Font.systemFont(12), GREY);
  } else if (st.kind === 'leave') {
    kicker(col, st.title);
    col.addSpacer(4);
    text(col, st.p.what, Font.boldRoundedSystemFont(big - 6), INK, 2);
    col.addSpacer();
    text(col, `Be there at ${clock(st.t.arrive)}`, Font.semiboldSystemFont(13), INK);
  } else {
    kicker(col, 'Call Time');
    col.addSpacer(4);
    text(col, st.title, Font.boldRoundedSystemFont(big - 4), INK, 2);
    col.addSpacer();
    text(col, st.note, Font.systemFont(12), GREY, 2);
  }
}

function homeWidget(st, now, family) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.url = APP_URL;
  w.setPadding(14, 14, 14, 14);
  if (family !== 'medium' || !(st.later && st.later.length)) {
    mainColumn(w, st, now, family === 'small' ? 26 : 30);
    return w;
  }
  const row = w.addStack();
  const left = row.addStack(); left.layoutVertically();
  mainColumn(left, st, now, 28);
  row.addSpacer(14);
  const right = row.addStack(); right.layoutVertically();
  kicker(right, 'Coming up');
  right.addSpacer(6);
  st.later.forEach((q) => {
    text(right, q.what, Font.semiboldSystemFont(13), INK);
    text(right, `free until ${when(q.free, now)}`, Font.systemFont(12), GREY);
    right.addSpacer(6);
  });
  right.addSpacer();
  return w;
}

function lockWidget(st, now, family) {
  const w = new ListWidget();
  w.url = APP_URL;
  if (family === 'accessoryInline') {
    w.addText(st.kind === 'free' ? `Free until ${clock(st.t.free)}` : st.kind === 'ready' ? `${st.s.name} · leave ${clock(st.t.leave)}`
      : st.kind === 'leave' ? `${st.title}: ${st.p.what}` : st.title);
    return w;
  }
  if (family === 'accessoryCircular') {
    w.addSpacer();
    const label = st.kind === 'free' ? 'FREE TILL' : st.kind === 'ready' ? 'LEAVE' : st.kind === 'leave' ? 'THERE' : 'FREE';
    const big = st.kind === 'free' ? clock(st.t.free) : st.kind === 'ready' ? clock(st.t.leave) : st.kind === 'leave' ? clock(st.t.arrive) : '∞';
    const a = w.addText(label); a.font = Font.boldSystemFont(8); a.centerAlignText();
    const b = w.addText(big.replace(/ (am|pm)$/, '')); b.font = Font.boldRoundedSystemFont(15); b.minimumScaleFactor = 0.5; b.centerAlignText();
    w.addSpacer();
    return w;
  }
  // accessoryRectangular
  const head = w.addText(st.kind === 'free' ? 'Free time left' : st.kind === 'ready' ? `Now · ${span(st.s.end - now)} left` : st.kind === 'leave' ? st.title : 'Call Time');
  head.font = Font.semiboldSystemFont(12);
  if (st.kind === 'free') {
    const d = w.addDate(st.t.free); d.applyRelativeStyle(); d.font = Font.boldRoundedSystemFont(18); d.minimumScaleFactor = 0.6;
    const u = w.addText(`until ${clock(st.t.free)} · ${st.p.what}`); u.font = Font.systemFont(12); u.minimumScaleFactor = 0.7;
  } else {
    const main = w.addText(st.kind === 'ready' ? st.s.name : st.kind === 'leave' ? st.p.what : st.title);
    main.font = Font.boldRoundedSystemFont(16); main.minimumScaleFactor = 0.6;
    const u = w.addText(st.kind === 'ready' ? `Leave at ${clock(st.t.leave)}` : st.kind === 'leave' ? `Be there at ${clock(st.t.arrive)}` : st.note);
    u.font = Font.systemFont(12); u.minimumScaleFactor = 0.7;
  }
  return w;
}

/* ---------- run ---------- */
const now = new Date();
const { plans, ok } = await loadPlans();
const st = state(plans, now);
const family = config.widgetFamily || 'small';
const widget = family.startsWith('accessory') ? lockWidget(st, now, family) : homeWidget(st, now, family);
// A tap opens Call Time in Safari, which keeps its own storage: hand it the key so it can load the plans too.
// After '#', so it never goes over the internet; Call Time saves it and wipes it from the address.
if (key) widget.url = `${APP_URL}#k=${encodeURIComponent(key)}`;
// Look again when the next part starts (iOS decides exactly when), and at least every 15 minutes for new plans.
const soon = new Date(+now + 15 * MIN);
widget.refreshAfterDate = st.next && st.next < soon ? new Date(+st.next + 30000) : soon;

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (!params.key) {
  // Run inside Scriptable: show a preview.
  if (!ok && key) console.log('Couldn\'t reach GitHub; showing the saved plans.');
  await widget.presentMedium();
}
Script.complete();
