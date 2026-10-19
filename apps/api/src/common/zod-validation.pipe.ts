import { BadRequestException, PipeTransform } from "@nestjs/common";
import { fieldErrors } from "@unicoach/shared";
import type { ZodType } from "zod";

/** İstek gövdesini paylaşılan zod şemasıyla doğrular; hata gövdesi `ApiErrorBody` biçimindedir. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      throw new BadRequestException({
        statusCode: 400,
        message: Object.values(errors)[0] ?? "Geçersiz istek.",
        errors,
      });
    }
    return result.data;
  }
}
