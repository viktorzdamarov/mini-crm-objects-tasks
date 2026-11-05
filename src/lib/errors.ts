export function getErrorMessage(err: unknown): string {
  if (!err) return 'Неизвестная ошибка'
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return 'Неизвестная ошибка'
}
