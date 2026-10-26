import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronDown, X } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Input } from "./input";
import { Sheet } from "./sheet";
import { Text } from "./text";

/** Uzun listelerde aramaya göre süzülüp bu kadarı gösterilir (yüzlerce satır çizilmesin). */
const SHOWN_MAX = 80;

const norm = (s: string) => s.toLocaleLowerCase("tr-TR");

/**
 * Çoklu seçim (web'deki MultiSelect): alan seçilenleri özetler, dokununca alttan aranabilir liste açılır.
 * Seçilenler listenin başında görünür.
 */
export function MultiSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.filter((o) => value.includes(o.value));
  const q = norm(query.trim());
  const matches = options.filter((o) => !value.includes(o.value) && (!q || norm(o.label).includes(q)));
  const summary = selected.length === 0 ? "Tümü" : selected.length === 1 ? selected[0]!.label : `${selected.length} seçili`;
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <View style={{ gap: 6 }}>
      <Text size="sm" weight="medium" tone="textMuted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary}`}
        onPress={() => setOpen(true)}
        style={{
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[2],
          paddingHorizontal: spacing[3] + 2,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: selected.length ? colors.primary : colors.borderStrong,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ flex: 1 }} tone={selected.length ? "text" : "textMuted"} numberOfLines={1}>
          {summary}
        </Text>
        {selected.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label} seçimini temizle`} onPress={() => onChange([])} hitSlop={10}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <ChevronDown size={18} color={colors.textMuted} />
        )}
      </Pressable>

      <Sheet
        visible={open}
        title={label}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
      >
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[2] }}>
          <Input placeholder="Ara" value={query} onChangeText={setQuery} autoCorrect={false} />
          {[...selected, ...matches.slice(0, SHOWN_MAX)].map((o) => {
            const on = value.includes(o.value);
            return (
              <Pressable
                key={String(o.value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(o.value)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  minHeight: 44,
                  paddingHorizontal: spacing[2],
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceMuted : "transparent",
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.sm,
                    borderWidth: 1.5,
                    alignItems: "center",
                    justifyContent: "center",
                    borderColor: on ? colors.primary : colors.borderStrong,
                    backgroundColor: on ? colors.primary : "transparent",
                  }}
                >
                  {on && <Check size={13} strokeWidth={3} color={colors.onPrimary} />}
                </View>
                <Text style={{ flex: 1 }} tone={on ? "primarySoftText" : "text"}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
          {matches.length > SHOWN_MAX && (
            <Text size="xs" tone="textSubtle" style={{ textAlign: "center", paddingVertical: spacing[2] }}>
              {matches.length - SHOWN_MAX} seçenek daha var; aramayla daralt.
            </Text>
          )}
          {!matches.length && !selected.length && (
            <Text size="sm" tone="textMuted" style={{ paddingVertical: spacing[3] }}>
              Sonuç yok.
            </Text>
          )}
        </View>
      </Sheet>
    </View>
  );
}
