/** Navigate to a docs page: the app routes on location.hash ("#docs/<page>"). */
export function goToDoc(page: string) {
  window.location.hash = `docs/${page}`
}
