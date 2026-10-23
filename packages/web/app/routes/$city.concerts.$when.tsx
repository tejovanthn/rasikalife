// `/<city>/concerts/today`, `/this-weekend`, `/this-week`: the same page with the date preset
// in the path. The loader 404s any other segment.
export { default, headers, loader, meta } from './$city.concerts._index';
