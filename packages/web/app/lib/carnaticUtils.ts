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
  let slug = '';
  if (id) {
    slug = convert(`${name}-${id}`, {
      camelCase: false,
    });
    return `/carnatic/songs/${slug}`;
  }
  slug = convert(name, {
    camelCase: false,
  });
  return `/carnatic/${type}/${slug}`;
  return '';
};
