import { useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, parseYouTubeUrl } from "@unicoach/shared";
import { SubjectSelect } from "@/components/library/subject-select";
import { YouTubeFrame } from "@/components/library/youtube-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import type { YouTubeEvent } from "@/lib/youtube";

type Phase = "idle" | "reading" | "saving";

/** "Kaynak ekle": YouTube video ya da oynatma listesi bağlantısı + ders (web'deki AddSourceDialog). */
export default function AddSourceScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const [url, setUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<{ url?: string; subject?: string; form?: string }>({});
  /** Okunan oynatma listesi: görünmeyen oynatıcı bu liste için açılır. */
  const [listId, setListId] = useState<string | null>(null);
  const playlistRef = useRef<{ resolve: (ids: string[]) => void; reject: (err: Error) => void } | null>(null);
  const busy = phase !== "idle";

  /** Oynatma listesindeki video ID'leri (YouTube sırasıyla, en fazla 200) görünmeyen oynatıcının getPlaylist() sonucundan alınır. */
  function readPlaylist(id: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return new Promise<string[]>((resolve, reject) => {
      playlistRef.current = { resolve, reject };
      setListId(id);
      // Sayfa kendi içinde 15 sn bekler; oynatıcı hiç açılmazsa da sonsuza kadar beklenmesin.
      timer = setTimeout(() => reject(new Error("Oynatma listesi okunamadı. İnternet bağlantını kontrol edip tekrar dene.")), 25_000);
    }).finally(() => {
      clearTimeout(timer);
      playlistRef.current = null;
      setListId(null);
    });
  }

  function onPlaylistEvent(event: YouTubeEvent) {
    if (event.type === "playlist") playlistRef.current?.resolve(event.ids);
    else if (event.type === "error") playlistRef.current?.reject(new Error(event.message));
  }

  async function submit() {
    const parsed = parseYouTubeUrl(url);
    const next = {
      url: parsed ? undefined : "Geçerli bir YouTube video ya da oynatma listesi bağlantısı yapıştır.",
      subject: subject ? undefined : "Bir ders seç.",
    };
    setErrors(next);
    if (!parsed || !subject) return;

    try {
      let videoIds: string[] | undefined;
      if (parsed.kind === "PLAYLIST") {
        setPhase("reading");
        videoIds = await readPlaylist(parsed.listId);
      }
      setPhase("saving");
      const source = await api.sources.create({
        subject,
        kind: parsed.kind,
        youtubeId: parsed.kind === "PLAYLIST" ? parsed.listId : parsed.videoId,
        videoIds,
      });
      router.replace({ pathname: "/kaynak/[id]", params: { id: source.id } });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.errors?.youtubeId ?? err.errors?.subject ?? err.message)
          : err instanceof Error
            ? err.message
            : "Kaynak eklenemedi.";
      setErrors({ form: message });
      setPhase("idle");
    }
  }

  const status = phase === "reading" ? "Oynatma listesi okunuyor…" : phase === "saving" ? "Video başlıkları alınıyor…" : null;

  return (
    <Screen edges={["bottom"]}>
      <Text tone="textMuted">
        Bir YouTube videosu ya da oynatma listesi ekle. Bağlantıyı YouTube uygulamasındaki "Paylaş → Bağlantıyı kopyala" ile alabilirsin.
      </Text>

      {errors.form && (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}
        >
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {errors.form}
          </Text>
        </View>
      )}

      <View style={{ gap: spacing[4] }}>
        <Input
          label="YouTube bağlantısı"
          placeholder="https://youtube.com/playlist?list=…"
          value={url}
          onChangeText={setUrl}
          error={errors.url}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="next"
        />
        <View style={{ gap: 6 }}>
          <Text size="sm" weight="medium">
            Ders
          </Text>
          <SubjectSelect value={subject} onChange={setSubject} examTrack={user?.examTrack ?? null} error={errors.subject} disabled={busy} />
        </View>
      </View>

      <View style={{ gap: spacing[3] }}>
        <Button onPress={() => void submit()} loading={busy}>
          Ekle
        </Button>
        {status && (
          <Text accessibilityRole="text" size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            {status}
          </Text>
        )}
      </View>

      {listId && (
        // Görünmez ama ekranda: Android, boyutu sıfır olan WebView'de sayfayı çalıştırmayabilir.
        <View pointerEvents="none" style={{ position: "absolute", left: -1000, top: 0, width: 200, height: 120, opacity: 0 }}>
          <YouTubeFrame initial={{ listId }} onEvent={onPlaylistEvent} style={{ width: 200, height: 120 }} />
        </View>
      )}
    </Screen>
  );
}
