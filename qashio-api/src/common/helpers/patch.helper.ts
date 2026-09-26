import { BadRequestException } from '@nestjs/common';

// The fields actually sent in a PATCH body. DTO class fields exist on the
// instance even when omitted (as undefined), so they must be filtered out.
export const definedFields = <T extends object>(dto: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

// PartialType marks every field @IsOptional(), which also lets null through.
// Rejects an empty body and null for fields that can't be cleared (NOT NULL columns),
// which would otherwise fail in the database with a 500.
export function assertValidPatch<T extends object>(
  changes: Partial<T>,
  requiredFields: readonly (keyof T)[],
) {
  if (Object.keys(changes).length === 0) {
    throw new BadRequestException('At least one field must be provided');
  }
  const nulled = requiredFields.filter((field) => changes[field] === null);
  if (nulled.length) {
    throw new BadRequestException(`${nulled.join(', ')} cannot be null`);
  }
}
