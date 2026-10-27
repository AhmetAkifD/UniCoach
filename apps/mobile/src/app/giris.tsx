import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { CircleAlert, CircleCheck, GraduationCap, Pencil, QrCode } from "lucide-react-native";
import {
  ApiError,
  EXAM_TRACK_LABELS,
  EXAM_TRACKS,
  checkEmailSchema,
  fieldErrors,
  loginSchema,
  registerSchema,
  type ExamTrack,
  type FieldErrors,
} from "@unicoach/shared";
import { radius, spacing } from "@unicoach/design";
import { PasswordChecklist } from "@/components/password-checklist";
import { Button } from "@/components/ui/button";
import { Input, type TextInputRef } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

type Step = { name: "email" } | { name: "password"; email: string; notice?: string } | { name: "register"; email: string };

/**
 * E-posta öncelikli giriş (web'deki /giris ile aynı akış):
 *   e-posta → kayıtlıysa şifre → ana sayfa;  değilse kayıt (ad, soyad, şifre, sınav) → şifre → ana sayfa.
 */
export default function SignIn() {
  const { signIn, expired } = useSession();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [examTrack, setExamTrack] = useState<ExamTrack | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const lastNameRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);

  function go(next: Step) {
    setErrors({});
    setFormError(undefined);
    setPassword("");
    setStep(next);
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) setErrors(err.errors);
        else setFormError(err.message);
      } else {
        setFormError("Sunucuya ulaşılamadı. Telefonun ve bilgisayarın aynı Wi‑Fi ağında mı?");
      }
    } finally {
      setPending(false);
    }
  }

  const submitEmail = () => {
    const parsed = checkEmailSchema.safeParse({ email });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    void run(async () => {
      const { exists } = await api.auth.checkEmail(parsed.data);
      go(exists ? { name: "password", email: parsed.data.email } : { name: "register", email: parsed.data.email });
    });
  };

  const submitPassword = (current: string) => {
    const parsed = loginSchema.safeParse({ email: current, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    void run(async () => {
      const res = await api.auth.login(parsed.data);
      await signIn(res.accessToken, res.user);
    });
  };

  const submitRegister = (current: string) => {
    const parsed = registerSchema.safeParse({ email: current, firstName, lastName, password, examTrack });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    void run(async () => {
      await api.auth.register(parsed.data);
      go({ name: "password", email: current, notice: "Hesabın oluşturuldu. Şimdi şifrenle giriş yap." });
    });
  };

  return (
    <Screen edges={["top", "bottom"]} contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <GraduationCap size={20} color={colors.onPrimary} strokeWidth={1.75} />
        </View>
        <Text size="lg" weight="semibold">
          UniCoach
        </Text>
      </View>

      <View style={{ gap: spacing[5] }}>
        <Text size="2xl" weight="semibold">
          {step.name === "register" ? "Hesabını oluştur" : "UniCoach'a giriş yap"}
        </Text>

        {expired && step.name === "email" && (
          <Notice tone="danger">Oturumunun süresi doldu. Yeniden giriş yap ya da QR ile bağlan; bu telefondaki notların ve gönderilmemiş değişikliklerin silinmedi, aynı hesapla girince gönderilir.</Notice>
        )}
        {step.name === "password" && step.notice && <Notice tone="success">{step.notice}</Notice>}
        {formError && <Notice tone="danger">{formError}</Notice>}

        {step.name === "email" ? (
          <>
            <Input
              placeholder="E-posta adresi"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={submitEmail}
            />
            <Button onPress={submitEmail} loading={pending}>
              Devam et
            </Button>
          </>
        ) : (
          <>
            <EmailRow email={step.email} onChange={() => go({ name: "email" })} />
            {step.name === "register" && (
              <>
                <View style={{ flexDirection: "row", gap: spacing[3] }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder="Ad"
                      value={firstName}
                      onChangeText={setFirstName}
                      error={errors.firstName}
                      autoComplete="given-name"
                      returnKeyType="next"
                      onSubmitEditing={() => lastNameRef.current?.focus()}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      ref={lastNameRef}
                      placeholder="Soyad"
                      value={lastName}
                      onChangeText={setLastName}
                      error={errors.lastName}
                      autoComplete="family-name"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                </View>
              </>
            )}
            <Input
              ref={passwordRef}
              placeholder="Şifre"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={step.name === "register" ? "new-password" : "current-password"}
              returnKeyType="go"
              onSubmitEditing={() => (step.name === "register" ? submitRegister(step.email) : submitPassword(step.email))}
            />
            {step.name === "register" && (
              <>
                {password.length > 0 && <PasswordChecklist password={password} />}
                <SegmentedControl
                  label="Hangi sınava hazırlanıyorsun?"
                  options={EXAM_TRACKS.map((t) => ({ value: t, label: EXAM_TRACK_LABELS[t] }))}
                  value={examTrack}
                  onChange={setExamTrack}
                  error={errors.examTrack}
                />
              </>
            )}
            <Button
              onPress={() => (step.name === "register" ? submitRegister(step.email) : submitPassword(step.email))}
              loading={pending}
            >
              {step.name === "register" ? "Hesap oluştur" : "Giriş yap"}
            </Button>
          </>
        )}
      </View>
      {/* Bilgisayardaki UniCoach'un Profil → Telefonu eşle kodu: sunucu adresini ve oturumu birlikte getirir. */}
      <Button variant="ghost" icon={<QrCode size={18} color={colors.text} />} onPress={() => router.push("/eslestir")}>
        QR ile bağlan
      </Button>
    </Screen>
  );
}

function EmailRow({ email, onChange }: { email: string; onChange: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing[2],
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: 10,
      }}
    >
      <Text size="sm" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
        {email}
      </Text>
      <Pressable accessibilityRole="button" onPress={onChange} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8}>
        <Pencil size={14} color={colors.primary} />
        <Text size="sm" weight="medium" tone="primary">
          Değiştir
        </Text>
      </Pressable>
    </View>
  );
}

function Notice({ tone, children }: { tone: "success" | "danger"; children: string }) {
  const { colors } = useTheme();
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        gap: spacing[2],
        borderRadius: radius.md,
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[3],
        backgroundColor: tone === "success" ? colors.successSoft : colors.dangerSoft,
      }}
    >
      <Icon size={16} color={tone === "success" ? colors.success : colors.danger} style={{ marginTop: 2 }} />
      <Text size="sm" tone={tone} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
