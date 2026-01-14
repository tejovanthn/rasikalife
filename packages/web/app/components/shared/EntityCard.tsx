import { Link } from 'react-router';
import { slugify } from '~/lib/carnaticUtils';

export interface EntityCardField {
  label: string;
  value: string | string[] | number | undefined;
  render?: 'default' | 'array' | 'truncated';
  maxLength?: number;
}

interface EntityCardProps {
  id: string;
  title: string;
  type: 'artists' | 'compositions' | 'ragas' | 'talas';
  subtitle?: string;
  fields?: EntityCardField[];
  description?: string;
  descriptionMaxLength?: number;
  image?: string;
  imageAlt?: string;
  metadata?: {
    updatedAt?: string;
    viewCount?: number;
  };
  className?: string;
  compact?: boolean;
}

export function EntityCard({
  id,
  title,
  type,
  subtitle,
  fields = [],
  description,
  descriptionMaxLength = 150,
  image,
  imageAlt,
  metadata,
  className = '',
  compact = false,
}: EntityCardProps) {
  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const renderFieldValue = (field: EntityCardField) => {
    if (!field.value) return null;

    if (field.render === 'array' && Array.isArray(field.value)) {
      return field.value.join(', ');
    }

    if (field.render === 'truncated' && typeof field.value === 'string') {
      return truncateText(field.value, field.maxLength || 100);
    }

    return Array.isArray(field.value) ? field.value.join(', ') : field.value.toString();
  };

  return (
    <Link
      to={slugify({ name: title, id, type })}
      className={`block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card ${className}`}
    >
      {image && !compact && (
        <div className="flex items-start space-x-4">
          <img
            src={image}
            alt={imageAlt || title}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1">
            <CardContent />
          </div>
        </div>
      )}

      {image && compact && (
        <div className="text-center">
          <CardContent showImage />
        </div>
      )}

      {!image && <CardContent />}
    </Link>
  );

  function CardContent({ showImage = false }: { showImage?: boolean } = {}) {
    return (
      <>
        {showImage && image && (
          <img
            src={image}
            alt={imageAlt || title}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-2"
          />
        )}

        <h3
          className={`font-semibold text-card-foreground mb-2 ${compact ? 'text-base' : 'text-lg'}`}
        >
          {title}
        </h3>

        {subtitle && (
          <p className={`text-primary mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>{subtitle}</p>
        )}

        {fields.length > 0 && (
          <div
            className={`text-muted-foreground space-y-1 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            {fields.map(field => {
              const value = renderFieldValue(field);
              if (!value) return null;

              return (
                <div key={field.label}>
                  <span className="font-medium text-foreground">{field.label}:</span> {value}
                </div>
              );
            })}
          </div>
        )}

        {description && (
          <p
            className={`text-muted-foreground mt-2 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            {truncateText(description, descriptionMaxLength)}
          </p>
        )}

        {metadata && (metadata.updatedAt || metadata.viewCount) && (
          <div
            className={`flex justify-between items-center mt-3 text-muted-foreground ${compact ? 'text-xs' : 'text-xs'}`}
          >
            {metadata.updatedAt && (
              <span>Updated {new Date(metadata.updatedAt).toLocaleDateString()}</span>
            )}
            {metadata.viewCount && <span>{metadata.viewCount} views</span>}
          </div>
        )}
      </>
    );
  }
}
