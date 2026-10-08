#!/usr/bin/env python3
"""market-watch: pull public market and macro indicators into CSV history and render a report.

Standard library only, plus the system `pdftotext` for the FactSet weekly PDF.
Commands: run | fetch | report | status | manual add
Everything fetched is untrusted text: it is parsed with fixed patterns, never executed,
and third-party documents (PDFs) are not stored, only the numbers extracted from them.
"""
import argparse, csv, datetime as dt, html, io, json, os, re, shutil, subprocess, sys, tempfile
import urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("MW_ROOT") or Path(__file__).resolve().parents[4])
DATA = Path(os.environ.get("MW_DATA_DIR") or ROOT / "data" / "market-watch")
UA = "market-watch/0.1 (personal research; low frequency)"
MAX_BYTES = 40_000_000
OPTS = {"weeks": 3}
TODAY = dt.datetime.now(dt.timezone.utc).date()

TENORS = ["1M", "1.5M", "2M", "3M", "4M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]
TENOR_MAP = {"1 Mo": "1M", "1.5 Month": "1.5M", "2 Mo": "2M", "3 Mo": "3M", "4 Mo": "4M", "6 Mo": "6M",
             "1 Yr": "1Y", "2 Yr": "2Y", "3 Yr": "3Y", "5 Yr": "5Y", "7 Yr": "7Y", "10 Yr": "10Y",
             "20 Yr": "20Y", "30 Yr": "30Y"}


# --------------------------------------------------------------------------- http
class Blocked(Exception):
    """kind: 'network' (host not in the environment allowlist) or 'site' (site refuses automation)."""
    def __init__(self, kind, detail):
        super().__init__(detail); self.kind, self.detail = kind, detail


def http_get(url, timeout=60, limit=MAX_BYTES):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    last = None
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read(limit + 1)
                if len(body) > limit:
                    raise RuntimeError(f"response over {limit} bytes: {url}")
                return body, r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 418, 429):
                raise Blocked("site", f"HTTP {e.code} from {urllib.parse.urlparse(url).netloc}: site refuses automated access; not retried")
            last = e
        except urllib.error.URLError as e:
            msg = str(e.reason)
            if "Tunnel connection failed" in msg or "403" in msg and "Forbidden" in msg:
                raise Blocked("network", f"{urllib.parse.urlparse(url).netloc} is not in the environment's allowed domains")
            last = e
        except (TimeoutError, OSError) as e:
            last = e
    raise RuntimeError(f"{url}: {last}")


def text_of(url, **kw):
    body, _ = http_get(url, **kw)
    return body.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- csv store
def read_csv(name):
    p = DATA / name
    if not p.exists():
        return []
    with p.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def upsert(name, fields, rows, key):
    """Insert or replace rows by key; keep file sorted by key. Returns count of new keys."""
    DATA.mkdir(parents=True, exist_ok=True)
    cur = {tuple(r[k] for k in key): r for r in read_csv(name)}
    new = 0
    for r in rows:
        r = {k: ("" if r.get(k) is None else str(r[k]).replace("\n", " ").replace("\r", " ")) for k in fields}
        k = tuple(r[x] for x in key)
        new += k not in cur
        cur[k] = r
    tmp = DATA / (name + ".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n"); w.writeheader()
        for k in sorted(cur):
            w.writerow(cur[k])
    tmp.replace(DATA / name)
    return new


def num(x):
    try:
        return float(str(x).replace(",", ""))
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- sources
def src_yields():
    """US Treasury daily par yield curve (official CSV): current and previous year."""
    rows = []
    for y in (TODAY.year - 1, TODAY.year):
        url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"
               f"{y}/all?type=daily_treasury_yield_curve&field_tdr_date_value={y}&page&_format=csv")
        for r in csv.DictReader(io.StringIO(text_of(url))):
            d = dt.datetime.strptime(r["Date"], "%m/%d/%Y").date().isoformat()
            for col, v in r.items():
                if col != "Date" and num(v) is not None:
                    rows.append({"date": d, "tenor": TENOR_MAP.get(col, col), "yield_pct": v})
    if not rows:
        raise RuntimeError("no yield rows parsed")
    n = upsert("yields.csv", ["date", "tenor", "yield_pct"], rows, ["date", "tenor"])
    return n, f"latest {max(r['date'] for r in rows)}"


