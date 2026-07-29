/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Helper methods for checking program state.
 *
 * Statically all helpers assert that the type of the input is sufficiently
 * narrow. At runtime the helpers behave in two different ways:
 * - checkExhaustive* - unconditionally throws.
 * - assumeExhaustive* - does nothing.
 *
 * Prefer `checkExhaustive()` unless you find yourself writing
 * `try {
 *    checkExhaustive(value);
 *  } catch (error) {
 *    // Handle the error.
 *  }`
 * in which case use `assumeExhaustive()` directly, without the `try`.
 */

/**
 * Throw an exception on unexpected values.
 *
 * checkExhaustive can be used along with type narrowing to ensure at
 * compile time that all possible types for a value have been handled. For cases
 * where exhaustiveness can not be guaranteed at compile time (i.e. proto enums)
 * an exception will be thrown.
 *
 * A common use-case is in switch statements:
 *
 * ```
 * // enumValue: Enum.A | Enum.B
 * switch(enumValue) {
 *   case Enum.A:
 *   case Enum.B:
 *     break;
 *   default:
 *     checkExhaustive(enumValue);
 * }
 * ```
 *
 * This method throws an exception rather than using an assertion because
 * assertions are stripped in production code and we need the check to fail in
 * production.
 *
 * @param value The value to be checked
 * @param msg An optional error message to throw
 */
export function checkExhaustive(value: never, msg?: string): never {
  return checkExhaustiveAllowing<never>(value, msg);
}

/**
 * Throw an exception on unexpected values.
 *
 * checkExhaustiveAllowing is similar to checkExhaustive, with one difference
 * that user can specify expected type of value other than 'never'.
 *
 * The template parameter is absolutely required so that the type checker can
 * actually ensure that nothing other than the explicitly-allowed types is
 * passed.  If the allowed type is broader than you expect, consider trying a
 * different approach to narrow it, or else using the go/guards-and-assertions
 * library to make a different kind of assertion.
 *
 * It is useful when enum contains values that should never occur. Those should
 * be passed as the type argument to checkExhaustiveAllowing. A common use-case
 * would be like:
 *
 * ```
 * // enumValue: Enum.A | Enum.B | Enum.UNSPECIFIED | Enum.UNKNOWN
 * switch(enumValue) {
 *   case Enum.A:
 *   case Enum.B:
 *     break;
 *   default:
 *     checkExhaustiveAllowing<Enum.UNSPECIFIED|Enum.UNKNOWN>(enumValue);
 * }
 * ```
 *
 * @param value The value to be checked
 * @param msg An optional error message to throw
 */
export function checkExhaustiveAllowing<
  Allowed = never,
  Arg extends Allowed = Allowed,
>(value: Arg, msg = `unexpected value ${value}!`): never {
  throw new Error(msg);
}

/**
 * Type argument for legacy incorrect usages of `checkExhaustiveAllowing`.
 * This function is intended to be called with an explicit template parameter,
 * but this was not always enforced. When the parameter is elided, the type
 * checker cannot actually verify anything useful. This placeholder type allows
 * legacy callsites to continue passing type checking, but should not be used in
 * new calls.
 *
 * Consider replacing the call to `checkExhaustiveAllowing` with a call to the
 * Guards and Assertions library (go/guards-and-assertions).
 */
export type LegacyIncorrectUsage = unknown;

/**
 * Fail to compile on unexpected values.
 *
 * assumeExhaustive can be used along with type narrowing to ensure at compile
 * time that all possible types for a value have been handled. At runtime it is
 * a no-op.
 *
 * A common use-case is in switch statements:
 *
 * ```
 * // sensibleDefault: string
 * // numericEnumValue: Enum.A | Enum.B
 * switch(numericEnumValue) {
 *   case Enum.A:
 *     return 'A';
 *   case Enum.B:
 *     return 'B';
 *   default:
 *     assumeExhaustive(numericEnumValue);
 *     return sensibleDefault;
 * }
 * ```
 */
export function assumeExhaustive(_value: never): void {}

/**
 * Fail to compile on unexpected values.
 *
 * assumeExhaustiveAllowing is similar to assumeExhaustive, with one difference
 * that user can specify expected type of value other than 'never'.
 *
 * It is useful when enum contains values that should never occur. Those should
 * be passed as the type argument to assumeExhaustiveAllowing. A common use-case
 * would be like:
 *
 * ```
 * // enumValue: Enum.A | Enum.B | Enum.UNSPECIFIED | Enum.UNKNOWN
 * switch(enumValue) {
 *   case Enum.A:
 *     break;
 *   case Enum.B:
 *     break;
 *   default:
 *     assumeExhaustiveAllowing<Enum.UNSPECIFIED|Enum.UNKNOWN>(enumValue);
 *     break;
 * }
 * ```
 */
export function assumeExhaustiveAllowing<
  Allowed = never,
  Arg extends Allowed = Allowed,
>(_value: Arg): void {}
