/**
 * Common validation utilities
 */
import { z } from 'zod';
import { ValidationMessage } from '../constants/validationMessages';

/**
 * Create a standard string schema with min/max length
 * @param options - Configuration options
 */
export const createStringSchema = ({
  required = true,
  minLength,
  maxLength,
  trim = true,
}: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  trim?: boolean;
} = {}) => {
  let schema = z.string().min(1, ValidationMessage.STRING_MIN(1));

  if (trim) {
    schema = schema.trim();
  }

  if (minLength !== undefined) {
    schema = schema.min(minLength, ValidationMessage.STRING_MIN(minLength));
  }

  if (maxLength !== undefined) {
    schema = schema.max(maxLength, ValidationMessage.STRING_MAX(maxLength));
  }

  if (!required) {
    schema = schema.optional();
  }

  return schema;
};

/**
 * Email validation schema
 */
export const emailSchema = z.string().trim().email(ValidationMessage.EMAIL_INVALID).toLowerCase();

/**
 * Username validation schema
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, ValidationMessage.USERNAME_LENGTH)
  .max(30, ValidationMessage.USERNAME_LENGTH)
  .regex(/^[a-zA-Z0-9_]+$/, ValidationMessage.USERNAME_FORMAT)
  .toLowerCase();

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(8, ValidationMessage.PASSWORD_STRENGTH)
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]+$/,
    ValidationMessage.PASSWORD_STRENGTH
  );

/**
 * Date string validation schema
 */
export const dateStringSchema = z.string().refine(val => !Number.isNaN(Date.parse(val)), {
  message: ValidationMessage.DATE_INVALID,
});

/**
 * ISO date string validation schema (stricter)
 */
export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/, ValidationMessage.DATE_INVALID);

/**
 * Array validation schema
 * @param schema - Schema for array items
 * @param options - Configuration options
 */
export const createArraySchema = <T extends z.ZodTypeAny>(
  schema: T,
  {
    required = true,
    minItems,
    maxItems,
    unique = false,
    nonEmpty = false,
  }: {
    required?: boolean;
    minItems?: number;
    maxItems?: number;
    unique?: boolean;
    nonEmpty?: boolean;
  } = {}
) => {
  let arraySchema = z.array(schema);

  if (nonEmpty) {
    arraySchema = arraySchema.nonempty('At least one item is required');
  }

  if (minItems !== undefined) {
    arraySchema = arraySchema.min(minItems, `Must have at least ${minItems} items`);
  }

  if (maxItems !== undefined) {
    arraySchema = arraySchema.max(maxItems, `Must have at most ${maxItems} items`);
  }

  if (unique) {
    arraySchema = arraySchema.refine(
      items => new Set(items).size === items.length,
      'Duplicate items are not allowed'
    );
  }

  if (!required) {
    arraySchema = arraySchema.optional();
  }

  return arraySchema;
};

/**
 * Social links validation schema
 */
export const socialLinksSchema = z
  .object({
    website: z.string().url().optional(),
    youtube: z.string().url().optional(),
    instagram: z.string().url().optional(),
    facebook: z.string().url().optional(),
    twitter: z.string().url().optional(),
    spotify: z.string().url().optional(),
    appleMusic: z.string().url().optional(),
    other: z.record(z.string().url()).optional(),
  })
  .optional();

/**
 * Location validation schema
 */
export const locationSchema = z.object({
  city: createStringSchema({ required: false, maxLength: 100 }),
  state: createStringSchema({ required: false, maxLength: 100 }),
  country: createStringSchema({ maxLength: 100 }),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});
