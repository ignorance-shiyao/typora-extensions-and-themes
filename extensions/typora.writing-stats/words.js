// Shared by main.js and background.js.
export function countWords(text) {
  const cjk = (text.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g) ?? []).length;
  const latin = (text.replace(/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g, " ").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return cjk + latin;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