def src_nowcast():
    """Cleveland Fed inflation nowcast: the site's own chart data files (month, quarter, year)."""
    base = "https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_{}.json"
    rows, asof = [], None
    for horizon in ("month", "quarter", "year"):
        charts = json.loads(http_get(base.format(horizon), timeout=120, limit=60_000_000)[0])
        last = charts[-1]
        ch = last["chart"]
        asof = (ch.get("_comment") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", asof):
            raise RuntimeError("nowcast layout changed: no as-of date")
        for s in last["dataset"]:
            vals = [v.get("value") for v in s.get("data", []) if num(v.get("value")) is not None]
            if vals:
                rows.append({"asof": asof, "horizon": horizon, "period": ch.get("subcaption", ""),
                             "series": s["seriesname"], "value": f"{float(vals[-1]):.4f}"})
    if not any(r["series"] == "Core PCE Inflation" for r in rows):
        raise RuntimeError("nowcast layout changed: Core PCE series missing")
    n = upsert("nowcast.csv", ["asof", "horizon", "period", "series", "value"], rows, ["asof", "horizon", "series"])
    return n, f"as of {asof}"


FACTSET_PDF = ("https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/"
               "Earnings%20Insight/EarningsInsight_{}.pdf")


NUM = r"(-?\d[\d,]*(?:\.\d+)?)"


def P(pattern):
    """Build a regex where every § stands for one strict number (so a sentence-ending period is never part of it)."""
    return re.compile(pattern.replace("§", NUM))


def parse_factset(body, url):
    with tempfile.TemporaryDirectory() as td:
        pdf = Path(td) / "ei.pdf"; pdf.write_bytes(body)
        txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True, timeout=60, check=True).stdout
    t = re.sub(r"\s+", " ", txt)
    m = re.search(r"EARNINGS INSIGHT.*?((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d)", t)
    if not m:
        raise RuntimeError("report date not found")
    rdate = dt.datetime.strptime(m.group(1), "%B %d, %Y").date().isoformat()
    out = []
    def add(metric, value, unit):
        if value is not None:
            if num(value) is None:
                raise RuntimeError(f"unparseable value for {metric}: {value!r}")
            out.append({"report_date": rdate, "metric": metric, "value": str(value).replace(",", ""), "unit": unit, "source": url})
    g = lambda pat: (P(pat).search(t) or [None, None])
    pe = g(r"forward 12-month P/E ratio for the S&P 500 is §")[1]
    add("fwd_pe", pe, "x")
    add("fwd_pe_5y_avg", g(r"5-year average \(§\)")[1], "x")
    add("fwd_pe_10y_avg", g(r"10-year average \(§\)")[1], "x")
    m = P(r"For (Q[1-4] 20\d\d), the (estimated|blended) \(year-over-year\) earnings growth rate for the S&P 500 is §%").search(t)
    if m:  # 'blended' = actuals for companies that reported + estimates for the rest (earnings season)
        add(m.group(1).lower().replace(" ", "_") + "_earnings_growth" + ("_blended" if m.group(2) == "blended" else ""), m.group(3), "%")
    m = P(r"bottom-up target price for the S&P 500 is §.{0,80}?which is §% (above|below) the (?:\([A-Za-z]+\) )?closing price of §").search(t)
    if m:
        add("bottom_up_target_price", m.group(1), "pts")
        add("target_vs_close", ("-" if m.group(3) == "below" else "") + m.group(2), "%")
        add("index_close", m.group(4), "pts")
    for y, eg, rg in P(r"CY (20\d\d), analysts are projecting earnings growth of §% and revenue growth of §%").findall(t):
        add(f"cy{y}_earnings_growth", eg, "%"); add(f"cy{y}_revenue_growth", rg, "%")
    for y, _chg, eps in P(r"CY (20\d\d) bottom-up EPS estimate (?:increased|decreased) by § ?% \(to \$§ from").findall(t):
        add(f"cy{y}_bottom_up_eps", eps, "$")
    m = re.search(r"For (Q[1-4] 20\d\d),? (\d+) S&P 500 companies have issued negative EPS guidance and (\d+) S&P 500 companies have issued positive EPS guidance", t)
    if m:  # counts restart every quarter, so the quarter is part of the metric name
        q = m.group(1).lower().replace(" ", "_")
        add(f"{q}_guidance_negative", m.group(2), "n"); add(f"{q}_guidance_positive", m.group(3), "n")
    if pe is None:
        raise RuntimeError("PDF layout changed: forward P/E not found")
    return rdate, out


def src_factset():
    """FactSet Earnings Insight (weekly PDF): forward P/E, EPS growth, bottom-up EPS and target price.
    Looks back OPTS['weeks'] weeks (Thursday or Friday of each), so a missed run heals itself."""
    if not shutil.which("pdftotext"):
        raise RuntimeError("pdftotext not installed")
    weeks = OPTS["weeks"]
    rows, got, seen_weeks, misses = [], [], set(), 0
    for back in range(0, 7 * weeks + 8):
        d = TODAY - dt.timedelta(days=back)
        wk = d.isocalendar()[:2]
        if d.weekday() not in (3, 4) or wk in seen_weeks or len(seen_weeks) >= weeks:
            continue
        url = FACTSET_PDF.format(d.strftime("%m%d%y"))
        try:
            b, _ = http_get(url, limit=15_000_000)
        except RuntimeError:
            misses += 1; continue
        if b[:4] == b"%PDF":
            rdate, out = parse_factset(b, url)
            rows += out; got.append(rdate); seen_weeks.add(wk)
    if not rows:
        raise RuntimeError(f"no Earnings Insight PDF found in the last {weeks} week(s) (address pattern may have changed)")
    n = upsert("factset.csv", ["report_date", "metric", "value", "unit", "source"], rows, ["report_date", "metric"])
    return n, f"{len(got)} reports {min(got)}..{max(got)}; {len(rows)} metrics"


def src_bea():
    """BEA 'Principal Federal Economic Indicators' block on the home page (headline numbers only)."""
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text_of("https://www.bea.gov/"), flags=re.S)
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))
    pat = (r"View (Gross Domestic Product|Personal Income|International Trade in Goods and Services|International Transactions) "
           r"((?:Q[1-4] 20\d\d(?: \([A-Za-z0-9 ]+\))?)|(?:[A-Z][a-z]+ 20\d\d)) ([+\-]?\$?[\d.,]+ ?(?:%|B|M|T)?)")
    rows = [{"indicator": a, "period": b, "value": c.strip(), "fetched": TODAY.isoformat()} for a, b, c in re.findall(pat, t)]
    if not rows:
        raise RuntimeError("BEA home page layout changed: indicators block not found")
    n = upsert("bea.csv", ["indicator", "period", "value", "fetched"], rows, ["indicator", "period"])
    return n, f"{len(rows)} indicators"


