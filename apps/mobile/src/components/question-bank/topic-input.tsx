import { Pressable, View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

/**
 * Serbest konu etiketi (isteğe bağlı). Web'deki `datalist` önerilerinin karşılığı: daha önce kullanılan
 * konular kutunun altında çip olarak durur, yazdıkça süzülür, dokununca seçilir.
 */
export function TopicInput({
  value,
  onChange,
  topics,
  error,
  editable = true,
  onSubmitEditing,
}: {
  value: string;
  onChange: (value: string) => void;
  topics: string[];
  error?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
}) {
  const { colors } = useTheme();
  const query = value.trim().toLocaleLowerCase("tr-TR");
  const suggestions = topics
    .filter((t) => t.toLocaleLowerCase("tr-TR") !== query && (!query || t.toLocaleLowerCase("tr-TR").includes(query)))
    .slice(0, 8);
  return (
    <View style={{ gap: spacing[2] }}>
      <Input
        label="Konu (isteğe bağlı)"
        placeholder="ör. Türev"
        value={value}
        onChangeText={onChange}
        error={error}
        editable={editable}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
      />
      {editable && suggestions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {suggestions.map((topic) => (
            <Pressable
              key={topic}
              accessibilityRole="button"
              accessibilityLabel={`Konu: ${topic}`}
              onPress={() => onChange(topic)}
              style={{
                height: 30,
                justifyContent: "center",
                paddingHorizontal: spacing[3],
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text size="sm" tone="textMuted">
                {topic}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
