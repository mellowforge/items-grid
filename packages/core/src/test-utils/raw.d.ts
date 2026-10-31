/** Vite's `?raw` imports (file contents as a string), for specs that read stylesheets. */
declare module '*?raw' {
  const content: string;
  export default content;
}