FRED_SERIES = {"WALCL": "美联储总资产(周)", "NFCI": "芝加哥联储金融状况指数 NFCI(周)",
               "PCEPILFE": "核心PCE物价指数(月)", "A191RL1Q225SBEA": "实际GDP环比折年率 %(季)"}


FRED_EXTRA = ["EFFR", "VIXCLS", "BAMLH0A0HYM2", "SP500"]  # inputs to the derived sections, not shown in the FRED table


def src_fred():
    rows = []
    for sid in list(FRED_SERIES) + FRED_EXTRA:
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={TODAY.year - 3}-01-01"
        rd = csv.reader(io.StringIO(text_of(url)))
        hdr = next(rd)
        if len(hdr) < 2 or hdr[1].strip() != sid:
            raise RuntimeError(f"FRED layout changed for {sid}: header {hdr}")
        for r in rd:
            if len(r) >= 2 and num(r[1]) is not None:
                rows.append({"series": sid, "date": r[0], "value": r[1]})
    n = upsert("fred.csv", ["series", "date", "value"], rows, ["series", "date"])
    return n, f"{len(rows)} observations"


NEWS_RE = re.compile(r"\b(fed|federal reserve|fomc|powell|rate[- ](?:cut|hike|decision)s?|interest rates?|inflation|cpi|pce|"
                     r"payrolls?|jobs report|treasur(?:y|ies)|yields?|s&p 500|wall street|stocks?|earnings|profits?|guidance|bonds?)\b", re.I)
FEEDS = [
    ("Bloomberg", "https://feeds.bloomberg.com/markets/news.rss"),
    ("Reuters", "https://news.google.com/rss/search?q=" + urllib.parse.quote(
        'site:reuters.com ("federal reserve" OR inflation OR earnings OR "treasury yields" OR "S&P 500") when:7d') +
        "&hl=en-US&gl=US&ceid=US:en"),
    ("WSJ", "https://feeds.a.dowjones.io/rss/RSSMarketsMain"),
    ("CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135"),
]


def parse_rss(xml, outlet):
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml, re.S):
        def g(tag):
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", it, re.S)
            return html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))).strip() if m else ""
        title, link, pub = re.sub(r"\s+", " ", g("title")), g("link"), g("pubDate")
        if not title or not link.startswith(("http://", "https://")):
            continue
        try:
            iso = dt.datetime.strptime(pub[:25].strip(), "%a, %d %b %Y %H:%M:%S").isoformat() + "Z"
        except ValueError:
            iso = ""
        title = re.sub(r"\s+-\s+(Reuters|Bloomberg|The Wall Street Journal|WSJ|CNBC)\s*$", "", title)
        out.append({"outlet": outlet, "published": iso, "title": title, "url": link, "first_seen": TODAY.isoformat()})
    return out


def src_news():
    """Headlines and links only (no article text). Filtered to Fed / inflation / rates / earnings / equities."""
    rows, errs, ok = [], [], 0
    for outlet, url in FEEDS:
        try:
            rows += [r for r in parse_rss(text_of(url), outlet) if NEWS_RE.search(r["title"])]
            ok += 1
        except Blocked as e:
            errs.append(f"{outlet}: {e.detail}")
        except RuntimeError as e:
            errs.append(f"{outlet}: {e}")
    if not ok:
        raise Blocked("network", "; ".join(dict.fromkeys(errs)))
    n = upsert("news.csv", ["outlet", "published", "title", "url", "first_seen"], rows, ["url"])
    return n, (f"{ok}/{len(FEEDS)} feeds ok" + (" | " + "; ".join(dict.fromkeys(errs)) if errs else ""))


SOURCES = {"yields": src_yields, "nowcast": src_nowcast, "factset": src_factset,
           "bea": src_bea, "fred": src_fred, "news": src_news}

# Sources that are not fetched automatically: (state, reason). Shown in the report's status table.
NOT_AUTOMATED = {
    "S&P 500 EPS (spglobal xlsx)": ("取消", "站点对脚本返回 403，不绕过。FactSet 周报已提供前瞻 EPS、盈利增速和目标价，不再需要这张表"),
    "CME FedWatch": ("替代", "CME 条款禁止自动访问，不绕过。改用上方“国债隐含政策利率路径”（粗估，不是概率）；需要精确概率时可 `manual add`"),
    "CNN Fear & Greed": ("替代", "网站拒绝机器人(HTTP 418)，不绕过。改用上方“市场情绪综合”（自建，不是 CNN 指数）；想记录 CNN 的数可 `manual add`"),
    "hedgefollow": ("取消", "需要登录，没有公开数据。要对冲基金仓位，可改用 SEC 13F（需放行 www.sec.gov 并指定基金）"),
    "Yardeni forward P/E (PDF)": ("取消", "链接已失效(404)，旧图表集已归档到 2023 年底。前瞻 P/E 由 FactSet 提供"),
    "Manheim used vehicle index": ("待放行", "你给的 site.manheim.com 页面停在 2025-12，已不更新；现行数据发布在 www.coxautoinc.com，该域名未放行。放行后再写解析并实测"),
}


# --------------------------------------------------------------------------- status
def load_status():
    p = DATA / "status.json"
    return json.loads(p.read_text()) if p.exists() else {}


