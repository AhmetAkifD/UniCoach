import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { CircleAlert, FileText, ShieldCheck, TriangleAlert, Upload } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, parseYksResult, ResultParseError, type ParsedYksResult } from "@unicoach/shared";
import { PageFrame, type PageFrameHandle } from "@/components/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { API_BASE_URL, api } from "@/lib/api";
import { RESULT_PDF_MAX_BYTES, resultPdfHtml, toBase64, type ResultPdfEvent } from "@/lib/result-pdf";
import { useTheme } from "@/lib/theme";
import { ResultSummary } from "./result-summary";

const normalizeName = (name: string) => name.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();

/**
 * Sonuç belgesini cihazda okur, önizletir; öğrenci onaylayınca yalnızca puanlar kaydedilir (web'deki ResultImport).
 * Belge hiçbir yere yüklenmez; T.C. kimlik no ve ad soyad API'ye gönderilmez.
 */
export function ResultImport({ savedYears, accountName, onSaved }: { savedYears: number[]; accountName: string; onSaved: () => void }) {
  const { colors } = useTheme();
  const { confirm, dialog } = useDialog();
  const frameRef = useRef<PageFrameHandle>(null);
  const html = useMemo(() => resultPdfHtml(), []);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<ParsedYksResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick() {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: false, base64: false });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    setParsed(null);
    setFileName(asset.name);
    if (asset.mimeType !== "application/pdf" && !/\.pdf$/i.test(asset.name)) return setError("Yalnızca PDF dosyası seçebilirsin.");
    if ((asset.size ?? 0) > RESULT_PDF_MAX_BYTES) return setError("Bu dosya bir sonuç belgesi için çok büyük.");
    setReading(true);
    try {
      // Web önizlemesinde seçici `File` verir; telefonda dosya content:// adresinden okunur.
      const buffer = asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
      frameRef.current?.call("read", toBase64(buffer));
    } catch {
      setReading(false);
      setError("Belge okunamadı.");
    }
  }

  function onMessage(m: unknown) {
    const e = m as ResultPdfEvent;
    if (e.type === "ready") return;
    setReading(false);
    if (e.type === "error") return setError(e.message);
    if (e.items.length < 20) {
      return setError("Belgede okunabilir metin yok. Ekran görüntüsü ya da taranmış belge yerine ÖSYM'nin PDF çıktısını seç.");
    }
    try {
      setParsed(parseYksResult(e.items));
    } catch (err) {
      setError(err instanceof ResultParseError ? err.message : "Belge okunamadı.");
    }
  }

  async function save() {
    if (!parsed) return;
    if (
      savedYears.includes(parsed.year) &&
      !(await confirm({ title: `${parsed.year} sonucu zaten kayıtlı`, message: "Kayıtlı sonucun bu belgedeki değerlerle değiştirilecek.", confirmLabel: "Değiştir" }))
    )
      return;
    setSaving(true);
    try {
      // Ad soyad gönderilmez; yalnızca puanlar, sıralar, OBP ve netler.
      const { year, diplomaGrade, obp, scores, tests } = parsed;
      await api.results.save(year, { source: "document", diplomaGrade, obp, scores, tests });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sonuç kaydedilemedi.");
      setSaving(false);
    }
  }

  const nameMismatch = parsed?.fullName && normalizeName(parsed.fullName) !== normalizeName(accountName);

  return (
    <View style={{ gap: spacing[4] }}>
      {dialog}
      {/* Görünmeyen okuyucu sayfası (ekran dışında; Android sıfır boyutlu WebView'i çalıştırmayabilir) */}
      <View pointerEvents="none" style={{ position: "absolute", left: -1000, top: 0, width: 50, height: 50, opacity: 0 }}>
        <PageFrame ref={frameRef} html={html} baseUrl={`${API_BASE_URL}/`} background="#ffffff" onMessage={onMessage} style={{ width: 50, height: 50 }} />
      </View>

      <Card style={{ gap: spacing[4] }}>
        <View style={{ gap: 4 }}>
          <Text weight="semibold">ÖSYM sonuç belgen</Text>
          <Text size="sm" tone="textMuted">
            ÖSYM Sonuç Açıklama Sistemi'nde YKS sonucunu aç ve sayfayı PDF olarak kaydet (Paylaş → Yazdır → PDF olarak kaydet).
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fileName ? `Seçilen belge: ${fileName}. Başka bir belge seçmek için dokun.` : "Sonuç belgeni seç"}
          disabled={reading || saving}
          onPress={() => void pick()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[3],
            padding: spacing[4],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: error ? colors.danger : colors.borderStrong,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          {reading ? (
            <ActivityIndicator color={colors.primary} />
          ) : fileName ? (
            <FileText size={28} color={colors.primary} strokeWidth={1.75} />
          ) : (
            <Upload size={28} color={colors.textSubtle} strokeWidth={1.75} />
          )}
          <View style={{ flex: 1 }}>
            <Text weight="medium" numberOfLines={1}>
              {fileName ?? "Sonuç belgeni seç"}
            </Text>
            <Text size="sm" tone="textMuted">
              {reading ? "Belge okunuyor…" : fileName ? "Başka bir belge seç" : "PDF"}
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start" }}>
          <ShieldCheck size={16} color={colors.textSubtle} />
          <Text size="xs" tone="textSubtle" style={{ flex: 1 }}>
            Belge telefonunda okunur ve hiçbir yere yüklenmez. Yalnızca puanların, sıraların, OBP'n ve netlerin kaydedilir; T.C. kimlik numaran ve adın gönderilmez.
          </Text>
        </View>
        {error && (
          <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}>
            <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
            <Text size="sm" tone="danger" style={{ flex: 1 }}>
              {error}
            </Text>
          </View>
        )}
      </Card>

      {parsed && (
        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
            <Text size="lg" weight="semibold">
              {parsed.year} YKS sonucu
            </Text>
            <Badge tone="info">Önizleme</Badge>
          </View>
          {nameMismatch && (
            <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing[3] }}>
              <TriangleAlert size={16} color={colors.warning} style={{ marginTop: 2 }} />
              <Text size="sm" tone="warning" style={{ flex: 1 }}>
                Belgedeki ad hesabındaki adla eşleşmiyor. Kendi belgeni seçtiğinden emin ol.
              </Text>
            </View>
          )}
          <ResultSummary result={parsed} />
          <Button loading={saving} onPress={() => void save()}>
            Sonucu kaydet
          </Button>
          <Button variant="ghost" disabled={saving} onPress={() => setParsed(null)}>
            Vazgeç
          </Button>
        </View>
      )}
    </View>
  );
}
