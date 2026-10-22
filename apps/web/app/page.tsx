"use client";
import { festivalDate, festivalInput } from "../../../packages/contracts";
import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Users,
  Package,
  MapPin,
  AlertTriangle,
  ScanLine,
  History,
  ArrowUpRight,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Settings,
  LogOut,
  Radio,
  ArrowRight,
  X,
  Clock,
  Check,
  MoreHorizontal,
  Smartphone,
  Download,
  Music2,
  Flag,
  LoaderCircle,
  Star,
  Ticket,
  RefreshCw,
} from "lucide-react";
type Row = Record<string, any>;
type Data = {
  user: Row;
  festival: Row;
  stages: Row[];
  performances: Row[];
  tasks?: Row[];
  crew?: Row[];
  equipment?: Row[];
  reservations?: Row[];
  shifts?: Row[];
  incidents?: Row[];
  audit?: Row[];
  tickets: Row[];
  favorites: string[];
};
const nav = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["schedule", "Sahne programı", CalendarDays],
  ["tasks", "Görevler", CheckSquare],
  ["crew", "Ekip & vardiyalar", Users],
  ["equipment", "Ekipman", Package],
  ["map", "Alan planı", MapPin],
  ["incidents", "Olay kayıtları", AlertTriangle],
  ["entry", "Giriş kontrolü", ScanLine],
  ["activity", "İşlem geçmişi", History],
] as const;
const time = (s: string) =>
  new Date(s).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