def run_sources(names):
    DATA.mkdir(parents=True, exist_ok=True)
    st = load_status()
    for name in names:
        t0 = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        try:
            n, note = SOURCES[name]()
            st[name] = {"status": "ok", "detail": note, "new_rows": n, "at": t0}
        except Blocked as e:
            st[name] = {"status": f"blocked-{e.kind}", "detail": e.detail, "at": t0, "new_rows": 0}
        except Exception as e:  # keep going: one bad source must not stop the rest
            st[name] = {"status": "failed", "detail": f"{type(e).__name__}: {e}"[:300], "at": t0, "new_rows": 0}
        print(f"  {name:<9} {st[name]['status']:<16} {st[name]['detail'][:150]}")
    (DATA / "status.json").write_text(json.dumps(st, indent=2, ensure_ascii=False) + "\n")
    return st


# --------------------------------------------------------------------------- report
LABELS = {"fwd_pe": "前瞻12个月 P/E", "fwd_pe_5y_avg": "  5年均值", "fwd_pe_10y_avg": "  10年均值",
          "bottom_up_target_price": "自下而上目标价(指数点)", "target_vs_close": "  目标价较收盘", "index_close": "  S&P 500 收盘(报告引用)"}


def label(metric):
    if metric in LABELS:
        return LABELS[metric]
    m = re.fullmatch(r"(q[1-4])_(20\d\d)_earnings_growth(_blended)?", metric)
    if m: return f"{m.group(1).upper()} {m.group(2)} 盈利增速(同比" + (",实际+预估混合)" if m.group(3) else ",预估)")
    m = re.fullmatch(r"(q[1-4])_(20\d\d)_guidance_(negative|positive)", metric)
    if m: return f"{m.group(1).upper()} {m.group(2)} " + ("负面" if m.group(3) == "negative" else "正面") + "EPS指引家数"
    m = re.fullmatch(r"cy(20\d\d)_(earnings_growth|revenue_growth|bottom_up_eps)", metric)
    if m:
        return f"CY{m.group(1)} " + {"earnings_growth": "盈利增速", "revenue_growth": "营收增速", "bottom_up_eps": "自下而上EPS($)"}[m.group(2)]
    return metric


def metric_order(m):
    fixed = ["fwd_pe", "fwd_pe_5y_avg", "fwd_pe_10y_avg", "bottom_up_target_price", "target_vs_close", "index_close"]
    if m in fixed: return (0, fixed.index(m), m)
    if re.match(r"q\d_", m): return (1, 0, m)
    if m.startswith("cy"): return (2, 0, m)
    return (3, 0, m)


def fmt_val(r):
    v, u = r["value"], r["unit"]
    if u == "pts": return f"{num(v):,.2f}"
    if u == "$": return f"${num(v):,.2f}"
    return v + ("" if u == "n" else u)


