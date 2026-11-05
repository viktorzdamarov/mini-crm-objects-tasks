export function Loading({ text = 'Загрузка…' }: { text?: string }) {
  return <p className="py-8 text-center text-sm text-slate-600">{text}</p>
}
