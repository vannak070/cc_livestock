// The Excel library is large and only needed when someone presses a download button, so it is loaded then, not with the page.
export async function loadXlsx() {
  const mod = await import('xlsx');
  // Depending on how the bundler wraps this CommonJS library, the functions are on the module or on its default.
  return mod.utils ? mod : mod.default;
}