def md_cell(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def collect():
    D = {}
    fs = read_csv("factset.csv")
    dates = sorted({r["report_date"] for r in fs})
    D["fs_dates"] = dates
    D["fs"] = {d: {r["metric"]: r for r in fs if r["report_date"] == d} for d in dates[-2:]}
    ys = {}
    for r in read_csv("yields.csv"):
        ys.setdefault(r["date"], {})[r["tenor"]] = num(r["yield_pct"])
    D["yields"] = ys
    nc = read_csv("nowcast.csv")
    D["nowcast_asof"] = max((r["asof"] for r in nc), default=None)
    D["nowcast"] = {(r["horizon"], r["series"]): (num(r["value"]), r["period"]) for r in nc if r["asof"] == D["nowcast_asof"]}
    D["bea"] = read_csv("bea.csv")
    fred = {}
    for r in read_csv("fred.csv"):
        fred.setdefault(r["series"], []).append((r["date"], num(r["value"])))
    D["fred"] = {k: sorted(v) for k, v in fred.items()}
    D["manual"] = read_csv("manual.csv")
    cutoff = (TODAY - dt.timedelta(days=7)).isoformat()
    D["news"] = sorted([r for r in read_csv("news.csv") if (r["published"] or r["first_seen"]) >= cutoff],
                       key=lambda r: r["published"], reverse=True)
    D["status"] = load_status()
    return D


def yield_tables(ys):
    if not ys: return None
    days = sorted(ys)
    last = days[-1]
    def at(n): return ys[days[max(0, len(days) - 1 - n)]]
    refs = {"1周前": at(5), "1月前": at(21), "年初": ys[next(d for d in days if d.startswith(last[:4]))]}
    cur = ys[last]
    rows = []
    for t in TENORS:
        if cur.get(t) is None: continue
        ch = {k: (None if v.get(t) is None else round((cur[t] - v[t]) * 100)) for k, v in refs.items()}
        rows.append((t, cur[t], ch))
    sp = lambda a, b: None if cur.get(a) is None or cur.get(b) is None else round((cur[a] - cur[b]) * 100)
    return last, rows, {"10Y-2Y": sp("10Y", "2Y"), "10Y-3M": sp("10Y", "3M")}, days


def pct_rank(vals, x):
    return 100.0 * sum(1 for v in vals if v <= x) / len(vals)


def at_or_before(series, d):
    """Last value with date <= d from a date-sorted list of (date, value)."""
    import bisect
    i = bisect.bisect_right([x[0] for x in series], d)
    return series[i - 1][1] if i else None


def sentiment_series(fred, n=40):
    """Self-built 0-100 sentiment composite (NOT the CNN index). Four parts, each a percentile over the trailing
    252 trading days, 100 = greed: low VIX, tight high-yield spread, S&P 500 above its 125-day average,
    S&P 500 close to its 252-day high. Returns [(date, score, parts)] for the last n trading days."""
    sp, vix, hy = fred.get("SP500"), fred.get("VIXCLS"), fred.get("BAMLH0A0HYM2")
    if not (sp and vix and hy) or len(sp) < 560:
        return []
    px = [v for _, v in sp]
    ma = [None] * len(px); hi = [None] * len(px)
    for j in range(len(px)):
        if j >= 124: ma[j] = sum(px[j - 124:j + 1]) / 125
        if j >= 251: hi[j] = max(px[j - 251:j + 1])
    out = []
    for i in range(len(px) - n, len(px)):
        d = sp[i][0]
        mom_h = [px[j] / ma[j] - 1 for j in range(i - 251, i + 1) if ma[j]]
        str_h = [px[j] / hi[j] for j in range(i - 251, i + 1) if hi[j]]
        vix_h = [v for dd, v in vix if dd <= d][-252:]; hy_h = [v for dd, v in hy if dd <= d][-252:]
        if len(mom_h) < 200 or len(str_h) < 200 or len(vix_h) < 200 or len(hy_h) < 200:
            continue
        parts = {"动量(标普/125日均线)": pct_rank(mom_h, mom_h[-1]), "价格强度(距52周高点)": pct_rank(str_h, str_h[-1]),
                 "波动率(VIX,反向)": 100 - pct_rank(vix_h, vix_h[-1]), "信用利差(高收益债,反向)": 100 - pct_rank(hy_h, hy_h[-1])}
        out.append((d, sum(parts.values()) / 4, parts))
    return out


def sentiment_label(x):
    return "极度恐惧" if x < 25 else "恐惧" if x < 45 else "中性" if x < 55 else "贪婪" if x < 75 else "极度贪婪"


def build_md(D, commentary):
    L = [f"# Market Watch — {TODAY.isoformat()}", "",
         "> 数据来自公开来源，仅描述指标变化，不构成投资建议。每个数字都可在对应来源核实。", ""]
    if commentary:
        L += ["## 解读", "", commentary.strip(), ""]
    # valuation
    L += ["## 盈利与估值（FactSet Earnings Insight，周更）", ""]
    ds = D["fs_dates"]
    if ds:
        cur = D["fs"][ds[-1]]; prev = D["fs"].get(ds[-2]) if len(ds) > 1 else None
        L += [f"报告日期 {ds[-1]}" + (f"，对比 {ds[-2]}" if prev else "（暂无上期可比）"), "", "| 指标 | 本期 | 变化 |", "|---|---|---|"]
        for m, r in sorted(cur.items(), key=lambda kv: metric_order(kv[0])):
            ch = ""
            if prev and m in prev and num(r["value"]) is not None and num(prev[m]["value"]) is not None:
                ch = f"{num(r['value']) - num(prev[m]['value']):+,.2f}"
            L.append(f"| {md_cell(label(m))} | {fmt_val(r)} | {ch} |")
        L.append(f"\n来源: {md_cell(next(iter(cur.values()))['source'])}")
    else:
        L.append("暂无数据（见文末数据源状态）。")
    # yields
    L += ["", "## 美债收益率曲线（财政部官方）", ""]
    yt = yield_tables(D["yields"])
    if yt:
        last, rows, spreads, _ = yt
        L += [f"截至 {last}。变化单位 bp。", "", "| 期限 | 收益率% | 较1周前 | 较1月前 | 较年初 |", "|---|---|---|---|---|"]
        for t, v, ch in rows:
            L.append(f"| {t} | {v:.2f} | {ch['1周前']:+d} | {ch['1月前']:+d} | {ch['年初']:+d} |" if None not in ch.values() else f"| {t} | {v:.2f} | | | |")
        L.append("")
        L.append("利差(bp): " + "，".join(f"{k} = {v:+d}" + ("（倒挂）" if v is not None and v < 0 else "") for k, v in spreads.items() if v is not None))
    else:
        L.append("暂无数据。")
    # policy path implied by bills (derived from official data)
    L += ["", "## 国债隐含的政策利率路径（粗估，不是 FedWatch 概率）", ""]
    effr = D["fred"].get("EFFR"); ycur = D["yields"].get(yt[0]) if yt else None
    if effr and ycur:
        e = effr[-1][1]; g = lambda t: ycur.get(t)
        L += [f"有效联邦基金利率 EFFR {e:.2f}%（{effr[-1][0]}）。收益率为财政部 {yt[0]} 数据。", "",
              "| 项目 | 利率% | 较 EFFR (bp) |", "|---|---|---|"]
        for t in ("1M", "3M", "6M", "1Y", "2Y"):
            if g(t) is not None: L.append(f"| {t} 国债收益率 | {g(t):.2f} | {round((g(t) - e) * 100):+d} |")
        fw = [("3个月后起的3个月远期", 2 * g("6M") - g("3M") if g("6M") and g("3M") else None),
              ("6个月后起的6个月远期", 2 * g("1Y") - g("6M") if g("1Y") and g("6M") else None),
              ("1年后起的1年远期", 2 * g("2Y") - g("1Y") if g("2Y") and g("1Y") else None)]
        for nm, v in fw:
            if v is not None: L.append(f"| {nm}（隐含） | {v:.2f} | {round((v - e) * 100):+d} |")
        L += ["", "说明：由国债收益率按简单利率推算的远期利率，与 EFFR 的差为正，表示市场定价的政策利率高于当前。短端（1M、3M）较 EFFR 的正差有相当部分来自国债票据相对 OIS 的价差，不代表马上加息；看远期曲线的形状和变化比看绝对差更有意义。这些数含期限溢价，不是概率，也不能当作 FedWatch 的精确替代。"]
    else:
        L.append("暂无数据（需要 FRED 的 EFFR 和财政部收益率）。")
    # self-built sentiment
    L += ["", "## 市场情绪综合（自建，不是 CNN 恐惧贪婪指数）", ""]
    ss = sentiment_series(D["fred"])
    if ss:
        d0, v0, p0 = ss[-1]
        prev = lambda k: ss[max(0, len(ss) - 1 - k)]
        L += [f"截至 {d0}：**{v0:.0f} / 100（{sentiment_label(v0)}）**。1周前 {prev(5)[1]:.0f}，约1个月前 {prev(21)[1]:.0f}。", "",
              "| 分项 | 分位得分 (100=贪婪) |", "|---|---|"] + [f"| {k} | {v:.0f} |" for k, v in p0.items()] + [
              "", "方法：4 个公开指标（FRED：标普500、VIX、ICE BofA 高收益债利差）各自对过去 252 个交易日取百分位，等权平均。"
              "不含看跌/看涨期权比、市场广度、避险需求，数值不会与 CNN 的指数一致，只看方向和相对位置。"]
    else:
        L.append("暂无数据（需要 FRED 的 SP500、VIXCLS、BAMLH0A0HYM2，且至少约 560 个交易日）。")
    # nowcast
    L += ["", "## 通胀 Nowcast（克利夫兰联储，每个工作日更新）", ""]
    if D["nowcast"]:
        L += [f"截至 {D['nowcast_asof']}。月度=当月环比，季度=当季年化环比，年度=同比。", "",
              "| 指标 | 月度环比% | 季度年化% | 同比% |", "|---|---|---|---|"]
        for s in ("CPI Inflation", "Core CPI Inflation", "PCE Inflation", "Core PCE Inflation"):
            v = lambda h: ("" if (h, s) not in D["nowcast"] else f"{D['nowcast'][(h, s)][0]:.2f}")
            L.append(f"| {s.replace(' Inflation', '')} | {v('month')} | {v('quarter')} | {v('year')} |")
        per = {h: D["nowcast"][(h, "CPI Inflation")][1] for h in ("month", "quarter", "year") if (h, "CPI Inflation") in D["nowcast"]}
        L.append("\n对应期间: " + " · ".join(f"{k} {v}" for k, v in zip(("月度", "季度", "同比"), (per.get("month"), per.get("quarter"), per.get("year"))) if v))
    else:
        L.append("暂无数据。")
    # macro
    L += ["", "## 宏观（BEA 首页头条指标 / FRED）", ""]
    if D["bea"]:
        L += ["| BEA 指标 | 期间 | 数值 |", "|---|---|---|"] + [f"| {md_cell(r['indicator'])} | {md_cell(r['period'])} | {md_cell(r['value'])} |" for r in D["bea"][-6:]]
        L.append("")
    if D["fred"]:
        L += ["| FRED 序列 | 最新日期 | 最新值 | 较上一期 |", "|---|---|---|---|"]
        for sid, desc in FRED_SERIES.items():
            ob = D["fred"].get(sid)
            if ob:
                d, v = ob[-1]; pv = ob[-2][1] if len(ob) > 1 else None
                shown = f"{v/1e6:.3f} 万亿美元" if sid == "WALCL" else f"{v:.3f}"
                if pv is None: chg = ""
                elif sid == "WALCL": chg = f"{(v - pv) / 100:+.1f} 亿美元"
                else: chg = f"{v - pv:+.3f}"
                L.append(f"| {md_cell(desc)} | {d} | {shown} | {chg} |")
        cp = D["fred"].get("PCEPILFE")
        if cp and len(cp) > 12 and cp[-13][1]:
            L.append(f"\n核心 PCE 物价同比: {(cp[-1][1] / cp[-13][1] - 1) * 100:.2f}%（{cp[-1][0]}）")
    elif not D["bea"]:
        L.append("暂无数据。")
    else:
        L.append("FRED 暂无数据（见数据源状态）。")
    # manual
    L += ["", "## 手动录入指标", ""]
    latest = {}
    for r in D["manual"]:
        if r["indicator"] not in latest or r["date"] >= latest[r["indicator"]]["date"]:
            latest[r["indicator"]] = r
    if latest:
        L += ["| 指标 | 日期 | 数值 | 备注 |", "|---|---|---|---|"]
        for k, r in sorted(latest.items()):
            age = (TODAY - dt.date.fromisoformat(r["date"])).days
            L.append(f"| {md_cell(k)} | {r['date']}{'（已过期）' if age > 10 else ''} | {md_cell(r['value'])} | {md_cell(r['note'])} |")
    else:
        L.append("暂无。CNN 恐惧贪婪、CME FedWatch、S&P 500 EPS 需要手动录入（`mw.py manual add`）。")
    # news
    L += ["", "## 新闻标题（近7天，仅标题与链接）", ""]
    if D["news"]:
        for outlet in ("Reuters", "Bloomberg", "WSJ", "CNBC"):
            items = [r for r in D["news"] if r["outlet"] == outlet][:8]
            if items:
                L += [f"**{outlet}**", ""] + [f"- {md_cell(r['title'])} — [{(r['published'] or r['first_seen'])[:10]}]({r['url']})" for r in items] + [""]
    else:
        L.append("暂无新闻数据。")
    # status
    L += ["## 数据源状态", "", "| 源 | 状态 | 说明 |", "|---|---|---|"]
    for k, v in D["status"].items():
        L.append(f"| {k} | {v['status']} | {md_cell(v['detail'])[:300]} （{v['at'][:16]}Z） |")
    for k, why in NOT_AUTOMATED.items():
        L.append(f"| {md_cell(k)} | {why[0]} | {md_cell(why[1])} |")
    return "\n".join(L) + "\n"


CSS = """:root{--bg:#fafaf7;--fg:#1b1d21;--muted:#6b7078;--line:#d9dbe0;--card:#fff;--c1:#c2410c;--c2:#2563eb;--c3:#8a919c;--bad:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#14161a;--fg:#e8e9ec;--muted:#9aa0aa;--line:#2b2f36;--card:#1b1e24;--c1:#fb923c;--c2:#60a5fa;--c3:#7b8494;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,"Segoe UI","PingFang SC","Noto Sans SC",sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}
.sub{color:var(--muted);font-size:13px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 12px}.tile b{display:block;font-size:20px}.tile span{color:var(--muted);font-size:12px}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);font-size:13px}th,td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--muted);font-weight:600}.wrap{overflow-x:auto;margin-bottom:12px}.neg{color:var(--bad)}svg{width:100%;height:auto;background:var(--card);border:1px solid var(--line);border-radius:6px}
li{margin:3px 0}a{color:var(--c2)}.note{color:var(--muted);font-size:12px}"""


def svg_curve(ys, days):
    last = days[-1]
    picks = [(last, "c1", "最新"), (days[max(0, len(days) - 22)], "c2", "约1月前"), (days[max(0, len(days) - 253)], "c3", "约1年前")]
    W, H, pl, pr, pt, pb = 760, 280, 44, 16, 16, 40
    ts = [t for t in TENORS if ys[last].get(t) is not None]
    vals = [ys[d][t] for d, _, _ in picks for t in ts if ys[d].get(t) is not None]
    lo, hi = min(vals) - 0.2, max(vals) + 0.2
    X = lambda i: pl + i * (W - pl - pr) / max(1, len(ts) - 1)
    Y = lambda v: pt + (hi - v) * (H - pt - pb) / (hi - lo)
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="yc-t yc-d"><title id="yc-t">美债收益率曲线</title><desc id="yc-d">最新、约一月前、约一年前三条收益率曲线</desc>']
    for k in range(5):
        v = lo + (hi - lo) * k / 4
        s.append(f'<line x1="{pl}" x2="{W-pr}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="var(--line)"/><text x="{pl-6}" y="{Y(v)+4:.1f}" font-size="11" text-anchor="end" fill="var(--muted)">{v:.1f}</text>')
    for i, t in enumerate(ts):
        s.append(f'<text x="{X(i):.1f}" y="{H-pb+16}" font-size="11" text-anchor="middle" fill="var(--muted)">{t}</text>')
    for j, (d, c, nm) in enumerate(picks):
        pts = " ".join(f"{X(i):.1f},{Y(ys[d][t]):.1f}" for i, t in enumerate(ts) if ys[d].get(t) is not None)
        dash = "" if j == 0 else ' stroke-dasharray="5 4"'
        s.append(f'<polyline points="{pts}" fill="none" stroke="var(--{c})" stroke-width="{2.4 if j == 0 else 1.6}"{dash}/>')
        s.append(f'<text x="{pl + 8 + j * 210}" y="{H-8}" font-size="12" fill="var(--{c})">— {nm} {d}</text>')
    return "".join(s) + "</svg>"


def build_html(D, commentary):
    e = html.escape
    tiles = []
    ds = D["fs_dates"]
    if ds and "fwd_pe" in D["fs"][ds[-1]]:
        pe = D["fs"][ds[-1]]["fwd_pe"]["value"]; a = D["fs"][ds[-1]].get("fwd_pe_10y_avg", {}).get("value")
        tiles.append(("S&P 500 前瞻 P/E", f"{pe}x", f"10年均值 {a}x · {ds[-1]}" if a else ds[-1]))
    yt = yield_tables(D["yields"])
    if yt:
        last, rows, sp, days = yt; d = {t: v for t, v, _ in rows}
        if "10Y" in d: tiles.append(("10年期美债", f"{d['10Y']:.2f}%", last))
        if sp["10Y-2Y"] is not None: tiles.append(("10Y-2Y 利差", f"{sp['10Y-2Y']:+d} bp", "倒挂" if sp["10Y-2Y"] < 0 else "正常"))
    if ("year", "Core PCE Inflation") in D["nowcast"]:
        tiles.append(("核心PCE同比 nowcast", f"{D['nowcast'][('year', 'Core PCE Inflation')][0]:.2f}%", f"克利夫兰联储 {D['nowcast_asof']}"))
    ss = sentiment_series(D["fred"])
    if ss: tiles.append(("情绪综合(自建)", f"{ss[-1][1]:.0f} · {sentiment_label(ss[-1][1])}", f"非 CNN 指数 · {ss[-1][0]}"))
    w = D["fred"].get("WALCL")
    if w: tiles.append(("美联储总资产", f"{w[-1][1]/1e6:.2f} 万亿$", w[-1][0]))
    n = D["fred"].get("NFCI")
    if n: tiles.append(("芝加哥联储 NFCI", f"{n[-1][1]:.3f}", n[-1][0]))
    h = [f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Market Watch</title><style>{CSS}</style></head><body><main>',
         f'<h1>Market Watch</h1><div class="sub">{TODAY.isoformat()} · 公开数据，仅描述指标，不构成投资建议</div>']
    h.append('<div class="tiles">' + "".join(f'<div class="tile"><span>{e(a)}</span><b>{e(b)}</b><span>{e(c)}</span></div>' for a, b, c in tiles) + "</div>")
    if commentary:
        h.append("<h2>解读</h2>" + "".join(f"<p>{e(p)}</p>" for p in commentary.strip().split("\n\n")))
    if yt:
        h.append("<h2>收益率曲线图</h2>" + svg_curve(D["yields"], yt[3]))
    # reuse the markdown tables as simple HTML
    md = build_md(D, None)
    for sec in re.split(r"\n(?=## )", md)[1:]:
        title, _, body = sec.partition("\n")
        if title.strip("# ") in ("解读",): continue
        h.append(f"<h2>{e(title.strip('# '))}</h2>")
        lines = body.strip().split("\n"); i = 0
        while i < len(lines):
            if lines[i].startswith("|"):
                tb = []
                while i < len(lines) and lines[i].startswith("|"): tb.append(lines[i]); i += 1
                cells = lambda ln: [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", ln.strip().strip("|"))]
                head, rest = cells(tb[0]), [cells(x) for x in tb[2:]]
                h.append('<div class="wrap"><table><tr>' + "".join(f"<th>{e(c)}</th>" for c in head) + "</tr>" +
                         "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in rest) + "</table></div>")
            else:
                ln = lines[i]; i += 1
                if not ln.strip(): continue
                if ln.startswith("- "):
                    m = re.fullmatch(r"- (.*) — \[(.*?)\]\((https?://[^)]+)\)", ln)
                    h.append(f'<li>{e(m.group(1))} <span class="note">{e(m.group(2))}</span> <a href="{e(m.group(3), quote=True)}" rel="noopener noreferrer">链接</a></li>' if m else f"<li>{e(ln[2:])}</li>")
                else:
                    h.append(f'<p class="note">{e(re.sub(r"[*>]", "", ln))}</p>')
    h.append("</main></body></html>")
    return "".join(h)


def cmd_report(args):
    D = collect()
    com = Path(args.commentary).read_text(encoding="utf-8") if args.commentary else None
    rd = DATA / "reports"; rd.mkdir(parents=True, exist_ok=True)
    md = build_md(D, com)
    (rd / f"{TODAY.isoformat()}.md").write_text(md, encoding="utf-8")
    (DATA / "latest.html").write_text(build_html(D, com), encoding="utf-8")
    print(f"wrote {rd / (TODAY.isoformat() + '.md')} and {DATA / 'latest.html'}")


def cmd_digest(args):
    """Headlines first seen today (or --date), grouped by outlet. Deterministic: no commentary."""
    day = args.date or TODAY.isoformat()
    rows = [r for r in read_csv("news.csv") if r["first_seen"] == day]
    L = [f"# 新闻标题摘要 — {day}", "", "> 仅标题与链接，来自公开 RSS；按美联储、通胀、利率、财报、股市关键词筛选。", ""]
    for outlet in ("Reuters", "Bloomberg", "WSJ", "CNBC"):
        items = sorted([r for r in rows if r["outlet"] == outlet], key=lambda r: r["published"], reverse=True)
        if items:
            L += [f"## {outlet}（{len(items)}）", ""] + [f"- {md_cell(r['title'])} — [{(r['published'] or day)[:16].replace('T', ' ')}Z]({r['url']})" for r in items] + [""]
    st = load_status().get("news")
    if st:
        L += ["## 状态", "", f"{st['status']}: {md_cell(st['detail'])}（{st['at'][:16]}Z）", ""]
    if not rows:
        L.insert(3, "今天没有新增的相关标题。")
    d = DATA / "news"; d.mkdir(parents=True, exist_ok=True)
    (d / f"{day}.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {d / (day + '.md')} ({len(rows)} headlines)")


def cmd_manual_add(args):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
        sys.exit("--date must be YYYY-MM-DD")
    upsert("manual.csv", ["date", "indicator", "value", "note"],
           [{"date": args.date, "indicator": args.indicator, "value": args.value, "note": args.note or ""}], ["date", "indicator"])
    print("saved")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("run", "fetch"):
        p = sub.add_parser(name); p.add_argument("--only", help=f"comma list of: {','.join(SOURCES)}"); p.add_argument("--commentary")
        p.add_argument("--weeks", type=int, default=3, help="FactSet look-back in weeks (use 12+ to backfill history)")
    sub.add_parser("status")
    dg = sub.add_parser("digest"); dg.add_argument("--date")
    r = sub.add_parser("report"); r.add_argument("--commentary")
    m = sub.add_parser("manual"); ms = m.add_subparsers(dest="sub", required=True)
    a = ms.add_parser("add"); a.add_argument("--indicator", required=True); a.add_argument("--value", required=True)
    a.add_argument("--date", default=TODAY.isoformat()); a.add_argument("--note")
    args = ap.parse_args()
    if args.cmd in ("run", "fetch"):
        OPTS["weeks"] = max(1, min(args.weeks, 60))
        names = args.only.split(",") if args.only else list(SOURCES)
        bad = [n for n in names if n not in SOURCES]
        if bad: sys.exit(f"unknown source(s): {bad}")
        run_sources(names)
        if args.cmd == "run": cmd_report(args)
    elif args.cmd == "report": cmd_report(args)
    elif args.cmd == "digest": cmd_digest(args)
    elif args.cmd == "status":
        for k, v in load_status().items(): print(f"{k:<9} {v['status']:<16} {v['at']}  {v['detail']}")
        for k, (state, why) in NOT_AUTOMATED.items(): print(f"{k:<28} {state}: {why}")
    elif args.cmd == "manual": cmd_manual_add(args)


if __name__ == "__main__":
    main()
