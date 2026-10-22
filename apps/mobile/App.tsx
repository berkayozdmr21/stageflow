import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Linking,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SvgXml } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { drain, reconcile, Mutation } from "./sync";
import { festivalDate } from "../../packages/contracts";
type Row = Record<string, any>;
const fallback = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:9149";
const clock = (s: string) =>
  new Date(s).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
async function getSecret() {
  return Platform.OS === "web"
    ? sessionStorage.getItem("sf-session")
    : SecureStore.getItemAsync("sf-session");
}
async function saveSecret(value: string | null) {
  if (Platform.OS === "web") {
    value
      ? sessionStorage.setItem("sf-session", value)
      : sessionStorage.removeItem("sf-session");
  } else {
    if (value) await SecureStore.setItemAsync("sf-session", value);
    else await SecureStore.deleteItemAsync("sf-session");
  }
}
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
export default function App() {
  const [base, setBase] = useState(fallback),
    [session, setSession] = useState<Row | null>(null),
    [data, setData] = useState<Row | null>(null),
    [email, setEmail] = useState("tech@stageflow.local"),
    [password, setPassword] = useState("Stageflow2026!"),
    [tab, setTab] = useState("home"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [online, setOnline] = useState(true),
    [queue, setQueue] = useState<Mutation[]>([]),
    [ready, setReady] = useState(false),
    [camera, setCamera] = useState(false),
    [permission, requestPermission] = useCameraPermissions(),
    [qr, setQr] = useState(""),
    [ticketResult, setTicketResult] = useState(""),
    [report, setReport] = useState(false),
    [reportTitle, setReportTitle] = useState(""),
    [reportText, setReportText] = useState(""),
    [reportPhoto, setReportPhoto] = useState<string | null>(null),
    [equipmentCode, setEquipmentCode] = useState(""),
    [scanTarget, setScanTarget] = useState<"ticket" | "equipment">("ticket"),
    [severity, setSeverity] = useState("medium"),
    [festivalDay, setFestivalDay] = useState("2026-10-24");
  const syncLock = useRef(false),
    scanLock = useRef(false),
    sessionRef = useRef<Row | null>(null),
    baseRef = useRef(base),
    queueRef = useRef<Mutation[]>([]);
  sessionRef.current = session;
  baseRef.current = base;
  async function request(
    path: string,
    body?: unknown,
    token = sessionRef.current?.token,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const r = await fetch(baseRef.current + "/api/" + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok)
        throw Object.assign(new Error(d.message || "İşlem başarısız"), {
          status: r.status,
        });
      return d;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function persistQueue(next: Mutation[]) {
    queueRef.current = next;
    setQueue(next);
    if (sessionRef.current)
      await AsyncStorage.setItem(
        "sf-queue-" + sessionRef.current.user.id,
        JSON.stringify(next),
      );
  }
  async function refresh() {
    if (!sessionRef.current) return;
    const owner = sessionRef.current.user.id;
    try {
      const d = await request("snapshot");
      if (sessionRef.current?.user.id !== owner) return;
      setData(d);
      setOnline(true);
      await AsyncStorage.setItem("sf-snapshot-" + owner, JSON.stringify(d));
      setError("");
    } catch (e: any) {
      if (sessionRef.current?.user.id !== owner) return;
      if (e.status === 401) {
        setError(
          "Oturum süren doldu; tekrar giriş yap. Bekleyen kayıtların korunuyor.",
        );
        setSession(null);
        await saveSecret(null);
      } else {
        setOnline(false);
        if (e.status) setError(e.message);
      }
    }
  }
  async function sync() {
    if (syncLock.current || !sessionRef.current || !queueRef.current.length)
      return;
    syncLock.current = true;
    const owner = sessionRef.current.user.id;
    const batch = [...queueRef.current];
    try {
      const result = await drain(batch, (m) =>
        request("actions", {
          action: m.action,
          input: m.input,
          mutationId: m.id,
        }),
      );
      if (sessionRef.current?.user.id !== owner) return;
      await persistQueue(reconcile(batch, result.remaining, queueRef.current));
      if (result.conflict)
        setError(
          "Bir görev başka cihazda değişti. Bekleyen kaydı inceleyip güncel görev üzerinden tekrar uygula.",
        );
      if (result.offline) setOnline(false);
      if (result.sent) await refresh();
    } finally {
      syncLock.current = false;
    }
  }
  useEffect(() => {
    void (async () => {
      try {
        const storedBase = await AsyncStorage.getItem("sf-api");
        if (storedBase) {
          setBase(storedBase);
          baseRef.current = storedBase;
        }
        const saved = await getSecret();
        if (saved) {
          const ss = JSON.parse(saved);
          sessionRef.current = ss;
          setSession(ss);
          const cached = await AsyncStorage.getItem(
            "sf-snapshot-" + ss.user.id,
          );
          if (cached) setData(JSON.parse(cached));
          const pending = JSON.parse(
            (await AsyncStorage.getItem("sf-queue-" + ss.user.id)) || "[]",
          );
          queueRef.current = pending;
          setQueue(pending);
          await refresh();
        }
      } catch {
        setError("Yerel oturum okunamadı. Yeniden giriş yap.");
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!session) return;
    void refresh().then(sync);
    const timer = setInterval(() => void refresh().then(sync), 12000);
    return () => clearInterval(timer);
  }, [session?.user.id]);
  async function login() {
    setBusy(true);
    setError("");
    try {
      if (!/^https?:\/\//.test(base))
        throw Error("API adresi http:// veya https:// ile başlamalı.");
      await AsyncStorage.setItem("sf-api", base.replace(/\/$/, ""));
      baseRef.current = base.replace(/\/$/, "");
      const ss = await request("login", { email, password }, null);
      sessionRef.current = ss;
      setSession(ss);
      await saveSecret(JSON.stringify(ss));
      const pending = JSON.parse(
        (await AsyncStorage.getItem("sf-queue-" + ss.user.id)) || "[]",
      );
      queueRef.current = pending;
      setQueue(pending);
      await refresh();
    } catch (e: any) {
      setError(
        e.status
          ? e.message
          : "API bağlantısını ve adresi kontrol et. " + e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeTask(task: Row, status: string) {
    const mutation: Mutation = {
      id: uuid(),
      userId: session!.user.id,
      action: "task.status",
      input: { id: task.id, status, version: task.version },
      createdAt: new Date().toISOString(),
    };
    if (queueRef.current.some((m) => m.input.id === task.id)) {
      setError(
        "Bu görev için zaten bekleyen bir değişiklik var. Önce eşitle veya bekleyen kaydı kaldır.",
      );
      return;
    }
    await persistQueue([...queueRef.current, mutation]);
    await sync();
  }
  async function immediate(action: string, input: Row) {
    setBusy(true);
    setError("");
    try {
      await request("actions", { action, input, mutationId: uuid() });
      await refresh();
      return true;
    } catch (e: any) {
      setError(
        e.status
          ? e.message
          : "Bağlantı yok. Bu işlem için çevrimiçi olmalısın.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function checkin(value: string) {
    setCamera(false);
    setQr(value);
    setTicketResult("");
    if (await immediate("ticket.checkin", { qr: value })) {
      setTicketResult("Giriş onaylandı. Bilet kullanıldı.");
      setQr("");
    }
  }
  async function openScanner(target: "ticket" | "equipment") {
    setScanTarget(target);
    scanLock.current = false;
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        setError("Kamera izni verilmedi; kodu elle girebilirsin.");
        return;
      }
    }
    setCamera(true);
  }
  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.25,
        base64: true,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset.base64) return;
        if (asset.base64.length > 650000) {
          setError("Fotoğraf büyük. Daha küçük bir görsel seç (500 KB).");
          return;
        }
        setReportPhoto(
          `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`,
        );
      }
    } catch (e: any) {
      setError("Fotoğraf seçilemedi: " + e.message);
    }
  }
  const tasks = data?.tasks || [],
    stages = data?.stages || [],
    performances = data?.performances || [],
    ownTasks = tasks.filter((t: Row) =>
      ["admin", "stage"].includes(session?.user.role)
        ? true
        : t.assignee === session?.user.id,
    );
  const attendee = session?.user.role === "attendee";
  const stageName = (id: string) =>
    stages.find((x: Row) => x.id === id)?.name || "Festival geneli";
  if (!ready)
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#ad4939" />
        <Text style={s.muted}>Çalışma alanı hazırlanıyor</Text>
      </View>
    );
  if (!session)
    return (
      <ScrollView contentContainerStyle={s.login}>
        <StatusBar style="dark" />
        <Text style={s.logo}>
          stageflow<Text style={s.logoField}> / SAHA</Text>
        </Text>
        <Text style={s.eyebrow}>THE WORK BEHIND THE SHOW</Text>
        <Text style={s.loginTitle}>
          Sahada ol.<Text style={{ color: "#ad4939" }}> Bağlantıda kal.</Text>
        </Text>
        <Text style={s.loginDescription}>
          Görevlerin, ekibin ve festivalin.<Text>{"\n"}Hepsi cebinde.</Text>
        </Text>
        <Text style={s.label}>E-POSTA</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="E-posta"
        />
        <Text style={s.label}>PAROLA</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          accessibilityLabel="Parola"
        />
        <Text style={s.label}>ORTAK API ADRESİ</Text>
        <TextInput
          style={s.input}
          value={base}
          onChangeText={setBase}
          autoCapitalize="none"
          accessibilityLabel="API adresi"
        />
        <Text style={s.help}>
          Telefonda bilgisayarın yerel ağ IP adresini kullan. Web ve mobil aynı
          API’ye bağlanır.
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        <Button
          title={busy ? "Bağlanıyor…" : "Sahaya giriş yap →"}
          disabled={busy}
          onPress={() => void login()}
        />
        <View style={s.demo}>
          <Text style={s.eyebrow}>DEMO HESAPLARI</Text>
          <View style={s.wrap}>
            {[
              ["tech", "Teknisyen"],
              ["stage", "Sahne"],
              ["gate", "Giriş"],
              ["guest", "Katılımcı"],
            ].map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setEmail(id + "@stageflow.local");
                  setPassword("Stageflow2026!");
                }}
                style={s.chip}
              >
                <Text style={s.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.help}>Demo parola: Stageflow2026!</Text>
        </View>
      </ScrollView>
    );
  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.top}>
        <Text style={s.logo}>
          stageflow<Text style={s.logoField}> / SAHA</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hesap ve senkronizasyon"
          onPress={() => setTab("account")}
          style={s.avatar}
        >
          <Text style={s.avatarText}>
            {session.user.name
              .split(" ")
              .map((v: string) => v[0])
              .slice(0, 2)
              .join("")}
          </Text>
        </Pressable>
      </View>
      <View style={s.connection}>
        <View
          style={[s.dot, { backgroundColor: online ? "#56616d" : "#bb9470" }]}
        />
        <Text style={s.connectionText}>
          {online ? "Çalışma alanı güncel" : "Çevrimdışı · son kayıtlı görünüm"}
          {queue.length ? ` · ${queue.length} değişiklik bekliyor` : ""}
        </Text>
      </View>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => void refresh().then(sync)}
            tintColor="#ad4939"
          />
        }
      >
        {!!error && (
          <Pressable onPress={() => setError("")}>
            <Text accessibilityRole="alert" style={s.error}>
              {error} ×
            </Text>
          </Pressable>
        )}
        {tab === "home" && (
          <>
            <Text style={s.eyebrow}>NORTHLINE ’26 / SAHA EKİBİ</Text>
            <Text style={s.title}>
              Merhaba, {session.user.name.split(" ")[0]}.
            </Text>
            <Text style={s.description}>
              {attendee
                ? "Kendi festival ritmini bul."
                : "Sahaya çıkmadan önce, gününe bir bak."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Festival programını aç"
              onPress={() => setTab("program")}
            >
              <ImageBackground
                source={require("./assets/festival-backstage.png")}
                style={s.festivalCard}
                imageStyle={{ borderRadius: 4 }}
              >
                <View style={s.photoShade} />
                <Text style={s.festivalTag}>24—25 EKİM · İSTANBUL</Text>
                <Text style={s.festivalTitle}>
                  Sahne senin.{"\n"}Ritim hepimizin.
                </Text>
                <View style={s.festivalBottom}>
                  <Text style={s.festivalLocation}>NORTHLINE FESTIVAL</Text>
                  <Text style={s.festivalArrow}>↗</Text>
                </View>
              </ImageBackground>
            </Pressable>
            <View style={s.mobileStats}>
              <View style={s.mobileStat}>
                <Text style={s.mobileStatValue}>
                  {attendee
                    ? data?.favorites?.length || 0
                    : ownTasks.filter((t: Row) => t.status === "done").length}
                </Text>
                <Text style={s.mobileStatLabel}>
                  {attendee ? "Favori performans" : "Tamamlanan görev"}
                </Text>
              </View>
              <View style={s.mobileStat}>
                <Text style={s.mobileStatValue}>
                  {attendee
                    ? performances.length
                    : ownTasks.filter((t: Row) => t.status !== "done").length}
                </Text>
                <Text style={s.mobileStatLabel}>
                  {attendee ? "Toplam performans" : "Bekleyen görev"}
                </Text>
              </View>
            </View>
            <View style={s.sectionHeading}>
              <Text style={s.sectionTitle}>
                {attendee ? "Programdan seçtiklerimiz" : "Önce bunlar"}
              </Text>
              <Pressable onPress={() => setTab(attendee ? "program" : "tasks")}>
                <Text style={s.link}>Tümünü gör ↗</Text>
              </Pressable>
            </View>
            {attendee
              ? performances
                  .slice(0, 3)
                  .map((p: Row) => (
                    <Performance
                      key={p.id}
                      item={p}
                      stage={stageName(p.stageId)}
                      favorite={data?.favorites?.includes(p.id)}
                      onPress={() =>
                        void immediate("favorite.toggle", { id: p.id })
                      }
                    />
                  ))
              : ownTasks
                  .filter((t: Row) => t.status !== "done")
                  .slice(0, 3)
                  .map((t: Row) => (
                    <Task
                      key={t.id}
                      item={t}
                      stage={stageName(t.stageId)}
                      pending={queue.some((m) => m.input.id === t.id)}
                      onPress={() =>
                        void changeTask(
                          t,
                          t.status === "todo" ? "doing" : "done",
                        )
                      }
                    />
                  ))}
            {!attendee && (
              <Button
                secondary
                title="+ Sahadan olay bildir"
                onPress={() => setReport(true)}
              />
            )}
            {!attendee && (
              <Button
                secondary
                title="Ekipman teslim ve iade →"
                onPress={() => setTab("equipment")}
              />
            )}
          </>
        )}
        {tab === "tasks" && !attendee && (
          <>
            <Text style={s.eyebrow}>FIELD OPERATIONS</Text>
            <Text style={s.title}>Görevlerim</Text>
            <Text style={s.description}>
              Değişiklikler ortak çalışma alanına yansır.
            </Text>
            {ownTasks.map((t: Row) => (
              <Task
                key={t.id}
                item={t}
                stage={stageName(t.stageId)}
                pending={queue.some((m) => m.input.id === t.id)}
                onPress={() =>
                  void changeTask(
                    t,
                    t.status === "todo"
                      ? "doing"
                      : t.status === "doing"
                        ? "done"
                        : "todo",
                  )
                }
              />
            ))}
            {!ownTasks.length && (
              <Text style={s.help}>Sana atanmış görev yok.</Text>
            )}
            <Button
              secondary
              title="+ Olay bildir"
              onPress={() => setReport(true)}
            />
            <Text style={[s.sectionTitle, { marginTop: 30, marginBottom: 15 }]}>
              Vardiyalarım
            </Text>
            {(data?.shifts || [])
              .filter((v: Row) => v.userId === session.user.id)
              .map((v: Row) => (
                <View style={s.card} key={v.id}>
                  <Text style={s.cardTitle}>{stageName(v.stageId)}</Text>
                  <Text style={s.help}>
                    {new Date(v.startsAt).toLocaleDateString("tr-TR")} ·{" "}
                    {clock(v.startsAt)}—{clock(v.endsAt)}
                  </Text>
                </View>
              ))}
          </>
        )}
        {tab === "program" && (
          <>
            <Text style={s.eyebrow}>LINEUP / NORTHLINE 2026</Text>
            <Text style={s.title}>Program</Text>
            <View style={s.wrap}>
              {["2026-10-24", "2026-10-25"].map((d, i) => (
                <Pressable
                  style={[s.day, festivalDay === d && s.daySelected]}
                  key={d}
                  onPress={() => setFestivalDay(d)}
                >
                  <Text
                    style={[
                      s.dayText,
                      festivalDay === d && { color: "#fff9f1" },
                    ]}
                  >
                    {24 + i} Ekim
                  </Text>
                </Pressable>
              ))}
            </View>
            {stages.map((stage: Row) => (
              <View key={stage.id}>
                <Text
                  style={[s.sectionTitle, { marginTop: 27, marginBottom: 15 }]}
                >
                  {stage.name}
                </Text>
                {performances
                  .filter(
                    (p: Row) =>
                      p.stageId === stage.id &&
                      festivalDate(p.startsAt) === festivalDay,
                  )
                  .map((p: Row) => (
                    <Performance
                      key={p.id}
                      item={p}
                      stage={stage.name}
                      favorite={data?.favorites?.includes(p.id)}
                      onPress={() =>
                        void immediate("favorite.toggle", { id: p.id })
                      }
                    />
                  ))}
              </View>
            ))}
          </>
        )}
        {tab === "entry" && (
          <>
            <Text style={s.eyebrow}>GATE / VERIFIED ENTRY</Text>
            <Text style={s.title}>
              {attendee ? "Festival biletim" : "Giriş kontrolü"}
            </Text>
            <Text style={s.description}>
              {attendee
                ? "İmzalı QR biletini giriş görevlisine göster."
                : "Giriş onayı çevrimiçi sunucu doğrulaması gerektirir."}
            </Text>
            {attendee ? (
              (data?.tickets || []).map((t: Row) => (
                <View style={s.ticket} key={t.id}>
                  <Text style={s.festivalTag}>NORTHLINE / WEEKEND PASS</Text>
                  <Text style={s.ticketName}>{session.user.name}</Text>
                  {t.qrSvg && <SvgXml xml={t.qrSvg} width={230} height={230} />}
                  <Text style={s.ticketCode}>{t.code}</Text>
                  <Text style={s.help}>
                    {t.checkedInAt ? "Giriş yapıldı" : "Henüz kullanılmadı"}
                  </Text>
                  <Text selectable style={s.qrText}>
                    {t.qr}
                  </Text>
                  <Text style={s.help}>
                    Web demo kontrolü için imzalı içeriği kopyalayabilirsin.
                  </Text>
                </View>
              ))
            ) : ["admin", "gate"].includes(session.user.role) ? (
              <>
                <View style={s.scannerBox}>
                  <Text style={s.scannerSymbol}>▣</Text>
                  <Text style={s.sectionTitle}>Bilet okutmaya hazır</Text>
                  <Text style={s.help}>
                    Kamera izni yalnızca QR okurken kullanılır.
                  </Text>
                </View>
                <Button
                  title="Kamerayla QR okut"
                  onPress={async () => {
                    setTicketResult("");
                    await openScanner("ticket");
                  }}
                />
                <Text style={[s.label, { marginTop: 23 }]}>
                  İMZALI QR İÇERİĞİ
                </Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={qr}
                  onChangeText={setQr}
                  multiline
                  accessibilityLabel="QR içeriği"
                />
                <Button
                  secondary
                  disabled={busy || !qr.trim()}
                  title="Doğrula ve giriş yap"
                  onPress={() => void checkin(qr.trim())}
                />
                {!!ticketResult && (
                  <Text style={s.success}>{ticketResult}</Text>
                )}
              </>
            ) : (
              <Text style={s.help}>
                Giriş işlemi için giriş görevlisi hesabını kullan.
              </Text>
            )}
          </>
        )}
        {tab === "map" && (
          <>
            <Text style={s.eyebrow}>VENUE / SAHA MAP</Text>
            <Text style={s.title}>Festival alanı</Text>
            <Text style={s.description}>
              Sahne konumları ortak API’den güncellenir. Bu şema navigasyon
              haritası değildir.
            </Text>
            <View
              style={{
                height: 350,
                backgroundColor: "#e2e5e9",
                borderWidth: 1,
                borderColor: "#e2e5e9",
                borderRadius: 7,
                overflow: "hidden",
              }}
            >
              <SvgXml
                width="100%"
                height="100%"
                xml={
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 350"><rect width="400" height="350" fill="#e2e5e9"/><path d="M-30 90C150 50 100 300 440 260M80-30C150 120 200 190 140 380" stroke="#f5f6f7" stroke-width="30" fill="none"/><circle cx="65" cy="250" r="43" fill="#e2e5e9"/><circle cx="330" cy="40" r="67" fill="#e2e5e9"/><text x="285" y="325" fill="#737c87" font-size="10">N ↑</text></svg>'
                }
              />
              {stages.map((stage: Row) => (
                <Pressable
                  key={stage.id}
                  accessibilityLabel={`${stage.name} programını aç`}
                  onPress={() => setTab("program")}
                  style={{
                    position: "absolute",
                    left: `${stage.x}%` as `${number}%`,
                    top: `${stage.y}%` as `${number}%`,
                    transform: [{ translateX: -50 }, { translateY: -15 }],
                    padding: 10,
                    backgroundColor: "#fffdf4",
                    borderWidth: 1,
                    borderColor: "#c4cad1",
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: stage.color,
                      fontWeight: "600",
                    }}
                  >
                    ● {stage.name}
                  </Text>
                  <Text style={{ fontSize: 8, color: "#737c87", marginTop: 4 }}>
                    {stage.capacity} kişi
                  </Text>
                </Pressable>
              ))}
            </View>
            {stages.map((stage: Row) => (
              <View style={[s.card, { marginTop: 14 }]} key={stage.id}>
                <Text style={s.cardTitle}>{stage.name}</Text>
                <Text style={s.help}>
                  {
                    performances.filter((p: Row) => p.stageId === stage.id)
                      .length
                  }{" "}
                  performans · {stage.capacity} kişi kapasite
                </Text>
              </View>
            ))}
          </>
        )}
        {tab === "equipment" && !attendee && (
          <>
            <Text style={s.eyebrow}>EQUIPMENT / HANDOVER</Text>
            <Text style={s.title}>Ekipman takibi</Text>
            <Text style={s.description}>
              Kodu okut veya ara. Rezervasyon iadeleri web envanterine yansır.
            </Text>
            <TextInput
              accessibilityLabel="Ekipman kodu veya adı"
              style={s.input}
              placeholder="SF-MIC-001 / Shure"
              value={equipmentCode}
              onChangeText={setEquipmentCode}
            />
            <Button
              secondary
              title="Ekipman QR kodunu okut"
              onPress={() => void openScanner("equipment")}
            />
            {(data?.equipment || [])
              .filter((e: Row) =>
                [e.name, e.code]
                  .join(" ")
                  .toLocaleLowerCase("tr")
                  .includes(equipmentCode.toLocaleLowerCase("tr")),
              )
              .map((e: Row) => (
                <View key={e.id} style={[s.card, { marginTop: 17 }]}>
                  <Text style={s.cardTitle}>{e.name}</Text>
                  <Text style={s.help}>
                    {e.code} · {e.quantity} birim
                  </Text>
                  {(data?.reservations || [])
                    .filter((r: Row) => r.equipmentId === e.id && !r.returned)
                    .map((r: Row) => (
                      <View key={r.id} style={s.queueItem}>
                        <Text style={s.help}>
                          {r.quantity} adet · {stageName(r.stageId)} ·{" "}
                          {clock(r.startsAt)}—{clock(r.endsAt)}
                        </Text>
                        <Button
                          secondary
                          disabled={
                            busy ||
                            !["admin", "stage", "technician"].includes(
                              session.user.role,
                            )
                          }
                          title="İadeyi onayla"
                          onPress={() =>
                            void immediate("reservation.return", { id: r.id })
                          }
                        />
                      </View>
                    ))}
                </View>
              ))}
          </>
        )}
        {tab === "account" && (
          <>
            <Text style={s.eyebrow}>ACCOUNT / SYNC CENTER</Text>
            <Text style={s.title}>{session.user.name}</Text>
            <Text style={s.description}>
              {session.user.email} · {session.user.team}
            </Text>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Senkronizasyon kuyruğu</Text>
              <Text style={s.help}>
                {queue.length} bekleyen işlem. Kuyruk bu hesaba bağlı olarak
                cihazda saklanır.
              </Text>
              {queue.map((m) => (
                <View key={m.id} style={s.queueItem}>
                  <Text style={s.cardTitle}>
                    {tasks.find((t: Row) => t.id === m.input.id)?.title ||
                      m.action}
                  </Text>
                  <Text style={s.help}>
                    {String(m.input.status)} · {clock(m.createdAt)}
                  </Text>
                  {m.error && <Text style={s.error}>{m.error}</Text>}
                  <Button
                    secondary
                    title="Bekleyen kaydı kaldır"
                    onPress={() =>
                      void persistQueue(
                        queueRef.current.filter((q) => q.id !== m.id),
                      )
                    }
                  />
                </View>
              ))}
              <Button
                title="Şimdi eşitle"
                disabled={busy || !queue.length}
                onPress={() => void refresh().then(sync)}
              />
            </View>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Bağlı API</Text>
              <Text selectable style={s.help}>
                {base}
              </Text>
            </View>
            <Button
              secondary
              title="Çıkış yap"
              onPress={async () => {
                await saveSecret(null);
                setSession(null);
                setData(null);
                setQueue([]);
                queueRef.current = [];
                setTab("home");
              }}
            />
          </>
        )}
      </ScrollView>
      <View style={s.bottomNav}>
        {[
          ["home", "⌂", "Özet"],
          [
            attendee ? "program" : "tasks",
            attendee ? "♫" : "☑",
            attendee ? "Program" : "Görevler",
          ],
          [
            attendee ? "entry" : "program",
            attendee ? "▣" : "♫",
            attendee ? "Biletim" : "Program",
          ],
          ["map", "⌖", "Alan"],
          [
            attendee ? "account" : "entry",
            attendee ? "◎" : "▣",
            attendee ? "Hesabım" : "Giriş",
          ],
        ].map(([id, icon, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === id }}
            key={id}
            onPress={() => {
              setTab(id);
              setError("");
            }}
            style={s.navItem}
          >
            <FieldIcon name={id} color={tab === id ? "#dc4c2d" : "#737b85"} />
            <Text style={[s.navText, tab === id && s.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={camera}
        animationType="slide"
        onRequestClose={() => setCamera(false)}
      >
        <View style={s.cameraScreen}>
          {permission?.granted && camera && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                if (!scanLock.current) {
                  scanLock.current = true;
                  if (scanTarget === "equipment") {
                    setEquipmentCode(data);
                    setCamera(false);
                    setTab("equipment");
                  } else void checkin(data);
                }
              }}
            />
          )}
          <View style={{ padding: 25 }}>
            <Button title="Kamerayı kapat" onPress={() => setCamera(false)} />
          </View>
        </View>
      </Modal>
      <Modal
        visible={report}
        transparent
        animationType="fade"
        onRequestClose={() => setReport(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.sectionTitle}>Sahadan olay bildir</Text>
            <Text style={s.label}>BAŞLIK</Text>
            <TextInput
              style={s.input}
              value={reportTitle}
              onChangeText={setReportTitle}
            />
            <Text style={s.label}>AYRINTILAR</Text>
            <TextInput
              style={[s.input, s.textarea]}
              multiline
              value={reportText}
              onChangeText={setReportText}
            />
            <View style={s.wrap}>
              {[
                ["low", "Düşük"],
                ["medium", "Normal"],
                ["high", "Yüksek"],
              ].map(([v, label]) => (
                <Pressable
                  style={[s.chip, severity === v && { borderColor: "#ad4939" }]}
                  key={v}
                  onPress={() => setSeverity(v)}
                >
                  <Text style={s.chipText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              secondary
              title={reportPhoto ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
              onPress={() => void choosePhoto()}
            />
            {reportPhoto && (
              <View>
                <Image
                  source={{ uri: reportPhoto }}
                  style={{
                    width: "100%",
                    height: 130,
                    borderRadius: 5,
                    marginTop: 12,
                  }}
                  resizeMode="cover"
                />
                <Button
                  secondary
                  title="Fotoğrafı kaldır"
                  onPress={() => setReportPhoto(null)}
                />
              </View>
            )}
            {!!error && <Text style={s.error}>{error}</Text>}
            <Button
              disabled={busy || !reportTitle.trim() || !reportText.trim()}
              title="Bildirimi gönder"
              onPress={async () => {
                if (
                  await immediate("incident.create", {
                    festivalId: data!.festival.id,
                    title: reportTitle,
                    description: reportText,
                    severity,
                    stageId: null,
                    photo: reportPhoto,
                  })
                ) {
                  setReport(false);
                  setReportTitle("");
                  setReportText("");
                  setReportPhoto(null);
                }
              }}
            />
            <Button secondary title="Vazgeç" onPress={() => setReport(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
function FieldIcon({ name, color }: { name: string; color: string }) {
  const paths: Record<string, string> = {
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    tasks:
      '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
    program:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
    entry:
      '<path d="M4 3h5M3 4v5M15 3h5v6M3 15v5h6M15 21h5v-6M7 7h2v2H7ZM15 7h2v2h-2ZM7 15h2v2H7ZM14 14h3v3h-3Z"/>',
    account:
      '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  };
  return (
    <SvgXml
      width={21}
      height={21}
      xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.home}</svg>`}
    />
  );
}
function Task({
  item,
  stage,
  pending,
  onPress,
}: {
  item: Row;
  stage: string;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <View style={s.task}>
      <View style={s.taskHeader}>
        <Text style={s.taskStage}>{stage.toUpperCase()}</Text>
        <Text
          style={[
            s.taskPriority,
            item.priority === "high" && { color: "#b56e4e" },
          ]}
        >
          {item.priority === "high" ? "● ÖNCELİKLİ" : item.team}
        </Text>
      </View>
      <Text style={s.taskTitle}>{item.title}</Text>
      <Text style={s.taskDescription}>{item.description}</Text>
      {!!item.dependencies?.length && (
        <Text style={s.help}>
          ↳ {item.dependencies.length} görev bağımlılığı
        </Text>
      )}
      <View style={s.taskFooter}>
        <Text style={s.help}>◷ {clock(item.dueAt)}</Text>
        <Pressable
          disabled={pending}
          accessibilityRole="button"
          onPress={onPress}
          style={[s.status, item.status === "done" && s.done]}
        >
          <Text style={s.statusText}>
            {pending
              ? "Eşitleme bekliyor"
              : item.status === "done"
                ? "✓ Tamamlandı"
                : item.status === "doing"
                  ? "Devam ediyor →"
                  : "Göreve başla →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
function Performance({
  item,
  stage,
  favorite,
  onPress,
}: {
  item: Row;
  stage: string;
  favorite: boolean;
  onPress: () => void;
}) {
  return (
    <View style={s.performance}>
      <View style={s.performanceTime}>
        <Text style={s.performanceHour}>{clock(item.startsAt)}</Text>
        <Text style={s.help}>{clock(item.endsAt)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{item.artist}</Text>
        <Text style={s.taskStage}>
          {stage} · {item.genre}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        onPress={onPress}
      >
        <Text style={[s.favorite, favorite && { color: "#a58a54" }]}>
          {favorite ? "★" : "☆"}
        </Text>
      </Pressable>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f6f7",
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    paddingTop: Platform.OS === "ios" ? 48 : Platform.OS === "android" ? 30 : 0,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    backgroundColor: "#f5f6f7",
  },
  login: {
    flexGrow: 1,
    padding: 30,
    paddingTop: 70,
    backgroundColor: "#f5f6f7",
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  logo: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -1,
    color: "#20252c",
  },
  logoField: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#737c87",
    fontWeight: "400",
  },
  eyebrow: { fontSize: 9, letterSpacing: 1.4, color: "#737c87", marginTop: 24 },
  loginTitle: {
    fontSize: 39,
    lineHeight: 45,
    fontWeight: "500",
    letterSpacing: -1.6,
    color: "#20252c",
    marginTop: 22,
  },
  loginDescription: {
    fontSize: 13,
    lineHeight: 23,
    color: "#56616d",
    marginTop: 17,
    marginBottom: 25,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    color: "#56616d",
    marginBottom: 8,
    marginTop: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 5,
    padding: 13,
    fontSize: 13,
    color: "#20252c",
    backgroundColor: "#fffefa",
  },
  help: { fontSize: 10, color: "#737c87", lineHeight: 17, marginTop: 7 },
  muted: { fontSize: 12, color: "#737c87" },
  button: {
    backgroundColor: "#ad4939",
    padding: 14,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#a44535",
  },
  buttonText: { color: "#fff9f0", fontSize: 12, fontWeight: "600" },
  secondary: { backgroundColor: "#f5f6f7", borderColor: "#e2e5e9" },
  error: {
    padding: 13,
    backgroundColor: "#f8ecdf",
    borderWidth: 1,
    borderColor: "#ead7bc",
    borderRadius: 5,
    color: "#a8835d",
    fontSize: 11,
    lineHeight: 19,
    marginTop: 15,
  },
  success: {
    padding: 16,
    backgroundColor: "#e2e5e9",
    color: "#56616d",
    fontSize: 13,
    borderRadius: 5,
    marginTop: 18,
  },
  demo: {
    borderWidth: 1,
    borderColor: "#e2e5e9",
    backgroundColor: "#f5f6f7",
    padding: 17,
    borderRadius: 5,
    marginTop: 25,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#e2e5e9",
    backgroundColor: "#fbfdf4",
    borderRadius: 4,
  },
  chipText: { fontSize: 10, color: "#56616d" },
  top: {
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e5e9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  avatar: {
    width: 32,
    height: 32,
    backgroundColor: "#e2e5e9",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 10, color: "#56616d" },
  connection: {
    paddingHorizontal: 23,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#f5f6f7",
  },
  connectionText: { fontSize: 9, color: "#56616d" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  scroll: { flex: 1 },
  content: { padding: 23, paddingBottom: 35 },
  title: {
    fontSize: 30,
    fontWeight: "500",
    letterSpacing: -1,
    color: "#20252c",
    marginTop: 13,
  },
  description: {
    fontSize: 12,
    lineHeight: 21,
    color: "#737c87",
    marginTop: 10,
    marginBottom: 23,
  },
  festivalCard: {
    height: 211,
    padding: 22,
    backgroundColor: "#20252c",
    borderRadius: 7,
    overflow: "hidden",
    position: "relative",
  },
  festivalTag: { fontSize: 9, letterSpacing: 2, color: "#737c87" },
  festivalTitle: {
    fontSize: 31,
    lineHeight: 35,
    color: "#e2e5e9",
    letterSpacing: -1,
    marginTop: 18,
    fontWeight: "400",
  },
  festivalLocation: {
    position: "absolute",
    bottom: 20,
    left: 22,
    fontSize: 7,
    letterSpacing: 1.2,
    color: "#737c87",
  },
  posterLines: {
    position: "absolute",
    bottom: 40,
    right: -20,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-end",
    transform: [{ rotate: "-12deg" }],
  },
  posterLine: { width: 11, borderRadius: 1, opacity: 0.7 },
  mobileStat: { flex: 1, padding: 18 },
  mobileStats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 6,
    marginTop: 17,
    backgroundColor: "#fffef7",
  },
  mobileStatValue: { fontSize: 30, color: "#20252c", marginBottom: 7 },
  mobileStatLabel: { fontSize: 9, color: "#737c87" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#20252c",
  },
  link: { fontSize: 10, color: "#737c87" },
  task: {
    backgroundColor: "#fffef8",
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 6,
    padding: 17,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 11,
  },
  taskStage: {
    fontSize: 8,
    letterSpacing: 0.3,
    color: "#737c87",
    marginTop: 5,
  },
  taskPriority: { fontSize: 8, color: "#737c87" },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#20252c",
    lineHeight: 22,
  },
  taskDescription: {
    fontSize: 11,
    color: "#737c87",
    lineHeight: 18,
    marginTop: 8,
  },
  taskFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f5f6f7",
    paddingTop: 12,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  status: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: "#f4eddd",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9dec3",
  },
  statusText: { fontSize: 9, color: "#56616d" },
  done: { backgroundColor: "#e2e5e9", borderColor: "#e2e5e9" },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e5e9",
    backgroundColor: "#fffef7",
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  navIcon: { fontSize: 22, color: "#737c87" },
  navText: { fontSize: 8, color: "#737c87" },
  navActive: { color: "#ad6049" },
  performance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 5,
    backgroundColor: "#fffef6",
    padding: 15,
    marginBottom: 11,
  },
  performanceTime: {
    borderRightWidth: 1,
    borderRightColor: "#e2e5e9",
    paddingRight: 13,
  },
  performanceHour: { fontSize: 14, color: "#56616d" },
  cardTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#56616d",
    lineHeight: 21,
  },
  favorite: { fontSize: 24, color: "#737c87", padding: 5 },
  day: {
    padding: 11,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e2e5e9",
    backgroundColor: "#f5f6f7",
    borderRadius: 4,
  },
  daySelected: { backgroundColor: "#56616d", borderColor: "#56616d" },
  dayText: { fontSize: 11, color: "#737c87" },
  ticket: {
    padding: 22,
    alignItems: "center",
    backgroundColor: "#fffef5",
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 7,
  },
  ticketName: {
    fontSize: 24,
    color: "#56616d",
    marginTop: 17,
    marginBottom: 20,
  },
  ticketCode: {
    fontSize: 13,
    color: "#56616d",
    letterSpacing: 1,
    marginTop: 20,
  },
  qrText: { fontSize: 7, color: "#737c87", marginTop: 23, maxWidth: 280 },
  scannerBox: {
    alignItems: "center",
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c4cad1",
    borderRadius: 7,
    backgroundColor: "#f5f6f7",
  },
  scannerSymbol: { fontSize: 60, color: "#737c87", marginBottom: 20 },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  card: {
    backgroundColor: "#fffef6",
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 6,
    marginBottom: 17,
  },
  queueItem: {
    borderTopWidth: 1,
    borderTopColor: "#e2e5e9",
    paddingTop: 15,
    marginTop: 17,
  },
  cameraScreen: { flex: 1, backgroundColor: "#20252c" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#20252c77",
    alignItems: "center",
    justifyContent: "center",
    padding: 23,
  },
  modal: {
    backgroundColor: "#fbfdf2",
    borderWidth: 1,
    borderColor: "#e2e5e9",
    borderRadius: 8,
    padding: 24,
    width: "100%",
    maxWidth: 480,
  },
});
const s = StyleSheet.create({
  ...baseStyles,
  screen: { ...baseStyles.screen, backgroundColor: "#f6f7f9", maxWidth: 480 },
  loading: { ...baseStyles.loading, backgroundColor: "#f6f7f9" },
  login: {
    ...baseStyles.login,
    backgroundColor: "#ffffff",
    maxWidth: 480,
    padding: 28,
    paddingTop: 65,
  },
  logo: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -1.3,
    color: "#222831",
  },
  logoField: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#939ba5",
    fontWeight: "500",
  },
  top: {
    ...baseStyles.top,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomColor: "#e6e9ee",
    backgroundColor: "#ffffff",
  },
  avatar: {
    ...baseStyles.avatar,
    backgroundColor: "#ecf0f5",
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarText: { fontSize: 11, fontWeight: "600", color: "#536273" },
  connection: {
    ...baseStyles.connection,
    backgroundColor: "#f0f3f5",
    paddingVertical: 9,
    paddingHorizontal: 24,
  },
  connectionText: { fontSize: 10, color: "#73808b" },
  content: { padding: 24, paddingTop: 5, paddingBottom: 30 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: "#8a949f",
    marginTop: 25,
    fontWeight: "500",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: "#20252c",
    marginTop: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 21,
    color: "#7b8693",
    marginTop: 7,
    marginBottom: 23,
  },
  festivalCard: {
    height: 230,
    padding: 22,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#20252c",
  },
  photoShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#11192360",
  },
  festivalTag: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: "#f3ddd1",
    fontWeight: "500",
  },
  festivalTitle: {
    fontSize: 34,
    lineHeight: 36,
    color: "#ffffff",
    letterSpacing: -1.2,
    marginTop: 27,
    fontWeight: "600",
  },
  festivalBottom: {
    position: "absolute",
    bottom: 18,
    left: 22,
    right: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  festivalLocation: { fontSize: 8, letterSpacing: 1.2, color: "#e3e6ea" },
  festivalArrow: { fontSize: 25, color: "#fff", fontWeight: "300" },
  mobileStats: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe4ea",
    paddingBottom: 19,
    marginTop: 22,
  },
  mobileStat: { flex: 1, paddingHorizontal: 5, paddingVertical: 0 },
  mobileStatValue: {
    fontSize: 34,
    color: "#202b38",
    marginBottom: 6,
    fontWeight: "500",
    letterSpacing: -1.3,
  },
  mobileStatLabel: { fontSize: 10, color: "#8994a0" },
  sectionHeading: {
    ...baseStyles.sectionHeading,
    marginTop: 25,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.6,
    color: "#283443",
  },
  link: { fontSize: 10, color: "#6d7e90" },
  task: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e9ef",
    borderRadius: 4,
    padding: 19,
    marginBottom: 11,
  },
  taskHeader: { ...baseStyles.taskHeader, marginBottom: 10 },
  taskStage: {
    fontSize: 8,
    letterSpacing: 0.6,
    color: "#8592a1",
    marginTop: 3,
    fontWeight: "500",
  },
  taskPriority: { fontSize: 8, color: "#8a97a6" },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334253",
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  taskDescription: {
    fontSize: 11,
    color: "#8895a4",
    lineHeight: 18,
    marginTop: 7,
  },
  taskFooter: {
    ...baseStyles.taskFooter,
    borderTopColor: "#edf0f4",
    marginTop: 14,
    paddingTop: 12,
  },
  help: { fontSize: 10, color: "#8b98a7", lineHeight: 17, marginTop: 7 },
  muted: { fontSize: 12, color: "#8290a1" },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f5ede7",
    borderRadius: 3,
    borderWidth: 0,
  },
  statusText: { fontSize: 10, color: "#a56240", fontWeight: "500" },
  done: { backgroundColor: "#edf4f0", borderColor: "#dce9e2" },
  button: {
    ...baseStyles.button,
    backgroundColor: "#252d38",
    borderColor: "#252d38",
    borderRadius: 4,
    padding: 15,
  },
  buttonText: {
    ...baseStyles.buttonText,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  secondary: {
    ...baseStyles.secondary,
    backgroundColor: "#fff",
    borderColor: "#dfe5ec",
  },
  secondaryText: { color: "#52657a" },
  input: {
    ...baseStyles.input,
    backgroundColor: "#fff",
    borderColor: "#dfe5ec",
    borderRadius: 4,
    color: "#34465a",
    fontSize: 13,
  },
  label: { ...baseStyles.label, color: "#7d8da1", fontSize: 10 },
  chip: { ...baseStyles.chip, backgroundColor: "#fff", borderColor: "#dfe5ec" },
  chipText: { fontSize: 10, color: "#6e8095" },
  bottomNav: {
    ...baseStyles.bottomNav,
    backgroundColor: "#fff",
    borderTopColor: "#e1e7ee",
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
  },
  navItem: { ...baseStyles.navItem, gap: 7, minHeight: 40 },
  navText: { fontSize: 9, color: "#8d9aa9", fontWeight: "500" },
  navActive: { color: "#c44b2d" },
  performance: {
    ...baseStyles.performance,
    borderRadius: 4,
    borderColor: "#e3e9f0",
    backgroundColor: "#fff",
    padding: 17,
  },
  performanceTime: {
    ...baseStyles.performanceTime,
    borderRightColor: "#e3e9f0",
  },
  performanceHour: { fontSize: 15, fontWeight: "500", color: "#425970" },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3c5168",
    lineHeight: 22,
  },
  card: {
    ...baseStyles.card,
    backgroundColor: "#fff",
    borderColor: "#e3e9f0",
    borderRadius: 4,
  },
  day: { ...baseStyles.day, backgroundColor: "#fff", borderColor: "#e1e8f0" },
  daySelected: { backgroundColor: "#293747", borderColor: "#293747" },
  dayText: { fontSize: 11, color: "#8b9bae" },
  ticket: {
    ...baseStyles.ticket,
    backgroundColor: "#fff",
    borderColor: "#e1e8f0",
    borderRadius: 4,
  },
  ticketName: { ...baseStyles.ticketName, color: "#3e566f" },
  ticketCode: { ...baseStyles.ticketCode, color: "#70869f" },
  scannerBox: {
    ...baseStyles.scannerBox,
    backgroundColor: "#f0f4f8",
    borderColor: "#b8c8d9",
  },
  modal: {
    ...baseStyles.modal,
    backgroundColor: "#fff",
    borderColor: "#dfe7f0",
    borderRadius: 6,
  },
  modalBackdrop: { ...baseStyles.modalBackdrop, backgroundColor: "#17283c88" },
  loginTitle: { ...baseStyles.loginTitle, fontWeight: "600", color: "#26374c" },
  loginDescription: { ...baseStyles.loginDescription, color: "#7c8ea3" },
});
