/** Full-page placeholder while a lazy route loads. */
export const PageLoader = () => {
  return (
    <main className="flex h-full items-center justify-center">
      <p role="status" className="animate-pulse text-sm text-fg-muted">
        Загрузка…
      </p>
    </main>
  )
}
