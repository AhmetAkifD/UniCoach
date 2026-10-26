import { useState } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Camera, LogOut, Trash2 } from "lucide-react-native";
import {
  ApiError,
  AVATAR_SIZE,
  EXAM_TRACK_LABELS,
  EXAM_TRACKS,
  passwordProblem,
  ROLE_LABELS,
  THEME_LABELS,
  THEMES,
  type AuthUser,
} from "@unicoach/shared";
import { spacing } from "@unicoach/design";
import { PasswordChecklist } from "@/components/password-checklist";
import { SyncStatusCard } from "@/components/sync-status";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api, getApiToken } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** Profil: fotoğraf, hesap (ad-soyad, şifre), tercihler (tema, sınav), hesabı silme ve çıkış — web'deki /profil. */
export default function Profile() {
  const { user, refresh, signOut } = useSession();
  const { colors } = useTheme();
  if (!user) return null;
  return (
    <Screen edges={[]}>
      <Header user={user} onChange={refresh} />
      <Section title="Hesap">
        <Card style={{ gap: spacing[4] }}>
          <Text weight="semibold">Ad ve soyad</Text>
          <NameForm user={user} onSaved={refresh} />
        </Card>
        <Card style={{ gap: spacing[4] }}>
          <View style={{ gap: 2 }}>
            <Text weight="semibold">Şifre</Text>
            <Text size="sm" tone="textMuted">
              Değiştirmek için şu anki şifreni de yaz.
            </Text>
          </View>
          <PasswordForm />
        </Card>
      </Section>
      <Section title="Tercihler" description="Hesabına kaydedilir; web sitesinde de aynı ayarlar geçerli olur.">
        <Card style={{ gap: spacing[6] }}>
          <PreferenceForm user={user} onSaved={refresh} />
        </Card>
      </Section>
      <Section title="Bu cihazdaki veriler">
        <SyncStatusCard />
      </Section>
      <Button variant="secondary" icon={<LogOut size={18} color={colors.primarySoftText} />} onPress={() => void signOut()}>
        Çıkış yap
      </Button>
      <Section title="Hesabı sil">
        <DeleteAccount onDeleted={signOut} />
      </Section>
    </Screen>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text size="lg" weight="semibold">
          {title}
        </Text>
        {description && (
          <Text size="sm" tone="textMuted">
            {description}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function Header({ user, onChange }: { user: AuthUser; onChange: (user?: AuthUser) => Promise<void> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joined = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(user.createdAt));

  async function pick() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const asset = result.assets[0];
      // Kare kırpılmamışsa (ör. web) ortadan kare kesilir; sonra 256×256 JPEG (sunucu yalnızca bunu kabul eder).
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width !== asset.height) {
        context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side });
      }
      context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
      const image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
      const blob = await (await fetch(image.uri)).blob();
      const res = await fetch(api.auth.avatarPath, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${getApiToken()}` },
        body: blob,
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Fotoğraf yüklenemedi.");
      await onChange((await res.json()) as AuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fotoğraf yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onChange(await api.auth.removeAvatar());
    } catch (err) {
      setError(errorText(err, "Fotoğraf kaldırılamadı."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: spacing[5] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text size="xl" weight="semibold">
            {user.firstName} {user.lastName}
          </Text>
          <Text size="sm" tone="textMuted" numberOfLines={1}>
            {user.email}
          </Text>
          <Text size="xs" tone="textSubtle">
            {joined} tarihinden beri üye
          </Text>
        </View>
        <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
        <UserAvatar user={user} size={80} />
        <View style={{ flex: 1, gap: spacing[2] }}>
          <Button variant="secondary" size="sm" loading={busy} icon={<Camera size={16} color={colors.primarySoftText} />} onPress={() => void pick()}>
            {user.avatarUrl ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          </Button>
          {user.avatarUrl && (
            <Button variant="ghost" size="sm" disabled={busy} icon={<Trash2 size={16} color={colors.text} />} onPress={() => void remove()}>
              Kaldır
            </Button>
          )}
        </View>
      </View>
      {error && (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      )}
    </Card>
  );
}

function Saved({ text = "Kaydedildi" }: { text?: string }) {
  return (
    <Text size="sm" tone="success">
      ✓ {text}
    </Text>
  );
}

function NameForm({ user, onSaved }: { user: AuthUser; onSaved: (user?: AuthUser) => Promise<void> }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const changed = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName;

  async function save() {
    setErrors({});
    setPending(true);
    try {
      await onSaved(await api.auth.updateProfile({ firstName, lastName }));
      setSaved(true);
    } catch (err) {
      setErrors(err instanceof ApiError && err.errors ? err.errors : { form: errorText(err, "Kaydedilemedi.") });
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Input label="Ad" value={firstName} onChangeText={(v) => (setFirstName(v), setSaved(false))} error={errors.firstName} autoComplete="given-name" maxLength={40} />
      <Input label="Soyad" value={lastName} onChangeText={(v) => (setLastName(v), setSaved(false))} error={errors.lastName} autoComplete="family-name" maxLength={40} />
      {errors.form && (
        <Text size="sm" tone="danger">
          {errors.form}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <Button onPress={() => void save()} loading={pending} disabled={!changed}>
          Kaydet
        </Button>
        {saved && !changed && <Saved />}
      </View>
    </View>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function save() {
    const found: Record<string, string> = {};
    if (!current) found.currentPassword = "Şu anki şifreni yaz.";
    const problem = passwordProblem(next);
    if (!next) found.newPassword = "Yeni şifreni yaz.";
    else if (problem) found.newPassword = problem;
    if (next && repeat !== next) found.repeat = "Şifreler aynı değil.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setRepeat("");
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      else if (err instanceof ApiError && err.status === 400) setErrors({ currentPassword: err.message });
      else setErrors({ form: "Şifre değiştirilemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Input label="Şu anki şifre" value={current} onChangeText={(v) => (setCurrent(v), setSaved(false))} error={errors.currentPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      <Input label="Yeni şifre" value={next} onChangeText={(v) => (setNext(v), setSaved(false))} error={errors.newPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <Input label="Yeni şifre (tekrar)" value={repeat} onChangeText={setRepeat} error={errors.repeat} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      {next.length > 0 && <PasswordChecklist password={next} />}
      {errors.form && (
        <Text size="sm" tone="danger">
          {errors.form}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <Button onPress={() => void save()} loading={pending} disabled={!current && !next}>
          Şifreyi değiştir
        </Button>
        {saved && <Saved text="Şifren değişti" />}
      </View>
    </View>
  );
}

/** Tema ve sınav: seçilince hemen hesaba kaydedilir (tema anında uygulanır). */
function PreferenceForm({ user, onSaved }: { user: AuthUser; onSaved: (user?: AuthUser) => Promise<void> }) {
  const [error, setError] = useState<string>();
  async function save(input: Parameters<typeof api.auth.updateProfile>[0]) {
    setError(undefined);
    try {
      await onSaved(await api.auth.updateProfile(input));
    } catch (err) {
      setError(errorText(err, "Kaydedilemedi. Biraz sonra tekrar dene."));
    }
  }
  return (
    <>
      <SegmentedControl
        label="Tema"
        options={THEMES.map((t) => ({ value: t, label: THEME_LABELS[t], hint: t === "system" ? "Cihazının ayarı" : undefined }))}
        value={user.theme}
        onChange={(theme) => void save({ theme })}
      />
      <SegmentedControl
        label="Hangi sınava hazırlanıyorsun?"
        options={EXAM_TRACKS.map((t) => ({ value: t, label: EXAM_TRACK_LABELS[t] }))}
        value={user.examTrack}
        onChange={(examTrack) => void save({ examTrack })}
        error={error}
      />
    </>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const { colors } = useTheme();
  const { confirm, prompt, alert, dialog } = useDialog();
  const [pending, setPending] = useState(false);

  async function run() {
    const ok = await confirm({
      title: "Hesabını sil",
      message:
        "Hesabın ve bütün verilerin silinecek: video kaynakların, PDF'lerin ve çıkardığın sorular, sınavların, YKS sonucun, tercih listen ve defterlerin. Bu geri alınamaz.",
      confirmLabel: "Devam et",
      danger: true,
    });
    if (!ok) return;
    const password = await prompt({
      title: "Şifreni yaz",
      message: "Hesabını silmek için şifreni doğrula.",
      placeholder: "Şifre",
      secure: true,
      confirmLabel: "Hesabımı sil",
      danger: true,
    });
    if (!password) return;
    setPending(true);
    try {
      await api.auth.deleteAccount({ password });
      await onDeleted();
    } catch (err) {
      setPending(false);
      await alert({ title: "Hesap silinemedi", message: errorText(err, "Biraz sonra tekrar dene.") });
    }
  }

  return (
    <Card style={{ gap: spacing[3], borderColor: colors.danger }}>
      {dialog}
      <Text size="sm" tone="textMuted">
        Hesabın ve bütün verilerin kalıcı olarak silinir.
      </Text>
      <Button variant="danger" size="sm" loading={pending} icon={<Trash2 size={16} color={colors.onPrimary} />} onPress={() => void run()}>
        Hesabımı sil
      </Button>
    </Card>
  );
}
