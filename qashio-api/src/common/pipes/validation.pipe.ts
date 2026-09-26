import { BadRequestException, Injectable, ValidationError, ValidationPipe } from '@nestjs/common';

export interface FieldError {
  field: string;
  messages: string[];
}

// Flattens nested DTO errors: { field: 'items.0.amount', messages: [...] }
function flattenErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...current, ...flattenErrors(error.children ?? [], field)];
  });
}

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,            
      forbidNonWhitelisted: true, 
      transform: true,           
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: flattenErrors(errors),
        }),
    });
  }
}