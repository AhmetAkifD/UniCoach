import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from "@nestjs/common";
import {
  addPreferenceSchema,
  reorderPreferencesSchema,
  type AddPreferenceInput,
  type AuthUser,
  type PreferenceItem,
  type ReorderPreferencesInput,
} from "@unicoach/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PreferencesService } from "./preferences.service";

/** YKS Tercih listesi. Değiştiren her istek listenin son hâlini döndürür. */
@Controller("preferences")
@UseGuards(AuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PreferenceItem[]> {
    return this.preferences.list(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addPreferenceSchema)) body: AddPreferenceInput,
  ): Promise<PreferenceItem[]> {
    return this.preferences.add(user.id, body.code);
  }

  @Put("order")
  reorder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reorderPreferencesSchema)) body: ReorderPreferencesInput,
  ): Promise<PreferenceItem[]> {
    return this.preferences.reorder(user.id, body.codes);
  }

  @Delete(":code")
  remove(@CurrentUser() user: AuthUser, @Param("code", ParseIntPipe) code: number): Promise<PreferenceItem[]> {
    return this.preferences.remove(user.id, code);
  }
}
