import { convert } from 'url-slug';

export const slugify = ({
  name,
  type,
  id,
}: {
  name: string;
  type?: string;
  id?: string;
}) => {
  const slug = convert(`${name}-${id}`, {
    camelCase: false,
  });

  // Return carnatic-nested URL structure
  if (type === 'compositions' || (!type && id)) {
    return `/carnatic/compositions/${slug}`;
  } else if (type === 'artists') {
    return `/carnatic/artists/${slug}`;
  } else if (type === 'ragas') {
    return `/carnatic/ragas/${slug}`;
  } else if (type === 'talas') {
    return `/carnatic/talas/${slug}`;
  }

  // Fallback for other types
  return `/carnatic/${type}/${convert(name, { camelCase: false })}`;
};
