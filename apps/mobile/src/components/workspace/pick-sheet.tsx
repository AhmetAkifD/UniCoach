import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { findSubject } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Ders adına göre gruplanmış liste (web'deki açılır listenin optgroup'ları) */
function bySubject<T extends { subject: string }>(list: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const label = findSubject(item.subject)?.label ?? item.subject;
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "tr"));
}

/** Çalışma Alanı'nda video ya da PDF seçimi: derslere göre gruplu liste, seçimi kaldırma ve boş durum. */
export function PickSheet<T extends { id: string; title: string; subject: string }>({
  visible,
  title,
  items,
  value,
  empty,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: T[] | null;
  value: string | null;
  /** Hiç öğe yokken gösterilen açıklama */
  empty: string;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const pick = (id: string | null) => {
    onClose();
    if (id !== value) onPick(id);
  };
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing[4], gap: spacing[3] }}>
        {items && !items.length && (
          <Text size="sm" tone="textMuted" style={{ paddingVertical: spacing[2] }}>
            {empty}
          </Text>
        )}
        {bySubject(items ?? []).map(([label, group]) => (
          <View key={label} style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[1], paddingBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: subjectColor(group[0]!.subject) }} />
              <Text size="xs" weight="semibold" tone="textMuted">
                {label}
              </Text>
            </View>
            {group.map((item) => {
              const on = item.id === value;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => pick(item.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                    minHeight: 44,
                    paddingHorizontal: spacing[3],
                    borderRadius: radius.md,
                    backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceMuted : "transparent",
                  })}
                >
                  <Text style={{ flex: 1 }} tone={on ? "primarySoftText" : "text"} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {on && <Check size={18} color={colors.primarySoftText} />}
                </Pressable>
              );
            })}
          </View>
        ))}
        {value && (
          <Button variant="ghost" onPress={() => pick(null)}>
            Seçimi kaldır
          </Button>
        )}
      </View>
    </Sheet>
  );
}
