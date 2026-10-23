import { useCallback, useState, type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Button } from "./button";
import { Input } from "./input";
import { Text } from "./text";

interface DialogOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  placeholder?: string;
  secure?: boolean;
  /** Kutunun ilk değeri (ör. yeniden adlandırmada şu anki ad) */
  defaultValue?: string;
  maxLength?: number;
  /** Klavye türü (ör. numara için "number-pad") */
  keyboardType?: "default" | "number-pad";
}

type Request =
  | (DialogOptions & { kind: "confirm" | "alert"; resolve: (ok: boolean) => void })
  | (DialogOptions & PromptOptions & { kind: "prompt"; resolve: (value: string | null) => void });

/**
 * Uygulama içi onay/soru pencereleri (web'deki useDialog ile aynı kullanım). React Native'in Alert'i
 * Android'de metin girişi almadığı ve web önizlemesinde düğme göstermediği için kendi penceremiz kullanılır.
 */
export function useDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const confirm = useCallback(
    (o: DialogOptions) => new Promise<boolean>((resolve) => setRequest({ ...o, kind: "confirm", resolve })),
    [],
  );
  const alert = useCallback(
    (o: DialogOptions) => new Promise<void>((resolve) => setRequest({ ...o, kind: "alert", resolve: () => resolve() })),
    [],
  );
  const prompt = useCallback(
    (o: DialogOptions & PromptOptions) =>
      new Promise<string | null>((resolve) => setRequest({ ...o, kind: "prompt", resolve })),
    [],
  );
  const dialog = request ? (
    <DialogView
      request={request}
      onDone={(value) => {
        setRequest(null);
        if (request.kind === "prompt") request.resolve(value as string | null);
        else request.resolve(value as boolean);
      }}
    />
  ) : null;
  return { confirm, alert, prompt, dialog };
}

function DialogView({ request, onDone }: { request: Request; onDone: (value: boolean | string | null) => void }) {
  const { colors } = useTheme();
  const [value, setValue] = useState(request.kind === "prompt" ? (request.defaultValue ?? "") : "");
  const cancel = () => onDone(request.kind === "prompt" ? null : request.kind === "alert");
  const submit = () => onDone(request.kind === "prompt" ? value.trim() || null : true);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={cancel}>
      <Pressable
        onPress={cancel}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing[4] }}
      >
        <Pressable
          // İçeriğe dokunmak pencereyi kapatmasın.
          onPress={() => undefined}
          style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[6], gap: spacing[4], borderWidth: 1, borderColor: colors.border }}
        >
          <Text size="lg" weight="semibold">
            {request.title}
          </Text>
          {request.message ? (
            typeof request.message === "string" ? (
              <Text size="sm" tone="textMuted">
                {request.message}
              </Text>
            ) : (
              request.message
            )
          ) : null}
          {request.kind === "prompt" && (
            <Input
              autoFocus
              value={value}
              onChangeText={setValue}
              placeholder={request.placeholder ?? request.title}
              secureTextEntry={request.secure}
              maxLength={request.maxLength}
              keyboardType={request.keyboardType}
              selectTextOnFocus
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
          )}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing[3] }}>
            {request.kind !== "alert" && (
              <Button variant="ghost" onPress={cancel}>
                Vazgeç
              </Button>
            )}
            <Button variant={request.danger ? "danger" : "primary"} onPress={submit}>
              {request.confirmLabel ?? "Tamam"}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