const initials = (s: string) =>
  s
    .split(" ")
    .map((v) => v[0])
    .slice(0, 2)
    .join("");
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const d = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(d.message || "İşlem tamamlanamadı"), {
      status: r.status,
    });
  return d;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      stageflow<span className="brand-period">®</span>
    </div>
  );
}
function VenueMap({
  stages,
  onStage,
  onMove,
  compact = false,
}: {
  stages: Row[];
  onStage?: (s: Row) => void;
  onMove?: (id: string, x: number, y: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={"venue-map " + (compact ? "compact" : "")}
      onDragOver={(e) => onMove && e.preventDefault()}
      onDrop={(e) => {
        if (!onMove) return;
        e.preventDefault();
        const id = e.dataTransfer.getData("application/stageflow-stage");
        if (!stages.some((s) => s.id === id)) return;
        const box = e.currentTarget.getBoundingClientRect();
        onMove(
          id,
          Math.min(95, Math.max(5, ((e.clientX - box.left) / box.width) * 100)),
          Math.min(90, Math.max(8, ((e.clientY - box.top) / box.height) * 100)),
        );
      }}
    >
      <svg
        viewBox="0 0 900 490"
        preserveAspectRatio="xMidYMid slice"
        aria-label="Festival alanı şematik planı"
      >
        <defs>
          <pattern
            id="map-grid"
            width="30"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M30 0H0V30"
              fill="none"
              stroke="#dce0d6"
              strokeWidth=".5"
            />
          </pattern>
          <pattern
            id="trees"
            width="38"
            height="38"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="15" cy="17" r="10" fill="#d3ddcc" />
            <circle cx="18" cy="14" r="6" fill="#cbd7c3" />
          </pattern>
        </defs>
        <rect width="900" height="490" fill="#e9ece2" />
        <rect width="900" height="490" fill="url(#map-grid)" />
        <path
          d="M-40 110C160 190 30 340 220 490H-40ZM570-20C620 100 810 90 940 200V-20Z"
          fill="url(#trees)"
        />
        <path
          d="M-30 120C140 195 125 320 230 510M380-20C400 120 560 130 540 290S620 380 950 340"
          fill="none"
          stroke="#fffdf5"
          strokeWidth="42"
        />
        <path
          d="M-30 120C140 195 125 320 230 510M380-20C400 120 560 130 540 290S620 380 950 340"
          fill="none"
          stroke="#d8ddcf"
          strokeWidth="1"
          strokeDasharray="4 7"
        />
        <path
          d="M208 390L325 322L453 344L600 227L735 252"
          fill="none"
          stroke="#b6bfac"
          strokeWidth="3"
          strokeDasharray="6 7"
        />
        <rect
          x="365"
          y="172"
          width="105"
          height="86"
          rx="3"
          fill="#f7f5ee"
          stroke="#a9b4a0"
        />
        <rect x="385" y="179" width="64" height="25" fill="#bfc9b4" />
        <path
          d="M395 210L405 242M420 210L420 242M445 210L435 242"
          stroke="#d4dace"
          strokeWidth="2"
        />
        <rect
          x="625"
          y="90"
          width="89"
          height="55"
          rx="4"
          fill="#d4ddca"
          stroke="#aab79e"
        />
        <rect
          x="201"
          y="300"
          width="76"
          height="55"
          rx="4"
          fill="#d6d5ca"
          stroke="#aaa993"
        />
        <g fill="#f7f6ee" stroke="#c1c8b7">
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={606 + i * 34}
              y="375"
              width="25"
              height="24"
              rx="3"
            />
          ))}
        </g>
        <text
          x="653"
          y="421"
          fill="#98a08e"
          fontSize="11"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          FOOD & DRINK
        </text>
        <text
          x="108"
          y="420"
          fill="#8c9880"
          fontSize="10"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          GİRİŞ A
        </text>
        <path
          d="M153 379V403M143 393L153 403L163 393"
          fill="none"
          stroke="#8d9b81"
          strokeWidth="2"
        />
        <text
          x="767"
          y="65"
          fill="#8c9880"
          fontSize="11"
          fontFamily="sans-serif"
        >
          N ↑
        </text>
        <circle cx="552" cy="294" r="12" fill="#fffdf4" stroke="#c3ccba" />
        <path d="M548 294H556M552 290V298" stroke="#8a9d7e" strokeWidth="2" />
      </svg>
      {stages.map((s) => (
        <button
          key={s.id}
          className="map-pin"
          draggable={!!onMove}
          onDragStart={(e) =>
            e.dataTransfer.setData("application/stageflow-stage", s.id)
          }
          style={
            {
              left: s.x + "%",
              top: s.y + "%",
              "--pin-color": s.color,
            } as React.CSSProperties
          }
          onClick={() => onStage?.(s)}
        >
          <span />
          <strong>{s.name}</strong>
          <small>{s.capacity.toLocaleString("tr")} kapasite</small>
        </button>
      ))}
      <div className="map-key">
        <span>●</span> Şematik alan planı <b>1 : 500</b>
      </div>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState("overview"),
    [query, setQuery] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [edit, setEdit] = useState<Row | null>(null),
    [day, setDay] = useState("2026-10-24"),
    [taskFilter, setTaskFilter] = useState("all"),
    [email, setEmail] = useState("admin@stageflow.local"),
    [password, setPassword] = useState("Stageflow2026!"),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api("snapshot"));
      setError("");
    } catch (e: any) {
      if (e.status === 401) setData(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:9149`,
      { withCredentials: true, transports: ["websocket", "polling"] },
    );
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("refresh", () => void load());
    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [!!data, load]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        setError("");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function action(name: string, input: Row) {
    setBusy(true);
    setError("");
    try {
      await api("actions", {
        action: name,
        input,
        mutationId: crypto.randomUUID(),
      });
      await load();
      setNotice("Değişiklik tüm çalışma alanlarına iletildi.");
      setModal(null);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("login", { email, password });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function open(type: string, row: Row | null = null) {
    setEdit(row);
    setModal(type);
    setError("");
  }
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" size={22} />
        <span>Çalışma alanı hazırlanıyor</span>
      </div>
    );
  if (!data)
    return (
      <div className="login">
        <section>
          <Brand />
          <div className="login-editorial">
            <span className="eyebrow">THE WORK BEHIND THE SHOW</span>
            <h1>
              İyi bir sahnenin
              <br />
              arkasında,
              <br />
              <em>iyi bir ekip var.</em>
            </h1>
            <p>
              Program, ekip ve saha operasyonları.
              <br />
              Herkes aynı sayfada. Her şey aynı ritimde.
            </p>
            <div className="festival-stamp">
              <span>NORTHLINE</span>
              <b>
                24—25
                <br />
                EKİM / 26
              </b>
              <small>İSTANBUL · FESTİVAL OPERASYONU</small>
            </div>
          </div>
          <footer>
            STAGEFLOW OPERATIONS SYSTEM <span>EST. 2026</span>
          </footer>
        </section>
        <section className="login-form">
          <span className="eyebrow">ÇALIŞMA ALANINA GİRİŞ</span>
          <h2>Tekrar hoş geldin.</h2>
          <p>Festivalin sahne arkasına geç.</p>
          <form onSubmit={login}>
            <label>
              E-posta adresi
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Parola
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <>
                  Çalışma alanını aç <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <div className="demo-box">
            <span>YEREL DEMO HESAPLARI</span>
            <div>
              {[
                ["admin", "Organizatör"],
                ["tech", "Teknisyen"],
                ["gate", "Giriş görevlisi"],
                ["guest", "Katılımcı"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setEmail(id + "@stageflow.local");
                    setPassword("Stageflow2026!");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <small>Demo parola: Stageflow2026!</small>
          </div>
          <div className="login-bottom">
            <i /> PostgreSQL veritabanına bağlı yerel çalışma alanı
          </div>
        </section>
      </div>
    );
  const tasks = data.tasks || [],
    crew = data.crew || [],
    equipment = data.equipment || [],
    reservations = data.reservations || [],
    shifts = data.shifts || [],
    incidents = data.incidents || [],
    audit = data.audit || [];
  const stage = (id: string) => data.stages.find((s) => s.id === id);
  const done = tasks.filter((t) => t.status === "done").length;
  const isAdmin = ["admin", "stage"].includes(data.user.role);
  const attendee = data.user.role === "attendee";
  const visibleNav = attendee
    ? nav.filter((n) => ["overview", "schedule", "map", "entry"].includes(n[0]))
    : nav;
  const activeNav = nav.find((n) => n[0] === view);
  const performances = data.performances.filter(
    (p) => festivalDate(p.startsAt) === day,
  );
  const filteredTasks = tasks.filter(
    (t) =>
      (taskFilter === "all" || t.status === taskFilter) &&
      [t.title, t.team, t.description]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const stageName = (id: string) => stage(id)?.name || "Festival geneli";
  async function saveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = Object.fromEntries(f);
    const dt = (s: FormDataEntryValue) =>
      new Date(String(s) + "+03:00").toISOString();
    if (modal === "task")
      await action("task.create", {
        festivalId: data!.festival.id,
        title: v.title,
        description: v.description,
        team: v.team,
        stageId: v.stageId || null,
        assignee: v.assignee || null,
        priority: v.priority,
        dueAt: dt(v.dueAt),
        dependencies: f.getAll("dependencies"),
      });
    if (modal === "performance")
      await action("performance.save", {
        id: edit?.id,
        version: edit?.version,
        festivalId: data!.festival.id,
        stageId: v.stageId,
        artist: v.artist,
        genre: v.genre,
        startsAt: dt(v.startsAt),
        endsAt: dt(v.endsAt),
      });
    if (modal === "reservation")
      await action("reservation.create", {
        equipmentId: v.equipmentId,
        stageId: v.stageId,
        quantity: Number(v.quantity),
        startsAt: dt(v.startsAt),
        endsAt: dt(v.endsAt),
      });
    if (modal === "shift")
      await action("shift.create", {
        festivalId: data!.festival.id,
        userId: v.userId,
        stageId: v.stageId,
        startsAt: dt(v.startsAt),
        endsAt: dt(v.endsAt),
      });
    if (modal === "incident") {
      const file = f.get("photo") as File;
      let photo: string | null = null;
      if (file?.size) {
        if (file.size > 500000) {
          setError("Fotoğraf 500 KB altında olmalı.");
          return;
        }
        photo = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      }
      await action("incident.create", {
        festivalId: data!.festival.id,
        title: v.title,
        description: v.description,
        severity: v.severity,
        stageId: v.stageId || null,
        photo,
      });
    }
    if (modal === "checkin")
      await action("ticket.checkin", { qr: String(v.qr).trim() });
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    value?: string,
  ) => (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required />
    </label>
  );
  const stageSelect = (
    <label>
      Sahne
      <select name="stageId" defaultValue={edit?.stageId || data.stages[0].id}>
        {data.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
  const dateFields = (
    <div className="two-fields">
      {field(
        "startsAt",
        "Başlangıç",
        "datetime-local",
        edit?.startsAt ? festivalInput(edit.startsAt) : day + "T14:00",
      )}
      {field(
        "endsAt",
        "Bitiş",
        "datetime-local",
        edit?.endsAt ? festivalInput(edit.endsAt) : day + "T15:00",
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <button className="organization" onClick={() => open("about")}>
          <span className="org-mark">N</span>
          <span>
            Northline Productions<small>Festival çalışma alanı</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="sidebar-label">OPERASYON MASASI</div>
        <nav>
          {visibleNav.map(([id, title, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setView(id);
                setQuery("");
                setError("");
              }}
              className={view === id ? "active" : ""}
            >
              <Icon size={17} />
              {title}
              {id === "incidents" &&
                incidents.filter((i) => i.status === "open").length > 0 && (
                  <b>{incidents.filter((i) => i.status === "open").length}</b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href={process.env.NEXT_PUBLIC_MOBILE_URL || "http://localhost:9150"}
            target="_blank"
            rel="noreferrer"
          >
            <Smartphone size={17} />
            <span>
              Saha uygulaması<small>Ekibinle her yerde</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
          <button className="profile" onClick={() => open("account")}>
            <span className="avatar">{initials(data.user.name)}</span>
            <span>
              {data.user.name}
              <small>
                {
                  {
                    admin: "Organizatör",
                    stage: "Sahne sorumlusu",
                    technician: "Teknisyen",
                    gate: "Giriş görevlisi",
                    attendee: "Katılımcı",
                  }[data.user.role as string]
                }
              </small>
            </span>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span>Çalışma alanı</span>
            <ChevronRight size={13} />
            <strong>{activeNav?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={15} />
              <input
                id="global-search"
                placeholder={
                  attendee ? "Programı görüntüle…" : "Görevlerde ara…"
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setView(attendee ? "schedule" : "tasks");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className={"connection " + (connected ? "online" : "")}>
              <i />
              {connected ? "Canlı bağlantı" : "Bağlanıyor"}
            </span>
            <button
              className="icon-button"
              aria-label={attendee ? "Biletimi aç" : "Olay kayıtlarını aç"}
              onClick={() => setView(attendee ? "entry" : "incidents")}
            >
              <Bell size={17} />
              {incidents.some((i) => i.status === "open") && (
                <i className="notification-dot" />
              )}
            </button>
          </div>
        </header>
        <main>
          <div
            className={
              "page-heading " + (view === "overview" ? "overview-heading" : "")
            }
          >
            <div>
              <div className="eyebrow">
                NORTHLINE FESTIVAL <span>/</span> 24—25 EKİM 2026
              </div>
              <h1>
                {view === "overview"
                  ? attendee
                    ? "Festival rehberin"
                    : "Operasyon özeti"
                  : activeNav?.[1]}
              </h1>
              <p>
                {view === "overview"
                  ? "Northline ’26 · KüçükÇiftlik Park, İstanbul"
                  : {
                      schedule:
                        "Üç sahne, iki gün. Her performansın yeri ve zamanı belli.",
                      tasks: "Küçük detayları tamamla, büyük güne hazır ol.",
                      crew: "Doğru kişi, doğru sahne, doğru zamanda.",
                      equipment: "Her ekipmanın nerede olduğunu bil.",
                      map: "Festival alanına yukarıdan bak.",
                      incidents: "Sahadan gelen bildirimler ve çözüm takibi.",
                      entry: attendee
                        ? "Festival biletin ve giriş durumun."
                        : "İmzalı bilet doğrulama ve tek kullanımlık giriş.",
                      activity: "Çalışma alanında ne, ne zaman değişti?",
                    }[view]}
              </p>
            </div>
            <div className="heading-actions">
              <span className="festival-state">
                <i /> HAZIRLIK AŞAMASI
              </span>
              {isAdmin && (
                <button
                  className="primary"
                  onClick={() =>
                    open(
                      (
                        {
                          schedule: "performance",
                          crew: "shift",
                          equipment: "reservation",
                          incidents: "incident",
                          entry: "checkin",
                        } as Row
                      )[view] || "task",
                    )
                  }
                >
                  <Plus size={15} />
                  {{
                    schedule: "Performans ekle",
                    crew: "Vardiya ekle",
                    equipment: "Rezervasyon",
                    incidents: "Olay bildir",
                    entry: "Bilet doğrula",
                  }[view] || "Görev oluştur"}
                </button>
              )}
              {!isAdmin && !attendee && (
                <button className="primary" onClick={() => open("incident")}>
                  <Plus size={15} />
                  Olay bildir
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Hatayı kapat">
                <X size={15} />
              </button>
            </div>
          )}
          {view === "overview" && (
            <>
              <section
                className="festival-cover"
                aria-label="Northline Festival tanıtımı"
              >
                <img
                  src="/images/festival-evening.png"
                  alt="Açık hava festivalinde sahne ışıkları altında toplanan kalabalık"
                  fetchPriority="high"
                />
                <div className="cover-shade" />
                <div className="cover-content">
                  <span className="cover-kicker">
                    <i /> NORTHLINE FESTIVAL · 2026
                  </span>
                  <h2>
                    Geriye sadece
                    <br />
                    <em>müzik kalsın.</em>
                  </h2>
                  <p>İki gün. Üç sahne. Tek bir ekip.</p>
                  <button onClick={() => setView("schedule")}>
                    Sahne programını aç <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="cover-date">
                  <strong>24—25</strong>
                  <span>EKİM / İSTANBUL</span>
                </div>
                <span className="cover-caption">NORTHLINE / AÇIK HAVA</span>
              </section>
              <div className="section-index">
                <span>01 / FESTİVAL DURUMU</span>
                <span>
                  ORTAK ÇALIŞMA ALANI <i />
                </span>
              </div>
              <section className="stat-grid">
                {[
                  [
                    attendee ? "PROGRAMDAKİ SANATÇI" : "TAMAMLANAN GÖREV",
                    attendee
                      ? String(data.performances.length)
                      : `${done} / ${tasks.length}`,
                    attendee
                      ? "İki gün, üç sahne"
                      : `${tasks.filter((t) => t.priority === "high" && t.status !== "done").length} öncelikli görev bekliyor`,
                    CheckSquare,
                  ],
                  [
                    attendee ? "FAVORİ PERFORMANS" : "SAHA EKİBİ",
                    attendee
                      ? String(data.favorites.length)
                      : String(crew.length),
                    attendee
                      ? "Kendi festival takvimin"
                      : "Organizasyon ve saha personeli",
                    Users,
                  ],
                  [
                    "SAHNELER",
                    String(data.stages.length),
                    "Festival alanındaki aktif sahneler",
                    Radio,
                  ],
                  [
                    "GİRİŞ YAPAN",
                    String(data.tickets.filter((t) => t.checkedInAt).length),
                    `${data.tickets.length} kayıtlı demo bilet`,
                    ScanLine,
                  ],
                ].map(([label, value, detail, Icon]: any, i) => (
                  <article key={label} className="stat-card">
                    <div>
                      <span>{label}</span>
                      <Icon size={17} />
                    </div>
                    <strong>{value}</strong>
                    <small>
                      {i === 0 && !attendee ? (
                        <>
                          <span className="progress-mini">
                            <i
                              style={{
                                width:
                                  (done / Math.max(tasks.length, 1)) * 100 +
                                  "%",
                              }}
                            />
                          </span>
                          {detail}
                        </>
                      ) : (
                        detail
                      )}
                    </small>
                  </article>
                ))}
              </section>
              <section className="overview-grid">
                <div className="panel stages-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Sahne hazırlıkları</h2>
                      <p>Ekiplerin güncel tamamlanma durumu</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("schedule")}
                    >
                      Programı gör <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="stage-cards">
                    {data.stages.map((s, i) => {
                      const own = tasks.filter((t) => t.stageId === s.id);
                      const complete = own.filter(
                        (t) => t.status === "done",
                      ).length;
                      return (
                        <article
                          className="stage-card"
                          key={s.id}
                          style={
                            { "--stage-color": s.color } as React.CSSProperties
                          }
                        >
                          <div className={"stage-art stage-art-" + i}>
                            <span className="stage-no">0{i + 1}</span>
                            <svg viewBox="0 0 200 110" aria-hidden="true">
                              <path
                                d="M35 93V30L100 7L165 30V93M35 30H165M53 23V93M147 23V93M35 93H165M44 57H156"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M66 34L89 84H50ZM133 34L150 84H111Z"
                                fill="currentColor"
                                opacity=".12"
                              />
                              <path
                                d="M70 87H130V98H70Z"
                                fill="currentColor"
                                opacity=".3"
                              />
                              <path d="M30 103H170" stroke="currentColor" />
                            </svg>
                            <span className="stage-capacity">
                              {s.capacity.toLocaleString("tr")} KİŞİ
                            </span>
                          </div>
                          <div className="stage-card-body">
                            <div>
                              <h3>{s.name}</h3>
                              <span className="stage-dot" />
                            </div>
                            <small>
                              {
                                data.performances.filter(
                                  (p) => p.stageId === s.id,
                                ).length
                              }{" "}
                              performans · {own.length} görev
                            </small>
                            <div className="stage-progress">
                              <i
                                style={{
                                  width:
                                    (complete / Math.max(own.length, 1)) * 100 +
                                    "%",
                                }}
                              />
                            </div>
                            <div className="stage-readiness">
                              <span>
                                {own.length
                                  ? `${complete}/${own.length} görev tamamlandı`
                                  : "Görev atanmadı"}
                              </span>
                              <button
                                onClick={() => {
                                  setView("tasks");
                                  setQuery(s.name === "Ana Sahne" ? "PA" : "");
                                }}
                              >
                                İncele <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="panel-note">
                    <Clock size={13} />
                    <span>Kapı açılışı: 24 Ekim, 14.00</span>
                    <span>İstanbul / GMT+3</span>
                  </div>
                </div>
                <div className="panel priority-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{attendee ? "Sıradaki keşfin" : "Önce bunlar"}</h2>
                      <p>
                        {attendee
                          ? "Programdan seçtiklerin."
                          : "Dikkat gerektiren işler."}
                      </p>
                    </div>
                    <span className="count-tag">
                      {attendee
                        ? data.favorites.length
                        : tasks.filter(
                            (t) => t.priority === "high" && t.status !== "done",
                          ).length}
                    </span>
                  </div>
                  {attendee
                    ? data.performances.slice(0, 3).map((p) => (
                        <div className="priority-item" key={p.id}>
                          <Music2 size={17} />
                          <div>
                            <strong>{p.artist}</strong>
                            <small>
                              {time(p.startsAt)} · {stageName(p.stageId)}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            onClick={() =>
                              void action("favorite.toggle", { id: p.id })
                            }
                          >
                            <Star
                              size={16}
                              fill={
                                data.favorites.includes(p.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </div>
                      ))
                    : tasks
                        .filter(
                          (t) => t.priority === "high" && t.status !== "done",
                        )
                        .slice(0, 3)
                        .map((t) => (
                          <button
                            className="priority-item"
                            key={t.id}
                            onClick={() => {
                              setView("tasks");
                              setQuery(t.title);
                            }}
                          >
                            <span className="priority-square">
                              <Flag size={14} />
                            </span>
                            <div>
                              <strong>{t.title}</strong>
                              <small>
                                {stageName(t.stageId)} <span>·</span>{" "}
                                {time(t.dueAt)}
                              </small>
                            </div>
                            <ChevronRight size={14} />
                          </button>
                        ))}
                  <button
                    className="all-tasks"
                    onClick={() => setView(attendee ? "schedule" : "tasks")}
                  >
                    Tümünü görüntüle <ArrowRight size={14} />
                  </button>
                </div>
              </section>
              <section className="overview-bottom">
                <div className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Festival alanı</h2>
                      <p>KüçükÇiftlik Park, İstanbul</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("map")}
                    >
                      Planı aç <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <VenueMap
                    stages={data.stages}
                    compact
                    onStage={(s) => {
                      setView("map");
                      setNotice(`${s.name} · ${s.capacity} kişi kapasite`);
                    }}
                  />
                </div>
                <div className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Son hareketler</h2>
                      <p>Ekipten en yeni güncellemeler.</p>
                    </div>
                    <History size={17} />
                  </div>
                  {audit.slice(0, 4).map((a) => (
                    <div className="activity-item" key={a.id}>
                      <span className="activity-avatar">
                        {initials(a.name)}
                      </span>
                      <div>
                        <strong>{a.name}</strong>
                        <p>{actionLabel(a.action)}</p>
                        <small>
                          {new Date(a.createdAt).toLocaleDateString("tr-TR")} ·{" "}
                          {time(a.createdAt)}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!audit.length && (
                    <p className="empty-note">
                      Programını ve favorilerini keşfet.
                    </p>
                  )}
                  <button
                    className="all-tasks"
                    onClick={() => setView(attendee ? "schedule" : "activity")}
                  >
                    Tüm hareketler <ArrowRight size={14} />
                  </button>
                </div>
              </section>
            </>
          )}
          {view === "schedule" && (
            <section className="panel schedule-panel">
              <div className="panel-heading">
                <div className="tabs">
                  {["2026-10-24", "2026-10-25"].map((d, i) => (
                    <button
                      key={d}
                      className={day === d ? "selected" : ""}
                      onClick={() => setDay(d)}
                    >
                      {24 + i} Ekim <span>{i ? "Pazar" : "Cumartesi"}</span>
                    </button>
                  ))}
                </div>
                <span className="table-hint">
                  {isAdmin
                    ? "Kartı sürükleyerek sahne ve saat değiştir · İstanbul saati"
                    : "İstanbul saati / GMT+3"}
                </span>
              </div>
              <div className="schedule-scroll">
                <div className="schedule-hours">
                  <span>SAHNE</span>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i}>{String(i + 14).padStart(2, "0")}:00</span>
                  ))}
                </div>
                {data.stages.map((s) => (
                  <div className="schedule-row" key={s.id}>
                    <div className="schedule-stage">
                      <i style={{ background: s.color }} />
                      <strong>{s.name}</strong>
                      <small>
                        {performances.filter((p) => p.stageId === s.id).length}{" "}
                        performans
                      </small>
                    </div>
                    <div className="schedule-track">
                      {Array.from({ length: 20 }, (_, i) => (
                        <div
                          className="drop-slot"
                          key={i}
                          style={{ left: i * 5 + "%", width: "5%" }}
                          onDragOver={(e) => isAdmin && e.preventDefault()}
                          onDrop={(e) => {
                            if (!isAdmin) return;
                            e.preventDefault();
                            const p = data.performances.find(
                              (p) =>
                                p.id === e.dataTransfer.getData("text/plain"),
                            );
                            if (!p) return;
                            const start = new Date(
                              `${day}T${String(14 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00+03:00`,
                            );
                            void action("performance.save", {
                              ...p,
                              startsAt: start.toISOString(),
                              endsAt: new Date(
                                start.getTime() +
                                  Date.parse(p.endsAt) -
                                  Date.parse(p.startsAt),
                              ).toISOString(),
                            });
                          }}
                        />
                      ))}
                      {performances
                        .filter((p) => p.stageId === s.id)
                        .map((p) => {
                          const local = new Date(
                            Date.parse(p.startsAt) + 3 * 3600000,
                          );
                          const left =
                            (local.getUTCHours() +
                              local.getUTCMinutes() / 60 -
                              14) *
                            10;
                          const width =
                            ((Date.parse(p.endsAt) - Date.parse(p.startsAt)) /
                              3600000) *
                            10;
                          return (
                            <button
                              draggable={isAdmin}
                              onDragStart={(e) =>
                                e.dataTransfer.setData("text/plain", p.id)
                              }
                              className="performance-card"
                              style={
                                {
                                  left: left + "%",
                                  width: width + "%",
                                  "--stage-color": s.color,
                                } as React.CSSProperties
                              }
                              key={p.id}
                              onClick={() =>
                                isAdmin
                                  ? open("performance", p)
                                  : void action("favorite.toggle", { id: p.id })
                              }
                            >
                              <span>
                                {time(p.startsAt)}—{time(p.endsAt)}
                              </span>
                              <strong>{p.artist}</strong>
                              <small>{p.genre}</small>
                              {data.favorites.includes(p.id) && (
                                <Star size={12} fill="currentColor" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="panel-note">
                <i className="tiny-dot" />
                Çakışmalar API tarafından kontrol edilir. Değişiklikler tüm
                cihazlara iletilir.
              </div>
            </section>
          )}
          {view === "tasks" && (
            <section className="panel">
              <div className="panel-heading">
                <div className="tabs">
                  {[
                    ["all", "Tüm görevler"],
                    ["todo", "Bekleyen"],
                    ["doing", "Devam eden"],
                    ["done", "Tamamlanan"],
                  ].map(([id, title]) => (
                    <button
                      key={id}
                      className={taskFilter === id ? "selected" : ""}
                      onClick={() => setTaskFilter(id)}
                    >
                      {title}
                    </button>
                  ))}
                </div>
                <span className="table-hint">{filteredTasks.length} görev</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>GÖREV</th>
                      <th>SAHNE / EKİP</th>
                      <th>SORUMLU</th>
                      <th>SAAT</th>
                      <th>ÖNCELİK</th>
                      <th>DURUM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.title}</strong>
                          <small>{t.description}</small>
                          {t.dependencies.length > 0 && (
                            <span className="dependency">
                              ↳{" "}
                              {t.dependencies
                                .map(
                                  (id: string) =>
                                    tasks.find((x) => x.id === id)?.title,
                                )
                                .join(", ")}
                            </span>
                          )}
                        </td>
                        <td>
                          {stageName(t.stageId)}
                          <small>{t.team}</small>
                        </td>
                        <td>
                          <span className="person">
                            <i>
                              {initials(
                                crew.find((c) => c.id === t.assignee)?.name ||
                                  "?",
                              )}
                            </i>
                            {crew.find((c) => c.id === t.assignee)?.name ||
                              "Atanmadı"}
                          </span>
                        </td>
                        <td>{time(t.dueAt)}</td>
                        <td>
                          <span className={"priority " + t.priority}>
                            {
                              {
                                high: "Yüksek",
                                medium: "Normal",
                                low: "Düşük",
                              }[t.priority as string]
                            }
                          </span>
                        </td>
                        <td>
                          <select
                            aria-label={`${t.title} durumu`}
                            className={"status-select " + t.status}
                            value={t.status}
                            disabled={
                              busy || (!isAdmin && t.assignee !== data.user.id)
                            }
                            onChange={(e) =>
                              void action("task.status", {
                                id: t.id,
                                status: e.target.value,
                                version: t.version,
                              })
                            }
                          >
                            <option value="todo">Bekliyor</option>
                            <option value="doing">Devam ediyor</option>
                            <option value="done">Tamamlandı</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredTasks.length && (
                  <div className="empty-state">
                    <CheckSquare size={24} />
                    <h3>Bu görünümde görev yok.</h3>
                    <p>Filtreyi değiştir veya yeni bir görev oluştur.</p>
                  </div>
                )}
              </div>
            </section>
          )}
          {view === "crew" && (
            <section className="crew-grid">
              {crew.map((person, i) => (
                <article className="panel crew-card" key={person.id}>
                  <span className={"crew-avatar tone-" + (i % 3)}>
                    {initials(person.name)}
                  </span>
                  <h3>{person.name}</h3>
                  <span className="role-tag">{person.team}</span>
                  <div className="crew-shifts">
                    {shifts
                      .filter((s) => s.userId === person.id)
                      .map((s) => (
                        <div key={s.id}>
                          <CalendarDays size={14} />
                          <span>
                            {stageName(s.stageId)}
                            <small>
                              {new Date(s.startsAt).toLocaleDateString("tr-TR")}{" "}
                              · {time(s.startsAt)}–{time(s.endsAt)}
                            </small>
                          </span>
                        </div>
                      ))}
                    {!shifts.some((s) => s.userId === person.id) && (
                      <p>Henüz vardiya atanmadı.</p>
                    )}
                  </div>
                  <div className="crew-footer">
                    <span>
                      {
                        tasks.filter(
                          (t) =>
                            t.assignee === person.id && t.status !== "done",
                        ).length
                      }{" "}
                      açık görev
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => open("shift", { userId: person.id })}
                      >
                        Vardiya ata <Plus size={12} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
          {view === "equipment" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Ekipman envanteri</h2>
                  <p>Rezervasyonlar saat aralığına göre değerlendirilir.</p>
                </div>
                <span className="table-hint">
                  {equipment.reduce((n, e) => n + e.quantity, 0)} toplam birim
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>EKİPMAN</th>
                      <th>KATEGORİ</th>
                      <th>TOPLAM</th>
                      <th>REZERVASYONLAR</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <span className="equipment-name">
                            <i>
                              <Package size={19} />
                            </i>
                            <span>
                              <strong>{e.name}</strong>
                              <small>{e.code}</small>
                            </span>
                          </span>
                        </td>
                        <td>{e.category}</td>
                        <td>
                          <strong>{e.quantity}</strong> birim
                        </td>
                        <td>
                          {reservations
                            .filter(
                              (r) => r.equipmentId === e.id && !r.returned,
                            )
                            .map((r) => (
                              <div className="reservation" key={r.id}>
                                <span>
                                  {r.quantity} adet · {stageName(r.stageId)}
                                  <small>
                                    {time(r.startsAt)}—{time(r.endsAt)}
                                  </small>
                                </span>
                                <button
                                  className="text-button"
                                  disabled={
                                    busy ||
                                    !["admin", "stage", "technician"].includes(
                                      data.user.role,
                                    )
                                  }
                                  onClick={() =>
                                    void action("reservation.return", {
                                      id: r.id,
                                    })
                                  }
                                >
                                  İade al <Check size={12} />
                                </button>
                              </div>
                            ))}
                          {!reservations.some(
                            (r) => r.equipmentId === e.id && !r.returned,
                          ) && (
                            <span className="muted">Aktif rezervasyon yok</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="secondary"
                            disabled={
                              !["admin", "stage", "technician"].includes(
                                data.user.role,
                              )
                            }
                            onClick={() =>
                              open("reservation", { equipmentId: e.id })
                            }
                          >
                            <Plus size={13} />
                            Ayır
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`${e.name} QR etiketi`}
                            onClick={() => open("equipment-qr", e)}
                          >
                            <ScanLine size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {view === "map" && (
            <section className="panel full-map">
              <div className="panel-heading">
                <div>
                  <h2>Alan planı / KüçükÇiftlik Park</h2>
                  <p>Şematik operasyon planı. Navigasyon haritası değildir.</p>
                </div>
                <span className="table-hint">
                  3 SAHNE · 2 GİRİŞ · SERVİS ALANI
                </span>
              </div>
              <VenueMap
                stages={data.stages}
                onStage={(s) => open("stage", s)}
                onMove={
                  isAdmin
                    ? (id, x, y) => void action("stage.move", { id, x, y })
                    : undefined
                }
              />
              <div className="map-legend">
                {data.stages.map((s) => (
                  <span key={s.id}>
                    <i style={{ background: s.color }} />
                    {s.name}{" "}
                    <small>{s.capacity.toLocaleString("tr")} kişi</small>
                  </span>
                ))}
              </div>
            </section>
          )}
          {view === "incidents" && (
            <section className="incident-grid">
              {incidents.map((i) => (
                <article className="panel incident-card" key={i.id}>
                  <div>
                    <span className={"priority " + i.severity}>
                      {i.severity === "high"
                        ? "Öncelikli"
                        : i.severity === "medium"
                          ? "Normal"
                          : "Düşük"}
                    </span>
                    <span className={"incident-status " + i.status}>
                      {i.status === "resolved" ? "Çözüldü" : "Açık kayıt"}
                    </span>
                  </div>
                  <h3>{i.title}</h3>
                  <p>{i.description}</p>
                  {i.photo && (
                    <img
                      className="incident-photo"
                      src={i.photo}
                      alt="Saha bildirimi fotoğrafı"
                    />
                  )}
                  <footer>
                    <span>
                      <MapPin size={13} />
                      {stageName(i.stageId)} · {time(i.createdAt)}
                    </span>
                    {i.status === "open" && isAdmin && (
                      <button
                        onClick={() =>
                          void action("incident.resolve", { id: i.id })
                        }
                      >
                        Çözüldü işaretle <Check size={13} />
                      </button>
                    )}
                  </footer>
                </article>
              ))}
              {!incidents.length && (
                <div className="empty-state">
                  <Check size={25} />
                  <h3>Açık olay yok.</h3>
                </div>
              )}
            </section>
          )}
          {view === "entry" && (
            <section className="entry-grid">
              <div className="panel entry-main">
                <span className="eyebrow">
                  {attendee ? "YOUR FESTIVAL PASS" : "ENTRY OPERATIONS"}
                </span>
                <ScanLine size={46} />
                <h2>
                  {attendee
                    ? "Festival biletin hazır."
                    : "Bir bilet. Tek giriş."}
                </h2>
                <p>
                  {attendee
                    ? "Giriş görevlisine mobil uygulamadaki QR biletini göster."
                    : "QR içeriğini doğrula. Sunucu imzayı kontrol eder ve bileti tek işlemde kullanılmış olarak işaretler."}
                </p>
                {attendee ? (
                  data.tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
                ) : (
                  <>
                    <button
                      className="primary"
                      disabled={!["admin", "gate"].includes(data.user.role)}
                      onClick={() => open("checkin")}
                    >
                      <ScanLine size={15} />
                      Bilet doğrula
                    </button>
                    <small className="entry-hint">
                      Mobilde kamera ile QR okutabilirsin.
                    </small>
                  </>
                )}
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Giriş kayıtları</h2>
                    <p>Sunucuda doğrulanan biletler.</p>
                  </div>
                </div>
                {data.tickets.map((t) => (
                  <div className="ticket-row" key={t.id}>
                    <Ticket size={19} />
                    <div>
                      <strong>{t.code}</strong>
                      <small>{t.category}</small>
                    </div>
                    <span className={t.checkedInAt ? "checked" : "muted"}>
                      {t.checkedInAt ? "Giriş yapıldı" : "Kullanılmadı"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {view === "activity" && (
            <section className="panel activity-table">
              <div className="panel-heading">
                <div>
                  <h2>İşlem günlüğü</h2>
                  <p>Kullanıcı, zaman ve değişiklik kaydı.</p>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(audit, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "stageflow-activity.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={14} />
                  JSON indir
                </button>
              </div>
              {audit.map((a) => (
                <div className="audit-row" key={a.id}>
                  <span className="activity-avatar">{initials(a.name)}</span>
                  <div>
                    <strong>{a.name}</strong>
                    <p>{actionLabel(a.action)}</p>
                  </div>
                  <code>{a.entity.slice(0, 18)}</code>
                  <time>
                    {new Date(a.createdAt).toLocaleDateString("tr-TR")} ·{" "}
                    {time(a.createdAt)}
                  </time>
                </div>
              ))}
            </section>
          )}
          <footer className="workspace-footer">
            <span>
              <i className="tiny-dot" /> NORTHLINE FESTIVAL · OPERATIONS
              WORKSPACE
            </span>
            <span>
              Stageflow <b>v0.1</b> <span className="footer-divider">/</span>{" "}
              İstanbul, Türkiye
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
          <button aria-label="Bildirimi kapat" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "task"
                ? "Görev oluştur"
                : modal === "performance"
                  ? "Performans düzenle"
                  : "Stageflow işlemi"
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Kapat"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">NORTHLINE / OPERATIONS</span>
            <h2>
              {
                {
                  task: "Yeni görev",
                  performance: edit ? "Performansı düzenle" : "Programına ekle",
                  reservation: "Ekipman rezervasyonu",
                  shift: "Vardiya planla",
                  incident: "Sahadan bir bildirim",
                  checkin: "Bilet doğrulama",
                  stage: edit?.name,
                  account: "Hesabın",
                  about: "Northline Productions",
                  "equipment-qr": "Ekipman etiketi",
                }[modal]
              }
            </h2>
            {["account", "about", "stage", "equipment-qr"].includes(modal) ? (
              <>
                {modal === "equipment-qr" && (
                  <TicketCard ticket={{ qr: edit?.code, code: edit?.code }} />
                )}
                <p>
                  {modal === "account"
                    ? `${data.user.name} · ${data.user.email || data.user.role}`
                    : modal === "stage"
                      ? `${edit?.capacity} kişi kapasite · ${data.performances.filter((p) => p.stageId === edit?.id).length} performans`
                      : "Northline Festival · 24–25 Ekim 2026 · İstanbul"}
                </p>
                {modal === "stage" && isAdmin && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void action("stage.move", {
                        id: edit!.id,
                        x: Number(f.get("x")),
                        y: Number(f.get("y")),
                      });
                    }}
                  >
                    <div className="two-fields">
                      <label>
                        Yatay konum (%)
                        <input
                          name="x"
                          type="number"
                          min="5"
                          max="95"
                          defaultValue={edit?.x}
                          required
                        />
                      </label>
                      <label>
                        Dikey konum (%)
                        <input
                          name="y"
                          type="number"
                          min="8"
                          max="90"
                          defaultValue={edit?.y}
                          required
                        />
                      </label>
                    </div>
                    <p className="field-note">
                      Sahne işaretini haritada sürükleyebilir veya konumunu
                      burada ayarlayabilirsin.
                    </p>
                    {error && (
                      <div role="alert" className="form-error">
                        {error}
                      </div>
                    )}
                    <button className="primary" disabled={busy}>
                      Konumu kaydet
                    </button>
                  </form>
                )}
                {modal === "account" && (
                  <button
                    className="primary"
                    onClick={async () => {
                      await api("logout", {});
                      setData(null);
                      setModal(null);
                    }}
                  >
                    <LogOut size={15} />
                    Çıkış yap
                  </button>
                )}
                {modal === "stage" && (
                  <button
                    className="primary"
                    onClick={() => {
                      setView("schedule");
                      setModal(null);
                    }}
                  >
                    Sahne programına git <ArrowRight size={15} />
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={saveForm}>
                {modal === "task" && (
                  <>
                    {field("title", "Görev başlığı")}
                    <label>
                      Açıklama
                      <textarea name="description" rows={3} />
                    </label>
                    <div className="two-fields">
                      <label>
                        Ekip
                        <select name="team">
                          {["Teknik", "Sahne", "Giriş", "Operasyon"].map(
                            (s) => (
                              <option key={s}>{s}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Sorumlu
                        <select name="assignee">
                          <option value="">Atanmamış</option>
                          {crew.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {stageSelect}
                    <div className="two-fields">
                      {field(
                        "dueAt",
                        "Hedef saat",
                        "datetime-local",
                        day + "T12:00",
                      )}
                      <label>
                        Öncelik
                        <select name="priority">
                          <option value="medium">Normal</option>
                          <option value="high">Yüksek</option>
                          <option value="low">Düşük</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Önce tamamlanması gereken görevler
                      <select
                        multiple
                        name="dependencies"
                        className="multi-select"
                      >
                        {tasks.map((t) => (
                          <option value={t.id} key={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="field-note">
                      Birden fazla seçim için Ctrl / Cmd tuşunu kullan.
                    </p>
                  </>
                )}
                {modal === "performance" && (
                  <>
                    {field("artist", "Sanatçı", "text", edit?.artist)}
                    {field(
                      "genre",
                      "Tür / performans tipi",
                      "text",
                      edit?.genre,
                    )}
                    {stageSelect}
                    {dateFields}
                    <p className="field-note">
                      Aynı sahne veya sanatçı için çakışan zaman aralıkları
                      kabul edilmez.
                    </p>
                  </>
                )}
                {modal === "reservation" && (
                  <>
                    <label>
                      Ekipman
                      <select
                        name="equipmentId"
                        defaultValue={edit?.equipmentId || equipment[0]?.id}
                      >
                        {equipment.map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.name} · {e.quantity} birim
                          </option>
                        ))}
                      </select>
                    </label>
                    {stageSelect}
                    {field("quantity", "Adet", "number", "1")}
                    {dateFields}
                    <p className="field-note">
                      Aynı saatlerdeki toplam rezervasyon miktarı envanter
                      sayısını aşamaz.
                    </p>
                  </>
                )}
                {modal === "shift" && (
                  <>
                    <label>
                      Ekip üyesi
                      <select
                        name="userId"
                        defaultValue={edit?.userId || crew[0]?.id}
                      >
                        {crew.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {stageSelect}
                    {dateFields}
                  </>
                )}
                {modal === "incident" && (
                  <>
                    {field("title", "Kısa başlık")}
                    <label>
                      Ayrıntılar
                      <textarea name="description" rows={3} required />
                    </label>
                    {stageSelect}
                    <label>
                      Önem derecesi
                      <select name="severity">
                        <option value="medium">Normal</option>
                        <option value="high">Yüksek</option>
                        <option value="low">Düşük</option>
                      </select>
                    </label>
                    <label>
                      Fotoğraf (isteğe bağlı, en fazla 500 KB)
                      <input
                        name="photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                      />
                    </label>
                  </>
                )}
                {modal === "checkin" && (
                  <>
                    <label>
                      QR bilet içeriği
                      <textarea
                        name="qr"
                        rows={5}
                        required
                        placeholder="Mobil biletin imzalı QR içeriği"
                      />
                    </label>
                    <p className="field-note">
                      Başarılı giriş işlemi veritabanına kaydedilir. Tekrar
                      okutma reddedilir.
                    </p>
                  </>
                )}
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={15} />
                  )}{" "}
                  {modal === "checkin" ? "Doğrula ve giriş yap" : "Kaydet"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function actionLabel(action: string) {
  return (
    (
      {
        "task.create": "Yeni görev oluşturdu",
        "task.status": "Görev durumunu güncelledi",
        "performance.save": "Sahne programını güncelledi",
        "reservation.create": "Ekipman rezervasyonu oluşturdu",
        "reservation.return": "Ekipman iadesi aldı",
        "shift.create": "Yeni vardiya atadı",
        "incident.create": "Sahadan olay bildirdi",
        "incident.resolve": "Olay kaydını çözdü",
        "ticket.checkin": "Bilet girişini doğruladı",
        "favorite.toggle": "Festival programını kişiselleştirdi",
      } as Row
    )[action] || action
  );
}
function TicketCard({ ticket }: { ticket: Row }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (ticket.qr)
      void import("qrcode")
        .then((m) =>
          m.toDataURL(ticket.qr, {
            width: 250,
            margin: 2,
            color: { dark: "#252a26", light: "#fffdf8" },
          }),
        )
        .then(setQr);
  }, [ticket.qr]);
  return (
    <div className="ticket-card">
      {qr && <img src={qr} alt="Festival giriş QR bileti" />}
      <strong>{ticket.code}</strong>
      <small>{ticket.checkedInAt ? "Giriş yapıldı" : "Girişte göster"}</small>
    </div>
  );
}
