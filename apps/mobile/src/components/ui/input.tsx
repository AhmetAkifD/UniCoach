import { useState, type ComponentRef, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { radius, spacing, typography } from "@unicoach/design";
import { fonts, useTheme } from "@/lib/theme";
import { Text } from "./text";

export type TextInputRef = ComponentRef<typeof TextInput>;

export interface InputProps extends TextInputProps {
  /** React 19: ref normal bir prop olarak alınır. */
  ref?: Ref<TextInputRef>;
  label?: string;
  error?: string;
  hint?: string;
}

/** Etiketli metin girişi (web'deki Input): odakta `primary`, hatada `danger` kenar. */
export function Input({ ref, label, error, hint, style, onFocus, onBlur, ...props }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text size="sm" weight="medium">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={colors.textSubtle}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            height: 44,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.borderStrong,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing[3] + 2,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: typography.fontSize.base[0],
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text size="sm" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
